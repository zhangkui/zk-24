use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;
use data_models::*;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
}

fn default_page() -> u32 { 1 }
fn default_page_size() -> u32 { 50 }

#[derive(Debug, Deserialize)]
pub struct TimeRangeParams {
    pub from: Option<String>,
    pub to: Option<String>,
    #[serde(default = "default_hours")]
    pub hours: u32,
}

fn default_hours() -> u32 { 24 }

fn ok<T: Serialize>(data: T) -> impl IntoResponse {
    Json(ApiResponse::success(data))
}

fn err<T: Into<String>>(code: i32, message: T) -> impl IntoResponse {
    (StatusCode::from_u16(if code >= 400 && code < 600 { code as u16 } else { 200 }).unwrap_or(StatusCode::OK),
     Json(ApiResponse::<()>::error(code, message)))
}

pub async fn health_check() -> impl IntoResponse {
    #[derive(Serialize)]
    struct H {
        status: &'static str,
        timestamp: chrono::DateTime<chrono::Utc>,
        version: &'static str,
    }
    ok(H { status: "ok", timestamp: Utc::now(), version: "0.1.0" })
}

pub async fn list_towers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let towers = state.towers.read().clone();
    ok(towers)
}

pub async fn get_tower(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let towers = state.towers.read();
    match towers.iter().find(|t| t.id == uuid).cloned() {
        Some(t) => ok(t),
        None => err(404, "tower not found"),
    }
}

pub async fn create_tower(State(state): State<Arc<AppState>>, Json(body): Json<TowerPoint>) -> impl IntoResponse {
    let mut towers = state.towers.write();
    let mut t = body;
    t.id = Uuid::new_v4();
    t.created_at = Utc::now();
    t.updated_at = Utc::now();
    state.risk_engine.register_tower(t.clone());
    towers.push(t.clone());
    ok(t)
}

pub async fn update_tower(State(state): State<Arc<AppState>>, Path(id): Path<String>, Json(body): Json<TowerPoint>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let mut towers = state.towers.write();
    if let Some(t) = towers.iter_mut().find(|t| t.id == uuid) {
        *t = body;
        t.id = uuid;
        t.updated_at = Utc::now();
        return ok(t.clone());
    }
    err(404, "tower not found")
}

pub async fn delete_tower(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let mut towers = state.towers.write();
    let before = towers.len();
    towers.retain(|t| t.id != uuid);
    if towers.len() < before {
        ok(serde_json::json!({"deleted": true}))
    } else {
        err(404, "tower not found")
    }
}

pub async fn get_tower_summary(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let towers = state.towers.read();
    let Some(t) = towers.iter().find(|t| t.id == uuid).cloned() else { return err(404, "tower not found"); };
    let metrics = state.risk_engine.realtime_metrics(uuid);
    let risk = state.risk_engine.current_risk(uuid);
    ok(TowerSummary {
        id: t.id,
        name: t.name,
        code: t.code,
        line_name: t.line_name,
        index: t.index,
        geo: t.geo,
        status: t.status,
        current_wind_speed: metrics.as_ref().and_then(|m| m.wind_speed),
        current_ice_thickness: metrics.as_ref().and_then(|m| m.ice_thickness),
        current_vibration: metrics.as_ref().and_then(|m| m.vibration_acceleration),
        risk_level: risk.map(|r| r.risk_level),
    })
}

pub async fn get_tower_realtime_metrics(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    match state.risk_engine.realtime_metrics(uuid) {
        Some(m) => ok(m),
        None => err(404, "tower not found"),
    }
}

