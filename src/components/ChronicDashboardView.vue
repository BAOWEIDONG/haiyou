<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, StudentTabbar, ChartRulePopup } from './ui';
import {
  HeartPulse, Plus, ChevronRight, ClipboardPlus, Activity, Droplet,
  CircleDot, Gauge, Siren,
} from 'lucide-vue-next';
import type { ChronicGroupKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, judgeGroup, groupRate, LEVEL_META } from '../lib/chronic';

const store = useAppStore();

const user = computed(() => store.user);
const rows = computed(() => (user.value ? store.getStudentChronicRecords(user.value.id) : []));
// 用"最全"快照而非 rows[0]：录入各指标族会各落一条记录，只取最新一条会把其他族"吞掉"（与首页口径一致）
const latest = computed(() => (user.value ? store.getLatestChronic(user.value.id) : null));

// 最近一次记录的六族健康总览（达标/关注/异常计数），看台相对首页的核心差异化
const summary = computed(() => {
  const s = { normal: 0, off: 0, critical: 0, any: false };
  if (!latest.value) return s;
  s.any = true;
  for (const g of CHRONIC_GROUPS) {
    const lv = judgeGroup(latest.value.values, g.key, user.value?.gender).level;
    s[lv]++;
  }
  return s;
});

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
    <NavBar title="健康指标看台" :on-back="() => store.goBack()">
      <template #right>
        <button
          @click="store.setActiveChronicGroup(null); store.setCurrentView('chronic-record')"
          class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"
        >
          <Plus class="w-4 h-4" /> 记录指标
        </button>
      </template>
    </NavBar>

    <div class="flex-1 px-4 py-4 space-y-3">
      <!-- 健康总览：六族判定汇总（看台差异化核心：看"整体健康程度"，而非单项数值） -->
      <template v-if="summary.any">
        <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-gray-500">最近一次 · 健康总览</span>
            <ChartRulePopup title="健康指标 · 计算规则说明">
              <p><b>达标率怎么算</b><br/>达标率 = 达标次数 ÷ 测量总次数 × 100%。每次记录会逐项对照参考区间判定每个字段，每个有值字段计 1 次测量；同一天多次记录分别计入，不做天数去重，百分比四舍五入到整数。</p>
              <p><b>达标 / 关注 / 异常怎么判定</b><br/>每个字段对照各自参考区间：达标（绿）在参考范围内；关注（琥珀）超出但相对可控；异常（砖红）明显偏离。判定阈值来自产品数据字典参考值（默认演示值，非医疗诊断，最终以医院确认为准）。</p>
              <p><b>健康总览三项计数</b><br/>取最近一次记录，把该次各个字段按上述规则分别归入达标 / 关注 / 异常，统计出三类数量——让你一眼看到当前整体健康程度，而非单个数值。</p>
              <p><b>指标卡里的达标率进度条</b><br/>下方每张指标卡附「累计达标率」：该指标族全部历史记录里，达标字段数 ÷ 有值字段总数。进度条按此比例显示，右侧「X/Y 达标」即达标次数 / 测量次数。</p>
            </ChartRulePopup>
          </div>
          <div class="flex items-center justify-around">
            <div class="text-center">
              <div class="text-xl font-black tabular-nums text-[#10B981]">{{ summary.normal }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">达标</div>
            </div>
            <div class="w-px h-8 bg-gray-100"></div>
            <div class="text-center">
              <div class="text-xl font-black tabular-nums text-[#A5772D]">{{ summary.off }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">关注</div>
            </div>
            <div class="w-px h-8 bg-gray-100"></div>
            <div class="text-center">
              <div class="text-xl font-black tabular-nums text-[#B6523E]">{{ summary.critical }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">异常</div>
            </div>
            <div class="pl-4 border-l border-gray-100">
              <div class="text-[10px] text-gray-400 mb-1">最近测量</div>
              <div class="text-xs font-bold tabular-nums text-gray-700">{{ latest?.date.slice(5, 16) }}</div>
            </div>
          </div>
          <p v-if="summary.critical > 0 || summary.off > 0" class="text-[10px] text-[#B6523E] mt-2">
            有 {{ summary.critical + summary.off }} 项处于「关注 / 异常」，点击下方卡片查看趋势并持续跟踪。
          </p>
        </div>
      </template>

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
            <p class="text-sm text-gray-600 leading-relaxed">还没有健康指标测量记录。<br/>点右上角「记录指标」开始逐项记录你的血压 / 血糖 / 血脂等。</p>
          </div>
        </template>
      </div>

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
          <!-- 达标率进度条（看台差异化：健康程度一眼可见） -->
          <div v-if="c.rate.total > 0" class="flex items-center gap-2 mt-2">
            <div class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full rounded-full transition-all" :style="`width:${c.rate.rate}%; background:${c.accent}`"></div>
            </div>
            <span class="text-[9px] text-gray-400 shrink-0">{{ c.rate.normal }}/{{ c.rate.total }} 达标</span>
          </div>
          <div v-else class="text-[10px] text-gray-400 mt-1.5">记录后展示累计达标率</div>
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