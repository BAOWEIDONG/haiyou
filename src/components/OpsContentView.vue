<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showConfirmDialog, showToast } from 'vant';
import { Newspaper, Plus, Trash2, Video } from 'lucide-vue-next';

const store = useAppStore();

const list = computed(() => store.knowledgeContents);
const roleLabel: Record<string, string> = { dietitian: '营养师', coach: '康复教练' };

const doRemove = (id: string, name: string) => {
  showConfirmDialog({
    title: '删除内容',
    message: `将删除「${name}」，已订阅用户将无法再查看。是否确认？`,
  }).then(() => {
    store.deleteKnowledgeContent(id);
    showToast('已删除');
  }).catch(() => {});
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="内容管理" :on-back="() => store.goBack()">
      <template #right>
        <button @click="store.setCurrentView('ops-content-new')" class="flex items-center gap-1 text-sm font-bold text-[#8B5CF6]"><Plus class="w-4 h-4" /> 发布</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        知识库素材管理：图文/短视频。医生、营养师、康复教练的内容统一在此，按订阅可见范围投放（合规与版权由运营复核）。
      </div>

      <button
        v-for="k in list"
        :key="k.id"
        @click="store.openArticle('knowledge', k)"
        class="w-full text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-1.5 shadow-sm active:opacity-70"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <img v-if="k.imageUrls[0]" :src="k.imageUrls[0]" class="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
            <div v-else class="w-14 h-14 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0"><component :is="k.contentType === 'article' ? Newspaper : Video" class="w-6 h-6" /></div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold text-gray-900 leading-snug">{{ k.title }}</div>
              <div class="text-[11px] text-gray-400 mt-1">{{ roleLabel[k.authorRole] }} · {{ k.authorName }} · {{ k.contentType === 'article' ? '图文' : '视频' }}</div>
            </div>
          </div>
          <span @click.stop="doRemove(k.id, k.title)" class="text-gray-300 active:opacity-60 shrink-0"><Trash2 class="w-4 h-4" /></span>
        </div>
        <div v-if="k.summary" class="text-[12px] text-gray-500 leading-relaxed">{{ k.summary }}</div>
      </button>
    </div>
  </div>
</template>