<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { ShieldAlert, Users, CheckCircle2, Plus, Phone, MessageCircle, RotateCcw } from 'lucide-vue-next';
import type { Referral } from '../types';

const store = useAppStore();

const open = computed(() => store.getOpenReferrals());
const history = computed(() => store.referrals.filter((r) => r.status === 'done'));

// 处置
const closeId = ref<string | null>(null);
const closeNote = ref('');
const showClose = ref(false);

// 新建转介
const showCreate = ref(false);
const createStudentId = ref('');
const createIndicators = ref('');
const createReason = ref('');
const createMethod = ref<'phone' | 'wechat' | 'retest'>('retest');
const createContact = ref('');
const createRisk = ref<'watch' | 'refer'>('refer');

const allStudents = computed(() => store.getAllStudents());

const openClose = (r: Referral) => {
  closeId.value = r.id;
  closeNote.value = r.opsNote || '';
  showClose.value = true;
};
const doClose = () => {
  if (closeId.value) store.closeReferral(closeId.value, closeNote.value.trim());
  showClose.value = false;
  showToast('已闭环，转介线索已登记运营台账');
};

const doCreate = () => {
  if (!createStudentId.value) { showToast('请选择学员'); return; }
  if (!createReason.value.trim()) { showToast('请填写转介原因'); return; }
  store.addReferral({
    studentId: createStudentId.value,
    indicatorNames: createIndicators.value.split(/[,，、\s]+/).filter(Boolean),
    riskLevel: createRisk.value,
    reason: createReason.value.trim(),
    doctorId: store.user?.id || 'doc1',
    doctorName: store.user?.name || '医生',
    method: createMethod.value,
    contactValue: createContact.value.trim() || '建议线下复测/至医院相关科室进一步评估',
  });
  showCreate.value = false;
  createStudentId.value = ''; createIndicators.value = ''; createReason.value = ''; createContact.value = '';
  showToast('已登记就医转介建议');
};

const methodLabel: Record<Referral['method'], string> = { phone: '电话', wechat: '微信', retest: '建议复测' };
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#FFF1F1] to-[#FFFCFB]">
    <NavBar title="异常预警 · 就医转介" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showCreate = true" class="flex items-center gap-1 text-sm font-bold text-red-500"><Plus class="w-4 h-4" /> 新建</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-red-50 border border-red-100 p-3 leading-relaxed">
        指标趋势异常 → 给出<b>就医转介建议</b>（二维码/电话/微信，交线下医院）。平台不做医疗处置与下医嘱；转介结果回填 → 运营端线索台账可复盘。
      </div>

      <div class="text-sm font-bold text-gray-900">待处置 ({{ open.length }})</div>
      <template v-if="open.length > 0">
        <div v-for="r in open" :key="r.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="h-9 w-9 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"><ShieldAlert class="h-5 w-5" /></div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-gray-900">{{ store.studentName(r.studentId) }}</div>
              <div class="text-[11px] text-gray-400">{{ r.createdAt.slice(0, 16) }}</div>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{{ r.riskLevel === 'refer' ? '需干预' : '需关注' }}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="ind in r.indicatorNames" :key="ind" class="px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px]">{{ ind }}</span>
          </div>
          <div class="text-[12px] text-gray-600 leading-relaxed">{{ r.reason }}</div>
          <div class="flex items-center gap-1.5 text-[12px] text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
            <Phone v-if="r.method === 'phone'" class="w-3.5 h-3.5" /><MessageCircle v-else-if="r.method === 'wechat'" class="w-3.5 h-3.5" /><RotateCcw v-else class="w-3.5 h-3.5" />
            {{ methodLabel[r.method] }} · {{ r.contactValue }}
          </div>
          <button @click="openClose(r)" class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold active:opacity-90">
            <CheckCircle2 class="w-4 h-4" /> 登记闭环
          </button>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-8 rounded-2xl bg-white/60">暂无待处置转介</div>

      <template v-if="history.length > 0">
        <div class="text-sm font-bold text-gray-900 pt-2">已闭环 ({{ history.length }})</div>
        <div v-for="r in history" :key="r.id" class="rounded-2xl bg-white/50 border border-gray-100 p-3 text-[12px] text-gray-600 space-y-1">
          <div class="flex justify-between">
            <span class="font-bold text-gray-800">{{ store.studentName(r.studentId) }}</span>
            <span class="text-gray-400">{{ r.closedAt?.slice(5, 16) }}</span>
          </div>
          <div>转介方式：{{ methodLabel[r.method] }} · {{ r.contactValue }}</div>
          <div class="text-gray-500">运营备注：{{ r.opsNote || '—' }}</div>
        </div>
      </template>
    </div>

    <!-- 处置弹窗 -->
    <VanPopup v-model:show="showClose" position="bottom" round class="custom-popup">
      <div class="p-5">
        <h3 class="text-base font-bold text-gray-900 mb-4 text-center">登记转介闭环</h3>
        <textarea v-model="closeNote" rows="3" placeholder="运营跟进备注（电话/微信/复测结果）…" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-red-400 focus:outline-none resize-none mb-4" />
        <button @click="doClose" class="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold active:opacity-90">
          确认闭环
        </button>
      </div>
    </VanPopup>

    <!-- 新建转介弹窗 -->
    <VanPopup v-model:show="showCreate" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">新建就医转介建议</h3>
        <select v-model="createStudentId" class="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-red-400 focus:outline-none">
          <option value="">选择学员</option>
          <option v-for="s in allStudents" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <input v-model="createIndicators" placeholder="触发指标（空格/逗号分隔）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        <textarea v-model="createReason" rows="2" placeholder="转介原因" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none resize-none" />
        <div class="flex gap-2">
          <button :class="['flex-1 py-2.5 rounded-xl text-sm font-bold border-2', createMethod === 'retest' ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500']" @click="createMethod = 'retest'">建议复测</button>
          <button :class="['flex-1 py-2.5 rounded-xl text-sm font-bold border-2', createMethod === 'phone' ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500']" @click="createMethod = 'phone'">电话</button>
          <button :class="['flex-1 py-2.5 rounded-xl text-sm font-bold border-2', createMethod === 'wechat' ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500']" @click="createMethod = 'wechat'">微信</button>
        </div>
        <input v-model="createContact" placeholder="线下医院/HCP 承接联系方式（可选）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        <button @click="doCreate" class="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold active:opacity-90">登记转介</button>
      </div>
    </VanPopup>
  </div>
</template>