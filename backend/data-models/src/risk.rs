use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HasTimestamp, HasTowerId, RiskLevel};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IcingRiskAssessment {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub assessment_time: DateTime<Utc>,
    pub ice_thickness: f64,
    pub ice_thickness_trend: RiskTrend,
    pub wind_speed: f64,
    pub wind_speed_trend: RiskTrend,
    pub vibration_level: f64,
    pub vibration_trend: RiskTrend,
    pub temperature: f64,
    pub humidity: f64,
    pub composite_score: f64,
    pub risk_level: RiskLevel,
    pub contributing_factors: Vec<String>,
    pub ice_type_estimate: String,
    pub estimated_load: f64,
    pub load_percentage: f64,
    pub recommendations: Vec<String>,
    pub reviewed: bool,
    pub reviewer_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskTrend {
    Decreasing,
    Stable,
    Increasing,
    RapidlyIncreasing,
}

impl HasTimestamp for IcingRiskAssessment {
    fn timestamp(&self) -> DateTime<Utc> { self.assessment_time }
}

impl HasTowerId for IcingRiskAssessment {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskEvent {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub event_time: DateTime<Utc>,
    pub event_type: RiskEventType,
    pub severity: RiskLevel,
    pub description: String,
    pub threshold_value: f64,
    pub actual_value: f64,
    pub unit: String,
    pub acknowledged: bool,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolution_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskEventType {
    VibrationThresholdExceeded,
    WindSpeedThresholdExceeded,
    IceThicknessThresholdExceeded,
    LoadThresholdExceeded,
    CombinedRiskThreshold,
    RapidIceGrowth,
    ResonanceDetected,
    SensorAnomaly,
    WeatherAlert,
}

impl HasTimestamp for RiskEvent {
    fn timestamp(&self) -> DateTime<Utc> { self.event_time }
}

impl HasTowerId for RiskEvent {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdConfig {
    pub id: Uuid,
    pub tower_id: Option<Uuid>,
    pub metric_type: String,
    pub warning_low: Option<f64>,
    pub warning_high: f64,
    pub critical_high: f64,
    pub extreme_high: f64,
    pub duration_seconds: u32,
    pub enabled: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskSummary {
    pub tower_id: Uuid,
    pub summary_time: DateTime<Utc>,
    pub overall_risk: RiskLevel,
    pub active_events: u32,
    pub last_24h_max_risk: RiskLevel,
    pub risk_trend: RiskTrend,
    pub ice_risk_score: f64,
    pub wind_risk_score: f64,
    pub vibration_risk_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherImpactAnalysis {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub analysis_time: DateTime<Utc>,
    pub weather_event: WeatherEventType,
    pub event_start: DateTime<Utc>,
    pub event_end: Option<DateTime<Utc>>,
    pub affected_towers: Vec<Uuid>,
    pub estimated_duration_hours: f64,
    pub operational_impact: OperationalImpact,
    pub revenue_loss_estimate: Option<f64>,
    public_safety_concern: bool,
    pub mitigation_measures: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WeatherEventType {
    Snowstorm,
    FreezingRain,
    HighWind,
    Thunderstorm,
    ColdWave,
    HeavySnow,
    MixedPrecipitation,
    Fog,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationalImpact {
    Minimal,
    ReducedSpeed,
    SelectiveClosure,
    FullClosure,
    Evacuation,
}
