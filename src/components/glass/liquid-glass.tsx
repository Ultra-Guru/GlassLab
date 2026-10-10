'use client'

/*
 * LiquidGlass — web port of Kyant0/AndroidLiquidGlass.
 *
 * Upstream: https://github.com/Kyant0/AndroidLiquidGlass (Apache-2.0)
 * The rounded-rect refraction / dispersion shader (AGSL) is re-expressed as:
 *   1. a canvas-baked displacement map (see lib/glass/displacement-map.ts)
 *   2. an SVG filter chain: feImage -> feDisplacementMap (x3 spectral taps)
 *      -> feGaussianBlur -> feColorMatrix(saturate)
 *   3. a CSS fresnel rim highlight (Kyant0: HighlightStyle.Default, 45°)
 *
 * Phase 7 — algorithm fusion with the wider liquid-glass ecosystem:
 *
 * - Dynamic displacement-map normalization + lens field from
 *   shuding/liquid-glass (see displacement-map.ts for the math).
 * - Interactive layer from rdev/liquid-glass-react + Kyant0 backdrop's
 *   InteractiveHighlight: pointer-following fresnel rim (gradient rotates
 *   and brightens towards the cursor) and a soft press glow emitted from the
 *   touch point. Both are gated behind the `interactive` prop.
 * - Apple accessibility switches: `prefers-reduced-motion` freezes the
 *   interactive layer, `prefers-reduced-transparency` deepens tint/frost so
 *   content stays readable (WWDC25: "reduce transparency -> more frosty").
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { withAlpha } from '@/lib/glass/color'
import {
  renderDisplacementMap,
  type BakedDisplacementMap,
} from '@/lib/glass/displacement-map'
import type { GlassConfig } from '@/lib/glass/presets'

export interface LiquidGlassProps {
  config: GlassConfig
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** Render scale of the displacement map for crispness */
  mapScale?: number
  /** Disable refraction entirely (cheap mode) */
  disabled?: boolean
  /**
   * Phase 7: pointer-reactive layer — fresnel rim follows the cursor and a
   * glow blooms from the press point (rdev/liquid-glass-react + Kyant0
   * InteractiveHighlight). Automatically disabled under
   * prefers-reduced-motion.
   */
  interactive?: boolean
}

/** True when the browser supports SVG-filter references in backdrop-filter. */
function supportsSvgBackdrop(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
  // Firefox parses url() in backdrop-filter but does not render SVG filter
  // references there (bugzilla #1738191) — CSS.supports only checks syntax,
  // so Firefox must be excluded explicitly to reach the blur fallback.
  const isFirefox = /firefox|fxios/i.test(ua)
  if (isSafari || isFirefox) return false
  return (
    typeof CSS !== 'undefined' &&
    (CSS.supports?.('backdrop-filter', 'url(#f) blur(1px)') ?? false)
  )
}

function rimGradient(
  angleDeg: number,
  highlight: number,
  nx: number,
  ny: number
): string {
  // rdev/liquid-glass-react rim math: cursor offsets rotate the gradient and
  // brighten the facing stops, so the "light source" appears to track the
  // pointer around the rim.
  const angle = ((angleDeg + nx * 14) % 360 + 360) % 360
  const boost = 1 + Math.min(1, Math.hypot(nx, ny)) * 0.3
  const a = (v: number) => (v * boost).toFixed(3)
  const s1 = Math.max(4, Math.min(46, 28 + ny * 6))
  const s2 = Math.max(54, Math.min(96, 72 + ny * 8))
  return `linear-gradient(${angle.toFixed(1)}deg,
    rgba(255,255,255,${a(0.75 * highlight)}) 0%,
    rgba(255,255,255,${a(0.18 * highlight)}) ${s1.toFixed(1)}%,
    rgba(255,255,255,${a(0.02 * highlight)}) 50%,
    rgba(255,255,255,${a(0.10 * highlight)}) ${s2.toFixed(1)}%,
    rgba(255,255,255,${a(0.45 * highlight)}) 100%)`
}

