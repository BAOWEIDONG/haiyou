<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast, showConfirmDialog, Popup as VanPopup } from 'vant';
import { Plus, Save, Pencil, Trash2, UploadCloud, Image as ImageIcon } from 'lucide-vue-next';
import { compressImage } from '../lib/imageCompress';
import { uploadFile } from '../lib/api';
import type { ActivityBanner } from '../types';

/**
 * 营养师端「活动页设置」：① 自定义活动页两个资讯 tab 的名称（学员端活动页顶部分类名）；
 * ② 维护活动页顶部 Banner 运营位（图片 + 标题 + 外链跳转，学员端点击跳转）。
 */
const store = useAppStore();

// ─── 分类名称 ───
const tabEx = ref(store.activityConfig.tabs.exercise);
const tabK = ref(store.activityConfig.tabs.knowledge);
function saveTabs() {
  const exercise = tabEx.value.trim();
  const knowledge = tabK.value.trim();
  if (!exercise || !knowledge) { showToast('两个分类名称都不能为空'); return; }
  store.setActivityTabNames({ exercise, knowledge });
  showToast('已保存分类名称');
}

const banners = computed(() => store.activityConfig.banners);

// ─── Banner 编辑 ───
const showEdit = ref(false);
const editingId = ref<string | null>(null);
const bannerForm = ref<{ title: string; image: string; url: string }>({ title: '', image: '', url: '' });
const uploadInputRef = ref<HTMLInputElement | null>(null);
const uploadBusy = ref(false);

