<script setup lang="ts">
import { computed } from 'vue';
import { Users, FileText, Settings } from 'lucide-vue-next';
import { Tabbar as VanTabbar, TabbarItem as VanTabbarItem } from 'vant';
import { useAppStore } from '../../store/app';
import { useDietitianCounts } from '../../lib/dietitianCounts';
import type { View } from '../../store/app';

/**
 * 营养师端底部主导航（工作台/批注/配置）。医生端与运营端「服务/管理/配置」已并入「配置」tab
 * （DietitianConfigView 内三段：服务[解读/答疑]/管理[账户/服务包/企业看板/科普]/配置[指标]）。
 * 共用组件杜绝手写高亮索引复制错位。
 */
type Anchor = 'workbench' | 'annotate' | 'config';

const props = defineProps<{
  anchor: Anchor;
  printHidden?: boolean; // 打印/长图导出时隐藏底部栏
}>();

const store = useAppStore();
const { unannotatedCount } = useDietitianCounts();

const ICONS: Record<Anchor, typeof Users> = {
  workbench: Users,
  annotate: FileText,
  config: Settings,
};

const tabs: { key: Anchor; label: string }[] = [
  { key: 'workbench', label: '工作台' },
  { key: 'annotate', label: '批注' },
  { key: 'config', label: '配置' },
];

const modelValue = computed(() => {
  const i = tabs.findIndex((t) => t.key === props.anchor);
  return i < 0 ? 0 : i;
});

function go(key: Anchor) {
  const target: Record<Anchor, View> = {
    workbench: 'dietitian-dashboard',
    annotate: 'dietitian-unannotated-list',
    config: 'dietitian-config',
  };
  store.setCurrentView(target[key]);
}
</script>

<template>
  <VanTabbar
    class="custom-tabbar tabbar-orange"
    :class="printHidden ? 'print:hidden' : ''"
    :model-value="modelValue"
  >
    <VanTabbarItem
      v-for="t in tabs"
      :key="t.key"
      @click="go(t.key)"
      :badge="t.key === 'annotate' && anchor !== 'annotate' ? unannotatedCount > 0 ? unannotatedCount : undefined : undefined"
    >
      <template #icon><component :is="ICONS[t.key]" class="h-6 w-6" /></template>
      {{ t.label }}
    </VanTabbarItem>
  </VanTabbar>
</template>