export type MachineStatus = 'Healthy' | 'Warning' | 'Critical' | 'Offline';
export type AgentStatus = 'Idle' | 'Investigating' | 'Issue Generated' | 'Resolved' | 'Monitoring';
export type AnomalySeverity = 'High' | 'Medium' | 'Low';
export type UseCaseStatus = 'Active' | 'Triggered' | 'Disabled';

export interface SparkPoint { t: string; v: number; deviceId?: string; }

export interface LiveMetric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  min: number | null;
  max: number | null;
  threshold: number | null;
  normalRange: [number, number] | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  status: 'normal' | 'warning' | 'critical' | 'unavailable';
  spark: SparkPoint[];
  dataAvailable?: boolean;
  source?: { bucket: string; measurement: string };
}

export interface Anomaly {
  id: string;
  type: string;
  description: string;
  severity: AnomalySeverity;
  detectedAt: string;
  confidence: number;
  affectedSignals: string[];
}

export interface Issue {
  id: string;
  title: string;
  severity: AnomalySeverity;
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  assignedTo: string;
  description: string;
}

export interface UseCase {
  id: string;
  name: string;
  description: string;
  status: UseCaseStatus;
  signals: string[];
  lastTriggered?: string;
}

export interface RecommendedAction {
  id: string;
  priority: 'Immediate' | 'Preventive' | 'Long-term';
  action: string;
  responsibleTeam: string;
  estimatedTime: string;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  type: string;
  location: string;
  plant: string;
  line: string;
  healthScore: number;
  status: MachineStatus;
  activeIssues: number;
  lastAnomalyAt: string | null;
  lastUpdated: string;
  lastIssueText?: string;
  operator: string;
  installDate: string;
  lastMaintenance: string;
  agentStatus: AgentStatus;
  metrics: LiveMetric[];
  liveMetrics: LiveMetric[];
  anomalies: Anomaly[];
  issues: Issue[];
  useCases: UseCase[];
  recommendations: RecommendedAction[];
  specs: { label: string; value: string }[];
  source?: string;
  availableMetricCount?: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
}

export const STATUS_DESCRIPTIONS: Record<MachineStatus, string> = {
  Healthy: 'Machine is operating within normal technical parameters with no signal anomalies or active maintenance alerts.',
  Warning: 'Live InfluxDB telemetry is above a configured warning threshold.',
  Critical: 'Live InfluxDB telemetry is above a configured critical threshold.',
  Offline: 'Machine telemetry is currently offline or disconnected from the InfluxDB edge collector node.',
};

export const PLANTS: string[] = [];

export function getMachineSummary(machines: Machine[]) {
  return {
    total: machines.length,
    healthy: machines.filter((machine) => machine.status === 'Healthy').length,
    warning: machines.filter((machine) => machine.status === 'Warning').length,
    critical: machines.filter((machine) => machine.status === 'Critical').length,
    offline: machines.filter((machine) => machine.status === 'Offline').length,
    activeIssues: machines.reduce((total, machine) => total + machine.activeIssues, 0),
    issuesCount: machines.reduce((total, machine) => total + machine.activeIssues, 0),
  };
}
