// ============================================================================
//  慢病（五高 + 同型半胱氨酸）领域模型
//  ---------------------------------------------------------------------------
//  六指标族：血压 / 血糖 / 血脂 / 尿酸 / 体重BMI / 同型半胱氨酸。
//  阈值来自产品功能清单「数据字典」参考值（标注"待医院确认"，此处为默认演示值，
//  非医疗诊断，仅作健康管理提示）。三档状态：达标(normal) / 关注(off) / 异常(critical)。
//  医生端「五高异常预警」与学员端「健康看台」共用本文件判定口径。
// ============================================================================

/** 六指标族 key（慢性看台卡片维度） */
export type ChronicGroupKey = 'bp' | 'glucose' | 'lipid' | 'uric' | 'bmi' | 'hcy';

/** 具体测量字段 key */
export type ChronicFieldKey =
  | 'systolic' | 'diastolic'
  | 'glucoseFasting' | 'glucosePostprandial' | 'glucoseHba1c'
  | 'ldl' | 'tg' | 'tc' | 'hdl'
  | 'uricAcid'
  | 'weight' | 'height' | 'bmi'
  | 'homocysteine';

/** 状态档：达标 / 关注 / 异常 */
export type AlarmLevel = 'normal' | 'off' | 'critical';

/** 达标率结果 */
export interface GroupRate {
  group: ChronicGroupKey;
  label: string;
  total: number;      // 参与统计的字段测量次数（有值的字段计数）
  normal: number;     // 达标次数
  rate: number;       // 0~100 达标率
}

/** 单次记录中某一字段的判定结果 */
export interface FieldJudge {
  key: ChronicFieldKey;
  label: string;
  unit: string;
  value: number;
  level: AlarmLevel;
}

/** 单一记录整体的判定（聚合其所有有值字段，取最差档） */
export interface RecordJudge {
  level: AlarmLevel;
  fields: FieldJudge[];
  /** 异常/关注字段数 */
  abnormalCount: number;
}

/** 指标字段元数据 */
export interface ChronicFieldDef {
  key: ChronicFieldKey;
  label: string;
  unit: string;
  range: string;      // 参考区间展示文案
  group: ChronicGroupKey;
  order: number;
  display: boolean;   // false=辅助字段（如身高/体重仅用于计算BMI），不参与状态判定
  higherIsWorse: boolean;
}

export const CHRONIC_FIELDS: ChronicFieldDef[] = [
  { key: 'systolic', group: 'bp', label: '收缩压(高压)', unit: 'mmHg', range: '理想 <140', order: 1, display: true, higherIsWorse: true },
  { key: 'diastolic', group: 'bp', label: '舒张压(低压)', unit: 'mmHg', range: '理想 <90', order: 2, display: true, higherIsWorse: true },
  { key: 'glucoseFasting', group: 'glucose', label: '空腹血糖', unit: 'mmol/L', range: '3.9 ～ 6.1', order: 1, display: true, higherIsWorse: true },
  { key: 'glucosePostprandial', group: 'glucose', label: '餐后2小时血糖', unit: 'mmol/L', range: '理想 <7.8', order: 2, display: true, higherIsWorse: true },
  { key: 'glucoseHba1c', group: 'glucose', label: '糖化血红蛋白', unit: '%', range: '理想 <7', order: 3, display: true, higherIsWorse: true },
  { key: 'ldl', group: 'lipid', label: '低密度脂蛋白(LDL-C)', unit: 'mmol/L', range: '核心管理 <2.6', order: 1, display: true, higherIsWorse: true },
  { key: 'tg', group: 'lipid', label: '甘油三酯', unit: 'mmol/L', range: '理想 <1.7', order: 2, display: true, higherIsWorse: true },
  { key: 'tc', group: 'lipid', label: '总胆固醇', unit: 'mmol/L', range: '理想 <5.2', order: 3, display: true, higherIsWorse: true },
  { key: 'hdl', group: 'lipid', label: '高密度脂蛋白(HDL-C)', unit: 'mmol/L', range: '≥1.0', order: 4, display: true, higherIsWorse: false },
  { key: 'uricAcid', group: 'uric', label: '尿酸', unit: 'μmol/L', range: '男<420 / 女<360', order: 1, display: true, higherIsWorse: true },
  { key: 'bmi', group: 'bmi', label: 'BMI指数', unit: '', range: '18.5 ～ 23.9', order: 1, display: true, higherIsWorse: true },
  { key: 'weight', group: 'bmi', label: '体重', unit: 'kg', range: '参考', order: 2, display: false, higherIsWorse: true },
  { key: 'height', group: 'bmi', label: '身高', unit: 'cm', range: '参考', order: 3, display: false, higherIsWorse: false },
  { key: 'homocysteine', group: 'hcy', label: '同型半胱氨酸', unit: 'μmol/L', range: '理想 <15', order: 1, display: true, higherIsWorse: true },
];