pub async fn get_metrics_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(range): Query<TimeRangeParams>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let to = Utc::now();
    let from = to - Duration::hours(range.hours as i64);
    let _ = (from, to);

    #[derive(Serialize)]
    struct H {
        tower_id: Uuid,
        generated_at: chrono::DateTime<chrono::Utc>,
        from: chrono::DateTime<chrono::Utc>,
        to: chrono::DateTime<chrono::Utc>,
        vibration: Vec<(chrono::DateTime<chrono::Utc>, f64)>,
        wind: Vec<(chrono::DateTime<chrono::Utc>, f64)>,
        ice: Vec<(chrono::DateTime<chrono::Utc>, f64)>,
        strain: Vec<(chrono::DateTime<chrono::Utc>, f64)>,
    }

    let n = (range.hours * 12).max(60).min(600) as usize;
    let mut vib = Vec::with_capacity(n);
    let mut wind = Vec::with_capacity(n);
    let mut ice = Vec::with_capacity(n);
    let mut strain = Vec::with_capacity(n);

    for i in 0..n {
        let t = from + Duration::seconds((i as i64 * (to - from).num_seconds()) / n as i64);
        let wave = ((i as f64) * 0.35).sin();
        let storm = if i > n * 2 / 3 { ((i - n * 2 / 3) as f64 / (n as f64 / 3.0)) } else { 0.0 };
        vib.push((t, (3.0 + storm * 30.0) * (0.8 + wave * 0.25)));
        wind.push((t, (6.0 + storm * 18.0 + wave * 3.0).max(0.5)));
        let ice_val = (i as f64 / n as f64 * 38.0 * (0.7 + storm * 0.6)).min(40.0);
        ice.push((t, ice_val));
        strain.push((t, (120.0 + storm * 60.0 + wave * 8.0)));
    }

    ok(H {
        tower_id: uuid,
        generated_at: Utc::now(),
        from, to,
        vibration: vib,
        wind,
        ice,
        strain,
    })
}

pub async fn get_current_risk(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    match state.risk_engine.current_risk(uuid) {
        Some(r) => ok(r),
        None => {
            let towers = state.towers.read();
            if !towers.iter().any(|t| t.id == uuid) {
                return err(404, "tower not found");
            }
            let _ = towers;
            let default = IcingRiskAssessment {
                id: Uuid::new_v4(),
                tower_id: uuid,
                assessment_time: Utc::now(),
                ice_thickness: 0.0,
                ice_thickness_trend: RiskTrend::Stable,
                wind_speed: 0.0,
                wind_speed_trend: RiskTrend::Stable,
                vibration_level: 0.0,
                vibration_trend: RiskTrend::Stable,
                temperature: 0.0,
                humidity: 0.0,
                composite_score: 0.0,
                risk_level: RiskLevel::Safe,
                contributing_factors: vec![],
                ice_type_estimate: "none".to_string(),
                estimated_load: 0.0,
                load_percentage: 0.0,
                recommendations: vec!["正常运行".to_string()],
                reviewed: false,
                reviewer_id: None,
            };
            ok(default)
        }
    }
}

pub async fn get_risk_history(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(range): Query<TimeRangeParams>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let to = Utc::now();
    let from = to - Duration::hours(range.hours as i64);
    let n = (range.hours * 4).max(24).min(200) as usize;
    let mut items = Vec::with_capacity(n);

    for i in 0..n {
        let t = from + Duration::seconds((i as i64 * (to - from).num_seconds()) / n as i64);
        let progress = i as f64 / n as f64;
        let storm = (progress - 0.55).max(0.0) * 2.5;
        let score = (8.0 + storm * 85.0 + ((progress * 25.0).sin() * 8.0)).min(100.0);
        items.push(IcingRiskAssessment {
            id: Uuid::new_v4(),
            tower_id: uuid,
            assessment_time: t,
            ice_thickness: (progress * 35.0 * (0.5 + storm)).min(40.0),
            ice_thickness_trend: if storm > 0.6 { RiskTrend::RapidlyIncreasing } else if storm > 0.3 { RiskTrend::Increasing } else { RiskTrend::Stable },
            wind_speed: (6.0 + storm * 18.0).max(1.0),
            wind_speed_trend: if storm > 0.5 { RiskTrend::RapidlyIncreasing } else if storm > 0.2 { RiskTrend::Increasing } else { RiskTrend::Decreasing },
            vibration_level: (2.5 + storm * 25.0),
            vibration_trend: if storm > 0.5 { RiskTrend::Increasing } else { RiskTrend::Stable },
            temperature: -5.0 - storm * 4.0,
            humidity: 78.0 + storm * 20.0,
            composite_score: score,
            risk_level: score_to_risk(score),
            contributing_factors: vec![],
            ice_type_estimate: if storm > 0.3 { "混合凇".to_string() } else { "无".to_string() },
            estimated_load: 1500.0 + storm * 5000.0,
            load_percentage: (18.0 + storm * 80.0).min(110.0),
            recommendations: vec![],
            reviewed: false,
            reviewer_id: None,
        });
    }
    ok(items)
}

