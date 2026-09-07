<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, ChartRulePopup, ChronicTrendChart } from './ui';
import { Plus } from 'lucide-vue-next';
import type { ChronicGroupKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, groupRate, judgeGroup, LEVEL_META, CHRONIC_ACCENT } from '../lib/chronic';

const store = useAppStore();

const g = computed<ChronicGroupKey>(() => store.activeChronicGroup || 'bp');
const meta = computed(() => CHRONIC_GROUPS.find((x) => x.key === g.value)!);
const user = computed(() => store.user);
const gender = computed(() => user.value?.gender);

// 本条记录（新→旧）
const rows = computed(() => (user.value ? store.getStudentChronicRecords(user.value.id) : []));

const rate = computed(() => groupRate(rows.value, g.value, gender.value));

const accent = computed(() => CHRONIC_ACCENT[g.value]);

// 该指标族所有「显示字段」各一张趋势图（血压2/血糖3/血脂4/尿酸1/BMI1/同型半胱氨酸1），复用共享组件保证与营养师端一致
const displayDefs = computed(() => groupFields(g.value).filter((f) => f.display));

function add() {
  store.setActiveChronicGroup(g.value);
  store.setCurrentView('chronic-record');
}
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
          <span class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-500">累计达标率</span>
            <ChartRulePopup title="累计达标率 · 计算规则">
              <p>达标率 = 达标次数 ÷ 测量总次数 × 100%。</p>
              <p>每次记录会逐项对照参考区间判定每个血压 / 血糖 / 血脂等字段：参考范围内的算「达标」。每个有值字段计 1 次测量，达标 1 次 +1；同一天记录多次也分别计入，不做天数去重。</p>
              <p>百分比四舍五入到整数。下方「达标 X 次 / 测量 Y 次」即达标次数与测量总次数。</p>
            </ChartRulePopup>
          </span>
          <span class="text-[11px] font-bold tabular-nums" :style="`color:${accent}`">{{ rate.rate }}%</span>
        </div>
        <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-1">
          <div class="h-full rounded-full transition-all" :style="`width:${rate.rate}%; background:${accent}`"></div>
        </div>
        <div class="text-[10px] text-gray-400">达标 {{ rate.normal }} 次 / 测量 {{ rate.total }} 次</div>
      </div>

      <!-- 图例 + 图表规则说明 -->
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2.5">
          <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#10B981"></i>达标</span>
          <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#A5772D"></i>关注</span>
          <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#B6523E"></i>异常</span>
          <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-3.5 h-1.5 rounded-sm" style="background:#10B981;opacity:.7"></i>达标区</span>
        </div>
        <ChartRulePopup title="趋势图 · 图例与规则">
          <p><b>绿色色带（达标区）</b><br/>这条指标的参考区间，数值落在这条带内即为「达标」；淡绿色虚线标出参考区间的上 / 下边界数值。</p>
          <p><b>数据点颜色</b><br/>每个圆点是一次记录的数值，颜色按当次档位：绿=达标、琥珀=关注、砖红=异常，可点击查看当次全部明细。</p>
          <p><b>折线与时间轴</b><br/>折线连接各次记录展示变化趋势；底部 MM-dd 为记录日期。可点图上某数据点弹出该次记录明细。</p>
          <p><b>底部统计</b>：最近值、较上一次的增减、期间最低、期间最高、平均值（保留 1 位小数，数据过少时部分缺省）。</p>
          <p>档位判定以各指标参考区间为准（默认演示值，非医疗诊断，仅供参考）。</p>
        </ChartRulePopup>
      </div>

      <!-- 每项指标的详细趋势（复用共享组件，与营养师端学员档案一致） -->
      <ChronicTrendChart
        v-for="def in displayDefs"
        :key="def.key"
        :def="def"
        :records="rows"
        :gender="gender"
        :accent="accent"
      />

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
  </div>
</template>