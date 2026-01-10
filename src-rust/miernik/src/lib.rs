//! ScaleIT Miernik (Device) Library
//! 
//! Provides device definitions and configurations for different scale models.
//! Each device defines its command mappings and specific parameters.

pub mod device;
pub mod models;
pub mod error;
pub mod parsers;
pub mod devices;

pub use device::{Device, DeviceAdapter};
pub use models::{WeightReading, DeviceConfig};
pub use error::MiernikError;
pub use parsers::{parse_rincmd_response, parse_dini_ascii_response};
pub use devices::{RinstrumC320, DiniArgeoDFW};

