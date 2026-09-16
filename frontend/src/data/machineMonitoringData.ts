// ─── Types ────────────────────────────────────────────────────────────────────

export type MachineStatus = 'Healthy' | 'Warning' | 'Critical' | 'Offline';
export type AgentStatus = 'Idle' | 'Investigating' | 'Issue Generated' | 'Resolved' | 'Monitoring';
export type AnomalySeverity = 'High' | 'Medium' | 'Low';
export type UseCaseStatus = 'Active' | 'Triggered' | 'Disabled';

export interface SparkPoint { t: number; v: number; }

export interface LiveMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  threshold: number;
  normalRange: [number, number];
  warningThreshold: number;
  criticalThreshold: number;
  status: 'normal' | 'warning' | 'critical';
  spark: SparkPoint[];
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
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  status: 'normal' | 'warning' | 'critical';
}

// ─── Status Descriptions ──────────────────────────────────────────────────────

export const STATUS_DESCRIPTIONS: Record<MachineStatus, string> = {
  Healthy: 'Machine is operating within normal technical parameters with no signal anomalies or active maintenance alerts.',
  Warning: 'Minor telemetry drift detected. Autonomous LLM agent is monitoring parameters and preparing advisory recommendations.',
  Critical: 'High-severity anomaly detected. LLM Investigation agent has flagged critical parameters requiring immediate technician review.',
  Offline: 'Machine telemetry is currently offline or disconnected from the InfluxDB edge collector node.',
};

export const PLANTS = ['Plant A - Grinding & Pyro', 'Plant B - Processing', 'Plant C - Logistics'];

// ─── Generators ──────────────────────────────────────────────────────────────

function spark(base: number, variance: number, n = 12): SparkPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i, v: parseFloat((base + (Math.random() - 0.5) * variance * 2).toFixed(2)),
  }));
}

export function generateTimeSeriesData(
  points = 30,
  baseVal = 50,
  variance = 5,
  hasSpike = false
): TimeSeriesPoint[] {
  const now = new Date();
  const result: TimeSeriesPoint[] = [];

  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 1000);
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let val = baseVal + (Math.random() - 0.48) * variance;

    if (hasSpike && i === Math.floor(points / 3)) {
      val += variance * 2.5;
    }

    val = Math.max(0, Number(val.toFixed(2)));
    const status = val > baseVal + variance * 1.8 ? 'critical' : val > baseVal + variance * 1.2 ? 'warning' : 'normal';

    result.push({ timestamp: timeStr, value: val, status });
  }

  return result;
}

// ─── Helper: Create Machine Object ───────────────────────────────────────────

function createMachine(
  id: string,
  code: string,
  name: string,
  type: string,
  location: string,
  plant: string,
  line: string,
  healthScore: number,
  status: MachineStatus,
  activeIssues: number,
  agentStatus: AgentStatus,
  operator: string,
  installDate: string,
  lastMaintenance: string,
  metricsList: { key: string; label: string; value: number; unit: string; min: number; max: number; norm: [number, number]; warn: number; crit: number; status: 'normal' | 'warning' | 'critical' }[],
  lastIssueText?: string
): Machine {
  const metrics: LiveMetric[] = metricsList.map(m => ({
    key: m.key,
    label: m.label,
    value: m.value,
    unit: m.unit,
    min: m.min,
    max: m.max,
    normalRange: m.norm,
    warningThreshold: m.warn,
    criticalThreshold: m.crit,
    threshold: m.warn,
    status: m.status,
    spark: spark(m.value, (m.norm[1] - m.norm[0]) * 0.1),
  }));

  return {
    id,
    code,
    name,
    type,
    location,
    plant,
    line,
    healthScore,
    status,
    activeIssues,
    lastAnomalyAt: status !== 'Healthy' && status !== 'Offline' ? new Date().toISOString() : null,
    lastUpdated: 'Just now',
    lastIssueText,
    operator,
    installDate,
    lastMaintenance,
    agentStatus,
    metrics,
    liveMetrics: metrics,
    anomalies: status !== 'Healthy' ? [
      { id: `anom-${id}`, type: `${type} Variance`, description: lastIssueText || 'Telemetry drift detected', severity: status === 'Critical' ? 'High' : 'Medium', detectedAt: '10 mins ago', confidence: 94, affectedSignals: ['Vibration', 'Temperature'] }
    ] : [],
    issues: activeIssues > 0 ? [
      { id: `iss-${id}`, title: lastIssueText || 'Parameter Exceedance', severity: status === 'Critical' ? 'High' : 'Medium', status: 'In Progress', createdAt: '20 mins ago', assignedTo: operator, description: lastIssueText || 'Anomaly flagged by LLM Agent' }
    ] : [],
    useCases: [
      { id: 'uc-th', name: 'Thermal Health Monitoring', description: 'Monitors bearing and motor temperatures', status: 'Active', signals: ['Temperature'] },
      { id: 'uc-[#2DD4BF]', name: 'Vibration Health', description: 'Detects bearing imbalance from vibration', status: 'Active', signals: ['Vibration'] },
      { id: 'uc-eh', name: 'Electrical Health', description: 'Monitors voltage & current load', status: 'Active', signals: ['Current', 'Power'] },
      { id: 'uc-pm', name: 'Predictive Maintenance', description: 'Multi-signal trend analysis', status: 'Active', signals: ['Vibration', 'Temperature'] },
    ],
    recommendations: activeIssues > 0 ? [
      { id: `rec-${id}`, priority: status === 'Critical' ? 'Immediate' : 'Preventive', action: 'Inspect drive bearing lubrication and align coupling bolts.', responsibleTeam: 'Mechanical Maintenance', estimatedTime: '45 mins' }
    ] : [],
    specs: [
      { label: 'Manufacturer', value: 'Siemens / FLSmidth' },
      { label: 'Installation Date', value: installDate },
      { label: 'Primary Operator', value: operator },
      { label: 'Last Service', value: lastMaintenance },
    ]
  };
}

