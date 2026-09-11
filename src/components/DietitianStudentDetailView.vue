<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated, nextTick } from 'vue';
import { format } from 'date-fns';
import { useAppStore } from '../store/app';
import { loadSubmitted, loadDraft } from '../lib/questionnaireStorage';
import { campDateRange, latestOrFirstId } from '../lib/camps';
import { MOCK_METRIC_VALUES, MOCK_STUDENT_METRIC_VALUES } from '../mock/data';
import { NavBar, Card, Button, ChartRulePopup, ChronicTrendChart } from './ui';
import WeightTrendChart from './ui/WeightTrendChart.vue';
import { UserCircle, Coffee, MessageCircle, Stethoscope, ClipboardList, AlertCircle, FileText, Activity, Scale, TrendingUp, PlayCircle, ChevronDown, Eye, FileSearch, MessageSquareText } from 'lucide-vue-next';
import { Popup as VanPopup } from 'vant';
import { buildMedicalData, isValueOutOfRange, type MedicalCategory, type Indicator } from '../lib/medicalData';
import { formatDateTime } from '../lib/utils';
import { useDateGrouping } from '../composables/useDateGrouping';
import { computeExerciseTrends } from '../lib/journey';
import DailyExerciseTrend from './DailyExerciseTrend.vue';
import type { DietRecord, WeightRecord, ExerciseRecord } from '../types';
import { CHRONIC_GROUPS, groupFields, groupRate, judgeGroup, LEVEL_META, CHRONIC_ACCENT } from '../lib/chronic';
import type { ChronicGroupKey } from '../lib/chronic';

const MEAL_TYPES = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
  { id: 'snack', label: '加餐' },
];

const store = useAppStore();
const student = computed(() => store.students.find((s) => s.id === store.selectedStudentId));

// ─── 服务批次切换（学员可能在多个服务批次中） ───
const studentCamps = computed(() => store.selectedStudentId ? store.getStudentCamps(store.selectedStudentId) : []);
const selectedCampId = ref<string>('');
const showCampPicker = ref(false);
const selectedCamp = computed(() => studentCamps.value.find((c) => c.id === selectedCampId.value) || null);

// 当学员切换时，自动选择其当前服务批次（优先沿用详情流已选的服务批次，独立于全局 selectedCampId）
watch(() => store.selectedStudentId, (id) => {
  if (id) {
    if (store.detailSelectedCampId && studentCamps.value.some((c) => c.id === store.detailSelectedCampId)) {
      // 详情流已选服务批次 -> 继承（不影响全局）
      selectedCampId.value = store.detailSelectedCampId;
    } else {
      // 详情流未选服务批次 -> 默认展示该学员的最新一期（不再有「全部服务批次」合并模式）
      selectedCampId.value = latestOrFirstId(studentCamps.value) || '';
    }
  }
}, { immediate: true });

// 本地服务批次切换时写入独立详情流上下文（不污染全局 selectedCampId），下游 PointsDetailView 等据此继承
watch(selectedCampId, (newId) => {
  store.detailSelectedCampId = newId || null;
});

// 按服务批次+学员过滤打卡记录
const campDietRecords = computed(() => {
  if (!selectedCampId.value) return store.dietRecords;
  return store.getCampDietRecords(selectedCampId.value);
});
const campExerciseRecords = computed(() => {
  if (!selectedCampId.value) return store.exerciseRecords;
  return store.getCampExerciseRecords(selectedCampId.value);
});
const campWeightRecords = computed(() => {
  if (!selectedCampId.value) return store.weightRecords;
  return store.getCampWeightRecords(selectedCampId.value);
});

// 快捷回复模板
const DIET_TEMPLATES = [
  '搭配很均衡，继续保持！',
  '蛋白质摄入充足，很好',
  '建议增加优质蛋白，如鸡蛋、鱼虾、豆制品',
  '蔬菜量偏少，建议每餐加一份绿叶菜',
  '主食偏多，建议减半，用粗粮替代',
  '油脂偏多，建议清淡少油',
  '这一餐偏少，记得按时吃饭哦',
];
const WEIGHT_TEMPLATES = [
  '体重稳步下降，很棒！',
  '体重有波动很正常，看长期趋势',
  '减重速度偏快，注意营养均衡',
  '建议固定早晨空腹称重，数据更可比',
];

const activeTab = ref<'diet' | 'exercise' | 'weight' | 'chronic' | 'medical' | 'questionnaire'>('diet');

// Diet tab - filtered by studentId AND campId
const records = computed(() =>
  campDietRecords.value.filter((r) => r.studentId === store.selectedStudentId).sort((a, b) => b.date.localeCompare(a.date)),
);
const commentingId = ref<string | null>(null);
const commentText = ref('');
const commentStaple = ref(false);
const commentProtein = ref(false);
const commentVegetable = ref(false);

// Exercise tab - filtered by studentId AND campId
const studentExercises = computed(() =>
  campExerciseRecords.value.filter((r) => r.studentId === store.selectedStudentId).sort((a, b) => b.date.localeCompare(a.date)),
);

// 趋势图计算（与学员端 DietView/ExerciseView 完全对称，内容一致；使用服务批次过滤后的记录）
const exerciseTrends = computed(() => computeExerciseTrends(studentExercises.value, store.selectedStudentId || undefined));
const exerciseTrendMax = computed(() => Math.max(...exerciseTrends.value.map((t) => t.totalDuration), 1));

// ─── Date grouping for diet & exercise tabs ───────────────────────────
// 营养师端默认全部展开，便于查看学员历史数据
const {
  grouped: groupedDietRecords,
  toggleDate: toggleDietDate,
  isExpanded: isDietExpanded,
} = useDateGrouping(records, { defaultExpandAll: true });

const {
  grouped: groupedExerciseRecords,
  toggleDate: toggleExerciseDate,
  isExpanded: isExerciseExpanded,
} = useDateGrouping(studentExercises, { defaultExpandAll: true });

// Weight tab - data sourced from camp-filtered weight records
const studentWeights = computed(() => {
  const id = store.selectedStudentId;
  if (!id) return [];
  return campWeightRecords.value
    .filter((r) => r.studentId === id)
    .sort((a, b) => a.date.localeCompare(b.date));
});