function openAdd() {
  editingId.value = null;
  bannerForm.value = { title: '', image: '', url: '' };
  showEdit.value = true;
}
function openEdit(b: ActivityBanner) {
  editingId.value = b.id;
  bannerForm.value = { title: b.title, image: b.image, url: b.url };
  showEdit.value = true;
}
async function onPickImage(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  uploadBusy.value = true;
  try {
    bannerForm.value.image = await uploadFile(await compressImage(f));
  } catch {
    showToast('图片上传失败，请重试');
  }
  uploadBusy.value = false;
  (e.target as HTMLInputElement).value = '';
}
function removeImage() { bannerForm.value.image = ''; }
function saveBanner() {
  const title = bannerForm.value.title.trim();
  if (!title) { showToast('请填写标题'); return; }
  if (!bannerForm.value.image) { showToast('请上传图片'); return; }
  const url = bannerForm.value.url.trim();
  if (url && !/^https?:\/\//i.test(url)) { showToast('跳转链接需以 http(s):// 开头'); return; }
  if (editingId.value) store.updateActivityBanner(editingId.value, { title, image: bannerForm.value.image, url });
  else store.addActivityBanner({ title, image: bannerForm.value.image, url });
  showToast(editingId.value ? 'Banner 已更新' : 'Banner 已添加');
  showEdit.value = false;
}
function onDelete(b: ActivityBanner) {
  showConfirmDialog({
    title: '删除 Banner',
    message: `确定删除「${b.title}」？学员端活动页顶部将不再展示。`,
  })
    .then(() => { store.removeActivityBanner(b.id); showToast('已删除'); })
    .catch(() => {});
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F7F8FA] pb-10 font-sans">
    <NavBar title="活动页设置" :on-back="store.goBack" />

    <div class="p-4 space-y-4">
      <!-- 资讯分类名称 -->
      <div class="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
        <h3 class="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <div class="w-1.5 h-4 bg-[#0B6BCB] rounded-full"></div>资讯分类名称
        </h3>
        <div class="flex items-center gap-2">
          <div
            :key="tabEx"
            class="flex-1"
          >
            <label class="text-[11px] text-gray-400 mb-1 block">第一个分类（锻炼类）</label>
            <input v-model="tabEx" type="text" maxlength="8" placeholder="如：锻炼活动"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
        </div>
        <div class="mt-2">
          <label class="text-[11px] text-gray-400 mb-1 block">第二个分类（科普类）</label>
          <input v-model="tabK" type="text" maxlength="8" placeholder="如：健康科普"
            class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
        </div>
        <button @click="saveTabs" class="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0B6BCB] text-white text-sm font-bold active:opacity-85">
          <Save class="w-4 h-4" /> 保存分类名称
        </button>
      </div>

      <!-- 顶部 Banner -->
      <div class="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <div class="w-1.5 h-4 bg-[#12B5C2] rounded-full"></div>活动页 Banner
          </h3>
          <button @click="openAdd" class="text-[#0B6BCB] text-xs font-bold flex items-center gap-0.5 active:opacity-80">
            <Plus class="w-4 h-4" /> 添加
          </button>
        </div>
        <p class="text-[11px] text-gray-400 mb-3 leading-relaxed">展示在学员端活动页顶部，点击可跳转外部链接。</p>

        <div v-if="banners.length === 0" class="text-center text-xs text-gray-400 py-8 border border-dashed border-gray-200 rounded-xl">
          还没有 Banner，点右上角「添加」
        </div>
        <div v-else class="space-y-2.5">
          <div v-for="b in banners" :key="b.id" class="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
            <div class="w-14 h-9 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-[#0B6BCB] to-[#12B5C2] flex items-center justify-center">
              <img loading="lazy" decoding="async" v-if="b.image" :src="b.image" class="w-full h-full object-cover" alt="" />
              <ImageIcon v-else class="w-4 h-4 text-white/60" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 truncate">{{ b.title }}</div>
              <div class="text-[10px] text-gray-400 truncate">{{ b.url || '无跳转链接' }}</div>
            </div>
            <button @click="openEdit(b)" class="p-1.5 text-[#0B6BCB] active:opacity-70 shrink-0"><Pencil class="w-4 h-4" /></button>
            <button @click="onDelete(b)" class="p-1.5 text-[#B6523E] active:opacity-70 shrink-0"><Trash2 class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑 Banner 弹窗 -->
    <VanPopup v-model:show="showEdit" position="bottom" round closeable close-icon-position="top-right" class="custom-popup" :style="{ maxHeight: '88vh' }">
      <div class="p-5 pb-8 overflow-y-auto">
        <h3 class="font-bold text-gray-900 mb-4 text-center">{{ editingId ? '编辑 Banner' : '添加 Banner' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="text-sm text-gray-500 mb-1 block">标题（角标文案）</label>
            <input v-model="bannerForm.title" type="text" maxlength="14" placeholder="如：健康科普季"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
          </div>
          <div>
            <label class="text-sm text-gray-500 mb-1 block">展示图</label>
            <input ref="uploadInputRef" type="file" accept="image/*" class="hidden" @change="onPickImage" />
            <div v-if="bannerForm.image" class="relative rounded-lg overflow-hidden aspect-[16/7]">
              <img :src="bannerForm.image" class="w-full h-full object-cover" alt="" />
              <button @click="removeImage" class="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center active:opacity-80">×</button>
            </div>
            <button
              v-else
              :disabled="uploadBusy"
              @click="uploadInputRef?.click()"
              class="w-full py-5 border-2 border-dashed border-[#0B6BCB]/40 bg-[#0B6BCB]/5 rounded-xl text-[#0B6BCB] flex flex-col items-center gap-1 active:opacity-80 disabled:opacity-50"
            >
              <UploadCloud class="w-6 h-6" />
              <span class="text-xs">{{ uploadBusy ? '上传中…' : '点击上传图片' }}</span>
            </button>
          </div>
          <div>
            <label class="text-sm text-gray-500 mb-1 block">跳转链接 (选填)</label>
            <input v-model="bannerForm.url" type="url" placeholder="https://…"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
            <p class="text-[10px] text-gray-400 mt-1">留空则点击不跳转（纯展示）。</p>
          </div>
        </div>
        <button @click="saveBanner" class="mt-6 w-full py-2.5 rounded-lg bg-[#0B6BCB] text-white text-sm font-bold active:opacity-85">
          保存
        </button>
      </div>
    </VanPopup>
  </div>
</template>