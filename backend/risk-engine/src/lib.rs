use chrono::{Duration, Utc};
use dashmap::DashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use data_models::*;

pub const RISK_PUBLISH_SUBJECT: &str = "risk.assessment";
pub const EVENT_PUBLISH_SUBJECT: &str = "risk.event";

pub struct RiskEngine {
    nats: async_nats::Client,
    tower_contexts: DashMap<Uuid, RwLock<TowerRiskContext>>,
    thresholds: RiskThresholds,
}

#[derive(Clone)]
pub struct RiskThresholds {
    pub ice_warning_mm: f64,
    pub ice_critical_mm: f64,
    pub ice_extreme_mm: f64,
    pub wind_warning_ms: f64,
    pub wind_critical_ms: f64,
    pub wind_extreme_ms: f64,
    pub vib_warning_mm_s2: f64,
    pub vib_critical_mm_s2: f64,
    pub vib_extreme_mm_s2: f64,
    pub load_warning_pct: f64,
    pub load_critical_pct: f64,
    pub load_extreme_pct: f64,
    pub ice_growth_rapid_mm_h: f64,
    pub duration_window_minutes: i64,
}

impl Default for RiskThresholds {
    fn default() -> Self {
        Self {
            ice_warning_mm: 10.0,
            ice_critical_mm: 25.0,
            ice_extreme_mm: 40.0,
            wind_warning_ms: 12.0,
            wind_critical_ms: 18.0,
            wind_extreme_ms: 25.0,
            vib_warning_mm_s2: 12.0,
            vib_critical_mm_s2: 25.0,
            vib_extreme_mm_s2: 40.0,
            load_warning_pct: 60.0,
            load_critical_pct: 80.0,
            load_extreme_pct: 95.0,
            ice_growth_rapid_mm_h: 5.0,
            duration_window_minutes: 30,
        }
    }
}

struct TowerRiskContext {
    tower: TowerPoint,
    vibration_window: VecDeque<VibrationData>,
    wind_window: VecDeque<WindData>,
    ice_window: VecDeque<IceSensorData>,
    strain_window: VecDeque<StrainData>,
    weather_window: VecDeque<WeatherData>,
    current_risk: Option<IcingRiskAssessment>,
    active_events: Vec<RiskEvent>,
    last_event_check: chrono::DateTime<Utc>,
}

impl TowerRiskContext {
    fn new(tower: TowerPoint) -> Self {
        Self {
            tower,
            vibration_window: VecDeque::with_capacity(1000),
            wind_window: VecDeque::with_capacity(1000),
            ice_window: VecDeque::with_capacity(1000),
            strain_window: VecDeque::with_capacity(1000),
            weather_window: VecDeque::with_capacity(500),
            current_risk: None,
            active_events: Vec::new(),
            last_event_check: Utc::now(),
        }
    }

    fn purge_old(&mut self, max_age: Duration) {
        let cutoff = Utc::now() - max_age;
        while self.vibration_window.front().map(|d| d.timestamp < cutoff).unwrap_or(false) {
            self.vibration_window.pop_front();
        }
        while self.wind_window.front().map(|d| d.timestamp < cutoff).unwrap_or(false) {
            self.wind_window.pop_front();
        }
        while self.ice_window.front().map(|d| d.timestamp < cutoff).unwrap_or(false) {
            self.ice_window.pop_front();
        }
        while self.strain_window.front().map(|d| d.timestamp < cutoff).unwrap_or(false) {
            self.strain_window.pop_front();
        }
        while self.weather_window.front().map(|d| d.timestamp < cutoff).unwrap_or(false) {
            self.weather_window.pop_front();
        }
    }
}

impl RiskEngine {
    pub fn new(nats: async_nats::Client, thresholds: RiskThresholds) -> Self {
        Self {
            nats,
            tower_contexts: DashMap::new(),
            thresholds,
        }
    }

    pub fn register_tower(&self, tower: TowerPoint) {
        self.tower_contexts.insert(
            tower.id,
            RwLock::new(TowerRiskContext::new(tower.clone())),
        );
        info!("Registered tower {} in risk engine", tower.code);
    }

    pub fn ingest_vibration(&self, data: VibrationData) {
        if let Some(ctx) = self.tower_contexts.get(&data.tower_id) {
            let mut c = ctx.write();
            c.vibration_window.push_back(data);
            c.purge_old(Duration::hours(6));
        }
    }

