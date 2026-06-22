use std::sync::Arc;
use dashmap::DashMap;
use parking_lot::RwLock;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::config::Config;
use crate::websocket::WsMessage;
use data_models::*;
use sensor_ingest::SensorIngestService;
use risk_engine::RiskEngine;
use decision_engine::DecisionEngine;

pub type ChClient = Arc<klickhouse::Client>;

pub struct AppState {
    pub config: Config,
    pub nats: async_nats::Client,
    pub sensor_ingest: Arc<SensorIngestService>,
    pub risk_engine: Arc<RiskEngine>,
    pub decision_engine: Arc<DecisionEngine>,
    pub clickhouse: Option<ChClient>,
    pub towers: RwLock<Vec<TowerPoint>>,
    pub cameras: RwLock<Vec<CameraDevice>>,
    pub inspections: RwLock<Vec<InspectionRecord>>,
    pub verifications: RwLock<Vec<VideoVerificationRequest>>,
    pub weather_alerts: RwLock<Vec<WeatherAlert>>,
    pub ws_clients: DashMap<Uuid, broadcast::Sender<WsMessage>>,
    pub ws_broadcast: broadcast::Sender<WsMessage>,
}

impl AppState {
    pub fn new(
        config: Config,
        nats: async_nats::Client,
        sensor_ingest: Arc<SensorIngestService>,
        risk_engine: Arc<RiskEngine>,
        decision_engine: Arc<DecisionEngine>,
        clickhouse: Option<ChClient>,
        towers: Vec<TowerPoint>,
        cameras: Vec<CameraDevice>,
        inspections: Vec<InspectionRecord>,
    ) -> Arc<Self> {
        let (tx, _rx) = broadcast::channel::<WsMessage>(2048);
        Arc::new(Self {
            config,
            nats,
            sensor_ingest,
            risk_engine,
            decision_engine,
            clickhouse,
            towers: RwLock::new(towers),
            cameras: RwLock::new(cameras),
            inspections: RwLock::new(inspections),
            verifications: RwLock::new(Vec::new()),
            weather_alerts: RwLock::new(Vec::new()),
            ws_clients: DashMap::new(),
            ws_broadcast: tx,
        })
    }

    pub fn broadcast_ws(&self, msg: WsMessage) {
        let _ = self.ws_broadcast.send(msg);
    }

    pub fn add_ws_client(&self) -> (Uuid, broadcast::Receiver<WsMessage>) {
        let id = Uuid::new_v4();
        let rx = self.ws_broadcast.subscribe();
        let tx = self.ws_broadcast.clone();
        self.ws_clients.insert(id, tx);
        (id, rx)
    }

    pub fn remove_ws_client(&self, id: Uuid) {
        self.ws_clients.remove(&id);
    }

    pub fn ws_client_count(&self) -> usize {
        self.ws_clients.len()
    }
}
