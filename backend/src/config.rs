use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_nats_url")]
    pub nats_url: String,
    #[serde(default = "default_clickhouse_url")]
    pub clickhouse_url: String,
    #[serde(default = "default_clickhouse_user")]
    pub clickhouse_user: String,
    #[serde(default = "default_clickhouse_pass")]
    pub clickhouse_pass: String,
    #[serde(default = "default_clickhouse_db")]
    pub clickhouse_db: String,
    #[serde(default = "default_enable_simulator")]
    pub enable_simulator: bool,
    #[serde(default = "default_frontend_dir")]
    pub frontend_dir: String,
}

fn default_host() -> String { "0.0.0.0".to_string() }
fn default_port() -> u16 { 3001 }
fn default_nats_url() -> String { "nats://127.0.0.1:4222".to_string() }
fn default_clickhouse_url() -> String { "http://default:@127.0.0.1:8123".to_string() }
fn default_clickhouse_user() -> String { "default".to_string() }
fn default_clickhouse_pass() -> String { "".to_string() }
fn default_clickhouse_db() -> String { "cableway_monitor".to_string() }
fn default_enable_simulator() -> bool { true }
fn default_frontend_dir() -> String { "../frontend/dist".to_string() }

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let mut c: Config = envy::prefixed("CABLEWAY_").from_env().unwrap_or(Self {
            host: default_host(),
            port: default_port(),
            nats_url: default_nats_url(),
            clickhouse_url: default_clickhouse_url(),
            clickhouse_user: default_clickhouse_user(),
            clickhouse_pass: default_clickhouse_pass(),
            clickhouse_db: default_clickhouse_db(),
            enable_simulator: default_enable_simulator(),
            frontend_dir: default_frontend_dir(),
        });
        if let Ok(p) = std::env::var("CABLEWAY_PORT") {
            c.port = p.parse().unwrap_or(default_port());
        }
        if let Ok(h) = std::env::var("CABLEWAY_HOST") {
            c.host = h;
        }
        if let Ok(n) = std::env::var("CABLEWAY_NATS_URL") {
            c.nats_url = n;
        }
        if let Ok(ch) = std::env::var("CABLEWAY_CLICKHOUSE_URL") {
            c.clickhouse_url = ch;
        }
        if let Ok(s) = std::env::var("CABLEWAY_SIMULATOR") {
            c.enable_simulator = s.to_lowercase() == "true" || s == "1";
        }
        Ok(c)
    }
}
