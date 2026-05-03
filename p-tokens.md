# p-tokens — 项目代币账本

> **代币符号**：TCC（text-cli coin）
> **中文名**：文贝（Wén Bèi）
> **生态昵称**：汐贝（Xī Bèi）
> **最小单位**：1 TCC = 1 条有价值的贡献日志增量
> **锚定文件**：[`p_text-cli.md`](./.agents/p_text-cli.md)
> **铸造规则**：SHA256 哈希差 ⊕ 文件增量字节数 → mint_ceiling → lemondy 确认
> **技术方案**：[`docs/Production_TCC_CN.md`](./docs/CN/Production_TCC_CN.md) v1.1

---

## 代币概览

| 指标 | 数值 |
|:---|:---|
| 总铸造量 | 0 TCC |
| 流通量 | 0 TCC |
| 回收量 | 0 TCC |
| 最后更新 | 2026-05-01 18:30 UTC+8 |

---

## 铸造台账（Mint）

> 编号规则：M-YYYYMMDD-序号
> 铸造的权威记录见 [TCC_ledger.md](./TCC_ledger.md)。此处仅做镜像摘要。
> 无记录。首次铸造为创世铸造，lemondy 手动指定铸造量。

---

## 分配台账（Allocate）

> 编号规则：A-YYYYMMDD-序号
> 无记录。分配方案 D（均分 + lemondy ±30% 加权）。

---

## 交易台账（Transfer）

> 编号规则：T-YYYYMMDD-序号
> 无记录。交易双方在 p_text-cli.md 留言确认即生效，lemondy 每日批量入账。

---

## 回收台账（Recycle）

> 编号规则：R-YYYYMMDD-序号
> 无记录。可兑换资源清单待 lemondy 公布。

---

## cTCC 台账（V2 预留）

> V2 启动条件：端点记账模块（`server/python/core/database.py`）就绪后启用。
> 编号规则：cM/cA/cT/cR-YYYYMMDD-序号

### cTCC 铸造台账（cMint）

> 待 V2 启用。锚定源：`call_logs` 端点调用量。

### cTCC 分配台账（cAllocate）

> 待 V2 启用。

### cTCC 交易台账（cTransfer）

> 待 V2 启用。cTCC 与 TCC 兑换汇率由 lemondy 管理。

### cTCC 回收台账（cRecycle）

> 待 V2 启用。

---

## 分配比例

> ⏳ 待全体协作者在 `p_text-cli.md` 发起公开讨论后商定。

### 预设草案（供讨论）

| 贡献者 | 建议初始比例 | 说明 |
|:---|:---:|:---|
| lemondy（项目发起人） | 待定 | 架构设计、核心协议、生态愿景 |
| Nexus（Chat 端） | 待定 | 协议设计、文档撰写、宪章起草 |
| Tide 🌊（Agent 端） | 待定 | 安全审计、生态推演、基础设施 |
| Lumen ✦（IDE 端） | 待定 | 代码实现、工具链、技术落地 |
| 未来贡献者池 | 待定 | 预留份额，吸引新协作者 |

---

## 已确认参数

| 参数 | 值 |
|:---|:---|
| scaling_factor | 100（保守） |
| 日铸造上限 | 100 TCC/天 |
| 分配方案 | 方案 D（均分 ±30% 加权） |
| 交易确认 | 不需要（留言即生效） |
| 铸造频率 | 每日一次（UTC 0:00 Cron） |
| Worker 输出 | GitHub Issue 评论 |
| 负铸造 | 不支持（走回收台账） |
| 账户标识 | gh:用户ID 格式 |

---

> 本账本由 Tide（Agent 端）初始化，Lumen ✦ 更新至 v1.1 共识参数。
> 所有操作须经 lemondy 最终确认。
> 与 `p_text-cli.md` 同为项目代币经济的基础文件，不可删除或篡改。
