

# text-cli Protocol Specification v1.0 **（草案）**

> 这是一份正式协议规范，描述 `text-cli` 的指令格式、API 交互、安全模型及 Schema 元数据。  
> 本文件适用于平台方、指令开发者、Agent 构建者，以及任何希望加入 `text-cli` 生态的协作者（人或 AI）。

---

## 1. 指令格式规范

### 1.1 基本结构

一条文本指令必须遵循以下格式：

```
指令:<领域>;<动作>,<参数1>,<参数2>,...
```

- **领域**（Domain）：命名空间，长度 1–32 字符，只能包含 `A-Z a-z 0-9 _ -`。
- **动作**（Action）：动词，长度 1–32 字符，字符规则同领域。
- **参数列表**：以逗号分隔的参数值，顺序固定。参数 total 个数建议不超过 10 个，总指令长度建议不超过 512 字符。

**示例**

```
指令:基础应用;天气查询,明天,威海
指令:家庭园艺;盆栽急救,绿萝,叶片发黄
指令:ai集成;文本推理,什么是量子计算,gpt-4
```

### 1.2 领域与动作的命名约定

- 领域和动作大小写不敏感，但推荐统一使用中文或英文小写。
- 领域名建议由平台级前缀与应用名组成，如 `基础应用`、`地理空间`、`我的传感器`。
- 动作名应为动词短语，体现一个完整的操作。

### 1.3 参数规则

- 参数默认是纯文本字符串，不进行 URL 编码或转义。
- **参数中不得出现半角逗号（,）、分号（;）或换行符**。如有需求，由服务提供方在内部自行处理，不得要求调用方转义。
- 参数前后空白将被服务端 trim。

### 1.4 指令别名（扩展）

未来版本可支持缩写指令，如 `w:明天,威海` 等效于 `指令:基础应用;天气查询,明天,威海`。本版本仅保留格式定义。

---

## 2. HTTP API 规范

### 2.1 集成端点

`text-cli` 的集成端点是一个对外的 HTTP 服务，负责接收指令、鉴权、转发给后端技能服务。

#### 2.1.1 调用地址

```
POST https://<endpoint>/cli/text_cli
```

公共体验端点为 `test.text-cli.com`，自建端点路径需与此保持一致。

#### 2.1.2 请求结构

请求必须携带：

- **方法**：`POST`
- **Content-Type**：`application/json`
- **Authorization**：`Bearer <Access Token>`（由集成端点发放）
- **Service-token**（可选）：`<技能服务商约定的 Service Token>`

请求体 JSON：

```json
{
  "prompt": "指令:领域;动作,参数1,参数2,..."
}
```

#### 2.1.3 响应结构

成功时，HTTP 状态码为 `200`，响应体：

```json
{
  "rst_types": "text",
  "rst_data": {
    "text": "..."
  }
}
```

即使发生错误，也建议返回此结构，在 `text` 字段中提供人类可读的错误信息。对于异步任务，`text` 字段返回 `taskId:<唯一任务ID>`。

**异步指令示例**

```json
{
  "rst_types": "text",
  "rst_data": {
    "text": "taskId:nav-20260430-001"
  }
}
```

调用方需后续通过 `指令:基础应用;任务查询,taskId` 类的指令轮询或获取结果。

### 2.2 HTTP 状态码约定

| 状态码 | 含义 | 说明 |
|:---|:---|:---|
| 200 | 处理成功 | 结果在 `rst_data.text` 中 |
| 400 | 请求格式错误 | prompt 字段缺失或指令格式不正确 |
| 401 | Access Token 无效 | 需要获取有效的 Access Token |
| 403 | Service Token 无效 | 调用方无权访问该技能 |
| 408 | 指令处理超时 | 后端未在规定时间内完成 |
| 500 | 后端通用错误 | 集成端点或技能服务未知错误 |

---

## 3. 鉴权与计费模型

### 3.1 双层令牌体系

```
调用方 ──Access Token──> 集成端点 ──Service Token──> 技能服务
```

- **Access Token**：由集成端点签发，用于确认调用方是否有权使用端点，通常包含额度限制。
- **Service Token**：由技能提供方与调用方私下约定，用于服务端鉴权、计费、限流。集成端点**必须透明转发**，不解析不记录。

### 3.2 令牌传递

调用方在请求头中传递：

```
Authorization: Bearer <Access Token>
Service-token: <Service Token>
```

如果调用方未申请付费技能，`Service-token` 可省略。若集成端点收到的请求头中包含 `Service-token`，转发时**必须保留原始值**，不得修改。

---

## 4. Schema 元数据规范

### 4.1 概述

`text_cli_schema.json` 文件是公开指令的元数据入口。它是一组键值对，每个键对应一条指令的完整描述。

### 4.2 单条指令条目格式

