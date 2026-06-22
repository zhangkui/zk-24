use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HasTimestamp, HasTowerId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionRecord {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub inspection_type: InspectionType,
    pub inspector_id: Uuid,
    pub inspector_name: String,
    pub planned_date: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: InspectionStatus,
    pub findings: Vec<InspectionFinding>,
    pub overall_condition: ConditionRating,
    pub ice_observation: IceObservation,
    pub structural_checks: StructuralChecks,
    pub sensor_calibration: Vec<SensorCalibration>,
    pub maintenance_actions: Vec<MaintenanceAction>,
    pub photos: Vec<InspectionPhoto>,
    pub weather_conditions: String,
    pub notes: Option<String>,
    pub follow_up_required: bool,
    pub follow_up_date: Option<DateTime<Utc>>,
    pub signed_off: bool,
    pub signed_off_by: Option<Uuid>,
    pub signed_off_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InspectionType {
    Routine,
    PostStorm,
    PostIcing,
    ScheduledMaintenance,
    EmergencyInspection,
    Annual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InspectionStatus {
    Scheduled,
    InProgress,
    Completed,
    Cancelled,
    RequiresFollowUp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConditionRating {
    Excellent,
    Good,
    Fair,
    Poor,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionFinding {
    pub id: Uuid,
    pub category: String,
    pub severity: FindingSeverity,
    pub description: String,
    pub location: String,
    pub photo_ids: Vec<Uuid>,
    pub resolved: bool,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FindingSeverity {
    Cosmetic,
    Minor,
    Moderate,
    Major,
    SafetyCritical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceObservation {
    pub ice_present: bool,
    pub thickness_mm: f64,
    pub ice_type: String,
    pub distribution: String,
    pub shedding_observed: bool,
    pub ambient_temp_c: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralChecks {
    pub foundation: ConditionRating,
    pub base_section: ConditionRating,
    pub middle_section: ConditionRating,
    pub top_section: ConditionRating,
    pub cross_arms: ConditionRating,
    pub cable_attachments: ConditionRating,
    pub bolts_and_fasteners: ConditionRating,
    pub corrosion_present: bool,
    pub corrosion_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorCalibration {
    pub sensor_id: Uuid,
    pub sensor_type: String,
    pub calibration_required: bool,
    pub calibration_performed: bool,
    pub offset_adjusted: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceAction {
    pub id: Uuid,
    pub action_type: String,
    pub description: String,
    pub materials_used: Vec<String>,
    pub duration_minutes: u32,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionPhoto {
    pub id: Uuid,
    pub url: String,
    pub caption: String,
    pub location_tag: String,
    pub uploaded_at: DateTime<Utc>,
}

impl HasTimestamp for InspectionRecord {
    fn timestamp(&self) -> DateTime<Utc> { self.planned_date }
}

impl HasTowerId for InspectionRecord {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceSchedule {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub schedule_type: String,
    pub last_performed: Option<DateTime<Utc>>,
    pub next_due: DateTime<Utc>,
    pub interval_days: u32,
    pub assigned_to: Option<Uuid>,
    pub description: String,
    pub checklist: Vec<String>,
}
