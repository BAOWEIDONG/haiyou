/**
 * ============================================================================
 *  结营报告 & 统计 - 核心数据计算引擎
 * ============================================================================
 *
 *  本文件是结营报告的**唯一数据源**，前端 UI 和后端 API 均可直接调用，
 *  不需要修改任何计算逻辑。
 *
 *  核心概念:
 *    "完成当天" = 早餐 ✓ + 午餐 ✓ + 晚餐 ✓ + 运动 ✓ + 体重 ✓（五项缺一不可，与 streak.ts isDayComplete 一致）
 *    "打卡天数" = 有任意打卡记录（饮食/运动/体重）的天数
 *    "营期"    = 28 天（可通过 campDays 参数自定义）
 *
 *  指标改善方向:
 *    每个指标有"好方向"：lower（越低越好）或 higher（越高越好）。
 *    判断依据：指标名称匹配 METRIC_DIRECTION 映射表。
 *    改善 = 变化方向与好方向一致 && 变化量 ≠ 0。
 *    同时检查异常→正常的转化作为附加信号。
 *
 *  使用方式:
 *    const report = generateStudentReport(student, configs, values, diets, exercises, weights);
 *
 *  前后端对接:
 *    - 前端：直接调用本文件函数，传入 store 中的数据
 *    - 后端：实现 GET /camp/student-report?studentId=xxx 返回 StudentCampReport
 *            计算逻辑应与本文件保持一致
 * ============================================================================
 */
import { differenceInCalendarDays } from 'date-fns';
import type {
  MetricConfig,
  DietRecord,
  ExerciseRecord,
  WeightRecord,
  MetricChange,
  CheckinStats,
  WeightTrend,
  StudentCampReport,
} from '../types';
import type { MetricValue } from './medicalData';
import { isValueOutOfRange } from './medicalData';
import { isDayComplete, calculateStreak } from './streak';
import { calculateDietScore } from './scoring';

/** 训练营默认天数 */
export const DEFAULT_CAMP_DAYS = 28;

/**
 * 指标改善方向映射表
 * - lower: 值降低为改善（如体重、脂肪、胆固醇）
 * - higher: 值升高为改善（如肌肉量、基础代谢率）
 * 未在表中的指标默认为 null（无法判断方向，仅看异常→正常转化）
 */
const METRIC_DIRECTION: Record<string, 'lower' | 'higher'> = {
  // 身体测量 - lower is better
  '体重': 'lower',
  '脂肪量': 'lower',
  '腰臀比': 'lower',
  '内脏脂肪面积': 'lower',
  '肥胖度': 'lower',
  '浮肿指数': 'lower',
  // 身体测量 - higher is better
  '肌肉量': 'higher',
  '骨骼肌': 'higher',
  '基础代谢率': 'higher',
  '身体细胞量': 'higher',
  '四肢骨骼肌质量指数': 'higher',
  'AINST评分': 'higher',
  // 肝功能 - lower is better（酶类偏高表示损伤）
  '丙氨酸氨基转移酶': 'lower',
  '天门冬氨酸氨基转移酶': 'lower',
  'γ-谷氨酰基转移酶': 'lower',
  '碱性磷酸酶': 'lower',
  '总胆红素': 'lower',
  '直接胆红素': 'lower',
  // 肾功能 - lower is better
  '尿素': 'lower',
  '肌酐': 'lower',
  '尿酸': 'lower',
  // 血脂 - lower is better (except HDL)
  '总胆固醇': 'lower',
  '甘油三酯': 'lower',
  '低密度脂蛋白胆固醇': 'lower',
  '高密度脂蛋白胆固醇': 'higher',
  // 血糖 - lower is better
  '葡萄糖(空腹)': 'lower',
  '糖化血红蛋白': 'lower',
  // 营养指标 - higher is better
  '总蛋白': 'higher',
  '白蛋白': 'higher',
  '前白蛋白': 'higher',
};

/**
 * 计算单个指标的前后变化
 *
 * 改善判断逻辑:
 *   1. 两个值都是数值型
 *   2. 查 METRIC_DIRECTION 获取方向
 *   3. 如果方向 = lower: change < 0 → 改善
 *      如果方向 = higher: change > 0 → 改善
 *   4. 同时检查异常→正常转化（turnedNormal）
 *
 * @param config  指标配置
 * @param value   前后值
 * @param gender  学员性别（用于性别差异化范围判断）
 */
