<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { MessageCircleQuestion, Users, Send, Phone } from 'lucide-vue-next';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');

const list = computed(() =>
  [...store.interpretationRequests].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  }),
);

const toggle = (id: string) => { openId.value = openId.value === id ? null : id; draft.value = ''; };

const reply = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入解读内容'); return; }
  store.answerInterpretation(id, draft.value.trim());
  store.markInterpretationRead(id);
  showToast('已发送健康解读');
  draft.value = '';
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="报告健康解读" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        用户勾选档案指标后请求解读。解读定位为<b>健康减重建议</b>（非医疗诊断）；详见异常需建议线下复测/就医（就医转介在「预警」入口登记）。
      </div>

      <template v-if="list.length > 0">
        <div
          v-for="req in list"
          :key="req.id"
          class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden"
        >
          <button @click="toggle(req.id)" class="w-full flex items-center justify-between p-4 text-left">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0">
                <MessageCircleQuestion class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {{ store.studentName(req.studentId) }}
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                    {{ req.status === 'pending' ? '待解读' : '已解读' }}
                  </span>
                </div>
                <div class="text-[11px] text-gray-500 mt-1 truncate">{{ req.question }}</div>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  <span v-for="ind in req.indicatorNames" :key="ind" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{{ ind }}</span>
                </div>
              </div>
            </div>
            <div class="text-gray-400 text-xs ml-2">{{ req.createdAt.slice(5, 16) }}</div>
          </button>

          <div v-if="openId === req.id" class="border-t border-gray-100 p-4 space-y-3">
            <!-- 学员上传的报告材料（化验单/体检单），解读据此出具 -->
            <div v-if="req.materialImages && req.materialImages.length > 0" class="rounded-xl bg-gray-50 p-3">
              <div class="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1">报告材料 · 点击查看</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="(img, i) in req.materialImages"
                  :key="i"
                  @click="store.openImagePreview(req.materialImages!, i)"
                  class="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 active:opacity-70"
                >
                  <img :src="img" loading="lazy" decoding="async" class="w-full h-full object-cover" />
                </button>
              </div>
            </div>

            <!-- 学员填写的联系电话 -->
            <div v-if="req.studentPhone" class="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-100 p-3 text-[12px] text-purple-700">
              <Phone class="w-3.5 h-3.5" />
              学员联系电话：{{ req.studentPhone }}
            </div>

            <!-- 解读/追问往返 -->
            <div v-if="req.exchanges.length > 0" class="space-y-2">
              <div
                v-for="(ex, i) in req.exchanges"
                :key="i"
                :class="['p-3 rounded-xl text-[13px] leading-relaxed', ex.side === 'doctor' ? 'bg-[#0B6BCB]/8 ml-6' : 'bg-gray-100 mr-6']"
              >
                <div class="text-[10px] text-gray-400 mb-1">
                  {{ ex.side === 'doctor' ? '营养师 · ' + ex.authorName : ex.authorName }} · {{ ex.createdAt.slice(5, 16) }}
                </div>
                {{ ex.text }}
              </div>
            </div>
            <div v-else class="text-xs text-gray-400">尚未解读</div>

            <textarea
              v-model="draft"
              rows="3"
              placeholder="输入健康解读：减重成效、指标趋势、生活习惯建议（不写疾病诊断）…"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
            />
            <button
              @click="reply(req.id)"
              class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90"
            >
              <Send class="w-4 h-4" /> 发送解读
            </button>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-16">暂无健康解读请求</div>
    </div>
  </div>
</template>