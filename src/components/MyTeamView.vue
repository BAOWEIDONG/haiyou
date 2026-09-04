<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, StudentTabbar } from './ui';
import { FileSearch, MessageSquareText, BookOpen, ClipboardList, ChevronRight } from 'lucide-vue-next';

const store = useAppStore();

// 消息未读数（store 级统一口径；本页即底部「我的」Tab）
const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);

// 个人功能统一入口（原来的「健康服务」hub；底部导航改造后改名「我的」承载个人功能）
// 锻炼/知识订阅在首页「健康活动」信息流平铺；慢病六指标在底部「健康」tab 看台
// 每项带专属浅色渐变 + 图标色块 + 水印，竖排整宽展示
const services = [
  {
    key: 'interpretation-result', title: '报告健康解读', desc: '勾指标请营养师解读、看结论、追问',
    icon: FileSearch, grad: 'from-[#0B6BCB]/16 via-white/40 to-white/0',
    iconColor: 'bg-[#0B6BCB]/12 text-[#0B6BCB]', wm: 'text-[#0B6BCB]/12',
  },
  {
    key: 'consult', title: '健康答疑', desc: '给健康顾问留言，索取电话/微信',
    icon: MessageSquareText, grad: 'from-[#12B5C2]/16 via-white/40 to-white/0',
    iconColor: 'bg-[#12B5C2]/12 text-[#12B5C2]', wm: 'text-[#12B5C2]/12',
  },
  {
    key: 'health-profile', title: '我的健康档案', desc: '体检指标 · 上传报告 · 编辑档案',
    icon: ClipboardList, grad: 'from-[#6366F1]/16 via-white/40 to-white/0',
    iconColor: 'bg-[#6366F1]/12 text-[#6366F1]', wm: 'text-[#6366F1]/12',
  },
  {
    key: 'personal-journey', title: '个人历程', desc: '服务记录 · 报告 · 数据趋势',
    icon: BookOpen, grad: 'from-[#FF976A]/20 via-white/40 to-white/0',
    iconColor: 'bg-[#FF976A]/15 text-[#FF976A]', wm: 'text-[#FF976A]/14',
  },
];
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="我的" />

    <div class="flex-1 px-4 py-4 space-y-3" v-if="store.user">
      <div class="grid grid-cols-1 gap-3">
        <button
          v-for="s in services" :key="s.key"
          @click="store.setCurrentView(s.key as never)"
          class="relative overflow-hidden rounded-2xl border border-white/70 shadow-sm p-4 flex items-center gap-4 bg-gradient-to-br active:opacity-90 transition-opacity"
          :class="s.grad"
        >
          <!-- 右下水印大图标 -->
          <component :is="s.icon" :class="['absolute -right-2 -bottom-3 w-24 h-24', s.wm]" />
          <!-- 图标色块 -->
          <div :class="['w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', s.iconColor]">
            <component :is="s.icon" class="h-6 w-6" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[15px] font-bold text-gray-800 leading-snug">{{ s.title }}</div>
            <div class="text-[11px] text-gray-500 mt-1 leading-relaxed">{{ s.desc }}</div>
          </div>
          <ChevronRight class="w-5 h-5 text-gray-300 shrink-0" />
        </button>
      </div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed">
        以上为健康管理与减重服务，不构成医疗诊断。健康指标异常将引导你就医（转介线下医院），由有资质的医生承接。
      </div>
    </div>

    <StudentTabbar anchor="mine" :badge="unreadCount > 0 ? unreadCount : undefined" />
  </div>
</template>