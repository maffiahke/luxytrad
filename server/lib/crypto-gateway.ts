import { decrypt } from "./crypto";

/**
 * Config for an on-chain (crypto) gateway. It lives AES-256-GCM encrypted in
 * Gateway.secretEnc as a JSON blob — the same storage the M-Pesa credentials use —
 * so the address and any explorer API key are never persisted in plaintext.
 */
export interface CryptoConfigBlob {
  network?: string;
  address?: string;
  confirmations?: number;
  autoCredit?: boolean;
  callbackUrl?: string;
  apiKey?: string;
}

/** Decrypt + parse the blob; returns null when unset or unreadable. */
export function parseCryptoConfig(secretEnc: string | null | undefined): CryptoConfigBlob | null {
  if (!secretEnc) return null;
  const plain = decrypt(secretEnc);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CryptoConfigBlob) : null;
  } catch {
    return null;
  }
}

const PATTERNS: Record<string, RegExp> = {
  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  ERC20: /^0x[0-9a-fA-F]{40}$/,
  Bitcoin: /^(bc1|tb1)[0-9a-z]{11,71}$/,
};

/** Address check keyed by the configured network; permissive for networks we have
 *  no dedicated pattern for (the admin still gets a human-readable warning). */
export function validateCryptoAddress(network: string, address: string): boolean {
  const a = (address ?? "").trim();
  if (!a) return false;
  const re = PATTERNS[network] ?? /^(T[1-9A-HJ-NP-Za-km-z]{33}|0x[0-9a-fA-F]{40}|(bc1|tb1)[0-9a-z]{11,71})$/;
  return re.test(a);
}

/** Compact preview for the gateway list, e.g. "TQ8k…JqAv". */
export function maskAddress(address: string): string {
  return address.length <= 8 ? "••••" : `${address.slice(0, 4)}…${address.slice(-4)}`;
}
