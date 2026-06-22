use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::state::AppState;
use data_models::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    Vibration(VibrationData),
    Wind(WindData),
    Ice(IceSensorData),
    Strain(StrainData),
    Weather(WeatherData),
    RiskAssessment(IcingRiskAssessment),
    RiskEvent(RiskEvent),
    Decision(ShutdownDecision),
    MetricsUpdate {
        tower_id: Uuid,
        metrics: RealTimeMetrics,
    },
    BatchUpdate {
        timestamp: chrono::DateTime<chrono::Utc>,
        summaries: Vec<TowerSummary>,
    },
    ServerStatus {
        clients: usize,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    Hello {
        client_id: Uuid,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    Error {
        code: i32,
        message: String,
    },
    Ack {
        id: String,
        ok: bool,
    },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let (client_id, mut rx) = state.add_ws_client();

    info!("WebSocket client connected: {}, total: {}", client_id, state.ws_client_count());

    let hello = WsMessage::Hello {
        client_id,
        timestamp: chrono::Utc::now(),
    };
    if let Ok(json) = serde_json::to_string(&hello) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            match serde_json::to_string(&msg) {
                Ok(json) => {
                    if sender.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    error!("WS serialize error: {}", e);
                }
            }
        }
    });

    let state_c = state.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(t) => {
                    debug!("WS recv text from {}: {}", client_id, t);
                    if let Ok(req) = serde_json::from_str::<serde_json::Value>(&t) {
                        handle_client_message(&state_c, client_id, &req).await;
                    }
                }
                Message::Binary(_) => {}
                Message::Close(_) => {
                    info!("WS client {} close message", client_id);
                    break;
                }
                Message::Ping(_) | Message::Pong(_) => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    state.remove_ws_client(client_id);
    info!("WebSocket client disconnected: {}, remaining: {}", client_id, state.ws_client_count());
}

async fn handle_client_message(state: &Arc<AppState>, client_id: Uuid, msg: &serde_json::Value) {
    if let Some(action) = msg.get("action").and_then(|a| a.as_str()) {
        match action {
            "ping" => {
                // client ping
            }
            "subscribe" => {
                if let Some(id) = msg.get("tower_id").and_then(|v| v.as_str()) {
                    debug!("Client {} subscribed to tower {}", client_id, id);
                }
            }
            "unsubscribe" => {}
            "request_recent" => {
                let towers = state.towers.read();
                let mut summaries = Vec::with_capacity(towers.len());
                for t in towers.iter() {
                    let metrics = state.risk_engine.realtime_metrics(t.id);
                    let risk = state.risk_engine.current_risk(t.id);
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
                let batch = WsMessage::BatchUpdate {
                    timestamp: chrono::Utc::now(),
                    summaries,
                };
                state.broadcast_ws(batch);
            }
            _ => {
                warn!("Unknown WS action '{}' from client {}", action, client_id);
            }
        }
    }
}
