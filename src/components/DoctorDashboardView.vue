<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar as VanNavBar, Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant';
import {
  LogOut, FileSearch, MessageSquareText, ShieldAlert, CalendarClock, Users,
} from 'lucide-vue-next';

const store = useAppStore();

const pendingInterpretations = computed(() => store.getPendingInterpretations());
const pendingThreads = computed(() => store.getPendingThreads());
const openReferrals = computed(() => store.getOpenReferrals());
const openFollowups = computed(() => store.getOpenFollowups());

const teamCount = computed(() =>
  store.accounts.filter((a) => a.active && (a.role === 'doctor' || a.role === 'dietitian' || a.role === 'coach')).length,
);

const queues = computed(() => [
  {
    key: 'interpretation',
    label: '待健康解读',
    desc: '用户勾选指标请求解读',
    count: pendingInterpretations.value.length,
    tone: 'from-[#0EA5E9] to-[#0284C7]',
    bar: 'text-[#0EA5E9]',
    target: 'doctor-interpretation',
  },
  {
    key: 'consult',
    label: '待回复答疑',
    desc: '异步健康留言（非实时）',
    count: pendingThreads.value.length,
    tone: 'from-[#0EA5E9] to-[#0284C7]',
    bar: 'text-[#0EA5E9]',
    target: 'doctor-consult',
  },
  {
    key: 'referral',
    label: '异常预警·转介',
    desc: '需处置就医转介',
    count: openReferrals.value.length,
    tone: 'from-[#EF4444] to-[#DC2626]',
    bar: 'text-red-500',
    target: 'doctor-referral',
  },
  {
    key: 'followup',
    label: '随访计划',
    desc: '待办复查/复测',
    count: openFollowups.value.length,
    tone: 'from-[#8B5CF6] to-[#7C3AED]',
    bar: 'text-[#8B5CF6]',
    target: 'doctor-followup',
  },
]);

const open = (target: string) => store.setCurrentView(target as never);
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <div class="pt-[calc(env(safe-area-inset-top)+1rem)] px-5 pb-4">
      <div class="flex justify-end mb-2">
        <button @click="store.logout()" class="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1 text-xs bg-white/50 px-2 py-1 rounded-full backdrop-blur-sm">
          <LogOut class="h-3 w-3" /> 退出
        </button>
      </div>
      <div class="flex items-center space-x-3">
        <div class="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] flex items-center justify-center shadow-md shrink-0">
          <Users class="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">医生您好，{{ store.user?.name || '专家' }}</h2>
          <p class="text-xs text-gray-500 mt-0.5">减重健康管理团队 · {{ teamCount }} 人协同</p>
        </div>
      </div>
    </div>

    <div class="flex-1 px-5 space-y-3">
      <!-- 工作台待办队列（按风险/时效排序） -->
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="q in queues"
          :key="q.key"
          @click="open(q.target)"
          class="relative rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 text-left active:scale-[0.98] transition-transform shadow-sm"
        >
          <div v-if="q.count > 0" class="absolute -top-1.5 -right-1.5 min-w-[1.5rem] h-6 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
            {{ q.count }}
          </div>
          <div :class="['w-9 h-9 rounded-xl flex items-center justify-center mb-2 text-white shadow-sm bg-gradient-to-br', q.tone]">
            <FileSearch v-if="q.key === 'interpretation'" class="w-5 h-5" />
            <MessageSquareText v-else-if="q.key === 'consult'" class="w-5 h-5" />
            <ShieldAlert v-else-if="q.key === 'referral'" class="w-5 h-5" />
            <CalendarClock v-else class="w-5 h-5" />
          </div>
          <div :class="['text-base font-bold text-gray-900', q.bar]">{{ q.label }}</div>
          <div class="text-[11px] text-gray-400 mt-0.5">{{ q.desc }}</div>
        </button>
      </div>

      <!-- 团队协同 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 shadow-sm">
        <div class="text-sm font-bold text-gray-900 mb-2">团队协同分工</div>
        <ul class="space-y-2 text-[12px] text-gray-600 leading-relaxed">
          <li class="flex gap-2"><span class="text-[#0EA5E9] font-bold">医生 ·</span>报告健康解读、异步答疑、异常预警处置、随访、科普</li>
          <li class="flex gap-2"><span class="text-[#0EA5E9] font-bold">营养师 ·</span>饮食方案 + 饮食执行反馈</li>
          <li class="flex gap-2"><span class="text-[#FF976A] font-bold">康复教练 ·</span>运动/康复处方 + 执行反馈 + 康复教学</li>
        </ul>
        <div class="mt-3 rounded-xl bg-blue-50 border border-blue-100 p-3 text-[11px] text-gray-500 leading-relaxed">
          平台提供健康管理，不做诊疗。指标异常一律引导转介线下医院，由有资质的医院/医生承接。
        </div>
      </div>
    </div>

    <VanTabbar class="custom-tabbar tabbar-blue" :model-value="0">
      <VanTabbarItem>
        <template #icon><Users class="h-6 w-6" /></template>
        工作台
      </VanTabbarItem>
      <VanTabbarItem @click="open('doctor-interpretation')">
        <template #icon><FileSearch class="h-6 w-6" /></template>
        解读
      </VanTabbarItem>
      <VanTabbarItem @click="open('doctor-consult')">
        <template #icon><MessageSquareText class="h-6 w-6" /></template>
        答疑
      </VanTabbarItem>
      <VanTabbarItem @click="open('doctor-referral')">
        <template #icon><ShieldAlert class="h-6 w-6" /></template>
        预警
      </VanTabbarItem>
      <VanTabbarItem @click="open('doctor-followup')">
        <template #icon><CalendarClock class="h-6 w-6" /></template>
        随访
      </VanTabbarItem>
    </VanTabbar>
  </div>
</template>