export const CHRONIC_GROUPS: { key: ChronicGroupKey; title: string; desc: string }[] = [
  { key: 'bp', title: '血压', desc: '高血压防控 · 理想 <140/90' },
  { key: 'glucose', title: '血糖', desc: '糖尿病防控 · 空腹/餐后/糖化' },
  { key: 'lipid', title: '血脂', desc: '血脂管理 · 重点看 LDL-C' },
  { key: 'uric', title: '尿酸', desc: '高尿酸/痛风风险' },
  { key: 'bmi', title: '体重BMI', desc: '超重与肥胖管理' },
  { key: 'hcy', title: '同型半胱氨酸', desc: '心脑血管风险' },
];

export function groupFields(g: ChronicGroupKey): ChronicFieldDef[] {
  return CHRONIC_FIELDS.filter((f) => f.group === g).sort((a, b) => a.order - b.order);
}

export function fieldDef(key: ChronicFieldKey): ChronicFieldDef {
  return CHRONIC_FIELDS.find((f) => f.key === key)!;
}

/** 状态档配色（Tailwind 类 + 文案） */
export const LEVEL_META: Record<AlarmLevel, { label: string; text: string; bg: string; bar: string }> = {
  normal: { label: '达标', text: 'text-[#10B981]', bg: 'bg-[#10B981]/10', bar: '#10B981' },
  off: { label: '关注', text: 'text-[#A5772D]', bg: 'bg-[#A5772D]/12', bar: '#A5772D' },
  critical: { label: '异常', text: 'text-[#B6523E]', bg: 'bg-[#B6523E]/12', bar: '#B6523E' },
};

/** 单字段档位判定（gender 用于尿酸分性参考） */
export function levelOf(key: ChronicFieldKey, value: number, gender?: string): AlarmLevel {
  switch (key) {
    case 'systolic':
      if (value >= 160) return 'critical';
      if (value >= 140) return 'off';
      return 'normal';
    case 'diastolic':
      if (value >= 100) return 'critical';
      if (value >= 90) return 'off';
      return 'normal';
    case 'glucoseFasting':
      if (value > 7.0) return 'critical';
      if (value < 3.9 || value > 6.1) return 'off';
      return 'normal';
    case 'glucosePostprandial':
      if (value > 11.1) return 'critical';
      if (value > 7.8) return 'off';
      return 'normal';
    case 'glucoseHba1c':
      if (value >= 8) return 'critical';
      if (value >= 7) return 'off';
      return 'normal';
    case 'ldl':
      if (value > 4.1) return 'critical';
      if (value > 2.6) return 'off';
      return 'normal';
    case 'tg':
      if (value > 5.6) return 'critical';
      if (value > 1.7) return 'off';
      return 'normal';
    case 'tc':
      if (value > 6.2) return 'critical';
      if (value > 5.2) return 'off';
      return 'normal';
    case 'hdl':
      if (value < 0.8) return 'critical';
      if (value < 1.0) return 'off';
      return 'normal';
    case 'uricAcid': {
      const cut = gender === 'female' ? 360 : 420;
      if (value >= cut + 60) return 'critical';
      if (value > cut) return 'off';
      return 'normal';
    }
    case 'bmi':
      if (value >= 28) return 'critical';
      if (value < 18.5 || value >= 24) return 'off';
      return 'normal';
    case 'homocysteine':
      if (value > 30) return 'critical';
      if (value > 15) return 'off';
      return 'normal';
    default:
      return 'normal';
  }
}