// ─── Weight date grouping (与运动/饮食一致，按天聚类) ───
const {
  grouped: groupedWeightRecords,
  toggleDate: toggleWeightDate,
  isExpanded: isWeightExpanded,
} = useDateGrouping(studentWeights, { defaultExpandAll: true });

const weightStats = computed(() => {
  const recs = studentWeights.value;
  if (recs.length === 0) return null;
  const weights = recs.map((r) => r.weight);
  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = parseFloat((last - first).toFixed(1));
  const changePercent = first !== 0 ? parseFloat(((change / Math.abs(first)) * 100).toFixed(1)) : null;
  return { first, last, change, changePercent, min: Math.min(...weights), max: Math.max(...weights), count: weights.length };
});

/** 获取当前记录的上一条体重记录的 weight 值（用于"较上次"变化展示） */
const getPrevWeight = (rec: WeightRecord, group: { date: string; records: WeightRecord[] }): number | null => {
  const allRecs = studentWeights.value; // 已按时间升序排列
  const idx = allRecs.findIndex(r => r.id === rec.id);
  if (idx <= 0) return null;
  return allRecs[idx - 1].weight;
};

// Weight comment (营养师体重批注)
const weightCommentingId = ref<string | null>(null);
const weightCommentText = ref('');

const startWeightComment = (record: WeightRecord) => {
  weightCommentingId.value = record.id;
  weightCommentText.value = record.dietitianComment || '';
};
const cancelWeightComment = () => {
  weightCommentingId.value = null;
  weightCommentText.value = '';
};
const handleSaveWeightComment = (recordId: string) => {
  store.updateWeightRecord(recordId, {
    dietitianComment: weightCommentText.value,
    dietitianName: store.user?.name || '营养师',
    dietitianCommentDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    commentRead: false,
  });
  cancelWeightComment();
};

// Weight trend SVG chart → 已抽取到 ui/WeightTrendChart.vue

// ─── 健康指标（五高）模块 ───────────────────────────────
// 只读展示，不加批注（与学员端共享 ChronicTrendChart 保证展示一致）。
// 单条学员记录，不分服务批次（五高属于健康档案类数据，非营期打卡）。
const chronicGroup = ref<ChronicGroupKey>('bp');
const chronicRows = computed(() => (store.selectedStudentId ? store.getStudentChronicRecords(store.selectedStudentId) : []));
const chronicGender = computed(() => (store.selectedStudentId ? store.students.find((s) => s.id === store.selectedStudentId)?.gender : undefined));
const chronicRate = computed(() => groupRate(chronicRows.value, chronicGroup.value, chronicGender.value));
const chronicMeta = computed(() => CHRONIC_GROUPS.find((x) => x.key === chronicGroup.value)!);
const chronicAccent = computed(() => CHRONIC_ACCENT[chronicGroup.value]);
const chronicDisplayDefs = computed(() => groupFields(chronicGroup.value).filter((f) => f.display));

// Medical tab
// Medical tab - built from dynamic metric configs + per-student mock values, gender-aware
const getStudentMetrics = (studentId?: string) => {
  if (!studentId) return MOCK_METRIC_VALUES;
  return MOCK_STUDENT_METRIC_VALUES[studentId] || MOCK_METRIC_VALUES;
};

const medicalData = ref<MedicalCategory[]>(JSON.parse(JSON.stringify(buildMedicalData(store.metricConfigs, getStudentMetrics(student.value?.id), student.value?.gender))));
const isEditingMedical = ref(false);

// Collapsible category state - default all expanded
const collapsedCats = ref<Set<string>>(new Set());
const toggleCat = (title: string) => {
  const next = new Set(collapsedCats.value);
  if (next.has(title)) next.delete(title);
  else next.add(title);
  collapsedCats.value = next;
};

// 切换学员时重建医疗数据（不同学员有各自的指标值和性别参考范围）
watch(() => student.value?.id, () => {
  const vals = getStudentMetrics(student.value?.id);
  medicalData.value = JSON.parse(JSON.stringify(buildMedicalData(store.metricConfigs, vals, student.value?.gender)));
}, { immediate: true });

// Questionnaire tab
const qData = ref<any>(null);

// 批注深链（与教练端同一套 pendingAnnotation 机制）：从待批注列表/消息进入时自动切 Tab + 滚动定位+高亮目标记录
// ★KeepAlive 双挂：onMounted 只在首次挂载跑一次，订阅详情视图被缓存后再次进入 onMounted 不再触发 → 必须 onActivated 也跑；
// 否则「第二次开始点批注不自动定位」（v27 加 KeepAlive 后回归）。首次挂载时 onActivated 也触发，第一次执行即清掉 pending，二次调用空转，安全。
const consumePendingAnnotation = () => {
  const type = store.pendingRecordType;
  if (!type) return;
  const recordId = store.pendingRecordId;
  // 映射记录类型到 Tab
  const tabMap: Record<string, 'diet' | 'exercise' | 'weight'> = {
    diet: 'diet',
    exercise: 'exercise',
    weight: 'weight',
  };
  if (tabMap[type]) {
    activeTab.value = tabMap[type];
    nextTick(() => {
      if (recordId) {
        const el = document.getElementById(`record-${recordId}`);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          // 高亮闪烁
          el.classList.add('ring-2', 'ring-[#FF976A]');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#FF976A]'), 2000);
        }
      }
      // 清除 pending 状态，避免来回切换时重复触发
      store.setPendingAnnotation(null);
    });
  }
};

onMounted(() => {
  // 问卷 Tab 读「该学员本人」的问卷数据（按账号隔离，不再读全局 key 串账号）
  const saved = loadSubmitted(student.value?.id) ?? loadDraft(student.value?.id);
  if (saved) {
    try {
      qData.value = saved.formData || saved;
    } catch (e) {
      // ignore
    }
  }

  consumePendingAnnotation();
});
onActivated(consumePendingAnnotation);

const startComment = (record: DietRecord) => {
  commentingId.value = record.id;
  commentText.value = record.dietitianComment || '';
  commentStaple.value = !!record.hasStaple;
  commentProtein.value = !!record.hasProtein;
  commentVegetable.value = !!record.hasVegetable;
};

const cancelComment = () => {
  commentingId.value = null;
  commentText.value = '';
  commentStaple.value = false;
  commentProtein.value = false;
  commentVegetable.value = false;
};

