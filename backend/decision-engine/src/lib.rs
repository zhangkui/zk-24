use chrono::{Duration, Utc};
use dashmap::DashMap;
use parking_lot::RwLock;
use std::collections::VecDeque;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use data_models::*;
use risk_engine::{RiskEngine, RiskThresholds};

pub const DECISION_SUBJECT: &str = "decision.shutdown";
pub const STRATEGY_SUBJECT: &str = "strategy.execution";

pub struct DecisionEngine {
    nats: async_nats::Client,
    risk_engine: std::sync::Arc<RiskEngine>,
    active_decisions: DashMap<Uuid, RwLock<ShutdownDecision>>,
    decision_history: VecDeque<ShutdownDecision>,
    strategies: DashMap<Uuid, EmergencyStrategy>,
    config: DecisionConfig,
}

#[derive(Clone)]
pub struct DecisionConfig {
    pub require_human_approval: bool,
    pub auto_execute_level: RiskLevel,
    pub cooldown_minutes: i64,
    pub section_overlap_check: bool,
    pub passenger_handling_default: PassengerHandling,
}

impl Default for DecisionConfig {
    fn default() -> Self {
        Self {
            require_human_approval: true,
            auto_execute_level: RiskLevel::Extreme,
            cooldown_minutes: 30,
            section_overlap_check: true,
            passenger_handling_default: PassengerHandling {
                unload_passengers: true,
                hold_in_stations: true,
                ground_transport_arranged: true,
                estimated_wait_minutes: 60,
            },
        }
    }
}

impl DecisionEngine {
    pub fn new(
        nats: async_nats::Client,
        risk_engine: std::sync::Arc<RiskEngine>,
        config: DecisionConfig,
    ) -> Self {
        Self {
            nats,
            risk_engine,
            active_decisions: DashMap::new(),
            decision_history: VecDeque::with_capacity(1000),
            strategies: DashMap::new(),
            config,
        }
    }

    pub fn add_default_strategies(&self) {
        let s1 = EmergencyStrategy {
            id: Uuid::new_v4(),
            name: "严重覆冰自动停运策略".to_string(),
            trigger_conditions: vec![
                StrategyCondition {
                    condition_type: "ice_thickness".to_string(),
                    operator: ">=".to_string(),
                    threshold: 40.0,
                    duration_seconds: 180,
                },
            ],
            actions: vec![
                StrategyAction {
                    action_type: "suspend_section".to_string(),
                    target: "all".to_string(),
                    parameters: serde_json::json!({"speed": 0}),
                    notify: vec!["operator".to_string(), "maintenance".to_string(), "security".to_string()],
                },
                StrategyAction {
                    action_type: "trigger_video_verification".to_string(),
                    target: "all_cameras".to_string(),
                    parameters: serde_json::json!({"priority": "emergency"}),
                    notify: vec!["dispatch".to_string()],
                },
            ],
            escalation_rules: vec![
                EscalationRule { after_minutes: 10, escalate_to: "maintenance_manager".to_string(), action: "onsite_check".to_string() },
                EscalationRule { after_minutes: 30, escalate_to: "operations_director".to_string(), action: "status_meeting".to_string() },
            ],
            enabled: true,
            version: 1,
            created_at: Utc::now(),
        };
        self.strategies.insert(s1.id, s1);

        let s2 = EmergencyStrategy {
            id: Uuid::new_v4(),
            name: "强风减载策略".to_string(),
            trigger_conditions: vec![
                StrategyCondition {
                    condition_type: "wind_speed".to_string(),
                    operator: ">=".to_string(),
                    threshold: 18.0,
                    duration_seconds: 300,
                },
            ],
            actions: vec![
                StrategyAction {
                    action_type: "reduce_speed".to_string(),
                    target: "all".to_string(),
                    parameters: serde_json::json!({"target_speed_pct": 50}),
                    notify: vec!["operator".to_string()],
                },
            ],
            escalation_rules: vec![
                EscalationRule { after_minutes: 20, escalate_to: "operator_supervisor".to_string(), action: "continuous_monitor".to_string() },
            ],
            enabled: true,
            version: 1,
            created_at: Utc::now(),
        };
        self.strategies.insert(s2.id, s2);

        let s3 = EmergencyStrategy {
            id: Uuid::new_v4(),
            name: "冰风组合极端风险策略".to_string(),
            trigger_conditions: vec![
                StrategyCondition { condition_type: "composite_score".to_string(), operator: ">=".to_string(), threshold: 80.0, duration_seconds: 60 },
            ],
            actions: vec![
                StrategyAction {
                    action_type: "emergency_stop".to_string(),
                    target: "all".to_string(),
                    parameters: serde_json::json!({"evacuate": true}),
                    notify: vec!["operator".to_string(), "security".to_string(), "emergency_response".to_string(), "public_relations".to_string()],
                },
            ],
            escalation_rules: vec![
                EscalationRule { after_minutes: 0, escalate_to: "emergency_coordinator".to_string(), action: "activate_emergency_ops".to_string() },
            ],
            enabled: true,
            version: 1,
            created_at: Utc::now(),
        };
        self.strategies.insert(s3.id, s3);

        info!("Loaded {} emergency strategies", self.strategies.len());
    }

