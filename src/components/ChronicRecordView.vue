<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import {
  Siren, Activity, Droplet, CircleDot, Gauge, HeartPulse, Save, Ruler, Weight,
} from 'lucide-vue-next';
import type { ChronicGroupKey, ChronicFieldKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, calcBmi } from '../lib/chronic';
import type { ChronicValues } from '../types';

const store = useAppStore();

const ACCOUNT_ICONS: Record<string, typeof Siren> = {
  bp: Siren, glucose: Activity, lipid: Droplet, uric: CircleDot, bmi: Gauge, hcy: HeartPulse,
};

// 当前录入的指标族
const activeGroup = ref<ChronicGroupKey>('bp');

/** 该族要展示的录入行 */
const INPUT_ROWS = computed<{ key: ChronicFieldKey; label: string; unit: string; range: string }[]>(() => {
  if (activeGroup.value === 'bmi') {
    // 体重 → 身高 → BMI（身高/体重供自动计算，BMI 也允许手填）
    return [
      { key: 'weight', ...({ label: '体重', unit: 'kg', range: '参考' }) },
      { key: 'height', ...({ label: '身高', unit: 'cm', range: '参考' }) },
      { key: 'bmi', ...({ label: 'BMI指数', unit: '', range: '18.5 ～ 23.9' }) },
    ];
  }
  return groupFields(activeGroup.value)
    .filter((f) => f.display)
    .map((f) => ({ key: f.key, label: f.label, unit: f.unit, range: f.range }));
});

// 表单（字符串态，便于输入控制）
const form = reactive<Record<string, string>>({});
function resetForm() {
  Object.keys(form).forEach((k) => delete form[k]);
}

// 切换指标族时清空已填
watch(activeGroup, resetForm);

// BMI 自动计算：体重(kg)/身高(cm) 都填了就联动
watch(
  () => [form.weight, form.height] as const,
  ([w, h]) => {
    const bw = parseFloat(w || '');
    const bh = parseFloat(h || '');
    const bmi = calcBmi(bw, bh);
    if (bmi != null) form.bmi = String(bmi);
  },
);

function save() {
  const values: Record<string, number | undefined> = {};
  let any = false;
  for (const row of INPUT_ROWS.value) {
    const raw = (form[row.key] || '').trim();
    if (!raw) continue;
    const num = parseFloat(raw);
    if (Number.isNaN(num) || num < 0) {
      showToast(`请输入正确的${row.label}数值`);
      return;
    }
    values[row.key] = num;
    any = true;
  }
  if (!any) { showToast('至少填写一项指标后再保存'); return; }

  // BMI 优先由身高体重重算（保证口径一致）
  if (activeGroup.value === 'bmi' && values.weight && values.height) {
    const bmiVal = calcBmi(values.weight, values.height);
    if (bmiVal != null) values.bmi = bmiVal;
  }

  store.addChronicRecord({
    studentId: store.user?.id || '',
    campId: store.selectedCampId || undefined,
    values: values as ChronicValues,
  });
  showToast('已保存');
  store.goBack();
}

const goRecord = () => {
  store.setActiveChronicGroup(activeGroup.value);
  resetForm();
  store.goBack();
};

const latest = computed(() => (store.user ? store.getLatestChronic(store.user.id) : null));
const latestValueOf = (key: ChronicFieldKey): string => {
  if (!latest.value) return '';
  const v = (latest.value.values as Record<string, number | undefined>)[key];
  return v != null ? String(v) : '';
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="记录慢病指标" :on-back="goRecord" />

    <div class="flex-1 px-4 py-4 space-y-4">
      <!-- 指标族切换 -->
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          v-for="g in CHRONIC_GROUPS"
          :key="g.key"
          @click="activeGroup = g.key"
          :class="[
            'shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors border',
            activeGroup === g.key ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 active:bg-gray-50',
          ]"
          :style="activeGroup === g.key ? `background:linear-gradient(135deg,#0B6BCB,#12B5C2)` : ''"
        >
          <component :is="ACCOUNT_ICONS[g.key]" class="w-4 h-4" />
          {{ g.title }}
        </button>
      </div>

      <!-- 字段录入（大号适老化输入） -->
      <div class="space-y-3">
        <div v-for="row in INPUT_ROWS" :key="row.key" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
          <label class="text-[15px] font-bold text-gray-800 flex items-center justify-between">
            <span class="flex items-center gap-2">
              <component :is="row.key === 'weight' ? Weight : row.key === 'height' ? Ruler : Gauge" class="w-4 h-4 text-[#0B6BCB]" />
              {{ row.label }}
            </span>
            <span class="text-[10px] text-gray-400 font-normal">{{ row.range }}</span>
          </label>
          <div class="flex items-center gap-2 mt-2">
            <input
              v-model="form[row.key]"
              type="text"
              inputmode="decimal"
              :placeholder="latestValueOf(row.key) ? `上次 ${latestValueOf(row.key)}` : '请输入数值'"
              class="flex-1 min-w-0 text-2xl font-bold tabular-nums py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#0B6BCB] focus:outline-none text-gray-800 tracking-wide"
            />
            <span class="text-sm text-gray-400 w-14 shrink-0">{{ row.unit }}</span>
          </div>
        </div>
      </div>

      <button
        @click="save"
        class="w-full flex items-center justify-center gap-1.5 py-4 rounded-2xl text-white text-base font-bold shadow-sm active:opacity-90"
        :style="`background:linear-gradient(135deg,#0B6BCB,#12B5C2)`"
      >
        <Save class="w-5 h-5" /> 保存记录
      </button>

      <p class="text-center text-[11px] text-gray-400 leading-relaxed">
        当前记录进行健康管理参考，不构成医疗诊断；持续异常请线下就医。
      </p>
    </div>
  </div>
</template>