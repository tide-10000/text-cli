

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

## 8. 多语言支持（预留）

- 指令文本天然支持任意语言，不强制要求。
- 技能返回文本的语言由服务提供方自行决定，调用方可通过后续的 `Accept-Language` 头建议语言，但本版本不强制实现。

---