export function computeMetricChange(
  config: MetricConfig,
  value: MetricValue,
  gender?: 'male' | 'female',
): MetricChange {
  const { beforeValue, afterValue } = value;
  const range = config.normalRange || '';

  const beforeAbnormal = isValueOutOfRange(beforeValue, range, gender);
  const afterAbnormal = isValueOutOfRange(afterValue, range, gender);
  const turnedNormal = beforeAbnormal && !afterAbnormal;

  // 计算变化量（仅数值型）
  let change: number | null = null;
  let changePercent: number | null = null;
  if (typeof beforeValue === 'number' && typeof afterValue === 'number') {
    change = afterValue - beforeValue;
    changePercent = beforeValue !== 0 ? (change / Math.abs(beforeValue)) * 100 : null;
  }

  // 判断是否改善
  let isImproved = false;
  const direction = METRIC_DIRECTION[config.name];
  if (change !== null && direction) {
    if (direction === 'lower' && change < 0) isImproved = true;
    if (direction === 'higher' && change > 0) isImproved = true;
  }
  // 异常转正常也算改善
  if (turnedNormal) isImproved = true;

  return {
    configId: config.id,
    name: config.name,
    unit: config.unit,
    category: config.category,
    normalRange: range,
    beforeValue,
    afterValue,
    change,
    changePercent,
    isImproved,
    beforeAbnormal,
    afterAbnormal,
    turnedNormal,
  };
}

/**
 * 计算所有指标的前后变化
 */
export function computeMetricChanges(
  configs: MetricConfig[],
  values: Record<string, MetricValue>,
  gender?: 'male' | 'female',
): MetricChange[] {
  return configs.map((config) => {
    const v = values[config.id] || { beforeValue: null, afterValue: null };
    return computeMetricChange(config, v, gender);
  });
}

/**
 * 计算打卡频率统计
 *
 * 统计内容:
 *   - totalCheckinDays:  有任意打卡记录的不同日期数
 *   - completeDays:      完成全部5项（三餐+运动+体重）的天数
 *   - completionRate:    completeDays / campDays
 *   - currentStreak:     当前连续完成天数（从今天往前数）
 *   - longestStreak:     营期内最长连续完成天数
 *   - totalExerciseDuration: 所有运动记录时长之和
 *   - totalDietScore:    饮食总得分（每日封顶6分，与 scoring.ts calculateDietScore 一致）
 *
 * @param dietRecords     学员的饮食记录
 * @param exerciseRecords 学员的运动记录
 * @param weightRecords   学员的体重记录
 * @param campDays        营期天数（默认28）
 */
export function computeCheckinStats(
  dietRecords: DietRecord[],
  exerciseRecords: ExerciseRecord[],
  weightRecords: WeightRecord[],
  campDays: number = DEFAULT_CAMP_DAYS,
  userId?: string,
): CheckinStats {
  // 收集所有有打卡记录的日期
  const checkinDates = new Set<string>();
  const dietDates = new Set<string>();
  const exerciseDates = new Set<string>();
  const weightDates = new Set<string>();

  dietRecords.forEach((r) => {
    const d = r.date.substring(0, 10);
    checkinDates.add(d);
    dietDates.add(d);
  });
  exerciseRecords.forEach((r) => {
    const d = r.date.substring(0, 10);
    checkinDates.add(d);
    exerciseDates.add(d);
  });
  weightRecords.forEach((r) => {
    const d = r.date.substring(0, 10);
    checkinDates.add(d);
    weightDates.add(d);
  });

  // 计算完成天数
  const allDates = Array.from(checkinDates).sort();
  let completeDays = 0;
  for (const d of allDates) {
    if (isDayComplete(d, exerciseRecords, dietRecords, weightRecords, userId)) {
      completeDays++;
    }
  }

  // 计算最长连续完成天数
  // 遍历所有打卡日期，找出最长连续 isDayComplete 的段
  let longestStreak = 0;
  let currentRun = 0;
  let prevDate: string | null = null;
  for (const d of allDates) {
    const isComplete = isDayComplete(d, exerciseRecords, dietRecords, weightRecords, userId);
    if (isComplete) {
      if (prevDate && differenceInCalendarDays(new Date(d), new Date(prevDate)) === 1) {
        currentRun++;
      } else {
        currentRun = 1;
      }
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 0;
    }
    prevDate = d;
  }

  // 也检查当前 streak（从今天往前数）
  const streakResult = calculateStreak(exerciseRecords, dietRecords, weightRecords, userId);

  // 总运动时长
  const totalExerciseDuration = exerciseRecords.reduce((sum, r) => sum + r.duration, 0);

  // 饮食总得分
  const totalDietScore = calculateDietScore(dietRecords);

  return {
    campDays,
    totalCheckinDays: checkinDates.size,
    completeDays,
    completionRate: campDays > 0 ? completeDays / campDays : 0,
    dietCheckinDays: dietDates.size,
    exerciseCheckinDays: exerciseDates.size,
    weightCheckinDays: weightDates.size,
    totalDietRecords: dietRecords.length,
    totalExerciseRecords: exerciseRecords.length,
    totalWeightRecords: weightRecords.length,
    currentStreak: streakResult.currentStreak,
    longestStreak: Math.max(longestStreak, streakResult.currentStreak),
    totalExerciseDuration,
    totalDietScore,
  };
}

/**
 * 计算体重趋势
 *
 * 趋势判断:
 *   - insufficient: 少于2条记录，无法判断
 *   - decreasing:   末值 < 首值（减重）
 *   - increasing:   末值 > 首值（增重）
 *   - stable:       末值 = 首值 或变化 < 0.1kg
 *
 * @param weightRecords 学员的体重记录（无需预排序，函数内按日期排序）
 */
