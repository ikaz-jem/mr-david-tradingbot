export const membershipPlans = [
  { id: "starter", name: "Starter", monthlyPrice: 29 },
  { id: "trader", name: "Trader", monthlyPrice: 79 },
  { id: "desk", name: "Desk", monthlyPrice: 199 },
] as const;
export type MembershipPlan = (typeof membershipPlans)[number]["id"];
export function hasMonthlyAccess(end: Date | string | null | undefined, now = new Date()) {
  return Boolean(end && new Date(end).getTime() > now.getTime());
}
export function nextMonthlyEnd(start: Date) {
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid membership date");
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