    pub fn ingest_wind(&self, data: WindData) {
        if let Some(ctx) = self.tower_contexts.get(&data.tower_id) {
            let mut c = ctx.write();
            c.wind_window.push_back(data);
            c.purge_old(Duration::hours(6));
        }
    }

    pub fn ingest_ice(&self, data: IceSensorData) {
        if let Some(ctx) = self.tower_contexts.get(&data.tower_id) {
            let mut c = ctx.write();
            c.ice_window.push_back(data);
            c.purge_old(Duration::hours(12));
        }
    }

    pub fn ingest_strain(&self, data: StrainData) {
        if let Some(ctx) = self.tower_contexts.get(&data.tower_id) {
            let mut c = ctx.write();
            c.strain_window.push_back(data);
            c.purge_old(Duration::hours(6));
        }
    }

    pub fn ingest_weather(&self, data: WeatherData) {
        if let Some(ctx) = self.tower_contexts.get(&data.tower_id) {
            let mut c = ctx.write();
            c.weather_window.push_back(data);
            c.purge_old(Duration::hours(24));
        }
    }

    pub async fn evaluate_tower(&self, tower_id: Uuid) -> Option<IcingRiskAssessment> {
        let ctx = self.tower_contexts.get(&tower_id)?;
        let mut c = ctx.write();

        let latest_vib = c.vibration_window.back().cloned();
        let latest_wind = c.wind_window.back().cloned();
        let latest_ice = c.ice_window.back().cloned();
        let latest_strain = c.strain_window.back().cloned();
        let latest_weather = c.weather_window.back().cloned();

        let avg_vib_accel = avg_n(&c.vibration_window.iter().rev().take(30).map(|v| v.acceleration).collect::<Vec<_>>());
        let avg_wind = avg_n(&c.wind_window.iter().rev().take(30).map(|w| w.speed).collect::<Vec<_>>());
        let max_ice = c.ice_window.iter().rev().take(60).map(|i| i.ice_thickness).fold(0.0_f64, f64::max);
        let avg_temp = avg_n(&c.weather_window.iter().rev().take(60).map(|w| w.temperature_c).collect::<Vec<_>>());
        let avg_humidity = avg_n(&c.weather_window.iter().rev().take(60).map(|w| w.humidity_pct).collect::<Vec<_>>());

        let ice_growth_rate = calculate_ice_growth_rate(&c.ice_window);
        let load_pct = calculate_load_percentage(max_ice, avg_wind, avg_vib_accel, &c.tower);

        let mut factors: Vec<String> = Vec::new();
        let mut ice_score = 0.0;
        let mut wind_score = 0.0;
        let mut vib_score = 0.0;
        let mut load_score = 0.0;

        if max_ice > self.thresholds.ice_warning_mm { ice_score += 25.0; factors.push(format!("覆冰厚度 {:.1}mm 超过警戒阈值", max_ice)); }
        if max_ice > self.thresholds.ice_critical_mm { ice_score += 25.0; factors.push(format!("覆冰厚度 {:.1}mm 超过危急阈值", max_ice)); }
        if max_ice > self.thresholds.ice_extreme_mm { ice_score += 20.0; factors.push(format!("覆冰厚度 {:.1}mm 超过极限阈值", max_ice)); }
        if ice_growth_rate > self.thresholds.ice_growth_rapid_mm_h {
            ice_score += 15.0;
            factors.push(format!("覆冰增长速率 {:.2}mm/h 过快", ice_growth_rate));
        }

        if avg_wind > self.thresholds.wind_warning_ms { wind_score += 20.0; factors.push(format!("风速 {:.1}m/s 超过警戒阈值", avg_wind)); }
        if avg_wind > self.thresholds.wind_critical_ms { wind_score += 20.0; factors.push(format!("风速 {:.1}m/s 超过危急阈值", avg_wind)); }
        if avg_wind > self.thresholds.wind_extreme_ms { wind_score += 20.0; factors.push(format!("风速 {:.1}m/s 超过极限阈值", avg_wind)); }

        if avg_vib_accel > self.thresholds.vib_warning_mm_s2 { vib_score += 20.0; factors.push(format!("振动加速度 {:.1}mm/s² 超过警戒阈值", avg_vib_accel)); }
        if avg_vib_accel > self.thresholds.vib_critical_mm_s2 { vib_score += 25.0; factors.push(format!("振动加速度 {:.1}mm/s² 超过危急阈值", avg_vib_accel)); }
        if avg_vib_accel > self.thresholds.vib_extreme_mm_s2 { vib_score += 25.0; factors.push(format!("振动加速度 {:.1}mm/s² 超过极限阈值", avg_vib_accel)); }

        if load_pct > self.thresholds.load_warning_pct { load_score += 15.0; factors.push(format!("承载率 {:.1}% 超过警戒阈值", load_pct)); }
        if load_pct > self.thresholds.load_critical_pct { load_score += 20.0; factors.push(format!("承载率 {:.1}% 超过危急阈值", load_pct)); }
        if load_pct > self.thresholds.load_extreme_pct { load_score += 25.0; factors.push(format!("承载率 {:.1}% 超过极限阈值", load_pct)); }

        let combo = if max_ice > self.thresholds.ice_warning_mm && avg_wind > self.thresholds.wind_warning_ms {
            factors.push("冰风组合效应加剧风险".to_string());
            20.0
        } else { 0.0 };

        let composite = (ice_score + wind_score + vib_score + load_score + combo).min(100.0);
        let risk_level = score_to_risk_level(composite);

        let ice_type = estimate_ice_type(avg_temp.unwrap_or(0.0), avg_humidity.unwrap_or(0.0));
        let est_load = estimate_total_load(max_ice, avg_wind, &c.tower);

        let mut recommendations: Vec<String> = Vec::new();
        match risk_level {
            RiskLevel::Safe => {
                recommendations.push("正常运行，持续监测".to_string());
            }
            RiskLevel::Low => {
                recommendations.push("持续密切关注各项指标变化".to_string());
                recommendations.push("准备预防性除冰物资".to_string());
            }
            RiskLevel::Medium => {
                recommendations.push("考虑降低索道运行速度至70%".to_string());
                recommendations.push("缩短巡检间隔至2小时".to_string());
                recommendations.push("通知运营值班人员".to_string());
            }
            RiskLevel::High => {
                recommendations.push("降低运行速度至50%或减载运行".to_string());
                recommendations.push("启动实时视频复核流程".to_string());
                recommendations.push("准备启动除冰作业".to_string());
                recommendations.push("通知站务人员做好限流准备".to_string());
            }
            RiskLevel::Extreme => {
                recommendations.push("立即停运相关区段索道".to_string());
                recommendations.push("紧急组织现场人工核查".to_string());
                recommendations.push("启动应急响应预案".to_string());
                recommendations.push("疏散在途乘客至安全站点".to_string());
            }
        }

        let assessment = IcingRiskAssessment {
            id: Uuid::new_v4(),
            tower_id,
            assessment_time: Utc::now(),
            ice_thickness: max_ice,
            ice_thickness_trend: trend_from_rate(ice_growth_rate),
            wind_speed: avg_wind,
            wind_speed_trend: calculate_wind_trend(&c.wind_window),
            vibration_level: avg_vib_accel,
            vibration_trend: calculate_vibration_trend(&c.vibration_window),
            temperature: avg_temp.unwrap_or(-999.0),
            humidity: avg_humidity.unwrap_or(0.0),
            composite_score: composite,
            risk_level: risk_level.clone(),
            contributing_factors: factors,
            ice_type_estimate: ice_type,
            estimated_load: est_load,
            load_percentage: load_pct,
            recommendations,
            reviewed: false,
            reviewer_id: None,
        };

        c.current_risk = Some(assessment.clone());
        c.last_event_check = assessment.assessment_time;

        debug!("Risk evaluated for tower {}: score={:.1} level={:?}",
            c.tower.code, composite, risk_level);

        Some(assessment)
    }

