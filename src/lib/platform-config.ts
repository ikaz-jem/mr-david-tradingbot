import { PlatformConfig } from "@/models/PlatformConfig";

export async function getPlatformConfig() {
  const config = await PlatformConfig.findOne({ key: "global" }).lean();
  return {
    registrationOpen: config?.registrationOpen ?? true,
    scansOpen: config?.scansOpen ?? true,
    announcement: config?.announcement ?? "",
  };
}