    pub async fn generate_decision(&self, assessment: &IcingRiskAssessment) -> Option<ShutdownDecision> {
        if self.in_cooldown(assessment.tower_id) {
            debug!("Decision in cooldown for tower {}, skipping", assessment.tower_id);
            return None;
        }

        let mut reasons: Vec<DecisionReason> = Vec::new();
        let thresholds = RiskThresholds::default();

        if assessment.ice_thickness > thresholds.ice_critical_mm {
            reasons.push(DecisionReason {
                code: "ICE_CRITICAL".to_string(),
                metric: "ice_thickness".to_string(),
                threshold: thresholds.ice_critical_mm,
                actual: assessment.ice_thickness,
                severity: if assessment.ice_thickness > thresholds.ice_extreme_mm { RiskLevel::Extreme } else { RiskLevel::High },
                description: format!("覆冰厚度 {:.1}mm 危急/极限", assessment.ice_thickness),
            });
        } else if assessment.ice_thickness > thresholds.ice_warning_mm {
            reasons.push(DecisionReason {
                code: "ICE_WARNING".to_string(),
                metric: "ice_thickness".to_string(),
                threshold: thresholds.ice_warning_mm,
                actual: assessment.ice_thickness,
                severity: RiskLevel::Medium,
                description: format!("覆冰厚度 {:.1}mm 告警", assessment.ice_thickness),
            });
        }

        if assessment.wind_speed > thresholds.wind_critical_ms {
            reasons.push(DecisionReason {
                code: "WIND_CRITICAL".to_string(),
                metric: "wind_speed".to_string(),
                threshold: thresholds.wind_critical_ms,
                actual: assessment.wind_speed,
                severity: if assessment.wind_speed > thresholds.wind_extreme_ms { RiskLevel::Extreme } else { RiskLevel::High },
                description: format!("风速 {:.1}m/s 危急/极限", assessment.wind_speed),
            });
        } else if assessment.wind_speed > thresholds.wind_warning_ms {
            reasons.push(DecisionReason {
                code: "WIND_WARNING".to_string(),
                metric: "wind_speed".to_string(),
                threshold: thresholds.wind_warning_ms,
                actual: assessment.wind_speed,
                severity: RiskLevel::Medium,
                description: format!("风速 {:.1}m/s 告警", assessment.wind_speed),
            });
        }

        if assessment.vibration_level > thresholds.vib_critical_mm_s2 {
            reasons.push(DecisionReason {
                code: "VIB_CRITICAL".to_string(),
                metric: "vibration".to_string(),
                threshold: thresholds.vib_critical_mm_s2,
                actual: assessment.vibration_level,
                severity: if assessment.vibration_level > thresholds.vib_extreme_mm_s2 { RiskLevel::Extreme } else { RiskLevel::High },
                description: format!("振动加速度 {:.1}mm/s² 超限", assessment.vibration_level),
            });
        }

        if assessment.load_percentage > thresholds.load_critical_pct {
            reasons.push(DecisionReason {
                code: "LOAD_CRITICAL".to_string(),
                metric: "load_percentage".to_string(),
                threshold: thresholds.load_critical_pct,
                actual: assessment.load_percentage,
                severity: if assessment.load_percentage > thresholds.load_extreme_pct { RiskLevel::Extreme } else { RiskLevel::High },
                description: format!("结构载荷 {:.1}% 超限", assessment.load_percentage),
            });
        }

        if reasons.is_empty() && assessment.risk_level == RiskLevel::Safe {
            return None;
        }

        let max_severity = reasons.iter()
            .map(|r| r.severity.score())
            .max()
            .unwrap_or(assessment.risk_level.score());
        let effective_severity = RiskLevel::from_score(max_severity.max(assessment.risk_level.score()));

        let (decision_type, priority, recommended_action, estimated_duration) =
            determine_action(&effective_severity, &assessment);

        let needs_human = self.config.require_human_approval
            && effective_severity.score() < self.config.auto_execute_level.score();

        let status = if needs_human {
            DecisionStatus::PendingApproval
        } else {
            DecisionStatus::Approved
        };

        let decision = ShutdownDecision {
            id: Uuid::new_v4(),
            tower_id: assessment.tower_id,
            decision_time: Utc::now(),
            decision_type,
            priority,
            trigger_reasons: reasons,
            risk_evidence: vec![assessment.id],
            recommended_action,
            estimated_duration_minutes: estimated_duration,
            affected_sections: vec![],
            passenger_handling: self.config.passenger_handling_default.clone(),
            estimated_impact: determine_impact(&effective_severity),
            auto_generated: true,
            status,
            approver_id: None,
            approved_at: if !needs_human { Some(Utc::now()) } else { None },
            comments: None,
            executed: false,
            executed_at: None,
            executor_id: None,
        };

        info!(
            "Generated decision {} for tower {} level={:?} action={:?} status={:?}",
            decision.id, assessment.tower_id, effective_severity,
            decision.recommended_action, decision.status
        );

        Some(decision)
    }

