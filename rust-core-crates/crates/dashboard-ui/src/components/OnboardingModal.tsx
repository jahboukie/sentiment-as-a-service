import React, { useState, useEffect } from 'react';
import { 
  Shield, Lock, Database, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles, X, Building2,
  Globe, Scale, ChevronDown
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (config: OnboardingConfig) => void;
  onSkip: () => void;
}

export interface OnboardingConfig {
  organizationName: string;
  selectedFrameworks: string[];
  primaryUseCase: string;
  dataRetentionDays: number;
}

const COMPLIANCE_FRAMEWORKS = [
  { id: 'eu_ai_act', name: 'EU AI Act', description: 'European AI regulation', recommended: true },
  { id: 'soc2', name: 'SOC 2 Type II', description: 'Trust services criteria', recommended: true },
  { id: 'iso_42001', name: 'ISO/IEC 42001', description: 'AI management system', recommended: false },
  { id: 'nist_ai_rmf', name: 'NIST AI RMF', description: 'AI risk management', recommended: true },
  { id: 'ccpa', name: 'CCPA', description: 'California privacy', recommended: false },
  { id: 'hipaa', name: 'HIPAA', description: 'Healthcare privacy', recommended: false },
];

const USE_CASES = [
  { id: 'enterprise', name: 'Enterprise AI Governance', icon: Building2 },
  { id: 'legal', name: 'Legal & Compliance', icon: Scale },
  { id: 'research', name: 'AI Research & Development', icon: Sparkles },
  { id: 'other', name: 'Other', icon: Globe },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<OnboardingConfig>({
    organizationName: '',
    selectedFrameworks: ['eu_ai_act', 'soc2', 'nist_ai_rmf'],
    primaryUseCase: 'enterprise',
    dataRetentionDays: 365,
  });

  const totalSteps = 4;

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(config);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleFramework = (id: string) => {
    setConfig(prev => ({
      ...prev,
      selectedFrameworks: prev.selectedFrameworks.includes(id)
        ? prev.selectedFrameworks.filter(f => f !== id)
        : [...prev.selectedFrameworks, id],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Skip setup"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Welcome to SecuraMem</h2>
              <p className="text-blue-100 text-sm">Let's set up your AI Flight Recorder</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-blue-100 mt-2">Step {step} of {totalSteps}</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step 1: Organization */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900">Your Organization</h3>
                <p className="text-slate-500 mt-2">This will appear on compliance reports and attestations</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={config.organizationName}
                  onChange={(e) => setConfig(prev => ({ ...prev, organizationName: e.target.value }))}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Primary Use Case
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASES.map((useCase) => {
                    const Icon = useCase.icon;
                    return (
                      <button
                        key={useCase.id}
                        onClick={() => setConfig(prev => ({ ...prev, primaryUseCase: useCase.id }))}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          config.primaryUseCase === useCase.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${
                          config.primaryUseCase === useCase.id ? 'text-blue-600' : 'text-slate-400'
                        }`} />
                        <div className={`font-medium ${
                          config.primaryUseCase === useCase.id ? 'text-blue-900' : 'text-slate-900'
                        }`}>
                          {useCase.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Compliance Frameworks */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Scale className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900">Compliance Frameworks</h3>
                <p className="text-slate-500 mt-2">Select the frameworks you need to comply with</p>
              </div>

              <div className="space-y-3">
                {COMPLIANCE_FRAMEWORKS.map((framework) => (
                  <button
                    key={framework.id}
                    onClick={() => toggleFramework(framework.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                      config.selectedFrameworks.includes(framework.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                        config.selectedFrameworks.includes(framework.id)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                      }`}>
                        {config.selectedFrameworks.includes(framework.id) && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{framework.name}</div>
                        <div className="text-sm text-slate-500">{framework.description}</div>
                      </div>
                    </div>
                    {framework.recommended && (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        Recommended
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Data Retention */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Database className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900">Data Retention</h3>
                <p className="text-slate-500 mt-2">Configure how long audit data is retained</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Air-Gapped Storage</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      All data is stored locally on this machine. No cloud connections. 
                      Court-admissible audit chains require immutable local storage.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="retention-period" className="block text-sm font-medium text-slate-700 mb-2">
                  Retention Period
                </label>
                <div className="relative">
                  <select
                    id="retention-period"
                    title="Data retention period"
                    value={config.dataRetentionDays}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      dataRetentionDays: parseInt(e.target.value) 
                    }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={90}>90 days (Minimum)</option>
                    <option value={180}>180 days</option>
                    <option value={365}>1 year (Recommended)</option>
                    <option value={730}>2 years</option>
                    <option value={1825}>5 years</option>
                    <option value={2555}>7 years (SOX/HIPAA)</option>
                    <option value={-1}>Forever (No deletion)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  EU AI Act requires minimum 6 months. SOX and HIPAA require 7 years.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900">Ready to Go!</h3>
                <p className="text-slate-500 mt-2">Review your configuration</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-slate-600">Organization</span>
                  <span className="font-medium text-slate-900">{config.organizationName || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-slate-600">Use Case</span>
                  <span className="font-medium text-slate-900">
                    {USE_CASES.find(u => u.id === config.primaryUseCase)?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-slate-600">Frameworks</span>
                  <span className="font-medium text-slate-900">{config.selectedFrameworks.length} selected</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Data Retention</span>
                  <span className="font-medium text-slate-900">
                    {config.dataRetentionDays === -1 ? 'Forever' : `${config.dataRetentionDays} days`}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Your AI Flight Recorder is Ready</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      A cryptographic identity has been generated and bound to this installation.
                      Your audit chain will be court-admissible under Federal Rules of Evidence 902(13).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex justify-between">
          <button
            onClick={step === 1 ? onSkip : handleBack}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2"
          >
            {step === 1 ? (
              'Skip Setup'
            ) : (
              <>
                <ArrowLeft className="w-4 h-4" />
                Back
              </>
            )}
          </button>
          
          <button
            onClick={handleNext}
            disabled={step === 1 && !config.organizationName}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === totalSteps ? 'Start Using SecuraMem' : 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook to check if first run
export const useFirstRun = () => {
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('securamem_onboarding_complete');
    setIsFirstRun(!hasCompletedOnboarding);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('securamem_onboarding_complete', 'true');
    setIsFirstRun(false);
  };

  return { isFirstRun, completeOnboarding };
};

export default OnboardingModal;
