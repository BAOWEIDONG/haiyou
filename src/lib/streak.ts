/**
 * ============================================================================
 *  连续打卡 - 业务规则计算引擎
 * ============================================================================
 *
 *  核心概念:
 *    "完成当天" = 早餐 ✓ + 午餐 ✓ + 晚餐 ✓ + 运动 ✓ + 体重 ✓（五项缺一不可）
 *    加餐 不影响"完成当天"判定。
 *
 *  连续打卡天数 (streak):
 *    从今天开始往前数，遇到第一个"未完成"的日期即停止。
 *    中断一天即归零，重新累计。
 *
 *  前端计算 vs 后端计算:
 *    当前由前端从打卡记录实时计算（无需额外接口）。
 *    后端如需预计算，可实现 GET /me/streak-status 返回相同结构。
 * ============================================================================
 */
import { format, addDays } from 'date-fns';
import type { ExerciseRecord, DietRecord, WeightRecord } from '../types';

export interface StreakResult {
  /** 当前连续打卡天数（从今天往前数，遇到未完成即停） */
  currentStreak: number;
  /** 累计打卡天数（有任意打卡记录的日期数，含部分打卡） */
  totalDays: number;
  /** 当前连续段的起始日期 (yyyy-MM-dd)，streak=0 时为 null */
  streakStartDate: string | null;
}

/**
 * 检查某天是否完成全部打卡
 *
 * 完成条件（五项全部满足）:
 *   1. 有一条 breakfast 饮食记录
 *   2. 有一条 lunch 饮食记录
 *   3. 有一条 dinner 饮食记录
 *   4. 至少有一条运动记录
 *   5. 至少有一条体重记录
 *
 * 不影响完成判定的:
 *   - 加餐 (snack) 记录（可选）
 *
 * @param dateStr    日期字符串 "yyyy-MM-dd"
 * @param exercises  全部运动记录
 * @param diets      全部饮食记录
 * @param weights    全部体重记录
 * @param userId     学员 ID（用于多学员数据过滤）
 */
export function isDayComplete(
  dateStr: string,
  exercises: ExerciseRecord[],
  diets: DietRecord[],
  weights: WeightRecord[],
  userId?: string
): boolean {
  // 严格按学员匹配：记录必须属于当前用户（不再把缺 studentId 的他人记录算进来，
  // 否则会出现"我 22 号才开始打卡，21 号的礼物却能领取"的问题）
  const mine = (r: { studentId?: string }) => !userId || r.studentId === userId;
  const hasBreakfast = diets.some(r =>
    r.date.startsWith(dateStr) && r.meal === 'breakfast' && mine(r)
  );
  const hasLunch = diets.some(r =>
    r.date.startsWith(dateStr) && r.meal === 'lunch' && mine(r)
  );
  const hasDinner = diets.some(r =>
    r.date.startsWith(dateStr) && r.meal === 'dinner' && mine(r)
  );
  const hasExercise = exercises.some(r =>
    r.date.startsWith(dateStr) && mine(r)
  );
  const hasWeight = weights.some(r =>
    r.date.startsWith(dateStr) && mine(r)
  );
  return hasBreakfast && hasLunch && hasDinner && hasExercise && hasWeight;
}

/**
 * 计算连续打卡天数
 *
 * 算法:
 *   1. 从今天 (today) 开始，调用 isDayComplete 往前逐天检查
 *   2. 遇到第一个"未完成"的日期即停止
 *   3. streak = 连续完成的天数
 *   4. streakStartDate = today - (streak - 1) 天
 *
 * totalDays:
 *   统计所有有任意打卡记录（饮食/运动/体重）的不同日期数。
 *   包含部分打卡的日期（如只打了早餐没打运动）。
 *
 * @returns StreakResult
 */
export function calculateStreak(
  exercises: ExerciseRecord[],
  diets: DietRecord[],
  weights: WeightRecord[],
  userId?: string
): StreakResult {
  // 收集所有有任意打卡记录的日期（用于计算总打卡天数）
  const anyCheckinDates = new Set<string>();
  exercises.forEach(r => { if (!userId || r.studentId === userId) anyCheckinDates.add(r.date.substring(0, 10)); });
  diets.forEach(r => { if (!userId || r.studentId === userId) anyCheckinDates.add(r.date.substring(0, 10)); });
  weights.forEach(r => { if (!userId || r.studentId === userId) anyCheckinDates.add(r.date.substring(0, 10)); });

  const total = anyCheckinDates.size;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 从今天开始往前数连续完成全部打卡的天数
  // 注意：如果今天尚未完成全部打卡（如还没到晚餐时间），
  // 则从昨天开始计算，避免日间 streak 归零导致已解锁奖品重新锁定
  let streak = 0;
  let checkDate = todayStr;

  if (!isDayComplete(checkDate, exercises, diets, weights, userId)) {
    // 今天尚未完成，从昨天开始算
    checkDate = format(addDays(new Date(checkDate), -1), 'yyyy-MM-dd');
  }

  while (isDayComplete(checkDate, exercises, diets, weights, userId)) {
    streak++;
    checkDate = format(addDays(new Date(checkDate), -1), 'yyyy-MM-dd');
  }

  // 当前连续段的起始日期
  const streakStartDate = streak > 0
    ? format(addDays(new Date(todayStr), -(streak - (isDayComplete(todayStr, exercises, diets, weights, userId) ? 1 : 0))), 'yyyy-MM-dd')
    : null;

  return { currentStreak: streak, totalDays: total, streakStartDate };
}

/**
 * 计算营期区间内的最长连续完成天数（健康行为维度）
 *
 * 在 [startDate, endDate]（含）区间内逐日判断"当天是否五项全完成"，
 * 返回最大连续完成段的天数，用于评估用户在周期内的坚持度。
 *
 * @param startDate  区间起点
 * @param endDate    区间终点
 */
export function calculateLongestStreakInRange(
  startDate: string,
  endDate: string,
  exercises: ExerciseRecord[],
  diets: DietRecord[],
  weights: WeightRecord[],
  userId?: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return 0;
  let longest = 0;
  let run = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dStr = format(d, 'yyyy-MM-dd');
    if (isDayComplete(dStr, exercises, diets, weights, userId)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest;
}