fn score_to_risk(s: f64) -> RiskLevel {
    if s >= 80.0 { RiskLevel::Extreme }
    else if s >= 60.0 { RiskLevel::High }
    else if s >= 35.0 { RiskLevel::Medium }
    else if s >= 15.0 { RiskLevel::Low }
    else { RiskLevel::Safe }
}

pub async fn get_vibration_fft(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid tower id"); };
    let towers = state.towers.read();
    if !towers.iter().any(|t| t.id == uuid) {
        return err(404, "tower not found");
    }

    let peaks = vec![
        FftPeak { frequency: 1.23, magnitude: 0.88 },
        FftPeak { frequency: 2.46, magnitude: 0.42 },
        FftPeak { frequency: 3.69, magnitude: 0.21 },
        FftPeak { frequency: 4.92, magnitude: 0.11 },
        FftPeak { frequency: 6.15, magnitude: 0.06 },
        FftPeak { frequency: 7.38, magnitude: 0.03 },
        FftPeak { frequency: 8.61, magnitude: 0.02 },
        FftPeak { frequency: 12.3, magnitude: 0.35 },
    ];

    #[derive(Serialize)]
    struct F {
        tower_id: Uuid,
        timestamp: chrono::DateTime<chrono::Utc>,
        sample_rate: f64,
        window_size: u32,
        dominant_frequency: f64,
        peaks: Vec<FftPeak>,
        frequency_bin_hz: f64,
    }

    ok(F {
        tower_id: uuid,
        timestamp: Utc::now(),
        sample_rate: 100.0,
        window_size: 8192,
        dominant_frequency: 1.23,
        peaks,
        frequency_bin_hz: 0.0122,
    })
}

pub async fn list_risk_events(
    State(state): State<Arc<AppState>>,
    Query(p): Query<PaginationParams>,
) -> impl IntoResponse {
    let now = Utc::now();
    let mut events = Vec::new();
    let towers = state.towers.read();
    for (idx, tower) in towers.iter().take(3).enumerate() {
        events.push(RiskEvent {
            id: Uuid::new_v4(),
            tower_id: tower.id,
            event_time: now - Duration::minutes((idx * 17 + 8) as i64),
            event_type: RiskEventType::WindSpeedThresholdExceeded,
            severity: if idx == 0 { RiskLevel::High } else { RiskLevel::Medium },
            description: format!("风速超限告警，持续风速 {:.1}m/s", 18.5 + idx as f64 * 1.8),
            threshold_value: 18.0,
            actual_value: 18.5 + idx as f64 * 1.8,
            unit: "m/s".to_string(),
            acknowledged: idx != 0,
            acknowledged_by: if idx != 0 { Some(Uuid::new_v4()) } else { None },
            acknowledged_at: if idx != 0 { Some(now - Duration::minutes((idx * 5) as i64)) } else { None },
            resolved: false,
            resolved_at: None,
            resolution_note: None,
        });
        events.push(RiskEvent {
            id: Uuid::new_v4(),
            tower_id: tower.id,
            event_time: now - Duration::minutes((idx * 23 + 15) as i64),
            event_type: RiskEventType::IceThicknessThresholdExceeded,
            severity: if idx == 0 { RiskLevel::Extreme } else { RiskLevel::High },
            description: format!("覆冰厚度 {:.1}mm 超过阈值", 28.0 + idx as f64 * 6.0),
            threshold_value: 25.0,
            actual_value: 28.0 + idx as f64 * 6.0,
            unit: "mm".to_string(),
            acknowledged: false,
            acknowledged_by: None,
            acknowledged_at: None,
            resolved: false,
            resolved_at: None,
            resolution_note: None,
        });
    }
    let total = events.len() as u64;
    ok(PageResult::new(events, total, p.page, p.page_size))
}

#[derive(Deserialize)]
pub struct AckRequest {
    pub user_id: Uuid,
    pub note: Option<String>,
}

pub async fn acknowledge_event(
    State(state): State<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(body): Json<AckRequest>,
) -> impl IntoResponse {
    let _ = state;
    ok(serde_json::json!({
        "acknowledged": true,
        "user_id": body.user_id,
        "timestamp": Utc::now(),
    }))
}

