use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HasTimestamp, HasTowerId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationData {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub sensor_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub frequency: f64,
    pub amplitude_x: f64,
    pub amplitude_y: f64,
    pub amplitude_z: f64,
    pub velocity: f64,
    pub acceleration: f64,
    pub displacement: f64,
    pub fft_peaks: Vec<FftPeak>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FftPeak {
    pub frequency: f64,
    pub magnitude: f64,
}

impl HasTimestamp for VibrationData {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for VibrationData {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindData {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub sensor_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub speed: f64,
    pub direction: f64,
    pub gust_speed: f64,
    pub temperature: Option<f64>,
    pub pressure: Option<f64>,
}

impl HasTimestamp for WindData {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for WindData {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceSensorData {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub sensor_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub ice_thickness: f64,
    pub ice_weight: Option<f64>,
    pub temperature: f64,
    pub humidity: f64,
    pub precipitation: f64,
}

impl HasTimestamp for IceSensorData {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for IceSensorData {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrainData {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub sensor_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub strain_value: f64,
    pub stress_value: f64,
    pub load_value: Option<f64>,
    pub temperature: f64,
}

impl HasTimestamp for StrainData {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for StrainData {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub reading_id: Uuid,
    pub tower_id: Uuid,
    pub sensor_id: Uuid,
    pub sensor_type: String,
    pub timestamp: DateTime<Utc>,
    pub values: serde_json::Value,
}

impl HasTimestamp for SensorReading {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for SensorReading {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealTimeMetrics {
    pub tower_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub vibration_acceleration: Option<f64>,
    pub vibration_frequency: Option<f64>,
    pub wind_speed: Option<f64>,
    pub wind_direction: Option<f64>,
    pub ice_thickness: Option<f64>,
    pub temperature: Option<f64>,
    pub humidity: Option<f64>,
    pub strain_max: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationStats {
    pub tower_id: Uuid,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub max_amplitude: f64,
    pub avg_amplitude: f64,
    pub rms_amplitude: f64,
    pub dominant_frequency: f64,
    pub sample_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindStats {
    pub tower_id: Uuid,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub max_speed: f64,
    pub avg_speed: f64,
    pub gust_max: f64,
    pub dominant_direction: f64,
    pub sample_count: u64,
}
