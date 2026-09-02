<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { uploadFile } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { Send, UploadCloud, X } from 'lucide-vue-next';

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

// 报告材料（必传）：化验单/体检报告图片，营养师结合材料解读
const materials = ref<string[]>([]);
const materialInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const onPickMaterial = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
  if (files.length === 0) return;
  uploading.value = true;
  try {
    const urls = await Promise.all(
      files.map(async (f) => uploadFile(await compressImage(f))),
    );
    materials.value = [...materials.value, ...urls];
  } catch {
    showToast('上传失败，请重试');
  } finally {
    uploading.value = false;
    (e.target as HTMLInputElement).value = '';
  }
};
const removeMaterial = (idx: number) => { materials.value = materials.value.filter((_, i) => i !== idx); };

const toggle = (name: string) => {
  selected.value = selected.value.includes(name)
    ? selected.value.filter((n) => n !== name)
    : [...selected.value, name];
};

const submit = () => {
  if (!store.user) { showToast('请先登录'); return; }
  if (selected.value.length === 0) { showToast('请勾选想解读的指标'); return; }
  if (materials.value.length === 0) { showToast('请上传报告材料（化验单/体检报告）'); return; }
  if (!question.value.trim()) { showToast('请留下你的问题或想了解的方向'); return; }
  store.submitInterpretationRequest(store.user.id, selected.value, question.value.trim(), materials.value);
  showToast('已提交，医生团队将结合你的报告为你解读');
  store.setCurrentView('interpretation-result');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="请医生健康解读" :on-back="() => store.goBack()" />
    <div class="flex-1 px-5 py-4 space-y-4">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        上传你的<b>体检 / 化验报告</b>，勾选想了解的指标，留下问题。医生将在工作时间结合你的报告出具<b>健康解读</b>（减重成效、指标趋势与生活习惯建议）——这是健康管理建议，不构成医疗诊断。
      </div>

      <!-- 报告材料（必传） -->
      <div>
        <div class="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1">
          上传报告材料
          <span class="text-red-500 text-[11px] font-normal">*</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="(m, idx) in materials"
            :key="idx"
            class="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 active:opacity-70"
            @click="store.openImagePreview(materials, idx)"
          >
            <img :src="m" loading="lazy" decoding="async" class="w-full h-full object-cover" />
            <span @click.stop="removeMaterial(idx)" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X class="w-3 h-3" />
            </span>
          </button>
          <button
            :disabled="uploading"
            @click="materialInput?.click()"
            class="aspect-[3/4] rounded-xl border-2 border-dashed border-[#0EA5E9]/40 bg-[#0EA5E9]/5 text-[#0EA5E9] flex flex-col items-center justify-center gap-1 active:bg-[#0EA5E9]/10 disabled:opacity-50"
          >
            <UploadCloud class="w-5 h-5" />
            <span class="text-[10px] font-bold">{{ uploading ? '上传中' : '添加' }}</span>
          </button>
        </div>
        <input ref="materialInput" type="file" accept="image/*" multiple class="hidden" @change="onPickMaterial" />
        <div class="text-[10px] text-gray-400 mt-1.5">支持拍照或相册选择化验单/体检报告图片，可多张；营养师将结合材料出具解读</div>
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