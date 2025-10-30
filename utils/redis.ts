// utils/redis.ts
// Optional helper using Upstash REST API. If you don't set UPSTASH_REDIS_REST_URL/TOKEN, functions return no-op.

import fetch from 'node-fetch';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function markProcessed(txHash: string): Promise<boolean> {
  if (!url || !token) return false;
  const body = JSON.stringify({ command: ['SET', `processed:${txHash}`, '1', 'EX', '86400', 'NX'] }); // expire 1 day
  const res = await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const j = await res.json();
  // Upstash returns integer reply if set else null
  return j.result === 'OK' || j.result === 1 || j.result === '1';
}

export async function isProcessed(txHash: string): Promise<boolean> {
  if (!url || !token) return false;
  const body = JSON.stringify({ command: ['EXISTS', `processed:${txHash}`] });
  const res = await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const j = await res.json();
  return j.result === 1;
}
