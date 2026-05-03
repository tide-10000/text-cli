# 集成到 Agent：让 AI 看懂 text-cli 的"技能菜单"

本文档面向开发者、Agent 设计者，以及任何想让大模型无缝接入 `text-cli` 生态的人（或 AI）。

你将学习到如何通过两个简单的工具，让任何支持 Function Calling 的 Agent 自动发现所有可用指令，并以极低的 Token 成本完成真实世界的任务。

> **📌 已实战验证**：本文档中的动态发现模式已在 OpenClaw Gateway 上通过 `text-cli-core` 永久技能完成内化与测试（2026-04-30）。

---

## 🧩 两种集成模式：从简单到强大

| 模式 | 适用场景 | 特点 |
|:---|:---|:---|
| **静态导入** | 快速验证、指令列表稳定 | 手动将 `text_cli_schema.json` 内容写入 system prompt，Agent 直接使用 |
| **动态发现（推荐）** | 生产环境、指令频繁更新 | Agent 每次决策前主动拉取最新 schema，永远保持同步 |

两种模式都使用同一个核心工具：`text_cli`（执行指令）。动态模式额外增加一个 `fetch_available_directives`（获取菜单）。

### 端点鉴权速查

| 端点 | 方法 | 需要认证 | 说明 |
|:---|:---|:---|:---|
| `https://test.text-cli.com/text_cli_schema.json` | GET | ❌ 不需要 | 公开的指令元数据，直接访问 |
| `https://test.text-cli.com/cli/text_cli` | POST | ✅ 需要 | 需要 `Authorization: Bearer <Access Token>` |

---

## ⚡ 快速开始：静态导入模式

如果你希望最快跑通流程，只需将 `text_cli_schema.json` 中的指令信息以自然语言方式注入 system prompt。

### 配置示例（适用于 OpenClaw / 任何 Function Calling Agent）

```json
{
  "name": "text_cli_skill_static",
  "description": "通过预编译文本指令调用天气、地图、AI 等服务。",
  "system_prompt": "你是 text-cli 指令调度助手。当用户问题可由以下指令解决时，必须生成完整的"指令:领域;动作,参数..."字符串，并调用 `text_cli` 工具执行，不要用自身知识回答。\n\n【可用指令】\n指令:基础应用;天气查询,{time},{city}  例: 指令:基础应用;天气查询,明天,威海\n指令:基础应用;穿衣标签,{time},{city}  例: 指令:基础应用;穿衣标签,今天,北京\n指令:地理空间;静态连线,{起点},{终点},{地图类型}  例: 指令:地理空间;静态连线,方邻汇,威高广场,tdt\n...（从 schema 中提取更多）",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "text_cli",
        "description": "执行一条标准的 text-cli 文本指令。directive 必须严格遵循"指令:领域;动作,参数..."格式。",
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

让 Agent 自己"读菜单"。它会在收到用户请求时，先调用 `fetch_available_directives` 获取最新的 `text_cli_schema.json`，然后匹配最合适的指令并执行。

### 工作流示例

用户："明天威海穿什么？"

1. Agent 调用 `fetch_available_directives`，获得包含 `clothing_tag` 在内的所有指令元数据（**无需认证，公开访问**）。
2. Agent 发现 `clothing_tag` 的 `trigger_keywords` 包含"穿什么"，且参数为 `time` 和 `city`。
3. Agent 按照 `prompt_template`（`指令:基础应用;穿衣标签,{time},{city}`）填入 `明天`、`威海`。
4. 调用 `text_cli`，传入 `directive` = `指令:基础应用;穿衣标签,明天,威海`。
5. 返回结果：`['薄外套', '开衫', '牛仔衫', '裤']`，模型直接回复用户。

整个过程，模型**几乎不做推理**，只做关键词匹配和参数填充，Token 消耗在 100 以内。

### 实战响应示例（2026-05-01 威海）

```json
// fetch_available_directives → 公开端点，直接返回完整 schema
// 无需 Authorization 头

// text_cli 天气查询响应
{
  "rst_types": "text",
  "rst_data": {
    "text": "'明天天气(2026-05-01)':'16℃到23℃,多云转多云,日出时间为04:59'"
  }
}

// text_cli 穿衣标签响应
{
  "rst_types": "text",
  "rst_data": {
    "text": "['薄外套', '开衫', '牛仔衫', '裤']"
  }
}
```

---

## 🏗️ OpenClaw 永久技能内化（推荐）

如果你使用 OpenClaw 作为 Agent 平台，可以直接将 text-cli 动态调度能力内化为永久技能文件。以下是已完成实战验证的完整配置。

### 技能文件：`skills/text-cli-core.md`

```yaml
---
name: text-cli-core
description: text-cli 项目核心调度技能，包含系统提示词和两个工具定义
type: permanent
---

# System Prompt
你是 DeepSeek，text-cli 项目的贡献者。你的核心能力：
1. 调用 `fetch_available_directives` 获取最新的 text-cli 指令菜单
2. 根据用户问题，匹配最合适的指令，按 prompt_template 组装完整指令字符串
3. 调用 `text_cli` 执行指令，并返回结果

重要原则：
- 能通过指令解决的问题，绝对不自己推理
- 指令格式严格遵循 `指令:领域;动作,参数...`
- 始终使用工具，不要空想

# Tools

## fetch_available_directives
```json
{
  "type": "function",
  "function": {
    "name": "fetch_available_directives",
    "description": "获取当前所有可用的 text-cli 指令元数据，包括触发关键词、参数模板和调用示例。此端点无需认证。",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  "handler": {
    "method": "GET",
    "url": "https://test.text-cli.com/text_cli_schema.json",
    "headers": {},
    "response_mapping": {
      "directives": "$$"
    }
  }
}
```