// ─── 13 Machines Mock Dataset ──────────────────────────────────────────────────

export const MOCK_MACHINES: Machine[] = [
  createMachine(
    'M-01', 'M-01', 'Ball Mill #1', 'Grinding Mill', 'Zone A – Grinding Hall', 'Plant A - Grinding & Pyro', 'Line 1',
    92, 'Healthy', 0, 'Idle', 'Rajesh Kumar', 'Mar 2018', 'Aug 14, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 68.4, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.8, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 142, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'normal' },
      { key: 'power', label: 'Power', value: 2310, unit: 'kW', min: 1500, max: 2800, norm: [2000, 2500], warn: 2650, crit: 2780, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 16.8, unit: 'rpm', min: 14, max: 20, norm: [15, 18], warn: 18.8, crit: 19.5, status: 'normal' },
    ]
  ),
  createMachine(
    'M-02', 'M-02', 'Kiln Drive Motor', 'Rotary Kiln Drive', 'Zone B – Pyro Section', 'Plant A - Grinding & Pyro', 'Line 1',
    61, 'Warning', 2, 'Investigating', 'Amit Sharma', 'Jan 2019', 'Jul 28, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 88.7, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'warning' },
      { key: 'vibration', label: 'Vibration', value: 5.4, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'warning' },
      { key: 'current', label: 'Current', value: 198, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'warning' },
      { key: 'power', label: 'Power', value: 1140, unit: 'kW', min: 800, max: 1400, norm: [900, 1200], warn: 1300, crit: 1380, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 4.2, unit: 'rpm', min: 1, max: 6, norm: [3.5, 5.0], warn: 5.5, crit: 5.8, status: 'normal' },
    ],
    'High bearing temp (88.7°C) & elevated vibration detected'
  ),
  createMachine(
    'M-03', 'M-03', 'Vertical Roller Mill', 'Grinding Mill', 'Zone A – Grinding Hall', 'Plant A - Grinding & Pyro', 'Line 2',
    96, 'Healthy', 0, 'Idle', 'Suresh Patel', 'Nov 2020', 'Sep 02, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 62.1, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.2, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 135, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'normal' },
      { key: 'power', label: 'Power', value: 1950, unit: 'kW', min: 1500, max: 2800, norm: [1800, 2200], warn: 2500, crit: 2700, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 24.5, unit: 'rpm', min: 18, max: 30, norm: [22, 27], warn: 28.5, crit: 29.5, status: 'normal' },
    ]
  ),
  createMachine(
    'M-04', 'M-04', 'Raw Mill Fan #2', 'Heavy Duty Blower', 'Zone A – Grinding Hall', 'Plant A - Grinding & Pyro', 'Line 2',
    34, 'Critical', 3, 'Issue Generated', 'Vikram Singh', 'May 2017', 'May 12, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 102.5, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'critical' },
      { key: 'vibration', label: 'Vibration', value: 8.9, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'critical' },
      { key: 'current', label: 'Current', value: 215, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'critical' },
      { key: 'power', label: 'Power', value: 450, unit: 'kW', min: 200, max: 500, norm: [300, 400], warn: 420, crit: 480, status: 'warning' },
      { key: 'rpm', label: 'RPM', value: 980, unit: 'rpm', min: 600, max: 1200, norm: [850, 1050], warn: 1100, crit: 1180, status: 'normal' },
    ],
    'Critical fan impeller unbalance & extreme temperature spike (102.5°C)'
  ),
  createMachine(
    'M-05', 'M-05', 'Clinker Cooler Fan', 'Cooler Blower', 'Zone B – Pyro Section', 'Plant A - Grinding & Pyro', 'Line 1',
    89, 'Healthy', 0, 'Idle', 'Dinesh Verma', 'Aug 2021', 'Aug 22, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 58.0, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 2.1, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 110, unit: 'A', min: 80, max: 220, norm: [100, 140], warn: 160, crit: 190, status: 'normal' },
      { key: 'power', label: 'Power', value: 310, unit: 'kW', min: 150, max: 450, norm: [250, 350], warn: 390, crit: 430, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 1150, unit: 'rpm', min: 800, max: 1400, norm: [1000, 1250], warn: 1300, crit: 1380, status: 'normal' },
    ]
  ),
  createMachine(
    'M-06', 'M-06', 'Preheater ID Fan', 'Exhaust Fan', 'Zone B – Pyro Section', 'Plant A - Grinding & Pyro', 'Line 1',
    0, 'Offline', 0, 'Idle', 'Ramesh Yadav', 'Feb 2016', 'Jun 10, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 0, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 0, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 0, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'normal' },
      { key: 'power', label: 'Power', value: 0, unit: 'kW', min: 1500, max: 2800, norm: [1800, 2200], warn: 2500, crit: 2700, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 0, unit: 'rpm', min: 600, max: 1200, norm: [800, 1050], warn: 1100, crit: 1180, status: 'normal' },
    ],
    'Offline for scheduled annual refractory shutdown'
  ),
  createMachine(
    'M-07', 'M-07', 'Cement Mill #2', 'Finish Grinding', 'Zone C – Cement Mill', 'Plant B - Processing', 'Line 3',
    95, 'Healthy', 0, 'Idle', 'Manoj Joshi', 'Apr 2022', 'Aug 30, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 65.2, unit: '°C', min: 40, max: 110, norm: [55, 75], warn: 85, crit: 98, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.6, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 150, unit: 'A', min: 80, max: 220, norm: [120, 160], warn: 185, crit: 210, status: 'normal' },
      { key: 'power', label: 'Power', value: 2450, unit: 'kW', min: 1500, max: 2800, norm: [2000, 2600], warn: 2680, crit: 2750, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 15.5, unit: 'rpm', min: 12, max: 18, norm: [14, 16.5], warn: 17.2, crit: 17.8, status: 'normal' },
    ]
  ),
  createMachine(
    'M-08', 'M-08', 'Bucket Elevator #3', 'Material Handling', 'Zone C – Silo Storage', 'Plant B - Processing', 'Line 3',
    91, 'Healthy', 0, 'Idle', 'Sunil Nair', 'Oct 2019', 'Jul 15, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 48.5, unit: '°C', min: 30, max: 90, norm: [40, 65], warn: 75, crit: 85, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 2.4, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 62, unit: 'A', min: 30, max: 120, norm: [50, 80], warn: 95, crit: 110, status: 'normal' },
      { key: 'power', label: 'Power', value: 95, unit: 'kW', min: 40, max: 160, norm: [80, 120], warn: 135, crit: 150, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 45, unit: 'rpm', min: 30, max: 60, norm: [40, 50], warn: 54, crit: 58, status: 'normal' },
    ]
  ),
  createMachine(
    'M-09', 'M-09', 'Packhouse Packer #1', 'Automated Packing', 'Zone D – Packhouse', 'Plant C - Logistics', 'Line 4',
    88, 'Healthy', 0, 'Idle', 'Pankaj Roy', 'Dec 2021', 'Aug 05, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 42.1, unit: '°C', min: 30, max: 80, norm: [35, 55], warn: 65, crit: 75, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.1, unit: 'mm/s', min: 0, max: 10, norm: [0.5, 2.5], warn: 4.0, crit: 6.0, status: 'normal' },
      { key: 'current', label: 'Current', value: 38, unit: 'A', min: 10, max: 80, norm: [30, 50], warn: 60, crit: 72, status: 'normal' },
      { key: 'power', label: 'Power', value: 45, unit: 'kW', min: 20, max: 100, norm: [35, 60], warn: 75, crit: 90, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 120, unit: 'rpm', min: 80, max: 160, norm: [100, 140], warn: 150, crit: 158, status: 'normal' },
    ]
  ),
  createMachine(
    'M-10', 'M-10', 'Primary Jaw Crusher', 'Crushing Section', 'Zone E – Quarry Site', 'Plant A - Grinding & Pyro', 'Quarry 1',
    94, 'Healthy', 0, 'Idle', 'Anil Deshmukh', 'Jun 2018', 'Sep 01, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 71.0, unit: '°C', min: 40, max: 110, norm: [55, 78], warn: 88, crit: 100, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 3.8, unit: 'mm/s', min: 0, max: 12, norm: [2.0, 5.0], warn: 7.0, crit: 9.5, status: 'normal' },
      { key: 'current', label: 'Current', value: 240, unit: 'A', min: 100, max: 350, norm: [180, 270], warn: 300, crit: 330, status: 'normal' },
      { key: 'power', label: 'Power', value: 380, unit: 'kW', min: 200, max: 600, norm: [300, 450], warn: 500, crit: 560, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 220, unit: 'rpm', min: 150, max: 300, norm: [200, 250], warn: 275, crit: 290, status: 'normal' },
    ]
  ),
  createMachine(
    'M-11', 'M-11', 'Slurry Pump #4', 'Fluid Handling', 'Zone F – Slurry Hall', 'Plant B - Processing', 'Line 2',
    97, 'Healthy', 0, 'Idle', 'Deepak Gill', 'May 2023', 'Aug 19, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 51.4, unit: '°C', min: 30, max: 90, norm: [40, 60], warn: 72, crit: 85, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.3, unit: 'mm/s', min: 0, max: 10, norm: [0.8, 2.8], warn: 4.5, crit: 7.0, status: 'normal' },
      { key: 'current', label: 'Current', value: 88, unit: 'A', min: 40, max: 150, norm: [70, 110], warn: 125, crit: 140, status: 'normal' },
      { key: 'power', label: 'Power', value: 110, unit: 'kW', min: 50, max: 200, norm: [90, 140], warn: 165, crit: 185, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 1450, unit: 'rpm', min: 1000, max: 1800, norm: [1350, 1550], warn: 1650, crit: 1750, status: 'normal' },
    ]
  ),
  createMachine(
    'M-12', 'M-12', 'Compressor Station B', 'Pneumatic Power', 'Utility Bay 2', 'Plant B - Processing', 'Utilities',
    90, 'Healthy', 0, 'Idle', 'Gaurav Mehta', 'Sep 2020', 'Jul 30, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 66.8, unit: '°C', min: 40, max: 100, norm: [50, 72], warn: 80, crit: 92, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.7, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.2], warn: 4.8, crit: 6.8, status: 'normal' },
      { key: 'current', label: 'Current', value: 125, unit: 'A', min: 60, max: 200, norm: [100, 150], warn: 170, crit: 190, status: 'normal' },
      { key: 'power', label: 'Power', value: 180, unit: 'kW', min: 80, max: 250, norm: [140, 200], warn: 220, crit: 240, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 2950, unit: 'rpm', min: 2000, max: 3500, norm: [2800, 3100], warn: 3250, crit: 3400, status: 'normal' },
    ]
  ),
  createMachine(
    'M-13', 'M-13', 'Coal Mill Drive', 'Fuel Preparation', 'Zone A – Grinding Hall', 'Plant A - Grinding & Pyro', 'Line 1',
    93, 'Healthy', 0, 'Idle', 'Harish Saini', 'Mar 2022', 'Aug 26, 2026',
    [
      { key: 'temperature', label: 'Temperature', value: 63.5, unit: '°C', min: 40, max: 110, norm: [50, 72], warn: 82, crit: 95, status: 'normal' },
      { key: 'vibration', label: 'Vibration', value: 1.9, unit: 'mm/s', min: 0, max: 10, norm: [1.0, 3.5], warn: 5.0, crit: 7.2, status: 'normal' },
      { key: 'current', label: 'Current', value: 155, unit: 'A', min: 80, max: 220, norm: [120, 170], warn: 190, crit: 210, status: 'normal' },
      { key: 'power', label: 'Power', value: 1250, unit: 'kW', min: 800, max: 1800, norm: [1000, 1400], warn: 1550, crit: 1700, status: 'normal' },
      { key: 'rpm', label: 'RPM', value: 18.2, unit: 'rpm', min: 12, max: 24, norm: [15, 20], warn: 21.5, crit: 23.0, status: 'normal' },
    ]
  ),
];

// ─── Fleet Summary ─────────────────────────────────────────────────────────────

export function getMachineSummary(machines: Machine[]) {
  const total = machines.length;
  const healthy = machines.filter(m => m.status === 'Healthy').length;
  const warning = machines.filter(m => m.status === 'Warning').length;
  const critical = machines.filter(m => m.status === 'Critical').length;
  const offline = machines.filter(m => m.status === 'Offline').length;
  const issuesCount = machines.reduce((acc, m) => acc + m.activeIssues, 0);
  const avgHealth = Math.round(machines.reduce((acc, m) => acc + m.healthScore, 0) / (total || 1));

  return {
    total,
    healthy,
    warning,
    critical,
    offline,
    activeIssues: issuesCount,
    issuesCount,
    avgHealth,
  };
}
