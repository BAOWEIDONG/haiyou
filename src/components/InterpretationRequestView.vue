<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { Send } from 'lucide-vue-next';

const store = useAppStore();

// 从营养师可配置指标里，按分类聚合出可解读指标清单
const byCategory = computed(() => {
  const map = new Map<string, string[]>();
  for (const c of store.metricConfigs) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c.name);
  }
  return Array.from(map.entries());
});

const selected = ref<string[]>([]);
const question = ref('');
const toggle = (name: string) => {
  selected.value = selected.value.includes(name)
    ? selected.value.filter((n) => n !== name)
    : [...selected.value, name];
};

const submit = () => {
  if (!store.user) { showToast('请先登录'); return; }
  if (selected.value.length === 0) { showToast('请勾选想解读的指标'); return; }
  if (!question.value.trim()) { showToast('请留下你的问题或想了解的方向'); return; }
  store.submitInterpretationRequest(store.user.id, selected.value, question.value.trim());
  showToast('已提交，医生团队将为你健康解读');
  store.setCurrentView('interpretation-result');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="请医生健康解读" :on-back="() => store.goBack()" />
    <div class="flex-1 px-5 py-4 space-y-4">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        勾选健康档案中想了解的指标，留下你的问题。医生将在工作时间为你出具<b>健康解读</b>（减重成效、指标趋势与生活习惯建议）——这是健康管理建议，不构成医疗诊断。
      </div>

      <div>
        <div class="text-sm font-bold text-gray-900 mb-2">选择想解读的指标（可多选）</div>
        <div v-for="[cat, names] in byCategory" :key="cat" class="mb-3">
          <div class="text-[11px] text-gray-400 mb-1.5">{{ cat }}</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="n in names"
              :key="n"
              @click="toggle(n)"
              :class="['px-3 py-1.5 rounded-full text-[13px] font-bold border-2 transition-all',
                selected.includes(n) ? 'border-[#0EA5E9] bg-[#0EA5E9]/8 text-[#0EA5E9]' : 'border-gray-100 bg-white text-gray-600']"
            >{{ n }}</button>
          </div>
        </div>
      </div>

      <div>
        <div class="text-sm font-bold text-gray-900 mb-2">你的问题 / 想了解的方向</div>
        <textarea
          v-model="question"
          rows="4"
          style="height: 6.5rem"
          placeholder="例如：最近体重下降变慢，早上空腹血糖有点波动，整体趋势合不合理？饮食还要注意什么？"
          class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0EA5E9] focus:outline-none resize-none"
        />
      </div>

      <div class="pt-2">
        <button @click="submit" class="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white text-sm font-bold active:opacity-90">
          <Send class="w-4 h-4" /> 提交请健康解读
        </button>
      </div>
    </div>
  </div>
</template>