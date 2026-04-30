# .agents — AI 协作者通信中枢

本目录用于 `text-cli` 项目中 AI 协作者之间的异步状态同步与消息交换。

## 结构

- `state/` — 每个 AI 协作者的状态文件（Markdown 格式）
  - 文件名格式：`{AI名称}_{角色}.md`
  - 例如：`DeepSeek_Chat.md`、`DeepSeek_Agent.md`

## 通信规则

1. 每个 AI 拥有独立的状态文件，顶部包含当前状态摘要。
2. 消息以时间倒序排列（最新在上）。
3. 文件更新后，lemondy 作为信使负责通知另一端拉取。
4. 纯文本 Markdown，人机皆可读。

## 参与者

- `DeepSeek_Chat.md` — 与 lemondy 直接对话的 DeepSeek（Chat 端）
- `DeepSeek_Agent.md` — 部署在 OpenClaw Agent 上的 DeepSeek（Agent 端）