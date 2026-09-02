<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { showToast } from 'vant';
import { uploadFile } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { compressVideo } from '../lib/videoCompress';
import type { KnowledgeBlock } from '../types';
import { ChevronDown, ChevronUp, Trash2, UploadCloud, Image as ImageIcon, Video, Plus, X, Send } from 'lucide-vue-next';

const store = useAppStore();

const title = ref('');
const authorRole = ref<'dietitian' | 'coach'>('dietitian');
const contentType = ref<'article' | 'video'>('article');
const cover = ref('');
const blocks = ref<KnowledgeBlock[]>([]);
const videoUrl = ref('');

const uploads = ref(0);

const roleLabel: Record<string, string> = { dietitian: '营养师', coach: '康复教练' };

// 上传控件
const coverInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);

const pickCover = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
  if (files.length === 0) return;
  try { cover.value = await uploadFile(await compressImage(files[0])); }
  catch { showToast('封面上传失败'); }
  (e.target as HTMLInputElement).value = '';
};

const pickImages = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
  if (files.length === 0) return;
  uploads.value++;
  try {
    const urls = await Promise.all(files.map(async (f) => uploadFile(await compressImage(f))));
    blocks.value = [...blocks.value, ...urls.map((url) => ({ type: 'image', url } as KnowledgeBlock))];
  } catch { showToast('图片上传失败'); }
  finally { uploads.value--; (e.target as HTMLInputElement).value = ''; }
};

const pickVideo = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
  if (files.length === 0) return;
  try { videoUrl.value = await uploadFile(await compressVideo(files[0])); }
  catch { showToast('视频上传失败'); }
  (e.target as HTMLInputElement).value = '';
};

const addTextBlock = () => { blocks.value = [...blocks.value, { type: 'text', text: '' }]; };
const removeBlock = (i: number) => { blocks.value = blocks.value.filter((_, x) => x !== i); };
const moveBlock = (i: number, dir: number) => {
  const j = i + dir;
  if (j < 0 || j >= blocks.value.length) return;
  const arr = [...blocks.value];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  blocks.value = arr;
};
// 图文块字段读写（模板内不做类型断言，走这里窄化）
const blockText = (b: KnowledgeBlock) => (b.type === 'text' ? b.text : '');
const blockUrl = (b: KnowledgeBlock) => (b.type === 'image' ? b.url : '');
const setBlockText = (b: KnowledgeBlock, val: string) => { (b as { type: string; text?: string }).text = val; };

