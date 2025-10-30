// components/MintButton.tsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { getProvider } from '../lib/ethers';

const TOKEN_CONTRACT = process.env.NEXT_PUBLIC_TOKEN_CONTRACT!;
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS || '6');
const PRICE_USDC = process.env.NEXT_PUBLIC_PRICE_USDC || '5';
const MINT_AMOUNT = process.env.NEXT_PUBLIC_MINT_AMOUNT || '5000';
const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || '18');

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];
const TOKEN_ABI = ['function mint(address to, uint256 amount) external'];

export default function MintButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setTxHash(null);
    setStatus('Connect wallet (MetaMask / injected)...');
    try {
      const provider = getProvider();
      if (!(provider as any).getSigner) {
        throw new Error('Open this page in a browser with MetaMask or injected wallet.');
      }
      await (provider as any).send('eth_requestAccounts', []);
      const signer = (provider as any).getSigner();
      const user = await signer.getAddress();

      setStatus('Initiating USDC approval (if needed)...');
      const usdc = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, signer);
      const token = new ethers.Contract(TOKEN_CONTRACT, TOKEN_ABI, signer);

      const price = ethers.parseUnits(String(PRICE_USDC), USDC_DECIMALS);

      const allowance = await usdc.allowance(user, TOKEN_CONTRACT);
      if (allowance < price) {
        setStatus('Approve USDC (wallet will ask)...');
        const approveTx = await usdc.approve(TOKEN_CONTRACT, price);
        setStatus('Waiting approval confirmation...');
        await approveTx.wait();
      }

      setStatus('Calling mint(user, amount) on contract (wallet will ask to sign)...');
      const mintAmountBn = ethers.parseUnits(String(MINT_AMOUNT), TOKEN_DECIMALS);
      const tx = await token.mint(user, mintAmountBn);
      setStatus('Waiting for mint confirmation...');
      const receipt = await tx.wait();
      setStatus('Mint successful');
      setTxHash(receipt.transactionHash);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
      setStatus(null);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={handleClick} className="px-4 py-2 bg-emerald-500 rounded text-black font-semibold">
        Pay {PRICE_USDC} USDC & Mint
      </button>
      {status && <div className="text-sm text-slate-300">{status}</div>}
      {txHash && <div className="text-xs break-all">Tx: {txHash}</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
