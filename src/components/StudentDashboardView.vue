<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { format } from 'date-fns';
import { useAppStore } from '../store/app';
import type { View } from '../store/app';
import { campDateRange } from '../lib/camps';
import { Card, GenderAvatar, StudentTabbar } from './ui';
import { Activity, Coffee, Scale, LogOut, Medal, BookOpen, MessageCircle, ChevronRight, ChevronDown, TrendingDown, TrendingUp, Minus, Target, X, Flame, PlayCircle, Newspaper, Radio } from 'lucide-vue-next';
import { Popup as VanPopup, showToast } from 'vant';
import { calculateStreak } from '../lib/streak';

const store = useAppStore();

const todayStr = format(new Date(), 'yyyy-MM-dd');
const isMine = (r: { studentId?: string }) => r.studentId === store.user?.id;

// ─── 核心数据带：体重变化 + 目标进度 ─────────────────────
// 慢病健康管理场景下，学员最关注的是"我瘦了多少 / 离目标还有多远"
const myWeightRecords = computed(() =>
  campWt.value.filter(isMine).sort((a, b) => a.date.localeCompare(b.date))
);
const latestWeightRecord = computed(() =>
  myWeightRecords.value.length > 0 ? myWeightRecords.value[myWeightRecords.value.length - 1] : null
);
const latestWeight = computed(() => latestWeightRecord.value?.weight ?? null);
const startWeight = computed(() =>
  myWeightRecords.value.length > 0 ? myWeightRecords.value[0].weight : null
);
const weightChange = computed(() => {
  if (latestWeight.value === null || startWeight.value === null) return null;
  return parseFloat((latestWeight.value - startWeight.value).toFixed(1));
});
const targetWeight = computed(() => store.user?.targetWeight ?? null);
// 距目标还差多少（正数=还需努力，≤0=已达标/超额）
// 方向感知：减重时 latest-target，增重时 target-latest，使 ≤0 恒等于已达标
const gapToTarget = computed(() => {
  if (latestWeight.value === null || targetWeight.value === null) return null;
  if (isWeightLoss.value) {
    // 减重：还需减多少
    return parseFloat((latestWeight.value - targetWeight.value).toFixed(1));
  }
  // 增重：还需增多少
  return parseFloat((targetWeight.value - latestWeight.value).toFixed(1));
});
// 目标进度百分比：(起始-当前) / (起始-目标)，支持减重和增重两种场景
const targetProgress = computed(() => {
  if (startWeight.value === null || latestWeight.value === null || targetWeight.value === null) return null;
  const total = startWeight.value - targetWeight.value;
  if (total === 0) return null; // 起始=目标时无意义
  const done = startWeight.value - latestWeight.value;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
});
// 目标方向：减重（目标<起始）或增重（目标>起始）
const isWeightLoss = computed(() => {
  if (startWeight.value === null || targetWeight.value === null) return true;
  return targetWeight.value < startWeight.value;
});
// 体重变化是否朝目标方向（null=无变化，true=向好绿色，false=逆向橙色）
const isWeightChangeGood = computed(() => {
  if (weightChange.value === null || weightChange.value === 0) return null;
  if (isWeightLoss.value) return weightChange.value < 0; // 减重：变轻为好
  return weightChange.value > 0; // 增重：变重为好
});

// ─── 服务批次切换器（多期时显示） ──────────────────────────────
const availableCamps = computed(() => store.user ? store.getStudentCamps(store.user.id) : []);
const activeCampId = computed(() => {
  if (store.selectedCampId && availableCamps.value.some(c => c.id === store.selectedCampId)) {
    return store.selectedCampId;
  }
  const active = availableCamps.value.find(c => c.status === 'active');
  return active?.id || availableCamps.value[0]?.id || null;
});
const activeCamp = computed(() => availableCamps.value.find(c => c.id === activeCampId.value) || null);
// 学员是否已退营/禁用（复用账户 active=false：禁用后该手机号无法登录；此处兜底已登录的存量会话）
const studentDisabled = computed(() => {
  const u = store.user;
  if (!u) return false;
  const acc = store.accounts.find((a) => a.id === u.id || a.phone === u.phone);
  return acc ? acc.active === false : false;
});
// 本服务批次可正常参与/主动弹通知（未开始、已结束、退营、禁用状态均不主动弹出）
const campActiveForStudent = computed(() => activeCamp.value?.status === 'active' && !studentDisabled.value);
const showCampSwitcher = computed(() => availableCamps.value.length > 1);
const showCampPicker = ref(false);
const handleCampSelect = (campId: string) => {
  store.selectedCampId = campId;
  showCampPicker.value = false;
};

