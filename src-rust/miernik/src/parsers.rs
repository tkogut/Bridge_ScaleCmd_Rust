//! Response parsers for different protocols

use crate::error::MiernikError;
use crate::models::WeightReading;
use chrono::Utc;
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    static ref RINCMD_PATTERN1: Regex = Regex::new(r"(\d{8})([+-])(\d+\.\d+)(kg|lb)").unwrap();
    static ref RINCMD_PATTERN2: Regex = Regex::new(r":\s*([+-]?)\s*(\d+\.?\d*)\s*(kg|lb|g)\s*([GNTZ])").unwrap();
    static ref RINCMD_NUM_RE: Regex = Regex::new(r"([+-]?\s*\d+(?:\.\d+)?)").unwrap();
    static ref RINCMD_UNIT_RE: Regex = Regex::new(r"[A-Za-z%]+").unwrap();
    
    static ref DINI_VALUE_RE: Regex = Regex::new(r"(?P<num>[+-]?\d+(?:\.\d+)?)").unwrap();
    static ref DINI_UNIT_RE: Regex = Regex::new(r"[A-Za-z%]+").unwrap();
}

/// Parse RINCMD protocol response
pub fn parse_rincmd_response(response: &str) -> Result<WeightReading, MiernikError> {
    if response.is_empty() {
        return Err(MiernikError::ProtocolError(
            "Empty response from device".to_string(),
        ));
    }

    // Pattern 1: (\d{8})([+-])(\d+\.\d+)(kg|lb)
    // Example: "20050026+123.45kg" or "20050025-23.5kg"
    if let Some(caps) = RINCMD_PATTERN1.captures(response) {
        let command_code = caps.get(1).unwrap().as_str();
        let sign = caps.get(2).unwrap().as_str();
        let value = caps.get(3).unwrap().as_str();
        let unit = caps.get(4).unwrap().as_str().to_lowercase();

        let weight_val = format!("{}{}", sign, value)
            .parse::<f64>()
            .map_err(|e| MiernikError::ProtocolError(format!("Failed to parse weight: {}", e)))?;

        // 20050026 = readGross, 20050025 = readNet
        let is_gross = command_code == "20050026";
        let is_stable = true; // Assume stable for this format

        return Ok(WeightReading {
            gross_weight: if is_gross { weight_val } else { 0.0 },
            net_weight: if is_gross { 0.0 } else { weight_val },
            unit,
            is_stable,
            timestamp: Utc::now(),
        });
    }

    // Pattern 2: :\s*([+-]?)\s*(\d+\.?\d*)\s*(kg|lb|g)\s*([GNTZ])
    // Example: ": -23 kg G" or ": +123.45 kg N"
    if let Some(caps) = RINCMD_PATTERN2.captures(response) {
        let sign = caps.get(1).unwrap().as_str();
        let value = caps.get(2).unwrap().as_str();
        let unit = caps.get(3).unwrap().as_str().to_lowercase();
        let status_char = caps.get(4).unwrap().as_str().to_uppercase();

        let numeric_value = value
            .parse::<f64>()
            .map_err(|e| MiernikError::ProtocolError(format!("Failed to parse value: {}", e)))?;

        let weight_val = if sign == "-" {
            -numeric_value
        } else {
            numeric_value
        };

        let is_net = status_char == "N";
        // For zero/tare commands (Z/T), consider them stable (confirmation commands)
        let is_stable = status_char == "G" || status_char == "N" || status_char == "Z" || status_char == "T";

        return Ok(WeightReading {
            gross_weight: if is_net { 0.0 } else { weight_val },
            net_weight: if is_net { weight_val } else { 0.0 },
            unit,
            is_stable,
            timestamp: Utc::now(),
        });
    }

    // Fallback: Try to parse standard RINCMD format "S 00000.000 kg" or "U 00000.000 kg"
    let mut cleaned = response.trim().to_string();
    let replacements = [
        ('\t', ' '),
        ('\n', ' '),
        ('\x0B', ' '),
        ('\x0C', ' '),
        ('\r', ' '),
        ('\u{00A0}', ' '),
    ];
    for (from, to) in replacements.iter() {
        cleaned = cleaned.replace(*from, &to.to_string());
    }

    let dash_chars = ['−', '–', '—', '―', '‑', '−', '－'];
    for d in dash_chars.iter() {
        if cleaned.contains(*d) {
            cleaned = cleaned.replace(*d, "-");
        }
    }

    if cleaned == "E" || response == "E" {
        return Err(MiernikError::ProtocolError(
            "Device returned error 'E'".to_string(),
        ));
    }

    let parts: Vec<&str> = cleaned.split_whitespace().collect();
    if parts.is_empty() {
        return Err(MiernikError::ProtocolError(
            "Empty response from device".to_string(),
        ));
    }

    let mut is_stable = parts[0] == "S";

    let search_space = if let Some(pos) = cleaned.find(':') {
        cleaned[(pos + 1)..].trim().to_string()
    } else {
        cleaned.clone()
    };

    if let Some(m) = RINCMD_NUM_RE.find(&search_space) {
        let mut num_str = m.as_str().to_string();
        num_str.retain(|c| c != ' ');
        let weight_val = num_str
            .parse::<f64>()
            .map_err(|e| {
                MiernikError::ProtocolError(format!("Failed to parse weight '{}': {}", num_str, e))
            })?;

        // For zero/tare commands, if weight is 0.0, consider it stable
        // (zero/tare are confirmation commands, not weight readings)
        if weight_val == 0.0 {
            is_stable = true;
        }

        let after = &search_space[m.end()..];
        let unit = RINCMD_UNIT_RE
            .find(after)
            .map(|u| u.as_str().to_string())
            .unwrap_or_else(|| "kg".to_string());

        return Ok(WeightReading {
            gross_weight: weight_val,
            net_weight: weight_val,
            unit,
            is_stable,
            timestamp: Utc::now(),
        });
    }

    Err(MiernikError::ProtocolError(format!(
        "Unexpected response format: '{}'",
        response
    )))
}