function LiquidGlassImpl({
  config,
  children,
  className,
  style,
  mapScale = 2,
  disabled = false,
  interactive = false,
}: LiquidGlassProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const filterId = `lg-${rawId}`
  const blurId = `b-${rawId}`
  const mapId = `m-${rawId}`
  const dispRId = `dr-${rawId}`
  const dispGId = `dg-${rawId}`
  const dispBId = `db-${rawId}`
  const cRId = `cr-${rawId}`
  const cGId = `cg-${rawId}`
  const cBId = `cb-${rawId}`
  const rgId = `rg-${rawId}`
  const satId = `st-${rawId}`
  const noiseId = `nz-${rawId}`

  const hostRef = useRef<HTMLDivElement>(null)
  const rimRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [baked, setBaked] = useState<BakedDisplacementMap | null>(null)
  const [svgOk, setSvgOk] = useState(true)
  // Apple accessibility switches (matchMedia-driven).
  const [reducedMotion, setReducedMotion] = useState(false)
  const [reducedTransparency, setReducedTransparency] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSvgOk(supportsSvgBackdrop()))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mqTrans = window.matchMedia('(prefers-reduced-transparency: reduce)')
    const sync = () => {
      setReducedMotion(mqMotion.matches)
      setReducedTransparency(mqTrans.matches)
    }
    sync()
    mqMotion.addEventListener('change', sync)
    mqTrans.addEventListener('change', sync)
    return () => {
      mqMotion.removeEventListener('change', sync)
      mqTrans.removeEventListener('change', sync)
    }
  }, [])

  // Observe the element size so the displacement map always matches.
  useEffect(() => {
    // ResizeObserver fires once when observation starts, so the initial
    // measurement lands through the same async callback.
    const el = hostRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSize(prev =>
        Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
          ? { w: rect.width, h: rect.height }
          : prev
      )
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bake the Kyant0 (+ shuding lens) displacement vector field, dynamically
  // normalized to the full 8-bit range (rAF-debounced).
  useEffect(() => {
    let raf = 0
    let cancelled = false
    const bake = () => {
      raf = 0
      if (size.w < 4 || size.h < 4 || disabled) {
        setBaked(null)
        return
      }
      const bakedMap = renderDisplacementMap({
        width: size.w,
        height: size.h,
        cornerRadius: config.cornerRadius,
        refractionHeight: config.height,
        refractionAmount: config.refraction,
        depthEffect: config.depthEffect,
        lensing: config.lensing ?? 0,
        scale: mapScale,
      })
      if (!cancelled) setBaked(bakedMap)
    }
    raf = requestAnimationFrame(bake)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
    }
  }, [
    size.w,
    size.h,
    config.cornerRadius,
    config.height,
    config.refraction,
    config.depthEffect,
    config.lensing,
    mapScale,
    disabled,
  ])

  const radiusPx = useMemo(
    () =>
      config.cornerRadius >= 999
        ? 9999
        : Math.max(0, Math.min(config.cornerRadius, Math.min(size.w, size.h) / 2 || 0)),
    [config.cornerRadius, size.w, size.h]
  )

  const radiusStyle = useCallback(
    (extra?: number): React.CSSProperties => ({
      borderRadius: config.cornerRadius >= 999 ? 9999 : `${Math.max(0, radiusPx - (extra ?? 0))}px`,
    }),
    [config.cornerRadius, radiusPx]
  )

  // ---------- SVG filter chain ----------
  // With dynamic normalization the decode scale comes from the baked map
  // itself (2 * maxAbs / renderScale) instead of a fixed 2 * refraction, so
  // rim refraction and the lens field share the full 8-bit precision.
  const dispScale = Math.max(0.001, baked?.maxScale ?? config.refraction * 2)
  const k = Math.max(0, Math.min(1, config.dispersion))
  const useDispersion = k > 0.01
  const blurReady = baked !== null && size.w > 4
  const active = !disabled && svgOk && blurReady

  // Apple accessibility: reduced transparency deepens the tint/frost floors
  // (and the fallback blur) so content stays readable on any backdrop.
  const tintOpacityEff = reducedTransparency
    ? Math.max(config.tintOpacity, 0.38)
    : config.tintOpacity
  const fallbackBlur = reducedTransparency
    ? Math.max(config.blur, 12)
    : Math.max(config.blur, 8)

  const backdropFilter = active
    ? `url(#${filterId})`
    : `blur(${fallbackBlur}px) saturate(${config.saturation}%)`

  const tintRgba = useMemo(() => withAlpha(config.tint, tintOpacityEff), [
    config.tint,
    tintOpacityEff,
  ])

  // Fresnel rim highlight — Kyant0 HighlightStyle.Default (plus-blend).
  // Phase 2: direction is user-controlled via `lightAngle`; overLight rotates
  // 90° to keep the rim readable against bright backdrops.
  const highlight = Math.max(0, Math.min(1, config.highlight))
  const ringPad = 1.5

  const overLight = config.overLight
  const lightAngleDeg =
    ((Math.round(Number.isFinite(config.lightAngle) ? config.lightAngle : 45) % 360) + 360) % 360
  const rimAngle = overLight ? (lightAngleDeg + 90) % 360 : lightAngleDeg

  // Phase 5 layered effects
  const frost = Math.max(0, Math.min(1, config.frost ?? 0))
  const frostEff = reducedTransparency ? Math.max(frost, 0.35) : frost
  const edgeBlur = Math.max(0, Math.min(1, config.edgeBlur ?? 0))
  const vignette = Math.max(0, Math.min(1, config.vignette ?? 0))
  // Frosted grain: feTurbulence -> white grain w/ noise-derived alpha.
  // Pure SVG-filter overlay, so unlike the refraction path it also works
  // on Safari/Firefox (no backdrop url() needed).
  const edgeBand = Math.round(6 + edgeBlur * 22)
  const edgeBlurPx = (edgeBlur * 26).toFixed(1)

  // Phase 7 interactive layer: base rim gradient is synced to a ref so
  // pointer handlers can restore it without a React re-render per frame.
  const rimBase = useMemo(
    () => rimGradient(rimAngle, highlight, 0, 0),
    [rimAngle, highlight]
  )
  const rimStyleRef = useRef(rimBase)
  useEffect(() => {
    rimStyleRef.current = rimBase
  }, [rimBase])

  const interactiveOn = interactive && !reducedMotion

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactiveOn || !rimRef.current) return
      const el = rimRef.current
      const rect = e.currentTarget.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      el.style.background = rimGradient(rimAngle, highlight, nx, ny)
    },
    [interactiveOn, rimAngle, highlight]
  )

  const handlePointerLeave = useCallback(() => {
    if (!rimRef.current) return
    rimRef.current.style.background = rimStyleRef.current
    if (glowRef.current) glowRef.current.style.opacity = '0'
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Kyant0 InteractiveHighlight: a glow blooms from the press point.
      if (!interactiveOn || !glowRef.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      const radius = Math.max(rect.width, rect.height) * 1.1
      const glow = glowRef.current
      glow.style.background = `radial-gradient(circle ${radius.toFixed(0)}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, transparent 72%)`
      glow.style.opacity = '1'
    },
    [interactiveOn]
  )

  const handlePointerUp = useCallback(() => {
    if (glowRef.current) glowRef.current.style.opacity = '0'
  }, [])

  return (
    <div
      ref={hostRef}
      className={`relative ${className ?? ''}`}
      style={style}
      onPointerMove={interactiveOn ? handlePointerMove : undefined}
      onPointerDown={interactiveOn ? handlePointerDown : undefined}
      onPointerUp={interactiveOn ? handlePointerUp : undefined}
      onPointerLeave={interactiveOn ? handlePointerLeave : undefined}
    >
      {/* Filter defs — must stay mounted for backdrop-filter url() refs */}
      <svg
        aria-hidden
        focusable="false"
        width={0}
        height={0}
        style={{ position: 'absolute', pointerEvents: 'none' }}
      >
        <defs>
          {frostEff > 0.01 && (
            <filter id={noiseId} x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.82"
                numOctaves={2}
                stitchTiles="stitch"
                result="turb"
              />
              {/* White grain whose alpha follows the noise luminance. */}
              <feColorMatrix
                in="turb"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.34 0.34 0.34 0 0"
              />
            </filter>
          )}
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {blurReady && (
              <feImage
                id={mapId}
                href={baked?.url}
                x={0}
                y={0}
                width={size.w}
                height={size.h}
                result="map"
                preserveAspectRatio="none"
              />
            )}

            {active && !useDispersion && (
              <>
                <feDisplacementMap
                  id={dispGId}
                  in="SourceGraphic"
                  in2="map"
                  scale={dispScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="disp"
                />
                <feGaussianBlur
                  id={blurId}
                  in="disp"
                  stdDeviation={config.blur}
                  result="soft"
                />
                <feColorMatrix
                  id={satId}
                  in="soft"
                  type="saturate"
                  values={`${config.saturation / 100}`}
                />
              </>
            )}

            {active && useDispersion && (
              <>
                {/* Spectral approximation of Kyant0's 7-tap dispersion:
                    R pulled towards +d, B towards -d, G centered. */}
                <feDisplacementMap
                  id={dispRId}
                  in="SourceGraphic"
                  in2="map"
                  scale={dispScale * (1 + k * 0.5)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="dispR"
                />
                <feColorMatrix
                  id={cRId}
                  in="dispR"
                  type="matrix"
                  values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1"
                  result="cR"
                />
                <feDisplacementMap
                  id={dispGId}
                  in="SourceGraphic"
                  in2="map"
                  scale={dispScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="dispG"
                />
                <feColorMatrix
                  id={cGId}
                  in="dispG"
                  type="matrix"
                  values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1"
                  result="cG"
                />
                <feDisplacementMap
                  id={dispBId}
                  in="SourceGraphic"
                  in2="map"
                  scale={dispScale * (1 - k * 0.5)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="dispB"
                />
                <feColorMatrix
                  id={cBId}
                  in="dispB"
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1"
                  result="cB"
                />
                <feBlend id={rgId} in="cR" in2="cG" mode="screen" result="rg" />
                <feBlend in="rg" in2="cB" mode="screen" result="disp" />
                <feGaussianBlur
                  in="disp"
                  stdDeviation={config.blur}
                  result="soft"
                />
                <feColorMatrix
                  in="soft"
                  type="saturate"
                  values={`${config.saturation / 100}`}
                />
              </>
            )}
          </filter>
        </defs>
      </svg>

      {/* Refracting backdrop */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          ...radiusStyle(),
          backdropFilter,
          WebkitBackdropFilter: `blur(${fallbackBlur}px) saturate(${config.saturation}%)`,
          willChange: 'backdrop-filter',
          // Outer glow via box-shadow (a host-level `filter` would turn the
          // host into a backdrop root and break the refraction sampling).
          boxShadow:
            config.glow && config.glow !== 'transparent'
              ? `0 0 24px 2px ${config.glow}`
              : undefined,
        }}
      />

      {/* Tint */}
      {tintOpacityEff > 0 && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            ...radiusStyle(),
            background: overLight
              ? `rgba(15, 18, 25, ${Math.max(0.35, tintOpacityEff)})`
              : tintRgba,
          }}
        />
      )}

      {/* Phase 5: vignette — radial corner darkening */}
      {vignette > 0.01 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...radiusStyle(),
            background: `radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,${(
              0.55 * vignette
            ).toFixed(3)}) 100%)`,
          }}
        />
      )}

      {/* Phase 5: progressive gaussian edge blur — a backdrop-blur ring
          masked to the outer band (layered blur, center stays crisp). */}
      {edgeBlur > 0.01 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...radiusStyle(),
            padding: edgeBand,
            backdropFilter: `blur(${edgeBlurPx}px)`,
            WebkitBackdropFilter: `blur(${edgeBlurPx}px)`,
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
          }}
        />
      )}

      {/* Phase 5: frosted grain overlay */}
      {frostEff > 0.01 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...radiusStyle(),
            filter: `url(#${noiseId})`,
            opacity: (frostEff * 0.5).toFixed(3),
          }}
        />
      )}

      {/* Phase 7: press glow — blooms from the pointer-down point (Kyant0
          InteractiveHighlight). Plain rgba overlay, no blend mode: a blended
          sibling would isolate the backdrop root and blank the refraction. */}
      {interactiveOn && (
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out"
          style={{
            ...radiusStyle(),
            opacity: 0,
          }}
        />
      )}

      {/* Fresnel rim highlight (gradient ring via mask composite) */}
      {highlight > 0.01 && (
        <div
          ref={rimRef}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...radiusStyle(),
            padding: ringPad,
            background: rimBase,
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            // NOTE: no mix-blend-mode here — a blended sibling would make the
            // host an isolated backdrop root and blank out the refraction.
          }}
        />
      )}

      {/* Inner soft shadow for depth (overLight mode) */}
      {overLight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...radiusStyle(),
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Content — normal flow so the host gains intrinsic height */}
      <div
        className="relative overflow-hidden"
        style={radiusStyle()}
      >
        {children}
      </div>
    </div>
  )
}

export const LiquidGlass = memo(LiquidGlassImpl)
