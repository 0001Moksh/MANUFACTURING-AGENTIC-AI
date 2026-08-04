export interface KpiMetric {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  subtext: string;
}

export interface LiveAlertFeed {
  id: string;
  agent: string;
  message: string;
  severity: 'red' | 'amber' | 'green';
  timestamp: string;
}

export interface OeeDataPoint {
  time: string;
  targetOee: number;
  actualOee: number;
}