<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { PhoneCall, CheckCircle2 } from 'lucide-vue-next';

const store = useAppStore();
const closeId = ref<string | null>(null);
const closeNote = ref('');
const showClose = ref(false);
const tab = ref<'open' | 'all'>('open');

const rows = computed(() => {
  const all = [...store.referrals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return tab.value === 'open' ? all.filter((r) => r.status === 'open') : all;
});

const methodLabel = { phone: '电话', wechat: '微信', retest: '建议复测' };

const openClose = (id: string) => { closeId.value = id; closeNote.value = ''; showClose.value = true; };
const doClose = () => {
  if (closeId.value) store.closeReferral(closeId.value, closeNote.value.trim());
  showClose.value = false;
  showToast('已登记闭环');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="私域转介台账" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        电话/微信私域跟进线索与就医转介凭证登记，便于溯源复盘。<b>本平台不提供医疗处置</b>；转介交付线下医院/HCP 承接。
      </div>

      <div class="flex gap-2">
        <button v-for="t in (['open','all'] as const)" :key="t" @click="tab = t"
          :class="['px-3 py-1.5 rounded-full text-[12px] font-bold border-2', tab === t ? 'border-[#8B5CF6] text-[#8B5CF6] bg-white' : 'border-transparent text-gray-500 bg-white/60']">
          {{ t === 'open' ? '待跟进' : '全部' }}
        </button>
      </div>

      <div v-for="r in rows" :key="r.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center"><PhoneCall class="h-4 w-4" /></div>
            <span class="text-sm font-bold text-gray-900">{{ store.studentName(r.studentId) }}</span>
          </div>
          <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', r.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600']">
            {{ r.status === 'open' ? '待跟进' : '已闭环' }}
          </span>
        </div>
        <div class="text-[12px] text-gray-600">{{ r.reason }}</div>
        <div class="flex items-center gap-1.5 text-[11px] text-purple-600 bg-purple-50 rounded-lg px-2.5 py-1.5">
          {{ methodLabel[r.method] }} · {{ r.contactValue }}
        </div>
        <div class="flex justify-between items-center pt-1">
          <div class="text-[11px] text-gray-400">{{ r.createdAt.slice(0, 16) }} · {{ r.doctorName }}</div>
          <button v-if="r.status === 'open'" @click="openClose(r.id)" class="flex items-center gap-1 text-[12px] font-bold text-[#8B5CF6]">
            <CheckCircle2 class="w-3.5 h-3.5" /> 登记闭环
          </button>
        </div>
        <div v-if="r.opsNote" class="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">备注：{{ r.opsNote }}</div>
      </div>
      <div v-if="rows.length === 0" class="text-center text-xs text-gray-400 py-10">暂无转介线索</div>
    </div>

    <VanPopup v-model:show="showClose" position="bottom" round class="custom-popup">
      <div class="p-5">
        <h3 class="text-base font-bold text-gray-900 mb-4 text-center">登记跟进闭环</h3>
        <textarea v-model="closeNote" rows="3" placeholder="私域跟进结果/复测回填备注…" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none resize-none mb-4" />
        <button @click="doClose" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认闭环</button>
      </div>
    </VanPopup>
  </div>
</template>