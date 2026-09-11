<script setup lang="ts">
import { computed, watch, reactive, ref } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import {
  Siren, Activity, Droplet, CircleDot, Gauge, HeartPulse, Save, Ruler, Weight, Delete, History, CircleAlert,
} from 'lucide-vue-next';
import type { ChronicGroupKey, ChronicFieldKey } from '../lib/chronic';
import { CHRONIC_GROUPS, groupFields, calcBmi, fieldDef, parseRef } from '../lib/chronic';
import type { ChronicValues } from '../types';

const store = useAppStore();

const ACCOUNT_ICONS: Record<string, typeof Siren> = {
  bp: Siren, glucose: Activity, lipid: Droplet, uric: CircleDot, bmi: Gauge, hcy: HeartPulse,
};

// 当前录入的指标族：以 store.activeChronicGroup 为唯一真源（首页点某指标卡进录入会自动定位到该族；
// KeepAlive 缓存下再入也能拿到最新目标族，避免"总是从血压开始"）
const activeGroup = computed<ChronicGroupKey>(() => store.activeChronicGroup || 'bp');

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

// ─── 大号数字键盘（适老化：停靠底部，替代系统键盘） ──────────────
const keypadOpen = ref(false);
const activeKey = ref<ChronicFieldKey | null>(null);

function openKeypad(key: ChronicFieldKey) {
  activeKey.value = key;
  keypadOpen.value = true;
}
function closeKeypad() {
  keypadOpen.value = false;
  activeKey.value = null;
}
function pressDigit(d: string) {
  if (!activeKey.value) return;
  // 只允许一位小数点，避免误触出 "1.2.3"
  if (d === '.' && (form[activeKey.value] || '').includes('.')) return;
  activeJustFilled.value = false;
  form[activeKey.value] = (form[activeKey.value] || '') + d;
}
function pressBackspace() {
  if (!activeKey.value) return;
  form[activeKey.value] = (form[activeKey.value] || '').slice(0, -1);
}
const activeRow = computed(
  () => INPUT_ROWS.value.find((r) => r.key === activeKey.value) || null,
);
const activeJustFilled = ref(false);
function fillLastValue(key: ChronicFieldKey) {
  const last = latestValueOf(key);
  if (!last) return;
  form[key] = last;
  if (activeKey.value === key) activeJustFilled.value = true;
}

