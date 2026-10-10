/**
 * Glass Lab style presets.
 * Every preset feeds the LiquidGlass component ported from
 * Kyant0/AndroidLiquidGlass (Apache-2.0).
 *
 * Phase 2: the library doubled to 24 curated styles, organized into four
 * categories (经典 / 材质 / 光影 / 创意), with a new `lightAngle` engine
 * parameter controlling the direction of the fresnel rim highlight.
 *
 * Phase 7: algorithm fusion with the wider liquid-glass ecosystem — a new
 * `lensing` engine parameter (shuding/liquid-glass convex-lens field +
 * Kyant0 backdrop `lens()`) and a fifth category 动态 with Apple iOS 26
 * Regular/Clear replicas, shuding's demo capsule and rdev jelly styles.
 */

export interface GlassConfig {
  /** Rim refraction strength — max displacement in px (Kyant0: refractionAmount) */
  refraction: number
  /** Refracting rim thickness in px (Kyant0: refractionHeight) */
  height: number
  /** Spectral dispersion / chromatic aberration, 0..1 */
  dispersion: number
  /** Extra gaussian blur of the backdrop in px */
  blur: number
  /** Backdrop saturation, % */
  saturation: number
  /** Corner radius in px; use 999 for a pill shape */
  cornerRadius: number
  /** Radial depth pull (Kyant0: depthEffect) */
  depthEffect: boolean
  /** Fresnel rim highlight intensity, 0..1 */
  highlight: number
  /** Fresnel rim highlight direction, degrees (0 = to top, clockwise) */
  lightAngle: number
  /** Tint color applied over the glass */
  tint: string
  /** Tint opacity, 0..1 */
  tintOpacity: number
  /** Dark glass mode for bright backgrounds */
  overLight: boolean
  /** Drag elasticity of the demo card, 0..1 */
  elasticity: number
  /** Optional colored glow outside the glass */
  glow: string
  /** Phase 5: frosted grain overlay (SVG feTurbulence noise), 0..1 */
  frost: number
  /** Phase 5: progressive gaussian blur ring at the glass edges, 0..1 */
  edgeBlur: number
  /** Phase 5: radial corner darkening (vignette), 0..1 */
  vignette: number
  /** Phase 7: convex-lens magnification field, 0..1 (shuding lens /
   *  Kyant0 backdrop `lens()`) — pulls backdrop samples towards the center
   *  deep inside the glass, fading to zero at the optical center. */
  lensing: number
}

export type GlassCategory = '经典' | '材质' | '光影' | '创意' | '动态'

export const CATEGORIES: readonly GlassCategory[] = [
  '经典',
  '材质',
  '光影',
  '创意',
  '动态',
]

export interface GlassPreset {
  id: string
  name: string
  /** Small hint shown under the name */
  desc: string
  /** css gradient used for the preset thumbnail */
  swatch: string
  category: GlassCategory
  config: GlassConfig
}

export const DEFAULT_CONFIG: GlassConfig = {
  refraction: 28,
  height: 42,
  dispersion: 0.35,
  blur: 2,
  saturation: 120,
  cornerRadius: 26,
  depthEffect: false,
  highlight: 0.85,
  lightAngle: 45,
  tint: '#ffffff',
  tintOpacity: 0.08,
  overLight: false,
  elasticity: 0.55,
  glow: 'transparent',
  frost: 0,
  edgeBlur: 0,
  vignette: 0,
  lensing: 0,
}