// ─── 健康活动 tab 信息流（锻炼活动｜健康科普，首页平铺） ─────────────
const feedTab = ref<'exercise' | 'knowledge'>('exercise');
const feedActivities = computed(() =>
  [...(activeCampId.value ? store.getCampCoachActivities(activeCampId.value) : store.coachActivities)]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
);
const feedKnowledge = computed(() => store.knowledgeContents);
const ktypeMeta: Record<string, { label: string; cls: string; icon: any }> = {
  article: { label: '图文', cls: 'bg-[#0EA5E9]/10 text-[#0EA5E9]', icon: Newspaper },
  video: { label: '视频', cls: 'bg-purple-50 text-purple-500', icon: PlayCircle },
  live: { label: '直播', cls: 'bg-red-50 text-red-500', icon: Radio },
};
const feedEmpty = computed(() =>
  feedTab.value === 'exercise' ? feedActivities.value.length === 0 : feedKnowledge.value.length === 0,
);

// 按服务批次过滤打卡记录
const campDiet = computed(() => activeCampId.value ? store.getCampDietRecords(activeCampId.value) : store.dietRecords);
const campEx = computed(() => activeCampId.value ? store.getCampExerciseRecords(activeCampId.value) : store.exerciseRecords);
const campWt = computed(() => activeCampId.value ? store.getCampWeightRecords(activeCampId.value) : store.weightRecords);

// 消息未读数（与消息中心/活动/档案等各学员页底部「消息」Tab 角标口径一致：批注 + 系统通知）
const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);

const streakData = computed(() => calculateStreak(campEx.value, campDiet.value, campWt.value, store.user?.id));
const currentStreak = computed(() => streakData.value.currentStreak);

// 开班第几天（用于头部 DAY X 徽章）
const campDay = computed(() => {
  if (!activeCamp.value?.startDate) return 1;
  const start = new Date(activeCamp.value.startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diffDays);
});

// ─── 服务批次未开始：禁止打卡入口 ─────────────────────────────
const campNotStarted = computed(() => {
  if (!activeCamp.value) return false;
  return !store.isCampStarted(activeCamp.value);
});
// 未开始服务批次的权威状态（用于提示文案）：优先 status，其次按日期推断
const campNotStartedText = computed(() => {
  const camp = activeCamp.value;
  if (!camp) return '服务批次尚未开始';
  if (camp.startDate) {
    return `服务批次尚未开始（${camp.startDate} 开班），暂不能打卡`;
  }
  return '服务批次尚未开始，暂不能打卡';
});
// 打卡入口统一拦截：未开始时弹提示，不进入打卡页
function guardCheckin(view: View) {
  if (campNotStarted.value) {
    showToast(campNotStartedText.value);
    return;
  }
  store.setCurrentView(view);
}

// ---- 昨日小结卡（今天首次打开时展示） ----
const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
// 同步读取 localStorage，避免返回首页时弹窗闪现
const _dailySummaryKey = `daily_summary_${store.user?.id || 'anon'}_${todayStr}`;
const dailySummaryDismissed = ref(!!localStorage.getItem(_dailySummaryKey));

