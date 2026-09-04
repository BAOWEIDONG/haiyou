<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Plus, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';
import type { ChronicGroupKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, groupRate, judgeGroup, LEVEL_META } from '../lib/chronic';

const store = useAppStore();

const g = computed<ChronicGroupKey>(() => store.activeChronicGroup || 'bp');
const meta = computed(() => CHRONIC_GROUPS.find((x) => x.key === g.value)!);
const user = computed(() => store.user);

// 本条记录（新→旧）
const rows = computed(() => (user.value ? store.getStudentChronicRecords(user.value.id) : []));
const rowsAsc = computed(() => [...rows.value].sort((a, b) => a.date.localeCompare(b.date)));

const rate = computed(() => groupRate(rows.value, g.value, user.value?.gender));

const ACCENT: Record<ChronicGroupKey, string> = {
  bp: '#0B6BCB', glucose: '#10B981', lipid: '#FF976A', uric: '#8B5CF6', bmi: '#12B5C2', hcy: '#A5772D',
};
const accent = computed(() => ACCENT[g.value]);

// 主字段趋势序列（该族第一个显示字段，青→最新）
const primaryDef = computed(() => groupFields(g.value).find((f) => f.display)!);
const series = computed(() =>
  rowsAsc.value
    .map((r) => ({ date: r.date.slice(5, 16), v: r.values[primaryDef.value.key] as number | undefined }))
    .filter((x) => x.v != null),
);

// 简易 SVG 折线
const W = 300, H = 90, P = 6;
const spark = computed(() => {
  const s = series.value;
  if (s.length < 2) return { path: '', lastDelta: null as number | null, dir: '' as 'up' | 'down' | 'flat', min: 0, max: 0 };
  const vals = s.map((x) => x.v as number);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const step = (W - P * 2) / (s.length - 1);
  const pts = s.map((x, i) => {
    const px = P + i * step;
    const py = H - P - ((x.v! - min) / range) * (H - P * 2);
    return [px, py] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = s[s.length - 1].v!;
  const prev = s[s.length - 2].v!;
  return {
    path,
    lastDelta: Math.round((last - prev) * 10) / 10,
    dir: (last > prev ? 'up' : last < prev ? 'down' : 'flat') as 'up' | 'down' | 'flat',
    min, max,
  };
});

function add() {
  store.setActiveChronicGroup(g.value);
  store.setCurrentView('chronic-record');
}
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar :title="meta.title + '趋势'" :on-back="() => store.goBack()">
      <template #right>
        <button @click="add" class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"><Plus class="w-4 h-4" /> 记录</button>
      </template>
    </NavBar>

    <div class="flex-1 px-4 py-4 space-y-3">
      <!-- 达标率 + 趋势概览 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-gray-500">{{ primaryDef.label }} · 参考 {{ primaryDef.range }}</span>
          <span class="text-[11px] font-bold" :style="`color:${accent}`">达标率 {{ rate.rate }}%</span>
        </div>

        <!-- 达标率进度条 -->
        <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
          <div class="h-full rounded-full transition-all" :style="`width:${rate.rate}%; background:${accent}`"></div>
        </div>

        <!-- 折线 -->
        <template v-if="spark.path">
          <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-24">
            <line :x1="P" :y1="H - P" :x2="W - P" :y2="H - P" stroke="#E5E7EB" stroke-width="1" />
            <path :d="spark.path" fill="none" :stroke="accent" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex items-center justify-between text-[10px] text-gray-400 mt-1">
            <span>{{ series[0]?.date }}</span>
            <span class="flex items-center gap-1">
              <component
                :is="spark.dir === 'up' ? TrendingUp : spark.dir === 'down' ? TrendingDown : Minus"
                class="w-3.5 h-3.5"
                :style="`color:${accent}`"
              />
              较上次
              <span class="font-bold tabular-nums" :style="`color:${accent}`">
                {{ spark.lastDelta != null ? (spark.lastDelta > 0 ? '+' : '') + spark.lastDelta : '—' }} {{ primaryDef.unit }}
              </span>
            </span>
            <span>{{ series[series.length - 1]?.date }}</span>
          </div>
        </template>
        <div v-else class="text-center text-xs text-gray-400 py-6">
          该指标族记录还太少，去「记录」补充几次后即可查看趋势与达标率。
        </div>
      </div>

      <!-- 历次记录 -->
      <div class="text-xs font-bold text-gray-500 px-1">历次记录（{{ rows.length }}）</div>
      <div v-if="rows.length > 0" class="space-y-2">
        <div
          v-for="r in rows"
          :key="r.id"
          class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-700">{{ r.date.slice(0, 16) }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="LEVEL_META[judgeGroup(r.values, g, user?.gender).level].bg + ' ' + LEVEL_META[judgeGroup(r.values, g, user?.gender).level].text">
              {{ LEVEL_META[judgeGroup(r.values, g, user?.gender).level].label }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="f in judgeGroup(r.values, g, user?.gender).fields"
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
  </div>
</template>