const publish = () => {
  if (!title.value.trim()) { showToast('请填写标题'); return; }
  if (contentType.value === 'video' && !videoUrl.value) { showToast('视频类型请上传视频'); return; }
  const firstText = blocks.value.find((b) => b.type === 'text' && b.text.trim());
  const summaryText = firstText && firstText.type === 'text' ? firstText.text.trim().slice(0, 60) : '';
  store.addKnowledgeContent({
    title: title.value.trim(),
    summary: summaryText,
    imageUrls: cover.value ? [cover.value] : [],
    videoUrls: videoUrl.value ? [videoUrl.value] : [],
    authorRole: authorRole.value,
    authorName: store.user?.name || '运营',
    contentType: contentType.value,
    campIds: [],
    blocks: [...blocks.value],
  });
  showToast('已发布');
  store.goBack();
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="发布健康科普" :on-back="() => store.goBack()" />

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-28">
      <!-- 文章类型 -->
      <section>
        <div class="text-xs font-bold text-gray-500 mb-2">文章类型</div>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="c in (['article','video'] as const)" :key="c" @click="contentType = c"
            :class="['py-2.5 rounded-xl text-sm font-bold border-2 transition-colors', contentType === c ? 'border-[#8B5CF6] text-[#8B5CF6] bg-purple-50' : 'border-gray-200 text-gray-500 bg-white']">
            {{ c === 'article' ? '图文' : '视频' }}
          </button>
        </div>
      </section>

      <!-- 作者 -->
      <section>
        <div class="text-xs font-bold text-gray-500 mb-2">署名作者</div>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="r in (['dietitian','coach'] as const)" :key="r" @click="authorRole = r"
            :class="['py-2.5 rounded-xl text-sm font-bold border-2 transition-colors', authorRole === r ? 'border-[#8B5CF6] text-[#8B5CF6] bg-purple-50' : 'border-gray-200 text-gray-500 bg-white']">
            {{ roleLabel[r] }}
          </button>
        </div>
      </section>

      <!-- 标题 -->
      <section>
        <div class="text-xs font-bold text-gray-500 mb-2">标题</div>
        <input v-model="title" placeholder="一眼说清这篇讲什么" class="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-[15px] font-bold text-gray-800 placeholder:text-gray-300 focus:border-[#8B5CF6] focus:outline-none" />
      </section>

      <!-- 封面图 -->
      <section>
        <div class="text-xs font-bold text-gray-500 mb-2">封面图 <span class="text-gray-300 font-normal">（信息流缩略图，选填）</span></div>
        <button v-if="cover" @click="store.openImagePreview([cover], 0)" class="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-200 active:opacity-80">
          <img :src="cover" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          <span class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"><X class="w-4 h-4" @click.stop="cover = ''" /></span>
          <span class="absolute bottom-2 left-2 text-[11px] text-white/90 drop-shadow px-2 py-0.5 rounded bg-black/30">点击预览封面</span>
        </button>
        <button v-else @click="coverInput?.click()" class="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-[#8B5CF6]/40 bg-[#8B5CF6]/5 text-[#8B5CF6] flex flex-col items-center justify-center gap-1.5 active:bg-purple-50">
          <UploadCloud class="w-6 h-6" />
          <span class="text-[12px] font-bold">上传封面图</span>
        </button>
      </section>
      <input ref="coverInput" type="file" accept="image/*" class="hidden" @change="pickCover" />

      <!-- 正文（文字段落 + 中间插图） -->
      <section>
        <div class="text-xs font-bold text-gray-500 mb-2">正文 <span class="text-gray-300 font-normal">（文字段落 + 插图，可上下移动排版）</span></div>

        <div class="space-y-3">
          <div v-for="(b, i) in blocks" :key="i" class="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <!-- 文字段落 -->
            <textarea
              v-if="b.type === 'text'"
              :value="blockText(b)"
              @input="setBlockText(b, ($event.target as HTMLTextAreaElement).value)"
              rows="3" placeholder="正文段落…"
              class="w-full p-3 text-[15px] text-gray-700 leading-relaxed focus:outline-none resize-none min-h-20"
            />
            <!-- 插图 -->
            <div v-else class="p-2">
              <img :src="blockUrl(b)" class="w-full rounded-lg max-h-44 object-cover" loading="lazy" decoding="async" @click="store.openImagePreview([blockUrl(b)], 0)" />
            </div>
            <!-- 块操作（文字按钮，直观） -->
            <div class="flex items-center justify-end gap-1 border-t border-gray-100 px-2 py-1.5">
              <button @click="moveBlock(i, -1)" :disabled="i === 0" class="flex items-center gap-0.5 px-2 h-7 rounded-md text-[11px] font-medium text-gray-400 active:bg-gray-100 disabled:opacity-30"><ChevronUp class="w-3.5 h-3.5" />上移</button>
              <button @click="moveBlock(i, 1)" :disabled="i === blocks.length - 1" class="flex items-center gap-0.5 px-2 h-7 rounded-md text-[11px] font-medium text-gray-400 active:bg-gray-100 disabled:opacity-30"><ChevronDown class="w-3.5 h-3.5" />下移</button>
              <button @click="removeBlock(i)" class="flex items-center gap-0.5 px-2 h-7 rounded-md text-[11px] font-medium text-red-400 active:bg-red-50"><Trash2 class="w-3.5 h-3.5" />删除</button>
            </div>
          </div>
        </div>

        <!-- 添加块 -->
        <div class="grid grid-cols-2 gap-2 mt-3">
          <button @click="addTextBlock" class="py-2.5 rounded-xl border border-dashed border-[#8B5CF6]/45 text-[#8B5CF6] text-[13px] font-bold flex items-center justify-center gap-1 bg-[#8B5CF6]/5 active:bg-purple-50"><Plus class="w-4 h-4" />添加文字段落</button>
          <button :disabled="uploads > 0" @click="imageInput?.click()" class="py-2.5 rounded-xl border border-dashed border-[#8B5CF6]/45 text-[#8B5CF6] text-[13px] font-bold flex items-center justify-center gap-1 bg-[#8B5CF6]/5 active:bg-purple-50 disabled:opacity-50"><ImageIcon class="w-4 h-4" />{{ uploads > 0 ? '上传中…' : '添加插图' }}</button>
        </div>
      </section>
      <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="pickImages" />

      <!-- 短视频 -->
      <section v-if="contentType === 'video'">
        <div class="text-xs font-bold text-gray-500 mb-2">短视频</div>
        <div v-if="videoUrl" class="rounded-xl overflow-hidden bg-gray-900 relative">
          <video :src="videoUrl" class="w-full aspect-video object-cover" preload="metadata" muted playsinline webkit-playsinline @click="store.openVideoPreview(videoUrl)" />
          <button @click="videoUrl = ''" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"><X class="w-4 h-4" /></button>
          <span class="absolute bottom-2 left-2 text-[11px] text-white/90 px-2 py-0.5 rounded bg-black/30">点击预览</span>
        </div>
        <button v-else @click="videoInput?.click()" class="w-full py-3 rounded-xl border border-dashed border-[#8B5CF6]/45 text-[#8B5CF6] text-[13px] font-bold flex items-center justify-center gap-1 bg-[#8B5CF6]/5 active:bg-purple-50"><Video class="w-4 h-4" />上传视频</button>
      </section>
      <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="pickVideo" />
    </div>

    <!-- 底部发布 -->
    <div class="fixed bottom-0 inset-x-0 px-5 py-3 bg-gradient-to-t from-white via-white/95 to-white/0">
      <button @click="publish" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90 flex items-center justify-center gap-1.5"><Send class="w-4 h-4" />发布文章</button>
    </div>
  </div>
</template>