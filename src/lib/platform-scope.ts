// Public demo operators must never write the live platform configuration.
export function platformConfigKey(isDemo: boolean): "demo" | "global" {
  return isDemo ? "demo" : "global";
}