const handleSaveComment = (recordId: string) => {
  store.updateDietRecord(recordId, {
    dietitianComment: commentText.value,
    dietitianName: store.user?.name || '营养师',
    dietitianCommentDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    commentRead: false,
    hasStaple: commentStaple.value,
    hasProtein: commentProtein.value,
    hasVegetable: commentVegetable.value,
  });
  cancelComment();
};

const handleMedicalChange = (catIdx: number, itemIdx: number, field: 'beforeValue' | 'afterValue', value: string) => {
  const item: Indicator = medicalData.value[catIdx].items[itemIdx];
  (item as any)[field] = value ? Number(value) : null;
  const gender = student.value?.gender;
  if (field === 'beforeValue') {
    item.isBeforeOut = isValueOutOfRange(item.beforeValue, item.normalRange, gender);
  } else {
    item.isAfterOut = isValueOutOfRange(item.afterValue, item.normalRange, gender);
  }
};

const mealLabel = (meal: string) => MEAL_TYPES.find((m) => m.id === meal)?.label;

const openReport = (r: any) => {
  if (r.type === 'pdf') window.open(r.url, '_blank');
  else store.openImagePreview([r.url], 0);
};
</script>

<template>
  <div v-if="!student" class="flex min-h-full flex-col bg-[#F7F8FA] pb-safe">
    <NavBar title="学员详情" :on-back="store.goBack" />
    <div class="flex-1 flex items-center justify-center text-gray-500 text-sm">
      未选择学员
    </div>
  </div>

  <div v-else class="flex min-h-full flex-col bg-[#F7F8FA] pb-safe relative font-sans">
    <NavBar :title="`${student.name} 的档案`" :on-back="store.goBack" />

    <div class="bg-white px-4 pt-4 pb-4 border-b border-gray-200 space-y-4">
      <Card class="flex items-center p-4 bg-[#FF976A]/5 border-[#FF976A]/20">
        <div class="flex items-center space-x-3">
          <div class="h-10 w-10 rounded-full bg-[#FF976A]/10 flex items-center justify-center text-[#FF976A]">
            <UserCircle class="h-6 w-6" />
          </div>
          <div>
            <div class="text-sm font-bold text-gray-900 mb-1">{{ student.name }}</div>
            <div class="text-xs text-gray-500">
              {{ student.gender === 'male' ? '男' : '女' }} · {{ student.age }}岁 · {{ student.phone }}
            </div>
          </div>
        </div>
      </Card>

      <!-- 服务批次切换（学员在多个服务批次时显示） -->
      <div v-if="studentCamps.length > 1" class="bg-white px-4 py-2.5 flex items-center justify-between rounded-xl border border-gray-100">
        <div>
          <span class="text-xs text-gray-500">当前服务批次：</span>
          <span class="text-sm font-medium text-gray-800">{{ selectedCamp?.name || '未选择' }}</span>
        </div>
        <button class="text-xs text-[#FF976A] border border-[#FF976A] px-2.5 py-1 rounded-full font-bold active:bg-orange-50" @click="showCampPicker = true">
          切换
        </button>
      </div>

      <!-- 快捷处理入口：报告解读 / 日常咨询（跳转对应处理页） -->
      <div class="flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 bg-[#0B6BCB]/8 border border-[#0B6BCB]/20 text-[#0B6BCB] text-sm font-bold rounded-xl py-2.5 active:bg-[#0B6BCB]/15"
          @click="store.setCurrentView('doctor-interpretation')"
        >
          <FileSearch class="w-4 h-4" /> 报告解读
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 bg-[#FF976A]/10 border border-[#FF976A]/25 text-[#FF976A] text-sm font-bold rounded-xl py-2.5 active:bg-[#FF976A]/20"
          @click="store.setCurrentView('doctor-consult')"
        >
          <MessageSquareText class="w-4 h-4" /> 日常咨询
        </button>
      </div>

    </div>

    <!-- Tab 栏：独立 sticky，滚动时固定在顶部 -->
    <div class="bg-white px-4 border-b border-gray-200 sticky top-14 z-10">
      <div class="flex gap-4 overflow-x-auto whitespace-nowrap py-1 no-scrollbar">
        <button
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'diet' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'diet'"
        >
          饮食打卡
        </button>
        <button
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'exercise' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'exercise'"
        >
          运动打卡
        </button>
        <button
          v-if="store.enabledServices.bmi"
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'weight' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'weight'"
        >
          体重打卡
        </button>
        <button
          v-if="store.enabledServices.chronic"
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'chronic' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'chronic'"
        >
          健康指标
        </button>
        <button
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'medical' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'medical'"
        >
          基础医疗
        </button>
        <button
          :class="['py-3 text-sm font-bold border-b-2 transition-colors shrink-0', activeTab === 'questionnaire' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-transparent text-gray-500 hover:text-gray-900']"
          @click="activeTab = 'questionnaire'"
        >
          自查问卷
        </button>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Diet tab -->
      <template v-if="activeTab === 'diet'">

        <div v-if="records.length === 0" class="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <div class="w-14 h-14 mx-auto mb-2 rounded-full bg-[#FF976A]/10 flex items-center justify-center">
            <Coffee class="w-7 h-7 text-[#FF976A]" />
          </div>
          <div class="text-sm font-bold text-gray-700">该学员暂无饮食打卡记录</div>
        </div>
        <div v-else class="space-y-4">
          <div v-for="group in groupedDietRecords" :key="group.date">
            <!-- Date header -->
            <div @click="toggleDietDate(group.date)" class="flex items-center gap-2 px-1 py-2 cursor-pointer select-none sticky top-[104px] z-[5] bg-[#F7F8FA]">
              <div class="w-1 h-4 bg-[#FF976A] rounded-full"></div>
              <span class="text-sm font-bold text-gray-900">{{ group.label }}</span>
              <span class="text-[10px] text-gray-400">{{ group.records.length }} 条</span>
              <ChevronDown :class="['ml-auto w-4 h-4 text-gray-400 transition-transform duration-300', !isDietExpanded(group.date) ? '-rotate-90' : '']" />
            </div>
            <div v-show="isDietExpanded(group.date)" class="space-y-3">
          <Card v-for="record in group.records" :key="record.id" :id="`record-${record.id}`" class="p-0 overflow-hidden transition-all duration-300">
            <div class="p-4 border-b border-gray-50">
              <div class="flex justify-between items-center mb-3">
                <span class="text-xs text-gray-500 font-medium">{{ formatDateTime(record.date) }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded text-[#FF976A] bg-[#FF976A]/10 font-bold uppercase">
                  {{ mealLabel(record.meal) }}
                </span>
              </div>

              <p class="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{{ record.description }}</p>

              <!-- 餐次结构标签（营养师评定，保存后展示；未评定时不显示） -->
              <div v-if="record.hasStaple || record.hasProtein || record.hasVegetable" class="flex flex-wrap gap-1.5 mb-3">
                <span class="text-[10px] text-gray-400 self-center">已评定:</span>
                <span v-if="record.hasStaple" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">🍚 主食</span>
                <span v-if="record.hasProtein" class="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 font-medium">🥩 蛋白质</span>
                <span v-if="record.hasVegetable" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">🥬 蔬菜</span>
              </div>

              <div class="flex gap-2 overflow-x-auto pb-1">
                <img loading="lazy" decoding="async"
                  v-for="(url, idx) in record.photos"
                  :key="idx"
                  :src="url"
                  alt="食物"
                  class="h-20 w-20 object-cover rounded-lg shrink-0 border border-gray-100 cursor-pointer"
                  @click="store.openImagePreview(record.photos || [], idx)"
                />
              </div>
            </div>

            <div class="p-4 bg-gray-50/50">
              <div v-if="commentingId === record.id" class="space-y-3">
                <!-- 餐次结构评定（营养师勾选，保存后学员可见） -->
                <div class="space-y-1.5">
                  <label class="text-sm text-gray-700 font-medium">餐次结构评定:</label>
                  <div class="flex gap-2">
                    <button
                      @click="commentStaple = !commentStaple"
                      :class="['flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95', commentStaple ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200']"
                    >🍚 主食</button>
                    <button
                      @click="commentProtein = !commentProtein"
                      :class="['flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95', commentProtein ? 'bg-rose-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200']"
                    >🥩 蛋白质</button>
                    <button
                      @click="commentVegetable = !commentVegetable"
                      :class="['flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95', commentVegetable ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200']"
                    >🥬 蔬菜</button>
                  </div>
                </div>
                <!-- 快捷回复模板 -->
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="tpl in DIET_TEMPLATES"
                    :key="tpl"
                    @click="commentText = commentText ? commentText + '，' + tpl : tpl"
                    class="text-[10px] px-2 py-1 rounded-full bg-[#FF976A]/10 text-[#FF976A] font-medium active:scale-95 transition-transform"
                  >
                    {{ tpl }}
                  </button>
                </div>
                <textarea
                  class="w-full rounded-lg border border-gray-200 p-2 text-sm focus:outline-none focus:border-[#FF976A]"
                  rows="3"
                  placeholder="输入专业批注..."
                  :value="commentText"
                  @input="commentText = ($event.target as HTMLTextAreaElement).value"
                  v-focus
                />
                <div class="flex justify-end gap-2">
                  <Button variant="outline" size="sm" @click="cancelComment">取消</Button>
                  <Button class="bg-[#FF976A] hover:bg-[#e8855a] text-white" size="sm" @click="handleSaveComment(record.id)">保存</Button>
                </div>
              </div>
              <div v-else-if="record.dietitianComment" class="relative group">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-[#FF976A]">批注</span>
                  </div>
                  <span v-if="record.dietitianCommentDate" class="text-[10px] text-gray-500">{{ record.dietitianCommentDate }}</span>
                </div>
                <p v-if="record.dietitianComment" class="text-sm text-gray-700 whitespace-pre-wrap">
                  {{ record.dietitianComment }}
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <button @click="startComment(record)" class="text-xs text-[#1677FF]">
                    编辑
                  </button>
                  <span v-if="record.dietitianComment && record.commentRead" class="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Eye class="w-3 h-3" />
                    学员已读未回
                  </span>
                </div>
              </div>
              <button v-else @click="startComment(record)" class="flex items-center gap-1 text-sm text-[#FF976A] font-medium">
                <MessageCircle class="w-4 h-4" />
                添加批注
              </button>
            </div>
          </Card>
            </div>
          </div>
        </div>
      </template>

      <!-- Exercise tab -->
      <template v-if="activeTab === 'exercise'">
        <!-- 每日运动趋势图（与学员端一致） -->
        <Card v-if="studentExercises.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
              <TrendingUp class="h-4 w-4 text-[#0B6BCB]" />
              每日运动趋势
            </h3>
            <div class="flex items-center gap-2">
              <ChartRulePopup title="运动趋势计算规则" button-text="计算规则">
                <p><span class="font-bold text-gray-900">总时长 =</span> 该日所有运动记录的时长之和(分钟)，同一日多次运动分别相加</p>
                <p><span class="font-bold text-gray-900">有效运动：</span>单次运动时长≥40分钟计为有效，与积分规则一致</p>
                <p><span class="font-bold text-gray-900">运动次数：</span>该日运动记录条数，同一天多次运动分别计数</p>
                <p><span class="font-bold text-gray-900">平均强度：</span>该日记录RPE强度的算术平均值(1-5级)，无记录显示"--"</p>
                <p><span class="font-bold text-gray-900">交互：</span>点击某根柱形查看当天记录，左右滑动切换前一天/后一天</p>
              </ChartRulePopup>
              <span class="text-[10px] text-gray-400">单位：分钟</span>
            </div>
          </div>
          <DailyExerciseTrend :records="studentExercises" />
        </Card>

        <div v-if="studentExercises.length === 0" class="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <div class="w-14 h-14 mx-auto mb-2 rounded-full bg-[#0B6BCB]/10 flex items-center justify-center">
            <Activity class="w-7 h-7 text-[#0B6BCB]" />
          </div>
          <div class="text-sm font-bold text-gray-700">该学员暂无运动打卡记录</div>
        </div>
        <div v-else class="space-y-4">
          <div v-for="group in groupedExerciseRecords" :key="group.date">
            <!-- Date header -->
            <div @click="toggleExerciseDate(group.date)" class="flex items-center gap-2 px-1 py-2 cursor-pointer select-none sticky top-[104px] z-[5] bg-[#F7F8FA]">
              <div class="w-1 h-4 bg-[#0B6BCB] rounded-full"></div>
              <span class="text-sm font-bold text-gray-900">{{ group.label }}</span>
              <span class="text-[10px] text-gray-400">{{ group.records.length }} 条</span>
              <ChevronDown :class="['ml-auto w-4 h-4 text-gray-400 transition-transform duration-300', !isExerciseExpanded(group.date) ? '-rotate-90' : '']" />
            </div>
            <div v-show="isExerciseExpanded(group.date)" class="space-y-3">
          <Card v-for="record in group.records" :key="record.id" :id="`record-${record.id}`" class="p-0 overflow-hidden transition-all duration-300">
            <div class="p-4 border-b border-gray-50">
              <div class="flex justify-between items-center mb-3">
                <span class="text-xs text-gray-500 font-medium">{{ formatDateTime(record.date) }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded text-[#0B6BCB] bg-[#0B6BCB]/10 font-bold uppercase flex items-center gap-1">
                  <Activity class="w-3 h-3" />
                  {{ record.type }}
                </span>
              </div>

              <div class="grid grid-cols-2 gap-3 mb-3 bg-gray-50 p-3 rounded-xl">
                <div>
                  <div class="text-[10px] text-gray-500 mb-0.5">运动时长</div>
                  <div class="text-sm font-bold text-gray-900">{{ record.duration }} <span class="text-xs font-normal">分钟</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500 mb-0.5">强度 (1-5)</div>
                  <div class="text-sm font-bold text-gray-900 flex gap-1">
                    <div v-for="v in 5" :key="v" :class="['w-2 h-3 rounded-full', v <= record.intensity ? 'bg-[#0B6BCB]' : 'bg-gray-200']" />
                  </div>
                </div>
              </div>

              <div v-if="record.notes" class="mb-3">
                <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ record.notes }}</p>
              </div>

              <div v-if="record.photos && record.photos.length > 0" class="flex gap-2 overflow-x-auto pb-1">
                <img loading="lazy" decoding="async"
                  v-for="(url, idx) in record.photos"
                  :key="idx"
                  :src="url"
                  alt="运动"
                  class="h-20 w-20 object-cover rounded-lg shrink-0 border border-gray-100 cursor-pointer"
                  @click="store.openImagePreview(record.photos || [], idx)"
                />
              </div>

              <div v-if="record.videoUrls && record.videoUrls.length > 0" class="flex gap-2 overflow-x-auto pb-1">
                <div
                  v-for="(url, idx) in record.videoUrls"
                  :key="idx"
                  class="h-20 w-20 rounded-lg shrink-0 border border-gray-100 overflow-hidden relative bg-black cursor-pointer"
                  @click="store.openVideoPreview(url)"
                >
                  <video :src="url" class="w-full h-full object-cover" preload="metadata" playsinline webkit-playsinline />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                    <PlayCircle class="w-6 h-6 text-white drop-shadow" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 运动批注区域（只读，批注由教练操作） -->
            <div class="p-4 bg-gray-50/50">
              <div v-if="record.coachComment" class="relative">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-[#0B6BCB]">康复师批注</span>
                  </div>
                  <span v-if="record.coachCommentDate" class="text-[10px] text-gray-400">{{ record.coachCommentDate }}</span>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ record.coachComment }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span v-if="record.coachName" class="text-[10px] text-gray-400">批注人：{{ record.coachName }}</span>
                  <span v-if="record.coachComment && record.commentRead" class="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Eye class="w-3 h-3" />
                    学员已读未回
                  </span>
                </div>
              </div>
              <div v-else class="text-xs text-gray-400 flex items-center gap-1">
                <MessageCircle class="w-3 h-3" />
                暂无康复师批注
              </div>
            </div>
          </Card>
            </div>
          </div>
        </div>
      </template>

      <!-- Weight tab -->
      <template v-if="activeTab === 'weight'">
        <div v-if="studentWeights.length === 0" class="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <div class="w-14 h-14 mx-auto mb-2 rounded-full bg-[#1677FF]/10 flex items-center justify-center">
            <Scale class="w-7 h-7 text-[#1677FF]" />
          </div>
          <div class="text-sm font-bold text-gray-700">该学员暂无体重打卡记录</div>
        </div>
        <div v-else class="space-y-4">
          <!-- Summary stats -->
          <div class="grid grid-cols-4 gap-2">
            <div class="bg-white rounded-xl p-3 text-center border border-gray-100">
              <div class="text-[10px] text-gray-500 mb-1">初始体重</div>
              <div class="text-base font-bold text-gray-900">{{ weightStats?.first }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">kg</span></div>
            </div>
            <div class="bg-white rounded-xl p-3 text-center border border-gray-100">
              <div class="text-[10px] text-gray-500 mb-1">最新体重</div>
              <div class="text-base font-bold text-gray-900">{{ weightStats?.last }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">kg</span></div>
            </div>
            <div :class="['rounded-xl p-3 text-center border', (weightStats?.change ?? 0) < 0 ? 'bg-[#0B6BCB]/5 border-[#0B6BCB]/20' : 'bg-orange-50 border-orange-200']">
              <div class="text-[10px] text-gray-500 mb-1">总变化</div>
              <div :class="['text-base font-bold', (weightStats?.change ?? 0) < 0 ? 'text-[#0B6BCB]' : 'text-orange-500']">
                {{ weightStats && weightStats.change > 0 ? '+' : '' }}{{ weightStats?.change }}<span class="text-[10px] font-normal ml-0.5">kg</span>
              </div>
            </div>
            <div class="bg-white rounded-xl p-3 text-center border border-gray-100">
              <div class="text-[10px] text-gray-500 mb-1">打卡次数</div>
              <div class="text-base font-bold text-gray-900">{{ weightStats?.count }}<span class="text-[10px] font-normal text-gray-400 ml-0.5">次</span></div>
            </div>
          </div>

          <!-- Weight trend chart（抽取为独立组件） -->
          <div class="flex justify-end -mb-1">
            <ChartRulePopup title="体重趋势图展示规则" button-text="图表规则">
              <p><span class="font-bold text-gray-900">数据来源：</span>学员每次体重打卡记录，按时间升序排列</p>
              <p><span class="font-bold text-gray-900">Y轴范围：</span>自动适配数据区间，上下留白20%，确保曲线居中可见</p>
              <p><span class="font-bold text-gray-900">交互方式：</span>点击或滑动曲线可查看每个数据点的具体体重和日期</p>
              <p><span class="font-bold text-gray-900">较上次变化：</span>当前体重减去前一次打卡体重，下降为绿色，上升为橙色</p>
              <p><span class="font-bold text-gray-900">总变化：</span>最新体重减去首次打卡体重，百分比=总变化÷|初始体重|×100%</p>
              <p><span class="font-bold text-gray-900">建议：</span>固定早晨空腹称重，数据更具可比性</p>
            </ChartRulePopup>
          </div>
          <WeightTrendChart :records="studentWeights" :gradient-id="`wg-${student?.id}`" />

          <!-- Weight record history with annotation -->
          <Card class="p-0 overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <Scale class="w-4 h-4 text-[#0B6BCB]" />
              <h3 class="font-bold text-gray-900 text-sm">打卡记录与批注</h3>
              <span class="text-[10px] text-gray-400 ml-auto">共 {{ studentWeights.length }} 条记录</span>
            </div>
            <div class="divide-y divide-gray-50">
              <div v-for="group in groupedWeightRecords" :key="group.date">
                <!-- 日期分组标题 -->
                <div @click="toggleWeightDate(group.date)" class="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                  <div class="w-1 h-4 bg-[#1677FF] rounded-full"></div>
                  <span class="text-sm font-bold text-gray-900">{{ group.label }}</span>
                  <span class="text-[10px] text-gray-400">{{ group.records.length }} 条</span>
                  <ChevronDown :class="['ml-auto w-4 h-4 text-gray-400 transition-transform duration-300', !isWeightExpanded(group.date) ? '-rotate-90' : '']" />
                </div>
                <div v-show="isWeightExpanded(group.date)">
                  <div
                    v-for="(rec, idx) in group.records"
                    :key="rec.id"
                    :id="`record-${rec.id}`"
                    class="px-4 py-3 transition-all duration-300"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-[#0B6BCB]/8 flex items-center justify-center text-[#0B6BCB] shrink-0">
                          <Scale class="w-4 h-4" />
                        </div>
                        <div>
                          <div class="text-sm font-medium text-gray-900">{{ rec.weight }} kg</div>
                          <div class="text-[10px] text-gray-400">{{ formatDateTime(rec.date) }}</div>
                        </div>
                      </div>
                      <!-- 较上次变化（同一天内多条记录时也显示） -->
                      <div v-if="getPrevWeight(rec, group) !== null" class="text-right">
                        <div :class="['text-xs font-bold', (rec.weight - getPrevWeight(rec, group)!) < 0 ? 'text-[#0B6BCB]' : 'text-orange-500']">
                          {{ (rec.weight - getPrevWeight(rec, group)!) > 0 ? '+' : '' }}{{ (rec.weight - getPrevWeight(rec, group)!).toFixed(1) }} kg
                        </div>
                        <div class="text-[10px] text-gray-400">较上次</div>
                      </div>
                      <div v-else class="text-right">
                        <div class="text-[10px] text-gray-400">首次记录</div>
                      </div>
                    </div>

                    <!-- 体重打卡照片 -->
                    <div v-if="rec.photos && rec.photos.length > 0" class="mt-2 ml-11 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <img loading="lazy" decoding="async"
                        v-for="(url, pIdx) in rec.photos"
                        :key="pIdx"
                        :src="url"
                        alt="体重打卡"
                        class="h-16 w-16 object-cover rounded-lg shrink-0 border border-gray-100 cursor-pointer"
                        @click="store.openImagePreview(rec.photos || [], pIdx)"
                      />
                    </div>

                    <!-- 体重批注区域 -->
                    <div class="mt-2 ml-11">
                      <div v-if="weightCommentingId === rec.id" class="space-y-2">
                        <div class="flex flex-wrap gap-1.5">
                          <button
                            v-for="tpl in WEIGHT_TEMPLATES"
                            :key="tpl"
                            @click="weightCommentText = weightCommentText ? weightCommentText + '，' + tpl : tpl"
                            class="text-[10px] px-2 py-1 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] font-medium active:scale-95 transition-transform"
                          >
                            {{ tpl }}
                          </button>
                        </div>
                        <textarea
                          class="w-full rounded-lg border border-gray-200 p-2 text-sm focus:outline-none focus:border-[#0B6BCB]"
                          rows="2"
                          placeholder="输入体重批注..."
                          :value="weightCommentText"
                          @input="weightCommentText = ($event.target as HTMLTextAreaElement).value"
                        />
                        <div class="flex justify-end gap-2">
                          <Button variant="outline" size="sm" @click="cancelWeightComment">取消</Button>
                          <Button class="bg-[#0B6BCB] text-white" size="sm" @click="handleSaveWeightComment(rec.id)">保存</Button>
                        </div>
                      </div>
                      <div v-else-if="rec.dietitianComment" class="relative group">
                        <div class="flex items-center justify-between mb-1">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-[#0B6BCB]">批注</span>
                          </div>
                          <span v-if="rec.dietitianCommentDate" class="text-[10px] text-gray-400">{{ rec.dietitianCommentDate }}</span>
                        </div>
                        <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ rec.dietitianComment }}</p>
                        <div class="flex items-center gap-2 mt-1">
                          <button @click="startWeightComment(rec)" class="text-xs text-[#0B6BCB]">编辑</button>
                          <span v-if="rec.dietitianComment && rec.commentRead" class="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            <Eye class="w-3 h-3" />
                            学员已读未回
                          </span>
                        </div>
                      </div>
                      <button v-else @click="startWeightComment(rec)" class="flex items-center gap-1 text-sm text-[#0B6BCB] font-medium">
                        <MessageCircle class="w-4 h-4" />
                        添加批注
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </template>

      <!-- 健康指标（五高）Tab：只读展示，不加批注（与学员端趋势/历史一致，渐进式） -->
      <template v-if="activeTab === 'chronic' && store.enabledServices.chronic">
        <!-- 六指标族切换 -->
        <div class="flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
          <button
            v-for="g in CHRONIC_GROUPS"
            :key="g.key"
            :class="['px-3 py-1.5 text-xs font-bold rounded-full border transition-colors shrink-0', chronicGroup === g.key ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-white']"
            :style="chronicGroup === g.key ? `background:${CHRONIC_ACCENT[g.key]}` : ''"
            @click="chronicGroup = g.key"
          >
            {{ g.title }}
          </button>
        </div>

        <!-- 该指标族累计达标率概览 -->
        <div class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="flex items-center gap-2">
              <span class="text-xs font-bold text-gray-500">累计达标率</span>
              <ChartRulePopup title="累计达标率 · 计算规则">
                <p>达标率 = 达标次数 ÷ 测量总次数 × 100%。</p>
                <p>每次记录会逐项对照参考区间判定每个血压 / 血糖 / 血脂等字段：参考范围内的算「达标」。每个有值字段计 1 次测量，达标 1 次 +1；同一天记录多次也分别计入，不做天数去重。</p>
                <p>百分比四舍五入到整数。下方「达标 X 次 / 测量 Y 次」即达标次数与测量总次数。</p>
              </ChartRulePopup>
            </span>
            <span class="text-[11px] font-bold tabular-nums" :style="`color:${chronicAccent}`">{{ chronicRate.rate }}%</span>
          </div>
          <div class="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-1">
            <div class="h-full rounded-full transition-all" :style="`width:${chronicRate.rate}%; background:${chronicAccent}`"></div>
          </div>
          <div class="text-[10px] text-gray-400">达标 {{ chronicRate.normal }} 次 / 测量 {{ chronicRate.total }} 次</div>
        </div>

        <!-- 图例 + 计算规则 -->
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2.5">
            <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#10B981"></i>达标</span>
            <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#A5772D"></i>关注</span>
            <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-2 h-2 rounded-full" style="background:#B6523E"></i>异常</span>
            <span class="flex items-center gap-1 text-[10px] text-gray-500"><i class="w-3.5 h-1.5 rounded-sm" style="background:#10B981;opacity:.7"></i>达标区</span>
          </div>
          <ChartRulePopup :title="chronicMeta.title + '趋势 · 计算规则'">
            <p><b>绿色色带（达标区）</b><br/>这条指标的参考区间，数值落在这条带内即为「达标」；淡绿色虚线标出参考区间的上 / 下边界数值。</p>
            <p><b>数据点颜色</b><br/>每个圆点是一次记录的数值，颜色按当次档位：绿=达标、琥珀=关注、砖红=异常，可点击查看当次全部明细。</p>
            <p><b>折线与时间轴</b><br/>折线连接各次记录展示变化趋势；底部 MM-dd 为记录日期。</p>
            <p><b>底部统计</b>：最近值、较上一次的增减、期间最低、期间最高、平均值（保留 1 位小数，数据过少时部分缺省）。</p>
            <p>档位判定以各指标参考区间为准（默认演示值，非医疗诊断，仅供参考）。</p>
          </ChartRulePopup>
        </div>

        <!-- 每项指标趋势（复用共享组件，与学员端一致） -->
        <ChronicTrendChart
          v-for="def in chronicDisplayDefs"
          :key="def.key"
          :def="def"
          :records="chronicRows"
          :gender="chronicGender"
          :accent="chronicAccent"
        />

        <!-- 历次记录明细（只读） -->
        <div class="text-xs font-bold text-gray-500 px-1 pt-1">历次记录（{{ chronicRows.length }}）</div>
        <div v-if="chronicRows.length > 0" class="space-y-2">
          <div
            v-for="r in chronicRows"
            :key="r.id"
            class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-700">{{ r.date.slice(0, 16) }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="LEVEL_META[judgeGroup(r.values, chronicGroup, chronicGender).level].bg + ' ' + LEVEL_META[judgeGroup(r.values, chronicGroup, chronicGender).level].text">
                {{ LEVEL_META[judgeGroup(r.values, chronicGroup, chronicGender).level].label }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="f in judgeGroup(r.values, chronicGroup, chronicGender).fields"
                :key="f.key"
                class="flex-1 min-w-[5.5rem] rounded-xl px-3 py-2"
                :class="LEVEL_META[f.level].bg"
              >
                <div class="text-[9px] text-gray-500">{{ f.label }}</div>
                <div class="text-base font-bold tabular-nums mt-0.5" :class="LEVEL_META[f.level].text">
                  {{ f.value }} <span class="text-[9px] font-normal">{{ f.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-xs text-gray-400 py-10">该学员健康指标暂无记录</div>
      </template>

      <!-- Medical tab -->
      <template v-if="activeTab === 'medical'">
        <div class="space-y-4">
          <div class="flex justify-between items-center bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div>
              <h3 class="font-bold text-gray-900 text-sm">医疗数据维护</h3>
              <p class="text-xs text-gray-500">协助填写和更新学员体检指标</p>
            </div>
            <Button
              size="sm"
              :variant="isEditingMedical ? 'primary' : 'outline'"
              @click="isEditingMedical = !isEditingMedical"
            >
              {{ isEditingMedical ? '完成编辑' : '编辑指标' }}
            </Button>
          </div>

          <Card v-for="(cat, idx) in medicalData" :key="idx" class="p-0 overflow-hidden">
            <div @click="toggleCat(cat.title)" class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-100/80 transition-colors select-none">
              <Stethoscope class="w-4 h-4 text-[#1677FF]" />
              <h3 class="font-bold text-gray-900 text-sm">{{ cat.title }}</h3>
              <span class="text-[10px] text-gray-400">{{ cat.items.length }} 项</span>
              <ChevronDown :class="['ml-auto w-4 h-4 text-gray-400 transition-transform duration-300', collapsedCats.has(cat.title) ? '-rotate-90' : '']" />
            </div>
            <div v-show="!collapsedCats.has(cat.title)" class="divide-y divide-gray-100">
              <div v-for="(item, iIdx) in cat.items" :key="iIdx" class="p-4">
                <div class="flex justify-between items-center mb-3">
                  <div class="font-medium text-gray-900 text-sm">{{ item.name }}</div>
                  <div class="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                    参考: {{ item.normalRange }} {{ item.unit }}
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-gray-50 p-2 rounded flex flex-col justify-center items-center">
                    <span class="text-[10px] text-gray-500 mb-1">开始时</span>
                    <div class="text-sm w-full flex justify-center">
                      <input
                        v-if="isEditingMedical"
                        type="number"
                        inputmode="decimal"
                        class="w-20 text-center rounded border border-gray-200 p-1 text-sm focus:border-[#0B6BCB] outline-none"
                        :value="item.beforeValue === null ? '' : item.beforeValue"
                        @input="handleMedicalChange(idx, iIdx, 'beforeValue', ($event.target as HTMLInputElement).value)"
                        placeholder="未检测"
                      />
                      <span v-else :class="item.isBeforeOut ? 'text-orange-500 font-bold' : 'text-gray-900 font-medium'">
                        <span v-if="item.beforeValue === null" class="text-gray-400 font-normal">-- 未上传</span>
                        <template v-else>{{ item.beforeValue }}</template>
                      </span>
                      <span v-if="!isEditingMedical && item.beforeValue !== null && item.unit" class="text-[10px] text-gray-500 ml-1">{{ item.unit }}</span>
                    </div>
                  </div>
                  <div class="bg-[#0B6BCB]/5 p-2 rounded flex flex-col justify-center items-center border border-[#0B6BCB]/10">
                    <span class="text-[10px] text-[#0B6BCB] font-medium mb-1">结束时</span>
                    <div class="text-sm w-full flex justify-center">
                      <input
                        v-if="isEditingMedical"
                        type="number"
                        inputmode="decimal"
                        class="w-20 text-center rounded border border-gray-200 p-1 text-sm focus:border-[#0B6BCB] outline-none"
                        :value="item.afterValue === null ? '' : item.afterValue"
                        @input="handleMedicalChange(idx, iIdx, 'afterValue', ($event.target as HTMLInputElement).value)"
                        placeholder="未检测"
                      />
                      <span v-else :class="item.isAfterOut ? 'text-orange-500 font-bold' : 'text-gray-900 font-medium'">
                        <span v-if="item.afterValue === null" class="text-gray-400 font-normal">-- 待更新</span>
                        <template v-else>{{ item.afterValue }}</template>
                      </span>
                      <span v-if="!isEditingMedical && item.afterValue !== null && item.unit" class="text-[10px] text-gray-500 ml-1">{{ item.unit }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </template>

      <!-- Questionnaire tab -->
      <template v-if="activeTab === 'questionnaire'">
        <div class="space-y-4">
          <Card>
            <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <FileText class="h-4 w-4 text-[#0B6BCB]" />
              学员体检报告
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <template v-if="qData?.medicalReports && qData.medicalReports.length > 0">
                <div
                  v-for="(r, idx) in qData.medicalReports"
                  :key="idx"
                  class="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-[#0B6BCB]"
                  @click="openReport(r)"
                >
                  <div v-if="r.type === 'pdf'" class="w-full min-h-full flex flex-col items-center justify-center bg-gray-50 text-[#0B6BCB]">
                    <FileText class="w-8 h-8 mb-1" />
                    <span class="text-[10px] text-gray-500 truncate px-1">{{ r.name || 'PDF报告' }}</span>
                  </div>
                  <img loading="lazy" decoding="async" v-else :src="r.url" :alt="`报告 ${idx + 1}`" class="w-full min-h-full object-cover" />
                  <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-2 truncate">
                    {{ r.type === 'pdf' ? (r.name || `体检报告_第${idx + 1}页`) : `体检报告_第${idx + 1}页` }}
                  </div>
                </div>
              </template>
              <div v-else class="col-span-2 text-center text-xs text-gray-400 py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                暂无体检报告
              </div>
            </div>
          </Card>

          <Card>
            <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <ClipboardList class="h-4 w-4 text-[#0B6BCB]" />
              基础与健康信息
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">身高</span><span class="text-gray-900">{{ qData?.height || '170' }} cm</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">体重</span><span class="text-gray-900">{{ qData?.weight || '65' }} kg</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">疾病史/慢性疾病</span><span class="text-gray-900">{{ qData?.hasChronic === '有' ? qData.chronicDetails : (qData?.hasChronic === '无' ? '无' : '无') }}</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">特殊饮食</span><span class="text-gray-900">{{ qData?.hasSpecialDiet === '有' ? qData.specialDietDetails : (qData?.hasSpecialDiet === '无' ? '无' : '无') }}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">过敏史/食物过敏</span><span class="text-gray-900">{{ qData?.hasFoodAllergy === '有' ? qData.foodAllergyDetails : (qData?.hasFoodAllergy === '无' ? '无' : '无') }}</span></div>
            </div>
          </Card>

          <Card>
            <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <AlertCircle class="h-4 w-4 text-[#0B6BCB]" />
              生活与运动习惯
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">作息时间</span><span class="text-gray-900">{{ qData?.sleepTime || '23:00' }} - {{ qData?.wakeTime || '07:00' }} ({{ qData?.sleepDuration || '8' }}h)</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">饮酒/吸烟</span><span class="text-gray-900">{{ qData?.drinkAlcohol || '偶尔' }} / {{ qData?.smoke || '从不' }}</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">经常吃零食</span><span class="text-gray-900">{{ qData?.snack || '否' }}</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">日饮水量</span><span class="text-gray-900">{{ qData?.dailyWater || '2000' }} ml</span></div>
              <div class="flex justify-between border-b border-gray-50 pb-2"><span class="text-gray-500">每周运动</span><span class="text-gray-900">{{ qData?.exerciseFrequency || '3' }}次 (每次{{ qData?.exerciseDuration || '45' }}分钟)</span></div>
              <div class="flex justify-between"><span class="text-gray-500">运动类型</span><span class="text-gray-900 text-right">{{ qData?.exerciseTypes ? qData.exerciseTypes.join(', ') : '跑步, 力量训练' }}</span></div>
            </div>
          </Card>
        </div>
      </template>

      </div>

    <!-- 服务批次选择弹窗 -->
    <VanPopup v-model:show="showCampPicker" position="bottom" round>
      <div class="p-4">
        <h3 class="font-bold text-gray-900 text-base mb-3 text-center">选择服务批次</h3>
        <div class="space-y-2">
          <button
            v-for="camp in studentCamps"
            :key="camp.id"
            @click="selectedCampId = camp.id; showCampPicker = false"
            :class="[
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
              selectedCampId === camp.id
                ? 'border-[#FF976A] bg-orange-50 text-[#FF976A]'
                : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50',
            ]"
          >
            <div class="flex-1 text-left min-w-0"><span class="font-medium">{{ camp.name }}</span><div class="text-[10px] text-gray-400 mt-0.5">{{ campDateRange(camp) }}</div></div>
            <span
              v-if="camp.status === 'active'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600"
            >进行中</span>
            <span
              v-else-if="camp.status === 'ended'"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
            >已结束</span>
            <span
              v-else
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-500"
            >未开始</span>
          </button>
        </div>
      </div>
    </VanPopup>
  </div>
</template>
