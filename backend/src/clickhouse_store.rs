use crate::state::ChClient;
use anyhow::Result;
use data_models::*;
use tracing::{error, info, warn};

pub async fn init_schema(client: ChClient) -> Result<()> {
    let db = "cableway_monitor";
    let _ = client.execute(&format!("CREATE DATABASE IF NOT EXISTS {}", db)).await;

    let tables = vec![
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.vibration_data (
            id UUID,
            tower_id UUID,
            sensor_id UUID,
            timestamp DateTime64(9, 'UTC'),
            frequency Float64,
            amplitude_x Float64,
            amplitude_y Float64,
            amplitude_z Float64,
            velocity Float64,
            acceleration Float64,
            displacement Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (tower_id, sensor_id, timestamp)
        TTL timestamp + INTERVAL 1 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.wind_data (
            id UUID,
            tower_id UUID,
            sensor_id UUID,
            timestamp DateTime64(9, 'UTC'),
            speed Float64,
            direction Float64,
            gust_speed Float64,
            temperature Nullable(Float64),
            pressure Nullable(Float64)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (tower_id, sensor_id, timestamp)
        TTL timestamp + INTERVAL 1 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.ice_sensor_data (
            id UUID,
            tower_id UUID,
            sensor_id UUID,
            timestamp DateTime64(9, 'UTC'),
            ice_thickness Float64,
            ice_weight Nullable(Float64),
            temperature Float64,
            humidity Float64,
            precipitation Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (tower_id, sensor_id, timestamp)
        TTL timestamp + INTERVAL 1 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.strain_data (
            id UUID,
            tower_id UUID,
            sensor_id UUID,
            timestamp DateTime64(9, 'UTC'),
            strain_value Float64,
            stress_value Float64,
            load_value Nullable(Float64),
            temperature Float64
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (tower_id, sensor_id, timestamp)
        TTL timestamp + INTERVAL 1 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.weather_data (
            id UUID,
            tower_id UUID,
            timestamp DateTime64(9, 'UTC'),
            temperature_c Float64,
            feels_like_c Float64,
            humidity_pct Float64,
            pressure_hpa Float64,
            wind_speed_ms Float64,
            wind_direction_deg Float64,
            wind_gust_ms Float64,
            precipitation_mm Float64,
            precipitation_type LowCardinality(String),
            snow_depth_cm Nullable(Float64),
            cloud_cover_pct Nullable(Float64),
            visibility_km Nullable(Float64),
            source LowCardinality(String)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (tower_id, timestamp)
        TTL timestamp + INTERVAL 2 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.risk_assessments (
            id UUID,
            tower_id UUID,
            assessment_time DateTime64(9, 'UTC'),
            ice_thickness Float64,
            wind_speed Float64,
            vibration_level Float64,
            temperature Float64,
            humidity Float64,
            composite_score Float64,
            risk_level LowCardinality(String),
            load_percentage Float64,
            reviewed UInt8
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(assessment_time)
        ORDER BY (tower_id, assessment_time)
        TTL assessment_time + INTERVAL 3 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.risk_events (
            id UUID,
            tower_id UUID,
            event_time DateTime64(9, 'UTC'),
            event_type LowCardinality(String),
            severity LowCardinality(String),
            description String,
            threshold_value Float64,
            actual_value Float64,
            unit LowCardinality(String),
            acknowledged UInt8,
            resolved UInt8
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(event_time)
        ORDER BY (tower_id, event_time)
        TTL event_time + INTERVAL 5 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.shutdown_decisions (
            id UUID,
            tower_id UUID,
            decision_time DateTime64(9, 'UTC'),
            decision_type LowCardinality(String),
            priority LowCardinality(String),
            risk_level LowCardinality(String),
            recommended_action String,
            estimated_duration_minutes UInt32,
            status LowCardinality(String),
            auto_generated UInt8,
            executed UInt8
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(decision_time)
        ORDER BY (tower_id, decision_time)
        TTL decision_time + INTERVAL 5 YEAR
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS cableway_monitor.inspection_records (
            id UUID,
            tower_id UUID,
            inspection_type LowCardinality(String),
            planned_date DateTime64(9, 'UTC'),
            started_at Nullable(DateTime64(9, 'UTC')),
            completed_at Nullable(DateTime64(9, 'UTC')),
            status LowCardinality(String),
            overall_condition LowCardinality(String),
            ice_thickness_mm Float64,
            notes Nullable(String),
            signed_off UInt8
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(planned_date)
        ORDER BY (tower_id, planned_date)
        TTL planned_date + INTERVAL 10 YEAR
        "#,
    ];

    for sql in tables {
        match client.execute(sql).await {
            Ok(_) => {}
            Err(e) => {
                warn!("ClickHouse table creation warning: {}", e);
            }
        }
    }

    info!("ClickHouse schema initialized");
    Ok(())
}

pub async fn write_vibration(client: ChClient, data: &VibrationData) -> Result<()> {
    let query = r#"
        INSERT INTO cableway_monitor.vibration_data
        (id, tower_id, sensor_id, timestamp, frequency,
         amplitude_x, amplitude_y, amplitude_z, velocity, acceleration, displacement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#;
    client.execute(query
        .replace('?', &format!("'{}'", data.id))
        .replacen("?", &format!("'{}'", data.tower_id), 1)
    ).await.ok();
    Ok(())
}

pub async fn write_wind(client: ChClient, data: &WindData) -> Result<()> {
    Ok(())
}

pub async fn write_ice(client: ChClient, data: &IceSensorData) -> Result<()> {
    Ok(())
}

pub async fn write_strain(client: ChClient, data: &StrainData) -> Result<()> {
    Ok(())
}

pub async fn write_weather(client: ChClient, data: &WeatherData) -> Result<()> {
    Ok(())
}
