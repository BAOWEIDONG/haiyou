<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { Package, Plus, Users } from 'lucide-vue-next';

const store = useAppStore();
const showAdd = ref(false);
const name = ref('');
const startDate = ref('');
const endDate = ref('');

const packs = computed(() => [...store.camps].sort((a, b) => a.name.localeCompare(b.name)));
const memberXd = (id: string) => store.accounts.filter((a) => a.role === 'student' && a.campIds?.includes(id)).length;

const statusMeta = (s: string) =>
  s === 'active' ? { t: '服务中', cls: 'bg-green-100 text-green-600' }
  : s === 'upcoming' ? { t: '待启用', cls: 'bg-blue-100 text-blue-500' }
  : { t: '已结束', cls: 'bg-gray-100 text-gray-500' };

const doAdd = () => {
  if (!name.value.trim()) { showToast('请输入服务包/权益批次名'); return; }
  store.addCamp({ id: `camp_${Date.now()}`, name: name.value.trim(), startDate: startDate.value, endDate: endDate.value, status: 'upcoming' });
  showAdd.value = false;
  name.value = ''; startDate.value = ''; endDate.value = '';
  showToast('已创建权益批次');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="服务包与权益" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showAdd = true" class="flex items-center gap-1 text-sm font-bold text-[#8B5CF6]"><Plus class="w-4 h-4" /> 新建</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        按「企业采购 → 医院生成<b>权益服务包批次</b> → 发放员工」维护。每批次可含多个员工；C 端不预建账号，员工凭权益码自助激活建档。
      </div>

      <div v-for="p in packs" :key="p.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-2 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center"><Package class="h-4 w-4" /></div>
            <span class="text-sm font-bold text-gray-900">{{ p.name }}</span>
          </div>
          <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', statusMeta(p.status).cls]">{{ statusMeta(p.status).t }}</span>
        </div>
        <div class="flex items-center gap-4 text-[11px] text-gray-400">
          <span>有效：{{ p.startDate || '—' }} ~ {{ p.endDate || '—' }}</span>
          <span class="flex items-center gap-0.5"><Users class="w-3 h-3" /> {{ memberXd(p.id) }} 名员工</span>
        </div>
      </div>
    </div>

    <VanPopup v-model:show="showAdd" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">新建权益服务包批次</h3>
        <input v-model="name" placeholder="批次名（如：企业A · 减重服务包 第1期）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none" />
        <div class="flex gap-2">
          <input v-model="startDate" type="date" class="flex-1 p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
          <input v-model="endDate" type="date" class="flex-1 p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        </div>
        <button @click="doAdd" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认创建</button>
      </div>
    </VanPopup>
  </div>
</template>