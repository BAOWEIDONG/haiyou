<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { DietitianTabbar } from './ui';
import {
  Settings, LogOut, FileSearch, MessageSquareText, Users, Package, BarChart3, Newspaper, Activity, ShieldCheck,
} from 'lucide-vue-next';

/**
 * 营养师端「配置」tab（服务/管理/配置三段融合）。医生端+运营端已并入营养师。
 * 只保留被学员端实际消费的后台功能：解读/答疑（对应用户报告解读/健康答疑）、
 * 账户/服务包/企业看板/科普（对应用户登录/服务批次/订阅）、健康档案指标（对应用户体检档案）。
 * 与学员端无关的孤立后台（转介/随访/线索台账/用户画像/合规/结业统计）已删除。
 */
const store = useAppStore();

const pendingInterpretations = computed(() => store.getPendingInterpretations().length);
const pendingThreads = computed(() => store.getPendingThreads().length);

interface ConfigItem {
  view: string;
  title: string;
  desc: string;
  icon: typeof Settings;
  color: string;
  badge?: number;
}

// 服务（对应用户端报告解读 + 健康答疑）
const serviceItems = computed<ConfigItem[]>(() => [
  { view: 'doctor-interpretation', title: '报告健康解读', desc: '解答用户勾选的体检指标', icon: FileSearch, color: '#0EA5E9', badge: pendingInterpretations.value },
  { view: 'doctor-consult', title: '健康答疑', desc: '回复用户的健康留言', icon: MessageSquareText, color: '#0EA5E9', badge: pendingThreads.value },
]);

// 管理（平台后台：用户登录所需账户 / 服务批次 / 企业履约 / 科普订阅）
const manageItems: ConfigItem[] = [
  { view: 'account-manage', title: '账户管理', desc: '各角色手机号与服务批次', icon: Users, color: '#FF976A' },
  { view: 'ops-service-pack', title: '服务包与权益', desc: '权益批次/有效期/服务范围', icon: Package, color: '#FF976A' },
  { view: 'enterprise-report', title: '企业履约看板', desc: '脱敏聚合：参与/活跃/达标', icon: BarChart3, color: '#8B5CF6' },
  { view: 'ops-content', title: '科普内容', desc: '发布健康科普/视频/直播', icon: Newspaper, color: '#8B5CF6' },
];

// 配置（对应用户端健康档案/打卡）
const configItems: ConfigItem[] = [
  { view: 'metric-config', title: '健康档案指标', desc: '体检指标项与参考区间', icon: Activity, color: '#FF976A' },
];
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F7F8FA] pb-24 font-sans">
    <div class="pt-[calc(env(safe-area-inset-top)+2.5rem)] px-6 pb-6 bg-gradient-to-b from-[#FF976A]/10 to-[#F7F8FA]">
      <div class="flex justify-end mb-2">
        <button @click="store.logout()" class="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1 text-xs bg-white/50 px-2 py-1 rounded-full backdrop-blur-sm">
          <LogOut class="h-3 w-3" /> 退出
        </button>
      </div>
      <div class="flex items-center space-x-3">
        <div class="h-12 w-12 rounded-xl bg-[#FF976A] flex items-center justify-center shadow-md shrink-0">
          <Settings class="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-gray-900">服务与配置</h2>
          <p class="text-xs text-gray-500 mt-0.5">解读/答疑 · 健康团队后台 · 档案配置</p>
        </div>
      </div>
    </div>

    <div class="flex-1 px-5 pt-2 space-y-6">
      <!-- 服务 -->
      <div>
        <h3 class="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <div class="w-1.5 h-4 bg-[#0EA5E9] rounded-full"></div>服务
        </h3>
        <div class="space-y-3">
          <button v-for="s in serviceItems" :key="s.view" @click="store.setCurrentView(s.view as never)"
            class="relative w-full flex items-center gap-3 p-4 text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm active:scale-[0.98] transition-transform">
            <div v-if="s.badge" class="absolute -top-1.5 -right-1.5 min-w-[1.5rem] h-6 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
              {{ s.badge }}
            </div>
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" :style="{ background: s.color + '18' }">
              <component :is="s.icon" class="h-6 w-6" :style="{ color: s.color }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ s.title }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ s.desc }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        </div>
      </div>

      <!-- 管理 -->
      <div>
        <h3 class="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <div class="w-1.5 h-4 bg-[#8B5CF6] rounded-full"></div>管理
        </h3>
        <div class="space-y-3">
          <button v-for="s in manageItems" :key="s.view" @click="store.setCurrentView(s.view as never)"
            class="w-full flex items-center gap-3 p-4 text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm active:scale-[0.98] transition-transform">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" :style="{ background: s.color + '18' }">
              <component :is="s.icon" class="h-6 w-6" :style="{ color: s.color }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ s.title }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ s.desc }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        </div>
      </div>

      <!-- 配置 -->
      <div>
        <h3 class="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <div class="w-1.5 h-4 bg-[#FF976A] rounded-full"></div>配置
        </h3>
        <div class="space-y-3">
          <button v-for="s in configItems" :key="s.view" @click="store.setCurrentView(s.view as never)"
            class="w-full flex items-center gap-3 p-4 text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm active:scale-[0.98] transition-transform">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" :style="{ background: s.color + '18' }">
              <component :is="s.icon" class="h-6 w-6" :style="{ color: s.color }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ s.title }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{{ s.desc }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        </div>
      </div>

      <div class="rounded-xl bg-white/50 border border-gray-100 p-3 text-[11px] text-gray-400 leading-relaxed flex gap-2">
        <ShieldCheck class="w-4 h-4 shrink-0 mt-0.5" />
        平台提供健康管理，不做诊疗。指标异常一律引导转介线下医院，由有资质的医院/医生承接；健康数据默认脱敏。
      </div>
    </div>

    <!-- Bottom Nav (shared 营养师 tabbar) -->
    <DietitianTabbar anchor="config" printHidden />
  </div>
</template>