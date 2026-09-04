<script setup lang="ts">
import { computed } from 'vue';
import { Activity, HeartPulse, Bell, UserRound } from 'lucide-vue-next';
import { Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant';
import { useAppStore } from '../../store/app';
import type { View } from '../../store/app';

/**
 * 学员端底部主导航（首页/健康/消息/我的）。共用，杜绝手写高亮索引复制错位(曾「档案页亮活动」)。
 *
 * 服务配置化：底部菜单数随「服务产品」开关联动——健康减重开=显示首页，慢病管理开=显示健康(慢病看台)；
 * 消息与我的（个人功能）常驻。demo 默认两服务全开 → 四个菜单。
 *
 * 高亮索引由 anchor 锚点在「可见 tab 列表」里的位置推导。props.anchor: 本页要高亮的 tab
 * （语义键，非索引）。当 anchor 不在列表中（如该服务关闭/不可达子页），回退高亮第一个可见 tab。
 */
type Anchor = 'dashboard' | 'health' | 'messages' | 'mine';

const props = defineProps<{
  anchor: Anchor;
  badge?: number; // 消息未读数：主页面传各自口径；当前就在消息页(anchor=messages)时不展示徽标
  printHidden?: boolean; // 打印/长图导出时隐藏底部栏(个人历程/个人服务报告用)
}>();

const store = useAppStore();

type Tab = { key: Anchor; label: string; view: View };
const ICONS: Record<Anchor, typeof Activity> = {
  dashboard: Activity,
  health: HeartPulse,
  messages: Bell,
  mine: UserRound,
};

const tabs = computed<Tab[]>(() => {
  const list: Tab[] = [];
  if (store.enabledServices.bmi) list.push({ key: 'dashboard', label: '首页', view: 'dashboard' });
  if (store.enabledServices.chronic) list.push({ key: 'health', label: '健康', view: 'chronic-dashboard' });
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