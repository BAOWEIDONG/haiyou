<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, StudentTabbar } from './ui';
import { FileSearch, MessageSquareText, BookOpen, ClipboardList, ChevronRight } from 'lucide-vue-next';

const store = useAppStore();

// 消息未读数（store 级统一口径；本页即底部「健康」Tab）
const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);

// 健康服务统一入口（首页不重复展示，统一由此进入；锻炼/知识订阅在首页「健康活动」信息流平铺）
const services = [
  { key: 'interpretation-result', title: '报告健康解读', desc: '勾指标请营养师解读、看结论、追问', icon: FileSearch, tone: 'text-[#0EA5E9] bg-[#0EA5E9]/8' },
  { key: 'consult', title: '健康答疑', desc: '给健康顾问留言，索取电话/微信', icon: MessageSquareText, tone: 'text-[#0EA5E9] bg-[#0EA5E9]/8' },
  { key: 'personal-journey', title: '个人历程', desc: '服务记录 · 报告 · 数据趋势', icon: BookOpen, tone: 'text-[#FF976A] bg-[#FF976A]/8' },
  { key: 'health-profile', title: '我的健康档案', desc: '体检指标 · 上传报告 · 编辑档案', icon: ClipboardList, tone: 'text-[#1677FF] bg-[#1677FF]/8' },
];
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="健康服务" />

    <div class="flex-1 px-4 py-4 space-y-3" v-if="store.user">
      <div class="space-y-3">
        <button v-for="s in services" :key="s.key" @click="store.setCurrentView(s.key as never)" class="w-full flex items-center gap-3 p-4 text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm active:scale-[0.98] transition-transform active:bg-white">
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center shrink-0', s.tone]">
            <component :is="s.icon" class="h-6 w-6" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-gray-900">{{ s.title }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ s.desc }}</div>
          </div>
          <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
        </button>
      </div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed">
        以上为健康管理与减重服务，不构成医疗诊断。健康指标异常将引导你就医（转介线下医院），由有资质的医生承接。
      </div>
    </div>

    <StudentTabbar anchor="health" :badge="unreadCount > 0 ? unreadCount : undefined" />
  </div>
</template>