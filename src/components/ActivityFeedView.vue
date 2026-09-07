<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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

// 两个资讯 tab 的名称由营养师在「活动页设置」自定义（默认 锻炼活动/健康科普）
const tabs = computed(() => store.activityConfig.tabs);
const banners = computed(() => store.activityConfig.banners);

function openBanner(b: { title: string; image: string; url: string }) {
  if (b.url && /^https?:\/\//i.test(b.url)) window.open(b.url, '_blank');
}

// ---- Banner 居中轮播：约 3:1 自适应 · 相邻模糊提示 · 5s 自动 + 手动滑动 + 圆点；触摸暂停、静置 8s 恢复 ----
const bannerIndex = ref(0);
const bannerTrack = ref<HTMLElement | null>(null);
let autoTimer: number | undefined = undefined;
let resumeTimer: number | undefined = undefined;
let pausing = false;

/** 单张 slide 步进宽 = slide 宽 + 间隙（gap-3 = 12px） */
function bannerStep() {
  const el = bannerTrack.value;
  const first = el?.firstElementChild as HTMLElement | null;
  return first ? first.offsetWidth + 12 : 0;
}
function goBanner(i: number) {
  const n = banners.value.length;
  if (n <= 0 || !bannerTrack.value) return;
  const idx = ((i % n) + n) % n;
  bannerIndex.value = idx;
  bannerTrack.value.scrollTo({ left: idx * bannerStep(), behavior: 'smooth' });
}
function nextBanner() { goBanner(bannerIndex.value + 1); }
/** 手动滑动时按 scrollLeft 反推当前居中的 slide */
function onBannerScroll() {
  const el = bannerTrack.value;
  if (!el) return;
  const st = bannerStep();
  if (st <= 0) return;
  bannerIndex.value = Math.round(el.scrollLeft / st);
}
function startAutoBanner() {
  stopAutoBanner();
  autoTimer = window.setInterval(() => {
    if (pausing) return;
    nextBanner();
  }, 5000);
}
function stopAutoBanner() {
  if (autoTimer) window.clearInterval(autoTimer);
  autoTimer = undefined;
}
function pauseBanner() {
  pausing = true;
  stopAutoBanner();
  if (resumeTimer) window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(() => {
    pausing = false;
    startAutoBanner();
  }, 8000);
}
onMounted(() => startAutoBanner());
onBeforeUnmount(() => { stopAutoBanner(); if (resumeTimer) window.clearTimeout(resumeTimer); });

const feedActivities = computed(() =>
  [...store.coachActivities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
);
/** 萃取知识默认 knowledge（旧数据无 category）；按分类分发到两个 tab -- 与「活动页设置」两款分类名对应 */
const byCat = (c: 'exercise' | 'knowledge') =>
  computed(() => store.knowledgeContents.filter((k) => (k.category || 'knowledge') === c));
const feedExerciseKnowledge = byCat('exercise'); // 锻炼类科普 → 第一个 tab
const feedKnowledge = byCat('knowledge');        // 科普类 → 第二个 tab

const ktypeMeta: Record<string, { label: string; cls: string; icon: any }> = {
  article: { label: '图文', cls: 'bg-[#0B6BCB]/10 text-[#0B6BCB]', icon: Newspaper },
  video: { label: '视频', cls: 'bg-purple-50 text-purple-500', icon: PlayCircle },
};

const feedEmpty = computed(() =>
  feedTab.value === 'exercise'
    ? feedActivities.value.length === 0 && feedExerciseKnowledge.value.length === 0
    : feedKnowledge.value.length === 0,
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
      <p class="text-[11px] text-gray-500 mt-0.5">{{ tabs.exercise }} · {{ tabs.knowledge }} · 健康指标科普</p>
    </div>

    <!-- 顶部 Banner 运营位：约 3:1 自适应 · 与下方图文边缘对齐 · 相邻 slide 模糊提示 · 5s 自动轮播 + 手动滑动 + 圆点 -->
    <div v-if="banners.length" class="px-5 pt-2">
      <div
        ref="bannerTrack"
        class="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        @scroll.passive="onBannerScroll"
        @touchstart.passive="pauseBanner" @mousedown="pauseBanner"
      >
        <button
          v-for="(b, i) in banners" :key="b.id"
          @click="openBanner(b)"
          class="relative shrink-0 snap-center w-[86%] aspect-[3/1] rounded-2xl overflow-hidden text-left active:opacity-95 shadow-sm transition-all duration-500"
          :class="i === bannerIndex ? '' : 'opacity-80 scale-[0.96] blur-[5px]'"
        >
          <img loading="lazy" decoding="async" v-if="b.image" :src="b.image" class="absolute inset-0 w-full h-full object-cover" alt="" />
          <div v-else class="absolute inset-0 w-full h-full bg-gradient-to-br from-[#0B6BCB] to-[#12B5C2]"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-2.5 flex items-end justify-between">
            <span class="text-white text-[13px] font-bold drop-shadow truncate">{{ b.title }}</span>
            <span v-if="b.url" class="text-[9px] text-white/85 bg-black/25 rounded-full px-2 py-0.5 shrink-0 ml-2">查看 ›</span>
          </div>
        </button>
      </div>
      <!-- 圆点指示 -->
      <div class="flex items-center justify-center gap-1.5 mt-1">
        <button
          v-for="(b, i) in banners" :key="'d' + b.id"
          @click="goBanner(i)"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="i === bannerIndex ? 'w-5 bg-[#0B6BCB]' : 'w-1.5 bg-gray-300'"
        ></button>
      </div>
    </div>

    <div class="px-5 pt-2">
      <div class="flex gap-2 mb-2">
        <button @click="feedTab = 'exercise'" :class="['px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors', feedTab === 'exercise' ? 'border-[#0B6BCB] text-[#0B6BCB] bg-white shadow-sm' : 'border-transparent text-gray-500 bg-white/60']">
          {{ tabs.exercise }}
        </button>
        <button @click="feedTab = 'knowledge'" :class="['px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors', feedTab === 'knowledge' ? 'border-[#0B6BCB] text-[#0B6BCB] bg-white shadow-sm' : 'border-transparent text-gray-500 bg-white/60']">
          {{ tabs.knowledge }}
        </button>
      </div>
    </div>

    <div class="flex-1 px-5 space-y-3">
      <!-- 锻炼活动 / 锻炼类科普：图文预览卡片（第一个 tab 混排活动 + 锻炼类知识） -->
      <button
        v-if="feedTab === 'exercise'"
        v-for="a in feedActivities" :key="'act' + a.id"
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

      <!-- 健康科普（当前 tab 分类匹配）：图文预览卡片 -->
      <button
        v-for="k in (feedTab === 'exercise' ? feedExerciseKnowledge : feedKnowledge)" :key="k.id"
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