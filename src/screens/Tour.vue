<script setup lang="ts">
import { useRouter } from 'vue-router'
import TourCarousel from '../components/TourCarousel.vue'

const router = useRouter()

function close() {
  if (router.options.history.state.back) router.back()
  else router.replace({ name: 'today' })
}
</script>

<template>
  <TourCarousel replay @finish="close" />
</template>