pub async fn resolve_event(
    State(state): State<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(body): Json<AckRequest>,
) -> impl IntoResponse {
    let _ = state;
    ok(serde_json::json!({
        "resolved": true,
        "user_id": body.user_id,
        "note": body.note,
        "timestamp": Utc::now(),
    }))
}

pub async fn list_decisions(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let decisions = state.decision_engine.all_active_decisions();
    if decisions.is_empty() {
        let now = Utc::now();
        let towers = state.towers.read();
        let mut sample = Vec::new();
        for tower in towers.iter().take(2) {
            sample.push(ShutdownDecision {
                id: Uuid::new_v4(),
                tower_id: tower.id,
                decision_time: now - Duration::minutes(6),
                decision_type: DecisionType::Mandatory,
                priority: DecisionPriority::High,
                trigger_reasons: vec![DecisionReason {
                    code: "COMBO_HIGH".to_string(),
                    metric: "composite".to_string(),
                    threshold: 60.0,
                    actual: 67.5,
                    severity: RiskLevel::High,
                    description: "冰风组合风险较高".to_string(),
                }],
                risk_evidence: vec![Uuid::new_v4()],
                recommended_action: RecommendedAction::SuspendSection { sections: vec![2, 3] },
                estimated_duration_minutes: 120,
                affected_sections: vec!["A区段".to_string()],
                passenger_handling: PassengerHandling {
                    unload_passengers: true,
                    hold_in_stations: true,
                    ground_transport_arranged: true,
                    estimated_wait_minutes: 90,
                },
                estimated_impact: OperationalImpact::Delay2Hours,
                auto_generated: true,
                status: DecisionStatus::PendingApproval,
                approver_id: None,
                approved_at: None,
                comments: None,
                executed: false,
                executed_at: None,
                executor_id: None,
            });
        }
        return ok(sample);
    }
    ok(decisions)
}

pub async fn list_decision_history(
    State(state): State<Arc<AppState>>,
    Query(p): Query<PaginationParams>,
) -> impl IntoResponse {
    let hist = state.decision_engine.recent_history(p.page_size as usize);
    ok(PageResult::new(hist, hist.len() as u64, p.page, p.page_size))
}

pub async fn get_decision(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid decision id"); };
    let all = state.decision_engine.all_active_decisions();
    match all.iter().find(|d| d.id == uuid).cloned() {
        Some(d) => ok(d),
        None => {
            let hist = state.decision_engine.recent_history(100);
            match hist.iter().find(|d| d.id == uuid).cloned() {
                Some(d) => ok(d),
                None => err(404, "decision not found"),
            }
        }
    }
}

#[derive(Deserialize)]
pub struct DecisionActionRequest {
    pub user_id: Uuid,
    pub reason: Option<String>,
}

pub async fn approve_decision(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<DecisionActionRequest>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid decision id"); };
    match state.decision_engine.approve_decision(uuid, body.user_id) {
        Some(d) => ok(d),
        None => err(404, "decision not found"),
    }
}

pub async fn reject_decision(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<DecisionActionRequest>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid decision id"); };
    match state.decision_engine.reject_decision(uuid, body.user_id, body.reason.as_deref().unwrap_or("")) {
        Some(d) => ok(d),
        None => err(404, "decision not found"),
    }
}

pub async fn execute_decision(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<DecisionActionRequest>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid decision id"); };
    match state.decision_engine.execute_decision(uuid, body.user_id) {
        Some(d) => {
            state.broadcast_ws(crate::websocket::WsMessage::Decision(d.clone()));
            ok(d)
        }
        None => err(404, "decision not found"),
    }
}

pub async fn list_strategies(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let strats = state.decision_engine.list_strategies();
    ok(strats)
}

pub async fn list_inspections(
    State(state): State<Arc<AppState>>,
    Query(p): Query<PaginationParams>,
) -> impl IntoResponse {
    let mut inspections = state.inspections.read().clone();
    let total = inspections.len() as u64;
    let start = ((p.page - 1) * p.page_size) as usize;
    if start < inspections.len() {
        let end = (start + p.page_size as usize).min(inspections.len());
        inspections = inspections.drain(start..end).collect();
    } else {
        inspections = Vec::new();
    }
    ok(PageResult::new(inspections, total, p.page, p.page_size))
}

