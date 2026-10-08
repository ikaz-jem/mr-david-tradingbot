export type ResearchDecision = "publish" | "no_setup";

export function enforceResearchDecision(deterministicEligible: boolean, aiDecision: ResearchDecision): ResearchDecision {
  return deterministicEligible && aiDecision === "publish" ? "publish" : "no_setup";
}
