export type PulseEventType = "pageview" | "custom" | "vitals" | "error" | "server_error";

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
  getPulseErrors,
  getPulseAggregates,
  dateRangeFromTimeframe,
  type Timeframe,
  type DailyStat,
  type TopPageStat,
  type LocationStat,
  type PulseStats,
  type WebVitalRating,
  type WebVitalStat,
  type PageVitalsStat,
  type VitalsOverview,
  type ErrorStat,
  type ErrorsOverview,
  type AggregateRow,
  type AggregatesOverview,
} from "./queries";
