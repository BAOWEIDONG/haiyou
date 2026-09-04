<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { FileSearch, Send, Plus, ArrowLeft } from 'lucide-vue-next';

const store = useAppStore();
// 列表→详情导航：进入先看全部记录列表，点击进入单条对话详情
const selectedId = ref<string | null>(null);
const draft = ref('');

const list = computed(() => (store.user ? store.getStudentInterpretations(store.user.id) : []));
const selectedReq = computed(() => list.value.find((r) => r.id === selectedId.value) || null);

const open = (id: string) => {
  selectedId.value = id;
  draft.value = '';
  store.markInterpretationRead(id);
};
const backToList = () => { selectedId.value = null; draft.value = ''; };
const ask = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入追问'); return; }
  store.followupInterpretation(id, draft.value.trim(), 'user');
  showToast('已发送追问');
  draft.value = '';
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar :title="selectedReq ? '解读对话' : '报告健康解读'" :on-back="selectedReq ? backToList : () => store.goBack()">
      <template #right>
        <button v-if="!selectedReq" @click="store.setCurrentView('interpretation-request')" class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"><Plus class="w-4 h-4" /> 新增</button>
      </template>
    </NavBar>

    <!-- 详情：单条解读对话 -->
    <div v-if="selectedReq" class="flex-1 px-4 py-4 space-y-3">
      <div class="flex items-center justify-between">
        <button @click="backToList" class="text-[#0B6BCB] text-xs font-bold flex items-center gap-1">
          <ArrowLeft class="w-4 h-4" /> 全部解读
        </button>
        <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', selectedReq.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
          {{ selectedReq.status === 'pending' ? '等待解读' : '已解读' }} · {{ selectedReq.createdAt.slice(0, 16) }}
        </span>
      </div>

      <!-- 我的问题 -->
      <div v-if="selectedReq.question" class="rounded-xl bg-blue-50/60 p-3">
        <div class="text-[10px] font-bold text-blue-600 mb-1">我提交的问题</div>
        <div class="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{{ selectedReq.question }}</div>
      </div>

      <!-- 我上传的报告材料 -->
      <div v-if="selectedReq.materialImages && selectedReq.materialImages.length > 0" class="rounded-xl bg-blue-50/60 p-3">
        <div class="text-[10px] font-bold text-blue-600 mb-2 flex items-center gap-1"><FileSearch class="w-3 h-3" /> 我上传的报告材料 · 点击查看</div>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="(img, i) in selectedReq.materialImages"
            :key="i"
            @click="store.openImagePreview(selectedReq.materialImages!, i)"
            class="relative aspect-[3/4] rounded-lg overflow-hidden border border-blue-100 active:opacity-70"
          >
            <img :src="img" loading="lazy" decoding="async" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      <!-- 解读 / 追问对话 -->
      <div v-if="selectedReq.exchanges.length > 0" class="space-y-2">
        <div
          v-for="(ex, i) in selectedReq.exchanges"
          :key="i"
          :class="['p-3 rounded-xl text-[13px] leading-relaxed', ex.side === 'doctor' ? 'bg-[#0B6BCB]/8 mr-8' : 'bg-gray-100 ml-8']"
        >
          <div class="text-[10px] text-gray-400 mb-1">{{ ex.authorName }} · {{ ex.createdAt.slice(5, 16) }}</div>
          {{ ex.text }}
        </div>
      </div>
      <div v-else class="text-xs text-gray-400">
        {{ selectedReq.status === 'pending' ? '医生正在为你解读，完成会通知你' : '医生已解读' }}
      </div>

      <textarea
        v-model="draft"
        rows="2"
        placeholder="继续追问…"
        class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
      />
      <button @click="ask(selectedReq.id)" class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">
        <Send class="w-4 h-4" /> 发送追问
      </button>
    </div>

    <!-- 列表：全部解读记录 -->
    <div v-else class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        查看医生团队给你的健康解读，可继续追问。解读为健康减重建议（非医疗诊断）。
      </div>

      <template v-if="list.length > 0">
        <button
          v-for="req in list" :key="req.id"
          @click="open(req.id)"
          class="w-full text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden"
        >
          <div class="p-4 flex items-center gap-3" :class="req.read === false ? 'bg-blue-50/40' : ''">
            <div class="h-10 w-10 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0"><FileSearch class="h-5 w-5" /></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold" :class="req.read === false ? 'text-[#0B6BCB]' : 'text-gray-700'">
                  {{ req.createdAt.slice(0, 16) }}
                </span>
                <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                  {{ req.status === 'pending' ? '等待解读' : '已解读' }}
                </span>
              </div>
              <div class="text-[12px] text-gray-600 mt-1 line-clamp-2">{{ req.question }}</div>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="ind in req.indicatorNames" :key="ind" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{{ ind }}</span>
              </div>
            </div>
            <div class="text-[11px] text-[#0B6BCB] font-bold shrink-0">查看 ›</div>
          </div>
        </button>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-14">还没有健康解读记录<br/>去档案/趋势里「请医生解读」吧</div>
    </div>
  </div>
</template>