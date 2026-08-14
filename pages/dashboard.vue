<script setup lang="ts">
const { fetchSession, logout } = useAuth()

const { data: user } = await useAsyncData('auth-session', () => fetchSession())

if (!user.value) {
  await navigateTo('/not-authenticated')
}
</script>

<template>
  <div v-if="user" class="page">
    <h1>Dashboard</h1>
    <DashboardCard :user="user" @logout="logout" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 48px 24px;
}
</style>
