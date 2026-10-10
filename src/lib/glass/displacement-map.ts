/*
 * Displacement map generator — TypeScript port of Kyant0/AndroidLiquidGlass.
 *
 * Source: https://github.com/Kyant0/AndroidLiquidGlass (kmp branch + backdrop master)
 * Files:  backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt
 * License: Apache-2.0, Copyright 2025 Kyant
 *
 * The original AGSL shader computes, for every pixel of a rounded rect:
 *   sd      = signed distance to the rounded-rect boundary (negative inside)
 *   d       = circleMap(1 - (-sd / refractionHeight)) * refractionAmount
 *   grad    = normalize(gradSdRoundedRect(...) + depthEffect * normalize(centeredCoord))
 *   refract = coord + d * grad
 *
 * For the web we bake the vector field `d * grad` into an 8-bit RG
 * displacement map consumed by SVG feDisplacementMap, so the exact same
 * optical profile runs in the browser.
 *
 * Phase 7 — algorithm fusion with the wider liquid-glass ecosystem:
 *
 * 1. DYNAMIC NORMALIZATION (learned from shuding/liquid-glass, MIT):
 *    instead of normalizing the field by `refractionAmount` alone, the map is
 *    normalized by the actual per-axis maximum magnitude found while baking
 *    (shuding scans the whole field for `maxScale` before encoding). The
 *    8-bit RG channels therefore always span the full 0..255 range, which
 *    keeps precision constant across extreme parameter combinations (deep
 *    lensing + strong rim refraction previously quantized into visible
 *    banding). The matching feDisplacementMap `scale` is returned alongside.
 *
 * 2. LENS FIELD (learned from shuding/liquid-glass `fragment` + Kyant0
 *    backdrop `lens()`): a center-pulling magnification vector field
 *    `-(pos/half) * smoothstep(falloff)` that is active deep inside the glass
 *    and fades to zero at the geometric center, blending additively with the
 *    rim refraction field. This reproduces the "convex lens" magnification of
 *    Apple's Liquid Glass and shuding's demo capsule, on top of Kyant0's
 *    edge-only refraction.
 */

export interface DisplacementMapOptions {
  /** Glass element width in CSS px */
  width: number
  /** Glass element height in CSS px */
  height: number
  /** Corner radius in px (may exceed half of the min side; clamped) */
  cornerRadius: number
  /** Thickness of the refracting rim band, in px (Kyant0: refractionHeight) */
  refractionHeight: number
  /** Maximum displacement magnitude at the rim, in px (Kyant0: refractionAmount) */
  refractionAmount: number
  /** Add radial "depth" pull towards the center (Kyant0: depthEffect) */
  depthEffect: boolean
  /** Convex-lens magnification field strength, 0..1 (shuding lens / backdrop lens) */
  lensing?: number
  /** Render scale for extra crispness (1 = CSS px resolution) */
  scale?: number
}

export interface BakedDisplacementMap {
  /** PNG data URL of the normalized RG displacement map */
  url: string
  /**
   * feDisplacementMap `scale` (in CSS px) that decodes the normalized map:
   * offset = scale * (channel - 0.5), max |offset| == maxDisplacementCss.
   */
  maxScale: number
}

/** Kyant0 SDF: distance to a rounded rect, negative inside. */
export function sdRoundedRect(
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  radius: number
): number {
  const qx = Math.abs(cx) - (hx - radius)
  const qy = Math.abs(cy) - (hy - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside
}

/** Kyant0 analytic SDF gradient (points outwards, unit length). */
export function gradSdRoundedRect(
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  radius: number
): [number, number] {
  const qx = Math.abs(cx) - (hx - radius)
  const qy = Math.abs(cy) - (hy - radius)
  let gx: number
  let gy: number
  if (qx >= 0 || qy >= 0) {
    const mx = Math.max(qx, 0)
    const my = Math.max(qy, 0)
    const len = Math.hypot(mx, my) || 1
    gx = mx / len
    gy = my / len
  } else {
    // GLSL: gradX = step(cornerCoord.y, cornerCoord.x)
    gx = qx >= qy ? 1 : 0
    gy = 1 - gx
  }
  return [Math.sign(cx) * gx, Math.sign(cy) * gy]
}

/** Kyant0 circleMap: 1 - sqrt(1 - x*x). */
function circleMap(x: number): number {
  return 1 - Math.sqrt(Math.max(0, 1 - x * x))
}

/** GLSL smoothstep: 0 at edge0, 1 at edge1, cubic ease between. */
function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)))
  return t * t * (3 - 2 * t)
}

