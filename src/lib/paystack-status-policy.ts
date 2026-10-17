export function paystackPaymentDisposition(status: string): "paid" | "pending" | "failed" | "review" {
  if (status === "success") return "paid";
  if (status === "failed") return "failed";
  if (status === "reversed") return "review";
  // "abandoned" means the customer has not completed payment; the hosted
  // checkout may still be open or not yet visited. Never close it immediately.
  return "pending";
}
