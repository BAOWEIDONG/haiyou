<script setup lang="ts">
import { computed } from 'vue';
import { Activity, Bell, Stethoscope } from 'lucide-vue-next';
import { Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant';
import { useAppStore } from '../../store/app';
import type { View } from '../../store/app';

/**
 * 学员端底部主导航（首页/消息/健康）。共用，杜绝手写高亮索引复制错位(曾「档案页亮活动」)。
 *
 * 高亮索引由 anchor 锚点在「可见 tab 列表」里的位置推导。props.anchor: 本页要高亮的 tab
 * （语义键，非索引）。个人服务报告传 'dashboard'（高亮首页，用户口径）；个人历程传 'dashboard'。
 * 当 anchor 不在列表中（如不可达子页），回退高亮首页。
 */
type Anchor = 'dashboard' | 'messages' | 'health';

const props = defineProps<{
  anchor: Anchor;
  badge?: number; // 消息未读数：主页面传各自口径；当前就在消息页(anchor=messages)时不展示徽标
  printHidden?: boolean; // 打印/长图导出时隐藏底部栏(个人历程/个人服务报告用)
}>();

const store = useAppStore();

const ICONS: Record<Anchor, typeof Activity> = {
  dashboard: Activity,
  messages: Bell,
  health: Stethoscope,
};

const tabs: { key: Anchor; label: string; view: View }[] = [
  { key: 'dashboard', label: '首页', view: 'dashboard' },
  { key: 'messages', label: '消息', view: 'messages' },
  { key: 'health', label: '健康', view: 'my-team' },
];

const modelValue = computed(() => {
  const i = tabs.findIndex((t) => t.key === props.anchor);
  return i < 0 ? 0 : i;
});

function go(key: Anchor) {
  const t = tabs.find((x) => x.key === key);
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