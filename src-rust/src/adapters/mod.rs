pub mod adapter;
pub mod adapter_enum;
pub mod dini_argeo;
pub mod rinstrum;

// Re-export common types if callers expect to access them directly from `adapters`.
pub use adapter::DeviceAdapter;
pub use adapter_enum::DeviceAdapterEnum;