    fn in_cooldown(&self, tower_id: Uuid) -> bool {
        let cutoff = Utc::now() - Duration::minutes(self.config.cooldown_minutes);
        self.decision_history.iter()
            .filter(|d| d.tower_id == tower_id)
            .any(|d| d.decision_time > cutoff)
    }

    pub async fn publish_decision(&self, decision: &ShutdownDecision) -> anyhow::Result<()> {
        let subject = format!("{}.{}", DECISION_SUBJECT, decision.tower_id);
        let payload = serde_json::to_vec(decision)?;
        self.nats.publish(subject, payload.into()).await?;
        let all = format!("{}.all", DECISION_SUBJECT);
        self.nats.publish(all, payload.into()).await?;

        self.active_decisions.insert(decision.id, RwLock::new(decision.clone()));

        let mut hist = VecDeque::new();
        std::mem::swap(&mut hist, &mut unsafe {
            std::ptr::read(&self.decision_history)
        });
        hist.push_back(decision.clone());
        while hist.len() > 1000 { hist.pop_front(); }
        unsafe { std::ptr::write(&self.decision_history, hist); }

        Ok(())
    }

    pub fn approve_decision(&self, decision_id: Uuid, approver_id: Uuid) -> Option<ShutdownDecision> {
        let entry = self.active_decisions.get_mut(&decision_id)?;
        let mut d = entry.value_mut().write();
        if matches!(d.status, DecisionStatus::PendingApproval | DecisionStatus::Draft) {
            d.status = DecisionStatus::Approved;
            d.approver_id = Some(approver_id);
            d.approved_at = Some(Utc::now());
        }
        Some(d.clone())
    }

    pub fn reject_decision(&self, decision_id: Uuid, approver_id: Uuid, reason: &str) -> Option<ShutdownDecision> {
        let entry = self.active_decisions.get_mut(&decision_id)?;
        let mut d = entry.value_mut().write();
        if matches!(d.status, DecisionStatus::PendingApproval) {
            d.status = DecisionStatus::Rejected;
            d.approver_id = Some(approver_id);
            d.comments = Some(reason.to_string());
        }
        Some(d.clone())
    }

    pub fn execute_decision(&self, decision_id: Uuid, executor_id: Uuid) -> Option<ShutdownDecision> {
        let entry = self.active_decisions.get_mut(&decision_id)?;
        let mut d = entry.value_mut().write();
        if matches!(d.status, DecisionStatus::Approved) {
            d.status = DecisionStatus::Executed;
            d.executed = true;
            d.executed_at = Some(Utc::now());
            d.executor_id = Some(executor_id);
            info!("Decision {} executed by {}", decision_id, executor_id);
        }
        Some(d.clone())
    }

    pub fn active_decisions_for_tower(&self, tower_id: Uuid) -> Vec<ShutdownDecision> {
        self.active_decisions.iter()
            .filter(|r| r.value().read().tower_id == tower_id)
            .filter(|r| matches!(r.value().read().status,
                DecisionStatus::PendingApproval | DecisionStatus::Approved))
            .map(|r| r.value().read().clone())
            .collect()
    }

