
# 文本服务构建指南

这份指南将帮助你以最快速度把自己的专业知识、数据或算法，封装成一条标准化的 **文本指令服务**，并通过 `text-cli` 生态对外提供。无论你使用 Node.js 还是 Python，都能在几分钟内跑通第一个指令。

读完你会掌握：
- 你的服务和 `text-cli` 集成端点之间如何交互  
- 两个最小化的服务示例（Node.js + Express / Python + FastAPI）  
- 如何添加 Service Token 鉴权与计费  
- 如何让你的指令被 Agent 自动发现（暴露 `text_cli_schema.json`）  
- 异步任务与多指令封装技巧  

---

## 1. 服务规范

### 1.1 请求约定（集成端点 → 你的服务）

`text-cli` 集成端点（如 `dev1.agentbot.space` 或你的自建代理）会把客户端发来的指令**原样**以 `POST` 形式转发到你的服务。请求体固定为 JSON：

```json
{
  "prompt": "指令:你的领域;你的动作,参数1,参数2,..."
}
```

**请求头中可能携带**：
- `Authorization: Bearer <Access Token>`（由集成端点发放，标识调用者）
- `Service-token: <你与调用者私下约定的 Token>`（用于你端的鉴权 / 计费）
- 其他自定义头（你与集成端点可自由约定）

你的服务只需关注 **如何解析 `prompt` 中的指令文本，并返回正确结果**。

### 1.2 响应约定

返回体必须是 JSON，结构如下：

```json
{
  "rst_types": "text",
  "rst_data": {
    "text": "你的结果（纯文本、JSON字符串、URL、Base64 等均可）"
  }
}
```

- `rst_types`：固定为 `"text"`（当前协议版本 v1）
- `rst_data.text`：**实际返回内容**。可以是自然语言、JSON 字符串、图片链接等，调用方会原样交给大模型或前端展示。
- 错误时也请保持此结构，把错误信息放进 `text` 中（如 `"指令执行失败: 房间ID不存在"`）。

---

## 2. 最小化指令服务示例

我们以一个 **“室内温湿度查询”** 技能为例，假设你有一个传感器数据库，要提供一条指令：`指令:我的传感器;温湿度,房间ID`。

### 2.1 Node.js 版（Express）

**项目初始化**

```bash
mkdir my-skill-js && cd my-skill-js
npm init -y
npm install express
```

**`server.js` 完整代码**

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// ────────────────────────────────────────────
// 核心业务逻辑（模拟传感器数据库）
// ────────────────────────────────────────────
function getRoomClimate(roomId) {
  const db = {
    '101': { temp: 24.5, humidity: 60 },
    '102': { temp: 26.1, humidity: 55 },
    'default': { temp: 25.0, humidity: 58 }
  };
  const data = db[roomId] || db['default'];
  return `房间${roomId}: 温度${data.temp}°C，湿度${data.humidity}%`;
}

// ────────────────────────────────────────────
// 指令解析器（协议核心）
// 格式: 指令:<领域>;<动作>,<参数1>,<参数2>,...
// ────────────────────────────────────────────
function parseDirective(prompt) {
  const body = prompt.replace(/^指令[：:]/, '').trim();
  if (!body.includes(';')) throw new Error('指令格式错误：缺少分号分隔符');
  
  const [domainAndAction, ...params] = body.split(',');
  const [domain, action] = domainAndAction.split(';');
  
  return {
    domain: domain.trim(),
    action: action.trim(),
    params: params.map(p => p.trim())
  };
}

// ────────────────────────────────────────────
// POST /cli/text_cli  主入口
// ────────────────────────────────────────────
app.post('/cli/text_cli', (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        rst_types: 'text',
        rst_data: { text: '错误：缺少 prompt 字段' }
      });
    }

    const { domain, action, params } = parseDirective(prompt);
    console.log(`收到指令: ${domain};${action}, 参数: ${params}`);

    let resultText = '';

    // 路由分发
    if (domain === '我的传感器' && action === '温湿度') {
      if (params.length < 1) throw new Error('参数不足：需要房间ID');
      resultText = getRoomClimate(params[0]);
    } else if (domain === '我的传感器' && action === '列表') {
      resultText = '可用房间: 101, 102';
    } else {
      resultText = `未找到匹配的指令: ${domain};${action}`;
    }

    res.json({
      rst_types: 'text',
      rst_data: { text: resultText }
    });
  } catch (e) {
    res.json({
      rst_types: 'text',
      rst_data: { text: `指令执行失败: ${e.message}` }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`文本指令服务运行在 http://localhost:${PORT}`);
});
```

**本地测试**

```bash
node server.js
```

另开终端：

```bash
curl -X POST http://localhost:3000/cli/text_cli \
  -H "Content-Type: application/json" \
  -d '{"prompt":"指令:我的传感器;温湿度,101"}'
