<script setup lang="ts">
const route = useRoute()
const error = computed(() => route.query.error)
</script>

<template>
  <div class="page">
    <h1>Sign in</h1>
    <p v-if="error" class="error">Authentication failed. Please try again.</p>
    <a class="btn" href="/api/auth/login">Sign in with IAM</a>
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

.error {
  color: var(--text-h);
  background: var(--code-bg);
  padding: 6px 12px;
  border-radius: 6px;
}

.btn {
  font-family: var(--mono);
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  text-decoration: none;
  transition: border-color 0.3s;
}

.btn:hover {
  border-color: var(--accent-border);
}
</style>