    pub async fn evaluate_all(&self) -> Vec<IcingRiskAssessment> {
        let ids: Vec<Uuid> = self.tower_contexts.iter().map(|r| *r.key()).collect();
        let mut results = Vec::new();
        for id in ids {
            if let Some(a) = self.evaluate_tower(id).await {
                results.push(a);
            }
        }
        results
    }

    pub async fn detect_events(&self, tower_id: Uuid) -> Vec<RiskEvent> {
        let mut events = Vec::new();
        let Some(ctx) = self.tower_contexts.get(&tower_id) else { return events };
        let c = ctx.read();
        let now = Utc::now();

        if let Some(last_wind) = c.wind_window.back() {
            if last_wind.gust_speed > self.thresholds.wind_extreme_ms {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::WindSpeedThresholdExceeded,
                    severity: RiskLevel::Extreme,
                    description: format!("瞬时风速 {:.1}m/s 超过极限值", last_wind.gust_speed),
                    threshold_value: self.thresholds.wind_extreme_ms,
                    actual_value: last_wind.gust_speed,
                    unit: "m/s".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            } else if last_wind.speed > self.thresholds.wind_critical_ms {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::WindSpeedThresholdExceeded,
                    severity: RiskLevel::High,
                    description: format!("持续风速 {:.1}m/s 超过危急值", last_wind.speed),
                    threshold_value: self.thresholds.wind_critical_ms,
                    actual_value: last_wind.speed,
                    unit: "m/s".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            }
        }

        if let Some(last_ice) = c.ice_window.back() {
            if last_ice.ice_thickness > self.thresholds.ice_extreme_mm {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::IceThicknessThresholdExceeded,
                    severity: RiskLevel::Extreme,
                    description: format!("覆冰厚度 {:.1}mm 超过极限值", last_ice.ice_thickness),
                    threshold_value: self.thresholds.ice_extreme_mm,
                    actual_value: last_ice.ice_thickness,
                    unit: "mm".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            }
            let growth = calculate_ice_growth_rate(&c.ice_window);
            if growth > self.thresholds.ice_growth_rapid_mm_h {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::RapidIceGrowth,
                    severity: RiskLevel::High,
                    description: format!("覆冰快速增长 {:.2}mm/h", growth),
                    threshold_value: self.thresholds.ice_growth_rapid_mm_h,
                    actual_value: growth,
                    unit: "mm/h".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            }
        }

        if let Some(last_vib) = c.vibration_window.back() {
            if last_vib.acceleration > self.thresholds.vib_extreme_mm_s2 {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::VibrationThresholdExceeded,
                    severity: RiskLevel::Extreme,
                    description: format!("振动加速度 {:.1}mm/s² 超限", last_vib.acceleration),
                    threshold_value: self.thresholds.vib_extreme_mm_s2,
                    actual_value: last_vib.acceleration,
                    unit: "mm/s²".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            }
            if detect_resonance(&c.vibration_window) {
                events.push(RiskEvent {
                    id: Uuid::new_v4(),
                    tower_id,
                    event_time: now,
                    event_type: RiskEventType::ResonanceDetected,
                    severity: RiskLevel::High,
                    description: "检测到潜在共振频率，振动能量异常集中".to_string(),
                    threshold_value: 0.6,
                    actual_value: 0.0,
                    unit: "ratio".to_string(),
                    acknowledged: false,
                    acknowledged_by: None,
                    acknowledged_at: None,
                    resolved: false,
                    resolved_at: None,
                    resolution_note: None,
                });
            }
        }

        events
    }

