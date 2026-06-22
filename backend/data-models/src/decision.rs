use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{HasTimestamp, HasTowerId, RiskLevel};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShutdownDecision {
    pub id: Uuid,
    pub tower_id: Uuid,
    pub decision_time: DateTime<Utc>,
    pub decision_type: DecisionType,
    pub priority: DecisionPriority,
    pub trigger_reasons: Vec<DecisionReason>,
    pub risk_evidence: Vec<Uuid>,
    pub recommended_action: RecommendedAction,
    pub estimated_duration_minutes: u32,
    pub affected_sections: Vec<String>,
    pub passenger_handling: PassengerHandling,
    pub estimated_impact: OperationalImpact,
    pub auto_generated: bool,
    pub status: DecisionStatus,
    pub approver_id: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub comments: Option<String>,
    pub executed: bool,
    pub executed_at: Option<DateTime<Utc>>,
    pub executor_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionType {
    Advisory,
    Recommended,
    Mandatory,
    Emergency,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionPriority {
    Informational,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionReason {
    pub code: String,
    pub metric: String,
    pub threshold: f64,
    pub actual: f64,
    pub severity: RiskLevel,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecommendedAction {
    NormalOperation,
    ReduceSpeed,
    ReduceCapacity,
    SuspendSection { sections: Vec<u32> },
    FullSuspend,
    EmergencyStop,
    Evacuate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassengerHandling {
    pub unload_passengers: bool,
    pub hold_in_stations: bool,
    pub ground_transport_arranged: bool,
    pub estimated_wait_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationalImpact {
    NoImpact,
    Delay10Min,
    Delay30Min,
    Delay1Hour,
    Delay2Hours,
    Indefinite,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DecisionStatus {
    Draft,
    PendingApproval,
    Approved,
    Rejected,
    Executed,
    Cancelled,
    Expired,
}

impl HasTimestamp for ShutdownDecision {
    fn timestamp(&self) -> DateTime<Utc> { self.decision_time }
}

impl HasTowerId for ShutdownDecision {
    fn tower_id(&self) -> Uuid { self.tower_id }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyStrategy {
    pub id: Uuid,
    pub name: String,
    pub trigger_conditions: Vec<StrategyCondition>,
    pub actions: Vec<StrategyAction>,
    pub escalation_rules: Vec<EscalationRule>,
    pub enabled: bool,
    pub version: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyCondition {
    pub condition_type: String,
    pub operator: String,
    pub threshold: f64,
    pub duration_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyAction {
    pub action_type: String,
    pub target: String,
    pub parameters: serde_json::Value,
    pub notify: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationRule {
    pub after_minutes: u32,
    pub escalate_to: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyExecutionLog {
    pub id: Uuid,
    pub strategy_id: Uuid,
    pub tower_id: Uuid,
    pub execution_time: DateTime<Utc>,
    pub matched_conditions: Vec<String>,
    pub executed_actions: Vec<String>,
    pub success: bool,
    pub error_message: Option<String>,
}