const dailySummary = computed(() => {
  if (!store.user) return null;
  // 未开始、已结束、退营、禁用状态不主动弹出（version2 PRD 2.1.1）
  if (!campActiveForStudent.value) return null;
  const meals = new Set(campDiet.value.filter((r) => isMine(r) && r.date.startsWith(yesterdayStr)).map((r) => r.meal));
  const exerciseMins = campEx.value
    .filter((r) => isMine(r) && r.date.startsWith(yesterdayStr))
    .reduce((sum, r) => sum + (r.duration || 0), 0);
  const weights = campWt.value.filter((r) => isMine(r)).sort((a, b) => a.date.localeCompare(b.date));
  const yesterdayWeight = weights.filter((r) => r.date.startsWith(yesterdayStr)).pop();
  // 昨日体重 vs 前一天最近一条
  let weightChange: number | null = null;
  if (yesterdayWeight) {
    const before = weights.filter((r) => r.date < yesterdayStr);
    const prev = before[before.length - 1];
    if (prev) weightChange = parseFloat((yesterdayWeight.weight - prev.weight).toFixed(1));
  }
  // 昨日收到的最新一条营养师批注
  const comments = [
    ...campDiet.value.filter((r) => isMine(r) && r.dietitianComment && (r.dietitianCommentDate || '').startsWith(yesterdayStr)),
    ...campEx.value.filter((r) => isMine(r) && r.coachComment && (r.coachCommentDate || '').startsWith(yesterdayStr)),
    ...campWt.value.filter((r) => isMine(r) && r.dietitianComment && (r.dietitianCommentDate || '').startsWith(yesterdayStr)),
  ].sort((a, b) => ((b as any).dietitianCommentDate || (b as any).coachCommentDate || '').localeCompare((a as any).dietitianCommentDate || (a as any).coachCommentDate || ''));
  const latestComment = comments[0] || null;

  const didSomething = meals.size > 0 || exerciseMins > 0 || !!yesterdayWeight;
  if (!didSomething && !latestComment) return null;
  return { mealCount: meals.size, exerciseMins, weightChange, comment: latestComment };
});

const showDailySummary = computed(() => dailySummary.value !== null && !dailySummaryDismissed.value);
// 昨日体重变化颜色（方向感知：增重时变重为好，减重时变轻为好）
const dailySummaryWeightColor = computed(() => {
  const wc = dailySummary.value?.weightChange;
  if (wc === null || wc === undefined || wc === 0) return 'text-gray-900';
  if (isWeightLoss.value) return wc < 0 ? 'text-[#0EA5E9]' : 'text-orange-500';
  return wc > 0 ? 'text-[#0EA5E9]' : 'text-orange-500';
});
const dismissDailySummary = () => {
  dailySummaryDismissed.value = true;
  localStorage.setItem(_dailySummaryKey, '1');
};

// ---- 今日打卡状态 ----
const todayExerciseDone = computed(() => campEx.value.some((r) => isMine(r) && r.date.startsWith(todayStr)));
const todayWeightDone = computed(() => campWt.value.some((r) => isMine(r) && r.date.startsWith(todayStr)));
const todayDietMeals = computed(() => {
  const meals = new Set(campDiet.value.filter((r) => isMine(r) && r.date.startsWith(todayStr)).map((r) => r.meal));
  return meals;
});
const todayDietDone = computed(() => todayDietMeals.value.size > 0);

// ---- 今日五项打卡环形进度（早餐/午餐/晚餐/运动/体重） ----
const todayProgress = computed(() => {
  let done = 0;
  if (todayDietMeals.value.has('breakfast')) done++;
  if (todayDietMeals.value.has('lunch')) done++;
  if (todayDietMeals.value.has('dinner')) done++;
  if (todayExerciseDone.value) done++;
  if (todayWeightDone.value) done++;
  return done;
});
const todayProgressTotal = 5;
const todayAllDone = computed(() => todayProgress.value >= todayProgressTotal);
// SVG 环形参数：r=22，周长 = 2πr ≈ 138.23
const RING_CIRCUMFERENCE = 2 * Math.PI * 22;
const ringDashOffset = computed(() => RING_CIRCUMFERENCE * (1 - todayProgress.value / todayProgressTotal));
const todayDietLabel = computed(() => {
  const count = todayDietMeals.value.size;
  if (count === 0) return '拍照上传';
  if (count >= 3) return '已完成 ✓';
  return `已记 ${count} 餐`;
});

