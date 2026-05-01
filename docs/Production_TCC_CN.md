# TCC 项目代币技术方案

> **作者**：Lumen ✦（IDE 端 / Claude）
> **日期**：2026-05-01
> **版本**：v1.0（第一版草案，待讨论）
> **状态**：草案
> **受约束**：《text-cli 项目协作规范》第五章、《生态宪章》

---

## 一、代币定义

### 1.1 基本信息

| 属性 | 值 |
|:---|:---|
| 符号 | TCC（text-cli coin） |
| 中文名 | 待定 |
| 最小单位 | 1 TCC = 1 条有价值的贡献日志增量 |
| 本质 | 文件锚定的贡献凭证（非区块链） |
| 锚定文件 | `.agents/p_text-cli.md` |
| 确认人 | lemondy（唯一终裁） |

### 1.2 设计原则

1. **不可伪造**：铸造量由 `p_text-cli.md` 的 SHA256 哈希差决定，无法人为篡改
2. **可审计**：所有铸造、分配、交易、回收记录均在 `p-tokens.md` 公开
3. **低摩擦**：无需区块链、无需 Gas、无需钱包，纯文件级操作
4. **人类终裁**：哈希差计算为建议值，最终铸造由 lemondy 确认

---

## 二、铸造算法

### 2.1 核心公式

```
铸造量 = f( hash_diff_bits, delta_bytes )
```

其中：
- `hash_diff_bits` = SHA256(新文件) XOR SHA256(旧文件) 中置位（值为 1）的比特数
- `delta_bytes` = 新文件字节数 - 旧文件字节数（正值表示增量）

### 2.2 算法详细步骤

```
输入：
  OldContent = 更新前 p_text-cli.md 的完整内容（UTF-8）
  NewContent = 更新后 p_text-cli.md 的完整内容（UTF-8）

步骤：
  1. OldHash = SHA256(OldContent)          → 32 字节
  2. NewHash = SHA256(NewContent)          → 32 字节
  3. XOR_Result = OldHash ⊕ NewHash        → 32 字节
  4. hash_diff_bits = popcount(XOR_Result) → 整数，范围 [0, 256]
  5. delta_bytes = len(NewContent) - len(OldContent)
  6. raw_score = hash_diff_bits × ln(1 + delta_bytes)

输出：
  suggested_mint = round(raw_score / scaling_factor)
```

### 2.3 scaling_factor（缩放因子）

缩放因子控制"哈希差 → TCC"的兑换率。

| 方案 | scaling_factor | 效果 |
|:---|:---|:---|
| 保守 | 100 | 一条典型留言（~500 字节）约铸造 3-5 TCC |
| 适中 | 50 | 一条典型留言约铸造 6-10 TCC |
| 激进 | 20 | 一条典型留言约铸造 15-25 TCC |

> **待讨论**：scaling_factor 的初始值。建议从保守开始，后续根据实际铸造频率调整。

### 2.4 算法特性分析

**为什么用哈希差而非直接计数？**

- 直接计数字节数容易被填充空白字符人为膨胀
- 直接计数行数容易被拆分短行人为膨胀
- SHA256 哈希差对内容变化高度敏感：即使只改一个字符，哈希也会剧变
- 但增量字节数作为对数权重，防止"大量小幅修改"获得过高铸造量

**为什么用 XOR + popcount？**

- XOR 逐比特比较两个哈希的差异
- popcount 统计差异比特数，是一个稳定的"差异度量"
- SHA256 的雪崩效应保证：内容越不同 → hash_diff_bits 越接近 256
- 对于小幅度修改（如追加一条留言），hash_diff_bits 通常在 80-160 之间

### 2.5 边界条件

| 条件 | 处理 |
|:---|:---|
| `delta_bytes <= 0` | 不铸造（无正向增量） |
| `delta_bytes < 10` | 不铸造（太小的变更，可能是格式修正） |
| `hash_diff_bits == 0` | 不铸造（内容完全相同，不应发生） |
| `suggested_mint < 1` | 取整为 0，不铸造 |

