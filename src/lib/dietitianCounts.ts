import { computed } from 'vue';
import { useAppStore } from '../store/app';
import { latestOrFirstId } from './camps';

/**
 * 营养师端底部 Tabbar 的角标数字（所有营养师页面共用，口径一致）：
 * - unannotatedCount          ：「批注」tab 的待批注数 = 当前营期下未批注（无文本批注）的饮食 + 体重记录数
 * - fulfillmentPendingCount   ：「配置」tab 的角标。奖励/积分发放体系已移除，恒为 0（保留导出供调用方解构）。
 */
export function useDietitianCounts() {
  const store = useAppStore();
  // 统一取所选营期（未选则回落最近一期），保证各页角标为同一口径
  const campId = computed(() => store.selectedCampId || latestOrFirstId(store.camps) || '');
  // 退营学员：与待批注列表 active-only 口径一致，角标不统计（否则出现清不掉的死计数）
  const disabledStudentIds = computed(() => new Set(store.accounts.filter((a) => a.role === 'student' && a.active === false).map((a) => a.id)));

  const unannotatedCount = computed(() => {
    if (!campId.value) return 0;
    const diet = store.getCampDietRecords(campId.value).filter((r) => !r.dietitianComment && !disabledStudentIds.value.has(r.studentId)).length;
    const weight = store.getCampWeightRecords(campId.value).filter((r) => !r.dietitianComment && !disabledStudentIds.value.has(r.studentId)).length;
    return diet + weight;
  });

  // 奖励领取 / 积分兑换已随产品转型移除（无待发货订单），配置端角标恒为 0
  const fulfillmentPendingCount = computed(() => 0);

  return { unannotatedCount, fulfillmentPendingCount };
}