    pub async fn publish_assessment(&self, assessment: &IcingRiskAssessment) -> anyhow::Result<()> {
        let subject = format!("{}.{}", RISK_PUBLISH_SUBJECT, assessment.tower_id);
        let payload = serde_json::to_vec(assessment)?;
        self.nats.publish(subject, payload.into()).await?;
        let all = format!("{}.all", RISK_PUBLISH_SUBJECT);
        self.nats.publish(all, payload.into()).await?;
        Ok(())
    }

    pub async fn publish_event(&self, event: &RiskEvent) -> anyhow::Result<()> {
        let subject = format!("{}.{}", EVENT_PUBLISH_SUBJECT, event.tower_id);
        let payload = serde_json::to_vec(event)?;
        self.nats.publish(subject, payload.into()).await?;
        let all = format!("{}.all", EVENT_PUBLISH_SUBJECT);
        self.nats.publish(all, payload.into()).await?;
        Ok(())
    }

    pub fn current_risk(&self, tower_id: Uuid) -> Option<IcingRiskAssessment> {
        self.tower_contexts.get(&tower_id)?.read().current_risk.clone()
    }

    pub fn realtime_metrics(&self, tower_id: Uuid) -> Option<RealTimeMetrics> {
        let c = self.tower_contexts.get(&tower_id)?;
        let ctx = c.read();
        Some(RealTimeMetrics {
            tower_id,
            timestamp: Utc::now(),
            vibration_acceleration: ctx.vibration_window.back().map(|v| v.acceleration),
            vibration_frequency: ctx.vibration_window.back().map(|v| v.frequency),
            wind_speed: ctx.wind_window.back().map(|w| w.speed),
            wind_direction: ctx.wind_window.back().map(|w| w.direction),
            ice_thickness: ctx.ice_window.back().map(|i| i.ice_thickness),
            temperature: ctx.weather_window.back().map(|w| w.temperature_c),
            humidity: ctx.weather_window.back().map(|w| w.humidity_pct),
            strain_max: ctx.strain_window.iter().rev().take(10).map(|s| s.strain_value).max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)),
        })
    }
}

