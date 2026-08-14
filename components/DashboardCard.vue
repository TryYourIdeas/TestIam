<script setup lang="ts">
defineProps<{ user: { username: string; email: string } }>()
defineEmits<{ logout: [] }>()
</script>

<template>
  <div class="card">
    <p>Signed in as <strong>{{ user.email }}</strong></p>
    <p class="muted">subject: {{ user.username }}</p>
    <button type="button" class="btn" @click="$emit('logout')">Log out</button>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
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
