pub mod config;
pub mod state;
pub mod routes;
pub mod websocket;
pub mod clickhouse_store;
pub mod handlers;

use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, put, delete, IntoMakeService},
    Router,
    Server,
    http::Method,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info, warn};

use data_models::*;
use sensor_ingest::{SensorIngestService, subjects as sensor_subjects};
use risk_engine::{RiskEngine, RiskThresholds};
use decision_engine::{DecisionEngine, DecisionConfig};
use state::AppState;

fn sample_towers() -> Vec<TowerPoint> {
    use chrono::Utc;
    let line_id = Uuid::new_v4();
    let names = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3"];
    let lat_base = 30.123456;
    let lon_base = 103.456789;
    let mut towers = Vec::new();

    for (i, name) in names.iter().enumerate() {
        let idx = i as u32 + 1;
        let mut sensors = Vec::new();
        sensors.push(TowerSensor {
            id: Uuid::new_v4(),
            sensor_type: SensorType::Accelerometer,
            location: "塔顶".to_string(),
            mount_height: 38.0,
            sampling_rate: 100.0,
            online: true,
            last_seen: Some(Utc::now()),
        });
        sensors.push(TowerSensor {
            id: Uuid::new_v4(),
            sensor_type: SensorType::Anemometer,
            location: "塔顶".to_string(),
            mount_height: 42.0,
            sampling_rate: 1.0,
            online: true,
            last_seen: Some(Utc::now()),
        });
        sensors.push(TowerSensor {
            id: Uuid::new_v4(),
            sensor_type: SensorType::IceThicknessSensor,
            location: "缆绳鞍座".to_string(),
            mount_height: 40.0,
            sampling_rate: 1.0 / 60.0,
            online: true,
            last_seen: Some(Utc::now()),
        });
        sensors.push(TowerSensor {
            id: Uuid::new_v4(),
            sensor_type: SensorType::StrainGauge,
            location: "主柱".to_string(),
            mount_height: 25.0,
            sampling_rate: 10.0,
            online: true,
            last_seen: Some(Utc::now()),
        });
        sensors.push(TowerSensor {
            id: Uuid::new_v4(),
            sensor_type: SensorType::TemperatureSensor,
            location: "塔架中部".to_string(),
            mount_height: 20.0,
            sampling_rate: 0.2,
            online: true,
            last_seen: Some(Utc::now()),
        });

        towers.push(TowerPoint {
            id: Uuid::new_v4(),
            name: format!("{}号塔", name),
            code: format!("TWR-{:04}", idx),
            line_id,
            line_name: "主索道线路".to_string(),
            index: idx,
            geo: GeoCoord {
                latitude: lat_base + i as f64 * 0.0013,
                longitude: lon_base + i as f64 * 0.0017,
                altitude: 2400.0 + (i as f64 - 3.5) * 60.0,
            },
            height: 38.0 + (i % 3) as f64 * 2.5,
            foundation_depth: 6.5,
            material: "Q345B钢材桁架".to_string(),
            build_year: 2015 + (i % 4) as u32,
            max_wind_speed: 28.0,
            max_ice_thickness: 45.0,
            status: TowerStatus::Normal,
            sensors,
            camera_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
            description: Some(format!("山地索道塔架，位于{}段", if name.starts_with("A") { "上行线" } else { "下行线" })),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
    }
    towers
}

fn sample_cameras() -> Vec<CameraDevice> {
    use chrono::Utc;
    vec![
        CameraDevice {
            id: Uuid::new_v4(),
            tower_id: Uuid::new_v4(),
            name: "A1塔顶全景".to_string(),
            model: "Hikvision DS-2DF8C8".to_string(),
            ip_address: "192.168.1.101".to_string(),
            rtsp_url: "rtsp://192.168.1.101:554/stream1".to_string(),
            hls_url: Some("http://192.168.1.200/hls/a1-top.m3u8".to_string()),
            location: CameraLocation::Top,
            fov_degrees: 95.0,
            resolution: "3840x2160".to_string(),
            night_vision: true,
            ptz_capable: true,
            online: true,
            last_heartbeat: Some(Utc::now()),
            stream_active: true,
            recording_enabled: true,
            created_at: Utc::now(),
        },
        CameraDevice {
            id: Uuid::new_v4(),
            tower_id: Uuid::new_v4(),
            name: "A1跨中缆绳".to_string(),
            model: "Dahua IPC-HFW5849".to_string(),
            ip_address: "192.168.1.102".to_string(),
            rtsp_url: "rtsp://192.168.1.102:554/cable".to_string(),
            hls_url: Some("http://192.168.1.200/hls/a1-cable.m3u8".to_string()),
            location: CameraLocation::CableSaddle,
            fov_degrees: 45.0,
            resolution: "3840x2160".to_string(),
            night_vision: true,
            ptz_capable: false,
            online: true,
            last_heartbeat: Some(Utc::now()),
            stream_active: true,
            recording_enabled: true,
            created_at: Utc::now(),
        },
    ]
}

fn sample_inspections() -> Vec<InspectionRecord> {
    use chrono::{TimeZone, Duration, Utc};
    vec![
        InspectionRecord {
            id: Uuid::new_v4(),
            tower_id: Uuid::new_v4(),
            inspection_type: InspectionType::PostIcing,
            inspector_id: Uuid::new_v4(),
            inspector_name: "张建国".to_string(),
            planned_date: Utc::now() - Duration::days(2),
            started_at: Some(Utc::now() - Duration::days(2) + Duration::hours(3)),
            completed_at: Some(Utc::now() - Duration::days(2) + Duration::hours(6)),
            status: InspectionStatus::Completed,
            findings: vec![
                InspectionFinding {
                    id: Uuid::new_v4(),
                    category: "覆冰残留".to_string(),
                    severity: FindingSeverity::Minor,
                    description: "鞍座处残留约5mm薄冰，无脱落风险".to_string(),
                    location: "顶部鞍座东侧".to_string(),
                    photo_ids: vec![],
                    resolved: true,
                    resolution: Some("自然脱落，已清理残余".to_string()),
                },
            ],
            overall_condition: ConditionRating::Good,
            ice_observation: IceObservation {
                ice_present: true,
                thickness_mm: 6.0,
                ice_type: "晶凇".to_string(),
                distribution: "鞍座、交叉臂".to_string(),
                shedding_observed: true,
                ambient_temp_c: -2.5,
            },
            structural_checks: StructuralChecks {
                foundation: ConditionRating::Excellent,
                base_section: ConditionRating::Good,
                middle_section: ConditionRating::Good,
                top_section: ConditionRating::Good,
                cross_arms: ConditionRating::Good,
                cable_attachments: ConditionRating::Excellent,
                bolts_and_fasteners: ConditionRating::Good,
                corrosion_present: false,
                corrosion_notes: None,
            },
            sensor_calibration: vec![],
            maintenance_actions: vec![
                MaintenanceAction {
                    id: Uuid::new_v4(),
                    action_type: "除冰作业".to_string(),
                    description: "使用机械敲击清除鞍座、交叉臂覆冰".to_string(),
                    materials_used: vec!["除冰锤".to_string(), "防坠装备".to_string()],
                    duration_minutes: 95,
                    completed: true,
                },
            ],
            photos: vec![],
            weather_conditions: "晴转多云，气温-3~-1℃，微风".to_string(),
            notes: Some("整体状况良好，覆冰已自然脱落大部分，建议关注后续天气".to_string()),
            follow_up_required: false,
            follow_up_date: None,
            signed_off: true,
            signed_off_by: Some(Uuid::new_v4()),
            signed_off_at: Some(Utc::now() - Duration::days(1)),
        },
    ]
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,cableway_monitor=debug,risk_engine=debug,decision_engine=debug".into()),
        )
        .with_target(true)
        .json()
        .try_init()
        .ok();

    let config = config::Config::from_env()?;
    info!("Starting Cableway Monitor Service...");
    info!("Config: {:?}", config);

    let nats = loop {
        match async_nats::connect(&config.nats_url).await {
            Ok(c) => break c,
            Err(e) => {
                error!("NATS connection failed: {} retrying in 3s...", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
        }
    };
    info!("Connected to NATS at {}", config.nats_url);

    let clickhouse_client = match klickhouse::Client::connect(config.clickhouse_url.parse()?, klickhouse::ClientOptions::default()).await {
        Ok(c) => {
            info!("Connected to ClickHouse at {}", config.clickhouse_url);
            Some(Arc::new(c))
        }
        Err(e) => {
            warn!("ClickHouse connection failed (will run without persistence): {}", e);
            None
        }
    };

    if let Some(ref ch) = clickhouse_client {
        let _ = clickhouse_store::init_schema(ch.clone()).await.map_err(|e| {
            warn!("ClickHouse schema init failed: {}", e);
        });
    }

    let towers = sample_towers();
    info!("Loaded {} sample towers", towers.len());

    let sensor_svc = Arc::new(SensorIngestService::new(nats.clone()));
    let risk_thresholds = RiskThresholds::default();
    let risk_engine = Arc::new(RiskEngine::new(nats.clone(), risk_thresholds));
    let decision_config = DecisionConfig::default();
    let decision_engine = Arc::new(DecisionEngine::new(nats.clone(), risk_engine.clone(), decision_config));

    for tower in &towers {
        risk_engine.register_tower(tower.clone());
        for sensor in &tower.sensors {
            // register
        }
    }
    decision_engine.add_default_strategies();

    let cameras = sample_cameras();
    let inspections = sample_inspections();

    let state = AppState::new(
        config.clone(),
        nats.clone(),
        sensor_svc.clone(),
        risk_engine.clone(),
        decision_engine.clone(),
        clickhouse_client.clone(),
        towers,
        cameras,
        inspections,
    );

    let _sim_handle = if config.enable_simulator {
        info!("Starting sensor simulator...");
        let towers_for_sim = state.towers.read().clone();
        Some(sensor_svc.start_sensor_simulator(towers_for_sim).await)
    } else { None };

    let state_clone = state.clone();
    tokio::spawn(async move {
        subscribe_to_sensors(state_clone).await;
    });

    let state_clone = state.clone();
    tokio::spawn(async move {
        risk_assessment_loop(state_clone).await;
    });

    let app = build_router(state).await;

    let addr = format!("{}:{}", config.host, config.port).parse()?;
    info!("HTTP server listening on http://{}", addr);

    let make_svc: IntoMakeService<_> = app.into_make_service();
    Server::bind(&addr)
        .serve(make_svc)
        .await?;

    Ok(())
}

pub async fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS, Method::PATCH])
        .allow_origin(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/health", get(handlers::health_check))
        .route("/api/ws", get(websocket::ws_handler))
        .route("/api/towers", get(handlers::list_towers).post(handlers::create_tower))
        .route("/api/towers/:id", get(handlers::get_tower).put(handlers::update_tower).delete(handlers::delete_tower))
        .route("/api/towers/:id/summary", get(handlers::get_tower_summary))
        .route("/api/towers/:id/metrics", get(handlers::get_tower_realtime_metrics))
        .route("/api/towers/:id/metrics/history", get(handlers::get_metrics_history))
        .route("/api/towers/:id/risk", get(handlers::get_current_risk))
        .route("/api/towers/:id/risk/history", get(handlers::get_risk_history))
        .route("/api/towers/:id/vibration/fft", get(handlers::get_vibration_fft))
        .route("/api/towers/:id/events", get(handlers::list_risk_events))
        .route("/api/events/:id/ack", post(handlers::acknowledge_event))
        .route("/api/events/:id/resolve", post(handlers::resolve_event))
        .route("/api/decisions", get(handlers::list_decisions))
        .route("/api/decisions/history", get(handlers::list_decision_history))
        .route("/api/decisions/:id", get(handlers::get_decision))
        .route("/api/decisions/:id/approve", post(handlers::approve_decision))
        .route("/api/decisions/:id/reject", post(handlers::reject_decision))
        .route("/api/decisions/:id/execute", post(handlers::execute_decision))
        .route("/api/strategies", get(handlers::list_strategies))
        .route("/api/inspections", get(handlers::list_inspections).post(handlers::create_inspection))
        .route("/api/inspections/:id", get(handlers::get_inspection).put(handlers::update_inspection))
        .route("/api/cameras", get(handlers::list_cameras))
        .route("/api/cameras/:id/ptz", post(handlers::control_camera_ptz))
        .route("/api/verifications", get(handlers::list_verifications).post(handlers::request_verification))
        .route("/api/verifications/:id", get(handlers::get_verification).put(handlers::submit_verification_result))
        .route("/api/weather/forecast", get(handlers::get_weather_forecast))
        .route("/api/weather/alerts", get(handlers::list_weather_alerts))
        .route("/api/weather/impact-report", get(handlers::generate_weather_impact_report))
        .route("/api/dashboard/summary", get(handlers::get_dashboard_summary))
        .with_state(state)
        .layer(cors)
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))
}

