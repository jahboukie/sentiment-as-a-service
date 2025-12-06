import React, { useState } from 'react';
import { 
  Shield, CheckCircle2, AlertTriangle, XCircle, MinusCircle,
  FileText, Calendar, ExternalLink, ChevronRight
} from 'lucide-react';

interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  evidence: string[];
  lastVerified: string;
}

interface ComplianceFramework {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
  controls: ComplianceControl[];
  completionPercent: number;
}

// Mock data for compliance frameworks
const frameworks: ComplianceFramework[] = [
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    shortName: 'EU AI',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 93,
    controls: [
      {
        id: 'art-14',
        name: 'Human Oversight',
        description: 'Article 14 - Human supervision of high-risk AI systems',
        status: 'compliant',
        evidence: ['oversight_log.json', 'human_review_policy.md'],
        lastVerified: '2025-11-28',
      },
      {
        id: 'art-12',
        name: 'Record Keeping',
        description: 'Article 12 - Automatic logging of AI operations',
        status: 'compliant',
        evidence: ['audit_chain_integrity_report.pdf'],
        lastVerified: '2025-11-28',
      },
      {
        id: 'art-13',
        name: 'Transparency',
        description: 'Article 13 - Information provided to users',
        status: 'partial',
        evidence: ['transparency_notice.md'],
        lastVerified: '2025-11-25',
      },
      {
        id: 'art-9',
        name: 'Risk Management',
        description: 'Article 9 - Risk management system implementation',
        status: 'compliant',
        evidence: ['risk_assessment.pdf', 'mitigation_plan.md'],
        lastVerified: '2025-11-27',
      },
    ],
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    shortName: 'SOC 2',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 100,
    controls: [
      {
        id: 'cc6.1',
        name: 'Logical Access Controls',
        description: 'CC6.1 - Entity implements logical access security',
        status: 'compliant',
        evidence: ['access_control_policy.pdf'],
        lastVerified: '2025-11-28',
      },
      {
        id: 'cc7.2',
        name: 'System Monitoring',
        description: 'CC7.2 - Entity monitors system components for anomalies',
        status: 'compliant',
        evidence: ['monitoring_dashboard.json'],
        lastVerified: '2025-11-28',
      },
      {
        id: 'cc8.1',
        name: 'Change Management',
        description: 'CC8.1 - Changes to infrastructure are authorized',
        status: 'compliant',
        evidence: ['change_log.json', 'approval_workflow.md'],
        lastVerified: '2025-11-26',
      },
    ],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001:2022',
    shortName: 'ISO 27001',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 87,
    controls: [
      {
        id: 'a.5.1',
        name: 'Information Security Policies',
        description: 'A.5.1 - Policies for information security',
        status: 'compliant',
        evidence: ['security_policy_v2.pdf'],
        lastVerified: '2025-11-27',
      },
      {
        id: 'a.8.2',
        name: 'Privileged Access Rights',
        description: 'A.8.2 - Management of privileged access rights',
        status: 'partial',
        evidence: ['access_matrix.xlsx'],
        lastVerified: '2025-11-24',
      },
      {
        id: 'a.12.4',
        name: 'Logging and Monitoring',
        description: 'A.12.4 - Logging and monitoring controls',
        status: 'compliant',
        evidence: ['audit_log_config.json'],
        lastVerified: '2025-11-28',
      },
    ],
  },
  {
    id: 'nist-ai',
    name: 'NIST AI RMF',
    shortName: 'NIST',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 78,
    controls: [
      {
        id: 'govern-1',
        name: 'Governance Structure',
        description: 'GOVERN 1 - AI governance policies and procedures',
        status: 'compliant',
        evidence: ['ai_governance_charter.pdf'],
        lastVerified: '2025-11-26',
      },
      {
        id: 'map-1',
        name: 'Context Mapping',
        description: 'MAP 1 - AI system context and intended use',
        status: 'partial',
        evidence: ['use_case_documentation.md'],
        lastVerified: '2025-11-23',
      },
      {
        id: 'measure-2',
        name: 'Performance Metrics',
        description: 'MEASURE 2 - Quantitative performance measurement',
        status: 'non-compliant',
        evidence: [],
        lastVerified: '2025-11-20',
      },
    ],
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    shortName: 'GDPR',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 95,
    controls: [
      {
        id: 'art-5',
        name: 'Data Processing Principles',
        description: 'Article 5 - Lawfulness, fairness, transparency',
        status: 'compliant',
        evidence: ['privacy_policy.pdf', 'consent_records.json'],
        lastVerified: '2025-11-28',
      },
      {
        id: 'art-17',
        name: 'Right to Erasure',
        description: 'Article 17 - Right to be forgotten implementation',
        status: 'compliant',
        evidence: ['deletion_procedures.md'],
        lastVerified: '2025-11-27',
      },
      {
        id: 'art-32',
        name: 'Security of Processing',
        description: 'Article 32 - Technical and organizational measures',
        status: 'compliant',
        evidence: ['security_controls.pdf'],
        lastVerified: '2025-11-28',
      },
    ],
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    shortName: 'HIPAA',
    icon: <Shield className="w-4 h-4" />,
    completionPercent: 100,
    controls: [
      {
        id: '164.312a',
        name: 'Access Controls',
        description: '§164.312(a) - Technical safeguards for access',
        status: 'compliant',
        evidence: ['access_control_audit.pdf'],
        lastVerified: '2025-11-28',
      },
      {
        id: '164.312b',
        name: 'Audit Controls',
        description: '§164.312(b) - Hardware, software, procedure audit',
        status: 'compliant',
        evidence: ['audit_log_certification.pdf'],
        lastVerified: '2025-11-28',
      },
      {
        id: '164.312e',
        name: 'Transmission Security',
        description: '§164.312(e) - Electronic PHI transmission protection',
        status: 'compliant',
        evidence: ['encryption_certificate.pdf'],
        lastVerified: '2025-11-27',
      },
    ],
  },
];

