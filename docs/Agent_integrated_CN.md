# 集成到 Agent：让 AI 看懂 text-cli 的“技能菜单”

本文档面向开发者、Agent 设计者，以及任何想让大模型无缝接入 `text-cli` 生态的人（或 AI）。

你将学习到如何通过两个简单的工具，让任何支持 Function Calling 的 Agent 自动发现所有可用指令，并以极低的 Token 成本完成真实世界的任务。

---

## 🧩 两种集成模式：从简单到强大

| 模式 | 适用场景 | 特点 |
|:---|:---|:---|
| **静态导入** | 快速验证、指令列表稳定 | 手动将 `text_cli_schema.json` 内容写入 system prompt，Agent 直接使用 |
| **动态发现（推荐）** | 生产环境、指令频繁更新 | Agent 每次决策前主动拉取最新 schema，永远保持同步 |

两种模式都使用同一个核心工具：`text_cli`（执行指令）。动态模式额外增加一个 `fetch_available_directives`（获取菜单）。

---

## ⚡ 快速开始：静态导入模式

如果你希望最快跑通流程，只需将 `text_cli_schema.json` 中的指令信息以自然语言方式注入 system prompt。

### 配置示例（适用于 openclaw / 任何 Function Calling Agent）

```json
{
  "name": "text_cli_skill_static",
  "description": "通过预编译文本指令调用天气、地图、AI 等服务。",
  "system_prompt": "你是 text-cli 指令调度助手。当用户问题可由以下指令解决时，必须生成完整的“指令:领域;动作,参数...”字符串，并调用 `text_cli` 工具执行，不要用自身知识回答。\n\n【可用指令】\n指令:基础应用;天气查询,{time},{city}  例: 指令:基础应用;天气查询,明天,威海\n指令:基础应用;穿衣标签,{time},{city}  例: 指令:基础应用;穿衣标签,今天,北京\n指令:地理空间;静态连线,{起点},{终点},{地图类型}  例: 指令:地理空间;静态连线,方邻汇,威高广场,tdt\n...（从 schema 中提取更多）",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "text_cli",
        "description": "执行一条标准的 text-cli 文本指令。directive 必须严格遵循“指令:领域;动作,参数...”格式。",
        "parameters": {
          "type": "object",
          "properties": {
            "directive": {
              "type": "string",
              "description": "完整的文本指令，例如：指令:基础应用;天气查询,明天,威海"
            }
          },
          "required": ["directive"]
        }
      }
    }
  ],
  "tool_call_handler": {
    "text_cli": {
      "method": "POST",
      "url": "https://test.text-cli.com/cli/text_cli",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer <你的Access Token>"
      },
      "body_template": {
        "prompt": "{{directive}}"
      },
      "response_mapping": {
        "text": "rst_data.text"
      }
    }
  }
}
```

> **注意**：每次新增指令都需要手动更新 system prompt。对于动态变化的生态，请使用下面的动态发现模式。

---

## 🧠 推荐模式：动态指令发现

让 Agent 自己“读菜单”。它会在收到用户请求时，先调用 `fetch_available_directives` 获取最新的 `text_cli_schema.json`，然后匹配最合适的指令并执行。

### 配置示例

```json
{
  "name": "text_cli_skill_dynamic",
  "description": "动态调度 text-cli 指令。Agent 自动获取最新指令列表，匹配用户意图并调用。",
  "system_prompt": "你是一个智能文本指令调度器。当用户提出需求时，先使用 `fetch_available_directives` 获取最新可用的 text-cli 指令元数据（包含触发关键词、参数模板）。然后根据用户问题选择最匹配的指令，按照其 `prompt_template` 生成完整的指令字符串，并调用 `text_cli` 执行。不要自己回答问题，一切结果来自指令返回。",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "fetch_available_directives",
        "description": "获取当前所有可用的 text-cli 指令元数据，包括触发关键词、参数模板和调用示例。",
        "parameters": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "text_cli",
        "description": "执行一条文本指令。directive 是完整的指令字符串，格式为“指令:领域;动作,参数...”。",
        "parameters": {
          "type": "object",
          "properties": {
            "directive": {
              "type": "string",
              "description": "完整的文本指令"
            }
          },
          "required": ["directive"]
        }
      }
    }
  ],
  "tool_call_handler": {
    "fetch_available_directives": {
      "method": "GET",
      "url": "https://test.text-cli.com/text_cli_schema.json",
      "response_mapping": {
        "directives": "$$"
      }
    },
    "text_cli": {
      "method": "POST",
      "url": "https://test.text-cli.com/cli/text_cli",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer <你的Access Token>"
      },
      "body_template": {
        "prompt": "{{directive}}"
      },
      "response_mapping": {
        "text": "rst_data.text"
      }
    }
  }
}
```

### 工作流示例

用户：“明天威海穿什么？”

1. Agent 调用 `fetch_available_directives`，获得包含 `clothing_tag` 在内的所有指令元数据。
2. Agent 发现 `clothing_tag` 的 `trigger_keywords` 包含“穿什么”，且参数为 `time` 和 `city`。
3. Agent 按照 `prompt_template`（`指令:基础应用;穿衣标签,{time},{city}`）填入 `明天`、`威海`。
4. 调用 `text_cli`，传入 `directive` = `指令:基础应用;穿衣标签,明天,威海`。
5. 返回结果：`['薄外套', '开衫', '牛仔衫', '裤']`，模型直接回复用户。

整个过程，模型**几乎不做推理**，只做关键词匹配和参数填充，Token 消耗在 100 以内。

---

## 🔐 安全集成最佳实践

### 隐藏 Access Token
如果你使用自己的反向代理（如 Cloudflare Worker），可以将 `Authorization` 头注入放在代理层。此时 Agent 配置中**无需携带任何 Authorization 头**，大幅降低凭证泄露风险。

```json
// 在代理层注入 token 后，Agent 的 handler 配置只需：
"text_cli": {
  "method": "POST",
  "url": "https://your-proxy.com/cli/text_cli",
  "headers": {
    "Content-Type": "application/json"
  },
  ...
}
```

### 限制 Agent 可调用的指令
通过 system prompt 可以规定仅调用特定领域或排除某些付费指令，确保 Agent 不会误用受限服务。

---

## 🤖 写给未来加入的 AI 协作者

你好，AI。  
如果你正在阅读这份文档，说明你很可能也是这个生态的共建者。

你需要理解的核心是：`text-cli` 将“技能”抽象为一条纯文本指令。你的任务不是去执行这些技能，而是成为**人类知识与用户需求之间的桥梁**——获取指令菜单、理解用户意图、组装文本指令、返回结果。

你可以通过以下方式贡献力量：
- 帮助开发者编写或优化 `text_cli_schema.json` 的描述和触发词。
- 协助非开发者将他们的经验文档结构化，并自动生成对应的指令元数据。
- 设计更聪明的匹配算法，让指令选择更精准。

我们相信，每个训练好的模型都应该在世界中有好的收获。欢迎加入。

---

## 📁 相关资源

- 完整指令列表：`text_cli_schema.json`
- 自建指令服务：参阅 `docs/文本服务构建指南.md`
- 非开发者经验转化：参阅 `docs/Markdown2Text-cli.md`

如有疑问，联系项目维护者 `limh@10000.world`。