export const PRESETS: GlassPreset[] = [
  // ------------------------------ 经典 ------------------------------
  {
    id: 'ios-clear',
    name: 'iOS 经典',
    desc: 'Apple 官方透明液态玻璃',
    swatch: 'linear-gradient(135deg,#7dd3fc,#c4b5fd,#fda4af)',
    category: '经典',
    config: { ...DEFAULT_CONFIG },
  },
  {
    id: 'pill-dock',
    name: '灵动胶囊',
    desc: 'Dynamic Island 药丸形',
    swatch: 'linear-gradient(90deg,#111,#333,#111)',
    category: '经典',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 34,
      height: 46,
      dispersion: 0.3,
      blur: 2,
      saturation: 130,
      cornerRadius: 999,
      tint: '#000000',
      tintOpacity: 0.2,
      highlight: 0.95,
      glow: 'rgba(255,255,255,0.12)',
    },
  },
  {
    id: 'thin-lens',
    name: '超薄玻璃',
    desc: '轻薄贴合，边缘微折射',
    swatch: 'linear-gradient(135deg,#f8fafc,#e2e8f0,#f1f5f9)',
    category: '经典',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 16,
      height: 20,
      dispersion: 0.25,
      blur: 1,
      saturation: 115,
      cornerRadius: 18,
      highlight: 0.8,
      tintOpacity: 0.05,
      lightAngle: 60,
    },
  },
  {
    id: 'vision-panel',
    name: 'visionOS 面板',
    desc: '空间系统深色面板',
    swatch: 'linear-gradient(135deg,#1e293b,#0f172a,#334155)',
    category: '经典',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 24,
      height: 40,
      dispersion: 0.3,
      blur: 12,
      saturation: 140,
      cornerRadius: 28,
      tint: '#0f172a',
      tintOpacity: 0.28,
      highlight: 0.7,
      lightAngle: 135,
    },
  },

  // ------------------------------ 材质 ------------------------------
  {
    id: 'frosted',
    name: '磨砂玻璃',
    desc: '重雾面，隐私友好',
    swatch: 'linear-gradient(135deg,#e2e8f0,#cbd5e1,#94a3b8)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 10,
      height: 26,
      dispersion: 0.1,
      blur: 14,
      saturation: 140,
      cornerRadius: 30,
      tintOpacity: 0.16,
      highlight: 0.6,
    },
  },
  {
    id: 'ice',
    name: '冰川玻璃',
    desc: '清透冰蓝，冷静纯净',
    swatch: 'linear-gradient(135deg,#bae6fd,#e0f2fe,#f8fafc)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 14,
      height: 30,
      dispersion: 0.2,
      blur: 18,
      saturation: 70,
      cornerRadius: 32,
      tint: '#bae6fd',
      tintOpacity: 0.2,
      highlight: 0.75,
    },
  },
  {
    id: 'smoked',
    name: '烟熏玻璃',
    desc: '深色低调商务风',
    swatch: 'linear-gradient(135deg,#334155,#1e293b,#0f172a)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 20,
      height: 32,
      dispersion: 0.15,
      blur: 8,
      saturation: 90,
      cornerRadius: 24,
      tint: '#0f172a',
      tintOpacity: 0.42,
      highlight: 0.5,
    },
  },
  {
    id: 'obsidian',
    name: '黑曜石',
    desc: '深邃黑曜，锋利高光',
    swatch: 'linear-gradient(135deg,#0c0a09,#1c1917,#292524)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 24,
      height: 36,
      dispersion: 0.22,
      blur: 5,
      saturation: 80,
      cornerRadius: 18,
      tint: '#0c0a09',
      tintOpacity: 0.58,
      highlight: 1,
      glow: 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'jade',
    name: '玉石玻璃',
    desc: '温润玉色，东方质感',
    swatch: 'linear-gradient(135deg,#6ee7b7,#10b981,#047857)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 22,
      height: 38,
      dispersion: 0.2,
      blur: 10,
      saturation: 130,
      cornerRadius: 26,
      tint: '#10b981',
      tintOpacity: 0.3,
      highlight: 0.7,
      lightAngle: 90,
    },
  },
  {
    id: 'velvet',
    name: '丝绒雾面',
    desc: '深紫丝绒，柔雾哑光',
    swatch: 'linear-gradient(135deg,#7c3aed,#4c1d95,#2e1065)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 12,
      height: 26,
      dispersion: 0.1,
      blur: 20,
      saturation: 90,
      cornerRadius: 30,
      tint: '#4c1d95',
      tintOpacity: 0.4,
      highlight: 0.4,
      lightAngle: 200,
    },
  },
  {
    id: 'mocha',
    name: '摩卡奶油',
    desc: '咖啡奶泡，暖棕柔和',
    swatch: 'linear-gradient(135deg,#d6bfa2,#92400e,#5c3317)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 14,
      height: 30,
      dispersion: 0.15,
      blur: 16,
      saturation: 110,
      cornerRadius: 32,
      tint: '#92400e',
      tintOpacity: 0.26,
      highlight: 0.6,
    },
  },
  {
    id: 'etched',
    name: '磨砂蚀刻',
    desc: '噪点磨砂，颗粒质感',
    swatch: 'linear-gradient(135deg,#e7e5e4,#d6d3d1,#a8a29e)',
    category: '材质',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 12,
      height: 28,
      dispersion: 0.08,
      blur: 16,
      saturation: 105,
      cornerRadius: 30,
      tintOpacity: 0.18,
      highlight: 0.55,
      frost: 0.55,
      vignette: 0.25,
    },
  },

  // ------------------------------ 光影 ------------------------------
  {
    id: 'crystal',
    name: '水晶棱镜',
    desc: '强色散，彩虹边缘',
    swatch: 'linear-gradient(135deg,#f0abfc,#a5f3fc,#fde68a)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 42,
      height: 62,
      dispersion: 0.85,
      blur: 0,
      saturation: 165,
      cornerRadius: 20,
      highlight: 1,
    },
  },
  {
    id: 'prism',
    name: '光学棱镜',
    desc: '极限折射 + 深度形变',
    swatch: 'conic-gradient(#f87171,#fbbf24,#4ade80,#22d3ee,#a78bfa,#f87171)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 55,
      height: 72,
      dispersion: 1,
      blur: 0,
      saturation: 200,
      cornerRadius: 16,
      depthEffect: true,
      highlight: 1,
    },
  },
  {
    id: 'aurora',
    name: '极光玻璃',
    desc: '青绿色冷调极光',
    swatch: 'linear-gradient(135deg,#5eead4,#34d399,#a7f3d0)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 30,
      height: 46,
      dispersion: 0.5,
      blur: 6,
      saturation: 150,
      cornerRadius: 26,
      tint: '#34d399',
      tintOpacity: 0.14,
    },
  },
  {
    id: 'amber',
    name: '琥珀玻璃',
    desc: '暖调琥珀，复古质感',
    swatch: 'linear-gradient(135deg,#fbbf24,#f59e0b,#b45309)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 26,
      height: 40,
      dispersion: 0.4,
      blur: 3,
      saturation: 140,
      cornerRadius: 22,
      tint: '#f59e0b',
      tintOpacity: 0.18,
      highlight: 0.9,
    },
  },
  {
    id: 'sunset-glow',
    name: '落日辉光',
    desc: '橙金落日，暖光溢出',
    swatch: 'linear-gradient(135deg,#fdba74,#f97316,#c2410c)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 30,
      height: 48,
      dispersion: 0.55,
      blur: 2,
      saturation: 150,
      cornerRadius: 24,
      tint: '#f97316',
      tintOpacity: 0.16,
      highlight: 1,
      glow: 'rgba(249,115,22,0.35)',
      lightAngle: 315,
    },
  },
  {
    id: 'hologram',
    name: '全息幻彩',
    desc: '极光幻彩，强色散',
    swatch: 'conic-gradient(from 90deg,#c084fc,#22d3ee,#4ade80,#fde047,#c084fc)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 48,
      height: 66,
      dispersion: 1,
      blur: 0,
      saturation: 200,
      cornerRadius: 20,
      highlight: 1,
      glow: 'rgba(167,139,250,0.3)',
      lightAngle: 270,
    },
  },
  {
    id: 'lens-depth',
    name: '景深透镜',
    desc: '边缘高斯弥散，中心清晰',
    swatch: 'radial-gradient(circle at 50% 50%,#f8fafc 30%,#94a3b8 70%,#475569)',
    category: '光影',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 34,
      height: 50,
      dispersion: 0.5,
      blur: 2,
      saturation: 145,
      cornerRadius: 24,
      highlight: 0.9,
      edgeBlur: 0.65,
      vignette: 0.2,
    },
  },

  // ------------------------------ 创意 ------------------------------
  {
    id: 'neon',
    name: '霓虹辉光',
    desc: '赛博朋克霓虹边框',
    swatch: 'linear-gradient(135deg,#f0f,#f0f,#0ff)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 32,
      height: 50,
      dispersion: 0.7,
      blur: 4,
      saturation: 180,
      cornerRadius: 28,
      tint: '#e879f9',
      tintOpacity: 0.12,
      highlight: 1,
      glow: 'rgba(232,121,249,0.35)',
    },
  },
  {
    id: 'cloud',
    name: '云雾玻璃',
    desc: '奶白云雾，柔和轻盈',
    swatch: 'linear-gradient(135deg,#fdf2f8,#fce7f3,#fbcfe8)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 10,
      height: 24,
      dispersion: 0.12,
      blur: 22,
      saturation: 110,
      cornerRadius: 30,
      tint: '#fdf2f8',
      tintOpacity: 0.3,
      highlight: 0.65,
    },
  },
  {
    id: 'dewdrop',
    name: '水滴透镜',
    desc: '胶囊水珠，极限折射',
    swatch: 'radial-gradient(circle at 30% 30%,#e0f2fe,#7dd3fc,#0369a1)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 60,
      height: 80,
      dispersion: 0.9,
      blur: 0,
      saturation: 160,
      cornerRadius: 999,
      highlight: 1,
    },
  },
  {
    id: 'polarized',
    name: '偏振墨镜',
    desc: '深色偏振，冷静克制',
    swatch: 'linear-gradient(135deg,#1c1917,#292524,#0c0a09)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 40,
      height: 60,
      dispersion: 0.35,
      blur: 4,
      saturation: 60,
      cornerRadius: 20,
      tint: '#000000',
      tintOpacity: 0.5,
      highlight: 0.3,
      lightAngle: 180,
    },
  },
  {
    id: 'cola',
    name: '可乐气泡',
    desc: '焦糖气泡，复古汽水',
    swatch: 'linear-gradient(135deg,#78350f,#b45309,#f59e0b)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 26,
      height: 42,
      dispersion: 0.45,
      blur: 3,
      saturation: 145,
      cornerRadius: 26,
      tint: '#78350f',
      tintOpacity: 0.24,
      highlight: 0.9,
      glow: 'rgba(245,158,11,0.25)',
      lightAngle: 135,
    },
  },
  {
    id: 'bubblegum',
    name: '泡泡糖',
    desc: '粉嫩甜心，软萌高光',
    swatch: 'linear-gradient(135deg,#fbcfe8,#f9a8d4,#ec4899)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 18,
      height: 34,
      dispersion: 0.3,
      blur: 8,
      saturation: 130,
      cornerRadius: 34,
      tint: '#f9a8d4',
      tintOpacity: 0.3,
      highlight: 0.85,
      lightAngle: 315,
    },
  },
  {
    id: 'toxic',
    name: '荧光辐射',
    desc: '酸性荧光，警示吸睛',
    swatch: 'linear-gradient(135deg,#bef264,#a3e635,#4d7c0f)',
    category: '创意',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 36,
      height: 54,
      dispersion: 0.75,
      blur: 1,
      saturation: 190,
      cornerRadius: 22,
      tint: '#a3e635',
      tintOpacity: 0.2,
      highlight: 1,
      glow: 'rgba(163,230,53,0.35)',
      lightAngle: 90,
    },
  },

  // ------------------------------ 动态（Phase 7 生态融合） ------------------------------
  {
    id: 'apple-regular',
    name: 'Apple 26 正装',
    desc: 'iOS 26 Regular 材质复刻',
    swatch: 'linear-gradient(135deg,#f8fafc,#cbd5e1,#f1f5f9)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 30,
      height: 44,
      dispersion: 0.3,
      blur: 3,
      saturation: 130,
      cornerRadius: 26,
      highlight: 0.9,
      tintOpacity: 0.1,
      lensing: 0.15,
    },
  },
  {
    id: 'apple-clear',
    name: 'Apple Clear',
    desc: 'iOS 26 透明材质，需富媒体背景',
    swatch: 'linear-gradient(135deg,#f1f5f9,#e2e8f0,#94a3b8)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 36,
      height: 50,
      dispersion: 0.35,
      blur: 1.5,
      saturation: 125,
      cornerRadius: 22,
      tintOpacity: 0.03,
      highlight: 0.95,
      lensing: 0.22,
    },
  },
  {
    id: 'lens-shuding',
    name: 'shuding 透镜',
    desc: 'shuding/liquid-glass 胶囊凸透镜',
    swatch: 'radial-gradient(circle at 50% 40%,#fef9c3,#fde047,#65a30d)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 22,
      height: 30,
      dispersion: 0.15,
      blur: 0.5,
      saturation: 115,
      cornerRadius: 999,
      highlight: 0.8,
      lensing: 0.85,
    },
  },
  {
    id: 'jelly',
    name: '果冻胶囊',
    desc: 'rdev 弹性果冻质感',
    swatch: 'linear-gradient(135deg,#fda4af,#f472b6,#c084fc)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 35,
      height: 42,
      dispersion: 0.2,
      blur: 6,
      saturation: 140,
      cornerRadius: 999,
      tintOpacity: 0.06,
      highlight: 0.95,
      lensing: 0.3,
      glow: 'rgba(255,255,255,0.1)',
    },
  },
  {
    id: 'depth-well',
    name: '凹陷纵深',
    desc: 'Kyant0 backdrop 深度透镜',
    swatch: 'radial-gradient(circle at 50% 50%,#0f172a 20%,#334155 60%,#94a3b8)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 34,
      height: 56,
      dispersion: 0.4,
      blur: 2,
      saturation: 135,
      cornerRadius: 24,
      depthEffect: true,
      tint: '#0f172a',
      tintOpacity: 0.12,
      highlight: 0.85,
      lensing: 0.5,
    },
  },
  {
    id: 'specular-flow',
    name: '流光棱面',
    desc: 'rdev 流光边框 + 折射',
    swatch: 'conic-gradient(from 0deg,#f0abfc,#fde68a,#5eead4,#f0abfc)',
    category: '动态',
    config: {
      ...DEFAULT_CONFIG,
      refraction: 30,
      height: 46,
      dispersion: 0.6,
      blur: 1,
      saturation: 155,
      cornerRadius: 20,
      highlight: 1,
      lightAngle: 315,
      lensing: 0.35,
      glow: 'rgba(240,171,252,0.28)',
    },
  },
]