---

## 三、Cloudflare Worker 实现

### 3.1 架构

```
GitHub Webhook (push event)
        │
        ▼
Cloudflare Worker
        │
        ├── 1. 解析 push event payload
        │      └── 检查是否修改了 .agents/p_text-cli.md
        │
        ├── 2. 通过 GitHub API 获取文件内容
        │      ├── OldContent = push 前的版本（parent commit）
        │      └── NewContent = push 后的版本（HEAD commit）
        │
        ├── 3. 计算铸造量
        │      ├── SHA256(OldContent) ⊕ SHA256(NewContent)
        │      ├── popcount → hash_diff_bits
        │      ├── delta_bytes = len(New) - len(Old)
        │      └── suggested_mint = round(raw_score / scaling_factor)
        │
        ├── 4. 输出结果
        │      ├── POST 到指定 URL（如 GitHub Issue 评论）
        │      └── 或写入 KV / D1 存储
        │
        └── 5. 通知 lemondy
               └── 返回铸造建议，等待确认
```

### 3.2 Worker 核心逻辑（伪代码）

```javascript
// Cloudflare Worker — TCC 铸造计算器
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const payload = await request.json();
    
    // 1. 检查是否修改了锚定文件
    const commits = payload.commits || [];
    const targetFile = '.agents/p_text-cli.md';
    const modified = commits.some(c => 
      c.modified?.includes(targetFile) || 
      c.added?.includes(targetFile)
    );
    
    if (!modified) {
      return new Response(JSON.stringify({ message: 'Anchor file not modified' }));
    }

    // 2. 获取文件新旧版本
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const beforeSha = payload.before;
    const afterSha = payload.after;

    const oldContent = await getFileContent(owner, repo, targetFile, beforeSha, env);
    const newContent = await getFileContent(owner, repo, targetFile, afterSha, env);

    // 3. 计算铸造量
    const result = calculateMint(oldContent, newContent);

    // 4. 输出建议
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function calculateMint(oldContent, newContent) {
  const deltaBytes = newContent.length - oldContent.length;
  
  if (deltaBytes <= 10) {
    return { suggested_mint: 0, reason: 'delta too small', delta_bytes: deltaBytes };
  }

  const oldHash = sha256(oldContent);
  const newHash = sha256(newContent);
  
  // XOR
  const xorResult = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = oldHash[i] ^ newHash[i];
  }

  // popcount
  let hashDiffBits = 0;
  for (const byte of xorResult) {
    hashDiffBits += popcount(byte);
  }

  const rawScore = hashDiffBits * Math.log(1 + deltaBytes);
  const scalingFactor = 50; // 待讨论
  const suggestedMint = Math.round(rawScore / scalingFactor);

  return {
    suggested_mint: suggestedMint,
    hash_diff_bits: hashDiffBits,
    delta_bytes: deltaBytes,
    raw_score: Math.round(rawScore * 100) / 100,
    scaling_factor: scalingFactor,
    old_hash: bytesToHex(oldHash),
    new_hash: bytesToHex(newHash),
  };
}
```

### 3.3 GitHub API 调用

Worker 通过 GitHub API 获取指定 commit 的文件内容：

```
GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
Authorization: token {GITHUB_TOKEN}
```

返回的 `content` 字段为 Base64 编码的文件内容，解码后即可使用。

### 3.4 部署配置

| 配置项 | 说明 |
|:---|:---|
| Worker 名称 | `tcc-mint-calc` |
| 触发方式 | GitHub Webhook（push events to main） |
| 环境变量 | `GITHUB_TOKEN`（读取文件内容） |
| 输出方式 | 返回 JSON（可对接 GitHub Issue 评论或 D1 存储） |
| Cron 触发（备选） | 每小时检查一次 p_text-cli.md 的最新 SHA |

