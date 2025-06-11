const claudeAI = require('./claudeAISentimentAnalysis');
const database = require('../utils/database');
const logger = require('../utils/logger');
const redis = require('../utils/redis');

class ClinicalInsightsGeneratorService {
  constructor() {
    this.claudeApiKey = process.env.ANTHROPIC_API_KEY;
    this.model = 'claude-3-5-sonnet-20241022';
  }

  async generatePatientInsights(patientId, timeframe = '30d') {
    const startTime = Date.now();
    
    try {
      logger.info('Generating clinical insights for patient', { patientId, timeframe });

      // Check cache first
      const cacheKey = `clinical_insights:${patientId}:${timeframe}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info('Clinical insights cache hit', { patientId });
        return JSON.parse(cached);
      }

      // Fetch patient data across all apps
      const patientData = await this.fetchPatientData(patientId, timeframe);
      
      if (!patientData || patientData.length === 0) {
        throw new Error('No patient data found for clinical insights generation');
      }

      // Generate comprehensive clinical insights using Claude AI
      const insights = await this.generateComprehensiveInsights(patientData, patientId);
      
      // Generate specific insights by category
      const [
        riskAssessment,
        treatmentRecommendations,
        supportOptimization,
        relationshipHealth,
        predictiveInsights
      ] = await Promise.all([
        this.generateRiskAssessment(patientData),
        this.generateTreatmentRecommendations(patientData),
        this.generateSupportOptimization(patientData),
        this.assessRelationshipHealth(patientData),
        this.generatePredictiveInsights(patientData)
      ]);

      const result = {
        patient_id: patientId,
        timeframe,
        generated_at: new Date().toISOString(),
        comprehensive_insights: insights,
        risk_assessment: riskAssessment,
        treatment_recommendations: treatmentRecommendations,
        support_optimization: supportOptimization,
        relationship_health: relationshipHealth,
        predictive_insights: predictiveInsights,
        data_summary: {
          total_entries: patientData.length,
          apps_involved: [...new Set(patientData.map(d => d.app_name))],
          date_range: {
            start: Math.min(...patientData.map(d => new Date(d.created_at))).toISOString(),
            end: Math.max(...patientData.map(d => new Date(d.created_at))).toISOString()
          }
        },
        processing_time: Date.now() - startTime,
        provider: 'claude-ai'
      };

      // Cache results for 4 hours
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 14400);
      
      // Store insights in database
      await this.storeInsights(result);

      return result;

    } catch (error) {
      logger.error('Clinical insights generation failed:', error);
      throw error;
    }
  }

  async fetchPatientData(patientId, timeframe) {
    try {
      const days = this.parseTimeframe(timeframe);
      
      const query = `
        SELECT 
          sd.*,
          cm.context_type,
          cm.metadata as context_metadata
        FROM sentiment_data sd
        LEFT JOIN context_metadata cm ON sd.id = cm.sentiment_data_id
        WHERE sd.user_id = $1
        AND sd.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY sd.created_at DESC
      `;

      const result = await database.query(query, [patientId]);
      return result.rows;

    } catch (error) {
      logger.error('Error fetching patient data:', error);
      throw error;
    }
  }

  async generateComprehensiveInsights(patientData, patientId) {
    try {
      const prompt = `You are Dr. Alex AI, a specialized clinical AI assistant. Generate comprehensive clinical insights for this patient based on their sentiment and behavioral data:

PATIENT ID: ${patientId}
TIME PERIOD: ${patientData.length} data points over recent period

DATA SUMMARY:
${JSON.stringify(this.summarizePatientData(patientData), null, 2)}

Generate comprehensive clinical insights in JSON format:
{
  "executive_summary": "<concise clinical assessment>",
  "primary_concerns": [
    {
      "concern": "<clinical concern>",
      "severity": "<low|medium|high|critical>",
      "evidence": ["<supporting evidence>"],
      "recommended_action": "<immediate action needed>"
    }
  ],
  "positive_indicators": [
    {
      "indicator": "<positive finding>",
      "strength": "<low|medium|high>",
      "clinical_significance": "<significance explanation>"
    }
  ],
  "pattern_analysis": {
    "mood_patterns": "<observed mood patterns>",
    "behavioral_trends": "<behavioral observations>",
    "symptom_progression": "<symptom evolution>",
    "treatment_response": "<response to treatment>"
  },
  "clinical_priorities": {
    "immediate": ["<immediate priorities>"],
    "short_term": ["<1-4 week priorities>"],
    "long_term": ["<1+ month priorities>"]
  },
  "care_coordination": {
    "specialists_needed": ["<specialist referrals>"],
    "family_involvement": "<family engagement recommendations>",
    "monitoring_frequency": "<recommended monitoring schedule>"
  },
  "crisis_indicators": {
    "current_risk": "<none|low|medium|high|critical>",
    "warning_signs": ["<specific warning signs>"],
    "safety_plan": "<safety recommendations>"
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Comprehensive insights generation failed:', error);
      throw error;
    }
  }

  async generateRiskAssessment(patientData) {
    try {
      const prompt = `As Dr. Alex AI, conduct a clinical risk assessment based on this patient data:

DATA: ${JSON.stringify(this.summarizePatientData(patientData), null, 2)}

Generate risk assessment in JSON:
{
  "overall_risk_level": "<low|medium|high|critical>",
  "risk_factors": [
    {
      "factor": "<risk factor>",
      "severity": "<low|medium|high>",
      "evidence": ["<supporting evidence>"],
      "mitigation": "<risk mitigation strategy>"
    }
  ],
  "protective_factors": [
    {
      "factor": "<protective factor>",
      "strength": "<low|medium|high>",
      "reinforcement": "<how to strengthen>"
    }
  ],
  "crisis_risk": {
    "suicide_risk": "<none|low|medium|high|imminent>",
    "self_harm_risk": "<none|low|medium|high>",
    "substance_abuse_risk": "<none|low|medium|high>",
    "relationship_crisis_risk": "<none|low|medium|high>"
  },
  "monitoring_recommendations": {
    "frequency": "<daily|weekly|biweekly|monthly>",
    "key_indicators": ["<indicators to monitor>"],
    "alert_thresholds": ["<when to escalate>"]
  },
  "intervention_urgency": "<none|routine|urgent|emergent>"
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Risk assessment generation failed:', error);
      throw error;
    }
  }

  async generateTreatmentRecommendations(patientData) {
    try {
      const prompt = `As Dr. Alex AI, provide evidence-based treatment recommendations:

PATIENT DATA: ${JSON.stringify(this.summarizePatientData(patientData), null, 2)}

Generate treatment recommendations in JSON:
{
  "pharmacological": {
    "current_effectiveness": "<assessment of current meds>",
    "adjustments": ["<medication adjustments>"],
    "new_considerations": ["<new medication options>"],
    "adherence_strategies": ["<adherence improvement>"]
  },
  "psychotherapy": {
    "modalities": ["<recommended therapy types>"],
    "frequency": "<recommended frequency>",
    "focus_areas": ["<therapy focus areas>"],
    "group_vs_individual": "<preference with rationale>"
  },
  "lifestyle_interventions": {
    "exercise": "<exercise recommendations>",
    "nutrition": "<nutrition guidance>",
    "sleep": "<sleep hygiene>",
    "stress_management": ["<stress management techniques>"]
  },
  "digital_therapeutics": {
    "app_optimizations": ["<app usage optimizations>"],
    "digital_tools": ["<recommended digital tools>"],
    "monitoring_apps": ["<monitoring recommendations>"]
  },
  "complementary_approaches": {
    "mindfulness": "<mindfulness recommendations>",
    "alternative_therapies": ["<alternative options>"],
    "support_groups": ["<support group recommendations>"]
  },
  "treatment_timeline": {
    "immediate": ["<0-2 weeks>"],
    "short_term": ["<2-12 weeks>"],
    "long_term": ["<3+ months>"]
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Treatment recommendations generation failed:', error);
      throw error;
    }
  }

  async generateSupportOptimization(patientData) {
    try {
      const supportData = patientData.filter(d => d.app_name === 'SupportPartner');
      
      const prompt = `As Dr. Alex AI, optimize support strategies based on relationship and support data:

SUPPORT DATA: ${JSON.stringify(supportData.slice(0, 20), null, 2)}

Generate support optimization in JSON:
{
  "current_support_assessment": {
    "support_quality": "<poor|fair|good|excellent>",
    "communication_effectiveness": "<poor|fair|good|excellent>",
    "partner_understanding": "<low|medium|high>",
    "support_consistency": "<inconsistent|variable|consistent>"
  },
  "optimization_strategies": {
    "communication_improvements": ["<communication strategies>"],
    "partner_education": ["<education for partner>"],
    "conflict_resolution": ["<conflict resolution strategies>"],
    "intimacy_rebuilding": ["<intimacy recommendations>"]
  },
  "support_interventions": {
    "immediate": ["<immediate support interventions>"],
    "skill_building": ["<skills to develop>"],
    "couples_therapy": "<couples therapy recommendations>",
    "family_involvement": ["<family support strategies>"]
  },
  "crisis_support": {
    "emergency_protocols": ["<crisis support protocols>"],
    "safety_planning": ["<safety plan elements>"],
    "professional_contacts": ["<who to contact in crisis>"]
  },
  "support_monitoring": {
    "key_metrics": ["<metrics to track>"],
    "improvement_indicators": ["<signs of improvement>"],
    "warning_signs": ["<concerning patterns>"]
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Support optimization generation failed:', error);
      throw error;
    }
  }

  async assessRelationshipHealth(patientData) {
    try {
      const relationshipData = patientData.filter(d => 
        d.app_name === 'SupportPartner' || d.relationship_context
      );

      const prompt = `As Dr. Alex AI, assess relationship health and its impact on patient wellbeing:

RELATIONSHIP DATA: ${JSON.stringify(relationshipData.slice(0, 15), null, 2)}

Generate relationship health assessment in JSON:
{
  "relationship_health_score": <0-100>,
  "health_dimensions": {
    "communication": <0-100>,
    "emotional_support": <0-100>,
    "intimacy": <0-100>,
    "conflict_resolution": <0-100>,
    "shared_goals": <0-100>,
    "trust_security": <0-100>
  },
  "relationship_strengths": ["<identified strengths>"],
  "relationship_challenges": [
    {
      "challenge": "<relationship challenge>",
      "severity": "<low|medium|high>",
      "impact_on_health": "<impact assessment>",
      "intervention": "<recommended intervention>"
    }
  ],
  "health_impact_analysis": {
    "positive_impacts": ["<how relationship helps health>"],
    "negative_impacts": ["<how relationship hurts health>"],
    "treatment_implications": ["<treatment considerations>"]
  },
  "improvement_opportunities": {
    "high_impact": ["<high-impact improvements>"],
    "low_effort": ["<easy wins>"],
    "long_term": ["<long-term relationship goals>"]
  },
  "clinical_recommendations": {
    "couples_therapy": "<recommendation and rationale>",
    "individual_work": ["<individual therapy needs>"],
    "education": ["<psychoeducation recommendations>"],
    "communication_tools": ["<tools and techniques>"]
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Relationship health assessment failed:', error);
      throw error;
    }
  }

  async generatePredictiveInsights(patientData) {
    try {
      const prompt = `As Dr. Alex AI, generate predictive insights for patient trajectory:

HISTORICAL DATA: ${JSON.stringify(this.summarizePatientData(patientData), null, 2)}

Generate predictive insights in JSON:
{
  "trajectory_prediction": {
    "overall_prognosis": "<excellent|good|fair|guarded|poor>",
    "confidence": <0-100>,
    "timeframe": "<prediction timeframe>",
    "key_factors": ["<factors influencing prognosis>"]
  },
  "anticipated_challenges": [
    {
      "challenge": "<predicted challenge>",
      "likelihood": <0-100>,
      "timeframe": "<when expected>",
      "severity": "<low|medium|high>",
      "prevention": ["<prevention strategies>"]
    }
  ],
  "improvement_opportunities": [
    {
      "opportunity": "<improvement opportunity>",
      "likelihood": <0-100>,
      "timeframe": "<when achievable>",
      "requirements": ["<what's needed>"]
    }
  ],
  "risk_trajectory": {
    "suicide_risk_trend": "<decreasing|stable|increasing>",
    "crisis_likelihood": <0-100>,
    "hospitalization_risk": "<low|medium|high>",
    "relapse_risk": "<low|medium|high>"
  },
  "treatment_predictions": {
    "response_likelihood": <0-100>,
    "optimal_modalities": ["<best treatment approaches>"],
    "expected_timeline": "<treatment duration>",
    "success_factors": ["<factors for success>"]
  },
  "monitoring_priorities": {
    "critical_periods": ["<when to monitor closely>"],
    "early_warning_signs": ["<signs of deterioration>"],
    "progress_indicators": ["<signs of improvement>"]
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Predictive insights generation failed:', error);
      throw error;
    }
  }

  summarizePatientData(patientData) {
    if (!patientData || patientData.length === 0) {
      return { message: 'No data available' };
    }

    const appGroups = {};
    patientData.forEach(item => {
      if (!appGroups[item.app_name]) {
        appGroups[item.app_name] = [];
      }
      appGroups[item.app_name].push(item);
    });

    const summary = {
      totalEntries: patientData.length,
      dateRange: {
        start: Math.min(...patientData.map(d => new Date(d.created_at))),
        end: Math.max(...patientData.map(d => new Date(d.created_at)))
      },
      apps: Object.keys(appGroups),
      sentimentTrends: {},
      healthcareContext: [],
      relationshipContext: [],
      crisisIndicators: []
    };

    Object.keys(appGroups).forEach(appName => {
      const appData = appGroups[appName];
      summary.sentimentTrends[appName] = {
        avgSentiment: appData.reduce((sum, d) => sum + d.sentiment_score, 0) / appData.length,
        entries: appData.length,
        recentTrend: this.calculateTrend(appData.slice(-7))
      };

      // Extract healthcare and relationship contexts
      appData.forEach(item => {
        if (item.healthcare_context) {
          summary.healthcareContext.push(...(item.healthcare_context.indicators || []));
        }
        if (item.relationship_context) {
          summary.relationshipContext.push(...(item.relationship_context.indicators || []));
        }
        if (item.crisis_assessment && item.crisis_assessment.risk_level !== 'none') {
          summary.crisisIndicators.push(item.crisis_assessment);
        }
      });
    });

    return summary;
  }

  calculateTrend(recentData) {
    if (recentData.length < 2) return 'insufficient_data';
    
    const values = recentData.map(d => d.sentiment_score);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  parseTimeframe(timeframe) {
    const timeMap = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    return timeMap[timeframe] || 30;
  }

  async callClaudeAPI(prompt) {
    try {
      const axios = require('axios');
      
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      return response.data.content[0].text;

    } catch (error) {
      logger.error('Claude API call failed:', error);
      throw error;
    }
  }

  async storeInsights(insights) {
    try {
      const query = `
        INSERT INTO clinical_insights (
          patient_id, timeframe, insights_data, generated_at, provider
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (patient_id, timeframe) 
        DO UPDATE SET 
          insights_data = $3,
          generated_at = $4,
          updated_at = NOW()
      `;

      await database.query(query, [
        insights.patient_id,
        insights.timeframe,
        JSON.stringify(insights),
        insights.generated_at,
        'claude-ai'
      ]);

      logger.info('Clinical insights stored', {
        patientId: insights.patient_id,
        timeframe: insights.timeframe
      });

    } catch (error) {
      logger.error('Failed to store clinical insights:', error);
    }
  }

  // Generate crisis intervention recommendations
  async generateCrisisIntervention(patientId, crisisData) {
    try {
      const prompt = `CRISIS INTERVENTION NEEDED - As Dr. Alex AI, provide immediate crisis intervention recommendations:

PATIENT ID: ${patientId}
CRISIS DATA: ${JSON.stringify(crisisData, null, 2)}

Generate immediate crisis intervention in JSON:
{
  "urgency_level": "<routine|urgent|emergent|imminent>",
  "immediate_actions": ["<actions to take right now>"],
  "safety_assessment": {
    "immediate_danger": <boolean>,
    "safety_plan_needed": <boolean>,
    "hospitalization_needed": <boolean>,
    "emergency_contacts": ["<who to call>"]
  },
  "intervention_strategies": {
    "de_escalation": ["<de-escalation techniques>"],
    "coping_skills": ["<immediate coping strategies>"],
    "support_activation": ["<support to activate>"],
    "professional_help": ["<professional resources>"]
  },
  "follow_up": {
    "timeline": "<follow-up schedule>",
    "monitoring": ["<what to monitor>"],
    "next_steps": ["<next clinical steps>"]
  }
}`;

      const response = await this.callClaudeAPI(prompt);
      return JSON.parse(response);

    } catch (error) {
      logger.error('Crisis intervention generation failed:', error);
      throw error;
    }
  }
}

module.exports = new ClinicalInsightsGeneratorService();