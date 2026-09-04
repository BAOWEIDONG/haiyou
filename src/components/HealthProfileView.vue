<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '../store/app';
import { uploadFile } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { NavBar, Card, StudentTabbar } from './ui';
import { Activity, FileText, ClipboardList, UploadCloud, X, Pencil, ChevronRight } from 'lucide-vue-next';
import { Popup as VanPopup, TimePicker as VanTimePicker } from 'vant';
import { CHRONIC_GROUPS, judgeRecord, fieldDef, LEVEL_META, type AlarmLevel } from '../lib/chronic';
import type { StudentReport } from '../types';

const store = useAppStore();

// 消息未读数（批注 + 系统通知，store 级统一，与各学员页「消息」Tab 角标一致）
const unreadCount = computed(() =>
  store.user?.role === 'student' ? store.getStudentMsgUnreadCount(store.user.id) : 0,
);

// ─── 体检报告 / 健康档案（学员上传 → 营养师转录结构化指标） ─────────
const reports = computed(() => (store.user ? store.getStudentReports(store.user.id) : []));
const doneReports = computed(() => reports.value.filter((r) => r.status === 'done'));
/** 已解读报告的结构化字段，按指标族分组（仅列有值字段；判定复用慢病口径） */
function transcribedGroups(values: any): { g: { key: string; title: string }; fields: { key: string; label: string; unit: string; range: string; value: number; level: AlarmLevel }[] }[] {
  if (!values) return [];
  const judge = judgeRecord(values, store.user?.gender);
  return CHRONIC_GROUPS.map((g) => {
    const fields = judge.fields
      .filter((f) => fieldDef(f.key).group === (g.key as any))
      .map((f) => ({ key: f.key as string, label: f.label, unit: f.unit, range: fieldDef(f.key).range, value: f.value, level: f.level }));
    return { g, fields };
  }).filter((x) => x.fields.length > 0);
}

const nowStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
function openReportImg(r: StudentReport) {
  const pdf = r.images.find((i) => i.type === 'pdf');
  if (pdf) { window.open(pdf.url, '_blank'); return; }
  const urls = r.images.filter((i) => i.type === 'image').map((i) => i.url).filter(Boolean);
  if (urls.length) store.openImagePreview(urls, 0);
}

const qData = ref<any>(null);
const showUploadModal = ref(false);
const pendingReports = ref<{ url: string; type: 'image' | 'pdf'; name?: string }[]>([]);
const uploadInputRef = ref<HTMLInputElement | null>(null);

// 编辑状态
const showEditBasic = ref(false);
const showEditLifestyle = ref(false);
const editForm = ref<any>({});

// 规范化旧版问卷数据（统一选项值）
function normalizeQData(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  // 兼容旧版 snack 值
  if (d.snack === '很少') d.snack = '否';
  else if (d.snack === '经常') d.snack = '是';
  // 兼容旧版 drinkAlcohol/smoke 值
  if (d.drinkAlcohol === '无') d.drinkAlcohol = '从不';
  if (d.smoke === '无') d.smoke = '从不';
  return d;
}

onMounted(() => {
  const saved = localStorage.getItem('submitted_questionnaire') || localStorage.getItem('draft_questionnaire');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      qData.value = normalizeQData(parsed.formData || parsed);
    } catch (e) {
      // ignore
    }
  }
});

