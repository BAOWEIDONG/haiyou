<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { ShieldCheck, Lock, UserCheck, FileCheck, AlertTriangle } from 'lucide-vue-next';

const store = useAppStore();

const authorized = computed(() =>
  store.accounts.filter((a) => a.role === 'student').length,
);
const staffRoles = computed(() =>
  store.accounts.filter((a) => a.active && (a.role === 'doctor' || a.role === 'dietitian' || a.role === 'coach' || a.role === 'ops')).length,
);

const boundary = [
  { do: '健康减重方案：饮食/运动/康复指导', not: '在线问诊 / 病情判断' },
  { do: '健康咨询：留言答疑、健康常识、减重建议', not: '处方（开药/开检查/治疗建议）' },
  { do: '报告健康解读：减重成效、指标趋势、生活习惯建议', not: '医疗诊断：判定/诊断疾病' },
  { do: '指标趋势异常 → 转介建议就医（线下医院/HCP）', not: '平台下医嘱 / 直接医疗处置' },
  { do: '减重随访提醒、复查提醒（健康管理范畴）', not: '医疗随访 / 医疗处置跟进' },
];
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="数据与合规" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-4">
      <!-- 数据治理状态 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 shadow-sm">
          <div class="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center mb-2"><FileCheck class="h-4 w-4" /></div>
          <div class="text-xl font-bold text-gray-900">{{ authorized }}</div>
          <div class="text-[11px] text-gray-400">已授权健康档案的用户</div>
        </div>
        <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 shadow-sm">
          <div class="w-8 h-8 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center mb-2"><UserCheck class="h-4 w-4" /></div>
          <div class="text-xl font-bold text-gray-900">{{ staffRoles }}</div>
          <div class="text-[11px] text-gray-400">服务团队账号（含运营）</div>
        </div>
      </div>

      <!-- 治理原则 -->
      <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-2.5 shadow-sm">
        <div class="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1"><ShieldCheck class="w-4 h-4 text-[#8B5CF6]" /> 数据与隐私治理</div>
        <ul class="text-[12px] text-gray-600 space-y-2 leading-relaxed">
          <li class="flex gap-2"><Lock class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />个人健康数据<b>默认脱敏</b>，仅授权团队可见；企业只见聚合履约看板（参与/活跃/达标占比），无个人明细。</li>
          <li class="flex gap-2"><UserCheck class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />员工授权可控：可查、可撤销健康授权。</li>
          <li class="flex gap-2"><FileCheck class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />系统可取证：操作留痕、授权审计、只读脱敏。</li>
        </ul>
      </div>

      <!-- 业务资质红线 -->
      <div class="rounded-2xl bg-amber-50 border border-amber-200 p-4 shadow-sm">
        <div class="flex items-center gap-2 text-sm font-bold text-amber-700 mb-2"><AlertTriangle class="w-4 h-4" /> 业务资质红线</div>
        <div class="text-[11px] text-amber-700/80 mb-2 leading-relaxed">
          平台无医疗资质，只做<b>健康管理，不做诊疗</b>。健康营内一切互动限定在「健康减重」非医疗范畴。
        </div>
        <div class="space-y-1.5">
          <div v-for="(b, i) in boundary" :key="i" :class="['rounded-lg p-2.5 text-[11px] flex gap-2', i % 2 ? 'bg-white/70' : 'bg-white/40']">
            <span class="text-green-600 font-bold shrink-0">✓ 做 · {{ b.do }}</span>
            <span class="text-red-500 shrink-0">/ 不做 · {{ b.not }}</span>
          </div>
        </div>
        <div class="mt-2 text-[11px] text-amber-700/80 leading-relaxed">
          凡触及"疾病判断 / 处方 / 在线问诊"的，一律引导转介线下医院，由有资质医院/医生承接。
        </div>
      </div>
    </div>
  </div>
</template>