const statusConfig = {
  compliant: {
    icon: CheckCircle2,
    label: 'COMPLIANT',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  partial: {
    icon: AlertTriangle,
    label: 'PARTIAL',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  'non-compliant': {
    icon: XCircle,
    label: 'NON-COMPLIANT',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
  'not-applicable': {
    icon: MinusCircle,
    label: 'N/A',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
};

interface CompliancePanelProps {
  onExportReport?: (frameworkId: string) => void;
  onScheduleAudit?: (frameworkId: string) => void;
}

export const CompliancePanel: React.FC<CompliancePanelProps> = ({
  onExportReport,
  onScheduleAudit,
}) => {
  const [activeTab, setActiveTab] = useState(frameworks[0].id);
  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  const activeFramework = frameworks.find(f => f.id === activeTab)!;

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-emerald-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="flex overflow-x-auto">
          {frameworks.map((framework) => (
            <button
              key={framework.id}
              onClick={() => setActiveTab(framework.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-all duration-200
                ${activeTab === framework.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
                }
              `}
            >
              {framework.icon}
              <span className="hidden sm:inline">{framework.shortName}</span>
              {framework.completionPercent === 100 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {activeFramework.name} Compliance
            </h3>
            <p className="text-sm text-slate-500">
              {activeFramework.controls.length} controls tracked
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">
              {activeFramework.completionPercent}%
            </div>
            <div className="text-sm text-slate-500">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(activeFramework.completionPercent)} transition-all duration-500`}
              style={{ width: `${activeFramework.completionPercent}%` }}
            />
          </div>
        </div>

        {/* Controls List */}
        <div className="space-y-3">
          {activeFramework.controls.map((control) => {
            const status = statusConfig[control.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedControl === control.id;

            return (
              <div
                key={control.id}
                className={`
                  border rounded-lg transition-all duration-200
                  ${status.borderColor}
                  ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}
                `}
              >
                <button
                  onClick={() => setExpandedControl(isExpanded ? null : control.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`w-5 h-5 ${status.textColor}`} />
                    <div>
                      <div className="font-medium text-slate-900">{control.name}</div>
                      <div className="text-sm text-slate-500">{control.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`
                      px-2.5 py-1 rounded-full text-xs font-medium
                      ${status.bgColor} ${status.textColor}
                    `}>
                      {status.label}
                    </span>
                    <ChevronRight className={`
                      w-5 h-5 text-slate-400 transition-transform duration-200
                      ${isExpanded ? 'rotate-90' : ''}
                    `} />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                    <div className="pt-4 space-y-3">
                      {/* Evidence */}
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                          Evidence
                        </div>
                        {control.evidence.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {control.evidence.map((file, i) => (
                              <a
                                key={i}
                                href="#"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {file}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No evidence attached</p>
                        )}
                      </div>

                      {/* Last Verified */}
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        Last verified: {new Date(control.lastVerified).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={() => onExportReport?.(activeFramework.id)}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export Compliance Report
          </button>
          <button
            onClick={() => onScheduleAudit?.(activeFramework.id)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Schedule Audit
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompliancePanel;
