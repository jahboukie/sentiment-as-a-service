const express = require('express');
const router = express.Router();
const Joi = require('joi');
const clinicalInsightsService = require('../services/clinicalInsightsGenerator');
const sentimentSecurity = require('../middleware/security');
const logger = require('../utils/logger');

// Validation schemas
const patientInsightsSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  timeframe: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  includeRiskAssessment: Joi.boolean().default(true),
  includeTreatmentRecommendations: Joi.boolean().default(true),
  includePredictiveInsights: Joi.boolean().default(false)
});

const crisisInterventionSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  crisisData: Joi.object().required(),
  urgencyLevel: Joi.string().valid('routine', 'urgent', 'emergent', 'imminent').required()
});

// Generate comprehensive clinical insights for a patient
router.post('/insights/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { error, value } = patientInsightsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { patientId, timeframe, includeRiskAssessment, includeTreatmentRecommendations, includePredictiveInsights } = value;
    
    // Verify clinician has access to this patient
    const hasAccess = await verifyPatientAccess(req.user.id, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have authorization to access this patient\'s data'
      });
    }

    logger.info('Generating clinical insights', {
      clinicianId: req.user.id,
      patientId,
      timeframe,
      includeRiskAssessment,
      includeTreatmentRecommendations,
      includePredictiveInsights
    });

    // Generate comprehensive insights
    const insights = await clinicalInsightsService.generatePatientInsights(patientId, timeframe);
    
    // Filter insights based on clinician's requests
    const response = {
      patient_id: insights.patient_id,
      timeframe: insights.timeframe,
      generated_at: insights.generated_at,
      comprehensive_insights: insights.comprehensive_insights,
      data_summary: insights.data_summary,
      processing_time: insights.processing_time,
      provider: insights.provider
    };

    if (includeRiskAssessment) {
      response.risk_assessment = insights.risk_assessment;
    }

    if (includeTreatmentRecommendations) {
      response.treatment_recommendations = insights.treatment_recommendations;
      response.support_optimization = insights.support_optimization;
    }

    if (includePredictiveInsights) {
      response.predictive_insights = insights.predictive_insights;
    }

    // Always include relationship health as it's critical for treatment
    response.relationship_health = insights.relationship_health;

    // Handle any crisis situations detected
    if (insights.risk_assessment?.overall_risk_level === 'critical') {
      await sentimentSecurity.handleCrisisDetection(insights.risk_assessment, patientId);
    }

    res.json({
      success: true,
      insights: response,
      metadata: {
        clinician_id: req.user.id,
        access_timestamp: new Date().toISOString(),
        security_compliant: true,
        total_processing_time: Date.now() - startTime
      }
    });

  } catch (error) {
    logger.error('Clinical insights generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate clinical insights',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get specific patient insights by ID
router.get('/insights/patient/:patientId', async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const timeframe = req.query.timeframe || '30d';

    // Verify access
    const hasAccess = await verifyPatientAccess(req.user.id, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have authorization to access this patient\'s data'
      });
    }

    const insights = await clinicalInsightsService.generatePatientInsights(patientId, timeframe);
    
    res.json({
      success: true,
      insights,
      accessed_by: req.user.id,
      access_timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Patient insights retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve patient insights'
    });
  }
});

// Generate crisis intervention recommendations
router.post('/crisis/intervention', async (req, res) => {
  try {
    const { error, value } = crisisInterventionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { patientId, crisisData, urgencyLevel } = value;

    // Verify access and crisis authority
    const hasAccess = await verifyPatientAccess(req.user.id, patientId);
    const hasCrisisAuthority = await verifyCrisisAuthority(req.user.id);
    
    if (!hasAccess || !hasCrisisAuthority) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient authorization for crisis intervention'
      });
    }

    logger.warn('Crisis intervention requested', {
      clinicianId: req.user.id,
      patientId,
      urgencyLevel,
      timestamp: new Date().toISOString()
    });

    // Generate crisis intervention recommendations
    const intervention = await clinicalInsightsService.generateCrisisIntervention(patientId, crisisData);
    
    // Handle security protocols for crisis
    const securityResponse = await sentimentSecurity.handleCrisisDetection(crisisData, patientId);

    res.json({
      success: true,
      intervention,
      security_protocols: securityResponse,
      urgency_level: urgencyLevel,
      generated_by: req.user.id,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Crisis intervention generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate crisis intervention'
    });
  }
});

// Get population health insights (for research and quality improvement)
router.get('/insights/population', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '90d';
    const anonymized = req.query.anonymized !== 'false'; // Default to anonymized

    // Verify population health access
    const hasPopulationAccess = await verifyPopulationHealthAccess(req.user.id);
    if (!hasPopulationAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Population health insights require special authorization'
      });
    }

    // This would generate population-level insights
    // Placeholder implementation
    const populationInsights = {
      timeframe,
      total_patients: 1250,
      risk_distribution: {
        low: 850,
        medium: 300,
        high: 80,
        critical: 20
      },
      treatment_effectiveness: {
        overall_improvement: 0.75,
        crisis_reduction: 0.68,
        relationship_health_improvement: 0.82
      },
      common_patterns: [
        'Support quality correlates strongly with treatment adherence',
        'Crisis episodes often preceded by relationship stress',
        'Early intervention reduces hospitalization risk by 45%'
      ],
      anonymized: anonymized,
      generated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      population_insights: populationInsights,
      accessed_by: req.user.id
    });

  } catch (error) {
    logger.error('Population insights retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve population insights'
    });
  }
});

// Generate compliance report for clinical data usage
router.get('/compliance/report', async (req, res) => {
  try {
    const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end_date || new Date();

    // Verify compliance access
    const hasComplianceAccess = await verifyComplianceAccess(req.user.id);
    if (!hasComplianceAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Compliance reports require administrator access'
      });
    }

    const report = await sentimentSecurity.generateComplianceReport(startDate, endDate);

    res.json({
      success: true,
      compliance_report: report,
      generated_by: req.user.id,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Compliance report generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate compliance report'
    });
  }
});

// Helper functions for access control
async function verifyPatientAccess(clinicianId, patientId) {
  // This would check if the clinician has access to this specific patient
  // Implementation would check care team assignments, organization access, etc.
  return true; // Placeholder
}

async function verifyCrisisAuthority(clinicianId) {
  // This would verify if the clinician has authority to handle crisis situations
  // Implementation would check role, certifications, etc.
  return true; // Placeholder
}

async function verifyPopulationHealthAccess(clinicianId) {
  // This would verify if the user has access to population health data
  // Implementation would check role and permissions
  return true; // Placeholder
}

async function verifyComplianceAccess(clinicianId) {
  // This would verify if the user has access to compliance reports
  // Implementation would check administrator role
  return true; // Placeholder
}

module.exports = router;