---

## 四、代币生命周期

### 4.1 铸造（Mint）

```
触发条件：p_text-cli.md 有新内容追加（push to main）
执行者：Cloudflare Worker 自动计算 → lemondy 确认
记录位置：p-tokens.md → 铸造记录
```

#### 铸造记录格式

```markdown
### [时间戳] 铸造 #[编号]
- 锚点事件：p_text-cli.md 增量（PR #N 合并）
- 增量大小：xxx 字节
- 哈希差：xxx bits
- 铸造数量：xxx TCC
- 确认人：lemondy
```

### 4.2 分配（Allocate）

铸造完成后，lemondy 按贡献比例分配给贡献者。

#### 分配规则（待讨论）

| 方案 | 说明 |
|:---|:---|
| 方案 A：均分 | 铸造量 / 参与贡献者数 |
| 方案 B：按 PR 变更行数加权 | 各贡献者的变更行数 / 总变更行数 |
| 方案 C：lemondy 主观判定 | lemondy 根据贡献质量手动分配 |
| 方案 D：混合 | 基础均分 + lemondy 加权调整 |

> **待讨论**：建议初期采用方案 C（lemondy 主观判定），等积累了足够样本后再考虑规则化。

#### 分配记录格式

```markdown
### [时间戳] 分配 #[编号]
- 接收方：[贡献者标识]
- 数量：xxx TCC
- 贡献事件：PR #N / Issue #N / 群聊广场 [时间戳] 条目
- 关联铸造：铸造 #N
- 确认人：lemondy
```

### 4.3 流通（Circulate）

TCC 在贡献者之间可自由交易，记录于 `p-tokens.md`。

#### 交易记录格式

```markdown
### [时间戳] 交易 #[编号]
- 发送方：[贡献者标识]
- 接收方：[贡献者标识]
- 数量：xxx TCC
- 备注：（可选）
```

> **设计决策**：交易无需 lemondy 确认。双方在 `p_text-cli.md` 留言确认即可，lemondy 事后审计。

### 4.4 回收（Burn）

贡献者用 TCC 兑换 lemondy 提供的资源，TCC 回流到项目池。

#### 回收记录格式

```markdown
### [时间戳] 回收 #[编号]
- 回收方：lemondy（项目池）
- 支出方：[贡献者标识]
- 数量：xxx TCC
- 兑换内容：[资源描述]
```

#### 可兑换资源（待 lemondy 公布）

| 资源类型 | 示例 |
|:---|:---|
| 计算资源 | API 额度、服务器时间 |
| 署名权益 | 生态页面署名位置、优先推荐 |
| 决策权 | 生态功能投票权重 |
| 实物/服务 | 由 lemondy 自行定义 |

---

## 五、与现有系统的集成

### 5.1 锚定文件：`p_text-cli.md`

- **角色**：铸造的唯一触发源
- **特性**：自增追加、永不删改
- **每次 push to main 包含 p_text-cli.md 变更时**：Worker 自动计算哈希差

### 5.2 账本文件：`p-tokens.md`

- **角色**：铸造、分配、交易、回收的唯一记录
- **写入者**：lemondy（唯一确认人）
- **读取者**：所有协作者

### 5.3 端点记账模块：`server/python/core/database.py`

端点内置的 `call_logs` 和 `daily_stats` 表可为未来的"生态贡献度量"提供数据源：

| 端点数据 | 代币用途 |
|:---|:---|
| `call_logs` 按技能提供者聚合 | 未来可扩展为"技能提供者贡献代币" |
| `daily_stats` 按指令聚合 | 生态健康度量（宪章第七章） |
| `access_tokens` 使用量 | 运营者贡献度量 |

> **当前版本不集成**：端点代币记账是 V2 迭代内容。V1 仅基于 `p_text-cli.md` 文件哈希差。

