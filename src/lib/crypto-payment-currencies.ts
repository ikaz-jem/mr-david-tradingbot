import { providerRequest, type Gateway } from "@/lib/payment-gateways";
import { paymentCoinIcon } from "@/lib/payment-display";

export type CryptoCurrency = { code: string; name: string; network: string; extraIdRequired: boolean; iconUrl?: string };
type ProviderCurrency = { code: string; name: string; network?: string; logo_url?: string; enable: boolean; available_for_payment?: boolean; extra_id_exists?: boolean; extra_id_optional?: boolean };
const cache = new Map<string, { expires: number; coins: CryptoCurrency[] }>();
export async function cryptoPaymentCurrencies(gateway: Gateway, fresh = false): Promise<CryptoCurrency[]> {
  if (gateway.mode === "demo") return [{ code: "usdtbsc", name: "Tether", network: "BNB Smart Chain (BEP20)", extraIdRequired: false }, { code: "btc", name: "Bitcoin", network: "Bitcoin", extraIdRequired: false }];
  const key = `${gateway.id}:${gateway.mode}`;
  const cached = cache.get(key);
  if (!fresh && cached && cached.expires > Date.now()) return cached.coins;
  const [available, selected, details] = await Promise.all([
    providerRequest<{ currencies: string[] }>(gateway, "currencies"),
    providerRequest<{ selectedCurrencies?: string[]; currencies?: string[] }>(gateway, "merchant/coins"),
    providerRequest<{ currencies: ProviderCurrency[] }>(gateway, "full-currencies"),
  ]);
  const supported = new Set(available.currencies.map(code => code.toLowerCase()));
  const approved = new Set((selected.selectedCurrencies ?? selected.currencies ?? []).map(code => code.toLowerCase()));
  const coins = details.currencies.filter(coin => coin.enable && coin.available_for_payment !== false && supported.has(coin.code.toLowerCase()) && approved.has(coin.code.toLowerCase())).map(coin => ({ code: coin.code.toLowerCase(), iconUrl: paymentCoinIcon(coin.code, coin.logo_url), name: coin.name, network: coin.network === "bsc" ? "BNB Smart Chain (BEP20)" : coin.network?.toUpperCase() || coin.code.toUpperCase(), extraIdRequired: Boolean(coin.extra_id_exists && !coin.extra_id_optional) })).sort((a,b) => a.code.localeCompare(b.code));
  if (cache.size > 100) cache.clear();
  cache.set(key, { expires: Date.now() + 300000, coins });
  return coins;
}
