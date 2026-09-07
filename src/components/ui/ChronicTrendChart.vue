<script setup lang="ts">
import { computed, ref } from 'vue';
import { Popup as VanPopup } from 'vant';
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';
import type { ChronicRecord } from '../../types';
import {
  CHRONIC_ACCENT, CHRONIC_GROUPS, buildFieldTrend, judgeGroup, LEVEL_META,
  TREND_CW, TREND_CH, TREND_ML, TREND_MR, TREND_MB,
} from '../../lib/chronic';
import type { AlarmLevel, ChronicFieldDef, FieldTrend } from '../../lib/chronic';

/**
 * 单一健康指标字段趋势图（共用于学员端健康指标详情页 & 营养师端学员档案）。
 * 展示：指标名 + 参考区间 + 最新值 → SVG 折线趋势（达标区/参考虚线/数据点按档着色+数值/时间轴）；
 * 底部统计条（最近值/较上次/期间最低/最高/平均）；点数据点弹该次记录明细。
 * 只读，不支持批注。
 */
const props = defineProps<{
  def: ChronicFieldDef;
  records: ChronicRecord[];
  gender?: string;
  accent?: string;
}>();

const rowsAsc = computed(() => [...props.records].sort((a, b) => a.date.localeCompare(b.date)));
const series = computed(() =>
  rowsAsc.value
    .map((r) => ({ date: r.date, v: r.values[props.def.key] as number | undefined }))
    .filter((x): x is { date: string; v: number } => x.v != null)
    .map((x) => ({ date: x.date, v: x.v as number })),
);
const trend = computed<FieldTrend>(() => buildFieldTrend(props.def, series.value, props.gender));
const accent = computed(() => props.accent || CHRONIC_ACCENT[props.def.group]);
const groupMeta = computed(() => CHRONIC_GROUPS.find((x) => x.key === props.def.group)!);
const levelDot = (lv: AlarmLevel) => LEVEL_META[lv].bar;

// 点击数据点 → 弹出该次记录明细
const selDate = ref('');
const selShow = ref(false);
const selRecord = computed(() => rowsAsc.value.find((r) => r.date === selDate.value) || null);
function openPoint(date: string) { selDate.value = date; selShow.value = true; }

const lastDeltaLabel = (t: FieldTrend) => {
  if (t.delta == null || t.latest == null) return '—';
  const arrow = t.delta > 0 ? '+' : t.delta < 0 ? '' : '±';
  return arrow + t.delta;
};
</script>

