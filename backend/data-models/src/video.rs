use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraDevice {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub name: String,
    pub model: String,
    pub ip_address: String,
    pub rtsp_url: String,
    pub hls_url: Option<String>,
    pub location: CameraLocation,
    pub fov_degrees: f64,
    pub resolution: String,
    pub night_vision: bool,
    pub ptz_capable: bool,
    pub online: bool,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub stream_active: bool,
    pub recording_enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CameraLocation {
    Top,
    Middle,
    Base,
    CrossArm,
    CableSaddle,
    Surrounding,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoVerificationRequest {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub risk_event_id: Option<Uuid>,
    pub risk_assessment_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub priority: VerificationPriority,
    pub requested_by: Option<Uuid>,
    pub request_reason: String,
    pub status: VerificationStatus,
    pub camera_ids: Vec<Uuid>,
    pub verifications: Vec<CameraVerification>,
    pub assigned_to: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub final_verdict: Option<VerificationVerdict>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VerificationPriority {
    Routine,
    Normal,
    High,
    Urgent,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VerificationStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VerificationVerdict {
    Confirmed,
    FalseAlarm,
    Inconclusive,
    PartiallyConfirmed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraVerification {
    pub camera_id: Uuid,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub verdict: VerificationVerdict,
    pub ice_visible: Option<bool>,
    pub ice_thickness_estimate_mm: Option<f64>,
    pub snow_present: Option<bool>,
    pub structural_damage: Option<bool>,
    pub notes: Option<String>,
    pub snapshot_url: Option<String>,
    pub ai_detection: Option<AiDetectionResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiDetectionResult {
    pub model_name: String,
    pub detection_time_ms: u32,
    pub detections: Vec<ObjectDetection>,
    pub ice_confidence: Option<f64>,
    pub snow_confidence: Option<f64>,
    pub damage_confidence: Option<f64>,
    pub overall_confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectDetection {
    pub label: String,
    pub confidence: f64,
    pub bbox: BoundingBox,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoSnapshot {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub tower_id: Uuid,
    pub captured_at: DateTime<Utc>,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub storage_path: String,
    pub file_size_bytes: u64,
    pub resolution: String,
    pub ai_analyzed: bool,
    pub linked_request_id: Option<Uuid>,
    pub linked_risk_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraPreset {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub name: String,
    pub pan: f64,
    pub tilt: f64,
    pub zoom: f64,
    pub focus: Option<f64>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSegment {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub tower_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub url: String,
    pub storage_path: String,
    pub file_size_bytes: u64,
    pub duration_seconds: u32,
    pub event_triggered: bool,
    pub linked_event_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtzControlCommand {
    pub camera_id: Uuid,
    pub command: PtzCommand,
    pub speed: Option<f64>,
    pub value: Option<f64>,
    pub preset_id: Option<Uuid>,
    pub requested_by: Uuid,
    pub requested_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PtzCommand {
    PanLeft,
    PanRight,
    TiltUp,
    TiltDown,
    ZoomIn,
    ZoomOut,
    GoToPreset,
    Stop,
}