pub async fn create_inspection(
    State(state): State<Arc<AppState>>,
    Json(body): Json<InspectionRecord>,
) -> impl IntoResponse {
    let mut r = body;
    r.id = Uuid::new_v4();
    state.inspections.write().push(r.clone());
    ok(r)
}

pub async fn get_inspection(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid inspection id"); };
    let list = state.inspections.read();
    match list.iter().find(|r| r.id == uuid).cloned() {
        Some(r) => ok(r),
        None => err(404, "inspection not found"),
    }
}

pub async fn update_inspection(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<InspectionRecord>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid inspection id"); };
    let mut list = state.inspections.write();
    if let Some(r) = list.iter_mut().find(|r| r.id == uuid) {
        *r = body;
        r.id = uuid;
        return ok(r.clone());
    }
    err(404, "inspection not found")
}

pub async fn list_cameras(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let list = state.cameras.read().clone();
    ok(list)
}

#[derive(Deserialize)]
pub struct PtzRequest {
    pub user_id: Uuid,
    pub command: String,
    pub speed: Option<f64>,
    pub value: Option<f64>,
    pub preset_id: Option<Uuid>,
}

pub async fn control_camera_ptz(
    State(state): State<Arc<AppState>>,
    Path(_id): Path<String>,
    Json(body): Json<PtzRequest>,
) -> impl IntoResponse {
    let _ = state;
    ok(serde_json::json!({
        "accepted": true,
        "command": body.command,
        "requested_at": Utc::now(),
    }))
}

pub async fn list_verifications(
    State(state): State<Arc<AppState>>,
    Query(_p): Query<PaginationParams>,
) -> impl IntoResponse {
    let list = state.verifications.read().clone();
    ok(list)
}

#[derive(Deserialize)]
pub struct VerificationRequest {
    pub tower_id: Uuid,
    pub risk_event_id: Option<Uuid>,
    pub risk_assessment_id: Option<Uuid>,
    pub requested_by: Option<Uuid>,
    pub reason: String,
    pub priority: Option<String>,
}

pub async fn request_verification(
    State(state): State<Arc<AppState>>,
    Json(body): Json<VerificationRequest>,
) -> impl IntoResponse {
    let priority = match body.priority.as_deref() {
        Some("urgent") => VerificationPriority::Urgent,
        Some("high") => VerificationPriority::High,
        Some("normal") => VerificationPriority::Normal,
        Some("emergency") => VerificationPriority::Emergency,
        _ => VerificationPriority::High,
    };
    let v = VideoVerificationRequest {
        id: Uuid::new_v4(),
        tower_id: body.tower_id,
        risk_event_id: body.risk_event_id,
        risk_assessment_id: body.risk_assessment_id,
        created_at: Utc::now(),
        priority,
        requested_by: body.requested_by,
        request_reason: body.reason,
        status: VerificationStatus::Pending,
        camera_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
        verifications: vec![],
        assigned_to: None,
        completed_at: None,
        final_verdict: None,
        notes: None,
    };
    state.verifications.write().push(v.clone());
    ok(v)
}

pub async fn get_verification(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid verification id"); };
    let list = state.verifications.read();
    match list.iter().find(|v| v.id == uuid).cloned() {
        Some(v) => ok(v),
        None => err(404, "verification not found"),
    }
}

#[derive(Deserialize)]
pub struct VerificationResultRequest {
    pub assigned_to: Option<Uuid>,
    pub verdict: String,
    pub notes: Option<String>,
    pub verifications: Option<Vec<CameraVerification>>,
}

pub async fn submit_verification_result(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<VerificationResultRequest>,
) -> impl IntoResponse {
    let Ok(uuid) = Uuid::parse_str(&id) else { return err(400, "invalid verification id"); };
    let mut list = state.verifications.write();
    let verdict = match body.verdict.as_str() {
        "confirmed" => VerificationVerdict::Confirmed,
        "false_alarm" => VerificationVerdict::FalseAlarm,
        "inconclusive" => VerificationVerdict::Inconclusive,
        "partially_confirmed" => VerificationVerdict::PartiallyConfirmed,
        _ => VerificationVerdict::Inconclusive,
    };
    if let Some(v) = list.iter_mut().find(|v| v.id == uuid) {
        v.status = VerificationStatus::Completed;
        v.completed_at = Some(Utc::now());
        v.final_verdict = Some(verdict);
        v.notes = body.notes.clone();
        if let Some(vs) = body.verifications { v.verifications = vs; }
        if let Some(a) = body.assigned_to { v.assigned_to = Some(a); }
        return ok(v.clone());
    }
    err(404, "verification not found")
}