```

返回：

```json
{
  "rst_types": "text",
  "rst_data": {
    "text": "房间101: 温度24.5°C，湿度60%"
  }
}
```

---

### 2.2 Python 版（FastAPI）

**项目初始化**

```bash
mkdir my-skill-py && cd my-skill-py
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn
```

**`main.py` 完整代码**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="我的传感器指令服务")

# ────────────────────────────────────────────
# 核心业务逻辑（模拟传感器数据库）
# ────────────────────────────────────────────
def get_room_climate(room_id: str) -> str:
    db = {
        "101": {"temp": 24.5, "humidity": 60},
        "102": {"temp": 26.1, "humidity": 55},
        "default": {"temp": 25.0, "humidity": 58}
    }
    data = db.get(room_id, db["default"])
    return f"房间{room_id}: 温度{data['temp']}°C，湿度{data['humidity']}%"

# ────────────────────────────────────────────
# 指令解析器（协议核心）
# ────────────────────────────────────────────
def parse_directive(prompt: str) -> dict:
    body = prompt.replace("指令:", "").replace("指令：", "").strip()
    if ";" not in body:
        raise ValueError("指令格式错误：缺少分号分隔符")
    
    domain_action, *params = body.split(",")
    parts = domain_action.split(";")
    if len(parts) != 2:
        raise ValueError("指令格式错误：领域和动作未正确分开")
    
    domain, action = parts[0].strip(), parts[1].strip()
    params = [p.strip() for p in params]
    return {"domain": domain, "action": action, "params": params}

# ────────────────────────────────────────────
# POST /cli/text_cli  主入口
# ────────────────────────────────────────────
@app.post("/cli/text_cli")
async def handle_directive(request: Request):
    try:
        body = await request.json()
        prompt = body.get("prompt", "")
        if not prompt:
            return JSONResponse(
                content={"rst_types": "text", "rst_data": {"text": "错误：缺少 prompt 字段"}},
                status_code=400
            )

        directive = parse_directive(prompt)
        print(f"收到指令: {directive['domain']};{directive['action']}, 参数: {directive['params']}")

        domain = directive["domain"]
        action = directive["action"]
        params = directive["params"]

        # 路由分发
        if domain == "我的传感器" and action == "温湿度":
            if len(params) < 1:
                raise ValueError("参数不足：需要房间ID")
            result = get_room_climate(params[0])
        elif domain == "我的传感器" and action == "列表":
            result = "可用房间: 101, 102"
        else:
            result = f"未找到匹配的指令: {domain};{action}"

        return {
            "rst_types": "text",
            "rst_data": {"text": result}
        }
    except Exception as e:
        return {
            "rst_types": "text",
            "rst_data": {"text": f"指令执行失败: {str(e)}"}
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**本地测试**

```bash
uvicorn main:app --reload
```

测试：

```bash
curl -X POST http://localhost:8000/cli/text_cli \
  -H "Content-Type: application/json" \
  -d '{"prompt":"指令:我的传感器;温湿度,101"}'
```

返回与 Node.js 版一致。

---

## 3. 加入 Service Token 鉴权与计费

生产环境中，你不可能允许任何人无限调用。`text-cli` 集成端点在转发请求时，会**原样透传**调用方携带的 `Service-token` 头，你只需在自己服务中校验即可。

### 3.1 Node.js 版鉴权中间件

```javascript
// 定义你的客户端 Token 库
const VALID_TOKENS = {
  'client-abc-123': { name: '张三', quota: 1000, used: 0 },
  'client-def-456': { name: '李四', quota: 500,  used: 0 }
};

function authenticate(req, res, next) {
  const serviceToken = req.headers['service-token'];
  if (!serviceToken || !VALID_TOKENS[serviceToken]) {
    return res.status(403).json({
      rst_types: 'text',
      rst_data: { text: '无权访问：Service-token 缺失或无效' }
    });
  }
  req.clientInfo = VALID_TOKENS[serviceToken];
  next();
}

// 应用到路由
app.post('/cli/text_cli', authenticate, (req, res) => {
  // ……原有逻辑不变
});
```

### 3.2 Python 版鉴权依赖注入

```python
from fastapi import Header, HTTPException

VALID_TOKENS = {
    "client-abc-123": {"name": "张三", "quota": 1000, "used": 0},
    "client-def-456": {"name": "李四", "quota": 500,  "used": 0}
}

async def verify_service_token(service_token: str = Header(None)):
    if not service_token or service_token not in VALID_TOKENS:
        raise HTTPException(status_code=403, detail="无权访问：Service-token 缺失或无效")
    return VALID_TOKENS[service_token]

@app.post("/cli/text_cli")
async def handle_directive(request: Request, client=Depends(verify_service_token)):
    # ……原有逻辑不变
