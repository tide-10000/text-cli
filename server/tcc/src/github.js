/**
 * GitHub API Client for TCC Worker
 * ref: docs/Production_TCC_CN.md §3
 */

const GITHUB_API = 'https://api.github.com';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function githubFetch(path, env, options = {}) {
  const url = `${GITHUB_API}${path}`;
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'tcc-mint-worker',
    'X-GitHub-Api-Version': '2022-11-28',
    ...options.headers,
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, { ...options, headers });

      if (resp.ok) {
        return await resp.json();
      }

      if (resp.status === 403 || resp.status === 429) {
        const retryAfter = resp.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS * attempt;
        await sleep(delay);
        continue;
      }

      const body = await resp.text();
      throw new Error(`GitHub API ${resp.status}: ${body}`);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}

export async function getFileContent(owner, repo, path, ref, env) {
  const data = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    env,
    { headers: { 'Accept': 'application/vnd.github.raw+json' } },
  );
  return typeof data === 'string' ? data : '';
}

export async function getRecentCommits(owner, repo, path, since, env) {
  const sinceISO = since.toISOString();
  const commits = await githubFetch(
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&since=${sinceISO}&per_page=100`,
    env,
  );
  return Array.isArray(commits) ? commits : [];
}

export async function getLatestCommit(owner, repo, path, env) {
  const commits = await githubFetch(
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`,
    env,
  );
  return Array.isArray(commits) && commits.length > 0 ? commits[0] : null;
}

export async function postIssueComment(owner, repo, issueNumber, body, env) {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    env,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
  );
}

export async function findOrCreateIssue(owner, repo, title, env) {
  const issues = await githubFetch(
    `/repos/${owner}/${repo}/issues?state=open&per_page=100`,
    env,
  );

  const existing = Array.isArray(issues)
    ? issues.find(i => i.title === title)
    : null;

  if (existing) {
    return existing.number;
  }

  const created = await githubFetch(
    `/repos/${owner}/${repo}/issues`,
    env,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body: '此 Issue 由 tcc-mint-worker 自动创建，用于记录每日铸造日志。',
      }),
    },
  );
  return created.number;
}