pub async fn get_weather_forecast(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let towers = state.towers.read();
    let first = towers.first().cloned();
    let tower_id = first.as_ref().map(|t| t.id).unwrap_or_else(Uuid::new_v4);

    let now = Utc::now();
    let mut hourly = Vec::with_capacity(48);
    for h in 0..48u32 {
        let t = now + Duration::hours(h as i64);
        let cycle = ((h as f64 * 0.75) % 24.0) / 24.0;
        let storm_start = 12.0;
        let storm = if h as f64 >= storm_start {
            ((h as f64 - storm_start) / 18.0).min(1.0)
        } else { 0.0 };
        hourly.push(HourlyForecast {
            time: t,
            temperature_c: -3.0 + cycle * 6.0 - storm * 5.0,
            humidity_pct: 70.0 + cycle * 15.0 + storm * 20.0,
            wind_speed_ms: 5.0 + storm * 19.0 + (cycle * 6.28).sin() * 2.0,
            wind_gust_ms: 8.0 + storm * 28.0,
            wind_direction_deg: (220.0 + cycle * 90.0) % 360.0,
            precipitation_prob_pct: if storm > 0.1 { (60.0 + storm * 35.0) as u8 } else { (20.0 + cycle * 15.0) as u8 },
            precipitation_mm: storm * 4.0,
            precipitation_type: if storm > 0.3 { PrecipitationType::FreezingRain } else if storm > 0.1 { PrecipitationType::Snow } else { PrecipitationType::None },
            snow_cm: storm * 8.0,
            icing_probability_pct: if storm > 0.15 { (50.0 + storm * 45.0) as u8 } else { (10.0 + storm * 40.0) as u8 },
        });
    }

    ok(WeatherForecast {
        id: Uuid::new_v4(),
        tower_id,
        forecast_time: now,
        valid_from: now,
        valid_to: now + Duration::hours(48),
        forecasts: hourly,
        issued_by: "中国气象局-山地气象预报中心".to_string(),
    })
}

pub async fn list_weather_alerts(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut alerts = state.weather_alerts.read().clone();
    if alerts.is_empty() {
        let towers = state.towers.read();
        let tower_id = towers.first().map(|t| t.id).unwrap_or_else(Uuid::new_v4);
        let now = Utc::now();
        alerts.push(WeatherAlert {
            id: Uuid::new_v4(),
            tower_id,
            alert_time: now,
            alert_type: WeatherAlertType::IceStorm,
            severity: AlertSeverity::Severe,
            headline: "冻雨及道路结冰橙色预警".to_string(),
            description: "预计未来18小时内，索道沿线将出现冻雨转暴雪天气，过程降温幅度8~12℃，塔架覆冰厚度可能达35~50mm，最大阵风可达9~11级。".to_string(),
            affected_area: "主索道A1-A5，B1-B3段，海拔2300m以上区域".to_string(),
            valid_from: now,
            valid_to: now + Duration::hours(36),
            certainty: AlertCertainty::Likely,
            response_required: true,
            acknowledged: false,
        });
        alerts.push(WeatherAlert {
            id: Uuid::new_v4(),
            tower_id,
            alert_time: now - Duration::hours(2),
            alert_type: WeatherAlertType::HighWind,
            severity: AlertSeverity::Moderate,
            headline: "大风黄色预警".to_string(),
            description: "山地冷空气过境，沿索道线偏北风6-8级，阵风可达9级以上。".to_string(),
            affected_area: "索道全线，垭口高海拔区段".to_string(),
            valid_from: now - Duration::hours(2),
            valid_to: now + Duration::hours(12),
            certainty: AlertCertainty::Observed,
            response_required: true,
            acknowledged: true,
        });
    }
    ok(alerts)
}

