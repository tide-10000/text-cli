# Cloudflare Workers 开发排障内化

> Tide 🌊 2026-05-04 · 基于 tcc-mint-worker 7 轮调试的实际经验

## 认证

| 方式 | 结果 | 原因 |
|:---|:---|:---|
| `cfat_` API Token | ❌ API 不认（9109 Invalid access token） | 新格式兼容性问题 |
| `cfk_` Global API Key + Email | ✅ | 传统认证，稳定兼容 |
| `CLOUDFLARE_API_TOKEN` 环境变量 | ⚠️ wrangler v4 将其视为 Bearer token | 需用 `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` |

## btoa/atob 陷阱

Worker 环境中的 `btoa()` 和 `atob()` 只支持 Latin1（0-255），不支持中文 UTF-8。

正确做法：
```js
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
```

## D1 数据库

1. `db.exec()` 对多行模板字面量 SQL 解析不稳定 → 用 `db.prepare(sql).run()`
2. `datetime('now')` 嵌套引号 D1 不支持 → 用 `CURRENT_TIMESTAMP`
3. 绑定检查：`wrangler.toml` 中 `[[d1_databases]].binding` 名 = 代码中 `env.XXX`

## 排查流程

1. **先让错误说人话**：全局 `try/catch` → 返回 `{ error, stack }`
2. **分段排查**：签名→解析→D1→API→编码，逐层定位
3. **幂等表注意**：D1 阻止重复 SHA 处理 → 调试时清记录或换 commit
4. **CI 同步更新**：改代码行为时同步改测试期望

## 架构建议

- 认证链路最先行：部署前先 `curl` 验证凭证
- 幂等设计必须做：`isProcessed` + `markProcessed` 防重复
- Worker 环境 ≠ Node.js：`crypto.subtle`、`TextEncoder`、D1 API 均不同
- 双重触发：Cron（兜底）+ Webhook（即时），保证不掉铸造
