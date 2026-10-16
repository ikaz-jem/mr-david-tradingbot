export type RegulatedAction = "billing" | "exchange_connection" | "exchange_execution";

function countries(value: string | undefined) {
  return new Set((value ?? "").split(",").map(item => item.trim().toUpperCase()).filter(item => /^[A-Z]{2}$/.test(item)));
}

export function regulatedAccess(input: { isDemo: boolean; countryCode?: string | null; action: RegulatedAction; allowedCountries?: string; blockedCountries?: string }) {
  if (input.isDemo) return { allowed: true, status: 200, reason: "Demo scope does not perform a regulated live operation." } as const;
  const allowed = countries(input.allowedCountries ?? process.env.ALLOWED_COUNTRIES);
  const blocked = countries(input.blockedCountries ?? process.env.BLOCKED_COUNTRIES);
  if (!allowed.size) return { allowed: false, status: 503, reason: "Live financial operations are unavailable until the platform country policy is configured." } as const;
  const country = input.countryCode?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(country)) return { allowed: false, status: 403, reason: "A verified billing country is required before using live payments or exchange services. Contact support." } as const;
  if (blocked.has(country) || !allowed.has(country)) return { allowed: false, status: 451, reason: "This live financial service is not available in your verified country." } as const;
  return { allowed: true, status: 200, reason: `${input.action} is available in the verified country.` } as const;
}
