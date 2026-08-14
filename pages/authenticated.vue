<script setup lang="ts">
const { fetchSession } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

await navigateTo(user.value ? '/dashboard' : '/not-authenticated')
</script>

<template>
  <div class="page">
    <p>Redirecting…</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
