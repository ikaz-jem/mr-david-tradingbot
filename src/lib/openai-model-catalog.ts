export type OpenAIModelOption = { id: string; label: string; description: string; recommended?: boolean };

export const fallbackOpenAIModels: OpenAIModelOption[] = [
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balanced intelligence, latency, and cost for structured market research.", recommended: true },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", description: "Cost-efficient, high-volume research explanations." },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", description: "Highest-capability option for complex analysis." },
  { id: "gpt-5-mini", label: "GPT-5 mini", description: "Fast, economical model for well-defined structured tasks." },
  { id: "gpt-5-nano", label: "GPT-5 nano", description: "Lowest-cost GPT-5 option for simple workloads." },
  { id: "gpt-5", label: "GPT-5", description: "Previous-generation general reasoning model." },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", description: "Reliable non-reasoning model with strong instruction following." },
  { id: "gpt-4.1", label: "GPT-4.1", description: "High-capability non-reasoning model." },
  { id: "gpt-4o-mini", label: "GPT-4o mini", description: "Legacy low-cost multimodal model." },
];

const disallowedModelFragments = ["audio", "realtime", "transcribe", "tts", "image", "search", "codex", "chat-latest", "deep-research", "computer-use", "embedding", "moderation"];

export function isSupportedResearchModel(id: string) {
  const normalized = id.toLowerCase();
  if (normalized.startsWith("ft:") || /-\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  if (disallowedModelFragments.some((fragment) => normalized.includes(fragment))) return false;
  return /^(?:gpt-(?:5(?:\.\d+)?(?:-(?:sol|terra|luna|mini|nano|pro))?|4\.1(?:-mini|-nano)?|4o(?:-mini)?)|o3(?:-mini|-pro)?|o4-mini)$/.test(normalized);
}

export function describeOpenAIModel(id: string): OpenAIModelOption {
  const known = fallbackOpenAIModels.find((model) => model.id === id);
  if (known) return known;
  const label = id.split("-").map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  return { id, label, description: "Available to the configured OpenAI API project." };
}