<template>
  <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden">
    <!-- 卡片头：指标名 + 参考 + 最新值 -->
    <div class="px-4 pt-4 pb-1">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-gray-800">{{ def.label }}</span>
          <span class="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">参考 {{ def.range }}</span>
        </div>
        <span class="text-xs font-bold tabular-nums" :style="`color:${accent}`">
          {{ trend.latest != null ? trend.latest + ' ' + def.unit : '暂无' }}
        </span>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="px-2">
      <svg :viewBox="`0 0 ${TREND_CW} ${TREND_CH}`" class="w-full" :class="trend.points.length ? '' : 'h-32'">
        <template v-if="trend.points.length">
          <!-- 达标区着色 -->
          <rect
            v-if="trend.band"
            :x="TREND_ML" :y="trend.band.yTop" :width="TREND_CW - TREND_ML - TREND_MR" :height="Math.max(0, trend.band.yBot - trend.band.yTop)"
            fill="#10B981" opacity="0.07"
          />
          <!-- 纵向网格 + Y 轴刻度值 -->
          <g v-for="(tk, i) in trend.ticks" :key="i">
            <line :x1="TREND_ML" :y1="tk.y" :x2="TREND_CW - TREND_MR" :y2="tk.y" :stroke="i === 3 ? '#E5E7EB' : '#F1F3F5'" stroke-width="1" />
            <text :x="TREND_ML - 6" :y="tk.y + 3" text-anchor="end" class="text-[9px]" fill="#9CA3AF">{{ tk.label }}</text>
          </g>
          <!-- 参考线（达标边界） -->
          <g v-for="(rl, i) in trend.refLines" :key="'r' + i">
            <line :x1="TREND_ML" :y1="rl.y" :x2="TREND_CW - TREND_MR" :y2="rl.y" stroke="#10B981" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />
            <text :x="TREND_CW - TREND_MR - 4" :y="rl.y - 3" text-anchor="end" class="text-[9px]" fill="#10B981">{{ rl.label }}</text>
          </g>
          <!-- 折线 -->
          <path :d="trend.line" fill="none" :stroke="accent" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          <!-- 时间轴日期标签（稀疏） -->
          <g v-for="(xl, i) in trend.xLabels" :key="'xl' + i">
            <text :x="xl.x" :y="TREND_CH - TREND_MB + 16" :text-anchor="xl.anchor" class="text-[9px]" fill="#9CA3AF">{{ xl.label }}</text>
          </g>
          <!-- 数据点（可点击查看该次明细）+ 数值标签 -->
          <g v-for="(p, i) in trend.points" :key="i">
            <text :x="p.x" :y="p.y - 7" text-anchor="middle" class="text-[9px]" :fill="levelDot(p.level)" font-weight="bold">{{ p.v }}</text>
            <circle :cx="p.x" :cy="p.y" r="7" fill="transparent" class="cursor-pointer" @click="openPoint(p.date)" />
            <circle :cx="p.x" :cy="p.y" r="3" pointer-events="none" :fill="levelDot(p.level)" :stroke="i === trend.points.length - 1 ? '#ffffff' : 'rgba(255,255,255,0.7)'" :stroke-width="1.5" />
          </g>
        </template>
        <text v-else :x="TREND_CW / 2" :y="TREND_CH / 2" text-anchor="middle" class="text-[11px]" fill="#9CA3AF">暂无记录，录入后可查看趋势</text>
      </svg>
    </div>

    <!-- 底部统计条 -->
    <div class="px-4 pb-4 pt-1">
      <div v-if="trend.points.length" class="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
        <div class="text-center">
          <div class="text-[9px] text-gray-400">最近值</div>
          <div class="text-sm font-bold tabular-nums" :style="`color:${accent}`">{{ trend.latest }}</div>
        </div>
        <div class="w-px h-6 bg-gray-200"></div>
        <div class="text-center">
          <div class="text-[9px] text-gray-400">较上次</div>
          <div class="text-sm font-bold tabular-nums flex items-center gap-0.5" :style="`color:${accent}`">
            <component :is="trend.delta == null ? Minus : trend.delta > 0 ? TrendingUp : trend.delta < 0 ? TrendingDown : Minus" class="w-3.5 h-3.5" />
            {{ lastDeltaLabel(trend) }}
          </div>
        </div>
        <div class="w-px h-6 bg-gray-200"></div>
        <div class="text-center">
          <div class="text-[9px] text-gray-400">期间最低</div>
          <div class="text-sm font-bold tabular-nums text-[#10B981]">{{ trend.min }}</div>
        </div>
        <div class="w-px h-6 bg-gray-200"></div>
        <div class="text-center">
          <div class="text-[9px] text-gray-400">期间最高</div>
          <div class="text-sm font-bold tabular-nums text-[#B6523E]">{{ trend.max }}</div>
        </div>
        <div class="w-px h-6 bg-gray-200"></div>
        <div class="text-center">
          <div class="text-[9px] text-gray-400">平均</div>
          <div class="text-sm font-bold tabular-nums text-gray-700">{{ trend.avg }}</div>
        </div>
      </div>
      <div v-else class="text-center text-[11px] text-gray-400 py-1">暂无测量记录，补充数据后即可查看此指标趋势与达标区间。</div>
    </div>

    <!-- 点击数据点 → 该次记录明细 -->
    <VanPopup v-model:show="selShow" position="bottom" round class="custom-popup">
      <div v-if="selRecord" class="p-5 pb-7 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-gray-900">{{ selRecord.date.slice(0, 16) }}</h3>
          <span class="text-[10px] px-2 py-0.5 rounded-full" :class="LEVEL_META[judgeGroup(selRecord.values, def.group, gender).level].bg + ' ' + LEVEL_META[judgeGroup(selRecord.values, def.group, gender).level].text">
            {{ LEVEL_META[judgeGroup(selRecord.values, def.group, gender).level].label }}
          </span>
        </div>
        <p class="text-[11px] text-gray-400 -mt-2">本次记录的各项指标 · {{ groupMeta.title }}</p>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="f in judgeGroup(selRecord.values, def.group, gender).fields"
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