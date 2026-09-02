<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../store/app';
import { NavBar } from './ui';
import { Popup as VanPopup, showConfirmDialog, showToast } from 'vant';
import { uploadFile } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { compressVideo } from '../lib/videoCompress';
import type { KnowledgeBlock } from '../types';
import { Newspaper, Plus, Trash2, ChevronUp, ChevronDown, UploadCloud, Image as ImageIcon, Video, X } from 'lucide-vue-next';

const store = useAppStore();
const showAdd = ref(false);
const title = ref('');
const authorRole = ref<'dietitian' | 'coach'>('dietitian');
const contentType = ref<'article' | 'video'>('article');
const cover = ref('');
const blocks = ref<KnowledgeBlock[]>([]);
const videoUrl = ref('');

const list = computed(() => store.knowledgeContents);
const roleLabel: Record<string, string> = { dietitian: '营养师', coach: '康复教练' };

// 上传控件
const coverInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const doRemove = (id: string, name: string) => {
  showConfirmDialog({
    title: '删除内容',
    message: `将删除「${name}」，已订阅用户将无法再查看。是否确认？`,
  }).then(() => {
    store.deleteKnowledgeContent(id);
    showToast('已删除');
  }).catch(() => {});
};

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
  uploading.value = true;
  try {
    const urls = await Promise.all(files.map(async (f) => uploadFile(await compressImage(f))));
    blocks.value = [...blocks.value, ...urls.map((url) => ({ type: 'image', url } as KnowledgeBlock))];
  } catch { showToast('图片上传失败'); }
  finally { uploading.value = false; (e.target as HTMLInputElement).value = ''; }
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

