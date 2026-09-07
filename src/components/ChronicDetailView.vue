<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { Plus, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';
import type { ChronicGroupKey, ChronicFieldKey, ChronicFieldDef, AlarmLevel } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, groupRate, judgeGroup, levelOf, LEVEL_META } from '../lib/chronic';

const store = useAppStore();

const g = computed<ChronicGroupKey>(() => store.activeChronicGroup || 'bp');
const meta = computed(() => CHRONIC_GROUPS.find((x) => x.key === g.value)!);
const user = computed(() => store.user);
const gender = computed(() => user.value?.gender);

// 本条记录（新→旧）
const rows = computed(() => (user.value ? store.getStudentChronicRecords(user.value.id) : []));
const rowsAsc = computed(() => [...rows.value].sort((a, b) => a.date.localeCompare(b.date)));

const rate = computed(() => groupRate(rows.value, g.value, gender.value));

const ACCENT: Record<ChronicGroupKey, string> = {
  bp: '#0B6BCB', glucose: '#10B981', lipid: '#FF976A', uric: '#8B5CF6', bmi: '#12B5C2', hcy: '#A5772D',
};
const accent = computed(() => ACCENT[g.value]);

// ─── 参考区间解析：从 range 文案拆出数字边界（可选，兼容「<x」「a ～ b」「≥x」「男/女」） ──
function parseRef(range: string, gender?: string): { lo?: number; hi?: number } {
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

// ─── 单项指标趋势图几何 ───────────────────────────
const CW = 320, CH = 158, ML = 34, MR = 10, MT = 18, MB = 40;

interface TPoint { x: number; y: number; v: number; level: AlarmLevel; date: string; }
interface FieldTrend {
  def: ChronicFieldDef;
  ref: { lo?: number; hi?: number };
  // 取值序列（全部历史有值点）
  points: TPoint[];
  // 时间轴日期标签（稀疏，最多 ~6 个）
  xLabels: { x: number; label: string; anchor: 'start' | 'end' | 'middle' }[];
  // 连线
  line: string;
  area: string;
  ticks: { y: number; label: number }[];
  band: { yTop: number; yBot: number } | null;
  refLines: { y: number; label: string }[];
  // 统计
  latest: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  delta: number | null;
}

function buildFieldTrend(def: ChronicFieldDef, series: { date: string; v: number }[]): FieldTrend {
  const ref = parseRef(def.range, gender.value);
  const ptsRaw = series.map((s) => ({ v: s.v, date: s.date, level: levelOf(def.key, s.v, gender.value) }));

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

  const points: TPoint[] = ptsRaw.map((p, i) => ({ x: x(i), y: y(p.v), v: p.v, level: p.level, date: p.date }));

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

// 点击数据点 → 弹出该次记录明细
const sel = ref<{ date: string; defKey: ChronicFieldKey } | null>(null);
const selInfoShow = ref(false);
const selRecord = computed(() => (sel.value ? rowsAsc.value.find((r) => r.date === sel.value!.date) || null : null));
function openPoint(def: ChronicFieldDef, date: string) {
  sel.value = { date, defKey: def.key };
  selInfoShow.value = true;
}

// 每个「显示字段」一个趋势块（六族全覆盖：血压2/血糖3/血脂4/尿酸1/BMI1/同型半胱氨酸1）
const fieldTrends = computed<FieldTrend[]>(() => {
  const defs = groupFields(g.value).filter((f) => f.display);
  return defs.map((def) => {
    const series = rowsAsc.value
      .map((r) => ({ date: r.date, v: r.values[def.key] as number | undefined }))
      .filter((x): x is { date: string; v: number } => x.v != null)
      .map((x) => ({ date: x.date, v: x.v as number }));
    return buildFieldTrend(def, series);
  });
});

const lastDeltaLabel = (t: FieldTrend) => {
  if (t.delta == null || t.latest == null) return '—';
  const arrow = t.delta > 0 ? '+' : t.delta < 0 ? '' : '±';
  return arrow + t.delta;
};

function add() {
  store.setActiveChronicGroup(g.value);
  store.setCurrentView('chronic-record');
}

const levelDot = (lv: AlarmLevel) => LEVEL_META[lv].bar;
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-10 font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar :title="meta.title + '趋势'" :on-back="() => store.goBack()">
      <template #right>
        <button @click="add" class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"><Plus class="w-4 h-4" /> 记录</button>
      </template>
    </NavBar>

    <div class="flex-1 px-4 py-4 space-y-4">
      <!-- 达标率 概览 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-gray-500">最近测量达标率</span>
          <span class="text-[11px] font-bold tabular-nums" :style="`color:${accent}`">{{ rate.rate }}%</span>
        </div>
        <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-1">
          <div class="h-full rounded-full transition-all" :style="`width:${rate.rate}%; background:${accent}`"></div>
        </div>
        <div class="text-[10px] text-gray-400">达标 {{ rate.normal }} 次 / 测量 {{ rate.total }} 次</div>
      </div>

      <!-- 每项指标的详细趋势 -->
      <div
        v-for="t in fieldTrends"
        :key="t.def.key"
        class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden"
      >
        <!-- 卡片头：指标名 + 参考 + 最近值 + 较上次 -->
        <div class="px-4 pt-4 pb-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-gray-800">{{ t.def.label }}</span>
              <span class="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">参考 {{ t.def.range }}</span>
            </div>
            <span class="text-xs font-bold tabular-nums" :style="`color:${accent}`">
              {{ t.latest != null ? t.latest + ' ' + t.def.unit : '暂无' }}
            </span>
          </div>
        </div>

        <!-- 图表区 -->
        <div class="px-2">
          <svg :viewBox="`0 0 ${CW} ${CH}`" class="w-full" :class="t.points.length ? '' : 'h-32'">
            <template v-if="t.points.length">
              <!-- 达标区着色 -->
              <rect
                v-if="t.band"
                :x="ML" :y="t.band.yTop" :width="CW - ML - MR" :height="Math.max(0, t.band.yBot - t.band.yTop)"
                fill="#10B981" opacity="0.07"
              />
              <!-- 纵向网格 + Y 轴刻度值 -->
              <g v-for="(tk, i) in t.ticks" :key="i">
                <line :x1="ML" :y1="tk.y" :x2="CW - MR" :y2="tk.y" :stroke="i === 3 ? '#E5E7EB' : '#F1F3F5'" stroke-width="1" />
                <text :x="ML - 6" :y="tk.y + 3" text-anchor="end" class="text-[9px]" fill="#9CA3AF">{{ tk.label }}</text>
              </g>
              <!-- 参考线（达标边界） -->
              <g v-for="(rl, i) in t.refLines" :key="'r' + i">
                <line :x1="ML" :y1="rl.y" :x2="CW - MR" :y2="rl.y" stroke="#10B981" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />
                <text :x="CW - MR - 4" :y="rl.y - 3" text-anchor="end" class="text-[9px]" fill="#10B981">{{ rl.label }}</text>
              </g>
              <!-- 折线 -->
              <path :d="t.line" fill="none" :stroke="accent" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              <!-- 时间轴日期标签（稀疏） -->
              <g v-for="(xl, i) in t.xLabels" :key="'xl' + i">
                <text :x="xl.x" :y="CH - MB + 16" :text-anchor="xl.anchor" class="text-[9px]" fill="#9CA3AF">{{ xl.label }}</text>
              </g>
              <!-- 数据点（可点击查看该次明细）+ 数值标签 -->
              <g v-for="(p, i) in t.points" :key="i">
                <text :x="p.x" :y="p.y - 7" text-anchor="middle" class="text-[9px]" :fill="levelDot(p.level)" font-weight="bold">{{ p.v }}</text>
                <circle
                  :cx="p.x" :cy="p.y" r="7" fill="transparent" class="cursor-pointer"
                  @click="openPoint(t.def, p.date)"
                />
                <circle :cx="p.x" :cy="p.y" r="3" pointer-events="none" :fill="levelDot(p.level)" :stroke="i === t.points.length - 1 ? '#ffffff' : 'rgba(255,255,255,0.7)'" :stroke-width="1.5" />
              </g>
            </template>
            <text v-else :x="CW / 2" :y="CH / 2" text-anchor="middle" class="text-[11px]" fill="#9CA3AF">暂无记录，记录后可查看趋势</text>
          </svg>
        </div>

        <!-- 底部统计条 -->
        <div class="px-4 pb-4 pt-1">
          <div v-if="t.points.length" class="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
            <div class="text-center">
              <div class="text-[9px] text-gray-400">最近值</div>
              <div class="text-sm font-bold tabular-nums" :style="`color:${accent}`">{{ t.latest }}</div>
            </div>
            <div class="w-px h-6 bg-gray-200"></div>
            <div class="text-center">
              <div class="text-[9px] text-gray-400">较上次</div>
              <div class="text-sm font-bold tabular-nums flex items-center gap-0.5" :style="`color:${accent}`">
                <component :is="t.delta == null ? Minus : t.delta > 0 ? TrendingUp : t.delta < 0 ? TrendingDown : Minus" class="w-3.5 h-3.5" />
                {{ lastDeltaLabel(t) }}
              </div>
            </div>
            <div class="w-px h-6 bg-gray-200"></div>
            <div class="text-center">
              <div class="text-[9px] text-gray-400">期间最低</div>
              <div class="text-sm font-bold tabular-nums text-[#10B981]">{{ t.min }}</div>
            </div>
            <div class="w-px h-6 bg-gray-200"></div>
            <div class="text-center">
              <div class="text-[9px] text-gray-400">期间最高</div>
              <div class="text-sm font-bold tabular-nums text-[#B6523E]">{{ t.max }}</div>
            </div>
            <div class="w-px h-6 bg-gray-200"></div>
            <div class="text-center">
              <div class="text-[9px] text-gray-400">平均</div>
              <div class="text-sm font-bold tabular-nums text-gray-700">{{ t.avg }}</div>
            </div>
          </div>
          <div v-else class="text-center text-[11px] text-gray-400 py-1">去右上角「记录」补充数据，即可查看此指标趋势与达标区间。</div>
        </div>
      </div>

      <!-- 历次记录明细 -->
      <div class="text-xs font-bold text-gray-500 px-1 pt-1">历次记录（{{ rows.length }}）</div>
      <div v-if="rows.length > 0" class="space-y-2">
        <div
          v-for="r in rows"
          :key="r.id"
          class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-700">{{ r.date.slice(0, 16) }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="LEVEL_META[judgeGroup(r.values, g, gender).level].bg + ' ' + LEVEL_META[judgeGroup(r.values, g, gender).level].text">
              {{ LEVEL_META[judgeGroup(r.values, g, gender).level].label }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="f in judgeGroup(r.values, g, gender).fields"
              :key="f.key"
              class="flex-1 min-w-[5.5rem] rounded-xl px-3 py-2"
              :class="LEVEL_META[f.level].bg"
            >
              <div class="text-[9px] text-gray-500">{{ f.label }}</div>
              <div class="text-base font-bold tabular-nums mt-0.5" :class="LEVEL_META[f.level].text">
                {{ f.value }} <span class="text-[9px] font-normal">{{ f.unit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center text-xs text-gray-400 py-10">该指标族暂无记录</div>
    </div>

    <!-- 点击数据点 → 该次记录明细 -->
    <VanPopup v-model:show="selInfoShow" position="bottom" round class="custom-popup">
      <div v-if="selRecord" class="p-5 pb-7 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-gray-900">{{ selRecord.date.slice(0, 16) }}</h3>
          <span class="text-[10px] px-2 py-0.5 rounded-full" :class="LEVEL_META[judgeGroup(selRecord.values, g, gender).level].bg + ' ' + LEVEL_META[judgeGroup(selRecord.values, g, gender).level].text">
            {{ LEVEL_META[judgeGroup(selRecord.values, g, gender).level].label }}
          </span>
        </div>
        <p class="text-[11px] text-gray-400 -mt-2">本次记录的各项指标 · {{ meta.title }}</p>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="f in judgeGroup(selRecord.values, g, gender).fields"
            :key="f.key"
            class="rounded-xl px-3 py-3"
            :class="LEVEL_META[f.level].bg"
          >
            <div class="text-[10px] text-gray-500">{{ f.label }}</div>
            <div class="text-lg font-black tabular-nums mt-0.5" :class="LEVEL_META[f.level].text">
              {{ f.value }} <span class="text-[9px] font-normal">{{ f.unit }}</span>
            </div>
            <div class="text-[9px] mt-0.5" :class="LEVEL_META[f.level].text">{{ LEVEL_META[f.level].label }}</div>
          </div>
        </div>
      </div>
    </VanPopup>
  </div>
</template>