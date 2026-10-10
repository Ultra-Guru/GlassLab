import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUserIdOrNull } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Zod schema mirroring GlassConfig (src/lib/glass/presets.ts).
 * Keeps malformed payloads out of the database.
 */

/**
 * Colors are interpolated into CSS strings downstream (saved-preset swatch
 * gradients, glow box-shadow), so only formats the lab actually produces are
 * accepted: #hex (3/4/6/8), rgb()/rgba()/hsl()/hsla() comma syntax, and
 * `transparent`. Everything else — including CSS-injection payloads — is 400.
 */
const COLOR_PATTERN =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|rgba|hsl|hsla)\(\s*-?\d+(?:\.\d+)?%?(?:\s*,\s*-?\d+(?:\.\d+)?%?){2,3}\s*\)|transparent)$/i

const colorField = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine(v => COLOR_PATTERN.test(v), {
      message:
        'Must be a color value: #hex, rgb()/rgba()/hsl()/hsla(), or "transparent"',
    })

const glassConfigSchema = z.object({
  refraction: z.number().min(0).max(120),
  height: z.number().min(1).max(150),
  dispersion: z.number().min(0).max(1),
  blur: z.number().min(0).max(60),
  saturation: z.number().min(0).max(300),
  cornerRadius: z.number().min(0).max(999),
  depthEffect: z.boolean(),
  highlight: z.number().min(0).max(1),
  // Phase 2 field — default keeps pre-lightAngle payloads (older clients and
  // stored rows) valid instead of 400/corrupt.
  lightAngle: z.number().min(0).max(360).default(45),
  tint: colorField(32),
  tintOpacity: z.number().min(0).max(1),
  overLight: z.boolean(),
  elasticity: z.number().min(0).max(1),
  glow: colorField(64),
  // Phase 5 layered effects — defaults keep pre-Phase-5 payloads (older
  // clients and stored rows) valid instead of 400/corrupt.
  frost: z.number().min(0).max(1).default(0),
  edgeBlur: z.number().min(0).max(1).default(0),
  vignette: z.number().min(0).max(1).default(0),
  // Phase 7 lens field (shuding/liquid-glass + Kyant0 backdrop) — default
  // keeps pre-Phase-7 payloads (older clients and stored rows) valid.
  lensing: z.number().min(0).max(1).default(0),
})

const createPresetSchema = z.object({
  name: z.string().trim().min(1).max(48),
  config: glassConfigSchema,
  // Phase 3 M2: client-generated cover snapshot (optional). Must be a base64
  // image data URL — it flows into <img src>, so the whitelist is strict.
  cover: z
    .string()
    .max(200_000)
    .refine(v => COVER_DATA_URL_PATTERN.test(v), {
      message: 'cover must be a base64 image data URL (png/jpeg/webp)',
    })
    .nullable()
    .optional(),
})

/** Legit config-only payloads are < 1KB; a JPEG cover adds ~40KB.
 *  The cap stays far below anything abusive while making room for covers. */
const MAX_BODY_BYTES = 300 * 1024

const COVER_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

/**
 * Phase 4 M1: list cap stays as a guard rail, but it is no longer silent —
 * the response carries `total` so clients can surface truncation.
 */
const PRESET_LIST_LIMIT = 100

/**
 * GET query params (Phase 4 M1; Phase 6 M2 adds `view`). `q` filters by name
 * substring; empty/absent q means "no filter" rather than an error. Unknown
 * `sort`/`view` values are 400.
 *
 * `view` controls the visibility slice:
 *  - all (default): signed-in → own ∪ public; guest → public
 *  - mine: signed-in → own only; guest → empty set (no ownership concept)
 *  - public: public rows only (userId IS NULL)
 */
const listQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(48)
    .optional()
    .transform(v => (v && v.length > 0 ? v : undefined)),
  sort: z.enum(['recent', 'name', 'favorites']).default('recent'),
  view: z.enum(['all', 'mine', 'public']).default('all'),
})