```

然后在业务逻辑中根据 `client` 信息进行计数、限流或扣费。

**与调用方协商 Service Token**  
你（服务提供者）和调用方私下约定一个 Token，并告知对方：  
> “每次调用 `/cli/text_cli` 时，请在请求头中加入 `Service-token: <约定的Token>`，集成端点会原样转发。”

---

## 4. 让 Agent 自动发现你的指令

为了让 Agent 能动态加载你的指令，你需要在服务上暴露一个 **`text_cli_schema.json`** 端点（或静态文件），描述你提供的指令元数据。

### 4.1 Schema 条目示例

```json
{
  "my_sensor_temp": {
    "id": "my_sensor_temp",
    "name": "室内温湿度查询",
    "category": "我的传感器",
    "description": "根据房间ID返回当前温度和湿度",
    "directive": "指令:我的传感器;温湿度",
    "parameters": [
      {"name": "roomId", "type": "string", "examples": ["101"]}
    ],
    "prompt_template": "指令:我的传感器;温湿度,{roomId}",
    "trigger_keywords": ["温度", "湿度", "传感器", "房间温湿度"],
    "response_type": "text",
    "response_example": {
      "rst_types": "text",
      "rst_data": { "text": "房间101: 温度24.5°C，湿度60%" }
    }
  },
  "my_sensor_list": {
    "id": "my_sensor_list",
    "name": "传感器房间列表",
    "category": "我的传感器",
    "description": "返回所有可查询的房间ID",
    "directive": "指令:我的传感器;列表",
    "parameters": [],
    "prompt_template": "指令:我的传感器;列表",
    "trigger_keywords": ["房间列表", "有哪些房间"],
    "response_type": "text",
    "response_example": {
      "rst_types": "text",
      "rst_data": { "text": "可用房间: 101, 102" }
    }
  }
}
```

### 4.2 静态托管

- **与主服务同域**：在 FastAPI 或 Express 中增加一个 GET 端点 `/text_cli_schema.json`，返回上面的 JSON。
- **单独托管**：放在 `https://your-cdn.com/text_cli_schema.json` 也可，只要可公开访问。

```python
# FastAPI 示例：静态文件
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="static", html=True), name="static")
# 项目根目录创建 static/text_cli_schema.json
```

Agent 会通过 `fetch_available_directives` 工具（参考集成文档）下载该文件，自动提取指令。

---

## 5. 部署上线

### 5.1 平台建议

- **Node.js**：Railway、Render、Heroku、阿里云 ECS  
- **Python**：Deta Space、Fly.io、阿里云函数计算 + API 网关（需适配 WSGI/ASGI）

无论哪种平台，核心步骤一致：
1. 确保服务监听在 `0.0.0.0`，平台自动分配域名。
2. 开启 HTTPS（云平台通常自动提供）。
3. 将你的服务地址告知调用方（如 `https://my-skill.example.com`）。
4. 私下交换 `Service Token`。

### 5.2 与集成端点对接

如果你希望复用 `dev1.agentbot.space` 等公共端点，则无需自建代理，调用方直接通过公共端点转发。否则，你也可自己部署集成端点（开源组件即将发布），自行控制全局鉴权与路由。

---

## 6. 高级技巧

### 6.1 异步任务（长时处理）

如果你的指令需要生成视频、复杂计算等，可以立即返回一个 `taskId`，然后提供一条“任务查询”指令。

**响应示例**：

```json
{
  "rst_types": "text",
  "rst_data": {
    "text": "任务已提交，taskId: abc-123，请稍后查询"
  }
}
```

在 `text_cli_schema.json` 中添加一条任务查询指令：

```json
{
  "task_query": {
    "id": "task_query",
    "name": "任务查询",
    "category": "我的传感器",
    "description": "查询异步任务的结果",
    "directive": "指令:我的传感器;任务查询",
    "parameters": [
      {"name": "taskId", "type": "string"}
    ],
    "prompt_template": "指令:我的传感器;任务查询,{taskId}",
    "trigger_keywords": ["任务", "查询结果"],
    "response_type": "text"
  }
}
```

这与 `text-cli` 官方预置的 `任务查询` 指令模式一致。

### 6.2 多领域指令共存

一个服务可以响应多个 `领域;动作`，只需在分发逻辑中增加分支即可。例如：

```
指令:基础服务;天气查询,明天,北京
指令:我的传感器;温湿度,101
指令:我的传感器;列表
```

只需解析 `domain` 和 `action`，路由到不同函数。

### 6.3 错误处理与日志

- 所有异常都必须捕获并返回 `rst_types: "text"` 格式，避免调用方解析崩溃。
- 记录每条指令的调用日志（domain/action/参数/耗时/调用方），便于计费和优化。

### 6.4 性能优化

- **冷启动优化**：对于 Serverless 部署，设置最小保活实例或使用 `text-cli` 官方的 Cron 预热机制。
- **缓存**：在服务前加一层缓存（如 Redis），对相同参数的指令直接返回缓存结果。
- **异步队列**：对于高并发或长任务，引入消息队列（如 Bull、Celery）避免阻塞。

---

## 7. 安全提醒

- **保护你的知识产权**：指令服务对外完全“黑箱”，调用方只能看到输入参数和输出文本，无法获取任何代码、提示词或数据源细节。
- **鉴权严防**：务必校验 `Service-token`，避免未经授权的调用。
- **输入验证**：对所有参数做白名单 / 类型校验，防止注入攻击（虽然协议设计天然隔离，但仍需谨慎）。

---
