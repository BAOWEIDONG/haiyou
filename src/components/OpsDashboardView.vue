<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { DietitianTabbar } from './ui';
import { Building2, LogOut, Users, Package, UserCheck, BarChart3, Newspaper, PhoneCall, ShieldCheck } from 'lucide-vue-next';

const store = useAppStore();

const menus = [
  { key: 'account-manage', title: '团队与账号', desc: '上收建号：医生/营养师/教练', icon: Users, tone: 'bg-[#0EA5E9]/10 text-[#0EA5E9]' },
  { key: 'ops-service-pack', title: '服务包与权益', desc: '权益批次/有效期/服务范围', icon: Package, tone: 'bg-[#0EA5E9]/10 text-[#0EA5E9]' },
  { key: 'ops-users', title: '用户管理', desc: '激活/服务中/失效·异常标记', icon: UserCheck, tone: 'bg-[#FF976A]/10 text-[#FF976A]' },
  { key: 'enterprise-report', title: '企业履约看板', desc: '脱敏聚合：参与/活跃/达标', icon: BarChart3, tone: 'bg-[#8B5CF6]/10 text-[#8B5CF6]' },
  { key: 'ops-content', title: '内容管理', desc: '知识库·发布与订阅', icon: Newspaper, tone: 'bg-purple-100 text-purple-600' },
  { key: 'ops-referral-ledger', title: '私域转介台账', desc: '电话/微信线索·转介复盘', icon: PhoneCall, tone: 'bg-red-50 text-red-500' },
  { key: 'ops-compliance', title: '数据与合规', desc: '授权审计·脱敏·医疗边界', icon: ShieldCheck, tone: 'bg-gray-100 text-gray-600' },
];

const openReferralCount = computed(() => store.getOpenReferrals().length);
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col pb-24 font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <div class="pt-[calc(env(safe-area-inset-top)+1rem)] px-5 pb-4">
      <div class="flex justify-end mb-2">
        <button @click="store.logout()" class="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1 text-xs bg-white/50 px-2 py-1 rounded-full backdrop-blur-sm">
          <LogOut class="h-3 w-3" /> 退出
        </button>
      </div>
      <div class="flex items-center space-x-3">
        <div class="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-md shrink-0">
          <Building2 class="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">管理台</h2>
          <p class="text-xs text-gray-500 mt-0.5">{{ store.user?.name || '平台管理员' }} · 服务包与团队后台</p>
        </div>
      </div>
    </div>

    <div class="flex-1 px-5 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="m in menus"
          :key="m.key"
          @click="store.setCurrentView(m.key as never)"
          class="relative rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 text-left active:scale-[0.98] transition-transform shadow-sm"
        >
          <div v-if="m.key === 'ops-referral-ledger' && openReferralCount > 0" class="absolute -top-1.5 -right-1.5 min-w-[1.5rem] h-6 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
            {{ openReferralCount }}
          </div>
          <div :class="['w-9 h-9 rounded-xl flex items-center justify-center mb-2', m.tone]">
            <component :is="m.icon" class="w-5 h-5" />
          </div>
          <div class="text-sm font-bold text-gray-900">{{ m.title }}</div>
          <div class="text-[11px] text-gray-400 mt-0.5">{{ m.desc }}</div>
        </button>
      </div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed">
        管理台为平台后台（团队/服务包/看板/内容/合规）。个人健康数据默认脱敏，企业仅见聚合履约看板。
      </div>
    </div>

    <!-- Bottom Nav (shared 营养师 tabbar) -->
    <DietitianTabbar anchor="manage" printHidden />
  </div>
</template>