export function computeWeightTrend(weightRecords: WeightRecord[]): WeightTrend {
  if (weightRecords.length === 0) {
    return {
      records: [],
      startWeight: null,
      endWeight: null,
      totalChange: null,
      changePercent: null,
      trend: 'insufficient',
    };
  }

  // 按日期排序
  const sorted = [...weightRecords].sort((a, b) => a.date.localeCompare(b.date));
  const records = sorted.map((r) => ({
    date: r.date.substring(0, 10),
    weight: r.weight,
  }));

  const startWeight = records[0].weight;
  const endWeight = records[records.length - 1].weight;
  const totalChange = endWeight - startWeight;
  const changePercent = startWeight !== 0 ? (totalChange / Math.abs(startWeight)) * 100 : null;

  let trend: WeightTrend['trend'] = 'stable';
  if (records.length < 2) {
    trend = 'insufficient';
  } else if (totalChange < -0.1) {
    trend = 'decreasing';
  } else if (totalChange > 0.1) {
    trend = 'increasing';
  }

  return {
    records,
    startWeight,
    endWeight,
    totalChange,
    changePercent,
    trend,
  };
}

/**
 * 生成学员结营报告
 *
 * 这是学员端结营报告的唯一入口函数。
 * 传入原始数据，返回完整的 StudentCampReport 结构。
 *
 * @param student         学员信息 { id, name, gender }
 * @param metricConfigs   指标配置列表
 * @param metricValues    该学员的指标值（key = configId）
 * @param dietRecords     该学员的饮食记录
 * @param exerciseRecords 该学员的运动记录
 * @param weightRecords   该学员的体重记录
 * @param campDays        营期天数（默认28）
 */
export function generateStudentReport(
  student: { id: string; name: string; gender?: 'male' | 'female' },
  metricConfigs: MetricConfig[],
  metricValues: Record<string, MetricValue>,
  dietRecords: DietRecord[],
  exerciseRecords: ExerciseRecord[],
  weightRecords: WeightRecord[],
  campDays: number = DEFAULT_CAMP_DAYS,
): StudentCampReport {
  // 1. 打卡统计
  const checkinStats = computeCheckinStats(
    dietRecords,
    exerciseRecords,
    weightRecords,
    campDays,
    student.id,
  );

  // 2. 体重趋势
  const weightTrend = computeWeightTrend(weightRecords);

  // 3. 指标变化
  const metricChanges = computeMetricChanges(metricConfigs, metricValues, student.gender);

  // 4. 核心摘要
  const weightLossKg = weightTrend.totalChange !== null ? -weightTrend.totalChange : null;
  const weightLossPercent = weightTrend.changePercent !== null ? -weightTrend.changePercent : null;

  const fatChange = metricChanges.find((m) => m.name === '脂肪量')?.change ?? null;
  const muscleChange = metricChanges.find((m) => m.name === '肌肉量')?.change ?? null;
  const visceralChange = metricChanges.find((m) => m.name === '内脏脂肪面积')?.change ?? null;

  const abnormalCountBefore = metricChanges.filter((m) => m.beforeAbnormal).length;
  const abnormalCountAfter = metricChanges.filter((m) => m.afterAbnormal).length;
  const abnormalImprovedCount = metricChanges.filter((m) => m.turnedNormal).length;

  return {
    studentId: student.id,
    studentName: student.name,
    gender: student.gender,
    campDays,
    checkinStats,
    weightTrend,
    metricChanges,
    summary: {
      weightLossKg,
      weightLossPercent,
      bodyFatLossKg: fatChange !== null ? -fatChange : null,
      muscleChangeKg: muscleChange,
      visceralFatChange: visceralChange !== null ? -visceralChange : null,
      abnormalCountBefore,
      abnormalCountAfter,
      abnormalImprovedCount,
      totalCheckinDays: checkinStats.totalCheckinDays,
      completionRate: checkinStats.completionRate,
      longestStreak: checkinStats.longestStreak,
      totalExerciseDuration: checkinStats.totalExerciseDuration,
      totalDietScore: checkinStats.totalDietScore,
    },
  };
}

/**
 * 生成体重趋势 SVG 折线图数据
 * 返回可直接用于 SVG polyline 的 points 字符串
 *
 * @param trend     体重趋势数据
 * @param width     SVG 宽度
 * @param height    SVG 高度
 * @param padding   边距
 */
export function weightTrendToSvgPoints(
  trend: WeightTrend,
  width: number = 300,
  height: number = 120,
  padding: number = 20,
): string {
  if (trend.records.length < 2) return '';

  const weights = trend.records.map((r) => r.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const n = trend.records.length;
  return trend.records
    .map((r, i) => {
      const x = padding + (i / (n - 1)) * (width - 2 * padding);
      const y = height - padding - ((r.weight - minW) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
