<script setup lang="ts">
const { fetchSession } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

if (user.value) {
  await navigateTo('/dashboard')
}
</script>

<template>
  <div v-if="!user" class="page">
    <h1>testiam</h1>
    <AuthActions />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
