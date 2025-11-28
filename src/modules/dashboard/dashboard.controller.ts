import { dashboardService } from "./dashboard.service";

export const provinceStatsController = async () => {
  const stats = await dashboardService.getProvinceStats();
  return { stats };
};
