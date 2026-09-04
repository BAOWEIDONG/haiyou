<script setup lang="ts">
import { ref, computed, type Ref } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { MessageSquareText, Send, Plus, Phone, ImagePlus, X } from 'lucide-vue-next';
import { compressImage } from '../lib/imageCompress';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');
const showNew = ref(false);
const newTopic = ref('');
const newQuestion = ref('');
const newPhone = ref('');
const newImages = ref<string[]>([]);
const replyImages = ref<string[]>([]);
const newFileInput = ref<HTMLInputElement | null>(null);
const replyFileInput = ref<HTMLInputElement | null>(null);

const list = computed(() => (store.user ? store.getStudentThreads(store.user.id) : []));

// 压缩 → 读成 dataURL（与 store 持久化格式一致），最多 4 张
async function fileToData(file: File): Promise<string> {
  const comp = await compressImage(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(comp);
  });
}
async function pickTargetImages(target: Ref<string[]>, inputRef: Ref<HTMLInputElement | null>) {
  const input = inputRef.value;
  const files = input?.files;
  if (!files || !files.length) return;
  for (const file of Array.from(files)) {
    if (target.value.length >= 4) { showToast('最多上传 4 张图片'); break; }
    try { target.value.push(await fileToData(file)); } catch { showToast('图片读取失败'); }
  }
  if (input) input.value = '';
}
const onPickReply = () => pickTargetImages(replyImages, replyFileInput);
const onPickNew = () => pickTargetImages(newImages, newFileInput);

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
  draft.value = '';
  replyImages.value = [];
  if (openId.value) store.markThreadRead(id);
};

const ask = (id: string) => {
  if (!draft.value.trim() && replyImages.value.length === 0) { showToast('请输入留言或选择图片'); return; }
  store.studentReplyConsult(id, draft.value.trim(), replyImages.value);
  showToast('已发送，等待医生团队回复');
  draft.value = '';
  replyImages.value = [];
};

const doNew = () => {
  if (!store.user) return;
  if (!newTopic.value.trim() || !newQuestion.value.trim()) { showToast('请填写标题与内容'); return; }
  store.askConsult(store.user.id, newTopic.value.trim(), newQuestion.value.trim(), newPhone.value.trim(), newImages.value);
  showNew.value = false;
  newTopic.value = ''; newQuestion.value = ''; newPhone.value = ''; newImages.value = [];
  showToast('已发起提问');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#EDF9F1] to-[#FBFFFC]">
    <NavBar title="健康答疑" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showNew = true" class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"><Plus class="w-4 h-4" /> 提问</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-green-50 border border-green-100 p-3 leading-relaxed">
        给医生团队健康顾问留言（减重/饮食/运动），工作时间回复。可选择性填写<b>手机号</b>，必要时医生会电话回访。
      </div>

      <template v-if="list.length > 0">
        <div v-for="t in list" :key="t.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden">
          <button @click="toggle(t.id)" class="w-full p-4 text-left">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0"><MessageSquareText class="h-5 w-5" /></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-bold text-gray-800">{{ t.topic }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', t.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                    {{ t.status === 'pending' ? '待回复' : '已回复' }}
                  </span>
                </div>
                <div class="text-[11px] text-gray-400 mt-1">{{ t.createdAt.slice(0, 16) }}</div>
              </div>
              <div class="text-gray-300 text-sm ml-1">›</div>
            </div>
          </button>

          <div v-if="openId === t.id" class="border-t border-gray-100 p-4 space-y-3">
            <div class="text-[12px] text-gray-600 bg-gray-50 rounded-lg p-2.5">{{ t.question }}</div>
            <div v-if="t.images && t.images.length" class="flex flex-wrap gap-2">
              <img v-for="(img, ii) in t.images" :key="ii" :src="img" class="w-20 h-20 rounded-lg object-cover border border-gray-100" @click="store.openImagePreview(t.images as string[], ii)" />
            </div>
            <div v-if="t.replies.length > 0" class="space-y-2">
              <div
                v-for="(r, i) in t.replies"
                :key="i"
                :class="['p-3 rounded-xl text-[13px] leading-relaxed', r.side === 'staff' ? 'bg-[#0B6BCB]/8 mr-10' : 'bg-gray-100 ml-10']"
              >
                <div class="text-[10px] text-gray-400 mb-1">{{ r.authorName }} · {{ r.createdAt.slice(5, 16) }}</div>
                {{ r.text }}
                <div v-if="r.images && r.images.length" class="flex flex-wrap gap-2 mt-2">
                  <img v-for="(img, ii) in r.images" :key="ii" :src="img" class="w-20 h-20 rounded-lg object-cover border border-gray-100" @click="store.openImagePreview(r.images as string[], ii)" />
                </div>
              </div>
            </div>

            <div v-if="t.studentPhone" class="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-100 p-3 text-[12px] text-purple-700">
              <Phone class="w-3.5 h-3.5" />
              联系电话：{{ t.studentPhone }}
            </div>

            <div v-if="replyImages.length" class="flex flex-wrap gap-2">
              <div v-for="(img, ii) in replyImages" :key="ii" class="relative w-16 h-16">
                <img :src="img" class="w-full h-full rounded-lg object-cover border border-gray-100" />
                <button @click="replyImages.splice(ii, 1)" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900/70 text-white flex items-center justify-center"><X class="w-3 h-3" /></button>
              </div>
            </div>

            <textarea
              v-model="draft"
              rows="2"
              placeholder="继续留言…（可附图）"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
            />
            <div class="flex gap-2">
              <button @click="replyFileInput?.click()" class="w-11 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 active:bg-gray-50"><ImagePlus class="w-5 h-5" /></button>
              <button @click="ask(t.id)" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">
                <Send class="w-4 h-4" /> 发送
              </button>
            </div>
            <input ref="replyFileInput" type="file" accept="image/*" multiple class="hidden" @change="onPickReply" />
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-14">还没有答疑记录<br/>点右上角「提问」发起留言</div>
    </div>

    <VanPopup v-model:show="showNew" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">发起健康提问</h3>
        <input v-model="newTopic" placeholder="主题（如：外食怎么吃）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none" />
        <textarea v-model="newQuestion" rows="3" placeholder="描述你的问题…（可附图）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none" />
        <div v-if="newImages.length" class="flex flex-wrap gap-2">
          <div v-for="(img, ii) in newImages" :key="ii" class="relative w-16 h-16">
            <img :src="img" class="w-full h-full rounded-lg object-cover border border-gray-100" />
            <button @click="newImages.splice(ii, 1)" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900/70 text-white flex items-center justify-center"><X class="w-3 h-3" /></button>
          </div>
          <button @click="newFileInput?.click()" class="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-0.5 text-gray-400 active:bg-gray-50">
            <ImagePlus class="w-5 h-5" /><span class="text-[9px]">附图</span>
          </button>
        </div>
        <button v-else @click="newFileInput?.click()" class="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-400 text-xs flex items-center justify-center gap-1.5 active:bg-gray-50">
          <ImagePlus class="w-4 h-4" /> 添加图片（选填，体检单/症状照片更清晰）
        </button>
        <input ref="newFileInput" type="file" accept="image/*" multiple class="hidden" @change="onPickNew" />
        <input v-model="newPhone" inputmode="tel" placeholder="联系电话（选填，必要时医生电话回访）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none" />
        <button @click="doNew" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">提交提问</button>
      </div>
    </VanPopup>
  </div>
</template>