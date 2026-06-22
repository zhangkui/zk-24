use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HasTimestamp, HasTowerId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherData {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub temperature_c: f64,
    pub feels_like_c: f64,
    pub humidity_pct: f64,
    pub pressure_hpa: f64,
    pub wind_speed_ms: f64,
    pub wind_direction_deg: f64,
    pub wind_gust_ms: f64,
    pub precipitation_mm: f64,
    pub precipitation_type: PrecipitationType,
    pub snow_depth_cm: Option<f64>,
    pub cloud_cover_pct: Option<f64>,
    pub visibility_km: Option<f64>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PrecipitationType {
    None,
    Rain,
    Drizzle,
    Snow,
    Sleet,
    FreezingRain,
    Hail,
    Mixed,
}

impl HasTimestamp for WeatherData {
    fn timestamp(&self) -> DateTime<Utc> { self.timestamp }
}

impl HasTowerId for WeatherData {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherForecast {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub forecast_time: DateTime<Utc>,
    pub valid_from: DateTime<Utc>,
    pub valid_to: DateTime<Utc>,
    pub forecasts: Vec<HourlyForecast>,
    pub issued_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyForecast {
    pub time: DateTime<Utc>,
    pub temperature_c: f64,
    pub humidity_pct: f64,
    pub wind_speed_ms: f64,
    pub wind_gust_ms: f64,
    pub wind_direction_deg: f64,
    pub precipitation_prob_pct: u8,
    pub precipitation_mm: f64,
    pub precipitation_type: PrecipitationType,
    pub snow_cm: f64,
    pub icing_probability_pct: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherAlert {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub alert_time: DateTime<Utc>,
    pub alert_type: WeatherAlertType,
    pub severity: AlertSeverity,
    pub headline: String,
    pub description: String,
    pub affected_area: String,
    pub valid_from: DateTime<Utc>,
    pub valid_to: DateTime<Utc>,
    pub certainty: AlertCertainty,
    pub response_required: bool,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WeatherAlertType {
    Blizzard,
    IceStorm,
    HighWind,
    ExtremeCold,
    HeavySnow,
    FreezingRain,
    Thunderstorm,
    Tornado,
    DenseFog,
    Avalanche,
    GeneralWarning,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Minor,
    Moderate,
    Severe,
    Extreme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertCertainty {
    Observed,
    Likely,
    Possible,
    Unlikely,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherImpactReport {
    pub id: Uuid,
    pub report_time: DateTime<Utc>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub tower_id: Uuid,
    pub total_shutdown_hours: f64,
    pub partial_shutdown_hours: f64,
    pub reduced_speed_hours: f64,
    pub ice_accumulation_max_mm: f64,
    pub max_wind_speed_ms: f64,
    pub min_temp_c: f64,
    pub total_snowfall_cm: f64,
    pub significant_events: Vec<String>,
    pub operational_notes: String,
    pub economic_impact_estimate: Option<f64>,
}
