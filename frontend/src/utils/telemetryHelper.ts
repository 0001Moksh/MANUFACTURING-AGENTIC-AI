import type { ToolInvocation, TurnTelemetry } from '../types/telemetry';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Incident & Forensics
  calculate_trir: 'Calculating Total Recordable Incident Rate (TRIR)...',
  calculate_ltifr: 'Evaluating Lost Time Injury Frequency Rate (LTIFR)...',
  get_zero_harm_index: 'Calculating Zero Harm Index Score...',
  compare_department_trir: 'Comparing Department Incident Metrics...',
  get_plant_incident_leaderboard: 'Aggregating Plant Incident Rankings...',
  get_zone_risk_score: 'Computing Zone Risk Factors & Scores...',
  get_high_risk_zones: 'Identifying High-Risk Industrial Zones...',
  get_cameras_high_severity: 'Auditing High-Severity CCTV Feed Metrics...',
  get_top_risk_classes: 'Analyzing Top Safety Hazard Classes...',
  get_recent_anomaly_flags: 'Querying Real-Time Safety Anomaly Flags...',
  get_anomaly_baseline_deviation: 'Analyzing Baseline vs Observed Deviation...',
  get_high_deviation_zones: 'Pinpointing High-Deviation Anomaly Areas...',
  get_zero_harm_by_location: 'Aggregating Zero Harm Breakdown by Plant...',
  get_high_heat_exposure: 'Scanning High-Heat & Furnace Zone Personnel...',
  get_workforce_movement_anomalies: 'Auditing Workforce Movement & Clustering...',
  get_shift_duration_violations: 'Checking Overtime & Shift Duration Limits...',
  get_restricted_zone_violations: 'Scanning Unauthorized Restricted Zone Entries...',
  get_missed_guard_patrols: 'Checking Security Checkpoint & Patrol Logs...',
  get_employee_movement_history: 'Retrieving Employee Zone Trajectory...',
  get_missing_exit_attendances: 'Flagging Missing Shift Exit Records...',
  get_fatigue_recommendations: 'Evaluating Fatigue & Rest Break AI Guidance...',
  get_department_breach_stats: 'Aggregating Department Security Breaches...',
  get_active_spills: 'Checking Active Chemical & Liquid Spills...',
  get_leak_incidents: 'Querying Basler High-Speed Leak Detections...',
  get_avg_spill_resolution_time: 'Computing Spill Remediation Response Time...',
  get_unacknowledged_spills: 'Checking Unacknowledged Hazard Alerts...',
  get_spill_video_clips: 'Locating Video Archive for Leak Event...',
  get_plant_leak_frequency: 'Analyzing Liquid Leak Frequency by Plant...',
  get_spill_agent_recommendations: 'Generating Spill Neutralization Guidelines...',
  get_spill_severity_distribution: 'Categorizing Spill Incidents by Severity...',
  get_pipeline_defect_detections: 'Auditing Pipeline Integrity & Defect Detections...',
  get_active_hse_overrides: 'Inspecting Active HSE Camera Overrides...',
  get_recent_notification_logs: 'Auditing Emergency SMS/Email Dispatch Logs...',
  get_ppe_counting_batches: 'Counting PPE Gear Verification Batches...',
  get_offline_cameras: 'Verifying Camera Online Health & Heartbeats...',
  get_inactive_basler_models: 'Checking Edge AI Model Status...',
  get_low_confidence_tracking: 'Evaluating AI Tracking False Positive Rates...',
  get_incident_scheduled_reports: 'Loading Scheduled Incident Reports...',
  get_system_timeout_settings: 'Checking Safety Session Security Settings...',
  get_avg_incident_ack_time: 'Measuring Incident Acknowledgment Latency...',
  get_unacknowledged_recommendations: 'Listing Open AI Safety Action Items...',
  capabilities_info: 'Reviewing Agent Capabilities & Tools...',
  off_topic_guardrail: 'Applying Domain Scope Guardrails...',

  // PPE & Vision Agent
  query_ppe_violations: 'Auditing PPE Compliance Records...',
  get_today_ppe_violations: 'Fetching Today’s Hard Hat & Vest Violations...',
  get_personnel_in_hazard_zones: 'Scanning Restricted Geofences in Real-Time...',
  get_cctv_camera_health: 'Inspecting AI Camera Feed Health...',

  // Safety & Quality
  get_today_quality_inspection_reports: 'Retrieving Quality Inspection Logs...',
  get_material_defect_analytics: 'Analyzing Defect & Tolerance Analytics...',
  get_quality_hold_status: 'Checking Quality Hold Batches...',

  // Permit to Work
  get_active_high_risk_permits: 'Scanning Hot Work & Confined Space Permits...',
  get_expired_permits_still_open: 'Auditing Expired & Unclosed Permits...',
  validate_permit_authorization: 'Verifying Worker Authorizations & Sign-offs...',

  // Maintenance & Reporting
  query_machine_health: 'Querying SCADA & Machine Health Telemetry...',
  get_predictive_maintenance_schedule: 'Forecasting Component Wear & Maintenance Windows...',
  execute_sql_reporting_query: 'Executing Analytical SQL Reporting Pipeline...',
  generate_pdf_summary: 'Assembling Exportable Audit Summary...',
};

export function getFriendlyToolDescription(toolName: string): string {
  if (TOOL_DESCRIPTIONS[toolName]) {
    return TOOL_DESCRIPTIONS[toolName];
  }
  const cleanName = toolName.replace(/^(get_|query_|calculate_|fetch_)/, '').replace(/_/g, ' ');
  return `Executing ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}...`;
}

export function formatFriendlyToolName(toolName: string): string {
  return toolName
    .replace(/^([a-z])/, (c) => c.toUpperCase())
    .replace(/_/g, ' ');
}

export function createEstimatedTelemetry(
  elapsedSec: number,
  tools: ToolInvocation[] = [],
  inputText = '',
  outputText = ''
): TurnTelemetry {
  const promptTokens = Math.max(1, Math.round(inputText.length / 3.8) + 380);
  const completionTokens = Math.max(1, Math.round(outputText.length / 3.8));
  const totalTokens = promptTokens + completionTokens;
  const cost = Number(((promptTokens * 0.075 + completionTokens * 0.3) / 1_000_000).toFixed(5));

  return {
    execution_time_sec: Number(elapsedSec.toFixed(2)),
    tools_used: tools,
    tokens: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
    cost_usd: cost || 0.0002,
  };
}
