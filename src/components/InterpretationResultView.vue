<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { FileSearch, Send, Plus } from 'lucide-vue-next';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');

const list = computed(() => (store.user ? store.getStudentInterpretations(store.user.id) : []));

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
  draft.value = '';
  if (openId.value) store.markInterpretationRead(id);
};
const ask = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入追问'); return; }
  store.followupInterpretation(id, draft.value.trim(), 'user');
  showToast('已发送追问');
  draft.value = '';
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E9F7FF] to-[#FBFEFF]">
    <NavBar title="报告健康解读" :on-back="() => store.goBack()">
      <template #right>
        <button @click="store.setCurrentView('interpretation-request')" class="flex items-center gap-1 text-sm font-bold text-[#0EA5E9]"><Plus class="w-4 h-4" /> 新增</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        查看医生团队给你的健康解读，可继续追问。解读为健康减重建议（非医疗诊断）。
      </div>

      <template v-if="list.length > 0">
        <div v-for="req in list" :key="req.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden">
          <button @click="toggle(req.id)" class="w-full p-4 text-left">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center shrink-0"><FileSearch class="h-5 w-5" /></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-700">{{ req.createdAt.slice(0, 16) }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                    {{ req.status === 'pending' ? '等待解读' : '已解读' }}
                  </span>
                </div>
                <div class="text-[12px] text-gray-600 mt-1 line-clamp-2">{{ req.question }}</div>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  <span v-for="ind in req.indicatorNames" :key="ind" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{{ ind }}</span>
                </div>
              </div>
              <div class="text-gray-300 text-sm ml-1">›</div>
            </div>
          </button>

          <div v-if="openId === req.id" class="border-t border-gray-100 p-4 space-y-3">
            <!-- 我上传的报告材料 -->
            <div v-if="req.materialImages && req.materialImages.length > 0" class="rounded-xl bg-blue-50/60 p-3">
              <div class="text-[10px] font-bold text-blue-600 mb-2">我上传的报告材料 · 点击查看</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="(img, i) in req.materialImages"
                  :key="i"
                  @click="store.openImagePreview(req.materialImages!, i)"
                  class="relative aspect-[3/4] rounded-lg overflow-hidden border border-blue-100 active:opacity-70"
                >
                  <img :src="img" loading="lazy" decoding="async" class="w-full h-full object-cover" />
                </button>
              </div>
            </div>

            <div v-if="req.exchanges.length > 0" class="space-y-2">
              <div
                v-for="(ex, i) in req.exchanges"
                :key="i"
                :class="['p-3 rounded-xl text-[13px] leading-relaxed', ex.side === 'doctor' ? 'bg-[#0EA5E9]/8 mr-8' : 'bg-gray-100 ml-8']"
              >
                <div class="text-[10px] text-gray-400 mb-1">{{ ex.authorName }} · {{ ex.createdAt.slice(5, 16) }}</div>
                {{ ex.text }}
              </div>
            </div>
            <div v-else class="text-xs text-gray-400">
              {{ req.status === 'pending' ? '医生正在为你解读，完成会通知你' : '医生已解读' }}
            </div>

            <textarea
              v-model="draft"
              rows="2"
              placeholder="继续追问…"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0EA5E9] focus:outline-none resize-none"
            />
            <button @click="ask(req.id)" class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] text-white text-sm font-bold active:opacity-90">
              <Send class="w-4 h-4" /> 发送追问
            </button>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-14">还没有健康解读记录<br/>去档案/趋势里「请医生解读」吧</div>
    </div>
  </div>
</template>