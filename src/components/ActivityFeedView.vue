<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { StudentTabbar } from './ui';
import { Newspaper, PlayCircle, BookOpen } from 'lucide-vue-next';

/**
 * 学员端「活动」tab（原「健康」tab 改名）：科普图文/活动资讯信息流。
 * 内容 = 锻炼活动（教练发布）+ 健康科普（营养师发布的公众号式图文/视频，点击直达 ArticleDetailView）。
 * 2026-09-04 信息架构重构：原首页内嵌的「健康活动」信息流迁到独立 tab。
 */
const store = useAppStore();

const user = computed(() => store.user);

const feedTab = ref<'exercise' | 'knowledge'>('exercise');

const feedActivities = computed(() =>
  [...store.coachActivities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
);
const feedKnowledge = computed(() => store.knowledgeContents);

const ktypeMeta: Record<string, { label: string; cls: string; icon: any }> = {
  article: { label: '图文', cls: 'bg-[#0B6BCB]/10 text-[#0B6BCB]', icon: Newspaper },
  video: { label: '视频', cls: 'bg-purple-50 text-purple-500', icon: PlayCircle },
};

const feedEmpty = computed(() =>
  feedTab.value === 'exercise' ? feedActivities.value.length === 0 : feedKnowledge.value.length === 0,
);

const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <div class="pt-[calc(env(safe-area-inset-top)+2.5rem)] px-5 pb-2">
      <div class="flex items-center gap-1.5 text-xs font-bold text-[#0B6BCB]">
        <BookOpen class="w-4 h-4" /> 活动资讯
      </div>
      <h2 class="text-xl font-bold text-gray-900 mt-1">健康活动</h2>
      <p class="text-[11px] text-gray-500 mt-0.5">锻炼活动 · 健康科普 · 慢病管控科普</p>
    </div>

    <div class="px-5 pt-2">
      <div class="flex gap-2 mb-2">
        <button @click="feedTab = 'exercise'" :class="['px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors', feedTab === 'exercise' ? 'border-[#0B6BCB] text-[#0B6BCB] bg-white shadow-sm' : 'border-transparent text-gray-500 bg-white/60']">
          锻炼活动
        </button>
        <button @click="feedTab = 'knowledge'" :class="['px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors', feedTab === 'knowledge' ? 'border-[#0B6BCB] text-[#0B6BCB] bg-white shadow-sm' : 'border-transparent text-gray-500 bg-white/60']">
          健康科普
        </button>
      </div>
    </div>

    <div class="flex-1 px-5 space-y-3">
      <!-- 锻炼活动：图文预览卡片 -->
      <button
        v-if="feedTab === 'exercise'"
        v-for="a in feedActivities" :key="a.id"
        @click="store.openArticle('activity', a)"
        class="w-full text-left bg-white rounded-2xl overflow-hidden border border-white/70 shadow-sm active:scale-[0.99] active:bg-gray-50 transition-transform"
      >
        <div class="relative h-36 bg-gradient-to-br from-[#1677FF]/10 to-blue-50">
          <img v-if="a.imageUrls[0]" :src="a.imageUrls[0]" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <PlayCircle class="w-10 h-10 text-[#1677FF]/70" />
          </div>
          <span v-if="a.videoUrls && a.videoUrls.length" class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <PlayCircle class="w-3 h-3" /> 视频
          </span>
        </div>
        <div class="p-3">
          <div class="text-sm font-bold text-gray-900 truncate">{{ a.title }}</div>
          <div class="text-[12px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{{ a.description }}</div>
          <div class="text-[10px] text-gray-400 mt-1.5">{{ a.coachName }} · {{ a.date.slice(0, 10) }}</div>
        </div>
      </button>

      <!-- 健康科普：图文预览卡片 -->
      <button
        v-else
        v-for="k in feedKnowledge" :key="k.id"
        @click="store.openArticle('knowledge', k)"
        class="w-full text-left bg-white rounded-2xl overflow-hidden border border-white/70 shadow-sm active:scale-[0.99] active:bg-gray-50 transition-transform"
      >
        <div class="relative h-36 bg-gradient-to-br from-[#0B6BCB]/10 to-purple-50">
          <img v-if="k.imageUrls[0]" :src="k.imageUrls[0]" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <component :is="ktypeMeta[k.contentType].icon" class="w-10 h-10" />
          </div>
          <span :class="['absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded', ktypeMeta[k.contentType].cls]">{{ ktypeMeta[k.contentType].label }}</span>
        </div>
        <div class="p-3">
          <div class="text-sm font-bold text-gray-900 truncate">{{ k.title }}</div>
          <div class="text-[12px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{{ k.summary }}</div>
          <div class="text-[10px] text-gray-400 mt-1.5">{{ k.authorName }} · {{ k.createdAt.slice(0, 10) }}</div>
        </div>
      </button>

      <div v-if="feedEmpty" class="text-center text-xs text-gray-400 py-16">
        {{ feedTab === 'exercise' ? '暂无锻炼活动' : '暂无健康科普' }}
      </div>
    </div>

    <StudentTabbar anchor="activity" :badge="unreadCount > 0 ? unreadCount : undefined" />
  </div>
</template>