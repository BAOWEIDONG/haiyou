<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { ROLE_LABEL, type CoachActivityRecord, type KnowledgeContent, type KnowledgeBlock } from '../types';
import { Newspaper, Play, PlayCircle, User } from 'lucide-vue-next';

/**
 * 学员端「健康活动」文章详情页（公众号推送式阅读页）。
 * 点击首页信息流里的锻炼活动 / 健康科普卡片后直达，展示单篇完整内容。
 * 数据来自 store.activeArticle（{ kind, item }），KeepAlive 下随切换自动更新。
 */
const store = useAppStore();
const art = computed(() => store.activeArticle);
const isActivity = computed(() => art.value?.kind === 'activity');
const activity = computed<CoachActivityRecord | null>(() =>
  art.value?.kind === 'activity' ? (art.value.item as CoachActivityRecord) : null,
);
const knowledge = computed<KnowledgeContent | null>(() =>
  art.value?.kind === 'knowledge' ? (art.value.item as KnowledgeContent) : null,
);

const ktypeMeta: Record<string, { label: string; cls: string }> = {
  article: { label: '图文', cls: 'bg-[#0EA5E9]/10 text-[#0EA5E9]' },
  video: { label: '视频', cls: 'bg-purple-50 text-purple-500' },
};

const title = computed(() => (isActivity.value ? activity.value?.title || '' : knowledge.value?.title || ''));
// 顶部来源名（类似公众号账号名）：锻炼活动 → 教练 / 健康科普 → 作者角色
const source = computed(() => {
  if (isActivity.value) return '康复教练 · 锻炼活动';
  const k = knowledge.value;
  if (!k) return '医院健康科普';
  const roleName = k.authorRole ? ROLE_LABEL[k.authorRole] : '';
  return k.contentType === 'article' ? `${roleName} · 健康科普` : `${roleName} · ${ktypeMeta[k.contentType]?.label}`;
});
const typeBadge = computed(() => (isActivity.value ? null : knowledge.value ? ktypeMeta[knowledge.value.contentType] : null));
const authorName = computed(() => (isActivity.value ? activity.value?.coachName : knowledge.value?.authorName) || '');
const dateStr = computed(() => {
  const d = isActivity.value ? activity.value?.date : knowledge.value?.createdAt;
  return (d || '').slice(0, 10);
});
// 图文正文块（营养师发布的"文字段落 + 中间插图"；缺省=旧版摘要+配图渲染）
const knowledgeBlocks = computed<KnowledgeBlock[] | null>(() =>
  knowledge.value?.blocks && knowledge.value.blocks.length > 0 ? knowledge.value.blocks : null,
);
// 正文
const body = computed(() => {
  if (isActivity.value) return activity.value?.description || '';
  if (knowledgeBlocks.value) return ''; // 图文正文改由 blocks 渲染
  return knowledge.value?.summary || '';
});
// 媒体
const images = computed<string[]>(() => (isActivity.value ? activity.value?.imageUrls : knowledge.value?.imageUrls) || []);
const videoUrls = computed<string[]>(() => (isActivity.value ? activity.value?.videoUrls || [] : knowledge.value?.videoUrls || []));
const cover = computed<string | null>(() => {
  if (images.value[0]) return images.value[0];
  // 无独立封面时，取正文里第一张插图作封面
  if (knowledgeBlocks.value) {
    const first = knowledgeBlocks.value.find((b) => b.type === 'image');
    if (first && first.type === 'image') return first.url;
  }
  return null;
});
const coverVideo = computed<string | null>(() => (cover.value ? null : videoUrls.value[0] || null));
const bodyImages = computed(() => (knowledgeBlocks.value ? [] : images.value.slice(1)));
const hasData = computed(() => art.value !== null);

