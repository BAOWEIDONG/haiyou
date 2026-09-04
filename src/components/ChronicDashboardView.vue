<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, StudentTabbar } from './ui';
import {
  HeartPulse, Plus, ChevronRight, ClipboardPlus, Activity, Droplet,
  CircleDot, Gauge, Siren,
} from 'lucide-vue-next';
import type { ChronicGroupKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, judgeGroup, groupRate, LEVEL_META } from '../lib/chronic';

const store = useAppStore();

const user = computed(() => store.user);
const rows = computed(() => (user.value ? store.getStudentChronicRecords(user.value.id) : []));
const latest = computed(() => rows.value[0] || null);

// 六指标族配色
const ACCENT: Record<ChronicGroupKey, string> = {
  bp: '#0B6BCB',
  glucose: '#10B981',
  lipid: '#FF976A',
  uric: '#8B5CF6',
  bmi: '#12B5C2',
  hcy: '#A5772D',
};

/** 组卡片数据 */
function groupCard(g: ChronicGroupKey) {
  const gf = groupFields(g);
  const gender = user.value?.gender;
  const latestJudge = latest.value ? judgeGroup(latest.value.values, g, gender) : { level: 'off' as const, fields: [] };
  const primaryDef = gf.find((f) => f.display && latest.value && latest.value.values[f.key] != null);
  const primaryValue = primaryDef && latest.value ? (latest.value.values[primaryDef.key] as number) : null;
  const rate = groupRate(rows.value, g, gender);
  const recentHasValue = rows.value.some((r) => gf.some((f) => f.display && r.values[f.key] != null));
  return {
    key: g,
    meta: CHRONIC_GROUPS.find((x) => x.key === g)!,
    level: latestJudge.level,
    primaryLabel: primaryDef ? primaryDef.label : null,
    primaryValue,
    primaryUnit: primaryDef ? primaryDef.unit : '',
    rate,
    recentHasValue,
    accent: ACCENT[g],
  };
}

const cards = computed(() => CHRONIC_GROUPS.map((g) => groupCard(g.key)));

function openGroup(g: ChronicGroupKey) {
  store.setActiveChronicGroup(g);
  store.setCurrentView('chronic-detail');
}
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <div class="pt-[calc(env(safe-area-inset-top)+2.5rem)] px-5 pb-6">
      <div class="flex items-end justify-between mb-4">
        <div>
          <div class="flex items-center gap-1.5 text-xs font-bold text-[#0B6BCB]">
            <HeartPulse class="w-4 h-4" /> 慢病管理
          </div>
          <h2 class="text-xl font-bold text-gray-900 mt-1">{{ user?.name || '我' }}的健康看台</h2>
          <p class="text-[11px] text-gray-500 mt-0.5">五高指标 · 逐项记录 · 动态跟踪</p>
        </div>
        <button
          @click="store.setCurrentView('chronic-record')"
          class="flex items-center gap-1 px-3.5 py-2 rounded-xl text-white text-sm font-bold shadow-sm active:opacity-90"
          :style="`background:linear-gradient(135deg,#0B6BCB,#12B5C2)`"
        >
          <Plus class="w-4 h-4" /> 记录指标
        </button>
      </div>

      <!-- 最新总览 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
        <template v-if="latest">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500">最近一次测量</span>
            <span class="text-[10px] text-gray-400">{{ latest.date.slice(0, 16) }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="c in cards"
              :key="c.key"
              class="px-2 py-1 rounded-lg text-[11px] font-medium"
              :class="LEVEL_META[c.level].bg + ' ' + LEVEL_META[c.level].text"
            >
              {{ c.meta.title }}:{{ c.level === 'normal' ? '达标' : c.level === 'off' ? '关注' : '异常' }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0">
              <ClipboardPlus class="h-6 w-6" />
            </div>
            <p class="text-sm text-gray-600 leading-relaxed">还没有慢病测量记录。<br/>点右上角「记录指标」开始逐项记录你的血压 / 血糖 / 血脂等。</p>
          </div>
        </template>
      </div>
    </div>

    <div class="flex-1 px-5 space-y-3 -mt-1">
      <!-- 六指标卡片 -->
      <button
        v-for="c in cards"
        :key="c.key"
        @click="openGroup(c.key)"
        class="w-full relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4 flex items-center gap-4 text-left active:opacity-90 transition-opacity"
      >
        <!-- 状态竖条 -->
        <div class="w-1 self-stretch rounded-full shrink-0" :class="LEVEL_META[c.level].bg">
          <div class="h-full w-full" :style="`background:${LEVEL_META[c.level].bar}`"></div>
        </div>
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          :style="`background:${c.accent}14; color:${c.accent}`"
        >
          <component :is="c.key === 'bp' ? Siren : c.key === 'glucose' ? Activity : c.key === 'lipid' ? Droplet : c.key === 'uric' ? CircleDot : c.key === 'bmi' ? Gauge : HeartPulse" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-gray-900">{{ c.meta.title }}</span>
            <span v-if="c.recentHasValue" class="text-[10px] px-1.5 py-0.5 rounded-full" :class="LEVEL_META[c.level].bg + ' ' + LEVEL_META[c.level].text">
              {{ LEVEL_META[c.level].label }}
            </span>
            <span v-else class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">未记录</span>
          </div>
          <div class="text-[11px] text-gray-400 mt-0.5 truncate">{{ c.meta.desc }}</div>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-xl font-bold tabular-nums" :style="`color:${c.accent}`">
              {{ c.primaryValue != null ? c.primaryValue : '—' }}
            </span>
            <span v-if="c.primaryValue != null" class="text-[10px] text-gray-400">{{ c.primaryUnit }}</span>
            <span v-if="c.primaryValue != null && c.primaryLabel" class="text-[10px] text-gray-400 truncate">{{ c.primaryLabel }}</span>
            <span class="ml-auto text-[10px] font-medium" :class="LEVEL_META[c.level].text">达标率 {{ c.rate.rate }}%</span>
          </div>
        </div>
        <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
      </button>

      <!-- 说明 -->
      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed">
        以上为健康管理记录与提示，不构成医疗诊断。指标持续异常将提示并引导你就医（转介线下医院），由有资质的医生承接。
      </div>
    </div>

    <StudentTabbar anchor="health" :badge="store.getStudentMsgUnreadCount(user?.id || '') > 0 ? store.getStudentMsgUnreadCount(user?.id || '') : undefined" />
  </div>
</template>