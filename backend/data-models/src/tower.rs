use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TowerStatus {
    Normal,
    Warning,
    Critical,
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoCoord {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerPoint {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub line_id: Uuid,
    pub line_name: String,
    pub index: u32,
    pub geo: GeoCoord,
    pub height: f64,
    pub foundation_depth: f64,
    pub material: String,
    pub build_year: u32,
    pub max_wind_speed: f64,
    pub max_ice_thickness: f64,
    pub status: TowerStatus,
    pub sensors: Vec<TowerSensor>,
    pub camera_ids: Vec<Uuid>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerSensor {
    pub id: Uuid,
    pub sensor_type: SensorType,
    pub location: String,
    pub mount_height: f64,
    pub sampling_rate: f64,
    pub online: bool,
    pub last_seen: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SensorType {
    Accelerometer,
    VelocityMeter,
    DisplacementMeter,
    Anemometer,
    WindVane,
    TemperatureSensor,
    HumiditySensor,
    IceThicknessSensor,
    StrainGauge,
    LoadCell,
}

impl SensorType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SensorType::Accelerometer => "accelerometer",
            SensorType::VelocityMeter => "velocity_meter",
            SensorType::DisplacementMeter => "displacement_meter",
            SensorType::Anemometer => "anemometer",
            SensorType::WindVane => "wind_vane",
            SensorType::TemperatureSensor => "temperature",
            SensorType::HumiditySensor => "humidity",
            SensorType::IceThicknessSensor => "ice_thickness",
            SensorType::StrainGauge => "strain_gauge",
            SensorType::LoadCell => "load_cell",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerSummary {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub line_name: String,
    pub index: u32,
    pub geo: GeoCoord,
    pub status: TowerStatus,
    pub current_wind_speed: Option<f64>,
    pub current_ice_thickness: Option<f64>,
    pub current_vibration: Option<f64>,
    pub risk_level: Option<RiskLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Extreme,
}

impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskLevel::Safe => "safe",
            RiskLevel::Low => "low",
            RiskLevel::Medium => "medium",
            RiskLevel::High => "high",
            RiskLevel::Extreme => "extreme",
        }
    }

    pub fn score(&self) -> u8 {
        match self {
            RiskLevel::Safe => 0,
            RiskLevel::Low => 1,
            RiskLevel::Medium => 2,
            RiskLevel::High => 3,
            RiskLevel::Extreme => 4,
        }
    }

    pub fn from_score(score: u8) -> Self {
        match score {
            0 => RiskLevel::Safe,
            1 => RiskLevel::Low,
            2 => RiskLevel::Medium,
            3 => RiskLevel::High,
            _ => RiskLevel::Extreme,
        }
    }
}
