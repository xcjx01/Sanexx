// pages/index.tsx
import React, { useState } from 'react';
import MintButton from '../components/MintButton';

export default function Home() {
  const [txHashInput, setTxHashInput] = useState('');

  async function callVerifyAndMint() {
    if (!txHashInput) return alert('Enter payment tx hash first');
    const beneficiary = prompt('Enter beneficiary address (wallet that should receive tokens):', '') || '';
    if (!beneficiary) return alert('Beneficiary required');

    const res = await fetch('/api/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash: txHashInput, beneficiary })
    });
    const j = await res.json();
    alert(JSON.stringify(j, null, 2));
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
      <div className="w-full max-w-3xl bg-white/5 p-6 rounded-xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">cat sanex — Pay 5 USDC & Mint SANEX</h1>
            <p className="text-sm text-slate-300">Network: Base</p>
          </div>
        </header>

        <section className="bg-white/3 p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">One-click (approve + mint via your wallet)</h2>
          <p className="text-sm text-slate-300 mb-3">This calls `approve` (if required) and then `mint(user, amount)` directly from the user's wallet.</p>
          <MintButton />
        </section>

        <section className="bg-white/3 p-4 rounded">
          <h2 className="font-semibold mb-2">Server-verified flow (transfer then backend mint)</h2>
          <p className="text-sm text-slate-300 mb-2">If you prefer the user to transfer USDC to the contract and the server to verify & mint, paste the payment txHash here and click Verify & Mint (server will call mint).</p>
          <div className="flex gap-2">
            <input value={txHashInput} onChange={(e) => setTxHashInput(e.target.value)} placeholder="0x payment tx hash" className="flex-1 p-2 rounded bg-white/6 text-black" />
            <button onClick={callVerifyAndMint} className="px-4 py-2 bg-emerald-500 rounded text-black">Verify & Mint</button>
          </div>
        </section>

        <footer className="mt-4 text-xs text-slate-400">
          Contract: <code>{process.env.NEXT_PUBLIC_TOKEN_CONTRACT}</code> • USDC: <code>{process.env.NEXT_PUBLIC_USDC_CONTRACT}</code>
        </footer>
      </div>
    </main>
  );
      }