const doAdd = () => {
  if (!title.value.trim()) { showToast('请输入标题'); return; }
  // 卡片摘要：取第一个非空文字段落（截断），与学员端信息流预览一致
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
  showAdd.value = false;
  title.value = ''; cover.value = ''; blocks.value = []; videoUrl.value = '';
  authorRole.value = 'dietitian'; contentType.value = 'article';
  showToast('已发布');
};
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col font-sans bg-gradient-to-b from-[#F1EEFF] to-[#FDFBFF]">
    <NavBar title="内容管理" :on-back="() => store.goBack()">
      <template #right>
        <button @click="showAdd = true" class="flex items-center gap-1 text-sm font-bold text-[#8B5CF6]"><Plus class="w-4 h-4" /> 发布</button>
      </template>
    </NavBar>
    <div class="flex-1 px-4 py-4 space-y-3">
      <div class="text-[11px] text-gray-500 rounded-xl bg-purple-50 border border-purple-100 p-3 leading-relaxed">
        知识库素材管理：图文/短视频。医生、营养师、康复教练的内容统一在此，按订阅可见范围投放（合规与版权由运营复核）。
      </div>

      <button
        v-for="k in list"
        :key="k.id"
        @click="store.openArticle('knowledge', k)"
        class="w-full text-left rounded-2xl bg-white/70 backdrop-blur-md border border-white/70 p-4 space-y-1.5 shadow-sm active:opacity-70"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <img v-if="k.imageUrls[0]" :src="k.imageUrls[0]" class="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
            <div v-else class="w-14 h-14 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center shrink-0"><component :is="k.contentType === 'article' ? Newspaper : Video" class="w-6 h-6" /></div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold text-gray-900 leading-snug">{{ k.title }}</div>
              <div class="text-[11px] text-gray-400 mt-1">{{ roleLabel[k.authorRole] }} · {{ k.authorName }} · {{ k.contentType === 'article' ? '图文' : '视频' }}</div>
            </div>
          </div>
          <span @click.stop="doRemove(k.id, k.title)" class="text-gray-300 active:opacity-60 shrink-0"><Trash2 class="w-4 h-4" /></span>
        </div>
        <div v-if="k.summary" class="text-[12px] text-gray-500 leading-relaxed">{{ k.summary }}</div>
      </button>
    </div>

    <VanPopup v-model:show="showAdd" position="bottom" round class="custom-popup">
      <div class="p-5 space-y-3 max-h-[82dvh] overflow-y-auto">
        <h3 class="text-base font-bold text-gray-900 mb-1 text-center">发布健康科普</h3>

        <!-- 作者 & 类型 -->
        <div class="grid grid-cols-2 gap-2">
          <div class="flex gap-2">
            <button v-for="r in (['dietitian','coach'] as const)" :key="r" @click="authorRole = r"
              :class="['flex-1 py-2 rounded-xl text-[12px] font-bold border-2', authorRole === r ? 'border-[#8B5CF6] text-[#8B5CF6]' : 'border-gray-200 text-gray-500']">
              {{ roleLabel[r] }}
            </button>
          </div>
          <div class="flex gap-2">
            <button v-for="c in (['article','video'] as const)" :key="c" @click="contentType = c"
              :class="['flex-1 py-2 rounded-xl text-[12px] font-bold border-2', contentType === c ? 'border-[#8B5CF6] text-[#8B5CF6]' : 'border-gray-200 text-gray-500']">
              {{ c === 'article' ? '图文' : '视频' }}
            </button>
          </div>
        </div>

        <input v-model="title" placeholder="标题" class="w-full p-3 rounded-xl border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none" />

        <!-- 封面图 -->
        <div>
          <div class="text-xs font-bold text-gray-700 mb-1.5">封面图（信息流缩略图，选填）</div>
          <div class="flex items-center gap-2">
            <button v-if="cover" @click="store.openImagePreview([cover], 0)" class="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 active:opacity-70">
              <img :src="cover" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
            <button v-else @click="coverInput?.click()" class="w-16 h-16 rounded-xl border-2 border-dashed border-[#8B5CF6]/40 text-[#8B5CF6] flex flex-col items-center justify-center gap-0.5 active:bg-purple-50">
              <UploadCloud class="w-5 h-5" /><span class="text-[9px] font-bold">封面</span>
            </button>
            <span v-if="cover" @click="cover = ''" class="text-[11px] text-gray-400 active:opacity-60">移除</span>
          </div>
        </div>
        <input ref="coverInput" type="file" accept="image/*" class="hidden" @change="pickCover" />

        <!-- 图文正文：文字段落 + 中间插图 -->
        <div>
          <div class="text-xs font-bold text-gray-700 mb-1.5">正文（文字段落 + 中间插图，按上移/下移排版）</div>
          <div class="space-y-2">
            <div v-for="(b, i) in blocks" :key="i" class="rounded-xl border border-gray-200 overflow-hidden flex items-start">
              <textarea
                v-if="b.type === 'text'"
                :value="blockText(b)"
                @input="setBlockText(b, ($event.target as HTMLTextAreaElement).value)"
                rows="3" placeholder="正文段落…"
                class="flex-1 p-3 text-sm focus:outline-none resize-none min-w-0"
              />
              <div v-else class="flex-1 p-2">
                <img :src="blockUrl(b)" class="w-full rounded-lg max-h-40 object-cover" loading="lazy" decoding="async" @click="store.openImagePreview([blockUrl(b)], 0)" />
              </div>
              <div class="flex flex-col items-center gap-0.5 p-1.5">
                <button @click="moveBlock(i, -1)" class="text-gray-400 active:text-[#8B5CF6]"><ChevronUp class="w-4 h-4" /></button>
                <button @click="moveBlock(i, 1)" class="text-gray-400 active:text-[#8B5CF6]"><ChevronDown class="w-4 h-4" /></button>
                <button @click="removeBlock(i)" class="text-gray-300 active:text-red-500"><Trash2 class="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          <div class="flex gap-2 mt-2">
            <button @click="addTextBlock" class="flex-1 py-2 rounded-xl border border-dashed border-[#8B5CF6]/40 text-[#8B5CF6] text-[12px] font-bold flex items-center justify-center gap-1 active:bg-purple-50"><Plus class="w-3.5 h-3.5" /> 文字段落</button>
            <button :disabled="uploading" @click="imageInput?.click()" class="flex-1 py-2 rounded-xl border border-dashed border-[#8B5CF6]/40 text-[#8B5CF6] text-[12px] font-bold flex items-center justify-center gap-1 active:bg-purple-50 disabled:opacity-50"><ImageIcon class="w-3.5 h-3.5" /> {{ uploading ? '上传中…' : '插图' }}</button>
          </div>
        </div>
        <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="pickImages" />

        <!-- 短视频（仅视频类型） -->
        <div v-if="contentType === 'video'">
          <div class="text-xs font-bold text-gray-700 mb-1.5">短视频（学员端可播放）</div>
          <div v-if="videoUrl" class="rounded-xl overflow-hidden bg-gray-900 relative">
            <video :src="videoUrl" class="w-full aspect-video object-cover" preload="metadata" muted playsinline webkit-playsinline @click="store.openVideoPreview(videoUrl)" />
            <button @click="videoUrl = ''" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"><X class="w-3.5 h-3.5" /></button>
          </div>
          <button v-else @click="videoInput?.click()" class="w-full py-2.5 rounded-xl border border-dashed border-[#8B5CF6]/40 text-[#8B5CF6] text-[12px] font-bold flex items-center justify-center gap-1 active:bg-purple-50"><Video class="w-3.5 h-3.5" /> 添加视频</button>
        </div>
        <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="pickVideo" />

        <button @click="doAdd" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold active:opacity-90">确认发布</button>
      </div>
    </VanPopup>
  </div>
</template>