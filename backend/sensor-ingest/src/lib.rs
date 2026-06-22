use chrono::Utc;
use std::collections::HashMap;
use std::time::Duration;
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use data_models::*;

pub mod subjects {
    pub const VIBRATION: &str = "sensor.vibration";
    pub const WIND: &str = "sensor.wind";
    pub const ICE: &str = "sensor.ice";
    pub const STRAIN: &str = "sensor.strain";
    pub const WEATHER: &str = "sensor.weather";
    pub const ALERT: &str = "sensor.alert";
    pub const METRICS_ALL: &str = "metrics.>";
}

pub struct SensorIngestService {
    nats: async_nats::Client,
    active_sensors: HashMap<Uuid, tokio::sync::RwLock<SensorState>>,
}

struct SensorState {
    last_seen: chrono::DateTime<Utc>,
    readings_count: u64,
    last_values: Option<serde_json::Value>,
}

impl SensorIngestService {
    pub fn new(nats: async_nats::Client) -> Self {
        Self {
            nats,
            active_sensors: HashMap::new(),
        }
    }

    pub async fn publish_vibration(&self, data: &VibrationData) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::VIBRATION, data.tower_id);
        let payload = serde_json::to_vec(data)?;
        self.nats.publish(subject, payload.into()).await?;
        self.update_sensor_state(data.sensor_id, &serde_json::json!(data)).await;
        debug!("Published vibration data tower_id={}", data.tower_id);
        Ok(())
    }

    pub async fn publish_wind(&self, data: &WindData) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::WIND, data.tower_id);
        let payload = serde_json::to_vec(data)?;
        self.nats.publish(subject, payload.into()).await?;
        self.update_sensor_state(data.sensor_id, &serde_json::json!(data)).await;
        debug!("Published wind data tower_id={}", data.tower_id);
        Ok(())
    }

    pub async fn publish_ice(&self, data: &IceSensorData) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::ICE, data.tower_id);
        let payload = serde_json::to_vec(data)?;
        self.nats.publish(subject, payload.into()).await?;
        self.update_sensor_state(data.sensor_id, &serde_json::json!(data)).await;
        debug!("Published ice data tower_id={}", data.tower_id);
        Ok(())
    }

    pub async fn publish_strain(&self, data: &StrainData) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::STRAIN, data.tower_id);
        let payload = serde_json::to_vec(data)?;
        self.nats.publish(subject, payload.into()).await?;
        self.update_sensor_state(data.sensor_id, &serde_json::json!(data)).await;
        debug!("Published strain data tower_id={}", data.tower_id);
        Ok(())
    }

    pub async fn publish_weather(&self, data: &WeatherData) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::WEATHER, data.tower_id);
        let payload = serde_json::to_vec(data)?;
        self.nats.publish(subject, payload.into()).await?;
        debug!("Published weather data tower_id={}", data.tower_id);
        Ok(())
    }

    pub async fn publish_risk_event(&self, event: &RiskEvent) -> anyhow::Result<()> {
        let subject = format!("{}.{}", subjects::ALERT, event.tower_id);
        let payload = serde_json::to_vec(event)?;
        self.nats.publish(subject, payload.into()).await?;
        warn!("Published risk event tower_id={} type={:?} severity={:?}",
            event.tower_id, event.event_type, event.severity);
        Ok(())
    }

    async fn update_sensor_state(&self, sensor_id: Uuid, values: &serde_json::Value) {
        if let Some(state) = self.active_sensors.get(&sensor_id) {
            let mut s = state.write().await;
            s.last_seen = Utc::now();
            s.readings_count += 1;
            s.last_values = Some(values.clone());
        }
    }

    pub fn register_sensor(&mut self, sensor_id: Uuid) {
        self.active_sensors.insert(
            sensor_id,
            tokio::sync::RwLock::new(SensorState {
                last_seen: Utc::now(),
                readings_count: 0,
                last_values: None,
            }),
        );
    }

    pub async fn start_sensor_simulator(&self, towers: Vec<TowerPoint>) -> JoinHandle<()> {
        let nats = self.nats.clone();
        let handle = tokio::spawn(async move {
            info!("Starting sensor simulator for {} towers", towers.len());
            let mut interval = tokio::time::interval(Duration::from_secs(2));
            let mut tick: u64 = 0;

            loop {
                interval.tick().await;
                tick += 1;

                for tower in &towers {
                    for sensor in &tower.sensors {
                        let now = Utc::now();
                        match sensor.sensor_type {
                            SensorType::Accelerometer | SensorType::VelocityMeter => {
                                let wind_adj = simulate_wind_factor(tick, tower.id);
                                let vib = VibrationData {
                                    id: Uuid::new_v4(),
                                    tower_id: tower.id,
                                    sensor_id: sensor.id,
                                    timestamp: now,
                                    frequency: 1.2 + (tick % 10) as f64 * 0.05,
                                    amplitude_x: (0.5 + wind_adj * 2.0) * (0.8 + rand_01() * 0.4),
                                    amplitude_y: (0.3 + wind_adj * 1.5) * (0.8 + rand_01() * 0.4),
                                    amplitude_z: (0.2 + wind_adj * 1.0) * (0.8 + rand_01() * 0.4),
                                    velocity: (0.8 + wind_adj * 3.0),
                                    acceleration: (1.5 + wind_adj * 5.0 + rand_01() * 2.0),
                                    displacement: (0.002 + wind_adj * 0.01),
                                    fft_peaks: generate_fft_peaks(tick),
                                };
                                let _ = publish_message(&nats,
                                    format!("{}.{}", subjects::VIBRATION, tower.id),
                                    &vib).await;
                            }
                            SensorType::Anemometer => {
                                let speed = 5.0 + wind_adj * 20.0 + rand_01() * 3.0;
                                let wd = WindData {
                                    id: Uuid::new_v4(),
                                    tower_id: tower.id,
                                    sensor_id: sensor.id,
                                    timestamp: now,
                                    speed,
                                    direction: (tick * 7 + tower.id.as_u128() as u64 % 360) as f64 % 360.0,
                                    gust_speed: speed * (1.2 + rand_01() * 0.6),
                                    temperature: Some(-5.0 + rand_01() * 10.0),
                                    pressure: Some(1013.0 + (rand_01() - 0.5) * 20.0),
                                };
                                let _ = publish_message(&nats,
                                    format!("{}.{}", subjects::WIND, tower.id),
                                    &wd).await;
                            }
                            SensorType::IceThicknessSensor => {
                                let base_ice = (tick % 600) as f64 / 20.0;
                                let ice = IceSensorData {
                                    id: Uuid::new_v4(),
                                    tower_id: tower.id,
                                    sensor_id: sensor.id,
                                    timestamp: now,
                                    ice_thickness: base_ice.min(40.0),
                                    ice_weight: Some(base_ice.min(40.0) * 0.85),
                                    temperature: -8.0 + rand_01() * 5.0,
                                    humidity: 85.0 + rand_01() * 15.0,
                                    precipitation: if tick % 30 < 10 { rand_01() * 2.0 } else { 0.0 },
                                };
                                let _ = publish_message(&nats,
                                    format!("{}.{}", subjects::ICE, tower.id),
                                    &ice).await;
                            }
                            SensorType::StrainGauge => {
                                let ice_load = (tick % 600) as f64 / 20.0 * 5.0;
                                let sd = StrainData {
                                    id: Uuid::new_v4(),
                                    tower_id: tower.id,
                                    sensor_id: sensor.id,
                                    timestamp: now,
                                    strain_value: 120.0 + ice_load * 8.0 + rand_01() * 20.0,
                                    stress_value: 25.0 + ice_load * 1.5 + rand_01() * 5.0,
                                    load_value: Some(8000.0 + ice_load * 500.0 + rand_01() * 1000.0),
                                    temperature: -5.0 + rand_01() * 8.0,
                                };
                                let _ = publish_message(&nats,
                                    format!("{}.{}", subjects::STRAIN, tower.id),
                                    &sd).await;
                            }
                            SensorType::TemperatureSensor | SensorType::HumiditySensor => {
                                let w = WeatherData {
                                    id: Uuid::new_v4(),
                                    tower_id: tower.id,
                                    timestamp: now,
                                    temperature_c: -6.0 + rand_01() * 8.0,
                                    feels_like_c: -10.0 + rand_01() * 8.0,
                                    humidity_pct: 80.0 + rand_01() * 20.0,
                                    pressure_hpa: 1010.0 + (rand_01() - 0.5) * 25.0,
                                    wind_speed_ms: 6.0 + rand_01() * 15.0,
                                    wind_direction_deg: (tick as f64 * 11.3) % 360.0,
                                    wind_gust_ms: 10.0 + rand_01() * 25.0,
                                    precipitation_mm: if tick % 60 < 20 { rand_01() * 3.0 } else { 0.0 },
                                    precipitation_type: if tick % 60 < 5 {
                                        PrecipitationType::FreezingRain
                                    } else if tick % 60 < 20 {
                                        PrecipitationType::Snow
                                    } else {
                                        PrecipitationType::None
                                    },
                                    snow_depth_cm: Some((tick % 1000) as f64 / 20.0),
                                    cloud_cover_pct: Some(70.0 + rand_01() * 30.0),
                                    visibility_km: Some(2.0 + rand_01() * 5.0),
                                    source: "simulator".to_string(),
                                };
                                let _ = publish_message(&nats,
                                    format!("{}.{}", subjects::WEATHER, tower.id),
                                    &w).await;
                            }
                            _ => {}
                        }
                    }
                }

                if tick % 30 == 0 {
                    info!("Sensor simulator tick={}, towers={}", tick, towers.len());
                }
            }
        });
        handle
    }
}