// 异常值大字体提醒（实时，按当前性别取各指标参考区间）
function warningOf(key: ChronicFieldKey): string | null {
  const raw = (form[key] || '').trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  if (Number.isNaN(n) || n < 0) return null;
  // height/weight 的 range 为「参考」无可解析边界，走绝对合理范围粗判
  if (key === 'height' && (n < 100 || n > 250)) return `身高 ${n}cm 超出常见范围，请核对`;
  if (key === 'weight' && (n < 20 || n > 300)) return `体重 ${n}kg 超出常见范围，请核对`;
  const { lo, hi } = parseRef(fieldDef(key).range, store.user?.gender);
  if (hi != null && n > hi) return `高于参考上限 ${hi}${fieldDef(key).unit}，请核对`;
  if (lo != null && n < lo) return `低于参考下限 ${lo}${fieldDef(key).unit}，请核对`;
  return null;
}
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="记录健康指标" :on-back="goRecord" />

    <div :class="['flex-1 px-4 py-5 space-y-5', keypadOpen ? 'pb-72' : 'pb-8']">
      <!-- 指标族切换（整齐 3 列网格，6族两行对齐全） -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-2">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="g in CHRONIC_GROUPS"
            :key="g.key"
            @click="store.setActiveChronicGroup(g.key)"
            :class="[
              'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors',
              activeGroup === g.key ? 'text-white shadow-sm' : 'text-gray-600 bg-gray-50 active:bg-gray-100',
            ]"
            :style="activeGroup === g.key ? `background:linear-gradient(135deg,#0B6BCB,#12B5C2)` : ''"
          >
            <component :is="ACCOUNT_ICONS[g.key]" class="w-4 h-4 shrink-0" />
            {{ g.title }}
          </button>
        </div>
      </div>

      <!-- 字段录入（大号适老化输入，卡片间距整齐板正） -->
      <div class="space-y-4">
        <div v-for="row in INPUT_ROWS" :key="row.key" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-5">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-[15px] font-bold text-gray-800">
              <component :is="row.key === 'weight' ? Weight : row.key === 'height' ? Ruler : Gauge" class="w-4 h-4 text-[#0B6BCB] shrink-0" />
              {{ row.label }}
            </label>
            <span class="text-[11px] text-gray-400 font-normal bg-gray-50 px-2 py-0.5 rounded-full">{{ row.range }}</span>
          </div>
          <div class="flex items-center gap-3 mt-4">
            <input
              :value="form[row.key]"
              type="text"
              inputmode="none"
              readonly
              :placeholder="latestValueOf(row.key) ? `上次 ${latestValueOf(row.key)}` : '点这里输入'"
              @click="openKeypad(row.key)"
              class="flex-1 min-w-0 text-2xl font-bold tabular-nums py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#0B6BCB] focus:outline-none text-gray-800 tracking-wide"
            />
            <span class="text-sm text-gray-400 w-14 shrink-0 text-center">{{ row.unit }}</span>
          </div>

          <!-- 上次值一键填入 + 实时异常提醒 -->
          <div class="mt-3 flex items-center gap-2 min-h-[2rem]">
            <button
              v-if="latestValueOf(row.key)"
              @click="fillLastValue(row.key)"
              class="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold text-[#0B6BCB] bg-[#0B6BCB]/10 active:bg-[#0B6BCB]/20 transition-colors"
            >
              <History class="w-4 h-4" /> 和上次一样 {{ latestValueOf(row.key) }}
            </button>
            <div
              v-if="warningOf(row.key)"
              class="flex items-center gap-1.5 text-[15px] font-bold text-red-500"
            >
              <CircleAlert class="w-5 h-5 shrink-0" /> {{ warningOf(row.key) }}
            </div>
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

    <!-- 大号数字键盘（停靠底部，适老化） -->
    <transition name="keypad-slide">
      <div
        v-if="keypadOpen"
        class="fixed inset-x-0 bottom-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.12)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <!-- 顶部：当前录入项 + 收起 -->
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="text-[15px] font-bold text-gray-800">
            {{ activeRow?.label }}
            <span v-if="activeRow?.unit" class="text-xs text-gray-400 font-normal ml-1">{{ activeRow.unit }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="activeJustFilled" class="text-xs font-bold text-emerald-600">已填入上次值</span>
            <button @click="closeKeypad" class="px-4 py-2 rounded-full text-sm font-bold text-[#0B6BCB] bg-[#0B6BCB]/10 active:bg-[#0B6BCB]/20">完成</button>
          </div>
        </div>

        <!-- 按键：1-9 / . 0 退格 -->
        <div class="grid grid-cols-3 gap-2">
          <template v-for="d in ['1','2','3','4','5','6','7','8','9']" :key="d">
            <button
              @click="pressDigit(d)"
              class="h-14 rounded-xl text-2xl font-bold text-gray-800 bg-gray-100 active:bg-[#0B6BCB] active:text-white transition-colors select-none"
            >{{ d }}</button>
          </template>
          <button
            @click="pressDigit('.')"
            class="h-14 rounded-xl text-2xl font-bold text-gray-800 bg-gray-100 active:bg-[#0B6BCB] active:text-white transition-colors select-none"
          >.</button>
          <button
            @click="pressDigit('0')"
            class="h-14 rounded-xl text-2xl font-bold text-gray-800 bg-gray-100 active:bg-[#0B6BCB] active:text-white transition-colors select-none"
          >0</button>
          <button
            @click="pressBackspace"
            class="h-14 rounded-xl text-[#0B6BCB] bg-[#0B6BCB]/10 active:bg-[#0B6BCB]/20 transition-colors flex items-center justify-center select-none"
          ><Delete class="w-7 h-7" /></button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.keypad-slide-enter-active,
.keypad-slide-leave-active {
  transition: transform 0.22s ease;
}
.keypad-slide-enter-from,
.keypad-slide-leave-to {
  transform: translateY(100%);
}
</style>