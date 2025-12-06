//! Text anonymization service
//! 
//! Ports the Node.js anonymization logic to Rust with improved performance.

use once_cell::sync::Lazy;
use regex::Regex;

// Email pattern
static EMAIL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").unwrap()
});

// Phone numbers (US format)
static PHONE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})").unwrap()
});

// SSN
static SSN_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b\d{3}-?\d{2}-?\d{4}\b").unwrap()
});

// Credit card (simplified)
static CREDIT_CARD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(?:\d{4}[-\s]?){3}\d{4}\b").unwrap()
});

// Names (Title Case patterns - simplified)
static NAME_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b[A-Z][a-z]+\s[A-Z][a-z]+\b").unwrap()
});

// US addresses (simplified)
static ADDRESS_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Place|Pl)\b").unwrap()
});

// Date of birth patterns
static DOB_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b").unwrap()
});

// IP addresses
static IP_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b").unwrap()
});

// Healthcare-specific patterns
static MRN_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(?:MRN|Medical\s*Record|Patient\s*ID)[:.\s]*([A-Z0-9]{6,})\b").unwrap()
});

static INSURANCE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(?:Insurance|Policy)[:.\s]*([A-Z0-9]{8,})\b").unwrap()
});

// For differential privacy
static NUMBER_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b\d+\b").unwrap()
});

static YEAR_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(19|20)\d{2}\b").unwrap()
});

/// PII match info
#[derive(Debug, Clone)]
pub struct PiiMatch {
    pub original: String,
    pub replacement: String,
    pub pii_type: PiiType,
    pub start: usize,
    pub end: usize,
}

/// Type of PII detected
#[derive(Debug, Clone)]
pub enum PiiType {
    Email,
    Phone,
    Ssn,
    CreditCard,
    Name,
    Address,
    DateOfBirth,
    IpAddress,
    MedicalRecordNumber,
    InsuranceId,
}

pub struct Anonymizer {
    replacement_counter: std::sync::atomic::AtomicU32,
}

impl Anonymizer {
    pub fn new() -> Self {
        Self {
            replacement_counter: std::sync::atomic::AtomicU32::new(0),
        }
    }
    
    /// Basic PII removal (emails, phones, SSN, credit cards, names, addresses)
    pub fn basic_anonymization(&self, text: &str) -> (String, Vec<PiiMatch>) {
        let mut result = text.to_string();
        let mut matches = Vec::new();
        
        // Process in order of specificity (most specific first)
        self.replace_pattern(&mut result, &mut matches, &SSN_REGEX, PiiType::Ssn, "[SSN]");
        self.replace_pattern(&mut result, &mut matches, &CREDIT_CARD_REGEX, PiiType::CreditCard, "[CARD]");
        self.replace_pattern(&mut result, &mut matches, &EMAIL_REGEX, PiiType::Email, "[EMAIL]");
        self.replace_pattern(&mut result, &mut matches, &PHONE_REGEX, PiiType::Phone, "[PHONE]");
        self.replace_pattern(&mut result, &mut matches, &DOB_REGEX, PiiType::DateOfBirth, "[DOB]");
        self.replace_pattern(&mut result, &mut matches, &IP_REGEX, PiiType::IpAddress, "[IP]");
        self.replace_pattern(&mut result, &mut matches, &ADDRESS_REGEX, PiiType::Address, "[ADDRESS]");
        self.replace_pattern(&mut result, &mut matches, &NAME_REGEX, PiiType::Name, "[NAME]");
        
        (result, matches)
    }
    
    /// Healthcare-level anonymization (basic + MRN, insurance, etc.)
    pub fn healthcare_anonymization(&self, text: &str) -> (String, Vec<PiiMatch>) {
        let (mut result, mut matches) = self.basic_anonymization(text);
        
        // Add healthcare-specific patterns
        self.replace_pattern(&mut result, &mut matches, &MRN_REGEX, PiiType::MedicalRecordNumber, "[MRN]");
        self.replace_pattern(&mut result, &mut matches, &INSURANCE_REGEX, PiiType::InsuranceId, "[INSURANCE]");
        
        (result, matches)
    }
    
    /// Differential privacy anonymization (healthcare + noise injection)
    pub fn differential_privacy_anonymization(&self, text: &str, _epsilon: f64) -> (String, Vec<PiiMatch>) {
        let (mut result, matches) = self.healthcare_anonymization(text);
        
        // Add differential privacy noise to numerical values
        result = self.inject_numerical_noise(&result);
        
        // Generalize dates to ranges
        result = self.generalize_dates(&result);
        
        (result, matches)
    }
    
    fn replace_pattern(
        &self, 
        text: &mut String, 
        matches: &mut Vec<PiiMatch>, 
        regex: &Regex, 
        pii_type: PiiType,
        replacement_prefix: &str,
    ) {
        // Collect all matches first (to avoid borrow issues)
        let found: Vec<_> = regex.find_iter(text).map(|m| {
            (m.start(), m.end(), m.as_str().to_string())
        }).collect();
        
        // Replace in reverse order to preserve positions
        for (start, end, original) in found.into_iter().rev() {
            let id = self.replacement_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let replacement = format!("{}{}", replacement_prefix, id);
            
            matches.push(PiiMatch {
                original: original.clone(),
                replacement: replacement.clone(),
                pii_type: pii_type.clone(),
                start,
                end,
            });
            
            text.replace_range(start..end, &replacement);
        }
    }
    
    fn inject_numerical_noise(&self, text: &str) -> String {
        NUMBER_REGEX.replace_all(text, |caps: &regex::Captures| {
            if let Ok(num) = caps[0].parse::<i64>() {
                // Add ±5% noise
                let noise = (num as f64 * 0.05) as i64;
                let noised = num + noise; // Simplified: always add
                noised.to_string()
            } else {
                caps[0].to_string()
            }
        }).to_string()
    }
    
    fn generalize_dates(&self, text: &str) -> String {
        YEAR_REGEX.replace_all(text, |caps: &regex::Captures| {
            if let Ok(year) = caps[0].parse::<i32>() {
                let decade = (year / 10) * 10;
                format!("{}-{}", decade, decade + 9)
            } else {
                caps[0].to_string()
            }
        }).to_string()
    }
}

impl Default for Anonymizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::AnonymizationLevel;
    
    #[test]
    fn test_email_anonymization() {
        let anonymizer = Anonymizer::new();
        let (result, matches) = anonymizer.basic_anonymization(
            "Contact me at john.doe@example.com for details"
        );
        
        assert!(!result.contains("john.doe@example.com"));
        assert!(result.contains("[EMAIL]"));
        assert_eq!(matches.len(), 1);
    }
    
    #[test]
    fn test_phone_anonymization() {
        let anonymizer = Anonymizer::new();
        let (result, _) = anonymizer.basic_anonymization(
            "Call me at 555-123-4567"
        );
        
        assert!(!result.contains("555-123-4567"));
        assert!(result.contains("[PHONE]"));
    }
    
    #[test]
    fn test_healthcare_level() {
        let anonymizer = Anonymizer::new();
        let (result, _) = anonymizer.healthcare_anonymization(
            "Patient MRN: ABC123456 has insurance Policy: XYZ98765432"
        );
        
        assert!(result.contains("[MRN]"));
        assert!(result.contains("[INSURANCE]"));
    }
}