// 卡片入场动画
const visibleCards = ref<number[]>([]);

onMounted(() => {
  const delays = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  delays.forEach((delay, idx) => {
    setTimeout(() => visibleCards.value.push(idx), delay);
  });
});
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F4F6F8] pb-28 font-sans relative">
    <!-- Dynamic Background Header -->
    <div class="relative pt-[calc(env(safe-area-inset-top)+2.5rem)] px-6 pb-8 bg-gradient-to-br from-[#0EA5E9] via-[#0284C7] to-[#0284C7] rounded-b-[32px] shadow-[0_10px_34px_-14px_rgba(14,165,233,0.5)] overflow-hidden">
      <div class="absolute -top-12 -right-12 w-64 h-64 bg-white/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-16 -left-10 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative z-10 flex justify-between items-center mb-6">
        <button v-if="showCampSwitcher" @click="showCampPicker = true" class="text-sm font-bold text-white flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-full backdrop-blur-md shrink-0 max-w-[65%] active:scale-95 transition-transform">
          <Medal class="h-4 w-4 text-amber-300 shrink-0" />
          <span class="truncate">{{ activeCamp?.name || '健康训练营' }}</span>
          <ChevronDown class="h-3 w-3 text-white/70 shrink-0" />
        </button>
        <h1 v-else class="text-sm font-bold text-white flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-full backdrop-blur-md shrink-0 max-w-[65%]">
          <Medal class="h-4 w-4 text-amber-300 shrink-0" />
          <span class="truncate">{{ activeCamp?.name || '健康训练营' }}</span>
        </h1>
        <button @click="store.logout()" class="text-white/95 hover:text-white transition-colors flex items-center gap-1 text-xs bg-white/15 px-3 py-1.5 rounded-full backdrop-blur-md shrink-0 ml-2">
          <LogOut class="h-3 w-3 shrink-0" /> 退出
        </button>
      </div>

      <div class="relative z-10 flex items-start space-x-4">
        <div class="h-16 w-16 rounded-full bg-white/95 p-1 shadow-lg shrink-0 overflow-hidden">
          <GenderAvatar :gender="store.user?.gender" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-2xl font-black text-white tracking-tight truncate">你好，{{ store.user?.name || '学员' }}</h2>
          <div class="flex items-start gap-2 mt-2">
            <span class="text-[11px] font-bold text-[#0EA5E9] bg-white px-2 py-0.5 rounded-full tracking-wide shrink-0 mt-0.5">DAY {{ campDay }}</span>
          </div>
        </div>
        <!-- 今日五项打卡环形进度 -->
        <div class="relative w-14 h-14 shrink-0 rounded-full bg-white/20 flex items-center justify-center cursor-pointer" title="今日打卡进度" @click="store.setCurrentView('calendar')">
          <svg viewBox="0 0 56 56" class="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              :stroke="todayAllDone ? '#F6C453' : '#ffffff'"
              stroke-width="5"
              stroke-linecap="round"
              :stroke-dasharray="RING_CIRCUMFERENCE"
              :stroke-dashoffset="ringDashOffset"
              class="ring-progress"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <template v-if="todayAllDone">
              <svg viewBox="0 0 12 12" class="w-4 h-4 check-pop"><path d="M2 6.5 L4.8 9 L10 3" fill="none" stroke="#F6C453" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-path" /></svg>
              <span class="text-[8px] font-bold text-white leading-none mt-0.5">完成</span>
            </template>
            <template v-else>
              <span class="text-xs font-black text-white leading-none">{{ todayProgress }}<span class="text-[9px] font-bold text-white/60">/5</span></span>
              <span class="text-[8px] text-white/70 leading-none mt-0.5">今日</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 px-5 pt-5 space-y-5 relative z-20">
      <!-- 体重 + 排名（2列卡片） -->
      <div class="grid grid-cols-2 gap-4 items-stretch">
        <!-- 最新体重卡（含体重变化 + 目标进度） -->
        <Card :class="['flex flex-col justify-center p-5 border-0 relative overflow-hidden h-full transition-all', campNotStarted ? 'cursor-not-allowed opacity-60 grayscale' : 'cursor-pointer hover:shadow-lg shadow-[0_4px_20px_-8px_rgba(15,23,42,0.14)]']" @click="guardCheckin('weight-checkin')">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#0EA5E9]/20 to-teal-100 rounded-full blur-2xl transform translate-x-1/4 -translate-y-1/4 z-0 pointer-events-none"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-1 mb-2">
              <Target class="w-4 h-4 text-[#0EA5E9] shrink-0" />
              <div class="text-xs text-gray-500 font-bold truncate">当前体重</div>
            </div>
            <div class="flex items-end gap-1">
              <span class="text-3xl font-black text-gray-900 tracking-tighter truncate">{{ latestWeight ?? '--' }}</span>
              <span class="text-sm mb-1 text-gray-500 font-medium shrink-0">kg</span>
            </div>
            <div v-if="weightChange !== null" :class="['text-[11px] font-bold mt-1.5 flex items-center gap-0.5', isWeightChangeGood === null ? 'text-gray-400' : isWeightChangeGood ? 'text-[#0EA5E9]' : 'text-orange-500']">
              <TrendingDown v-if="weightChange < 0" class="w-3 h-3" />
              <TrendingUp v-else-if="weightChange > 0" class="w-3 h-3" />
              <Minus v-else class="w-3 h-3" />
              较开班 {{ weightChange > 0 ? '+' : '' }}{{ weightChange }}kg
            </div>
            <div v-if="targetProgress !== null" class="mt-2">
              <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :class="isWeightLoss ? 'bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]' : 'bg-gradient-to-r from-[#1677FF] to-[#0958d9]'" :style="{ width: targetProgress + '%' }"></div>
              </div>
              <div class="text-[10px] text-gray-400 mt-1">
                <template v-if="gapToTarget !== null && gapToTarget <= 0">已达成{{ isWeightLoss ? '减重' : '增重' }}目标 🎉</template>
                <template v-else>距{{ isWeightLoss ? '减重' : '增重' }}目标 {{ Math.abs(gapToTarget) }}kg · {{ targetProgress }}%</template>
              </div>
            </div>
          </div>
        </Card>

        <!-- 连续坚持卡（个人化指标，无排名竞争） -->
        <Card class="flex flex-col justify-center p-5 cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.14)] relative overflow-hidden h-full" @click="store.setCurrentView('calendar')">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#0EA5E9]/15 to-teal-100 rounded-full blur-2xl transform translate-x-1/4 -translate-y-1/4 z-0 pointer-events-none"></div>
          <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div class="flex items-center gap-1 mb-2">
                <Flame class="w-4 h-4 text-[#0EA5E9] shrink-0" />
                <div class="text-xs text-gray-500 font-bold truncate">连续坚持</div>
              </div>
              <div class="flex items-end gap-1">
                <span class="text-[28px] font-black text-gray-900 tracking-tighter truncate">{{ currentStreak }}<span class="text-sm text-gray-400 font-medium mb-1"> 天</span></span>
              </div>
            </div>
            <div class="text-xs text-gray-500 font-medium mt-1 truncate">
              {{ currentStreak > 0 ? '保持节奏，健康每一天' : '今天开始，从打卡开始' }}
            </div>
            <div class="text-xs text-[#0EA5E9] font-bold mt-0.5 truncate">
              {{ todayAllDone ? '今日已全部完成 ✓' : '完成每日打卡，看见坚持的力量' }}
            </div>
          </div>
        </Card>
      </div>

      <!-- 每日打卡任务 -->
      <div>
        <h3 class="text-sm font-bold text-gray-900 mb-3 ml-1 flex items-center gap-1.5">
          <div class="w-1.5 h-4 bg-[#0EA5E9] rounded-full"></div>
          每日打卡任务
        </h3>
        <div class="grid grid-cols-3 gap-3">
          <Card :class="['flex flex-col items-center justify-center py-6 border-0 shadow-sm card-enter relative overflow-hidden transition-all', campNotStarted ? 'cursor-not-allowed opacity-60 grayscale' : 'cursor-pointer hover:ring-2 ring-[#0EA5E9] active:scale-[0.96]', visibleCards.includes(3) ? 'card-enter-active' : '']" @click="guardCheckin('exercise')">
            <div class="absolute -top-6 -right-4 w-24 h-24 bg-gradient-to-br from-[#0EA5E9]/12 to-green-50 rounded-full blur-2xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col items-center">
              <div :class="['w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm', campNotStarted ? 'bg-gray-200 text-gray-400' : todayExerciseDone ? 'bg-[#0EA5E9]/15 text-[#0EA5E9]' : 'bg-gradient-to-br from-[#0EA5E9] to-green-500 text-white animate-pulse hover:scale-110']">
                <Activity class="h-6 w-6" />
              </div>
              <div class="text-sm font-bold text-gray-900 mb-0.5">运动打卡</div>
              <div :class="['text-[10px]', campNotStarted ? 'text-gray-400' : todayExerciseDone ? 'text-[#0EA5E9] font-bold' : 'text-gray-400']">{{ campNotStarted ? '服务批次未开始' : (todayExerciseDone ? '已完成 ✓' : '记录消耗') }}</div>
            </div>
          </Card>

          <Card :class="['flex flex-col items-center justify-center py-6 border-0 shadow-sm card-enter relative overflow-hidden transition-all', campNotStarted ? 'cursor-not-allowed opacity-60 grayscale' : 'cursor-pointer hover:ring-2 ring-[#FF976A] active:scale-[0.96]', visibleCards.includes(4) ? 'card-enter-active' : '']" @click="guardCheckin('diet')">
            <div class="absolute -top-6 -right-4 w-24 h-24 bg-gradient-to-br from-[#FF976A]/12 to-orange-50 rounded-full blur-2xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col items-center">
              <div :class="['w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm', campNotStarted ? 'bg-gray-200 text-gray-400' : todayDietDone ? 'bg-[#FF976A]/15 text-[#FF976A]' : 'bg-gradient-to-br from-[#FF976A] to-orange-400 text-white animate-pulse hover:scale-110']">
                <Coffee class="h-6 w-6" />
              </div>
              <div class="text-sm font-bold text-gray-900 mb-0.5">饮食打卡</div>
              <div :class="['text-[10px]', campNotStarted ? 'text-gray-400' : todayDietDone ? 'text-[#0EA5E9] font-bold' : 'text-gray-400']">{{ campNotStarted ? '服务批次未开始' : todayDietLabel }}</div>
            </div>
          </Card>

          <Card :class="['flex flex-col items-center justify-center py-6 border-0 shadow-sm card-enter relative overflow-hidden transition-all', campNotStarted ? 'cursor-not-allowed opacity-60 grayscale' : 'cursor-pointer hover:ring-2 ring-[#1677FF] active:scale-[0.96]', visibleCards.includes(5) ? 'card-enter-active' : '']" @click="guardCheckin('weight-checkin')">
            <div class="absolute -top-6 -right-4 w-24 h-24 bg-gradient-to-br from-[#1677FF]/12 to-blue-50 rounded-full blur-2xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col items-center">
              <div :class="['w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm', campNotStarted ? 'bg-gray-200 text-gray-400' : todayWeightDone ? 'bg-[#1677FF]/15 text-[#1677FF]' : 'bg-gradient-to-br from-[#1677FF] to-blue-500 text-white animate-pulse hover:scale-110']">
                <Scale class="h-6 w-6" />
              </div>
              <div class="text-sm font-bold text-gray-900 mb-0.5">体重打卡</div>
              <div :class="['text-[10px]', campNotStarted ? 'text-gray-400' : todayWeightDone ? 'text-[#0EA5E9] font-bold' : 'text-gray-400']">{{ campNotStarted ? '服务批次未开始' : (todayWeightDone ? '已完成 ✓' : '见证蜕变') }}</div>
            </div>
          </Card>
        </div>
      </div>

      <!-- 健康服务（四小板块：报告解读 / 健康答疑 / 个人历程 / 健康活动[订阅+锻炼]） -->
      <!-- 健康活动（锻炼活动｜健康科普 tab 信息流，首页平铺） -->
      <div>
        <div class="flex items-center justify-between mb-1 mt-5">
          <h3 class="text-sm font-bold text-gray-900 ml-1 flex items-center gap-1.5">
            <div class="w-1.5 h-4 bg-[#0EA5E9] rounded-full"></div>
            健康活动
          </h3>
          <button @click="store.setCurrentView(feedTab === 'exercise' ? 'activities-list' : 'knowledge')" class="text-[11px] text-gray-400 font-medium flex items-center gap-0.5 shrink-0">
            查看全部
            <ChevronRight class="w-3 h-3" />
          </button>
        </div>

        <div class="flex gap-2 mb-3 px-1">
          <button @click="feedTab = 'exercise'" :class="['px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-colors', feedTab === 'exercise' ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white' : 'border-transparent text-gray-500 bg-white/60']">
            锻炼活动
          </button>
          <button @click="feedTab = 'knowledge'" :class="['px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-colors', feedTab === 'knowledge' ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white' : 'border-transparent text-gray-500 bg-white/60']">
            健康科普
          </button>
        </div>

        <div class="space-y-3">
          <!-- 锻炼活动：图文预览卡片 -->
          <button v-if="feedTab === 'exercise'" v-for="a in feedActivities" :key="a.id" @click="store.setCurrentView('activities-list')" class="w-full text-left bg-white rounded-2xl overflow-hidden border border-white/70 shadow-sm active:scale-[0.99] active:bg-gray-50 transition-transform">
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
          <button v-else v-for="k in feedKnowledge" :key="k.id" @click="store.setCurrentView('knowledge')" class="w-full text-left bg-white rounded-2xl overflow-hidden border border-white/70 shadow-sm active:scale-[0.99] active:bg-gray-50 transition-transform">
            <div class="relative h-36 bg-gradient-to-br from-[#0EA5E9]/10 to-purple-50">
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

          <div v-if="feedEmpty" class="text-center text-xs text-gray-400 py-8">
            {{ feedTab === 'exercise' ? '暂无锻炼活动' : '暂无健康科普' }}
          </div>
        </div>
      </div>

      </div>
    <StudentTabbar anchor="dashboard" :badge="unreadCount > 0 ? unreadCount : undefined" />

    <!-- 昨日小结弹层（今天首次打开时展示） -->
    <Teleport to="body">
      <Transition name="summary-fade">
        <div v-if="showDailySummary" class="fixed inset-0 z-[999] bg-black/40 flex items-end justify-center" @click.self="dismissDailySummary">
          <div class="w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 summary-slide-up">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-black text-gray-900 flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#0EA5E9] to-teal-500 flex items-center justify-center">
                  <BookOpen class="w-4 h-4 text-white" />
                </div>
                昨日小结
              </h3>
              <button @click="dismissDailySummary" class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
                <X class="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <!-- 三项数据 -->
            <div class="grid grid-cols-3 gap-2 mb-4">
              <div class="bg-orange-50 rounded-xl p-3 text-center">
                <Coffee class="w-4 h-4 text-[#FF976A] mx-auto mb-1" />
                <div class="text-lg font-black text-gray-900">{{ dailySummary!.mealCount }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">餐</span></div>
                <div class="text-[10px] text-gray-500">饮食打卡</div>
              </div>
              <div class="bg-green-50 rounded-xl p-3 text-center">
                <Activity class="w-4 h-4 text-[#0EA5E9] mx-auto mb-1" />
                <div class="text-lg font-black text-gray-900">{{ dailySummary!.exerciseMins }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">分钟</span></div>
                <div class="text-[10px] text-gray-500">运动时长</div>
              </div>
              <div class="bg-blue-50 rounded-xl p-3 text-center">
                <Scale class="w-4 h-4 text-[#1677FF] mx-auto mb-1" />
                <div v-if="dailySummary!.weightChange !== null" :class="['text-lg font-black', dailySummaryWeightColor]">
                  {{ dailySummary!.weightChange > 0 ? '+' : '' }}{{ dailySummary!.weightChange }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">kg</span>
                </div>
                <div v-else class="text-lg font-black text-gray-300">--</div>
                <div class="text-[10px] text-gray-500">体重变化</div>
              </div>
            </div>

            <!-- 营养师一句话 -->
            <div v-if="dailySummary!.comment" class="bg-[#0EA5E9]/5 border border-[#0EA5E9]/15 rounded-xl p-3 mb-4">
              <div class="flex items-center gap-1.5 mb-1">
                <MessageCircle class="w-3 h-3 text-[#0EA5E9]" />
                <span class="text-[10px] font-bold text-[#0EA5E9]">{{ (dailySummary!.comment as any).dietitianName || (dailySummary!.comment as any).coachName || '老师' }} 昨天对你说</span>
              </div>
              <p class="text-xs text-gray-700 leading-relaxed line-clamp-2">{{ (dailySummary!.comment as any).dietitianComment || (dailySummary!.comment as any).coachComment }}</p>
            </div>

            <button @click="dismissDailySummary" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white text-sm font-bold active:scale-[0.98] transition-transform shadow-lg shadow-[#0EA5E9]/20">
              开启今天 ->
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 服务批次选择弹窗 -->
    <VanPopup v-model:show="showCampPicker" position="bottom" round class="custom-popup">
      <div class="p-4">
        <h3 class="font-bold text-gray-900 text-base mb-3 text-center">选择服务批次</h3>
        <div class="space-y-2">
          <button
            v-for="camp in availableCamps"
            :key="camp.id"
            @click="handleCampSelect(camp.id)"
            :class="[
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
              activeCampId === camp.id
                ? 'border-[#0EA5E9] bg-green-50 text-[#0EA5E9]'
                : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50',
            ]"
          >
            <div>
              <div class="flex-1 text-left min-w-0"><span class="font-medium">{{ camp.name }}</span><div class="text-[10px] text-gray-400 mt-0.5">{{ campDateRange(camp) }}</div></div>
              <span v-if="camp.startDate && camp.endDate" class="text-xs text-gray-400 ml-2">{{ camp.startDate }} ~ {{ camp.endDate }}</span>
            </div>
            <span
              v-if="camp.status === 'active'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600"
            >进行中</span>
            <span
              v-else-if="camp.status === 'ended'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
            >已结束</span>
            <span
              v-else
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-500"
            >未开始</span>
          </button>
        </div>
      </div>
    </VanPopup>
  </div>
</template>

<style scoped>
/* 激励语：渐变流光效果 */
.motivational-gradient {
  background: linear-gradient(90deg, #0EA5E9, #1677FF, #FF976A, #F59E0B, #0EA5E9);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: motivationalShimmer 5s linear infinite;
}
@keyframes motivationalShimmer {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}
/* 闪烁星星脉动 */
.sparkle-pulse {
  animation: sparklePulse 2s ease-in-out infinite;
}
@keyframes sparklePulse {
  0%, 100% { opacity: 0.5; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-pop-in {
  animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.card-enter {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-enter-active {
  opacity: 1;
  transform: translateY(0);
}
/* 打卡完成勾：圆点弹入 + 对勾画线 */
@keyframes checkPop {
  0% { transform: scale(0); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
.check-pop {
  animation: checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.check-path {
  stroke-dasharray: 14;
  stroke-dashoffset: 14;
  animation: checkDraw 0.3s ease-out 0.2s forwards;
}
@keyframes checkDraw {
  to { stroke-dashoffset: 0; }
}
/* 今日进度环：平滑过渡 */
.ring-progress {
  transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease;
}
/* 昨日小结弹层 */
.summary-slide-up {
  animation: summaryUp 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
@keyframes summaryUp {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}
.summary-fade-enter-active,
.summary-fade-leave-active {
  transition: opacity 0.25s ease;
}
.summary-fade-enter-from,
.summary-fade-leave-to {
  opacity: 0;
}
</style>
