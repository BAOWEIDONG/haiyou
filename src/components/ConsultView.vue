<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { MessageSquareText, Send, Plus, Phone } from 'lucide-vue-next';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');
const showNew = ref(false);
const newTopic = ref('');
const newQuestion = ref('');
const newPhone = ref('');

const list = computed(() => (store.user ? store.getStudentThreads(store.user.id) : []));

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
  draft.value = '';
  if (openId.value) store.markThreadRead(id);
};

const ask = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入留言'); return; }
  store.studentReplyConsult(id, draft.value.trim());
  showToast('已发送，等待医生团队回复');
  draft.value = '';
};

const doNew = () => {
  if (!store.user) return;
  if (!newTopic.value.trim() || !newQuestion.value.trim()) { showToast('请填写标题与内容'); return; }
  store.askConsult(store.user.id, newTopic.value.trim(), newQuestion.value.trim(), newPhone.value.trim());
  showNew.value = false;
  newTopic.value = ''; newQuestion.value = ''; newPhone.value = '';
  showToast('已发起提问');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#EDF9F1] to-[#FBFFFC]">
    <NavBar title="健康答疑" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showNew = true" class="flex items-center gap-1 text-sm font-bold text-[#0B6BCB]"><Plus class="w-4 h-4" /> 提问</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-green-50 border border-green-100 p-3 leading-relaxed">
        给医生团队健康顾问留言（减重/饮食/运动），工作时间回复。可选择性填写<b>手机号</b>，必要时医生会电话回访。
      </div>

      <template v-if="list.length > 0">
        <div v-for="t in list" :key="t.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden">
          <button @click="toggle(t.id)" class="w-full p-4 text-left">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0"><MessageSquareText class="h-5 w-5" /></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-bold text-gray-800">{{ t.topic }}</span>
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', t.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                    {{ t.status === 'pending' ? '待回复' : '已回复' }}
                  </span>
                </div>
                <div class="text-[11px] text-gray-400 mt-1">{{ t.createdAt.slice(0, 16) }}</div>
              </div>
              <div class="text-gray-300 text-sm ml-1">›</div>
            </div>
          </button>

          <div v-if="openId === t.id" class="border-t border-gray-100 p-4 space-y-3">
            <div class="text-[12px] text-gray-600 bg-gray-50 rounded-lg p-2.5">{{ t.question }}</div>
            <div v-if="t.replies.length > 0" class="space-y-2">
              <div
                v-for="(r, i) in t.replies"
                :key="i"
                :class="['p-3 rounded-xl text-[13px] leading-relaxed', r.side === 'staff' ? 'bg-[#0B6BCB]/8 mr-10' : 'bg-gray-100 ml-10']"
              >
                <div class="text-[10px] text-gray-400 mb-1">{{ r.authorName }} · {{ r.createdAt.slice(5, 16) }}</div>
                {{ r.text }}
              </div>
            </div>

            <div v-if="t.studentPhone" class="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-100 p-3 text-[12px] text-purple-700">
              <Phone class="w-3.5 h-3.5" />
              联系电话：{{ t.studentPhone }}
            </div>

            <textarea
              v-model="draft"
              rows="2"
              placeholder="继续留言…"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
            />
            <div class="flex gap-2">
              <button @click="ask(t.id)" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">
                <Send class="w-4 h-4" /> 发送
              </button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-14">还没有答疑记录<br/>点右上角「提问」发起留言</div>
    </div>

    <VanPopup v-model:show="showNew" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">发起健康提问</h3>
        <input v-model="newTopic" placeholder="主题（如：外食怎么吃）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none" />
        <textarea v-model="newQuestion" rows="3" placeholder="描述你的问题…" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none" />
        <input v-model="newPhone" inputmode="tel" placeholder="联系电话（选填，必要时医生电话回访）" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none" />
        <button @click="doNew" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">提交提问</button>
      </div>
    </VanPopup>
  </div>
</template>