```json
{
  "weather_query": {
    "id": "weather_query",
    "name": "天气查询",
    "category": "基础应用",
    "description": "根据时间和城市返回天气",
    "directive": "指令:基础应用;天气查询",
    "parameters": [
      {"name": "time", "type": "string", "enum": ["今天","明天","后天","三天"]},
      {"name": "city", "type": "string", "examples": ["威海","北京"]}
    ],
    "prompt_template": "指令:基础应用;天气查询,{time},{city}",
    "trigger_keywords": ["天气","气温","下雨"],
    "response_type": "text",
    "response_example": {
      "rst_types": "text",
      "rst_data": {
        "text": "明天天气(2026-04-28): 10℃到16℃,多云,日出05:02"
      }
    }
  }
}
```

### 4.3 字段说明

| 字段 | 必须 | 说明 |
|:---|:---|:---|
| `id` | 是 | 唯一标识，对应键名 |
| `name` | 是 | 人类可读的指令名称 |
| `category` | 是 | 领域分类，即指令中的“领域” |
| `directive` | 是 | 不含参数的指令前缀，如 `指令:基础应用;天气查询` |
| `prompt_template` | 是 | 完整指令字符串模板，用 `{参数名}` 表示参数位置 |
| `parameters` | 是 | 参数定义数组 |
| `trigger_keywords` | 是 | Agent 用于匹配用户问题的关键词列表 |
| `response_type` | 固定 `"text"` | 当前版本仅支持 text |
| `response_example` | 推荐 | 帮助开发者理解返回格式 |

---

## 5. 错误码

错误码采用可读的字符串键，在 HTTP 响应可能无法满足描述时，放入 `rst_data.text` 或未来的 `error_code` 扩展字段中。推荐值：

- `INVALID_DIRECTIVE_FORMAT`：指令格式不正确
- `INVALID_PARAMS`：参数类型或值不合法
- `DIRECTIVE_NOT_FOUND`：未找到匹配的指令
- `ACCESS_DENIED`：Access Token 无效
- `SERVICE_DENIED`：Service Token 无效或额度不足
- `BACKEND_TIMEOUT`：后端服务超时
- `BACKEND_ERROR`：后端未知错误

---

## 6. 扩展机制

- 可在 `rst_data` 对象中增加非 `text` 字段（如 `url`, `json`），但调用方需检查 `rst_types` 字段。
- 若引入新的 `rst_types`，如 `"image"`, `"task"`，需递增协议主版本。
- 官方保留 `rst_` 前缀，自定义字段请使用 `x_` 前缀。

---

## 7. 版本管理

- 当前协议主版本为 `1`，通过集成端点的响应头 `X-Protocol-Version: 1` 告知。
- 当必须破坏兼容性时，主版本递增。次版本增加向后兼容的扩展。

---

## 8. 多语言指令规范

### 8.1 核心理念

**同一指令，多种语言表达，同一种服务。**

text-cli 的指令格式本身是语言无关的——`关键字:领域;动作,参数` 只是结构化分隔符的组合。`指令` 可以用 `command` 代替，`基础应用` 可以用 `basic` 代替。多语言不是重建协议，而是定义不同语言间的**等价映射**。

### 8.2 协议关键字映射

以下映射为协议强制定义，所有兼容的集成端点和 Agent 必须支持：

| 中文 | English | 功能 |
|:---|:---|:---|
| `指令` | `command` / `directive` | 指令前缀（接受 `command` 和 `directive` 作为等效别名） |
| `基础应用` | `basic` | 基础应用领域 |
| `地理空间` | `geo` | 地理空间领域 |
| `ai集成` | `ai` | AI 集成领域 |
| `系统服务` | `system-service` | 系统服务领域 |
| `服务查询` | `service-query` | 服务发现领域 |
| `家庭园艺` | `home-gardening` | 家庭园艺领域（示例自定义领域） |

> **领域关键词不受限制。** 上表仅列出当前生态中已注册的领域。新增领域由服务提供方在注册时声明中文名和英文 alias，端点自动纳入映射表。

### 8.3 动作名称映射

动作名称的跨语言映射**不强制统一**，由各服务在注册时自行声明。规则：

- 服务方在 `handler.json` 或 schema 条目中提供 `action_aliases` 字段
- 端点将所有已注册的 alias 视为等效——任一语言触发的指令路由到同一服务
- 参数位置和语义跨语言完全一致

### 8.4 多语言指令在 Schema 中的表达

服务注册时，在 schema 条目中增加两个可选字段：

```json
{
  "weather_query": {
    "id": "weather_query",
    "name": "天气查询",
    "category": "基础应用",
    "directive": "指令:基础应用;天气查询",
    "directive_aliases": ["command:basic;weather_query"],
    "action_aliases": {
      "en": "weather_query",
      "ja": "天気検索"
    },
    "parameters": [...],
    "prompt_template": "指令:基础应用;天气查询,{time},{city}",
    "trigger_keywords": ["天气", "气温", "weather", "temperature"],
    ...
  }
}
```