fn avg_n(values: &[f64]) -> f64 {
    if values.is_empty() { return 0.0; }
    values.iter().sum::<f64>() / values.len() as f64
}

fn score_to_risk_level(score: f64) -> RiskLevel {
    if score >= 80.0 { RiskLevel::Extreme }
    else if score >= 60.0 { RiskLevel::High }
    else if score >= 35.0 { RiskLevel::Medium }
    else if score >= 15.0 { RiskLevel::Low }
    else { RiskLevel::Safe }
}

fn trend_from_rate(rate: f64) -> RiskTrend {
    if rate > 5.0 { RiskTrend::RapidlyIncreasing }
    else if rate > 1.5 { RiskTrend::Increasing }
    else if rate > 0.2 { RiskTrend::Stable }
    else { RiskTrend::Decreasing }
}

fn calculate_ice_growth_rate(window: &VecDeque<IceSensorData>) -> f64 {
    if window.len() < 2 { return 0.0; }
    let latest = window.back().unwrap();
    let n = (window.len() - 1).min(120);
    let old = window.get(window.len() - 1 - n).unwrap();
    let hours = (latest.timestamp - old.timestamp).num_seconds().max(1) as f64 / 3600.0;
    ((latest.ice_thickness - old.ice_thickness).max(0.0)) / hours
}

fn calculate_wind_trend(window: &VecDeque<WindData>) -> RiskTrend {
    if window.len() < 20 { return RiskTrend::Stable; }
    let last10 = avg_n(&window.iter().rev().take(10).map(|w| w.speed).collect::<Vec<_>>());
    let prev10 = avg_n(&window.iter().rev().skip(10).take(10).map(|w| w.speed).collect::<Vec<_>>());
    let diff = (last10 - prev10) / prev10.max(0.1);
    if diff > 0.3 { RiskTrend::RapidlyIncreasing }
    else if diff > 0.08 { RiskTrend::Increasing }
    else if diff < -0.08 { RiskTrend::Decreasing }
    else { RiskTrend::Stable }
}

fn calculate_vibration_trend(window: &VecDeque<VibrationData>) -> RiskTrend {
    if window.len() < 20 { return RiskTrend::Stable; }
    let last10 = avg_n(&window.iter().rev().take(10).map(|v| v.acceleration).collect::<Vec<_>>());
    let prev10 = avg_n(&window.iter().rev().skip(10).take(10).map(|v| v.acceleration).collect::<Vec<_>>());
    let diff = (last10 - prev10) / prev10.max(0.1);
    if diff > 0.3 { RiskTrend::RapidlyIncreasing }
    else if diff > 0.08 { RiskTrend::Increasing }
    else if diff < -0.08 { RiskTrend::Decreasing }
    else { RiskTrend::Stable }
}

fn detect_resonance(window: &VecDeque<VibrationData>) -> bool {
    if window.len() < 30 { return false; }
    let recent: Vec<_> = window.iter().rev().take(30).collect();
    for v in recent.iter() {
        for peak in &v.fft_peaks {
            if peak.frequency >= 1.15 && peak.frequency <= 1.30 && peak.magnitude > 1.2 {
                return true;
            }
        }
    }
    false
}

fn estimate_ice_type(temp_c: f64, humidity_pct: f64) -> String {
    if humidity_pct > 90.0 && temp_c < -2.0 { "晶凇".to_string() }
    else if humidity_pct > 75.0 && temp_c > -3.0 && temp_c < 0.0 { "雨凇".to_string() }
    else if temp_c <= -5.0 { "混合凇".to_string() }
    else { "软凇".to_string() }
}

fn calculate_load_percentage(ice_mm: f64, wind_ms: f64, vib: f64, tower: &TowerPoint) -> f64 {
    let ice_load = ice_mm * 85.0;
    let wind_load = wind_ms * wind_ms * 12.0;
    let vib_load = vib * 4.0;
    let total = ice_load + wind_load + vib_load;
    let max_design = tower.max_ice_thickness * 100.0 + tower.max_wind_speed * tower.max_wind_speed * 15.0 + 200.0;
    (total / max_design * 100.0).min(120.0)
}

fn estimate_total_load(ice_mm: f64, wind_ms: f64, tower: &TowerPoint) -> f64 {
    let ice_load = ice_mm * 85.0;
    let wind_load = wind_ms * wind_ms * 12.0;
    let structure_weight = tower.height * 45.0;
    ice_load + wind_load + structure_weight
}