function persistQuestionnaire(data: any) {
  try {
    localStorage.setItem('submitted_questionnaire', JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

const handleUploadReport = () => {
  pendingReports.value = [];
  showUploadModal.value = true;
};

const handleModalFileSelect = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
  if (files.length === 0) return;
  const newReports = await Promise.all(
    files.map(async (f) => ({
      url: await uploadFile(await compressImage(f)),
      type: (f.type === 'application/pdf' ? 'pdf' : 'image') as 'image' | 'pdf',
      name: f.name,
    })),
  );
  pendingReports.value = [...pendingReports.value, ...newReports];
  (e.target as HTMLInputElement).value = '';
};

const handleConfirmUpload = () => {
  if (pendingReports.value.length === 0) return;
  if (!store.user) return;
  store.addStudentReport({
    studentId: store.user.id,
    title: '体检报告',
    images: pendingReports.value,
    date: nowStr(),
  });
  pendingReports.value = [];
  showUploadModal.value = false;
};

const removePendingReport = (idx: number) => {
  pendingReports.value = pendingReports.value.filter((_, i) => i !== idx);
};

// ─── 编辑功能 ─────────────────────────────────────
function openEditBasic() {
  editForm.value = {
    gender: store.user?.gender || 'male',
    height: qData.value?.height || '',
    weight: qData.value?.weight || '',
    hasChronic: qData.value?.hasChronic || '无',
    chronicDetails: qData.value?.chronicDetails || '',
    hasSpecialDiet: qData.value?.hasSpecialDiet || '无',
    specialDietDetails: qData.value?.specialDietDetails || '',
    hasFoodAllergy: qData.value?.hasFoodAllergy || '无',
    foodAllergyDetails: qData.value?.foodAllergyDetails || '',
  };
  showEditBasic.value = true;
}

function openEditLifestyle() {
  const types = qData.value?.exerciseTypes;
  editForm.value = {
    sleepTime: qData.value?.sleepTime || '',
    wakeTime: qData.value?.wakeTime || '',
    sleepDuration: qData.value?.sleepDuration || '',
    drinkAlcohol: qData.value?.drinkAlcohol || '从不',
    smoke: qData.value?.smoke || '从不',
    snack: qData.value?.snack || '否',
    dailyWater: qData.value?.dailyWater || '',
    exerciseFrequency: qData.value?.exerciseFrequency || '',
    exerciseDuration: qData.value?.exerciseDuration || '',
    exerciseTypesStr: Array.isArray(types) ? types.join(', ') : (types || ''),
  };
  showEditLifestyle.value = true;
}

function saveBasic() {
  // 更新性别到 store（同步 user + students + localStorage）
  if (editForm.value.gender && editForm.value.gender !== store.user?.gender) {
    store.updateUserProfile({ gender: editForm.value.gender });
  }
  const newQData = { ...(qData.value || {}), ...editForm.value };
  // 清理：如果选"无"，清空详情
  if (newQData.hasChronic === '无') newQData.chronicDetails = '';
  if (newQData.hasSpecialDiet === '无') newQData.specialDietDetails = '';
  if (newQData.hasFoodAllergy === '无') newQData.foodAllergyDetails = '';
  qData.value = newQData;
  persistQuestionnaire(newQData);
  showEditBasic.value = false;
}

function saveLifestyle() {
  const typesStr = editForm.value.exerciseTypesStr || '';
  const types = typesStr.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
  const newQData = {
    ...(qData.value || {}),
    sleepTime: editForm.value.sleepTime,
    wakeTime: editForm.value.wakeTime,
    sleepDuration: editForm.value.sleepDuration,
    drinkAlcohol: editForm.value.drinkAlcohol,
    smoke: editForm.value.smoke,
    snack: editForm.value.snack,
    dailyWater: editForm.value.dailyWater,
    exerciseFrequency: editForm.value.exerciseFrequency,
    exerciseDuration: editForm.value.exerciseDuration,
    exerciseTypes: types,
  };
  qData.value = newQData;
  persistQuestionnaire(newQData);
  showEditLifestyle.value = false;
}

// ─── 时间选择器 ───────────────────────────────────
const showTimePicker = ref(false);
const timePickerField = ref<'sleepTime' | 'wakeTime'>('sleepTime');
const timePickerValue = ref<string[]>(['23', '00']);

function openTimePicker(field: 'sleepTime' | 'wakeTime') {
  timePickerField.value = field;
  const current = editForm.value[field] || '';
  if (current && current.includes(':')) {
    timePickerValue.value = current.split(':');
  } else {
    timePickerValue.value = field === 'sleepTime' ? ['23', '00'] : ['07', '00'];
  }
  showTimePicker.value = true;
}

function onTimePickerConfirm({ selectedValues }: { selectedValues: string[] }) {
  editForm.value[timePickerField.value] = selectedValues.join(':');
  showTimePicker.value = false;
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-[#F7F8FA] pb-28 font-sans">
    <!-- 上传报告弹窗 -->
    <VanPopup v-model:show="showUploadModal" position="center" closeable close-icon-position="top-right" class="custom-popup">
      <div class="p-5 max-h-[85vh]">
        <h3 class="font-bold text-gray-900 mb-3">上传个人医疗报告</h3>
        <p class="text-xs text-gray-500 mb-3">可上传体检报告图片或 PDF，支持拍照或本地选择。</p>
        <input ref="uploadInputRef" type="file" accept="image/*,application/pdf" multiple class="hidden" @change="handleModalFileSelect" />
        <button @click="uploadInputRef?.click()" class="w-full py-6 border-2 border-dashed border-[#0B6BCB]/40 bg-[#0B6BCB]/5 rounded-xl text-[#0B6BCB] flex flex-col items-center gap-1 hover:bg-[#0B6BCB]/10 transition-colors">
          <UploadCloud class="w-6 h-6" />
          <span class="text-xs">点击选择文件 / 拍照</span>
        </button>
        <div v-if="pendingReports.length > 0" class="grid grid-cols-3 gap-2 mt-3">
          <div v-for="(r, idx) in pendingReports" :key="idx" class="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-200">
            <div v-if="r.type === 'pdf'" class="w-full min-h-full flex flex-col items-center justify-center bg-gray-50 text-[#0B6BCB]">
              <FileText class="w-6 h-6 mb-1" />
              <span class="text-[9px] text-gray-500 truncate px-1">{{ r.name || 'PDF' }}</span>
            </div>
            <img loading="lazy" decoding="async" v-else :src="r.url" alt="预览" class="w-full min-h-full object-cover" />
            <button @click="removePendingReport(idx)" class="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white"><X class="w-3 h-3" /></button>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button @click="showUploadModal = false; pendingReports = []" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm">取消</button>
          <button @click="handleConfirmUpload" :disabled="pendingReports.length === 0" class="flex-1 py-2 rounded-lg bg-[#0B6BCB] text-white text-sm disabled:opacity-50">确定上传</button>
        </div>
      </div>
    </VanPopup>

    <!-- 编辑基础与健康信息弹窗 -->
    <VanPopup v-model:show="showEditBasic" position="bottom" round closeable close-icon-position="top-right" class="custom-popup" :style="{ maxHeight: '85vh' }">
      <div class="p-5 pb-8">
        <h3 class="font-bold text-gray-900 mb-4 text-center">编辑基础与健康信息</h3>
        <div class="space-y-4">
          <!-- 性别 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">性别</label>
            <div class="flex gap-2">
              <button v-for="opt in [{ v: 'male', l: '男' }, { v: 'female', l: '女' }]" :key="opt.v" @click="editForm.gender = opt.v"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.gender === opt.v ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt.l }}</button>
            </div>
          </div>
          <!-- 身高 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">身高 (cm)</label>
            <input v-model="editForm.height" type="number" inputmode="decimal" placeholder="请输入身高"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
          <!-- 体重 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">体重 (kg)</label>
            <input v-model="editForm.weight" type="number" inputmode="decimal" placeholder="请输入体重"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
          <!-- 疾病史 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">疾病史 / 慢性疾病</label>
            <div class="flex gap-2 mb-2">
              <button v-for="opt in ['无', '有']" :key="opt" @click="editForm.hasChronic = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.hasChronic === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
            <input v-if="editForm.hasChronic === '有'" v-model="editForm.chronicDetails" type="text" placeholder="请描述疾病详情"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
          <!-- 特殊饮食 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">特殊饮食</label>
            <div class="flex gap-2 mb-2">
              <button v-for="opt in ['无', '有']" :key="opt" @click="editForm.hasSpecialDiet = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.hasSpecialDiet === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
            <input v-if="editForm.hasSpecialDiet === '有'" v-model="editForm.specialDietDetails" type="text" placeholder="请描述特殊饮食要求"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
          <!-- 过敏史 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">过敏史 / 食物过敏</label>
            <div class="flex gap-2 mb-2">
              <button v-for="opt in ['无', '有']" :key="opt" @click="editForm.hasFoodAllergy = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.hasFoodAllergy === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
            <input v-if="editForm.hasFoodAllergy === '有'" v-model="editForm.foodAllergyDetails" type="text" placeholder="请描述过敏源"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] focus:ring-1 focus:ring-[#0B6BCB]/20 outline-none" />
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showEditBasic = false" class="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm">取消</button>
          <button @click="saveBasic" class="flex-1 py-2.5 rounded-lg bg-[#0B6BCB] text-white text-sm font-medium">保存</button>
        </div>
      </div>
    </VanPopup>

    <!-- 编辑生活与运动习惯弹窗 -->
    <VanPopup v-model:show="showEditLifestyle" position="bottom" round closeable close-icon-position="top-right" class="custom-popup" :style="{ maxHeight: '85vh' }">
      <div class="p-5 pb-8 overflow-y-auto">
        <h3 class="font-bold text-gray-900 mb-4 text-center">编辑生活与运动习惯</h3>
        <div class="space-y-4">
          <!-- 作息时间 -->
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="text-sm text-gray-500 mb-1 block">就寝</label>
              <button type="button" @click="openTimePicker('sleepTime')"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none flex items-center justify-between">
                <span :class="editForm.sleepTime ? 'text-gray-900' : 'text-gray-400'">{{ editForm.sleepTime || '选择时间' }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <div>
              <label class="text-sm text-gray-500 mb-1 block">起床</label>
              <button type="button" @click="openTimePicker('wakeTime')"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none flex items-center justify-between">
                <span :class="editForm.wakeTime ? 'text-gray-900' : 'text-gray-400'">{{ editForm.wakeTime || '选择时间' }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <div>
              <label class="text-sm text-gray-500 mb-1 block">时长(h)</label>
              <input v-model="editForm.sleepDuration" type="number" inputmode="decimal" placeholder="如 8"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
            </div>
          </div>
          <!-- 饮酒 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">饮酒</label>
            <div class="flex gap-2">
              <button v-for="opt in ['从不', '偶尔', '经常']" :key="opt" @click="editForm.drinkAlcohol = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.drinkAlcohol === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
          </div>
          <!-- 吸烟 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">吸烟</label>
            <div class="flex gap-2">
              <button v-for="opt in ['从不', '偶尔', '经常', '已戒']" :key="opt" @click="editForm.smoke = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.smoke === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
          </div>
          <!-- 零食 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">经常吃零食</label>
            <div class="flex gap-2">
              <button v-for="opt in ['否', '是']" :key="opt" @click="editForm.snack = opt"
                :class="['flex-1 py-2 rounded-lg text-sm border transition-colors', editForm.snack === opt ? 'border-[#0B6BCB] bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium' : 'border-gray-200 text-gray-600']">{{ opt }}</button>
            </div>
          </div>
          <!-- 日饮水量 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">日饮水量 (ml)</label>
            <input v-model="editForm.dailyWater" type="number" inputmode="numeric" placeholder="如 2000"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
          </div>
          <!-- 运动频率和时长 -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-sm text-gray-500 mb-1 block">每周运动次数</label>
              <input v-model="editForm.exerciseFrequency" type="number" inputmode="numeric" placeholder="如 3"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
            </div>
            <div>
              <label class="text-sm text-gray-500 mb-1 block">每次时长(分钟)</label>
              <input v-model="editForm.exerciseDuration" type="number" inputmode="numeric" placeholder="如 30"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
            </div>
          </div>
          <!-- 运动类型 -->
          <div>
            <label class="text-sm text-gray-500 mb-1 block">运动类型 (逗号分隔)</label>
            <input v-model="editForm.exerciseTypesStr" type="text" placeholder="如 跑步, 游泳, 瑜伽"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-[#0B6BCB] outline-none" />
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showEditLifestyle = false" class="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm">取消</button>
          <button @click="saveLifestyle" class="flex-1 py-2.5 rounded-lg bg-[#0B6BCB] text-white text-sm font-medium">保存</button>
        </div>
      </div>
    </VanPopup>

    <NavBar title="健康档案" :on-back="store.goBack">
      <template #right>
        <div class="flex items-center gap-1">
          <button class="text-[#0B6BCB] hover:bg-green-50 p-2 rounded-full transition-colors" @click="handleUploadReport">
            <UploadCloud class="h-5 w-5" />
          </button>
        </div>
      </template>
    </NavBar>

    <div class="p-4 space-y-4">
      <Card v-if="!qData && !store.questionnaireAnswered" class="text-center py-10 text-gray-500 text-sm">
        尚未完成自查问卷
      </Card>
      <template v-else>
        <Card>
          <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
            <ClipboardList class="h-4 w-4 text-[#0B6BCB]" />
            基础与健康信息
            <button @click="openEditBasic" class="ml-auto text-[#0B6BCB] hover:bg-green-50 p-1.5 rounded-full transition-colors">
              <Pencil class="h-3.5 w-3.5" />
            </button>
          </h3>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">性别</span><span class="text-gray-900">{{ store.user?.gender === 'female' ? '女' : '男' }}</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">身高</span><span class="text-gray-900">{{ qData?.height || '--' }} cm</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">体重</span><span class="text-gray-900">{{ qData?.weight || '--' }} kg</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">疾病史/慢性疾病</span><span class="text-gray-900">{{ qData?.hasChronic === '有' ? qData.chronicDetails : '无' }}</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">特殊饮食</span><span class="text-gray-900">{{ qData?.hasSpecialDiet === '有' ? qData.specialDietDetails : '无' }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">过敏史/食物过敏</span><span class="text-gray-900">{{ qData?.hasFoodAllergy === '有' ? qData.foodAllergyDetails : '无' }}</span></div>
          </div>
        </Card>

        <Card>
          <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
            <Activity class="h-4 w-4 text-[#0B6BCB]" />
            生活与运动习惯
            <button @click="openEditLifestyle" class="ml-auto text-[#0B6BCB] hover:bg-green-50 p-1.5 rounded-full transition-colors">
              <Pencil class="h-3.5 w-3.5" />
            </button>
          </h3>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">作息时间</span><span class="text-gray-900">{{ qData?.sleepTime || '--' }} - {{ qData?.wakeTime || '--' }} ({{ qData?.sleepDuration || '--' }}h)</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">饮酒/吸烟</span><span class="text-gray-900">{{ qData?.drinkAlcohol || '--' }} / {{ qData?.smoke || '--' }}</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">经常吃零食</span><span class="text-gray-900">{{ qData?.snack || '--' }}</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">日饮水量</span><span class="text-gray-900">{{ qData?.dailyWater || '--' }} ml</span></div>
            <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">每周运动</span><span class="text-gray-900">{{ qData?.exerciseFrequency || '--' }}次 (每次{{ qData?.exerciseDuration || '--' }}分钟)</span></div>
            <div class="flex justify-between"><span class="text-gray-500">运动类型</span><span class="text-gray-900 text-right">{{ (qData?.exerciseTypes || []).join(', ') || '--' }}</span></div>
          </div>
        </Card>
      </template>

      <!-- 体检报告上传 + 营养师转录的健康档案 -->
      <Card>
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-bold text-gray-900 flex items-center gap-2">
            <FileText class="h-4 w-4 text-[#0B6BCB]" />
            我的体检报告
          </h3>
          <button @click="handleUploadReport" class="text-[#0B6BCB] text-xs font-medium flex items-center gap-0.5 hover:opacity-80">
            <UploadCloud class="h-3.5 w-3.5" /> 上传报告
          </button>
        </div>
        <p class="text-[11px] text-gray-400 mb-3">上传后由营养师解读并录入结构化健康档案</p>

        <div v-if="reports.length === 0" class="text-center text-xs text-gray-400 py-8">
          暂无体检报告，点击右上角「上传」提交
        </div>
        <div v-else class="space-y-2.5">
          <div
            v-for="r in reports" :key="r.id"
            class="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 cursor-pointer hover:bg-gray-50/70 transition-colors"
            @click="store.setCurrentView('interpretation-result' as never)"
          >
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
              <i v-if="!r.images.some((i) => i.type === 'image')" class="w-6 h-6 text-[#0B6BCB] not-italic">📄</i>
              <img loading="lazy" decoding="async" v-else :src="r.images.find((i) => i.type === 'image')?.url" @click.stop="openReportImg(r)" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">{{ r.title || '体检报告' }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ r.images.length }} 个文件 · {{ r.date }}</div>
            </div>
            <span
              :class="['text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', r.status === 'done' ? 'bg-[#0B6BCB]/10 text-[#0B6BCB]' : 'bg-amber-50 text-amber-600']"
            >{{ r.status === 'done' ? '已解读' : '待解读' }}</span>
          </div>
        </div>
      </Card>

      <!-- 健康档案：营养师已转录的结构化指标 -->
      <Card v-if="doneReports.length > 0">
        <h3 class="font-bold text-gray-900 mb-1 flex items-center gap-2">
          <ClipboardList class="h-4 w-4 text-[#0B6BCB]" />
          健康档案 · 营养师录入指标
        </h3>
        <div class="space-y-4 mt-3">
          <div v-for="r in doneReports" :key="r.id">
            <div class="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
              解读于 {{ r.interpretedAt }} · {{ r.interpretedBy }}
            </div>
            <template v-if="transcribedGroups(r.values).length">
              <div v-for="grp in transcribedGroups(r.values)" :key="grp.g.key" class="mb-3">
                <div class="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                  <Activity class="h-3 w-3 text-[#0B6BCB]" /> {{ grp.g.title }}
                </div>
                <div class="rounded-xl bg-gray-50 divide-y divide-white">
                  <div v-for="f in grp.fields" :key="f.key" class="flex items-center justify-between px-3 py-2">
                    <span class="text-xs text-gray-500">{{ f.label }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-sm tabular-nums font-semibold" :class="LEVEL_META[f.level].text">
                        {{ f.value }}<span class="text-[10px] text-gray-400 ml-0.5">{{ f.unit }}</span>
                      </span>
                      <span :class="['text-[9px] px-1.5 py-px rounded-full font-bold', LEVEL_META[f.level].bg, LEVEL_META[f.level].text]">{{ LEVEL_META[f.level].label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
              本报告暂无可录入的结构化指标
            </div>
            <p v-if="r.note" class="text-[11px] text-gray-500 bg-[#0B6BCB]/5 border-l-2 border-[#0B6BCB] p-2.5 rounded-r-lg whitespace-pre-wrap leading-relaxed mt-1">
              {{ r.note }}
            </p>
          </div>
        </div>
      </Card>
    </div>

    <!-- 时间选择器弹窗 -->
    <VanPopup v-model:show="showTimePicker" position="bottom" round>
      <VanTimePicker
        v-model="timePickerValue"
        :title="timePickerField === 'sleepTime' ? '选择就寝时间' : '选择起床时间'"
        :columns-type="['hour', 'minute']"
        @confirm="onTimePickerConfirm"
        @cancel="showTimePicker = false"
      />
    </VanPopup>

    <!-- Bottom Nav：健康 / 活动 / 消息 / 我的；高亮由 anchor 推导 -->
    <StudentTabbar anchor="mine" :badge="unreadCount > 0 ? unreadCount : undefined" />
  </div>
</template>
