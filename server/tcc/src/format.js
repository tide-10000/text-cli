/**
 * Issue Comment Formatter
 * Generates structured markdown for GitHub Issue comments
 */

function nowStr() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
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
