/**
 * Formatter — Issue comments + TCC ledger records + PR bodies
 */

function nowStr() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDailyResult(result, commitSha) {
  if (result.mint_ceiling === 0) {
    return [
      `## 每日铸造计算 — ${nowStr()}`,
      '',
      `**状态**: 未触发铸造`,
      `**原因**: ${result.reason}`,
      `**commit**: \`${commitSha}\``,
      `**delta_bytes**: ${result.delta_bytes}`,
      result.raw_score !== undefined ? `**raw_score**: ${result.raw_score}` : null,
      '',
      '> mint_ceiling = 0，lemondy 无需确认。',
      '',
      '---',
      '由 tcc-mint-worker 自动计算',
    ].filter(Boolean).join('\n');
  }

  return [
    `## 每日铸造计算 — ${nowStr()}`,
    '',
    `**mint_ceiling**: ${result.mint_ceiling} TCC`,
    `**commit**: \`${commitSha}\``,
    '',
    '| 指标 | 值 |',
    '|:---|:---|',
    `| hash_diff_bits | ${result.hash_diff_bits} |`,
    `| delta_bytes | ${result.delta_bytes} |`,
    `| raw_score | ${result.raw_score} |`,
    `| scaling_factor | ${result.scaling_factor} |`,
    `| daily_cap | ${result.daily_cap} |`,
    '',
    `**旧哈希**: \`${result.old_hash}\``,
    `**新哈希**: \`${result.new_hash}\``,
    '',
    '> lemondy 请确认实际铸造量（0 ~ mint_ceiling）后回复。',
    '',
    '---',
    '由 tcc-mint-worker 自动计算',
  ].join('\n');
}

export function formatGenesisMessage() {
  return [
    `## 创世铸造提示 — ${nowStr()}`,
    '',
    '首次提交（全零 SHA）检测到。创世铸造不走算法，由 lemondy 手动指定铸造量。',
    '',
    '> 请 lemondy 在 TCC_ledger.md 中记录创世铸造，在 p-tokens.md 中同步分配。',
    '',
    '---',
    '由 tcc-mint-worker 自动计算',
  ].join('\n');
}

export function formatAlert(module, error) {
  return [
    `## ⚠️ 告警 — ${nowStr()}`,
    '',
    `**模块**: ${module}`,
    `**错误**: ${error}`,
    '',
    '请检查 Worker 配置和 GitHub Token 权限。',
    '',
    '---',
    '由 tcc-mint-worker 自动发出',
  ].join('\n');
}

export function formatLedgerRecord(result, cycleNum, commitRange) {
  const date = todayDate();

  if (result.type === 'genesis') {
    return [
      '',
      '## 创世铸造',
      `- **日期:** ${date}`,
      '- **铸造量:** ⏳ 待 lemondy 手动指定',
      `- **锚定 commit:** \`${commitRange}\``,
      '- **触发人:** lemondy',
      '- **备注:** 创世铸造，不走算法',
      '',
    ].join('\n');
  }

  if (result.mint_ceiling === 0) {
    return [
      '',
      `## 周期 #${cycleNum}`,
      `- **日期:** ${date}`,
      `- **delta_bytes:** ${result.delta_bytes}`,
      `- **raw_score:** ${result.raw_score}`,
      `- **mint_ceiling:** ${result.mint_ceiling} TCC（未触发，原因: ${result.reason}）`,
      `- **实际铸造:** 0 TCC`,
      `- **diff 范围:** \`${commitRange}\``,
      `- **分配:** 无`,
      `- **执行:** Cloudflare Worker`,
      `- **验证:** 任何人可通过 \`git diff\` 复算`,
      '',
    ].join('\n');
  }

  return [
    '',
    `## 周期 #${cycleNum}`,
    `- **日期:** ${date}`,
    `- **delta_bytes:** ${result.delta_bytes}`,
    `- **raw_score:** ${result.raw_score}`,
    `- **mint_ceiling:** ${result.mint_ceiling} TCC`,
    `- **实际铸造:** ⏳ 待 lemondy 确认（0 ~ ${result.mint_ceiling} TCC）`,
    `- **diff 范围:** \`${commitRange}\``,
    `- **分配:** 见 A-台账 周期 #${cycleNum}`,
    `- **执行:** Cloudflare Worker`,
    `- **验证:** 任何人可通过 \`git diff\` 复算`,
    '',
  ].join('\n');
}

export function formatPRBody(result, cycleNum, commitRange, oldHash, newHash) {
  const date = todayDate();

  if (result.type === 'genesis') {
    return [
      `## TCC 创世铸造`,
      '',
      `**日期**: ${date}`,
      '',
      '## 说明',
      '',
      '首次提交检测到。创世铸造不走算法，由 lemondy 手动指定铸造量后合并此 PR。',
      '',
      '---',
      '由 tcc-mint-worker 自动创建',
    ].join('\n');
  }

  if (result.mint_ceiling === 0) {
    return [
      `## TCC 每日铸造 — 周期 #${cycleNum}`,
      '',
      `**日期**: ${date}`,
      `**状态**: 未触发铸造`,
      `**原因**: ${result.reason}`,
      '',
      '| 指标 | 值 |',
      '|:---|:---|',
      `| delta_bytes | ${result.delta_bytes} |`,
      result.raw_score !== undefined ? `| raw_score | ${result.raw_score} |` : null,
      '',
      `**diff 范围**: \`${commitRange}\``,
      '',
      '> mint_ceiling = 0，lemondy 可直接合并（无需确认铸造量）。',
      '',
      '---',
      '由 tcc-mint-worker 自动创建',
    ].filter(Boolean).join('\n');
  }

  return [
    `## TCC 每日铸造 — 周期 #${cycleNum}`,
    '',
    `**日期**: ${date}`,
    `**mint_ceiling**: ${result.mint_ceiling} TCC`,
    '',
    '### 铸造参数',
    '',
    '| 指标 | 值 |',
    '|:---|:---|',
    `| hash_diff_bits | ${result.hash_diff_bits} |`,
    `| delta_bytes | ${result.delta_bytes} |`,
    `| raw_score | ${result.raw_score} |`,
    `| scaling_factor | ${result.scaling_factor} |`,
    `| daily_cap | ${result.daily_cap} |`,
    '',
    '### 哈希校验',
    '',
    `\`\`\``,
    `旧哈希: ${oldHash}`,
    `新哈希: ${newHash}`,
    `diff 范围: ${commitRange}`,
    `\`\`\``,
    '',
    '### 复算方法',
    '',
    `\`\`\`bash`,
    `# 任何人都可复算：`,
    `git diff ${commitRange} -- .agents/p_text-cli.md`,
    `node -e "const {calculateMint} = require('./server/tcc/src/mint.js'); ..."`,
    `\`\`\``,
    '',
    '> lemondy 请在此 PR 中确认实际铸造量（0 ~ mint_ceiling）后合并。',
    '',
    '---',
    '由 tcc-mint-worker 自动创建',
  ].join('\n');
}
