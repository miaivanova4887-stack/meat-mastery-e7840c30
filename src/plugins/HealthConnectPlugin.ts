/**
 * Health Connect Capacitor Plugin Bridge
 * 
 * Registers the native Kotlin plugin with Capacitor's plugin system.
 * On web, all methods return mock/empty data for development.
 */
import { registerPlugin } from "@capacitor/core";

export interface HealthConnectRecord {
  value: number;
  unit: string;
  timestamp: string;
}

export interface HealthConnectResult {
  records: HealthConnectRecord[];
}

export interface HealthConnectPlugin {
  checkAvailability(): Promise<{ status: "available" | "unavailable" | "not_installed" }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readSteps(options: { startTime: string; endTime: string }): Promise<HealthConnectResult>;
  readHeartRate(options: { startTime: string; endTime: string }): Promise<HealthConnectResult>;
  readWeight(options: { startTime: string; endTime: string }): Promise<HealthConnectResult>;
}

// Web fallback for development in browser
const HealthConnectWeb: HealthConnectPlugin = {
  async checkAvailability() {
    console.warn("HealthConnect: running in web — returning unavailable");
    return { status: "unavailable" as const };
  },
  async requestPermissions() {
    console.warn("HealthConnect: running in web — permissions not applicable");
    return { granted: false };
  },
  async readSteps() {
    return { records: [] };
  },
  async readHeartRate() {
    return { records: [] };
  },
  async readWeight() {
    return { records: [] };
  },
};

const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect", {
  web: () => Promise.resolve(HealthConnectWeb),
});

export default HealthConnect;
