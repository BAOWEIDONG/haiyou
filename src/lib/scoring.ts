/**
 * ============================================================================
 *  饮食质量评分 - 业务规则
 * ============================================================================
 *
 *  饮食质量评分 (dietScore):
 *    - 以学员每餐勾选的膳食结构标签（主食/蛋白质/蔬菜）为饮食质量信号，
 *      不再依赖"积分/打分"体系（产品转型后已移除 dietitianScore 增减分）。
 *    - 每餐结构分 = 勾选的齐全结构项数（hasStaple/hasProtein/hasVegetable，
 *      各 1 分，0~3 分）；满 3 记为均衡一餐。
 *    - 按日聚合，每日所有餐次的得分和，每日封顶 6 分: min(Σ结构分, 6)
 *    - 总分 = 各日积分之和
 *
 *  语义: 该评分作为健康行为/饮食质量维度，供营期报告与个人历程计算使用。
 * ============================================================================
 */
import type { DietRecord } from '../types';

/**
 * 计算饮食质量评分
 *
 * 公式:
 *   1. 每餐结构分 = Σ (hasStaple?1:0, hasProtein?1:0, hasVegetable?1:0)，范围 0~3
 *   2. 按 date (yyyy-MM-dd) 分组，每日 Σ 各餐结构分
 *   3. 每日积分 = min(Σ, 6)（封顶 6 分）
 *   4. 未勾选任何结构标签（）的记录计 0 分
 *   5. 总分 = Σ 各日积分
 *
 * @param records 当前学员的饮食记录
 * @returns 饮食质量总分
 */
export function calculateDietScore(records: DietRecord[]): number {
  const dailyScores: Record<string, number> = {};

  records.forEach(record => {
    const staple = record.hasStaple ? 1 : 0;
    const protein = record.hasProtein ? 1 : 0;
    const vegetable = record.hasVegetable ? 1 : 0;
    const score = staple + protein + vegetable;
    if (score === 0) return;
    const day = record.date.substring(0, 10);
    dailyScores[day] = (dailyScores[day] || 0) + score;
  });

  let totalScore = 0;
  for (const date in dailyScores) {
    totalScore += Math.min(dailyScores[date], 6);
  }

  return totalScore;
}