/** 判定单条记录：聚合其所有有值显示字段，取最差档 */
export function judgeRecord(values: Partial<Record<ChronicFieldKey, number | undefined>>, gender?: string): RecordJudge {
  const list: FieldJudge[] = [];
  let level: AlarmLevel = 'normal';
  for (const f of CHRONIC_FIELDS) {
    if (!f.display) continue;
    const v = values[f.key];
    if (v == null || Number.isNaN(v)) continue;
    const lv = levelOf(f.key, v, gender);
    const rank = (x: AlarmLevel) => (x === 'normal' ? 0 : x === 'off' ? 1 : 2);
    if (rank(lv) > rank(level)) level = lv;
    list.push({ key: f.key, label: f.label, unit: f.unit, value: v, level: lv });
  }
  return { level, fields: list, abnormalCount: list.filter((x) => x.level !== 'normal').length };
}

/** 取某次的显示字段值对象 */
export function pickDisplay(values: Partial<Record<ChronicFieldKey, number | undefined>>): FieldJudge[] {
  return judgeRecord(values).fields;
}

/** 指标族内判定（只看该族显示字段，取最差档） */
export function judgeGroup(values: Partial<Record<ChronicFieldKey, number | undefined>>, g: ChronicGroupKey, gender?: string): { level: AlarmLevel; fields: FieldJudge[] } {
  const j = judgeRecord(values, gender);
  const fields = j.fields.filter((f) => fieldDef(f.key).group === g);
  const rank = (x: AlarmLevel) => (x === 'normal' ? 0 : x === 'off' ? 1 : 2);
  let level: AlarmLevel = 'normal';
  for (const f of fields) if (rank(f.level) > rank(level)) level = f.level;
  return { level, fields };
}

/** 某学员的指标族达标率（normal 计数 / 有值字段总数 × 100，0 记录返回 null） */
export function groupRate(records: { values: Partial<Record<ChronicFieldKey, number | undefined>> }[], g: ChronicGroupKey, gender?: string): GroupRate {
  let total = 0;
  let normal = 0;
  for (const r of records) {
    const { fields } = judgeGroup(r.values, g, gender);
    for (const f of fields) { total++; if (f.level === 'normal') normal++; }
  }
  return { group: g, label: CHRONIC_GROUPS.find((x) => x.key === g)!.title, total, normal, rate: total === 0 ? 0 : Math.round((normal / total) * 100) };
}

/** BMI 计算（weight kg, height cm）；不合法返回 null */
export function calcBmi(weight?: number, height?: number): number | null {
  if (!weight || !height || weight <= 0 || height <= 0) return null;
  const m = height / 100;
  return Math.round((weight / (m * m)) * 10) / 10;
}

// ============================================================================
//  趋势图几何（学员端健康指标详情 + 营养师端学员档案共用，保证展示一致）
// ============================================================================

/** 六指标族强调色 */
export const CHRONIC_ACCENT: Record<ChronicGroupKey, string> = {
  bp: '#0B6BCB', glucose: '#10B981', lipid: '#FF976A', uric: '#8B5CF6', bmi: '#12B5C2', hcy: '#A5772D',
};

/** 参考区间文案 → 数值边界（兼容「<x」「a ～ b」「≥x」「男<420 / 女<360」） */
export function parseRef(range: string, gender?: string): { lo?: number; hi?: number } {
  let r = range.replace(/[理想核心管理参考\s]/g, '');
  if (r.includes('/') && gender) {
    // 男<420 / 女<360 形式：按性别取对应段
    const seg = gender === 'female' ? r.match(/女(<|>=|>)([\d.]+)/) : r.match(/男(<|>=|>)([\d.]+)/);
    if (seg) r = seg[0];
  }
  const two = r.match(/([\d.]+)\s*～\s*([\d.]+)/);
  if (two) return { lo: parseFloat(two[1]), hi: parseFloat(two[2]) };
  const lt = r.match(/<([\d.]+)/);
  const gt = r.match(/(≥|>=)([\d.]+)/);
  if (lt) return { hi: parseFloat(lt[1]) };
  if (gt) return { lo: parseFloat(gt[1]) };
  return {};
}

/** 趋势图画布尺寸 */
export const TREND_CW = 320, TREND_CH = 158, TREND_ML = 34, TREND_MR = 10, TREND_MT = 18, TREND_MB = 40;

