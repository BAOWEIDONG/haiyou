<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { MessageSquareText, Send, Phone } from 'lucide-vue-next';
import type { ConsultThread } from '../types';

const store = useAppStore();
const openId = ref<string | null>(null);
const draft = ref('');

const list = computed<ConsultThread[]>(() =>
  [...store.consultThreads].sort((a, b) => {
    // 医生端处理优先级：待回复 > 学员追答未读 > 已读完；同级按提交时间倒序
    const pri = (t: { status: string; doctorUnread?: boolean }) =>
      t.status === 'pending' ? 0 : t.doctorUnread ? 1 : 2;
    const pa = pri(a), pb = pri(b);
    if (pa !== pb) return pa - pb;
    return b.createdAt.localeCompare(a.createdAt);
  }),
);

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
  draft.value = '';
  if (openId.value) store.markThreadDoctorRead(id);
};

const reply = (id: string) => {
  if (!draft.value.trim()) { showToast('请输入回复'); return; }
  store.staffReplyConsult(id, draft.value.trim());
  store.markThreadRead(id);
  showToast('已回复');
  draft.value = '';
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#E8F3FB] to-[#FBFEFF]">
    <NavBar title="异步健康答疑" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-blue-50 border border-blue-100 p-3 leading-relaxed">
        工作时间回复健康留言（减重/饮食/运动范畴）。线上无法处置或见疑似疾病 → 引导转介线下就医。
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
                  <span v-if="t.doctorUnread" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0B6BCB] text-white">新回复</span>
                </div>
                <div class="text-[13px] font-medium text-gray-800 mt-0.5">{{ t.topic }}</div>
                <div class="text-[11px] text-gray-500 mt-1 line-clamp-2">{{ t.question }}</div>
              </div>
            </div>
          </button>

          <div v-if="openId === t.id" class="border-t border-gray-100 p-4 space-y-3">
            <!-- 学员提交的完整问题 -->
            <div class="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div class="text-[10px] font-bold text-[#0B6BCB] mb-1">学员问题</div>
              <div class="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{{ t.question }}</div>
            </div>

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

            <!-- 学员填写的联系电话 -->
            <div v-if="t.studentPhone" class="flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-100 p-3 text-[12px] text-purple-700">
              <Phone class="w-3.5 h-3.5" />
              学员联系电话：{{ t.studentPhone }}
            </div>

            <textarea
              v-model="draft"
              rows="2"
              placeholder="输入回复…"
              class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#0B6BCB] focus:outline-none resize-none"
            />
            <div class="flex gap-2">
              <button
                @click="reply(t.id)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90"
              >
                <Send class="w-4 h-4" /> 回复
              </button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-16">暂无答疑留言</div>
    </div>
  </div>
</template>