/// Parse Dini Argeo ASCII protocol response
pub fn parse_dini_ascii_response(response: &str) -> Result<WeightReading, MiernikError> {
    if response.is_empty() {
        return Err(MiernikError::ProtocolError(
            "Empty response from device".to_string(),
        ));
    }

    // Clean response
    let cleaned = response.trim().to_string();
    
    // Handle "OK" response for zero/tare commands
    // These are confirmation commands, not weight readings
    if cleaned.to_uppercase() == "OK" {
        return Ok(WeightReading {
            gross_weight: 0.0,
            net_weight: 0.0,
            unit: "kg".to_string(),
            is_stable: true,
            timestamp: Utc::now(),
        });
    }
    
    // Find numeric value
    if let Some(caps) = DINI_VALUE_RE.captures(&cleaned) {
        let num_str = caps.name("num").unwrap().as_str();
        let weight_val = num_str
            .parse::<f64>()
            .map_err(|e| {
                MiernikError::ProtocolError(format!("Failed to parse weight '{}': {}", num_str, e))
            })?;

        // Find unit
        let unit = DINI_UNIT_RE
            .find(&cleaned)
            .map(|u| u.as_str().to_lowercase())
            .unwrap_or_else(|| "kg".to_string());

        // Determine stability (Dini Argeo typically returns stable readings)
        let is_stable = !cleaned.contains("U") && !cleaned.contains("u");

        return Ok(WeightReading {
            gross_weight: weight_val,
            net_weight: weight_val,
            unit,
            is_stable,
            timestamp: Utc::now(),
        });
    }

    Err(MiernikError::ProtocolError(format!(
        "Unexpected response format: '{}'",
        response
    )))
}

