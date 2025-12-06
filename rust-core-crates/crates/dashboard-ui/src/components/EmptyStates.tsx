import React from 'react';
import { 
  Shield, Database, Search,
  Rocket, CheckCircle2, ArrowRight,
  ClipboardCheck, Activity, Lock, FileText
} from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

const variantStyles = {
  default: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-400',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
  },
  success: {
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-500',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
}) => {
  const styles = variantStyles[variant];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className={`w-20 h-20 ${styles.iconBg} rounded-2xl flex items-center justify-center mb-6`}>
          <div className={styles.iconColor}>{icon}</div>
        </div>
      )}
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mb-6 leading-relaxed">{description}</p>
      
      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className={`${styles.buttonBg} text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2`}
          >
            {actionLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="border border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

// Pre-configured empty states for each dashboard section

export const AuditEmptyState: React.FC<{ onStartRecording?: () => void }> = ({ onStartRecording }) => (
  <EmptyState
    icon={<Database className="w-10 h-10" />}
    title="No Audit Events Yet"
    description="SecuraMem is ready to record AI interactions. Connect your AI systems to start building your immutable audit chain for court-admissible provenance."
    actionLabel="View Integration Guide"
    onAction={onStartRecording}
    variant="info"
  />
);

export const ComplianceEmptyState: React.FC<{ onCreateAttestation?: () => void }> = ({ onCreateAttestation }) => (
  <EmptyState
    icon={<ClipboardCheck className="w-10 h-10" />}
    title="No Compliance Attestations"
    description="Start documenting your AI compliance posture. Record attestations to demonstrate adherence to EU AI Act, SOC 2, NIST AI RMF, and other frameworks."
    actionLabel="Create First Attestation"
    onAction={onCreateAttestation}
    variant="default"
  />
);

export const ThreatEmptyState: React.FC = () => (
  <EmptyState
    icon={<Shield className="w-10 h-10" />}
    title="No Threats Detected"
    description="Your AI firewall is active and monitoring. NeuroWall semantic threat detection will alert you when suspicious patterns are identified."
    variant="success"
  />
);

export const SearchEmptyState: React.FC<{ onClearFilters?: () => void }> = ({ onClearFilters }) => (
  <EmptyState
    icon={<Search className="w-10 h-10" />}
    title="No Events Match Your Search"
    description="Try adjusting your filters or search terms. Events are automatically indexed as they're recorded to the audit chain."
    actionLabel="Clear Filters"
    onAction={onClearFilters}
    variant="default"
  />
);

// Welcome/Onboarding empty state for first-time users
export const WelcomeEmptyState: React.FC<{ 
  onGetStarted?: () => void;
  onViewDocs?: () => void;
}> = ({ onGetStarted, onViewDocs }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gradient-to-b from-blue-50 to-white rounded-2xl border border-blue-100">
    <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
      <Rocket className="w-12 h-12 text-white" />
    </div>
    
    <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to SecuraMem</h2>
    <p className="text-slate-600 max-w-lg mb-8 leading-relaxed">
      Your AI Flight Recorder is ready. Start building court-admissible provenance 
      for every AI interaction in your organization.
    </p>

    {/* Quick Start Steps */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-full max-w-2xl">
      <QuickStartStep
        step={1}
        icon={<Lock className="w-5 h-5" />}
        title="Identity Bound"
        description="Cryptographic identity linked to this installation"
        done={true}
      />
      <QuickStartStep
        step={2}
        icon={<Activity className="w-5 h-5" />}
        title="Connect AI Systems"
        description="Integrate with your AI workflows"
        done={false}
      />
      <QuickStartStep
        step={3}
        icon={<FileText className="w-5 h-5" />}
        title="Start Recording"
        description="Build your immutable audit chain"
        done={false}
      />
    </div>

    <div className="flex items-center gap-3">
      <button
        onClick={onGetStarted}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-200"
      >
        Get Started
        <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={onViewDocs}
        className="border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors"
      >
        View Documentation
      </button>
    </div>
  </div>
);

interface QuickStartStepProps {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  done: boolean;
}

const QuickStartStep: React.FC<QuickStartStepProps> = ({ step, icon, title, description, done }) => (
  <div className={`p-4 rounded-xl border ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
      }`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <div className={done ? 'text-emerald-600' : 'text-slate-400'}>{icon}</div>
    </div>
    <h4 className={`font-medium text-sm ${done ? 'text-emerald-700' : 'text-slate-900'}`}>{title}</h4>
    <p className="text-xs text-slate-500 mt-1">{description}</p>
  </div>
);

// Chain status indicator for fresh installs
export const ChainGenesisState: React.FC = () => (
  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
        <Lock className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold">Genesis Block Created</h3>
        <p className="text-sm text-blue-100">Chain ID: #0</p>
      </div>
    </div>
    <p className="text-sm text-blue-100 leading-relaxed">
      Your audit chain has been initialized with a cryptographically secure genesis block. 
      All future AI interactions will be immutably linked to this root.
    </p>
    <div className="mt-4 p-3 bg-white/10 rounded-lg font-mono text-xs break-all">
      GENESIS_HASH: 0x00000000...
    </div>
  </div>
);

export default EmptyState;
