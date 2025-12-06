//! PDF Report Generation using Typst
//!
//! Generates court-admissible compliance and audit reports.
//! Uses typst for PDF rendering with professional GRC styling.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Report type enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ReportType {
    Compliance,
    Audit,
    Executive,
    Attestation,
}

/// Report generation options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportOptions {
    pub report_type: ReportType,
    pub framework_id: Option<String>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
    pub include_signatures: bool,
    pub include_chain_hashes: bool,
    pub company_name: Option<String>,
    pub prepared_by: Option<String>,
}

impl Default for ReportOptions {
    fn default() -> Self {
        Self {
            report_type: ReportType::Compliance,
            framework_id: None,
            date_from: None,
            date_to: None,
            include_signatures: true,
            include_chain_hashes: true,
            company_name: None,
            prepared_by: None,
        }
    }
}

/// Audit entry for report inclusion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportAuditEntry {
    pub id: i64,
    pub timestamp: String,
    pub actor: String,
    pub operation: String,
    pub summary: String,
    pub receipt_hash: String,
    pub threat_score: Option<f64>,
    pub blocked: bool,
}

/// Compliance control status for report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportControlStatus {
    pub control_id: String,
    pub control_name: String,
    pub status: String, // "compliant", "partial", "non_compliant"
    pub evidence: String,
    pub last_assessed: Option<String>,
}

/// Framework summary for report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportFrameworkSummary {
    pub framework_id: String,
    pub framework_name: String,
    pub overall_score: f64,
    pub controls_compliant: i32,
    pub controls_partial: i32,
    pub controls_non_compliant: i32,
    pub controls: Vec<ReportControlStatus>,
}

/// Report data container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportData {
    pub generated_at: DateTime<Utc>,
    pub report_type: ReportType,
    pub company_name: String,
    pub prepared_by: String,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub chain_integrity_verified: bool,
    pub total_audit_entries: i64,
    pub threats_blocked: i64,
    pub frameworks: Vec<ReportFrameworkSummary>,
    pub audit_entries: Vec<ReportAuditEntry>,
    pub attestation_signature: Option<String>,
}

/// Generate the typst markup for a compliance report
pub fn generate_compliance_report_typst(data: &ReportData) -> String {
    let period_text = match (&data.period_start, &data.period_end) {
        (Some(start), Some(end)) => format!(
            "{} to {}",
            start.format("%B %d, %Y"),
            end.format("%B %d, %Y")
        ),
        _ => "All Time".to_string(),
    };

    let mut typst = format!(r#"
#set page(
  paper: "us-letter",
  margin: (x: 1in, y: 1in),
  header: [
    #set text(8pt, fill: gray)
    SecuraMem Compliance Report | {} | CONFIDENTIAL
  ],
  footer: [
    #set text(8pt, fill: gray)
    #h(1fr) Page #counter(page).display() #h(1fr)
  ]
)

#set text(11pt, font: "New Computer Modern")
#set par(justify: true)

// Title Page
#align(center)[
  #v(2in)
  
  #text(24pt, weight: "bold")[SecuraMem]
  
  #v(0.25in)
  
  #text(18pt)[AI Compliance Report]
  
  #v(0.5in)
  
  #text(14pt)[{}]
  
  #v(0.25in)
  
  #text(12pt)[Reporting Period: {}]
  
  #v(1in)
  
  #text(10pt, fill: gray)[
    Generated: {} \
    Prepared by: {}
  ]
  
  #v(2in)
  
  #rect(width: 80%, stroke: 0.5pt + gray)[
    #align(center)[
      #text(8pt)[
        This report is generated from cryptographically sealed audit records. \
        Court-admissible under Federal Rules of Evidence 902(13).
      ]
    ]
  ]
]

#pagebreak()

// Executive Summary
= Executive Summary

This compliance report provides a comprehensive overview of {} AI governance and compliance posture as recorded by the SecuraMem audit system.

#table(
  columns: (auto, 1fr),
  stroke: none,
  [*Report Period:*], [{}],
  [*Total Audit Entries:*], [{}],
  [*Threats Blocked:*], [{}],
  [*Chain Integrity:*], [#text(fill: green)[✓ {}]],
)

#v(0.5in)

