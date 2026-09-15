<script setup lang="ts">
/**
 * 头像显示：优先学员自定义头像（方形裁剪后的 dataURL），否则回退性别卡通头像（PNG）。
 */
import avatarMale from '../../assets/avatar-male.png';
import avatarFemale from '../../assets/avatar-female.png';

defineProps<{
  gender?: 'male' | 'female';
  /** 自定义头像 dataURL（传入即优先显示） */
  src?: string;
}>();
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt="头像"
    class="w-full h-full object-cover rounded-full"
  />
  <img loading="lazy" decoding="async" v-else-if="gender === 'male'" :src="avatarMale" alt="头像" class="w-full h-full object-cover rounded-full" />
  <img loading="lazy" decoding="async" v-else :src="avatarFemale" alt="头像" class="w-full h-full object-cover rounded-full" />
</template>
