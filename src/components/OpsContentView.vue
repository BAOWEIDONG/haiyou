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
        class="w-full text-left bg-white rounded-2xl overflow-hidden border border-white/70 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div class="relative h-36 bg-gradient-to-br from-[#8B5CF6]/10 to-purple-50">
          <img v-if="k.imageUrls[0]" :src="k.imageUrls[0]" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          <div v-else class="absolute inset-0 flex items-center justify-center text-[#8B5CF6]"><component :is="k.contentType === 'article' ? Newspaper : Video" class="w-10 h-10" /></div>
          <span class="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/85 text-[#8B5CF6]">{{ k.contentType === 'article' ? '图文' : '视频' }}</span>
          <span @click.stop="doRemove(k.id, k.title)" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center active:bg-black/60"><Trash2 class="w-4 h-4" /></span>
        </div>
        <div class="p-3">
          <div class="text-sm font-bold text-gray-900 truncate">{{ k.title }}</div>
          <div v-if="k.summary" class="text-[12px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{{ k.summary }}</div>
          <div class="text-[10px] text-gray-400 mt-1.5">{{ roleLabel[k.authorRole] }} · {{ k.authorName }} · {{ k.createdAt.slice(0, 10) }}</div>
        </div>
      </button>
    </div>
  </div>
</template>