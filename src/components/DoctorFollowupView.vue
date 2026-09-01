<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { CalendarClock, Users, Plus, CheckCircle2 } from 'lucide-vue-next';
import type { FollowupTask } from '../types';

const store = useAppStore();
const open = computed(() => store.getOpenFollowups());
const done = computed(() => store.followupTasks.filter((t) => t.status === 'done' || t.status === 'missed'));

// 完成
const doneId = ref<string | null>(null);
const doneResult = ref('');
const showDone = ref(false);
// 新建
const showCreate = ref(false);
const createStudentId = ref('');
const createTitle = ref('');
const createDueDate = ref('');
const allStudents = computed(() => store.getAllStudents());

const openDone = (t: FollowupTask) => { doneId.value = t.id; doneResult.value = ''; showDone.value = true; };
const doDone = () => {
  if (doneId.value) store.completeFollowupTask(doneId.value, doneResult.value.trim());
  showDone.value = false;
  showToast('已标记完成');
};
const doCreate = () => {
  if (!createStudentId.value || !createTitle.value.trim() || !createDueDate.value) { showToast('请完整填写随访任务'); return; }
  store.addFollowupTask({
    studentId: createStudentId.value,
    title: createTitle.value.trim(),
    dueDate: createDueDate.value,
    doctorId: store.user?.id || 'doc1',
    doctorName: store.user?.name || '医生',
  });
  showCreate.value = false;
  createStudentId.value = ''; createTitle.value = ''; createDueDate.value = '';
  showToast('已创建随访任务，到点自动提醒用户');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F4F1FF] to-[#FDFBFF]">
    <NavBar title="随访计划" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showCreate = true" class="flex items-center gap-1 text-sm font-bold text-[#8B5CF6]"><Plus class="w-4 h-4" /> 新建</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        复查/复测等健康管理范畴的随访提醒；到点自动提醒用户。不做医疗随访/医疗处置跟进。
      </div>

      <div class="text-sm font-bold text-gray-900">待办 ({{ open.length }})</div>
      <template v-if="open.length > 0">
        <div v-for="t in open" :key="t.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4 space-y-2">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0"><CalendarClock class="h-5 w-5" /></div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ store.studentName(t.studentId) }}</div>
              <div class="text-[12px] text-gray-500">{{ t.title }}</div>
            </div>
            <div class="text-[11px] text-gray-400">截止 {{ t.dueDate }}</div>
          </div>
          <button @click="openDone(t)" class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">
            <CheckCircle2 class="w-4 h-4" /> 记录回填并完成
          </button>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-8 rounded-2xl bg-white/60">暂无待办随访</div>

      <template v-if="done.length > 0">
        <div class="text-sm font-bold text-gray-900 pt-2">已回填 ({{ done.length }})</div>
        <div v-for="t in done" :key="t.id" class="rounded-2xl bg-white/50 border border-gray-100 p-3 text-[12px] space-y-1">
          <div class="flex justify-between">
            <span class="font-bold text-gray-800">{{ store.studentName(t.studentId) }} · {{ t.title }}</span>
            <span class="text-gray-400">{{ t.dueDate }}</span>
          </div>
          <div class="text-gray-500">{{ t.result || (t.status === 'missed' ? '已过期未回填' : '—') }}</div>
        </div>
      </template>
    </div>

    <VanPopup v-model:show="showDone" position="bottom" round class="custom-popup">
      <div class="p-5">
        <h3 class="text-base font-bold text-gray-900 mb-4 text-center">记录回填</h3>
        <textarea v-model="doneResult" rows="3" placeholder="复测/复查结果回填…" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none resize-none mb-4" />
        <button @click="doDone" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认完成</button>
      </div>
    </VanPopup>

    <VanPopup v-model:show="showCreate" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">新建随访任务</h3>
        <select v-model="createStudentId" class="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none">
          <option value="">选择学员</option>
          <option v-for="s in allStudents" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <input v-model="createTitle" placeholder="任务名（如：复查血脂 / 复测体成分）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        <input v-model="createDueDate" type="date" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        <button @click="doCreate" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认创建</button>
      </div>
    </VanPopup>
  </div>
</template>