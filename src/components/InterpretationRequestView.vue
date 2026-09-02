<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { uploadFile } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { Send, UploadCloud, X } from 'lucide-vue-next';

const store = useAppStore();

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

const submit = () => {
  if (!store.user) { showToast('请先登录'); return; }
  if (materials.value.length === 0) { showToast('请上传报告材料（化验单/体检报告）'); return; }
  if (!question.value.trim()) { showToast('请留下你的问题或想了解的方向'); return; }
  store.submitInterpretationRequest(store.user.id, [], question.value.trim(), materials.value);
  showToast('已提交，医生团队将结合你的报告为你解读');
  store.setCurrentView('interpretation-result');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="请医生健康解读" :on-back="() => store.goBack()" />
    <div class="flex-1 px-5 py-4 space-y-4">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        上传你的<b>体检 / 化验报告</b>，写下关心的指标、数值与想了解的方向。医生将在工作时间结合你的报告出具<b>健康解读</b>（减重成效、指标趋势与生活习惯建议）——这是健康管理建议，不构成医疗诊断。
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
            class="aspect-[3/4] rounded-xl border-2 border-dashed border-[#0B6BCB]/40 bg-[#0B6BCB]/5 text-[#0B6BCB] flex flex-col items-center justify-center gap-1 active:bg-[#0B6BCB]/10 disabled:opacity-50"
          >
            <UploadCloud class="w-5 h-5" />
            <span class="text-[10px] font-bold">{{ uploading ? '上传中' : '添加' }}</span>
          </button>
        </div>
        <input ref="materialInput" type="file" accept="image/*" multiple class="hidden" @change="onPickMaterial" />
        <div class="text-[10px] text-gray-400 mt-1.5">支持拍照或相册选择化验单/体检报告图片，可多张；营养师将结合材料出具解读</div>
      </div>

      <div>
        <div class="text-sm font-bold text-gray-900 mb-2">想解读的内容 / 你的问题</div>
        <textarea
          v-model="question"
          rows="4"
          style="height: 6.5rem"
          placeholder="直接告诉我你想让营养师解读的内容：体检/化验报告里关心的指标、数值、趋势，或你的疑问。例如：最近体重下降变慢，早上空腹血糖有点波动，整体趋势合不合理？"
          class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
        />
        <div class="text-[10px] text-gray-400 mt-1">可直接写出关心的指标与数值，营养师将结合你上传的报告给出解读</div>
      </div>

      <div class="pt-2">
        <button @click="submit" class="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">
          <Send class="w-4 h-4" /> 提交请健康解读
        </button>
      </div>
    </div>
  </div>
</template>