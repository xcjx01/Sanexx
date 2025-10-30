// lib/ethers.ts
import { providers } from 'ethers';

export function getProvider() {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return new providers.Web3Provider((window as any).ethereum as any, 'any');
  }
  const rpc = process.env.BASE_RPC || process.env.NEXT_PUBLIC_BASE_RPC || 'https://1rpc.io/base';
  return new providers.JsonRpcProvider(rpc);
}
