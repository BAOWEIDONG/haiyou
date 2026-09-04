<script setup lang="ts">
import { computed } from 'vue';
import { Activity, BookOpen, Bell, UserRound } from 'lucide-vue-next';
import { Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant';
import { useAppStore } from '../../store/app';
import type { View } from '../../store/app';

/**
 * 学员端底部主导航（健康 / 活动 / 消息 / 我的）。共用，杜绝手写高亮索引复制错位(曾「档案页亮活动」)。
 *
 * 本轮信息架构重构（2026-09-04）：四个菜单固定常驻——
 *  · 健康 = 统一记录台（减重打卡 + 慢病看台 + 咨询快捷钮），即原「首页」改名；
 *  · 活动 = 科普图文/活动资讯信息流（锻炼活动 | 健康科普），即原「健康」tab 改名；
 *  · 消息 = 消息中心；· 我的 = 个人功能 hub。
 * 服务产品配置化（减重/慢病开关）不再控制菜单显隐，而是控制「健康」主页里的记录入口显隐
 * （详见 StudentDashboardView：减重记录随 enabledServices.bmi、慢病记录随 enabledServices.chronic）。
 *
 * 高亮索引由 anchor 锚点在「可见 tab 列表」里的位置推导。props.anchor: 本页要高亮的 tab
 * （语义键，非索引）。固定四菜单故下标恒等于预设；留回退仍防未知 anchor。
 */
type Anchor = 'health' | 'activity' | 'messages' | 'mine';

const props = defineProps<{
  anchor: Anchor;
  badge?: number; // 消息未读数：主页面传各自口径；当前就在消息页(anchor=messages)时不展示徽标
  printHidden?: boolean; // 打印/长图导出时隐藏底部栏(个人历程/个人服务报告用)
}>();

const store = useAppStore();

type Tab = { key: Anchor; label: string; view: View };
const ICONS: Record<Anchor, typeof Activity> = {
  health: Activity,
  activity: BookOpen,
  messages: Bell,
  mine: UserRound,
};

const tabs = computed<Tab[]>(() => {
  const list: Tab[] = [];
  list.push({ key: 'health', label: '健康', view: 'dashboard' });
  list.push({ key: 'activity', label: '活动', view: 'activity' });
  list.push({ key: 'messages', label: '消息', view: 'messages' });
  list.push({ key: 'mine', label: '我的', view: 'my-team' });
  return list;
});

const modelValue = computed(() => {
  const i = tabs.value.findIndex((t) => t.key === props.anchor);
  return i < 0 ? 0 : i;
});

function go(key: Anchor) {
  const t = tabs.value.find((x) => x.key === key);
  store.setCurrentView(t ? t.view : 'dashboard');
}
</script>

<template>
  <VanTabbar
    class="custom-tabbar"
    :class="printHidden ? 'print:hidden' : ''"
    :model-value="modelValue"
  >
    <VanTabbarItem
      v-for="t in tabs"
      :key="t.key"
      @click="go(t.key)"
      :badge="t.key === 'messages' && anchor !== 'messages' ? badge ?? undefined : undefined"
    >
      <template #icon><component :is="ICONS[t.key]" class="h-6 w-6" /></template>
      {{ t.label }}
    </VanTabbarItem>
  </VanTabbar>
</template>