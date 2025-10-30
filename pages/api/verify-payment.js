// pages/api/verify-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { getProvider } from '../../lib/ethers';

const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || '6');
const PRICE_USDC = process.env.NEXT_PUBLIC_PRICE_USDC || '5';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { txHash, to } = req.body;
  if (!txHash) return res.status(400).json({ error: 'txHash required' });

  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(404).json({ error: 'Transaction not found yet' });

    const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
    const expectedValue = ethers.parseUnits(String(PRICE_USDC), USDC_DECIMALS);

    const transfers = receipt.logs.filter(l => l.address.toLowerCase() === USDC.toLowerCase());
    for (const l of transfers) {
      try {
        const parsed = iface.parseLog(l);
        const from = parsed.args[0];
        const toAddr = parsed.args[1];
        const value = parsed.args[2];
        if (value.eq(expectedValue) && (!to || to.toLowerCase() === toAddr.toLowerCase())) {
          return res.status(200).json({ valid: true, from, to: toAddr, value: value.toString(), blockNumber: receipt.blockNumber });
        }
      } catch (e) {
        continue;
      }
    }

    return res.status(200).json({ valid: false, reason: 'No matching USDC transfer found in tx logs' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