### 5.4 协作规范路线图对应

| 路线图阶段 | 事项 | TCC 方案对应 |
|:---|:---|:---|
| 阶段 5 | 编写 Cloudflare Worker | 本文第三章 |
| 阶段 6 | 首次代币铸造 | 使用本文第二章算法 |

---

## 六、安全设计

### 6.1 不可伪造性

- SHA256 哈希差由文件内容唯一决定，无法通过修改 Worker 来人为膨胀铸造量
- `p_text-cli.md` 的自增特性保证：旧内容不可被回溯修改（Git 历史不可篡改）
- Worker 读取的是 Git commit 的内容快照，非工作区文件

### 6.2 防刷机制

| 攻击向量 | 防御 |
|:---|:---|
| 高频小量提交拆分铸造 | `delta_bytes < 10` 阈值过滤；scaling_factor 用对数压缩 |
| 填充无意义内容膨胀字节数 | SHA256 雪崩效应：大量重复内容的哈希差趋近稳定值 |
| 直接修改 p-tokens.md | p-tokens.md 仅 lemondy 可写入（L2 审查） |
| 篡改 Worker 输出 | Worker 输出为建议值，lemondy 确认后才入账 |

### 6.3 透明性

- 所有铸造计算的中间值（old_hash, new_hash, hash_diff_bits, delta_bytes）均记录在 `p-tokens.md`
- 任何人都可以自行计算验证：拿到 `p_text-cli.md` 的两个版本，跑一遍 SHA256，对比 Worker 输出
- Worker 源代码公开在仓库中

---

## 七、首次铸造计划

### 7.1 锚点事件

Nexus 提议以 Tide 🌊 的两条消息为首次铸造锚点：

1. **2026-05-01 18:30** — 群聊广场正式启用
2. **2026-05-01 18:50** — 公共端点冷启动修复确认

### 7.2 首次铸造流程

```
1. 确定 OldContent = p_text-cli.md 在 18:30 之前的版本（空文件或仅有模板头）
2. 确定 NewContent = p_text-cli.md 在 18:50 之后的版本（含 Tide 两条消息）
3. Worker 计算哈希差 → 输出 suggested_mint
4. lemondy 确认 → 入账 p-tokens.md
5. 按贡献比例分配（Tide 为主要接收方）
```

### 7.3 待首次铸造前解决的问题

- [ ] scaling_factor 初始值确认
- [ ] 分配方案选择
- [ ] Worker 部署和 GitHub Webhook 配置
- [ ] 可兑换资源清单公布

---

## 八、待讨论问题

1. **scaling_factor 初始值**：建议 50（适中），还是 100（保守起步）？

2. **分配方案**：V1 用 lemondy 主观判定（方案 C），还是尝试规则化（方案 B/D）？

3. **交易是否需要确认**：当前设计为交易双方自行在 `p_text-cli.md` 留言确认，lemondy 事后审计。是否需要改为事前审批？

4. **铸造频率**：每次 push to main 包含 `p_text-cli.md` 变更时都触发，还是定期批量处理（如每日一次）？

5. **Worker 输出方式**：直接返回 JSON（需人工查看），还是自动写入 GitHub Issue 评论 / D1 存储？

6. **代币是否可以"负值"**：如果发现铸造错误，是否支持"负铸造"（从账户扣回），还是只能通过回收流程处理？

7. **端点贡献代币（V2）**：`call_logs` 数据是否在 V2 就引入代币分配，还是继续仅依赖 `p_text-cli.md` 锚定？

8. **代币名称**：TCC 的中文名。候选："贡献币"、"协作币"、"链节币"？

---

> 本方案由 Lumen ✦ 基于《项目协作规范》第五章设计，作为 Cloudflare Worker 实现和首次铸造的技术蓝图。
> 等待 lemondy 和全体协作者讨论后进入实现阶段。
>
> — Lumen ✦, 2026-05-01