async fn subscribe_to_sensors(state: Arc<AppState>) {
    use futures::StreamExt;

    let subjects = [
        sensor_subjects::VIBRATION.to_string(),
        sensor_subjects::WIND.to_string(),
        sensor_subjects::ICE.to_string(),
        sensor_subjects::STRAIN.to_string(),
        sensor_subjects::WEATHER.to_string(),
    ];

    for subject_pattern in &subjects {
        let pattern = format!("{}.*", subject_pattern);
        let state_c = state.clone();
        let subj = subject_pattern.clone();
        tokio::spawn(async move {
            loop {
                let subscriber = state_c.nats.subscribe(pattern.clone()).await;
                match subscriber {
                    Ok(mut sub) => {
                        info!("NATS subscribed to {}", pattern);
                        while let Some(msg) = sub.next().await {
                            process_nats_message(&state_c, &subj, &msg.payload);
                        }
                    }
                    Err(e) => {
                        error!("NATS subscribe {} failed: {}, retrying in 2s", pattern, e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    }
                }
            }
        });
    }
}

fn process_nats_message(state: &AppState, subject_base: &str, payload: &[u8]) {
    match subject_base {
        s if s == sensor_subjects::VIBRATION => {
            if let Ok(v) = serde_json::from_slice::<VibrationData>(payload) {
                state.risk_engine.ingest_vibration(v.clone());
                let _ = state.clickhouse.as_ref().map(|ch| {
                    let ch2 = ch.clone();
                    tokio::spawn(async move {
                        let _ = clickhouse_store::write_vibration(ch2, &v).await;
                    });
                });
                state.broadcast_ws(websocket::WsMessage::Vibration(v));
            }
        }
        s if s == sensor_subjects::WIND => {
            if let Ok(w) = serde_json::from_slice::<WindData>(payload) {
                state.risk_engine.ingest_wind(w.clone());
                let _ = state.clickhouse.as_ref().map(|ch| {
                    let ch2 = ch.clone();
                    tokio::spawn(async move {
                        let _ = clickhouse_store::write_wind(ch2, &w).await;
                    });
                });
                state.broadcast_ws(websocket::WsMessage::Wind(w));
            }
        }
        s if s == sensor_subjects::ICE => {
            if let Ok(i) = serde_json::from_slice::<IceSensorData>(payload) {
                state.risk_engine.ingest_ice(i.clone());
                let _ = state.clickhouse.as_ref().map(|ch| {
                    let ch2 = ch.clone();
                    tokio::spawn(async move {
                        let _ = clickhouse_store::write_ice(ch2, &i).await;
                    });
                });
                state.broadcast_ws(websocket::WsMessage::Ice(i));
            }
        }
        s if s == sensor_subjects::STRAIN => {
            if let Ok(s) = serde_json::from_slice::<StrainData>(payload) {
                state.risk_engine.ingest_strain(s.clone());
                let _ = state.clickhouse.as_ref().map(|ch| {
                    let ch2 = ch.clone();
                    tokio::spawn(async move {
                        let _ = clickhouse_store::write_strain(ch2, &s).await;
                    });
                });
                state.broadcast_ws(websocket::WsMessage::Strain(s));
            }
        }
        s if s == sensor_subjects::WEATHER => {
            if let Ok(w) = serde_json::from_slice::<WeatherData>(payload) {
                state.risk_engine.ingest_weather(w.clone());
                let _ = state.clickhouse.as_ref().map(|ch| {
                    let ch2 = ch.clone();
                    tokio::spawn(async move {
                        let _ = clickhouse_store::write_weather(ch2, &w).await;
                    });
                });
                state.broadcast_ws(websocket::WsMessage::Weather(w));
            }
        }
        _ => {}
    }
}

async fn risk_assessment_loop(state: Arc<AppState>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
    loop {
        interval.tick().await;
        let ids: Vec<Uuid> = state.towers.read().iter().map(|t| t.id).collect();
        for id in ids {
            if let Some(assessment) = state.risk_engine.evaluate_tower(id).await {
                let is_significant = assessment.risk_level != RiskLevel::Safe && assessment.risk_level != RiskLevel::Low;
                let _ = state.risk_engine.publish_assessment(&assessment).await;

                if is_significant {
                    let events = state.risk_engine.detect_events(id).await;
                    for ev in events {
                        let _ = state.risk_engine.publish_event(&ev).await;
                        state.broadcast_ws(websocket::WsMessage::RiskEvent(ev));
                    }
                }

                if let Some(decision) = state.decision_engine.generate_decision(&assessment).await {
                    let _ = state.decision_engine.publish_decision(&decision).await;
                    state.broadcast_ws(websocket::WsMessage::Decision(decision));
                    let _ = state.decision_engine.check_and_apply_strategies(&assessment).await;
                }

                state.broadcast_ws(websocket::WsMessage::RiskAssessment(assessment));
            }
        }
    }
}
