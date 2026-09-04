<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Siren, HeartPulse, Activity, Droplet, CircleDot, Gauge, ChevronRight } from 'lucide-vue-next';
import type { ChronicGroupKey, AlarmLevel } from '../lib/chronic';
import { judgeRecord, CHRONIC_GROUPS, fieldDef, LEVEL_META, type FieldJudge } from '../lib/chronic';

const store = useAppStore();

const openId = ref<string | null>(null);

/** 单组别色 */
const ACCOUNT_ICONS: Record<string, typeof Siren> = {
  bp: Siren, glucose: Activity, lipid: Droplet, uric: CircleDot, bmi: Gauge, hcy: HeartPulse,
};

interface AlertItem {
  studentId: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female';
  phone: string;
  level: AlarmLevel;                 // 患者最新记录整体档位
  abnormalCount: number;             // 非达标字段总数
  groups: { g: ChronicGroupKey; label: string; level: AlarmLevel; fields: FieldJudge[] }[];
  date: string;
}

const list = computed<AlertItem[]>(() => {
  const out: AlertItem[] = [];
  for (const s of store.getAllStudents()) {
    const rec = store.getLatestChronic(s.id);
    if (!rec) continue;
    const j = judgeRecord(rec.values, s.gender);
    if (j.level === 'normal') continue; // 只列有异常/关注的
    const map = new Map<ChronicGroupKey, { level: AlarmLevel; fields: FieldJudge[] }>();
    for (const f of j.fields) {
      const g = fieldDef(f.key).group;
      const cur = map.get(g);
      const rank = (x: AlarmLevel) => (x === 'normal' ? 0 : x === 'off' ? 1 : 2);
      if (!cur || rank(f.level) > rank(cur.level)) {
        map.set(g, { level: cur ? (rank(cur.level) > rank(f.level) ? cur.level : f.level) : f.level, fields: [...(cur?.fields || []), f] });
      } else {
        map.get(g)!.fields.push(f);
      }
    }
    const groups = [...map.entries()].map(([g, v]) => ({
      g,
      label: CHRONIC_GROUPS.find((x) => x.key === g)!.title,
      level: v.level,
      fields: v.fields,
    }));
    groups.sort((a, b) => rank(b.level) - rank(a.level));
    out.push({
      studentId: s.id,
      name: s.name || '未填写',
      age: s.age,
      gender: s.gender,
      phone: s.phone || '',
      level: j.level,
      abnormalCount: j.abnormalCount,
      groups,
      date: rec.date,
    });
  }
  out.sort((a, b) => rank(b.level) - rank(a.level) || b.date.localeCompare(a.date));
  return out;
});

const rank = (x: AlarmLevel) => (x === 'normal' ? 0 : x === 'off' ? 1 : 2);
const maskPhone = (p: string) => p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#FFF6EE] to-[#FFFDFB]">
    <NavBar title="五高异常预警" :on-back="() => store.goBack()" />

    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="rounded-xl bg-orange-50 border border-orange-100 p-3 text-[11px] text-gray-500 leading-relaxed flex gap-2">
        <Siren class="w-4 h-4 shrink-0 mt-0.5 text-[#B6523E]" />
        基于学员最近一次慢病测量的达标判定（参考区间，待医院确认）。凡是出现「关注 / 异常」指标的学员在此汇总，便于你跟进随访。)
      </div>

      <template v-if="list.length > 0">
        <div class="text-xs font-bold text-gray-500 px-1">{{ list.length }} 名学员存在异常关注指标</div>
        <div
          v-for="p in list"
          :key="p.studentId"
          class="rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 shadow-sm overflow-hidden"
        >
          <button @click="openId = openId === p.studentId ? null : p.studentId" class="w-full p-4 text-left">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 rounded-full bg-[#FF976A]/12 text-[#FF976A] flex items-center justify-center shrink-0">
                <HeartPulse class="h-5 w-5" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {{ p.name }}
                  <span :class="['text-[10px] px-1.5 py-0.5 rounded-full', LEVEL_META[p.level].bg, LEVEL_META[p.level].text]">
                    {{ LEVEL_META[p.level].label }}指标
                  </span>
                </div>
                <div class="text-[11px] text-gray-500 mt-0.5">{{ p.gender === 'male' ? '男' : '女' }}{{ p.age ? ' · ' + p.age + '岁' : '' }}</div>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  <span
                    v-for="gr in p.groups"
                    :key="gr.g"
                    class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="LEVEL_META[gr.level].bg + ' ' + LEVEL_META[gr.level].text"
                  >
                    <component :is="ACCOUNT_ICONS[gr.g]" class="w-3 h-3" />
                    {{ gr.label }} · {{ LEVEL_META[gr.level].label }}
                  </span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
            </div>
          </button>

          <div v-if="openId === p.studentId" class="border-t border-gray-100 p-4 space-y-2">
            <div class="text-[10px] text-gray-400 mb-2">最近一次测量 · {{ p.date.slice(0, 16) }} · {{ maskPhone(p.phone) }}</div>
            <div
              v-for="gr in p.groups"
              :key="gr.g"
              class="rounded-xl p-3"
              :class="LEVEL_META[gr.level].bg"
            >
              <div class="text-[11px] font-bold mb-1.5" :class="LEVEL_META[gr.level].text">
                {{ gr.label }}（{{ LEVEL_META[gr.level].label }}）
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="f in gr.fields" :key="f.key">
                  <div class="text-[9px] text-gray-500">{{ f.label }}</div>
                  <div class="text-sm font-bold tabular-nums" :class="LEVEL_META[f.level].text">
                    {{ f.value }} <span class="text-[10px] font-normal text-gray-400">{{ f.unit }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-xs text-gray-400 py-16">
        当前所有学员最近一次测量均达标，无异常预警。
      </div>
    </div>
  </div>
</template>