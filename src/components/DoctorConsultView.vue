<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup } from 'vant';
import { showToast } from 'vant';
import { MessageSquareText, Users, Send, Phone, MessageCircle } from 'lucide-vue-next';
import type { ConsultThread } from '../types';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');
const showContact = ref(false);
const contactThreadId = ref<string | null>(null);
const contactType = ref<'phone' | 'wechat'>('phone');
const contactValue = ref('');

const list = computed<ConsultThread[]>(() =>
  [...store.consultThreads].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  }),
);

const toggle = (id: string) => { openId.value = openId.value === id ? null : id; draft.value = ''; };

const reply = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入回复'); return; }
  store.staffReplyConsult(id, draft.value.trim());
  store.markThreadRead(id);
  showToast('已回复');
  draft.value = '';
};

const openContact = (id: string) => {
  contactThreadId.value = id;
  contactValue.value = '';
  showContact.value = true;
};
const submitContact = () => {
  if (!contactValue.value.trim()) { showToast('请输入联系方式'); return; }
  if (contactThreadId.value) store.setConsultContact(contactThreadId.value, { type: contactType.value, value: contactValue.value.trim() });
  showContact.value = false;
  showToast('已登记私域跟进凭证');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="异步健康答疑" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        工作时间回复健康留言（减重/饮食/运动范畴）。线上无法处置或见疑似疾病 → 引导转介线下就医，并在此登记电话/微信跟进凭证。
      </div>

      <template v-if="list.length > 0">
        <div
          v-for="t in list"
          :key="t.id"
          class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden"
        >
          <button @click="toggle(t.id)" class="w-full p-4 text-left">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] flex items-center justify-center shrink-0">
                <MessageSquareText class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {{ store.studentName(t.studentId) }}
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', t.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600']">
                    {{ t.status === 'pending' ? '待回复' : '已回复' }}
                  </span>
                </div>
                <div class="text-[13px] font-medium text-gray-800 mt-0.5">{{ t.topic }}</div>
                <div class="text-[11px] text-gray-500 mt-1 line-clamp-2">{{ t.question }}</div>
              </div>
            </div>
          </button>

          <div v-if="openId === t.id" class="border-t border-gray-100 p-4 space-y-3">
            <div v-if="t.replies.length > 0" class="space-y-2">
              <div
                v-for="(r, i) in t.replies"
                :key="i"
                :class="['p-3 rounded-xl text-[13px] leading-relaxed', r.side === 'staff' ? 'bg-[#0B6BCB]/8 ml-6' : 'bg-gray-100 mr-6']"
              >
                <div class="text-[10px] text-gray-400 mb-1">{{ r.authorName }} · {{ r.createdAt.slice(5, 16) }}</div>
                {{ r.text }}
              </div>
            </div>
            <div v-else class="text-xs text-gray-400">尚无回复</div>

            <!-- 私域跟进凭证 -->
            <div v-if="t.contact" class="rounded-xl bg-purple-50 border border-purple-100 p-3 text-[12px] text-gray-700">
              <div class="font-bold text-purple-600 mb-1 flex items-center gap-1">
                <Phone v-if="t.contact.type === 'phone'" class="w-3.5 h-3.5" />
                <MessageCircle v-else class="w-3.5 h-3.5" />
                已转私域跟进
              </div>
              {{ t.contact.type === 'phone' ? '电话' : '微信' }}：{{ t.contact.value }}
            </div>

            <textarea
              v-model="draft"
              rows="2"
              placeholder="输入回复（如需线下跟进，先在此备注，再用下方按钮登记凭证）…"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
            />
            <div class="flex gap-2">
              <button
                @click="reply(t.id)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90"
              >
                <Send class="w-4 h-4" /> 回复
              </button>
              <button
                @click="openContact(t.id)"
                class="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-purple-200 text-purple-600 text-sm font-bold active:bg-purple-50"
              >
                <Phone class="w-4 h-4" /> 转私域
              </button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-16">暂无答疑留言</div>
    </div>

    <VanPopup v-model:show="showContact" position="bottom" round class="custom-popup">
      <div class="p-5">
        <h3 class="text-base font-bold text-gray-900 mb-4 text-center">登记私域跟进凭证</h3>
        <div class="flex gap-2 mb-4">
          <button
            :class="['flex-1 py-2.5 rounded-xl text-sm font-bold border-2', contactType === 'phone' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-gray-200 text-gray-500']"
            @click="contactType = 'phone'"
          >电话</button>
          <button
            :class="['flex-1 py-2.5 rounded-xl text-sm font-bold border-2', contactType === 'wechat' ? 'border-[#0B6BCB] text-[#0B6BCB]' : 'border-gray-200 text-gray-500']"
            @click="contactType = 'wechat'"
          >微信</button>
        </div>
        <input
          v-model="contactValue"
          placeholder="填写线下医院/HCP 联系方式"
          class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none mb-4"
        />
        <button @click="submitContact" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90">
          确认登记
        </button>
      </div>
    </VanPopup>
  </div>
</template>