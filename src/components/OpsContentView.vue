<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showConfirmDialog, showToast } from 'vant';
import { Newspaper, Plus, Trash2 } from 'lucide-vue-next';

const store = useAppStore();
const showAdd = ref(false);
const title = ref('');
const summary = ref('');
const authorRole = ref<'doctor' | 'dietitian' | 'coach'>('doctor');
const contentType = ref<'article' | 'video' | 'live'>('article');

const list = computed(() => store.knowledgeContents);
const roleLabel: Record<string, string> = { doctor: '医生', dietitian: '营养师', coach: '康复教练' };

const doRemove = (id: string, name: string) => {
  showConfirmDialog({
    title: '删除内容',
    message: `将删除「${name}」，已订阅用户将无法再查看。是否确认？`,
  }).then(() => {
    store.deleteKnowledgeContent(id);
    showToast('已删除');
  }).catch(() => {});
};

const doAdd = () => {
  if (!title.value.trim()) { showToast('请输入标题'); return; }
  store.addKnowledgeContent({
    title: title.value.trim(),
    summary: summary.value.trim(),
    imageUrls: [],
    authorRole: authorRole.value,
    authorName: store.user?.name || '运营',
    contentType: contentType.value,
    campIds: [],
  });
  showAdd.value = false;
  title.value = ''; summary.value = '';
  showToast('已发布');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="内容管理" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showAdd = true" class="flex items-center gap-1 text-sm font-bold text-[#8B5CF6]"><Plus class="w-4 h-4" /> 发布</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        知识库素材管理：图文/短视频/直播。医生、营养师、康复教练的内容统一在此，按订阅可见范围投放（合规与版权由运营复核）。
      </div>

      <div v-for="k in list" :key="k.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-1.5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-bold text-gray-900 leading-snug">{{ k.title }}</div>
            <div class="text-[11px] text-gray-400 mt-1">{{ roleLabel[k.authorRole] }} · {{ k.authorName }} · {{ k.contentType === 'article' ? '图文' : k.contentType === 'video' ? '视频' : '直播' }}</div>
          </div>
          <button @click="doRemove(k.id, k.title)" class="text-gray-300 hover:text-red-500 active:opacity-60 shrink-0"><Trash2 class="w-4 h-4" /></button>
        </div>
        <div class="text-[12px] text-gray-500 leading-relaxed">{{ k.summary }}</div>
      </div>
    </div>

    <VanPopup v-model:show="showAdd" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">发布健康知识</h3>
        <div class="flex gap-2">
          <button v-for="r in (['doctor','dietitian','coach'] as const)" :key="r" @click="authorRole = r"
            :class="['flex-1 py-2 rounded-xl text-[12px] font-bold border-2', authorRole === r ? 'border-[#8B5CF6] text-[#8B5CF6]' : 'border-gray-200 text-gray-500']">
            {{ roleLabel[r] }}
          </button>
        </div>
        <div class="flex gap-2">
          <button v-for="c in (['article','video','live'] as const)" :key="c" @click="contentType = c"
            :class="['flex-1 py-2 rounded-xl text-[12px] font-bold border-2', contentType === c ? 'border-[#8B5CF6] text-[#8B5CF6]' : 'border-gray-200 text-gray-500']">
            {{ c === 'article' ? '图文' : c === 'video' ? '视频' : '直播' }}
          </button>
        </div>
        <input v-model="title" placeholder="标题" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none" />
        <textarea v-model="summary" rows="3" placeholder="内容摘要" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none resize-none" />
        <button @click="doAdd" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认发布</button>
      </div>
    </VanPopup>
  </div>
</template>