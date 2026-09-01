<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, StudentTabbar } from './ui';
import { Stethoscope, Leaf, Dumbbell, ShieldAlert, CalendarClock, FileSearch, MessageSquareText, Newspaper, PlayCircle, ClipboardList, ChevronRight } from 'lucide-vue-next';
import { ROLE_LABEL } from '../types';

const store = useAppStore();

const roleColor: Record<string, { bg: string; icon: any }> = {
  doctor: { bg: 'bg-[#0EA5E9]/10 text-[#0EA5E9]', icon: Stethoscope },
  dietitian: { bg: 'bg-[#1677FF]/10 text-[#1677FF]', icon: Leaf },
  coach: { bg: 'bg-[#FF976A]/10 text-[#FF976A]', icon: Dumbbell },
  ops: { bg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]', icon: ShieldAlert },
};

// 消息未读数（批注 + 系统通知，store 级统一口径；本页即底部「健康」Tab）
const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);

// 我的健康团队：当前服务的营养师/康复教练（医院×企业健康服务团队成员）
const myTeam = computed(() =>
  store.accounts.filter((a) => a.active && (a.role === 'dietitian' || a.role === 'coach')),
);

const risk = computed(() => (store.user ? store.getRiskPortrait(store.user.id) : undefined));
const nextFollowup = computed(() =>
  (store.user ? store.getStudentFollowups(store.user.id) : []).find((t) => t.status === 'open'),
);

// 单一服务入口：报告解读/答疑/锻炼/知识订阅 + 健康档案 统一悖口（与首页健康服务区块去重）
const services = [
  { key: 'interpretation-result', title: '报告健康解读', desc: '勾指标请营养师解读、看结论、追问', icon: FileSearch, tone: 'text-[#0EA5E9] bg-[#0EA5E9]/8' },
  { key: 'consult', title: '健康答疑', desc: '给健康顾问留言，索取电话/微信', icon: MessageSquareText, tone: 'text-[#0EA5E9] bg-[#0EA5E9]/8' },
  { key: 'activities-list', title: '锻炼活动', desc: '健康指导与教学', icon: PlayCircle, tone: 'text-[#1677FF] bg-[#1677FF]/8' },
  { key: 'knowledge', title: '健康知识订阅', desc: '营养师/康复教练科普图文视频', icon: Newspaper, tone: 'text-purple-600 bg-purple-50' },
  { key: 'health-profile', title: '我的健康档案', desc: '体检指标 · 上传报告 · 编辑档案', icon: ClipboardList, tone: 'text-[#FF976A] bg-[#FF976A]/8' },
];
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="我的健康服务" />

    <div class="flex-1 px-4 py-4 space-y-4" v-if="store.user">
      <!-- 我的健康团队 -->
      <div>
        <div class="text-sm font-bold text-gray-900 mb-2">我的健康团队</div>
        <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm divide-y divide-gray-50">
          <div v-for="m in myTeam" :key="m.id" class="flex items-center gap-3 p-3.5">
            <div :class="['w-10 h-10 rounded-full flex items-center justify-center shrink-0', roleColor[m.role].bg]">
              <component :is="roleColor[m.role].icon" class="h-5 w-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ m.name }}</div>
              <div class="text-[11px] text-gray-400">{{ ROLE_LABEL[m.role] }}</div>
            </div>
          </div>
          <div v-if="myTeam.length === 0" class="p-4 text-xs text-gray-400">暂无团队信息</div>
        </div>
      </div>

      <!-- 健康画像·风险分层（仅本人可见） -->
      <div>
        <div class="text-sm font-bold text-gray-900 mb-2">我的健康画像</div>
        <div v-if="risk" :class="['rounded-2xl border p-4 shadow-sm',
          risk.level === 'refer' ? 'bg-red-50 border-red-200 text-red-700' :
          risk.level === 'watch' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-green-700']">
          <div class="flex items-center gap-2 font-bold mb-1">
            <ShieldAlert class="w-4 h-4" />
            {{ risk.level === 'refer' ? '需重点关注的健康信号' : risk.level === 'watch' ? '需关注' : '整体平稳' }}
          </div>
          <ul class="list-disc pl-4 text-[12px] space-y-0.5">
            <li v-for="f in risk.flags" :key="f">{{ f }}</li>
          </ul>
          <div v-if="risk.level === 'refer'" class="mt-2 text-[11px] leading-relaxed">
            以上异常信号需线下医院进一步评估。已为你生成就医转介建议，医生会通过电话/微信与你确认。
          </div>
        </div>
        <div v-else class="text-xs text-gray-400 rounded-2xl bg-white/60 p-4">完善健康档案后，将生成你的健康画像与风险分层</div>
      </div>

      <!-- 下次提醒 -->
      <div v-if="nextFollowup" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 shadow-sm">
        <div class="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1">
          <CalendarClock class="w-4 h-4 text-[#8B5CF6]" /> 随访提醒
        </div>
        <div class="text-[13px] text-gray-700">{{ nextFollowup.title }}</div>
        <div class="text-[11px] text-gray-400 mt-1">建议完成日期：{{ nextFollowup.dueDate }}</div>
      </div>

      <!-- 服务入口 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 divide-y divide-gray-50 shadow-sm">
        <button v-for="s in services" :key="s.key" @click="store.setCurrentView(s.key as never)" class="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50">
          <div :class="['w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.tone]">
            <component :is="s.icon" class="h-5 w-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-gray-900">{{ s.title }}</div>
            <div class="text-[11px] text-gray-400">{{ s.desc }}</div>
          </div>
          <ChevronRight class="w-4 h-4 text-gray-300" />
        </button>
      </div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed">
        以上为健康管理与减重服务，不构成医疗诊断。健康指标异常将引导你就医（转介线下医院），由有资质的医生承接。
      </div>
    </div>

    <StudentTabbar anchor="health" :badge="unreadCount > 0 ? unreadCount : undefined" />
  </div>
</template>