<template>
  <div class="actions">
    <a class="btn" href="/api/auth/login">Login</a>
    <a class="btn" href="/api/auth/login">Register</a>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 12px;
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