/**
 * Renders the displacement vector field into a PNG data URL, normalized to
 * the full 8-bit range (shuding dynamic normalization).
 *
 * Encoding: byte = (displacement / maxAbs) * 0.5 + 0.5, per axis, so an
 * feDisplacementMap with scale = maxScale decodes to the original CSS-px
 * field. R channel -> x displacement, G channel -> y displacement.
 */
export function renderDisplacementMap(
  opts: DisplacementMapOptions
): BakedDisplacementMap | null {
  const {
    width,
    height,
    cornerRadius,
    refractionHeight,
    refractionAmount,
    depthEffect,
    lensing = 0,
    scale = 1,
  } = opts

  const w = Math.max(2, Math.round(width * scale))
  const h = Math.max(2, Math.round(height * scale))
  const halfW = w / 2
  const halfH = h / 2
  const radius = Math.max(
    0,
    Math.min(cornerRadius * scale, Math.min(halfW, halfH))
  )
  const band = Math.max(0.0001, refractionHeight * scale)
  const amount = Math.max(0.0001, refractionAmount * scale)
  const depth = depthEffect ? 1 : 0

  // Lens field: shuding keeps the pull alive far into the interior (his demo
  // band reaches ~80% of the canvas). We span 62% of the min half-dimension
  // and fade quadratically-smooth towards the center so the middle of the
  // glass stays optically clean (Apple: "center clear, edges refract").
  const lensK = Math.max(0, Math.min(1, lensing))
  const lensAmp = lensK * 0.24 * Math.min(halfW, halfH)
  const lensBand = Math.max(band, Math.min(halfW, halfH) * 0.62)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const img = ctx.createImageData(w, h)
  const data = img.data

  // Pass 1: evaluate the vector field once into float buffers while tracking
  // the true per-axis maximum (shuding dynamic normalization scan).
  const fieldX = new Float32Array(w * h)
  const fieldY = new Float32Array(w * h)
  let maxAbs = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sample at pixel center.
      const cx = x + 0.5 - halfW
      const cy = y + 0.5 - halfH

      let dx = 0
      let dy = 0
      const sd = sdRoundedRect(cx, cy, halfW, halfH, radius)
      if (-sd < band) {
        const sdClamped = Math.min(sd, 0)
        // Kyant0 passes refractionAmount as a negative uniform, so d <= 0:
        // the content is sampled towards the interior of the lens.
        const d = circleMap(1 - -sdClamped / band) * -amount
        const gradRadius = Math.min(radius * 1.5, Math.min(halfW, halfH))
        let [gx, gy] = gradSdRoundedRect(cx, cy, halfW, halfH, gradRadius)
        if (depth) {
          const len = Math.hypot(cx, cy) || 1
          const nx = gx + depth * (cx / len)
          const ny = gy + depth * (cy / len)
          const nl = Math.hypot(nx, ny) || 1
          gx = nx / nl
          gy = ny / nl
        }
        dx = d * gx
        dy = d * gy
      }

      // shuding lens: sample coordinates pulled towards the center across the
      // whole interior with a smoothstep falloff — convex magnification.
      if (lensAmp > 0) {
        const sdx = cx / halfW
        const sdy = cy / halfH
        const fall = smoothStep(0, 1, Math.max(0, 1 - -sd / lensBand))
        dx += -sdx * lensAmp * fall
        dy += -sdy * lensAmp * fall
      }

      const p = y * w + x
      fieldX[p] = dx
      fieldY[p] = dy

      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax > maxAbs) maxAbs = ax
      if (ay > maxAbs) maxAbs = ay
    }
  }

  // Pass 2: encode with the true per-field maximum so the 8-bit channels
  // always span the full dynamic range (constant precision regardless of how
  // rim refraction and lens magnification combine).
  const denom = Math.max(0.0001, maxAbs)
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    data[i] = clampByte((fieldX[p] / denom) * 127.5 + 127.5)
    data[i + 1] = clampByte((fieldY[p] / denom) * 127.5 + 127.5)
    data[i + 2] = 128
    data[i + 3] = 255
  }

  ctx.putImageData(img, 0, 0)

  // Decode contract: offset_css = maxScale * (channel - 0.5). The map stores
  // displacement/maxAbs at canvas resolution, so maxScale must convert canvas
  // px back to CSS px: 2 * maxAbs / renderScale.
  return {
    url: canvas.toDataURL('image/png'),
    maxScale: (2 * denom) / scale,
  }
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}