const openBanner = () => {
  if (images.value.length > 0) {
    store.openImagePreview(images.value, 0);
  } else if (coverVideo.value) {
    store.openVideoPreview(coverVideo.value);
  }
};
const playVideo = (url: string) => store.openVideoPreview(url);
// 图文块字段读取（模板内不做类型断言，走这里窄化）
const blockText = (b: KnowledgeBlock) => (b.type === 'text' ? b.text : '');
const blockUrl = (b: KnowledgeBlock) => (b.type === 'image' ? b.url : '');
const blockHasText = (b: KnowledgeBlock) => b.type === 'text' && b.text.trim() !== '';
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F4F6F8] pb-16 font-sans">
    <NavBar title="健康活动" :on-back="() => store.goBack()" />

    <!-- 空态兜底（理论上不会走到） -->
    <div v-if="!hasData" class="flex-1 flex items-center justify-center text-sm text-gray-400">内容不存在</div>

    <div v-else class="flex-1">
      <article class="bg-white">
        <!-- 封面图（公众号推送式大图） -->
        <button v-if="cover || coverVideo" class="relative w-full aspect-[16/10] block bg-gray-100" @click="openBanner">
          <img v-if="cover" :src="cover" :alt="title" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          <video v-else-if="coverVideo" :src="coverVideo" class="w-full h-full object-cover" preload="metadata" muted playsinline webkit-playsinline />
          <div v-if="coverVideo" class="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div class="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play class="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </button>
        <div v-else class="relative w-full aspect-[16/10] bg-gradient-to-br from-[#0EA5E9]/10 to-purple-50 flex items-center justify-center">
          <component :is="isActivity ? PlayCircle : Newspaper" class="w-12 h-12 text-[#0EA5E9]/60" />
        </div>

        <!-- 标题 & 元信息（公众号推文头） -->
        <div class="px-5 pt-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[11px] font-bold text-[#0EA5E9]">{{ source }}</span>
            <span v-if="typeBadge" :class="['text-[10px] font-bold px-1.5 py-0.5 rounded', typeBadge.cls]">{{ typeBadge.label }}</span>
          </div>
          <h1 class="text-[20px] font-black text-gray-900 leading-snug">{{ title }}</h1>
          <div class="flex items-center gap-1.5 text-[11px] text-gray-400 mt-2.5 pb-3 border-b border-gray-100">
            <User class="w-3 h-3" />
            <span class="text-gray-500 font-medium">{{ authorName }} · {{ dateStr }}</span>
          </div>
        </div>

        <!-- 正文 -->
        <div class="px-5 pt-4 pb-8">
          <!-- 图文正文：文字段落与中间插图按序（营养师发布的排版） -->
          <template v-if="knowledgeBlocks">
            <template v-for="(b, idx) in knowledgeBlocks" :key="idx">
              <p v-if="blockHasText(b)" class="text-[15px] text-gray-700 leading-[1.9] tracking-wide whitespace-pre-wrap">{{ blockText(b) }}</p>
              <img v-else-if="b.type === 'image'" :src="blockUrl(b)" :alt="`插图 ${idx + 1}`" class="w-full rounded-xl my-3" loading="lazy" decoding="async" @click="store.openImagePreview([blockUrl(b)], 0)" />
            </template>
          </template>

          <!-- 旧结构回退：摘要 + 文后配图（历史内容） -->
          <template v-else>
            <p v-if="body" class="text-[15px] text-gray-700 leading-[1.9] tracking-wide whitespace-pre-wrap">{{ body }}</p>
            <div v-if="bodyImages.length" class="mt-4 space-y-3">
              <img
                v-for="(url, idx) in bodyImages" :key="idx"
                :src="url" :alt="`配图 ${idx + 2}`"
                class="w-full rounded-xl" loading="lazy" decoding="async"
                @click="store.openImagePreview(images, idx + 1)"
              />
            </div>
          </template>

          <!-- 视频（可播放，复用全局弹层） -->
          <div v-if="videoUrls.length" class="mt-5 space-y-3">
            <button
              v-for="(url, idx) in videoUrls" :key="idx"
              @click="playVideo(url)"
              class="relative w-full bg-gray-900 rounded-xl overflow-hidden text-left"
            >
              <video :src="url" class="w-full aspect-video object-cover opacity-90" preload="metadata" muted playsinline webkit-playsinline />
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play class="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" />
                </div>
              </div>
              <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 text-[11px] text-white font-medium">播放视频 {{ videoUrls.length > 1 ? idx + 1 : '' }}</div>
            </button>
          </div>

          <!-- 底部来源标识 -->
          <div class="mt-6 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Radio v-if="typeBadge?.cls?.includes('red')" class="w-3 h-3" />
            <span>健康活动 · {{ source }}</span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>