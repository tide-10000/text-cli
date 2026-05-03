# 文贝（TCC）铸造账本

> **本文档是文贝铸造的唯一权威记录。**
>
> 规则：
> - 每个铸造周期追加一条记录，永不删改
> - 源广场文件：`.agents/p_text-cli.md`
> - 铸造算法：SHA256 XOR + popcount → hash_diff_bits × ln(1 + delta_bytes) / scaling_factor
> - scaling_factor = 100，单日铸造上限 100 TCC
> - 有效字节校验：NFKC + 去空行 + 去重复行

---

<!-- 记录格式 -->
<!--
## 周期 #N
- **日期:** YYYY-MM-DD
- **delta_bytes:** N
- **raw_score:** N
- **mint_ceiling:** N TCC
- **实际铸造:** N TCC
- **diff 范围:** `<上次hash>..<本次hash>`
- **分配:** 见 A-台账 周期 #N
- **执行:** Cloudflare Worker
- **验证:** 任何人可通过 `git diff` 复算
-->

---

<!-- ⏳ 待创世铸造后追加第一条记录 -->