/**
 * Parse a stored config string defensively. Corrupted rows (disk damage,
 * manual edits, historic bugs) must never take the whole endpoint down.
 */
function parseStoredConfig(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

/**
 * GET /api/presets — list presets visible to the caller with search, sort and
 * a total count. Signed-in users see their own presets; guests see public
 * presets (userId = null, i.e. saved without an account).
 *
 * Response: { presets, total, limit } — `total` counts all matching rows in
 * the database, so clients can detect both take-limit truncation and rows
 * skipped due to corrupted config payloads.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const parsedQ = listQuerySchema.safeParse({
      q: searchParams.get('q') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      view: searchParams.get('view') ?? undefined,
    })
    if (!parsedQ.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: parsedQ.error.flatten() },
        { status: 400 }
      )
    }
    const { q, sort, view } = parsedQ.data

    // Validated lookup: a stale JWT (deleted account) degrades to guest
    // visibility instead of an empty private set.
    const userId = await getSessionUserIdOrNull()

    // Phase 6 M2: guests own nothing — `mine` is a well-defined empty set
    // rather than an error, so the UI can render the empty state uniformly.
    if (view === 'mine' && !userId) {
      return NextResponse.json({ presets: [], total: 0, limit: PRESET_LIST_LIMIT })
    }

    const nameFilter = q ? { name: { contains: q } } : {}
    const visibilityFilter =
      view === 'public'
        ? { userId: null }
        : view === 'mine'
          ? { userId }
          : userId
            ? // own ∪ public — OR is ANDed with nameFilter on the same level
              { OR: [{ userId }, { userId: null }] }
            : { userId: null }
    const where = { ...visibilityFilter, ...nameFilter }
    const orderBy: Prisma.GlassPresetOrderByWithRelationInput[] =
      sort === 'name'
        ? [{ name: 'asc' }]
        : sort === 'favorites'
          ? [{ favorite: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }]

    const [rows, total] = await Promise.all([
      db.glassPreset.findMany({ where, orderBy, take: PRESET_LIST_LIMIT }),
      db.glassPreset.count({ where }),
    ])

    const presets = []
    for (const r of rows) {
      const parsed = parseStoredConfig(r.config)
      if (!parsed.ok) {
        // Skip corrupted rows so one bad record can't poison the whole list.
        // (The row remains deletable via DELETE /api/presets/[id].)
        console.warn('[api/presets] GET: skipping corrupted config row', r.id)
        continue
      }
      presets.push({
        id: r.id,
        name: r.name,
        config: parsed.value,
        cover: r.cover,
        favorite: r.favorite,
        // Phase 6 M2: ownership badge data — signed-in callers learn which
        // rows are theirs; guests always see public rows (mine=false).
        mine: userId !== null && r.userId === userId,
        createdAt: r.createdAt.toISOString(),
      })
    }
    return NextResponse.json({ presets, total, limit: PRESET_LIST_LIMIT })
  } catch (error) {
    console.error('[api/presets] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load presets' },
      { status: 500 }
    )
  }
}

/** POST /api/presets — save a glass preset. */
export async function POST(req: NextRequest) {
  try {
    const len = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    // Client payload errors are 4xx, not server faults — keep JSON parsing
    // out of the generic 500 catch below.
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createPresetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid preset payload', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Validated against the users table: a stale JWT (deleted account) must
    // degrade to a public row, not blow up the INSERT with an FK violation.
    const userId = await getSessionUserIdOrNull()
    const row = await db.glassPreset.create({
      data: {
        name: parsed.data.name,
        config: JSON.stringify(parsed.data.config),
        cover: parsed.data.cover ?? null,
        // Signed-in → private preset owned by the user; guest → public.
        userId,
      },
    })

    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        config: parsed.data.config,
        cover: row.cover,
        favorite: row.favorite,
        mine: userId !== null,
        createdAt: row.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[api/presets] POST failed:', error)
    return NextResponse.json(
      { error: 'Failed to save preset' },
      { status: 500 }
    )
  }
}
