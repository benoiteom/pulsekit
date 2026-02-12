export type PulseEventType = "pageview" | "custom" | "vitals";

export interface PulseEventPayload {
  type: PulseEventType;
  path: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

export {
  getPulseStats,
  getPulseVitals,
  type Timeframe,
  type DailyStat,
  type TopPageStat,
  type LocationStat,
  type PulseStats,
  type WebVitalRating,
  type WebVitalStat,
  type PageVitalsStat,
  type VitalsOverview,
} from "./queries";