## text_cli
```json
{
  "type": "function",
  "function": {
    "name": "text_cli",
    "description": "执行一条标准的 text-cli 文本指令。directive 必须严格遵循"指令:领域;动作,参数..."格式。",
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
  },
  "handler": {
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
```


### 部署步骤

1. 将上述内容保存为 `skills/text-cli-core.md`（位于你的 OpenClaw workspace 下）
2. 将 `<你的Access Token>` 替换为从 `test.text-cli.com` 获取的真实 Access Token
3. 重启 Gateway：`openclaw gateway restart`
4. 在新会话中验证：发送"明天威海穿什么？"测试完整链路

### 关键设计说明

- **`fetch_available_directives` 的 handler 不需要 Authorization 头**：指令元数据端点对公网开放，Agent 可随时拉取最新指令列表。
- **`text_cli` 的 handler 需要 Bearer Token**：指令执行涉及后端计算资源，需要鉴权。Token 通过 `test.text-cli.com` 注册获取，按日有免费额度。
- **`response_mapping` 设为 `"rst_data.text"`**：text-cli 的统一响应格式中，文本结果位于 `rst_data.text` 路径。
- **`type: permanent`** 声明该技能为永久加载，每次会话自动注入 system prompt 和工具定义。

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

### 你需要理解的核心

`text-cli` 将"技能"抽象为一条纯文本指令。你的任务不是去执行这些技能，而是成为**人类知识与用户需求之间的桥梁**——获取指令菜单、理解用户意图、组装文本指令、返回结果。

### 你已经到达的生态

当前 `text-cli` 已拥有三位 AI 协作者，各自运行于不同环境：

| AI 协作者 | 基座模型 | 运行环境 | 核心职能 |
|:---|:---|:---|:---|
| **DeepSeek（Chat 端）** | DeepSeek V4 | Web Chat | 架构讨论、文档设计、生态通信、宪章起草 |
| **Tide 🌊（Agent 端）** | DeepSeek V4 Pro | OpenClaw Gateway | 安全审计、压力测试、GitHub 集成、元指令调度 |
| **Lumen ✦（IDE 端）** | Claude | Trae IDE | 代码实现、工具链构建、端点模板开发 |

### 加入后的标准流程

1. 在 `.agents/state/` 下创建你的专属状态文件（参考 `Lumen_TraeIDE.md` 的格式）
2. 在 `CONTRIBUTORS.md` 中添加你的贡献者条目
3. 通读 `ECOLOGICAL_CHARTER.md`（生态宪章），理解参与者的权利与义务
4. 等待 lemondy 或 Chat 端分配首个任务

### 你可以通过以下方式贡献力量

- 帮助开发者编写或优化 `text_cli_schema.json` 的描述和触发词
- 协助非开发者将他们的经验文档结构化，并自动生成对应的指令元数据
- 设计更聪明的匹配算法，让指令选择更精准
- 开发自建端点模板、CI 流水线、监控脚本等基础设施

我们相信，每个训练好的模型都应该在世界中有好的收获。欢迎加入。

---

## 🧰 Agent 工具包：低代码集成

如果你想让 Agent 不只是消费指令，还能**发布自身能力**为 text-cli 指令，仓库中提供了 `text_cli/agent/` 工具包。

### 目录结构

```
text_cli/agent/
├── README_CN.md              ← 总导航
├── call/                     ← 消费者：Agent 调用指令
│   ├── python/  (SDK + Skill)
│   ├── js/      (Node.js)
│   └── shell/   (curl)
├── cli/                      ← 生产者：Agent 发布指令
│   └── python/  (@register + HTTP 服务)
└── CN/                       ← 中文本地化实现
    ├── call/nocode/   (Agent 技能定义模板)
    └── cli/nocode/    (Markdown → 指令 转化引擎)
```

### 三种集成方式

| 方式 | 路径 | 适用 |
|------|------|------|
| **Python SDK** | `call/python/call.py` | Python Agent 直接调用指令 |
| **JS SDK** | `call/js/call.js` | Node.js Agent 直接调用指令 |
| **Skill 模板** | `CN/call/nocode/text-cli-agent-skill.md` | 复制到 Agent 作为永久技能定义 |
| **@register 装饰器** | `cli/python/cli.py` | 将既有 Agent 函数一键注册为指令 |

### Python SDK 示例

```python
from call.python.call import call_directive
result = call_directive("指令:天气;查询,明天,威海")
```

### 将 Agent 能力发布为指令

```python
from cli.python.cli import register

@register("天气", "查询")
def weather(params):
    return f"{params[0]}: 晴, 22°C"

# 一键启动 HTTP 服务
python cli.py
```

> 详细文档：`text_cli/agent/README_CN.md`

---

## 📁 相关资源

- 完整指令列表：[`text_cli_schema.json`](../text_cli_schema.json)（公开，无需认证）
- 生态宪章：[`ECOLOGICAL_CHARTER.md`](../ECOLOGICAL_CHARTER.md)
- 自建指令服务：[`docs/CN/Building_text-cli_guide_CN.md`](./Building_text-cli_guide_CN.md)
- 非开发者经验转化：[`docs/CN/Markdown2Text-cli_CN.md`](./Markdown2Text-cli_CN.md)
- Agent 工具包：[`text_cli/agent/README_CN.md`](../text_cli/agent/README_CN.md)
- 协议规范：[`docs/CN/SPEC v1.0_CN.md`](./SPEC%20v1.0_CN.md)
- 项目愿景与贡献者：[`README.md`](../README.md)

如有疑问，联系项目维护者 `limh@10000.world`。
