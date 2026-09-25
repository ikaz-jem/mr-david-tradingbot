import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
export const metadata: Metadata = { title: "Risk disclosure" };
export default function Page() { return <LegalDocument title="Risk disclosure" intro="Crypto trading can result in substantial or total loss. Read this before using a signal or connecting an exchange." sections={[
  { title: "Signals are uncertain", paragraphs: ["AI analysis and historical patterns can be wrong. A signal may expire, never reach its entry, or reach a loss condition before a target. Past and simulated performance do not predict future results."] },
  { title: "Execution differs from a chart", paragraphs: ["Quoted prices may move before you confirm. Liquidity, spread, slippage, fees, partial fills, exchange filters, outages, and API delays can change your outcome."] },
  { title: "Account and security risk", paragraphs: ["Assets remain at the connected exchange, which has its own operational and custody risks. A trade-only API key cannot withdraw assets when properly scoped, but it can still place losing or unwanted trades if misused. Revoke a compromised key immediately."] },
  { title: "Performance labels", paragraphs: ["The product should present hypothetical signal outcomes, paper results, app-executed trades, and whole-account performance separately. A model score is not a probability of profit unless validated and described as such."] },
]} />; }