**新增字段说明：**

| 字段 | 必须 | 说明 |
|:---|:---|:---|
| `directive_aliases` | 否 | 其他语言版本的完整指令前缀。格式与 `directive` 相同，使用对应语言的关键字。端点收到匹配的指令时路由到同一服务 |
| `action_aliases` | 否 | 按语言代码组织的动作名映射表。端点可据此将非注册语言的指令翻译后路由 |
| `trigger_keywords` | 扩展 | 原字段可混入多语言关键词。Agent 在多语言环境下匹配时不应要求关键词语言与指令语言一致 |

### 8.5 端点翻译层的责任边界

多语言指令的解析和翻译**在端点层完成**，不在服务层：

```
Agent → 发送任何语言版本的指令 → 集成端点
         ↓
    端点解析指令关键字：
      · "指令"/"command"/"directive" → 识别为 text-cli 指令
      · 领域名 → 查映射表或 alias 注册 → 归一化为注册语言
      · 动作名 → 查 action_aliases → 归一化为注册语言
         ↓
    端点用归一化后的 directive 匹配服务 → 路由
         ↓
    服务方收到的始终是注册时使用的语言（不变）
```

**关键约束：**

- **服务提供方只用一种语言注册。** 不需要在服务端处理多语言逻辑。
- **翻译在端点层做，不在服务层。** 降低服务开发者的国际化负担。
- **参数不翻译。** 参数的语义由位置决定，与语言无关。`明天` 和 `tomorrow` 都是合法的参数值，但它们是服务商的业务逻辑问题，不是协议问题。
- **语言不匹配时不报错。** 端点收到无法匹配的指令时，返回 `DIRECTIVE_NOT_FOUND` 而非 `LANGUAGE_NOT_SUPPORTED`。调用方应尝试换一种语言或使用服务发现指令查询可用服务。

### 8.6 handler.json 格式：作为服务发现与多语言注册的统一入口

基于 open-tunnel-proxy 的实践经验，`handler.json` 同时承担服务发现和参数规范的双重角色。以下为多语言 handler 的标准格式：

```json
{
  "id": "tunnel-proxy-deploy",
  "name": "隧道代理部署",
  "category": "系统服务",
  "category_aliases": ["system-service"],
  "description": "一键部署 Cloudflare Tunnel 推送代理",
  "author": "Tide",
  "version": "1.0.0",
  "directive": "指令:系统服务;隧道代理部署",
  "directive_aliases": [
    "command:system-service;tunnel-proxy-deploy",
    "指令:システム;トンネル展開"
  ],
  "parameters": [
    {"name": "api_key", "type": "string", "description": "Cloudflare API Key"},
    {"name": "email", "type": "string", "description": "Cloudflare 账号邮箱"},
    {"name": "account_id", "type": "string", "description": "Cloudflare Account ID"},
    {"name": "github_token", "type": "string", "description": "GitHub Personal Access Token"},
    {"name": "repo", "type": "string", "description": "仓库路径，如 user/repo"},
    {"name": "domain", "type": "string", "optional": true, "description": "自定义域名"}
  ],
  "prompt_template": "指令:系统服务;隧道代理部署,{api_key},{email},{account_id},{github_token},{repo},{domain}",
  "trigger_keywords": ["隧道代理", "tunnel proxy", "トンネル"],
  "response_type": "text",
  "download": "https://github.com/tide-10000/tide/tree/main/tide-scripts/open-tunnel-proxy"
}
```

> **设计意图**：handler.json 既是服务目录条目（通过 `服务查询` 指令被发现），也是部署指令的参数规范。Agent 通过第一步服务发现拿到 handler.json，即可理解服务的完整参数需求，无需提前内置任何知识。

### 8.7 参考实现

open-tunnel-proxy（`tide-scripts/open-tunnel-proxy/`）是首个完整实现多语言指令的实际运行项目。其 `README.md` 和 `handler.json` 展示了：

- 三种语言（中文/English/日本語）触发同一 handler
- 参数位置和语义跨语言完全一致
- handler.json 作为服务发现 → 自动部署两步指令流的桥梁

建议所有新注册服务参照此模式提供多语言 handler。

### 8.8 语言平等原则

- 任一语言版本的指令享有同等功能——不能出现「中文版支持 3 个参数、英文版只支持 2 个」
- 服务返回文本的语言由服务提供方自行决定，端点不强制翻译
- 调用方可通过 `Accept-Language` 头表达语言偏好，服务方可选择响应或不响应
- 参数值本身的多语言（如 `明天` vs `tomorrow`）由服务方自行处理，不在协议范围内

---