    pub fn all_active_decisions(&self) -> Vec<ShutdownDecision> {
        self.active_decisions.iter()
            .filter(|r| matches!(r.value().read().status,
                DecisionStatus::PendingApproval | DecisionStatus::Approved))
            .map(|r| r.value().read().clone())
            .collect()
    }

    pub fn recent_history(&self, limit: usize) -> Vec<ShutdownDecision> {
        self.decision_history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    pub fn list_strategies(&self) -> Vec<EmergencyStrategy> {
        self.strategies.iter().map(|r| r.value().clone()).collect()
    }

    pub async fn check_and_apply_strategies(&self, assessment: &IcingRiskAssessment) -> Vec<StrategyExecutionLog> {
        let mut logs = Vec::new();
        for strategy in self.strategies.iter() {
            if !strategy.enabled { continue; }
            if self.conditions_met(&strategy.value().trigger_conditions, assessment) {
                let log = StrategyExecutionLog {
                    id: Uuid::new_v4(),
                    strategy_id: strategy.id,
                    tower_id: assessment.tower_id,
                    execution_time: Utc::now(),
                    matched_conditions: strategy.value().trigger_conditions.iter()
                        .map(|c| c.condition_type.clone())
                        .collect(),
                    executed_actions: strategy.value().actions.iter()
                        .map(|a| a.action_type.clone())
                        .collect(),
                    success: true,
                    error_message: None,
                };
                info!("Strategy '{}' triggered for tower {}", strategy.value().name, assessment.tower_id);
                let _ = self.publish_strategy_log(&log).await;
                logs.push(log);
            }
        }
        logs
    }

    fn conditions_met(&self, conditions: &[StrategyCondition], assessment: &IcingRiskAssessment) -> bool {
        for c in conditions {
            let value = match c.condition_type.as_str() {
                "ice_thickness" => assessment.ice_thickness,
                "wind_speed" => assessment.wind_speed,
                "vibration_level" => assessment.vibration_level,
                "load_percentage" => assessment.load_percentage,
                "composite_score" => assessment.composite_score,
                _ => 0.0,
            };
            let met = match c.operator.as_str() {
                ">=" => value >= c.threshold,
                ">" => value > c.threshold,
                "<=" => value <= c.threshold,
                "<" => value < c.threshold,
                "==" => (value - c.threshold).abs() < 0.001,
                _ => false,
            };
            if !met { return false; }
        }
        true
    }

    async fn publish_strategy_log(&self, log: &StrategyExecutionLog) -> anyhow::Result<()> {
        let payload = serde_json::to_vec(log)?;
        self.nats.publish(STRATEGY_SUBJECT.to_string(), payload.into()).await?;
        Ok(())
    }
}

fn determine_action(
    severity: &RiskLevel,
    assessment: &IcingRiskAssessment,
) -> (DecisionType, DecisionPriority, RecommendedAction, u32) {
    match severity {
        RiskLevel::Safe => {
            (DecisionType::Advisory, DecisionPriority::Informational,
                RecommendedAction::NormalOperation, 0)
        }
        RiskLevel::Low => {
            (DecisionType::Advisory, DecisionPriority::Low,
                RecommendedAction::NormalOperation, 0)
        }
        RiskLevel::Medium => {
            if assessment.ice_thickness > 15.0 {
                (DecisionType::Recommended, DecisionPriority::Medium,
                    RecommendedAction::ReduceCapacity, 60)
            } else {
                (DecisionType::Recommended, DecisionPriority::Medium,
                    RecommendedAction::ReduceSpeed, 45)
            }
        }
        RiskLevel::High => {
            if assessment.composite_score > 70.0 {
                (DecisionType::Mandatory, DecisionPriority::High,
                    RecommendedAction::FullSuspend, 120)
            } else {
                (DecisionType::Mandatory, DecisionPriority::High,
                    RecommendedAction::SuspendSection { sections: vec![] }, 90)
            }
        }
        RiskLevel::Extreme => {
            (DecisionType::Emergency, DecisionPriority::Critical,
                RecommendedAction::EmergencyStop, 240)
        }
    }
}

fn determine_impact(severity: &RiskLevel) -> OperationalImpact {
    match severity {
        RiskLevel::Safe => OperationalImpact::NoImpact,
        RiskLevel::Low => OperationalImpact::NoImpact,
        RiskLevel::Medium => OperationalImpact::Delay30Min,
        RiskLevel::High => OperationalImpact::Delay2Hours,
        RiskLevel::Extreme => OperationalImpact::Indefinite,
    }
}
