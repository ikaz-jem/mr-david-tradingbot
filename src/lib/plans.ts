export const plans = [
  { id: "starter", name: "Starter", audience: "For focused exploration", price: 29, credits: 25, description: "A measured way to explore market setups.", features: ["25 completed analyses each month", "Spot market research", "Signal history and outcomes", "Paper performance dashboard"], featured: false },
  { id: "trader", name: "Trader", audience: "For a daily workflow", price: 79, credits: 100, description: "More room to study the market and refine decisions.", features: ["100 completed analyses each month", "Everything in Starter", "Connected exchange workspace", "User-approved spot orders", "Detailed fill and P&L views"], featured: true },
  { id: "desk", name: "Desk", audience: "For deeper research", price: 199, credits: 300, description: "A wider research allowance with priority support.", features: ["300 completed analyses each month", "Everything in Trader", "Expanded analytics and exports", "Priority support"], featured: false },
] as const;

export type PlanId = (typeof plans)[number]["id"];
