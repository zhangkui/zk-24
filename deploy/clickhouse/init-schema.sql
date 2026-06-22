-- ============================================================
-- 山地索道塔架监测平台 - ClickHouse 初始化 Schema
-- 部署于边缘服务器，所有数据本地驻留，定期归档汇总
-- ============================================================

CREATE DATABASE IF NOT EXISTS cableway_monitor
    COMMENT '山地索道塔架振动结冰联动监测数据库'
    ENGINE = Atomic;

USE cableway_monitor;

-- ------------------------------
-- 塔架点位建模
-- ------------------------------
CREATE TABLE IF NOT EXISTS tower_points (
    id UUID,
    code String,
    name String,
    line_name String,
    line_side Enum('Upbound' = 1, 'Downbound' = 2, 'Common' = 3),
    sequence_number Int32,
    altitude_m Float64,
    longitude Float64,
    latitude Float64,
    height_m Float64,
    base_elevation_m Float64,
    top_elevation_m Float64,
    structure_type Enum('Truss' = 1, 'Lattice' = 2, 'Pole' = 3, 'A_Frame' = 4, 'Hybrid' = 5),
    material Enum('Steel' = 1, 'Concrete' = 2, 'Composite' = 3, 'Wood' = 4),
    design_ice_load_kg_m2 Float64,
    design_wind_speed_m_s Float64,
    installed_at DateTime64(3),
    last_maintenance_at Nullable(DateTime64(3)),
    next_maintenance_at Nullable(DateTime64(3)),
    status Enum('Active' = 1, 'Degraded' = 2, 'UnderMaintenance' = 3, 'Decommissioned' = 4),
    created_at DateTime64(3) DEFAULT now64(3),
    updated_at DateTime64(3) DEFAULT now64(3),
    PRIMARY KEY (id)
) ENGINE = MergeTree()
ORDER BY (id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 传感器注册
-- ------------------------------
CREATE TABLE IF NOT EXISTS sensors (
    id UUID,
    tower_id UUID,
    code String,
    sensor_type Enum8('Accelerometer' = 1, 'StrainGauge' = 2, 'Anemometer' = 3, 'Thermometer' = 4,
                       'Hygrometer' = 5, 'Barometer' = 6, 'IceSensor' = 7, 'LoadCell' = 8, 'CableTension' = 9,
                       'GNSS' = 10, 'Inclinometer' = 11, 'Video' = 12, 'RainGauge' = 13),
    position String,
    install_height_m Float64,
    manufacturer Nullable(String),
    model Nullable(String),
    serial_number Nullable(String),
    calibrated_at DateTime64(3),
    next_calibration_at DateTime64(3),
    status Enum8('Operational' = 1, 'Degraded' = 2, 'Faulty' = 3, 'Offline' = 4, 'InCalibration' = 5),
    sampling_rate_hz Float64,
    range_min Nullable(Float64),
    range_max Nullable(Float64),
    created_at DateTime64(3) DEFAULT now64(3),
    PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (id, tower_id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 高频振动数据 (100Hz 采样, 10秒窗口, 分区存储 6个月)
-- ------------------------------
CREATE TABLE IF NOT EXISTS vibration_data (
    tower_id UUID,
    sensor_id UUID,
    timestamp DateTime64(9, 'Asia/Shanghai'),
    frequency_hz Float64,
    amplitude_mm_s Float64,
    displacement_mm Float64,
    velocity_mm_s Float64,
    acceleration_m_s2 Float64,
    axis Enum8('X' = 1, 'Y' = 2, 'Z' = 3, 'Combined' = 4),
    temperature_c Float64,
    quality Enum8('Good' = 1, 'Suspicious' = 2, 'Bad' = 3),
    project_id String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (tower_id, sensor_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 风速数据 (1Hz 平均, 1年保存)
-- ------------------------------
CREATE TABLE IF NOT EXISTS wind_data (
    tower_id UUID,
    sensor_id UUID,
    timestamp DateTime64(3, 'Asia/Shanghai'),
    speed_m_s Float64,
    direction_deg Float64,
    gust_m_s Float64,
    temperature_c Float64,
    humidity_pct Float64,
    pressure_hpa Float64,
    weibull_k Float64,
    weibull_c Float64,
    quality Enum8('Good' = 1, 'Suspicious' = 2, 'Bad' = 3),
    project_id String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tower_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 覆冰监测数据 (10秒采样, 2年保存)
-- ------------------------------
CREATE TABLE IF NOT EXISTS ice_data (
    tower_id UUID,
    sensor_id UUID,
    timestamp DateTime64(3, 'Asia/Shanghai'),
    ice_thickness_mm Float64,
    ice_weight_kg_m2 Float64,
    ice_density_kg_m3 Float64,
    ice_type Enum8('Rime' = 1, 'Glaze' = 2, 'Mixed' = 3, 'HoarFrost' = 4, 'SnowLoad' = 5, 'WetSnow' = 6, 'Sleet' = 7, 'Unknown' = 0),
    adhesion_strength_kpa Nullable(Float64),
    temperature_c Float64,
    humidity_pct Float64,
    wind_speed_m_s Float64,
    liquid_water_content_g_m3 Float64,
    median_volume_diameter_um Float64,
    quality Enum8('Good' = 1, 'Suspicious' = 2, 'Bad' = 3),
    project_id String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tower_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 730 DAY
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 风险评估结果 (10秒, 5年保存)
-- ------------------------------
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID,
    tower_id UUID,
    timestamp DateTime64(3, 'Asia/Shanghai'),
    risk_level Enum8('Safe' = 1, 'Low' = 2, 'Medium' = 3, 'High' = 4, 'Extreme' = 5),
    overall_score Float64,
    ice_score Float64,
    wind_score Float64,
    vibration_score Float64,
    load_score Float64,
    ice_thickness_mm Float64,
    wind_speed_m_s Float64,
    vibration_level Float64,
    resonance_detected Bool,
    primary_factor String,
    trend Enum8('Stable' = 1, 'Improving' = 2, 'Worsening' = 3, 'CriticalRising' = 4),
    fft_data String,
    recommendations Array(String),
    project_id String DEFAULT '',
    created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tower_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 1825 DAY
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 决策记录
-- ------------------------------
CREATE TABLE IF NOT EXISTS decisions (
    id UUID,
    tower_id UUID,
    strategy_id String,
    strategy_name String,
    decision_type Enum8('ScheduledMaintenance' = 1, 'SpeedReduction' = 2, 'SectionShutdown' = 3, 'FullShutdown' = 4,
                        'Evacuation' = 5, 'IceRemovalActivation' = 6, 'IncreaseMonitoring' = 7, 'AllClear' = 8),
    trigger_risk_level Enum8('Safe' = 1, 'Low' = 2, 'Medium' = 3, 'High' = 4, 'Extreme' = 5),
    severity Enum8('Information' = 1, 'Warning' = 2, 'Critical' = 3, 'Emergency' = 4),
    status Enum8('Pending' = 1, 'PendingApproval' = 2, 'Approved' = 3, 'Rejected' = 4,
                 'Executing' = 5, 'Completed' = 6, 'Expired' = 7),
    requires_approval Bool,
    approved_by Nullable(String),
    approved_at Nullable(DateTime64(3)),
    generated_at DateTime64(3),
    executed_at Nullable(DateTime64(3)),
    completed_at Nullable(DateTime64(3)),
    reasoning String,
    affected_sections Array(String),
    estimated_duration_minutes Nullable(Int32),
    actions Array(String),
    project_id String DEFAULT '',
    PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree(generated_at)
ORDER BY (id, tower_id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 巡检记录 (永久保留)
-- ------------------------------
CREATE TABLE IF NOT EXISTS inspections (
    id UUID,
    tower_id UUID,
    inspection_type Enum8('Routine' = 1, 'PostStorm' = 2, 'PostIcing' = 3, 'ScheduledMaintenance' = 4,
                          'EmergencyInspection' = 5, 'Annual' = 6),
    inspector_name String,
    inspector_id String,
    planned_date DateTime64(3),
    started_at Nullable(DateTime64(3)),
    completed_at Nullable(DateTime64(3)),
    status Enum8('Scheduled' = 1, 'InProgress' = 2, 'Completed' = 3, 'Cancelled' = 4, 'RequiresFollowUp' = 5),
    overall_condition Enum8('Excellent' = 1, 'Good' = 2, 'Fair' = 3, 'Poor' = 4, 'Critical' = 5),
    findings String,
    photos Array(String),
    weather_conditions String,
    notes Nullable(String),
    follow_up_required Bool DEFAULT false,
    follow_up_date Nullable(DateTime64(3)),
    signed_off Bool DEFAULT false,
    signed_off_by Nullable(String),
    signed_off_at Nullable(DateTime64(3)),
    created_at DateTime64(3) DEFAULT now64(3),
    project_id String DEFAULT '',
    PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (id, tower_id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 气象预报与警报
-- ------------------------------
CREATE TABLE IF NOT EXISTS weather_alerts (
    id UUID,
    alert_type Enum8('Blizzard' = 1, 'IceStorm' = 2, 'HighWind' = 3, 'ExtremeCold' = 4,
                     'HeavySnow' = 5, 'FreezingRain' = 6, 'Thunderstorm' = 7, 'Tornado' = 8,
                     'DenseFog' = 9, 'Avalanche' = 10, 'GeneralWarning' = 0),
    severity Enum8('Minor' = 1, 'Moderate' = 2, 'Severe' = 3, 'Extreme' = 4),
    headline String,
    description String,
    affected_area String,
    effective_at DateTime64(3),
    expires_at DateTime64(3),
    source Nullable(String),
    certainty Enum8('Observed' = 1, 'Likely' = 2, 'Possible' = 3, 'Unlikely' = 4),
    created_at DateTime64(3) DEFAULT now64(3),
    project_id String DEFAULT '',
    PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 视频监控点
-- ------------------------------
CREATE TABLE IF NOT EXISTS video_cameras (
    id UUID,
    tower_id UUID,
    name String,
    code String,
    rtsp_url String,
    position String,
    ptz_supported Bool DEFAULT false,
    ai_model_enabled Bool DEFAULT true,
    status Enum8('Online' = 1, 'Offline' = 2, 'Recording' = 3, 'Maintenance' = 4, 'Error' = 5),
    created_at DateTime64(3) DEFAULT now64(3),
    PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (id, tower_id)
SETTINGS index_granularity = 8192;

-- ------------------------------
-- 初始化内置数据
-- ------------------------------
INSERT INTO tower_points (id, code, name, line_name, line_side, sequence_number,
    altitude_m, longitude, latitude, height_m, base_elevation_m, top_elevation_m,
    structure_type, material, design_ice_load_kg_m2, design_wind_speed_m_s,
    installed_at, status) VALUES
    (generateUUIDv4(), 'TWR-0001', 'A1号塔', '主线A', 'Common', 1, 1850.0, 116.39723, 39.90750, 32.0, 1850.0, 1882.0, 'Truss', 'Steel', 30.0, 35.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0002', 'A2号塔', '主线A', 'Common', 2, 2010.0, 116.39820, 39.90980, 45.0, 2010.0, 2055.0, 'Lattice', 'Steel', 35.0, 40.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0003', 'A3号塔', '主线A', 'Common', 3, 2280.0, 116.39950, 39.91210, 58.0, 2280.0, 2338.0, 'Hybrid', 'Composite', 45.0, 42.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0004', 'A4号塔', '主线A', 'Common', 4, 2530.0, 116.40080, 39.91440, 62.0, 2530.0, 2592.0, 'Lattice', 'Steel', 50.0, 45.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0005', 'A5号塔', '主线A', 'Common', 5, 2740.0, 116.40210, 39.91670, 48.0, 2740.0, 2788.0, 'Lattice', 'Steel', 55.0, 48.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0006', 'B1号塔', '支线B', 'Common', 1, 2420.0, 116.40350, 39.91900, 42.0, 2420.0, 2462.0, 'Truss', 'Steel', 40.0, 40.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0007', 'B2号塔', '支线B', 'Common', 2, 2610.0, 116.40480, 39.92130, 55.0, 2610.0, 2665.0, 'Hybrid', 'Composite', 50.0, 42.0, now64(), 'Active'),
    (generateUUIDv4(), 'TWR-0008', 'B3号塔', '支线B', 'Common', 3, 2800.0, 116.40610, 39.92360, 50.0, 2800.0, 2850.0, 'Lattice', 'Steel', 60.0, 50.0, now64(), 'Active');

-- ------------------------------
-- 运维视角：物化视图 (风险事件 Top 聚合)
-- ------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS risk_daily_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tower_id, date, risk_level)
POPULATE
AS SELECT
    tower_id,
    toDate(timestamp) AS date,
    risk_level,
    count() AS event_count,
    max(overall_score) AS max_score,
    avg(overall_score) AS avg_score
FROM risk_assessments
GROUP BY tower_id, date, risk_level;
