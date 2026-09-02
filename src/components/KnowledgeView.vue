<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { PlayCircle, Newspaper, Radio, Activity, Lock } from 'lucide-vue-next';

const store = useAppStore();
const filter = ref<'all' | 'article' | 'video' | 'live'>('all');

const list = computed(() => {
  const all = store.knowledgeContents;
  if (filter.value === 'all') return all;
  return all.filter((k) => k.contentType === filter.value);
});

const typeMeta: Record<string, { label: string; cls: string; icon: any }> = {
  article: { label: '图文', cls: 'bg-[#0EA5E9]/10 text-[#0EA5E9]', icon: Newspaper },
  video: { label: '视频', cls: 'bg-purple-50 text-purple-500', icon: PlayCircle },
  live: { label: '直播', cls: 'bg-red-50 text-red-500', icon: Radio },
};
const roleLabel: Record<string, string> = { doctor: '医生', dietitian: '营养师', coach: '康复教练' };
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="健康科普" :on-back="() => store.goBack()" />
    <div class="sticky top-0 z-40 bg-gradient-to-b from-[#E9F7FF] to-transparent px-4 pb-2 pt-2">
      <div class="flex gap-2">
        <button v-for="f in (['all','article','video','live'] as const)" :key="f" @click="filter = f"
          :class="['px-3 py-1.5 rounded-full text-[12px] font-bold border-2', filter === f ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white' : 'border-transparent text-gray-500 bg-white/60']">
          {{ f === 'all' ? '全部' : typeMeta[f].label }}
        </button>
      </div>
    </div>

    <div class="flex-1 px-4 py-3 space-y-3">
      <template v-if="list.length > 0">
        <div v-for="k in list" :key="k.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 shadow-sm space-y-2">
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', typeMeta[k.contentType].cls]">
                  <component :is="typeMeta[k.contentType].icon" class="w-3 h-3" />{{ typeMeta[k.contentType].label }}
                </span>
                <span class="text-[10px] text-gray-400">{{ roleLabel[k.authorRole] }} · {{ k.authorName }}</span>
              </div>
              <div class="text-sm font-bold text-gray-900 leading-snug">{{ k.title }}</div>
              <div class="text-[12px] text-gray-500 mt-1 leading-relaxed">{{ k.summary }}</div>
            </div>
          </div>
          <div class="text-[10px] text-gray-300">{{ k.createdAt.slice(0, 10) }}</div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-14">暂无相关内容</div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed flex gap-2">
        <Lock class="w-4 h-4 shrink-0 mt-0.5" />
        以上为健康科普与减重建议，供订阅用户学习参考，不构成医疗诊断与处方。
      </div>
    </div>
  </div>
</template>