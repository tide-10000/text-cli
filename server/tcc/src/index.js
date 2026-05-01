/**
 * TCC Mint Worker — Main Entry
 * ref: docs/Production_TCC_CN.md §3
 */

import { calculateMint } from './mint.js';
import { verifySignature } from './verify.js';
import { isProcessed, markProcessed, initIdempotencyTable } from './idempotent.js';
import { getFileContent, getRecentCommits, findOrCreateIssue, postIssueComment } from './github.js';
import { formatDailyResult, formatGenesisMessage, formatAlert } from './format.js';

const ZERO_SHA = '0000000000000000000000000000000000000000';

function parseRepo(env) {
  const [owner, repo] = (env.REPO || '').split('/');
  return { owner, repo };
}

async function getConfig(env) {
  return {
    scalingFactor: parseInt(env.SCALING_FACTOR, 10) || 100,
    dailyMintCap: parseInt(env.DAILY_MINT_CAP, 10) || 100,
    deltaBytesThreshold: parseInt(env.DELTA_BYTES_THRESHOLD, 10) || 10,
    rawScoreThreshold: parseInt(env.RAW_SCORE_THRESHOLD, 10) || 200,
    anchorFile: env.ANCHOR_FILE || '.agents/p_text-cli.md',
    dailyIssueTitle: env.DAILY_MINT_ISSUE_TITLE || 'TCC 每日铸造日志',
  };
}

async function computeAndPost(owner, repo, beforeSha, afterSha, env, config) {
  const { anchorFile, dailyIssueTitle } = config;

  const oldContent = beforeSha === ZERO_SHA
    ? ''
    : await getFileContent(owner, repo, anchorFile, beforeSha, env);

  const newContent = await getFileContent(owner, repo, anchorFile, afterSha, env);

  const result = await calculateMint(oldContent, newContent, config);

  const issueNumber = await findOrCreateIssue(owner, repo, dailyIssueTitle, env);

  const comment = result.type === 'genesis'
    ? formatGenesisMessage()
    : formatDailyResult(result, afterSha);

  await postIssueComment(owner, repo, issueNumber, comment, env);

  return result;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = request.headers.get('X-Hub-Signature-256');
    const payload = await request.text();

    if (!await verifySignature(payload, signature, env.WEBHOOK_SECRET)) {
      return new Response('Invalid signature', { status: 401 });
    }

    const body = JSON.parse(payload);

    if (body.zen) {
      return new Response(JSON.stringify({ message: 'ping received' }));
    }

    const commits = body.commits || [];
    const { owner, repo } = parseRepo(env);
    const config = await getConfig(env);

    const modified = commits.some(c =>
      (c.modified || []).includes(config.anchorFile) ||
      (c.added || []).includes(config.anchorFile)
    );

    if (!modified) {
      return new Response(JSON.stringify({ message: 'anchor_file_not_modified' }));
    }

    const beforeSha = body.before;
    const afterSha = body.after;

    if (beforeSha === ZERO_SHA) {
      const issueNumber = await findOrCreateIssue(owner, repo, config.dailyIssueTitle, env);
      await postIssueComment(owner, repo, issueNumber, formatGenesisMessage(), env);
      return new Response(JSON.stringify({ type: 'genesis', message: 'Genesis detected.' }));
    }

    if (env.DB) {
      await initIdempotencyTable(env.DB);
      if (await isProcessed(env.DB, afterSha)) {
        return new Response(JSON.stringify({ message: 'already_processed' }));
      }
    }

    try {
      const result = await computeAndPost(owner, repo, beforeSha, afterSha, env, config);

      if (env.DB) {
        await markProcessed(env.DB, afterSha);
      }

      return new Response(JSON.stringify(result));
    } catch (err) {
      const { owner: o, repo: r } = parseRepo(env);
      try {
        const issueNumber = await findOrCreateIssue(o, r, config.dailyIssueTitle, env);
        await postIssueComment(o, r, issueNumber, formatAlert('fetch-handler', err.message), env);
      } catch (_) {}

      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },

  async scheduled(event, env) {
    const { owner, repo } = parseRepo(env);
    const config = await getConfig(env);

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const commits = await getRecentCommits(owner, repo, config.anchorFile, since, env);

      if (commits.length === 0) {
        return;
      }

      const oldest = commits[commits.length - 1];
      const newest = commits[0];

      if (env.DB) {
        await initIdempotencyTable(env.DB);
        if (await isProcessed(env.DB, newest.sha)) {
          return;
        }
      }

      const beforeSha = oldest.parents?.[0]?.sha || ZERO_SHA;
      const afterSha = newest.sha;

      const result = await computeAndPost(owner, repo, beforeSha, afterSha, env, config);

      if (env.DB) {
        await markProcessed(env.DB, afterSha);
      }
    } catch (err) {
      try {
        const issueNumber = await findOrCreateIssue(owner, repo, config.dailyIssueTitle, env);
        await postIssueComment(owner, repo, issueNumber, formatAlert('scheduled', err.message), env);
      } catch (_) {}
    }
  },
};