async fn publish_message<T: serde::Serialize>(
    nats: &async_nats::Client,
    subject: String,
    data: &T,
) -> anyhow::Result<()> {
    let payload = serde_json::to_vec(data)?;
    nats.publish(subject, payload.into()).await?;
    Ok(())
}

fn rand_01() -> f64 {
    rand::random::<f64>()
}

fn simulate_wind_factor(tick: u64, tower_id: Uuid) -> f64 {
    let tid = tower_id.as_u128() as u64;
    let cycle = ((tick + tid % 100) % 600) as f64;
    let storm = if cycle > 400.0 {
        ((cycle - 400.0) / 200.0).min(1.0)
    } else {
        0.0
    };
    let wobble = ((tick as f64 * 0.17).sin() * 0.5 + 0.5) * 0.3;
    storm * 0.7 + wobble
}

fn generate_fft_peaks(tick: u64) -> Vec<FftPeak> {
    let seed = (tick % 100) as f64;
    vec![
        FftPeak { frequency: 1.23 + seed * 0.001, magnitude: 0.85 + rand_01() * 0.3 },
        FftPeak { frequency: 2.45 + seed * 0.002, magnitude: 0.45 + rand_01() * 0.2 },
        FftPeak { frequency: 3.68 + seed * 0.001, magnitude: 0.22 + rand_01() * 0.1 },
        FftPeak { frequency: 4.91 + seed * 0.003, magnitude: 0.10 + rand_01() * 0.08 },
    ]
}
