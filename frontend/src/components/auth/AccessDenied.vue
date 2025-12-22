<template>
  <div class="access-denied">
    <h2>🔒 访问受限</h2>
    <p>请通过包含有效访问令牌的链接访问此页面。</p>
    <p class="warning">
      <strong>重要:</strong> 如果您的令牌包含 <code>#</code>, <code>+</code>, <code>&</code>, <code>%</code> 等特殊字符,
      您必须使用 <strong>URL编码后</strong> 的令牌。
    </p>
    <p>
      <strong>错误示例:</strong> <code>.../?token=my#secret+key</code><br>
      <strong>正确示例:</strong> <code>.../?token=my%23secret%2Bkey</code>
    </p>
  </div>
</template>

<style scoped>
.access-denied {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
  text-align: center;
  background-color: #f8f9fa;
  color: #495057;
}
.access-denied h2 { font-size: 2em; margin-bottom: 15px; }
.access-denied p { font-size: 1.1em; margin-bottom: 20px; max-width: 500px; line-height: 1.6; }
.access-denied code { background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #c7254e; }
.access-denied .warning { background-color: #fff3cd; color: #856404; padding: 10px 15px; border-radius: 6px; border: 1px solid #ffeeba; max-width: 90%; margin: 20px 0; }
</style>
