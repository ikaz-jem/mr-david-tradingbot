export const exchangeProviderIds = ["binance", "bybit", "okx", "kraken", "kucoin"] as const;

export type ExchangeProviderId = (typeof exchangeProviderIds)[number];
export type CredentialField = {
  key: "apiKey" | "apiSecret" | "passphrase" | "keyVersion";
  label: string;
  placeholder: string;
  secret?: boolean;
  help?: string;
};

export type ExchangeProviderDefinition = {
  id: ExchangeProviderId;
  name: string;
  shortName: string;
  mark: string;
  color: string;
  description: string;
  accountLabel: string;
  managementUrl: string;
  credentialFields: CredentialField[];
};

export const exchangeProviders: ExchangeProviderDefinition[] = [
  {
    id: "binance", name: "Binance", shortName: "Binance", mark: "BN", color: "#f3ba2f",
    description: "Spot balances, monitoring, and optional user-confirmed Spot execution through a dedicated HMAC key.",
    accountLabel: "Spot", managementUrl: "https://www.binance.com/en/my/settings/api-management",
    credentialFields: [
      { key: "apiKey", label: "API key", placeholder: "Paste the Binance API key" },
      { key: "apiSecret", label: "API secret", placeholder: "Paste the Binance secret", secret: true },
    ],
  },
  {
    id: "bybit", name: "Bybit", shortName: "Bybit", mark: "BY", color: "#f7a600",
    description: "Unified balances with optional Spot Trade access; wallet transfers and leveraged products stay disabled.",
    accountLabel: "Unified", managementUrl: "https://www.bybit.com/app/user/api-management",
    credentialFields: [
      { key: "apiKey", label: "API key", placeholder: "Paste the Bybit API key" },
      { key: "apiSecret", label: "API secret", placeholder: "Paste the Bybit secret", secret: true },
    ],
  },
  {
    id: "okx", name: "OKX", shortName: "OKX", mark: "OK", color: "#ffffff",
    description: "Trading-account balances with optional Read + Trade access for confirmed cash Spot orders.",
    accountLabel: "Trading", managementUrl: "https://www.okx.com/account/my-api",
    credentialFields: [
      { key: "apiKey", label: "API key", placeholder: "Paste the OKX API key" },
      { key: "apiSecret", label: "Secret key", placeholder: "Paste the OKX secret", secret: true },
      { key: "passphrase", label: "API passphrase", placeholder: "Enter the API passphrase", secret: true },
    ],
  },
  {
    id: "kraken", name: "Kraken", shortName: "Kraken", mark: "KR", color: "#8b5cf6",
    description: "Spot balances with optional order permissions while funding and withdrawal capabilities stay disabled.",
    accountLabel: "Funding", managementUrl: "https://www.kraken.com/u/security/api",
    credentialFields: [
      { key: "apiKey", label: "API key", placeholder: "Paste the Kraken API key" },
      { key: "apiSecret", label: "Private key", placeholder: "Paste the Kraken private key", secret: true },
    ],
  },
  {
    id: "kucoin", name: "KuCoin", shortName: "KuCoin", mark: "KU", color: "#24ae8f",
    description: "Account balances with optional General + Spot permissions; transfer and withdrawal access stays disabled.",
    accountLabel: "Accounts", managementUrl: "https://www.kucoin.com/account/api",
    credentialFields: [
      { key: "apiKey", label: "API key", placeholder: "Paste the KuCoin API key" },
      { key: "apiSecret", label: "API secret", placeholder: "Paste the KuCoin secret", secret: true },
      { key: "passphrase", label: "API passphrase", placeholder: "Enter the API passphrase", secret: true },
      { key: "keyVersion", label: "Key version", placeholder: "3", help: "Use the version shown in KuCoin API Management (usually 3)." },
    ],
  },
];

export function isExchangeProvider(value: string): value is ExchangeProviderId {
  return exchangeProviderIds.includes(value as ExchangeProviderId);
}

export function getExchangeProvider(value: ExchangeProviderId) {
  return exchangeProviders.find((provider) => provider.id === value)!;
}
