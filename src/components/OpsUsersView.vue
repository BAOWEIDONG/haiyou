<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { UserCircle, Search, X, ShieldAlert } from 'lucide-vue-next';

const store = useAppStore();
const filter = ref<'all' | 'active' | 'watch'>('all');
const kw = ref('');

const rows = computed(() => {
  const all = store.accounts
    .filter((a) => a.role === 'student')
    .map((a) => {
      const info = store.students.find((s) => s.id === a.id);
      const risk = store.getRiskPortrait(a.id);
      return {
        id: a.id, name: a.name, phone: a.phone, active: a.active,
        gender: info?.gender, age: info?.age,
        risk: risk ? risk.level : undefined,
      };
    });
  const keyword = kw.value.trim().toLowerCase();
  const base = keyword
    ? all.filter((r) => r.name.toLowerCase().includes(keyword) || r.phone.includes(keyword))
    : all;
  if (filter.value === 'active') return base.filter((r) => r.active);
  if (filter.value === 'watch') return base.filter((r) => r.risk === 'watch' || r.risk === 'refer');
  return base;
});

const maskPhone = (p: string) => p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
const riskMeta = (level?: string) =>
  level === 'refer' ? { t: '需干预', cls: 'bg-red-100 text-red-600' }
  : level === 'watch' ? { t: '需关注', cls: 'bg-amber-100 text-amber-600' }
  : null;
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="用户管理" :on-back="() => store.goBack()" />
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="flex gap-2">
        <button v-for="f in (['all','active','watch'] as const)" :key="f" @click="filter = f"
          :class="['px-3 py-1.5 rounded-full text-[12px] font-bold border-2', filter === f ? 'border-[#8B5CF6] text-[#8B5CF6] bg-white' : 'border-transparent text-gray-500 bg-white/60']">
          {{ f === 'all' ? '全部' : f === 'active' ? '服务中' : '需关注' }}
        </button>
      </div>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input v-model="kw" type="text" placeholder="搜索姓名或手机号"
          class="w-full pl-9 pr-9 py-2.5 bg-white/60 backdrop-blur-md border border-white/70 rounded-xl text-sm focus:outline-none focus:border-[#8B5CF6]" />
        <button v-if="kw" @click="kw = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X class="w-4 h-4" /></button>
      </div>

      <div v-for="r in rows" :key="r.id" class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 flex items-center gap-3 shadow-sm">
        <div class="h-10 w-10 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0"><UserCircle class="h-6 w-6" /></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-gray-900">{{ r.name }}</span>
            <span v-if="riskMeta(r.risk)" :class="['flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full', riskMeta(r.risk).cls]">
              <ShieldAlert class="w-3 h-3" />{{ riskMeta(r.risk).t }}
            </span>
            <span v-if="!r.active" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">已停用</span>
          </div>
          <div class="text-[11px] text-gray-400 mt-0.5">{{ r.gender === 'male' ? '男' : r.gender === 'female' ? '女' : '—' }} · {{ r.age ?? '—' }}岁 · {{ maskPhone(r.phone) }}</div>
        </div>
      </div>
      <div v-if="rows.length === 0" class="text-center text-xs text-gray-400 py-10">无匹配用户</div>
    </div>
  </div>
</template>