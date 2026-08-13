<script setup lang="ts">
const { user, status, fetchSession, logout } = useAuth()

await useAsyncData('auth-session', () => fetchSession())</script>

<template>
  <div class="page">
    <h1>Authenticated</h1>

    <template v-if="status === 'authenticated' && user">
      <p>Signed in as <strong>{{ user.email }}</strong></p>
      <p class="muted">subject: {{ user.username }}</p>
      <button type="button" class="btn" @click="logout">Log out</button>
    </template>

    <p v-else>Not authenticated.</p>
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

.muted {
  color: var(--text);
  font-size: 14px;
}

.btn {
  font-family: var(--mono);
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.3s;
}

.btn:hover {
  border-color: var(--accent-border);
}
</style>