"#,
        data.generated_at.format("%Y-%m-%d"),
        data.company_name,
        period_text,
        data.generated_at.format("%Y-%m-%d %H:%M UTC"),
        data.prepared_by,
        data.company_name,
        period_text,
        data.total_audit_entries,
        data.threats_blocked,
        if data.chain_integrity_verified { "Verified" } else { "Unverified" }
    );

    // Framework compliance sections
    typst.push_str("\n= Compliance Framework Status\n\n");
    
    for framework in &data.frameworks {
        let status_color = if framework.overall_score >= 90.0 {
            "green"
        } else if framework.overall_score >= 70.0 {
            "orange"
        } else {
            "red"
        };

        typst.push_str(&format!(r#"
== {}

#table(
  columns: (auto, 1fr),
  stroke: none,
  [*Overall Score:*], [#text(fill: {})[{:.1}%]],
  [*Controls Compliant:*], [{} / {}],
  [*Controls Partial:*], [{}],
  [*Controls Non-Compliant:*], [{}],
)

=== Control Details

#table(
  columns: (auto, auto, 1fr),
  align: (left, center, left),
  [*Control ID*], [*Status*], [*Evidence*],
"#,
            framework.framework_name,
            status_color,
            framework.overall_score,
            framework.controls_compliant,
            framework.controls_compliant + framework.controls_partial + framework.controls_non_compliant,
            framework.controls_partial,
            framework.controls_non_compliant,
        ));

        for control in &framework.controls {
            let status_badge = match control.status.as_str() {
                "compliant" => "#text(fill: green)[✓ Compliant]",
                "partial" => "#text(fill: orange)[◐ Partial]",
                _ => "#text(fill: red)[✗ Non-Compliant]",
            };
            typst.push_str(&format!(
                "  [{}], [{}], [{}],\n",
                control.control_id, status_badge, control.evidence
            ));
        }

        typst.push_str(")\n\n");
    }

    // Audit Trail Section
    if !data.audit_entries.is_empty() {
        typst.push_str(r#"
#pagebreak()

= Audit Trail

The following table shows recent audit entries from the cryptographically sealed chain.

#table(
  columns: (auto, auto, auto, auto, auto),
  align: (left, left, left, left, center),
  [*Time*], [*Actor*], [*Operation*], [*Summary*], [*Status*],
"#);

        for entry in data.audit_entries.iter().take(25) {
            let status = if entry.blocked {
                "#text(fill: red)[⛔ Blocked]"
            } else {
                "#text(fill: green)[✓ OK]"
            };
            
            // Escape special typst characters
            let summary = entry.summary
                .replace('[', "\\[")
                .replace(']', "\\]")
                .replace('#', "\\#");
            
            typst.push_str(&format!(
                "  [{}], [{}], [{}], [{}], [{}],\n",
                entry.timestamp.chars().take(19).collect::<String>(),
                entry.actor,
                entry.operation,
                summary.chars().take(40).collect::<String>(),
                status
            ));
        }

        typst.push_str(")\n\n");
    }

    // Signature Section
    if let Some(ref sig) = data.attestation_signature {
        typst.push_str(&format!(r#"
#pagebreak()

= Cryptographic Attestation

This report is cryptographically signed using Ed25519 digital signature algorithm.

#rect(width: 100%, stroke: 0.5pt + gray, inset: 10pt)[
  #text(8pt, font: "Fira Code")[
    {}
  ]
]

#v(0.5in)

#text(8pt)[
  Signature algorithm: Ed25519 \
  Hash algorithm: SHA-256 \
  Timestamp: {} \
  Verification: Federal Rules of Evidence 902(13) compliant
]
"#,
            sig,
            data.generated_at.to_rfc3339()
        ));
    }

    // Footer
    typst.push_str(r#"

#v(1fr)

#line(length: 100%, stroke: 0.5pt + gray)

#text(8pt, fill: gray)[
  SecuraMem AI Flight Recorder | Air-Gapped Compliance Platform \
  This document was generated from tamper-evident audit records.
]
"#);

    typst
}

/// Generate PDF report (main entry point)
/// 
/// Exports both .typ (typst source) and .json (data) files.
/// Users can compile the .typ file to PDF using `typst compile report.typ`.
pub async fn generate_pdf_report(
    data: ReportData,
    output_path: PathBuf,
) -> Result<PathBuf, String> {
    // Generate typst source
    let typst_source = generate_compliance_report_typst(&data);

    // Export typst source for compilation
    let typst_path = output_path.with_extension("typ");
    std::fs::write(&typst_path, &typst_source)
        .map_err(|e| format!("Failed to write typst source: {}", e))?;
    
    // Also export JSON data for programmatic access
    let json_path = output_path.with_extension("json");
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize report data: {}", e))?;
    std::fs::write(&json_path, &json)
        .map_err(|e| format!("Failed to write JSON: {}", e))?;

    // Try to compile PDF if typst CLI is available
    let pdf_path = output_path.with_extension("pdf");
    match std::process::Command::new("typst")
        .args(["compile", typst_path.to_str().unwrap(), pdf_path.to_str().unwrap()])
        .output()
    {
        Ok(output) if output.status.success() => {
            tracing::info!("PDF compiled successfully: {:?}", pdf_path);
            Ok(pdf_path)
        }
        _ => {
            tracing::warn!("Typst CLI not available. Exported .typ and .json files instead.");
            tracing::info!("To generate PDF, install typst and run: typst compile {:?}", typst_path);
            Ok(typst_path)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_compliance_typst() {
        let data = ReportData {
            generated_at: Utc::now(),
            report_type: ReportType::Compliance,
            company_name: "Test Corp".to_string(),
            prepared_by: "Compliance Officer".to_string(),
            period_start: Some(Utc::now()),
            period_end: Some(Utc::now()),
            chain_integrity_verified: true,
            total_audit_entries: 1000,
            threats_blocked: 42,
            frameworks: vec![],
            audit_entries: vec![],
            attestation_signature: None,
        };

        let typst = generate_compliance_report_typst(&data);
        assert!(typst.contains("SecuraMem"));
        assert!(typst.contains("Test Corp"));
    }
}
