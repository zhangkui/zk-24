pub mod tower;
pub mod sensor;
pub mod risk;
pub mod decision;
pub mod inspection;
pub mod weather;
pub mod video;

pub use tower::*;
pub use sensor::*;
pub use risk::*;
pub use decision::*;
pub use inspection::*;
pub use weather::*;
pub use video::*;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub trait HasTimestamp {
    fn timestamp(&self) -> DateTime<Utc>;
}

pub trait HasTowerId {
    fn tower_id(&self) -> Uuid;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
    pub timestamp: DateTime<Utc>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            code: 0,
            message: "success".to_string(),
            data: Some(data),
            timestamp: Utc::now(),
        }
    }

    pub fn error(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
            timestamp: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageResult<T: Serialize> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
}

impl<T: Serialize> PageResult<T> {
    pub fn new(items: Vec<T>, total: u64, page: u32, page_size: u32) -> Self {
        Self { items, total, page, page_size }
    }
}