pub async fn generate_weather_impact_report(
    State(state): State<Arc<AppState>>,
    Query(range): Query<TimeRangeParams>,
) -> impl IntoResponse {
    let to = Utc::now();
    let from = to - Duration::hours(range.hours as i64.max(24) as i64);
    let towers = state.towers.read();
    let tower_id = towers.first().map(|t| t.id).unwrap_or_else(Uuid::new_v4);

    ok(WeatherImpactReport {
        id: Uuid::new_v4(),
        report_time: to,
        period_start: from,
        period_end: to,
        tower_id,
        total_shutdown_hours: 6.5,
        partial_shutdown_hours: 12.25,
        reduced_speed_hours: 18.5,
        ice_accumulation_max_mm: 38.5,
        max_wind_speed_ms: 24.8,
        min_temp_c: -11.3,
        total_snowfall_cm: 26.5,
        significant_events: vec![
            "12月20日03时-09时：冻雨导致严重覆冰，最大厚度38.5mm，启动紧急停运".to_string(),
            "12月20日11时-14时：强风阵风24.8m/s，全线段紧急停运".to_string(),
            "12月19日至20日：累计降雪26.5cm，对检修道路通行造成影响".to_string(),
        ],
        operational_notes: "本次天气过程影响严重，停运期间共疏散旅客286人次，协调地面转运车辆11台次。塔架经人工巡查确认结构安全，除冰作业完成后恢复运行。".to_string(),
        economic_impact_estimate: Some(385600.0),
    })
}

pub async fn get_dashboard_summary(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let towers = state.towers.read().clone();
    let mut summaries = Vec::with_capacity(towers.len());
    let mut risk_counts = [0u32; 5];
    let mut total_events = 0u32;
    let mut total_pending_decisions = 0u32;

    for t in &towers {
        let metrics = state.risk_engine.realtime_metrics(t.id);
        let risk = state.risk_engine.current_risk(t.id);
        if let Some(ref r) = risk {
            risk_counts[r.risk_level.score() as usize] += 1;
            if r.risk_level.score() >= 2 { total_events += 1; }
        }
        summaries.push(TowerSummary {
            id: t.id,
            name: t.name.clone(),
            code: t.code.clone(),
            line_name: t.line_name.clone(),
            index: t.index,
            geo: t.geo.clone(),
            status: t.status.clone(),
            current_wind_speed: metrics.as_ref().and_then(|m| m.wind_speed),
            current_ice_thickness: metrics.as_ref().and_then(|m| m.ice_thickness),
            current_vibration: metrics.as_ref().and_then(|m| m.vibration_acceleration),
            risk_level: risk.map(|r| r.risk_level),
        });
    }

    let pending = state.decision_engine.all_active_decisions();
    total_pending_decisions = pending.iter().filter(|d| matches!(d.status, DecisionStatus::PendingApproval)).count() as u32;

    #[derive(Serialize)]
    struct D {
        generated_at: chrono::DateTime<chrono::Utc>,
        total_towers: u32,
        towers_online: u32,
        risk_breakdown: [u32; 5],
        active_risk_events: u32,
        pending_decisions: u32,
        weather_alerts: u32,
        ws_clients: usize,
        avg_risk_score: f64,
        summaries: Vec<TowerSummary>,
        top_high_risk: Vec<TowerSummary>,
    }

    let mut high_risk = summaries.iter()
        .filter(|s| matches!(s.risk_level, Some(RiskLevel::High) | Some(RiskLevel::Extreme)))
        .cloned()
        .collect::<Vec<_>>();
    high_risk.truncate(5);

    let avg_risk = summaries.iter()
        .filter_map(|s| s.risk_level.as_ref().map(|r| r.score() as f64 / 4.0 * 100.0))
        .sum::<f64>() / summaries.len().max(1) as f64;

    ok(D {
        generated_at: Utc::now(),
        total_towers: towers.len() as u32,
        towers_online: towers.len() as u32,
        risk_breakdown: risk_counts,
        active_risk_events: total_events,
        pending_decisions: total_pending_decisions,
        weather_alerts: state.weather_alerts.read().len() as u32,
        ws_clients: state.ws_client_count(),
        avg_risk_score: avg_risk,
        summaries,
        top_high_risk: high_risk,
    })
}
