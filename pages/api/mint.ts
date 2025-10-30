// pages/api/mint.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { isProcessed, markProcessed } from '../../utils/redis'; // functions are no-op if no Upstash configured

const TOKEN_CONTRACT = process.env.NEXT_PUBLIC_TOKEN_CONTRACT!;
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
const PRICE_USDC = process.env.NEXT_PUBLIC_PRICE_USDC || '5';
const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || '6');
const MINT_AMOUNT = process.env.NEXT_PUBLIC_MINT_AMOUNT || '5000';
const BASE_RPC = process.env.BASE_RPC || process.env.NEXT_PUBLIC_BASE_RPC || 'https://1rpc.io/base';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || '';
const REQUIRED_CONFIRMATIONS = Number(process.env.REQUIRED_CONFIRMATIONS || '2');

const ERC20_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

// fallback in-memory store if redis not configured
const ephemeralProcessed = new Set<string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { txHash, beneficiary } = req.body;
  if (!txHash || !beneficiary) return res.status(400).json({ error: 'txHash and beneficiary required' });
  if (!/^0x([A-Fa-f0-9]{64})$/.test(txHash)) return res.status(400).json({ error: 'Invalid txHash format' });

  // check redis (optional)
  try {
    const already = (await isProcessed(txHash)) || ephemeralProcessed.has(txHash);
    if (already) return res.status(400).json({ success: false, reason: 'txHash already processed' });
  } catch (e) {
    // ignore redis errors, fall back to ephemeral
  }

  if (!RELAYER_PRIVATE_KEY) return res.status(500).json({ success: false, reason: 'Relayer private key not configured' });

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(404).json({ error: 'Transaction receipt not found yet' });

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - (receipt.blockNumber ?? 0) + 1;
    if (confirmations < REQUIRED_CONFIRMATIONS) {
      return res.status(400).json({ success: false, reason: `Transaction has ${confirmations} confirmations; require ${REQUIRED_CONFIRMATIONS}` });
    }

    // check USDC transfer logs to the token contract
    const expectedValue = ethers.parseUnits(String(PRICE_USDC), USDC_DECIMALS);
    const logs = receipt.logs.filter(l => l.address.toLowerCase() === USDC_CONTRACT.toLowerCase());

    let found = null;
    for (const l of logs) {
      try {
        const parsed = ERC20_IFACE.parseLog(l);
        const from = parsed.args[0];
        const to = parsed.args[1];
        const value = parsed.args[2];
        if (to && to.toLowerCase() === TOKEN_CONTRACT.toLowerCase() && value.eq(expectedValue)) {
          found = { from, to, value };
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!found) return res.status(400).json({ success: false, reason: 'No matching USDC transfer of expected amount to token contract found in tx logs' });

    // mark processed (try redis first)
    try {
      const ok = await markProcessed(txHash);
      if (!ok) ephemeralProcessed.add(txHash);
    } catch {
      ephemeralProcessed.add(txHash);
    }

    // create relayer wallet & mint
    const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const token = new ethers.Contract(TOKEN_CONTRACT, ['function mint(address to, uint256 amount) external'], relayer);

    const tokenDecimals = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || '18');
    const mintBn = ethers.parseUnits(String(MINT_AMOUNT), tokenDecimals);

    const gasEstimate = await token.estimateGas.mint(beneficiary, mintBn).catch(() => null);
    const txOverrides = gasEstimate ? { gasLimit: gasEstimate.mul(120).div(100) } : {};

    const mintTx = await token.mint(beneficiary, mintBn, txOverrides);
    const mintReceipt = await mintTx.wait();

    if (!mintReceipt || mintReceipt.status !== 1) {
      return res.status(500).json({ success: false, reason: 'Mint transaction failed' });
    }

    return res.status(200).json({
      success: true,
      mintTxHash: mintReceipt.transactionHash,
      paymentFrom: found.from,
      paymentValue: found.value.toString(),
      blockNumber: receipt.blockNumber
    });
  } catch (err: any) {
    // unmark ephemeral if error
    try { ephemeralProcessed.delete(txHash); } catch {}
    console.error('/api/mint error', err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}
