//! Protocol definitions and handlers

/// Protocol type
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Protocol {
    Rincmd,
    DiniAscii,
    Custom(String),
}

impl Protocol {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "RINCMD" | "RINSTRUM" => Protocol::Rincmd,
            "DINI_ASCII" | "DINI_ARGEO" | "ASCII" => Protocol::DiniAscii,
            _ => Protocol::Custom(s.to_string()),
        }
    }

    /// Get command terminator for protocol
    pub fn command_terminator(&self) -> &'static str {
        match self {
            Protocol::Rincmd => "\r\n",
            Protocol::DiniAscii => "\r\n",
            Protocol::Custom(_) => "\r\n",
        }
    }
}

