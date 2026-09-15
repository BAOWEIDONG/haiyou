<script setup lang="ts">
/**
 * 头像裁剪弹窗（1:1 方形，与圆形展示口径一致）
 * - 拖动移动取景 / 双指捏合或滑杆缩放
 * - 确认后按当前取景导出 480×480 JPEG dataURL
 */
import { ref, computed, watch, nextTick } from 'vue';
import { Popup as VanPopup, showToast } from 'vant';
import { Crop, RotateCcw, Check, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  /** 待裁剪原图 dataURL */
  src: string | null;
  /** 已有自定义头像时显示「恢复默认」 */
  allowRemove?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'confirm', dataUrl: string | null): void;
}>();

const close = () => emit('update:show', false);

// ─── 图片与取景状态 ───
const imgEl = ref<HTMLImageElement | null>(null);
const viewEl = ref<HTMLElement | null>(null);
const iw = ref(0);   // 原始宽高
const ih = ref(0);
const zoom = ref(1);  // 在 cover 基础上的放大倍数（1~3）
const imgX = ref(0); // 图片显示左上角相对取景框的坐标
const imgY = ref(0);

/** 取景框边长（正方形，随屏宽自适应） */
const viewSize = ref(320);
const dispW = computed(() => (iw.value ? iw.value * baseScale.value * zoom.value : 0));
const dispH = computed(() => (ih.value ? ih.value * baseScale.value * zoom.value : 0));
const baseScale = computed(() => (iw.value && ih.value ? Math.max(viewSize.value / iw.value, viewSize.value / ih.value) : 1));

function measure() {
  const w = viewEl.value?.clientWidth || 320;
  viewSize.value = w;
}
function reset() {
  zoom.value = 1;
  center();
}
function center() {
  imgX.value = (viewSize.value - dispW.value) / 2;
  imgY.value = (viewSize.value - dispH.value) / 2;
}
/** 缩放/拖动后钳制：图片始终完全覆盖取景框（不够宽时居中） */
function clampPos() {
  const dW = dispW.value, dH = dispH.value, vs = viewSize.value;
  imgX.value = dW <= vs ? (vs - dW) / 2 : Math.min(0, Math.max(vs - dW, imgX.value));
  imgY.value = dH <= vs ? (vs - dH) / 2 : Math.min(0, Math.max(vs - dH, imgY.value));
}

// 打开弹窗时：测量尺寸 → 加载图片 → 初始 cover 居中
watch(() => props.show, async (v) => {
  if (!v) return;
  zoom.value = 1; imgX.value = 0; imgY.value = 0;
  await nextTick();
  measure();
  const src = props.src;
  if (!src) return;
  await new Promise<void>((resolve) => {
    const im = new Image();
    im.onload = () => { iw.value = im.naturalWidth; ih.value = im.naturalHeight; resolve(); };
    im.onerror = () => resolve();
    im.src = src;
  });
  reset();
});

// ─── 手势：单指拖动 / 双指捏合 ───
type P = { x: number; y: number };
const pointers = new Map<number, P>();
let pinchDist = 0;
let pinchZoom = 1;

function onPointerDown(e: PointerEvent) {
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    pinchZoom = zoom.value;
  }
}
function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId)!;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    // 拖动平移
    imgX.value += e.clientX - prev.x;
    imgY.value += e.clientY - prev.y;
    clampPos();
  } else if (pointers.size === 2) {
    // 双指捏合：围绕两指中点缩放
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) {
      const rect = viewEl.value!.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      setZoom((pinchZoom * dist) / pinchDist, midX, midY);
    }
    pinchDist = dist;
  }
}
function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
}

/** 改变 zoom 并让 (ax, ay) 取景框坐标处的图片点保持不动 */
function setZoom(z: number, ax: number, ay: number) {
  const next = Math.min(3, Math.max(1, z));
  const fracX = (ax - imgX.value) / dispW.value;
  const fracY = (ay - imgY.value) / dispH.value;
  zoom.value = next;
  imgX.value = ax - fracX * dispW.value;
  imgY.value = ay - fracY * dispH.value;
  clampPos();
}
function onSliderZoom(e: Event) {
  const z = Number((e.target as HTMLInputElement).value);
  setZoom(z, viewSize.value / 2, viewSize.value / 2);
}

// ─── 导出 ───
function confirmCrop() {
  if (!props.src || !iw.value) { showToast('图片加载失败'); return; }
  const k = dispW.value / iw.value; // 显示坐标 → 原图像素
  const sx = -imgX.value / k;
  const sy = -imgY.value / k;
  const sw = viewSize.value / k;
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) { showToast('导出失败'); return; }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 480, 480);
  ctx.drawImage(imgEl.value!, sx, sy, sw, sw, 0, 0, 480, 480);
  emit('confirm', canvas.toDataURL('image/jpeg', 0.85));
  close();
}
function removeAvatar() {
  emit('confirm', null);
  close();
}
</script>

<template>
  <VanPopup :show="props.show" position="bottom" round class="custom-popup" @update:show="close">
    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
          <Crop class="w-4 h-4 text-[#0B6BCB]" /> 调整头像
        </h3>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] font-bold">1:1 方形裁剪</span>
      </div>
      <p class="text-[11px] text-gray-500 leading-relaxed">拖动移动取景位置，双指捏合或滑杆缩放；圆形头像将按此方框展示。</p>

      <!-- 取景框（正方形） -->
      <div class="flex justify-center">
        <div
          ref="viewEl"
          class="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-black/85 select-none"
          style="touch-action: none"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img
            ref="imgEl"
            v-if="props.src"
            :src="props.src"
            alt="裁剪预览"
            class="absolute will-change-transform"
            draggable="false"
            :style="{ left: `${imgX}px`, top: `${imgY}px`, width: `${dispW}px`, height: `${dispH}px` }"
          />
          <!-- 圆形预览参考线 -->
          <div class="absolute inset-0 pointer-events-none rounded-full border-2 border-white/70"></div>
        </div>
      </div>

      <!-- 缩放滑杆 -->
      <div class="flex items-center gap-3 px-1">
        <span class="text-[10px] text-gray-400 shrink-0">缩小</span>
        <input
          type="range" min="1" max="3" step="0.01" :value="zoom"
          class="flex-1 accent-[#0B6BCB]"
          @input="onSliderZoom"
        />
        <span class="text-[10px] text-gray-400 shrink-0">放大</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="reset"
          class="w-11 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 active:bg-gray-50"
        >
          <RotateCcw class="w-5 h-5" />
        </button>
        <button
          v-if="props.allowRemove"
          @click="removeAvatar"
          class="w-11 shrink-0 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 active:bg-red-100"
        >
          <Trash2 class="w-5 h-5" />
        </button>
        <button
          @click="confirmCrop"
          class="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-[#0B6BCB] to-[#12B5C2] text-white text-sm font-bold active:opacity-90"
        >
          <Check class="w-4 h-4" /> 使用此头像
        </button>
      </div>
    </div>
  </VanPopup>
</template>
