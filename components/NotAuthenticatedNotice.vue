<template>
  <div class="notice">
    <p class="error">No authenticated</p>
    <a class="btn" href="/">Go home</a>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
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
