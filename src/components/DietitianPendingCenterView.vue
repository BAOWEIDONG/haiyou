<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import ReportTranscribeView from './ReportTranscribeView.vue';
import DoctorInterpretationView from './DoctorInterpretationView.vue';
import { FileText, MessageCircleQuestion } from 'lucide-vue-next';

/**
 * 营养师端「健康待办」中心：把两件"待处理"汇总到一个入口（单横幅 → 两 tab）。
 *  - 待转录：学员上传的体检报告 → ReportTranscribeView（每份可展开录入操作按钮）
 *  - 待跟进：报告健康解读对话 → DoctorInterpretationView（待解读/追问未读优先）
 * 子视图内联时以 embedded 模式共享本页 NavBar + tab 切换，避免各自再套一层导航。
 * 由 DietitianDashboardView「报告待解读」横幅进入（view: dietitian-pending-center）。
 */
const store = useAppStore();

const tab = ref<'transcribe' | 'interpret'>('transcribe');

// ─── 各 tab 待办数（与横幅口径一致，只算可操作的） ───
const transcribeCount = computed(() =>
  store.getReportStudents().reduce((n, s) => n + s.reports.filter((r) => r.status === 'pending').length, 0),
);
const interpretCount = computed(() => store.getOpenInterpretations().length);
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-[#F7F8FA]">
    <NavBar title="健康待办" :on-back="() => store.goBack()">
      <template #right>
        <span class="text-[11px] text-gray-400">{{ store.user?.name || '营养师' }}</span>
      </template>
    </NavBar>

    <!-- 两 tab 切换 -->
    <div class="px-4 pt-3">
      <div class="flex bg-white/70 backdrop-blur-md p-1 rounded-xl shadow-sm border border-white/70">
        <button
          :class="['flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5', tab === 'transcribe' ? 'bg-[#0B6BCB] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900']"
          @click="tab = 'transcribe'"
        >
          <FileText class="w-4 h-4" />
          档案转录<template v-if="transcribeCount > 0"> ({{ transcribeCount }})</template>
        </button>
        <button
          :class="['flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5', tab === 'interpret' ? 'bg-[#0B6BCB] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900']"
          @click="tab = 'interpret'"
        >
          <MessageCircleQuestion class="w-4 h-4" />
          解读跟进<template v-if="interpretCount > 0"> ({{ interpretCount }})</template>
        </button>
      </div>
    </div>

    <!-- 转录 / 解读 面板（embedded：子视图不再显示自身 NavBar，改由本页承载）；全空时给出空态引导 -->
    <div class="flex-1 flex flex-col min-h-0">
      <template v-if="transcribeCount + interpretCount > 0">
        <ReportTranscribeView v-if="tab === 'transcribe'" embedded class="flex-1" />
        <DoctorInterpretationView v-else embedded class="flex-1" />
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
        <div class="h-14 w-14 rounded-full bg-[#0B6BCB]/8 flex items-center justify-center mb-3">
          <MessageCircleQuestion class="h-7 w-7 text-[#0B6BCB]/50" />
        </div>
        <div class="text-sm font-bold text-gray-700">暂无待处理事项</div>
        <div class="text-xs text-gray-400 mt-1.5 leading-relaxed">
          学员上传体检报告后会出现「档案转录」待办；<br />
          学员发起报告解读申请后会出现「解读跟进」待办
        </div>
      </div>
    </div>
  </div>
</template>