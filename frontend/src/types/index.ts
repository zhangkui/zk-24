export type Uuid = string;
export type DateTime = string;

export interface GeoCoord {
  latitude: number;
  longitude: number;
  altitude: number;
}

export type TowerStatus = "Normal" | "Warning" | "Critical" | "Maintenance";

export type SensorType =
  | "Accelerometer"
  | "VelocityMeter"
  | "DisplacementMeter"
  | "Anemometer"
  | "WindVane"
  | "TemperatureSensor"
  | "HumiditySensor"
  | "IceThicknessSensor"
  | "StrainGauge"
  | "LoadCell";

export interface TowerSensor {
  id: Uuid;
  sensor_type: SensorType;
  location: string;
  mount_height: number;
  sampling_rate: number;
  online: boolean;
  last_seen: DateTime | null;
}

export type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Extreme";

export interface TowerPoint {
  id: Uuid;
  name: string;
  code: string;
  line_id: Uuid;
  line_name: string;
  index: number;
  geo: GeoCoord;
  height: number;
  foundation_depth: number;
  material: string;
  build_year: number;
  max_wind_speed: number;
  max_ice_thickness: number;
  status: TowerStatus;
  sensors: TowerSensor[];
  camera_ids: Uuid[];
  description: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface TowerSummary {
  id: Uuid;
  name: string;
  code: string;
  line_name: string;
  index: number;
  geo: GeoCoord;
  status: TowerStatus;
  current_wind_speed: number | null;
  current_ice_thickness: number | null;
  current_vibration: number | null;
  risk_level: RiskLevel | null;
}

export interface FftPeak {
  frequency: number;
  magnitude: number;
}

export interface VibrationData {
  id: Uuid;
  tower_id: Uuid;
  sensor_id: Uuid;
  timestamp: DateTime;
  frequency: number;
  amplitude_x: number;
  amplitude_y: number;
  amplitude_z: number;
  velocity: number;
  acceleration: number;
  displacement: number;
  fft_peaks: FftPeak[];
}

export interface WindData {
  id: Uuid;
  tower_id: Uuid;
  sensor_id: Uuid;
  timestamp: DateTime;
  speed: number;
  direction: number;
  gust_speed: number;
  temperature: number | null;
  pressure: number | null;
}

export interface IceSensorData {
  id: Uuid;
  tower_id: Uuid;
  sensor_id: Uuid;
  timestamp: DateTime;
  ice_thickness: number;
  ice_weight: number | null;
  temperature: number;
  humidity: number;
  precipitation: number;
}

export interface StrainData {
  id: Uuid;
  tower_id: Uuid;
  sensor_id: Uuid;
  timestamp: DateTime;
  strain_value: number;
  stress_value: number;
  load_value: number | null;
  temperature: number;
}

export type PrecipitationType =
  | "None"
  | "Rain"
  | "Drizzle"
  | "Snow"
  | "Sleet"
  | "FreezingRain"
  | "Hail"
  | "Mixed";

export interface WeatherData {
  id: Uuid;
  tower_id: Uuid;
  timestamp: DateTime;
  temperature_c: number;
  feels_like_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  wind_gust_ms: number;
  precipitation_mm: number;
  precipitation_type: PrecipitationType;
  snow_depth_cm: number | null;
  cloud_cover_pct: number | null;
  visibility_km: number | null;
  source: string;
}

export interface RealTimeMetrics {
  tower_id: Uuid;
  timestamp: DateTime;
  vibration_acceleration: number | null;
  vibration_frequency: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  ice_thickness: number | null;
  temperature: number | null;
  humidity: number | null;
  strain_max: number | null;
}

export type RiskTrend = "Decreasing" | "Stable" | "Increasing" | "RapidlyIncreasing";

export interface IcingRiskAssessment {
  id: Uuid;
  tower_id: Uuid;
  assessment_time: DateTime;
  ice_thickness: number;
  ice_thickness_trend: RiskTrend;
  wind_speed: number;
  wind_speed_trend: RiskTrend;
  vibration_level: number;
  vibration_trend: RiskTrend;
  temperature: number;
  humidity: number;
  composite_score: number;
  risk_level: RiskLevel;
  contributing_factors: string[];
  ice_type_estimate: string;
  estimated_load: number;
  load_percentage: number;
  recommendations: string[];
  reviewed: boolean;
  reviewer_id: Uuid | null;
}

export type RiskEventType =
  | "VibrationThresholdExceeded"
  | "WindSpeedThresholdExceeded"
  | "IceThicknessThresholdExceeded"
  | "LoadThresholdExceeded"
  | "CombinedRiskThreshold"
  | "RapidIceGrowth"
  | "ResonanceDetected"
  | "SensorAnomaly"
  | "WeatherAlert";

export interface RiskEvent {
  id: Uuid;
  tower_id: Uuid;
  event_time: DateTime;
  event_type: RiskEventType;
  severity: RiskLevel;
  description: string;
  threshold_value: number;
  actual_value: number;
  unit: string;
  acknowledged: boolean;
  acknowledged_by: Uuid | null;
  acknowledged_at: DateTime | null;
  resolved: boolean;
  resolved_at: DateTime | null;
  resolution_note: string | null;
}

export type DecisionType = "Advisory" | "Recommended" | "Mandatory" | "Emergency";
export type DecisionPriority = "Informational" | "Low" | "Medium" | "High" | "Critical";
export type DecisionStatus = "Draft" | "PendingApproval" | "Approved" | "Rejected" | "Executed" | "Cancelled" | "Expired";

export interface DecisionReason {
  code: string;
  metric: string;
  threshold: number;
  actual: number;
  severity: RiskLevel;
  description: string;
}

export type OperationalImpact =
  | "NoImpact"
  | "Delay10Min"
  | "Delay30Min"
  | "Delay1Hour"
  | "Delay2Hours"
  | "Indefinite";

export interface PassengerHandling {
  unload_passengers: boolean;
  hold_in_stations: boolean;
  ground_transport_arranged: boolean;
  estimated_wait_minutes: number;
}

export interface ShutdownDecision {
  id: Uuid;
  tower_id: Uuid;
  decision_time: DateTime;
  decision_type: DecisionType;
  priority: DecisionPriority;
  trigger_reasons: DecisionReason[];
  risk_evidence: Uuid[];
  recommended_action: any;
  estimated_duration_minutes: number;
  affected_sections: string[];
  passenger_handling: PassengerHandling;
  estimated_impact: OperationalImpact;
  auto_generated: boolean;
  status: DecisionStatus;
  approver_id: Uuid | null;
  approved_at: DateTime | null;
  comments: string | null;
  executed: boolean;
  executed_at: DateTime | null;
  executor_id: Uuid | null;
}

export type InspectionType =
  | "Routine"
  | "PostStorm"
  | "PostIcing"
  | "ScheduledMaintenance"
  | "EmergencyInspection"
  | "Annual";

export type InspectionStatus = "Scheduled" | "InProgress" | "Completed" | "Cancelled" | "RequiresFollowUp";
export type ConditionRating = "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
export type FindingSeverity = "Cosmetic" | "Minor" | "Moderate" | "Major" | "SafetyCritical";

export interface InspectionRecord {
  id: Uuid;
  tower_id: Uuid;
  inspection_type: InspectionType;
  inspector_id: Uuid;
  inspector_name: string;
  planned_date: DateTime;
  started_at: DateTime | null;
  completed_at: DateTime | null;
  status: InspectionStatus;
  findings: any[];
  overall_condition: ConditionRating;
  ice_observation: any;
  structural_checks: any;
  sensor_calibration: any[];
  maintenance_actions: any[];
  photos: any[];
  weather_conditions: string;
  notes: string | null;
  follow_up_required: boolean;
  follow_up_date: DateTime | null;
  signed_off: boolean;
  signed_off_by: Uuid | null;
  signed_off_at: DateTime | null;
}

export type CameraLocation = "Top" | "Middle" | "Base" | "CrossArm" | "CableSaddle" | "Surrounding";

export interface CameraDevice {
  id: Uuid;
  tower_id: Uuid;
  name: string;
  model: string;
  ip_address: string;
  rtsp_url: string;
  hls_url: string | null;
  location: CameraLocation;
  fov_degrees: number;
  resolution: string;
  night_vision: boolean;
  ptz_capable: boolean;
  online: boolean;
  last_heartbeat: DateTime | null;
  stream_active: boolean;
  recording_enabled: boolean;
  created_at: DateTime;
}

export type VerificationPriority = "Routine" | "Normal" | "High" | "Urgent" | "Emergency";
export type VerificationStatus = "Pending" | "InProgress" | "Completed" | "Cancelled" | "TimedOut";
export type VerificationVerdict = "Confirmed" | "FalseAlarm" | "Inconclusive" | "PartiallyConfirmed";

export interface VideoVerificationRequest {
  id: Uuid;
  tower_id: Uuid;
  risk_event_id: Uuid | null;
  risk_assessment_id: Uuid | null;
  created_at: DateTime;
  priority: VerificationPriority;
  requested_by: Uuid | null;
  request_reason: string;
  status: VerificationStatus;
  camera_ids: Uuid[];
  verifications: any[];
  assigned_to: Uuid | null;
  completed_at: DateTime | null;
  final_verdict: VerificationVerdict | null;
  notes: string | null;
}

export type WeatherAlertType =
  | "Blizzard"
  | "IceStorm"
  | "HighWind"
  | "ExtremeCold"
  | "HeavySnow"
  | "FreezingRain"
  | "Thunderstorm"
  | "Tornado"
  | "DenseFog"
  | "Avalanche"
  | "GeneralWarning";

export type AlertSeverity = "Minor" | "Moderate" | "Severe" | "Extreme";
export type AlertCertainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";

export interface WeatherAlert {
  id: Uuid;
  tower_id: Uuid;
  alert_time: DateTime;
  alert_type: WeatherAlertType;
  severity: AlertSeverity;
  headline: string;
  description: string;
  affected_area: string;
  valid_from: DateTime;
  valid_to: DateTime;
  certainty: AlertCertainty;
  response_required: boolean;
  acknowledged: boolean;
}

export interface HourlyForecast {
  time: DateTime;
  temperature_c: number;
  humidity_pct: number;
  wind_speed_ms: number;
  wind_gust_ms: number;
  wind_direction_deg: number;
  precipitation_prob_pct: number;
  precipitation_mm: number;
  precipitation_type: PrecipitationType;
  snow_cm: number;
  icing_probability_pct: number;
}

export interface WeatherForecast {
  id: Uuid;
  tower_id: Uuid;
  forecast_time: DateTime;
  valid_from: DateTime;
  valid_to: DateTime;
  forecasts: HourlyForecast[];
  issued_by: string;
}

export interface WeatherImpactReport {
  id: Uuid;
  report_time: DateTime;
  period_start: DateTime;
  period_end: DateTime;
  tower_id: Uuid;
  total_shutdown_hours: number;
  partial_shutdown_hours: number;
  reduced_speed_hours: number;
  ice_accumulation_max_mm: number;
  max_wind_speed_ms: number;
  min_temp_c: number;
  total_snowfall_cm: number;
  significant_events: string[];
  operational_notes: string;
  economic_impact_estimate: number | null;
}

export interface EmergencyStrategy {
  id: Uuid;
  name: string;
  trigger_conditions: any[];
  actions: any[];
  escalation_rules: any[];
  enabled: boolean;
  version: number;
  created_at: DateTime;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  timestamp: DateTime;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  generated_at: DateTime;
  total_towers: number;
  towers_online: number;
  risk_breakdown: [number, number, number, number, number];
  active_risk_events: number;
  pending_decisions: number;
  weather_alerts: number;
  ws_clients: number;
  avg_risk_score: number;
  summaries: TowerSummary[];
  top_high_risk: TowerSummary[];
}

export type WsMessageType =
  | "vibration"
  | "wind"
  | "ice"
  | "strain"
  | "weather"
  | "risk_assessment"
  | "risk_event"
  | "decision"
  | "metrics_update"
  | "batch_update"
  | "server_status"
  | "hello"
  | "error"
  | "ack";

export interface WsEnvelope {
  type: WsMessageType;
  [key: string]: any;
}
