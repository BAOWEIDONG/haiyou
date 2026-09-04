<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar, Card } from './ui';
import { CHRONIC_FIELDS, CHRONIC_GROUPS } from '../lib/chronic';
import { ChevronRight, FileText, CheckCheck, Save, Eye } from 'lucide-vue-next';
import { showToast } from 'vant';
import type { StudentReport } from '../types';

/**
 * 营养师端「健康档案转录」：学员上传体检报告 → 营养师查看材料 → 录入结构化指标，归纳为个人健康档案。
 * 由 DietitianDashboardView 的横幅进入（view: report-transcribe）。
 */
const store = useAppStore();

const reportStudents = computed(() => store.getReportStudents());

// 当前展开转录的报告
const editingId = ref<string | null>(null);
const formValues = ref<Record<string, number | undefined>>({});
const formNote = ref('');

const genders: Record<string, string> = { male: '男', female: '女' };

/** 转录表单只列出需要录入的检测字段（display=true；排除身高体重非检测项） */
const formGroups = CHRONIC_GROUPS.map((g) => ({
  g,
  fields: CHRONIC_FIELDS.filter((f) => f.group === g.key && f.display && f.key !== 'bmi'),
})).filter((x) => x.fields.length > 0);

/** 取某报告已录入的 values，作为再次编辑的预填 */
function openTranscribe(r: StudentReport) {
  editingId.value = editingId.value === r.id ? null : r.id;
  if (editingId.value === r.id) {
    const v: Record<string, number | undefined> = {};
    for (const grp of formGroups) for (const f of grp.fields) v[f.key] = r.values?.[f.key] ?? undefined;
    formValues.value = v;
    formNote.value = r.note || '';
  }
}

const editingReport = computed(() => reportStudents.value.flatMap((s) => s.reports).find((r) => r.id === editingId.value) || null);

function previewImages(r: StudentReport) {
  const imgs = r.images.filter((i) => i.type === 'image').map((i) => i.url).filter(Boolean);
  if (imgs.length) store.openImagePreview(imgs, 0);
  const pdf = r.images.find((i) => i.type === 'pdf');
  if (pdf) window.open(pdf.url, '_blank');
}

function saveTranscribe() {
  const rep = editingReport.value;
  if (!rep) return;
  const values: Record<string, number | undefined> = {};
  let any = false;
  for (const grp of formGroups) for (const f of grp.fields) {
    const raw = formValues.value[f.key];
    if (raw != null) {
      values[f.key] = Number(raw);
      if (!Number.isNaN(Number(raw))) any = true;
    }
  }
  if (!any && !formNote.value.trim()) {
    showToast('请至少录入一项指标或填写解读结论');
    return;
  }
  // 录入结构化指标 + 解读结论，状态 待解读→已录入
  store.transcribeReport(rep.id, values as any, formNote.value, store.user?.name || '营养师');
  showToast('已录入健康档案');
  editingId.value = null;
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F7F8FA] pb-10 font-sans">
    <NavBar title="健康档案转录" :on-back="store.goBack" />

    <div class="p-4 space-y-3">
      <div class="bg-[#0B6BCB]/5 border-l-2 border-[#0B6BCB] rounded-r-lg p-3 text-xs text-gray-600 leading-relaxed">
        学员上传的体检报告在此解读并录入结构化指标，形成每位学员的健康档案。录入后学员端「健康档案」即时可见。
      </div>

      <div v-if="reportStudents.length === 0" class="text-center text-xs text-gray-400 py-16">
        暂无学员上传体检报告
      </div>

      <!-- 每位有报告的学员 -->
      <Card v-for="stu in reportStudents" :key="stu.student.id" class="p-0 overflow-hidden shadow-sm border border-gray-100">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-gray-900 truncate">{{ stu.student.name }}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">
              {{ genders[stu.student.gender || ''] || '' }}{{ stu.student.age ? ` · ${stu.student.age}岁` : '' }}{{ stu.student.phone ? ` · ${stu.student.phone}` : '' }}
            </div>
          </div>
          <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', stu.reports.some((r) => r.status === 'pending') ? 'bg-amber-50 text-amber-600' : 'bg-[#0B6BCB]/10 text-[#0B6BCB]']">
            {{ stu.reports.some((r) => r.status === 'pending') ? '待解读' : '已录入' }}
          </span>
        </div>

        <div class="divide-y divide-gray-50">
          <div v-for="r in stu.reports" :key="r.id" class="px-4">
            <button
              @click="openTranscribe(r)"
              class="w-full flex items-center gap-3 py-3 text-left active:bg-gray-50 rounded-lg"
            >
              <div class="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <FileText v-if="!r.images.some((i) => i.type === 'image')" class="w-4 h-4 text-[#0B6BCB]" />
                <img loading="lazy" decoding="async" v-else :src="r.images.find((i) => i.type === 'image')?.url" class="w-full h-full object-cover rounded-lg" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  {{ r.date }}
                  <span :class="['px-1.5 py-px rounded text-[9px] font-bold', r.status === 'done' ? 'bg-[#0B6BCB]/10 text-[#0B6BCB]' : 'bg-amber-50 text-amber-600']">{{ r.status === 'done' ? '已录入' : '待解读' }}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5">{{ r.images.length }} 个文件{{ r.interpretedBy ? ` · ${r.interpretedBy}` : '' }}<template v-if="r.interpretedAt"> · {{ r.interpretedAt }}</template></div>
              </div>
              <CheckCheck v-if="r.status === 'done'" class="w-3.5 h-3.5 text-[#0B6BCB] shrink-0" />
              <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
            </button>

            <!-- 展开的转录面板 -->
            <div v-if="editingId === r.id" class="pb-4">
              <div class="rounded-xl bg-[#0B6BCB]/[0.03] border border-[#0B6BCB]/15 p-3.5">
                <button @click="previewImages(r)" class="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#0B6BCB]/20 rounded-lg text-[#0B6BCB] text-xs font-bold active:opacity-80 mb-3">
                  <Eye class="w-4 h-4" /> 查看报告材料
                </button>

                <div v-for="grp in formGroups" :key="grp.g.key" class="mb-3.5">
                  <div class="text-[11px] font-bold text-gray-500 mb-2">{{ grp.g.title }}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div v-for="f in grp.fields" :key="f.key" class="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-2.5 py-2">
                      <div class="flex-1 min-w-0 pr-2">
                        <div class="text-[10px] text-gray-400 leading-tight">{{ f.label }}</div>
                        <div class="text-[9px] text-gray-300">{{ f.range }}</div>
                      </div>
                      <div class="flex items-center gap-1">
                        <input
                          v-model.number="formValues[f.key]"
                          type="number" inputmode="decimal"
                          placeholder="--"
                          class="w-16 text-right text-sm tabular-nums outline-none bg-transparent text-gray-800"
                        />
                        <span class="text-[9px] text-gray-400 whitespace-nowrap">{{ f.unit }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <textarea
                  v-model="formNote"
                  rows="3"
                  placeholder="解读结论 / 补充说明（如：血压偏高，建议门诊复查；注意饮食控盐）"
                  class="w-full rounded-lg border border-gray-200 text-sm p-2.5 outline-none focus:border-[#0B6BCB] resize-none"
                ></textarea>

                <button
                  @click="saveTranscribe"
                  class="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0B6BCB] text-white text-sm font-bold active:opacity-85"
                >
                  <Save class="w-4 h-4" /> 保存并录入健康档案
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>