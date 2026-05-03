# call — Agent 调用 text-cli 指令

Agent 集成 text-cli 指令的客户端实现。不依赖特定框架，提供从最简 curl 到完整 SDK 的多层方案。

## 指令格式（不可变协议）

```
指令:领域;动作,参数1,参数2,...
```

## 多层调用方案

| 层级 | 文件 | 适用场景 |
|------|------|---------|
| L0 最简 | `call.sh` | curl 直接调用，单行测试，CI/CD |
| L1 脚本 | `call.py` | Python 项目集成，函数式调用 |
| L2 SDK | `client.py` | 需要重试/超时/多端点管理的场景 |

## 端点

| 端点 | 地址 | 鉴权 |
|------|------|------|
| 公共测试端点 | `https://test.text-cli.com/cli/text_cli` | Access Token |
| 自建端点 | `<自建地址>/cli/text_cli` | Service Token |

## 典型调用流程

```
Agent 收到用户意图
    ↓
将意图映射为 指令:领域;动作
    ↓
调用 HTTP POST /cli/text_cli
    ↓
解析响应 rst_data.text
    ↓
将结果返回用户 / 进入下一步推理
```

## 安全

- Access Token / Service Token 通过环境变量注入，绝不硬编码
- 单次调用超时默认 10 秒
- 返回文本直接使用，不做自动执行