export interface TrendPoint { x: number; y: number; v: number; level: AlarmLevel; date: string; }
export interface FieldTrend {
  def: ChronicFieldDef;
  ref: { lo?: number; hi?: number };
  points: TrendPoint[];
  xLabels: { x: number; label: string; anchor: 'start' | 'end' | 'middle' }[];
  line: string;
  area: string;
  ticks: { y: number; label: number }[];
  band: { yTop: number; yBot: number } | null;
  refLines: { y: number; label: string }[];
  latest: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  delta: number | null;
}

export function buildFieldTrend(def: ChronicFieldDef, series: { date: string; v: number }[], gender?: string): FieldTrend {
  const ref = parseRef(def.range, gender);
  const ptsRaw = series.map((s) => ({ v: s.v, date: s.date, level: levelOf(def.key, s.v, gender) }));
  const CW = TREND_CW, CH = TREND_CH, ML = TREND_ML, MR = TREND_MR, MT = TREND_MT, MB = TREND_MB;

  let loAll = Math.min(...ptsRaw.map((p) => p.v));
  let hiAll = Math.max(...ptsRaw.map((p) => p.v));
  if (ref.lo != null) loAll = Math.min(loAll, ref.lo);
  if (ref.hi != null) hiAll = Math.max(hiAll, ref.hi);
  let span = hiAll - loAll;
  if (!isFinite(span) || span <= 0) span = 1;
  const pad = Math.max(span * 0.18, 1);
  const yMin = loAll - pad;
  const yMax = hiAll + pad;

  const n = ptsRaw.length;
  const x = (i: number) => (n === 1 ? ML + (CW - ML - MR) / 2 : ML + (i * (CW - ML - MR)) / (n - 1));
  const y = (v: number) => MT + ((yMax - v) / (yMax - yMin)) * (CH - MT - MB);

  const points: TrendPoint[] = ptsRaw.map((p, i) => ({ x: x(i), y: y(p.v), v: p.v, level: p.level, date: p.date }));

  // 稀疏时间轴标签：最多约 6 个（首尾必显示）
  const xLabels: FieldTrend['xLabels'] = [];
  if (points.length > 0) {
    const step = Math.max(1, Math.ceil(points.length / 6));
    points.forEach((p, i) => {
      if (i === 0 || i === points.length - 1 || i % step === 0) {
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
        xLabels.push({ x: p.x, label: p.date.slice(5, 10), anchor: anchor as 'start' | 'end' | 'middle' });
      }
    });
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = points.length
    ? `${line} L${points[points.length - 1].x.toFixed(1)},${CH - MB} L${points[0].x.toFixed(1)},${CH - MB} Z`
    : '';

  // 纵向网格刻度（顶→底 4 条）
  const decimals = span < 10 ? 1 : 0;
  const ticks = [0, 1, 2, 3].map((i) => {
    const v = yMax - ((yMax - yMin) * i) / 3;
    return { y: MT + (i * (CH - MT - MB)) / 3, label: Number(v.toFixed(decimals)) };
  });

  // 达标区（normal 区）着色 + 参考线
  let band: { yTop: number; yBot: number } | null = null;
  const refLines: { y: number; label: string }[] = [];
  if (ref.lo != null && ref.hi != null) {
    const t = y(ref.hi), b = y(ref.lo);
    band = { yTop: t, yBot: b };
    refLines.push({ y: t, label: String(ref.hi) }, { y: b, label: String(ref.lo) });
  } else if (ref.lo != null) {
    // ≥下限：达标在上方
    const t = y(ref.lo);
    band = { yTop: MT, yBot: t };
    refLines.push({ y: t, label: String(ref.lo) });
  } else if (ref.hi != null) {
    // <上限：达标在下方
    const t = y(ref.hi);
    band = { yTop: t, yBot: CH - MB };
    refLines.push({ y: t, label: String(ref.hi) });
  }

  const vs = ptsRaw.map((p) => p.v);
  const last = n ? vs[n - 1] : null;
  const delta = n >= 2 ? Math.round((last! - vs[n - 2]) * 10) / 10 : null;

  return {
    def, ref,
    points,
    xLabels,
    line, area,
    ticks, band, refLines,
    latest: last,
    min: n ? Math.min(...vs) : null,
    max: n ? Math.max(...vs) : null,
    avg: n ? Math.round((vs.reduce((a, b) => a + b, 0) / n) * 10) / 10 : null,
    delta,
  };
}