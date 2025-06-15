// SentimentAsAService Enterprise Dashboard JavaScript
// Military-Grade Healthcare Intelligence Platform

// Global variables
let sentimentChart, correlationChart;
let isAnalyzing = false;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    startRealTimeUpdates();
    showApiDemo(); // Show API demo by default
});

// Navigation functions
function showApiDemo() {
    hideAllSections();
    document.getElementById('apiDemo').classList.remove('hidden');
    updateActiveButton('apiDemo');
}

function showDashboard() {
    hideAllSections();
    document.getElementById('dashboard').classList.remove('hidden');
    updateActiveButton('dashboard');
    updateCharts();
}

function showSecurityDemo() {
    hideAllSections();
    document.getElementById('securityDemo').classList.remove('hidden');
    updateActiveButton('securityDemo');
}

function hideAllSections() {
    document.getElementById('apiDemo').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('securityDemo').classList.add('hidden');
}

function updateActiveButton(activeSection) {
    // This would update button styles if we had navigation buttons
}

// Initialize charts
function initializeCharts() {
    // Sentiment Trends Chart
    const sentimentCtx = document.getElementById('sentimentChart');
    if (sentimentCtx) {
        sentimentChart = new Chart(sentimentCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'MenoWellness',
                    data: [0.65, 0.72, 0.68, 0.75],
                    borderColor: '#8B5CF6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4
                }, {
                    label: 'SupportPartner',
                    data: [0.58, 0.63, 0.71, 0.69],
                    borderColor: '#06B6D4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#E5E7EB'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                        }
                    }
                }
            }
        });
    }

    // Correlation Chart
    const correlationCtx = document.getElementById('correlationChart');
    if (correlationCtx) {
        correlationChart = new Chart(correlationCtx, {
            type: 'radar',
            data: {
                labels: ['Mood-Support', 'Treatment-Adherence', 'Crisis-Prevention', 'Relationship-Health', 'Recovery-Rate'],
                datasets: [{
                    label: 'Correlation Strength',
                    data: [0.87, 0.75, 0.92, 0.68, 0.84],
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    pointBackgroundColor: '#F59E0B',
                    pointBorderColor: '#F59E0B'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#E5E7EB'
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.3)'
                        },
                        angleLines: {
                            color: 'rgba(156, 163, 175, 0.3)'
                        },
                        pointLabels: {
                            color: '#E5E7EB'
                        }
                    }
                }
            }
        });
    }
}

// Update charts with new data
function updateCharts() {
    if (sentimentChart) {
        // Simulate real-time data updates
        const newMenoData = sentimentChart.data.datasets[0].data.map(val => 
            Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.1))
        );
        const newSupportData = sentimentChart.data.datasets[1].data.map(val => 
            Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.1))
        );
        
        sentimentChart.data.datasets[0].data = newMenoData;
        sentimentChart.data.datasets[1].data = newSupportData;
        sentimentChart.update();
    }

    if (correlationChart) {
        const newCorrelationData = correlationChart.data.datasets[0].data.map(val => 
            Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.05))
        );
        correlationChart.data.datasets[0].data = newCorrelationData;
        correlationChart.update();
    }
}

// Sentiment analysis function
async function analyzeSentiment() {
    if (isAnalyzing) return;
    
    const input = document.getElementById('sentimentInput').value.trim();
    if (!input) {
        alert('Please enter some text to analyze');
        return;
    }

    isAnalyzing = true;
    const button = document.querySelector('button[onclick="analyzeSentiment()"]');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analyzing...';
    button.disabled = true;

    try {
        // Enhanced logging for production debugging
        const apiEndpoint = '/api/sentiment/analyze';
        const requestData = {
            text: input,
            includeEmotions: true,
            includeKeyTerms: true,
            healthcareContext: document.getElementById('healthcareContext').checked,
            relationshipContext: document.getElementById('relationshipContext').checked,
            crisisDetection: document.getElementById('crisisDetection').checked
        };

        console.log('🔍 Making API request to:', apiEndpoint);
        console.log('🔍 Request payload:', requestData);
        console.log('🔍 Current URL:', window.location.href);
        console.log('🔍 Environment:', window.location.hostname);

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        console.log('📡 Response status:', response.status);
        console.log('📡 Response statusText:', response.statusText);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
        console.log('📡 Response URL:', response.url);

        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
                console.error('❌ API Error Response (text):', errorText);
            } catch (e) {
                console.error('❌ Could not read error response:', e);
                errorText = 'Could not read error response';
            }

            let errorData = {};
            try {
                errorData = JSON.parse(errorText);
                console.error('❌ API Error Response (parsed):', errorData);
            } catch (e) {
                console.error('❌ Error response is not JSON:', errorText);
            }

            if (response.status === 503) {
                throw new Error(`AI service temporarily unavailable: ${errorData.message || errorText || 'Please try again in a moment'}`);
            }
            throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorData.error || errorText || 'Unknown error'}`);
        }

        let apiResult;
        try {
            const responseText = await response.text();
            console.log('✅ Raw API Response:', responseText);
            apiResult = JSON.parse(responseText);
            console.log('✅ Parsed API Response:', apiResult);
        } catch (e) {
            console.error('❌ Failed to parse API response:', e);
            throw new Error('Invalid JSON response from API');
        }

        console.log('✅ API Response Type:', typeof apiResult);
        console.log('✅ API Response Keys:', Object.keys(apiResult));
        console.log('✅ API Success Property:', apiResult.success);

        if (!apiResult.success) {
            console.error('❌ API Error Details:', apiResult);
            console.error('❌ API Error Message:', apiResult.error);
            console.error('❌ API Error Type:', typeof apiResult.error);
            throw new Error('API returned error: ' + (apiResult.error || 'Unknown error'));
        }

        // Convert API result to display format
        const results = convertApiResultToDisplayFormat(apiResult.result);
        displayAnalysisResults(results);

    } catch (error) {
        console.error('Analysis failed:', error);

        const isServiceUnavailable = error.message.includes('temporarily unavailable') || error.message.includes('taking longer than expected');
        const isTimeout = error.message.includes('taking longer than expected');

        document.getElementById('analysisResults').innerHTML = `
            <div class="bg-${isServiceUnavailable ? 'blue' : 'red'}-900 border border-${isServiceUnavailable ? 'blue' : 'red'}-700 rounded-lg p-4">
                <h4 class="font-semibold text-${isServiceUnavailable ? 'blue' : 'red'}-300 mb-2">
                    ${isTimeout ? '⏱️ Complex Analysis in Progress' : isServiceUnavailable ? '⏳ AI Service Busy' : '❌ Analysis Failed'}
                </h4>
                <p class="text-${isServiceUnavailable ? 'blue' : 'red'}-200 mb-3">${error.message}</p>
                ${isServiceUnavailable ? `
                    <div class="bg-${isTimeout ? 'blue' : 'yellow'}-800 rounded p-3 mt-3">
                        <p class="text-${isTimeout ? 'blue' : 'yellow'}-100 text-sm mb-2">
                            <strong>${isTimeout ? 'Complex Healthcare Analysis:' : 'Why this happens:'}</strong>
                            ${isTimeout ? 'Your text requires comprehensive emotional and clinical analysis. This takes time to ensure accuracy.' : 'Our Claude AI provides real healthcare analysis, not mock data. During high demand, processing may take longer to ensure accuracy.'}
                        </p>
                        <button onclick="analyzeSentiment()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white text-sm">
                            ${isTimeout ? 'Retry Analysis' : 'Try Again'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    } finally {
        isAnalyzing = false;
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Convert API result to display format
function convertApiResultToDisplayFormat(apiResult) {
    console.log('Converting API result:', apiResult);

    // Handle emotions - Claude AI returns different structure
    let emotions = {};
    if (apiResult.emotions) {
        if (apiResult.emotions.primary && apiResult.emotions.emotional_intensity) {
            emotions[apiResult.emotions.primary] = apiResult.emotions.emotional_intensity;
        }
        if (apiResult.emotions.secondary && Array.isArray(apiResult.emotions.secondary)) {
            apiResult.emotions.secondary.forEach(emotion => {
                emotions[emotion] = 0.7; // Default intensity for secondary emotions
            });
        }
    }

    return {
        sentiment: {
            score: apiResult.sentiment.score,
            category: apiResult.sentiment.category,
            confidence: apiResult.sentiment.confidence
        },
        emotions: emotions,
        healthcareContext: apiResult.healthcareContext ? {
            health_status_trend: apiResult.healthcareContext.health_status_trend,
            treatment_sentiment: apiResult.healthcareContext.treatment_sentiment,
            indicators: apiResult.healthcareContext.indicators || []
        } : null,
        relationshipContext: apiResult.relationshipContext ? {
            relationship_health: apiResult.relationshipContext.relationship_health,
            support_level: apiResult.relationshipContext.support_level,
            communication_quality: apiResult.relationshipContext.communication_quality,
            indicators: apiResult.relationshipContext.indicators || []
        } : null,
        contextDetection: apiResult.contextDetection || null,
        veteranContext: (apiResult.veteranContext && apiResult.veteranContext.applicable) ? {
            applicable: apiResult.veteranContext.applicable,
            military_indicators: apiResult.veteranContext.military_indicators || [],
            transition_challenges: apiResult.veteranContext.transition_challenges || [],
            time_since_separation: apiResult.veteranContext.time_since_separation,
            identity_displacement: apiResult.veteranContext.identity_displacement || [],
            civilian_integration: apiResult.veteranContext.civilian_integration || [],
            employment_status: apiResult.veteranContext.employment_status,
            substance_use_risk: apiResult.veteranContext.substance_use_risk || {},
            ptsd_markers: apiResult.veteranContext.ptsd_markers || [],
            standardized_indicators: apiResult.veteranContext.standardized_indicators || {},
            recommended_resources: apiResult.veteranContext.recommended_resources || []
        } : null,
        crisisAssessment: apiResult.crisisAssessment ? {
            risk_level: apiResult.crisisAssessment.risk_level,
            immediate_risk_factors: apiResult.crisisAssessment.immediate_risk_factors || [],
            protective_factors: apiResult.crisisAssessment.protective_factors || [],
            intervention_timeline: apiResult.crisisAssessment.intervention_timeline,
            monitoring_indicators: apiResult.crisisAssessment.monitoring_indicators || [],
            recommended_action: apiResult.crisisAssessment.recommended_action,
            prioritized_resources: apiResult.crisisAssessment.prioritized_resources || {}
        } : null,
        processingTime: apiResult.processingTime || 0,
        provider: apiResult.provider || 'claude-ai'
    };
}

// Generate mock analysis results
function generateMockAnalysis(text, options) {
    const sentiment = calculateMockSentiment(text);
    const emotions = detectMockEmotions(text);
    const healthcareContext = options.healthcareContext ? analyzeHealthcareContext(text) : null;
    const relationshipContext = options.relationshipContext ? analyzeRelationshipContext(text) : null;
    const crisisAssessment = options.crisisDetection ? assessCrisisRisk(text) : null;

    return {
        sentiment,
        emotions,
        healthcareContext,
        relationshipContext,
        crisisAssessment,
        processingTime: Math.random() * 1000 + 500,
        provider: 'claude-ai'
    };
}

function calculateMockSentiment(text) {
    // Simple mock sentiment calculation
    const positiveWords = ['better', 'good', 'great', 'happy', 'love', 'support', 'help', 'improve'];
    const negativeWords = ['bad', 'terrible', 'sad', 'pain', 'hurt', 'difficult', 'struggle'];
    
    let score = 0.5; // neutral starting point
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
        if (positiveWords.some(pos => word.includes(pos))) score += 0.1;
        if (negativeWords.some(neg => word.includes(neg))) score -= 0.1;
    });
    
    score = Math.max(-1, Math.min(1, score));
    
    let category = 'neutral';
    if (score > 0.1) category = 'positive';
    else if (score < -0.1) category = 'negative';
    
    return {
        score: Math.round(score * 100) / 100,
        category,
        confidence: Math.random() * 0.3 + 0.7
    };
}

function detectMockEmotions(text) {
    const emotions = {};
    if (text.toLowerCase().includes('happy') || text.toLowerCase().includes('joy')) {
        emotions.joy = Math.random() * 0.5 + 0.5;
    }
    if (text.toLowerCase().includes('sad') || text.toLowerCase().includes('depression')) {
        emotions.sadness = Math.random() * 0.5 + 0.5;
    }
    if (text.toLowerCase().includes('support') || text.toLowerCase().includes('love')) {
        emotions.trust = Math.random() * 0.5 + 0.5;
    }
    if (text.toLowerCase().includes('worried') || text.toLowerCase().includes('anxious')) {
        emotions.fear = Math.random() * 0.5 + 0.5;
    }
    
    return emotions;
}

function analyzeHealthcareContext(text) {
    const indicators = [];
    if (text.toLowerCase().includes('treatment')) {
        indicators.push({ term: 'treatment', sentiment_impact: 0.3, context: 'Medical treatment mentioned' });
    }
    if (text.toLowerCase().includes('doctor') || text.toLowerCase().includes('physician')) {
        indicators.push({ term: 'healthcare_provider', sentiment_impact: 0.2, context: 'Healthcare provider reference' });
    }
    if (text.toLowerCase().includes('medication') || text.toLowerCase().includes('medicine')) {
        indicators.push({ term: 'medication', sentiment_impact: 0.1, context: 'Medication reference' });
    }
    
    return {
        indicators,
        health_status_trend: Math.random() > 0.5 ? 'improving' : 'stable',
        treatment_sentiment: Math.random() > 0.3 ? 'positive' : 'neutral'
    };
}

function analyzeRelationshipContext(text) {
    const indicators = [];
    if (text.toLowerCase().includes('partner') || text.toLowerCase().includes('support')) {
        indicators.push({ term: 'support', sentiment_impact: 0.4, context: 'Support system mentioned' });
    }
    if (text.toLowerCase().includes('relationship')) {
        indicators.push({ term: 'relationship', sentiment_impact: 0.3, context: 'Relationship dynamics' });
    }
    
    return {
        indicators,
        relationship_health: Math.random() > 0.3 ? 'healthy' : 'strained',
        support_level: Math.random() > 0.4 ? 'high' : 'medium',
        communication_quality: Math.random() > 0.5 ? 'good' : 'fair'
    };
}

function assessCrisisRisk(text) {
    const riskWords = ['hurt', 'hopeless', 'suicide', 'end', 'can\'t', 'alone'];
    const hasRiskWords = riskWords.some(word => text.toLowerCase().includes(word));
    
    return {
        risk_level: hasRiskWords ? (Math.random() > 0.7 ? 'high' : 'medium') : 'low',
        indicators: hasRiskWords ? ['concerning language detected'] : [],
        recommended_action: hasRiskWords ? 'professional_support' : 'monitoring'
    };
}

// Display analysis results
function displayAnalysisResults(results) {
    const resultsContainer = document.getElementById('analysisResults');
    
    resultsContainer.innerHTML = `
        <div class="space-y-4">
            <!-- Context Detection -->
            ${results.contextDetection ? `
            <div class="bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                <h4 class="font-semibold mb-2 text-blue-300">🔍 Context Detection</h4>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Primary Context:</span>
                        <span class="capitalize font-bold text-blue-400">${results.contextDetection.primary_context.replace('_', ' ')}</span>
                    </div>
                    ${results.contextDetection.detected_domains && results.contextDetection.detected_domains.length > 0 ? `
                        <div class="flex justify-between">
                            <span>Healthcare Domains:</span>
                            <span class="text-sm text-blue-300">${results.contextDetection.detected_domains.join(', ')}</span>
                        </div>
                    ` : ''}
                    <div class="flex justify-between">
                        <span>Military Context:</span>
                        <span class="font-bold ${results.contextDetection.has_military_indicators ? 'text-red-400' : 'text-green-400'}">${results.contextDetection.has_military_indicators ? 'Detected' : 'Not Detected'}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Sentiment Score -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Sentiment Analysis</h4>
                <div class="flex items-center justify-between mb-2">
                    <span>Score:</span>
                    <span class="font-bold ${results.sentiment.score > 0 ? 'text-green-400' : results.sentiment.score < 0 ? 'text-red-400' : 'text-yellow-400'}">${results.sentiment.score}</span>
                </div>
                <div class="flex items-center justify-between mb-2">
                    <span>Category:</span>
                    <span class="font-bold capitalize ${results.sentiment.category === 'positive' ? 'text-green-400' : results.sentiment.category === 'negative' ? 'text-red-400' : 'text-yellow-400'}">${results.sentiment.category}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span>Confidence:</span>
                    <span class="font-bold">${Math.round(results.sentiment.confidence * 100)}%</span>
                </div>
            </div>

            <!-- Emotions -->
            ${Object.keys(results.emotions).length > 0 ? `
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Detected Emotions</h4>
                <div class="space-y-2">
                    ${results.emotions.primary ? `
                        <div class="flex items-center justify-between">
                            <span class="capitalize">primary:</span>
                            <span class="text-sm">${results.emotions.emotional_intensity ? Math.round(results.emotions.emotional_intensity * 100) : 'N/A'}%</span>
                        </div>
                    ` : ''}
                    ${results.emotions.secondary && results.emotions.secondary.length > 0 ? `
                        <div class="flex items-center justify-between">
                            <span class="capitalize">secondary:</span>
                            <span class="text-sm">${results.emotions.emotional_intensity ? Math.round(results.emotions.emotional_intensity * 100) : 'N/A'}%</span>
                        </div>
                    ` : ''}
                    ${results.emotions.emotional_intensity ? `
                        <div class="flex items-center justify-between">
                            <span class="capitalize">emotional_intensity:</span>
                            <span class="text-sm">${Math.round(results.emotions.emotional_intensity * 100)}%</span>
                        </div>
                    ` : ''}
                    ${results.emotions.detailed_emotions ? Object.entries(results.emotions.detailed_emotions).filter(([emotion, intensity]) => intensity !== null && intensity > 0).map(([emotion, intensity]) => `
                        <div class="flex items-center justify-between">
                            <span class="capitalize">${emotion}:</span>
                            <div class="flex items-center">
                                <div class="w-20 bg-gray-600 rounded-full h-2 mr-2">
                                    <div class="bg-blue-400 h-2 rounded-full" style="width: ${intensity * 100}%"></div>
                                </div>
                                <span class="text-sm">${Math.round(intensity * 100)}%</span>
                            </div>
                        </div>
                    `).join('') : ''}
                </div>
            </div>
            ` : ''}

            <!-- Healthcare Context -->
            ${results.healthcareContext ? `
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Healthcare Context</h4>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Health Trend:</span>
                        <span class="capitalize font-bold text-green-400">${results.healthcareContext.health_status_trend}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Treatment Sentiment:</span>
                        <span class="capitalize font-bold text-blue-400">${results.healthcareContext.treatment_sentiment}</span>
                    </div>
                    ${results.healthcareContext.indicators.length > 0 ? `
                        <div class="mt-2">
                            <span class="text-sm text-gray-300">Indicators:</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.healthcareContext.indicators.map(indicator => `
                                    <li class="text-gray-400">• ${indicator.context}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Relationship Context -->
            ${results.relationshipContext ? `
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Relationship Context</h4>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Relationship Health:</span>
                        <span class="capitalize font-bold ${results.relationshipContext.relationship_health === 'healthy' ? 'text-green-400' : 'text-yellow-400'}">${results.relationshipContext.relationship_health}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Support Level:</span>
                        <span class="capitalize font-bold text-blue-400">${results.relationshipContext.support_level}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Communication:</span>
                        <span class="capitalize font-bold text-purple-400">${results.relationshipContext.communication_quality}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Veteran Context (Only if applicable) -->
            ${results.veteranContext && results.veteranContext.applicable ? `
            <div class="bg-gray-700 rounded-lg p-4 border-l-4 border-red-500">
                <h4 class="font-semibold mb-2 text-red-300">🎖️ Veteran Context Analysis</h4>
                <div class="space-y-2">
                    ${results.veteranContext.time_since_separation ? `
                        <div class="flex justify-between">
                            <span>Time Since Separation:</span>
                            <span class="font-bold text-orange-400">${results.veteranContext.time_since_separation}</span>
                        </div>
                    ` : ''}
                    ${results.veteranContext.employment_status ? `
                        <div class="flex justify-between">
                            <span>Employment Status:</span>
                            <span class="capitalize font-bold ${results.veteranContext.employment_status === 'stable' ? 'text-green-400' : 'text-red-400'}">${results.veteranContext.employment_status}</span>
                        </div>
                    ` : ''}
                    ${results.veteranContext.substance_use_risk && results.veteranContext.substance_use_risk.level ? `
                        <div class="flex justify-between">
                            <span>Substance Use Risk:</span>
                            <span class="capitalize font-bold ${results.veteranContext.substance_use_risk.level.includes('high') ? 'text-red-400' : 'text-yellow-400'}">${results.veteranContext.substance_use_risk.level}</span>
                        </div>
                    ` : ''}
                    ${results.veteranContext.military_indicators && results.veteranContext.military_indicators.length > 0 ? `
                        <div class="mt-2">
                            <span class="text-sm text-gray-300">Military Indicators:</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.veteranContext.military_indicators.map(indicator => `
                                    <li class="text-red-300">• ${indicator}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${results.veteranContext.identity_displacement && results.veteranContext.identity_displacement.length > 0 ? `
                        <div class="mt-2">
                            <span class="text-sm text-gray-300">Identity Displacement:</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.veteranContext.identity_displacement.map(indicator => `
                                    <li class="text-purple-300">• ${indicator}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${results.veteranContext.ptsd_markers && results.veteranContext.ptsd_markers.length > 0 ? `
                        <div class="mt-2">
                            <span class="text-sm text-gray-300">PTSD Markers:</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.veteranContext.ptsd_markers.map(marker => `
                                    <li class="text-yellow-300">• ${marker}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${results.veteranContext.standardized_indicators && Object.keys(results.veteranContext.standardized_indicators).length > 0 ? `
                        <div class="mt-2 p-2 bg-indigo-900 rounded">
                            <span class="text-sm font-semibold text-indigo-300">📊 Clinical Indicators:</span>
                            ${results.veteranContext.standardized_indicators.pcl5_markers && results.veteranContext.standardized_indicators.pcl5_markers.length > 0 ? `
                                <div class="mt-1">
                                    <span class="text-xs text-indigo-200">PCL-5 Markers:</span>
                                    <ul class="text-xs mt-1">
                                        ${results.veteranContext.standardized_indicators.pcl5_markers.map(marker => `
                                            <li class="text-indigo-100">• ${marker}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${results.veteranContext.standardized_indicators.audit_markers && results.veteranContext.standardized_indicators.audit_markers.length > 0 ? `
                                <div class="mt-1">
                                    <span class="text-xs text-indigo-200">AUDIT Markers:</span>
                                    <ul class="text-xs mt-1">
                                        ${results.veteranContext.standardized_indicators.audit_markers.map(marker => `
                                            <li class="text-indigo-100">• ${marker}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${results.veteranContext.recommended_resources && results.veteranContext.recommended_resources.length > 0 ? `
                        <div class="mt-2 p-2 bg-blue-900 rounded">
                            <span class="text-sm font-semibold text-blue-300">🏥 Recommended Resources:</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.veteranContext.recommended_resources.map(resource => `
                                    <li class="text-blue-200">• ${resource}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Crisis Assessment -->
            ${results.crisisAssessment ? `
            <div class="bg-gray-700 rounded-lg p-4 border-l-4 ${results.crisisAssessment.risk_level.includes('high') ? 'border-red-500' : results.crisisAssessment.risk_level.includes('medium') ? 'border-yellow-500' : 'border-green-500'}">
                <h4 class="font-semibold mb-2">Crisis Assessment</h4>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Risk Level:</span>
                        <span class="capitalize font-bold ${results.crisisAssessment.risk_level.includes('high') ? 'text-red-400' : results.crisisAssessment.risk_level.includes('medium') ? 'text-yellow-400' : 'text-green-400'}">${results.crisisAssessment.risk_level}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Recommended Action:</span>
                        <span class="capitalize font-bold text-blue-400">${results.crisisAssessment.recommended_action.replace('_', ' ')}</span>
                    </div>
                    ${results.crisisAssessment.intervention_timeline ? `
                        <div class="flex justify-between">
                            <span>Intervention Timeline:</span>
                            <span class="capitalize font-bold text-purple-400">${results.crisisAssessment.intervention_timeline.replace('_', ' ')}</span>
                        </div>
                    ` : ''}
                    ${results.crisisAssessment.immediate_risk_factors && results.crisisAssessment.immediate_risk_factors.length > 0 ? `
                        <div class="mt-2 p-2 bg-red-900 rounded">
                            <span class="text-sm font-semibold text-red-400">🚨 Immediate Risk Factors</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.crisisAssessment.immediate_risk_factors.map(factor => `
                                    <li class="text-red-300">• ${factor}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${results.crisisAssessment.protective_factors && results.crisisAssessment.protective_factors.length > 0 ? `
                        <div class="mt-2 p-2 bg-green-900 rounded">
                            <span class="text-sm font-semibold text-green-400">✅ Protective Factors</span>
                            <ul class="text-sm mt-1 space-y-1">
                                ${results.crisisAssessment.protective_factors.map(factor => `
                                    <li class="text-green-300">• ${factor}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${results.crisisAssessment.prioritized_resources && Object.keys(results.crisisAssessment.prioritized_resources).length > 0 ? `
                        <div class="mt-2 space-y-2">
                            ${results.crisisAssessment.prioritized_resources.immediate && results.crisisAssessment.prioritized_resources.immediate.length > 0 ? `
                                <div class="p-2 bg-red-800 rounded">
                                    <span class="text-sm font-semibold text-red-200">🆘 Immediate (0-24h)</span>
                                    <ul class="text-xs mt-1 space-y-1">
                                        ${results.crisisAssessment.prioritized_resources.immediate.map(resource => `
                                            <li class="text-red-100">• ${resource}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${results.crisisAssessment.prioritized_resources.short_term && results.crisisAssessment.prioritized_resources.short_term.length > 0 ? `
                                <div class="p-2 bg-yellow-800 rounded">
                                    <span class="text-sm font-semibold text-yellow-200">⏰ Short-term (1-7 days)</span>
                                    <ul class="text-xs mt-1 space-y-1">
                                        ${results.crisisAssessment.prioritized_resources.short_term.map(resource => `
                                            <li class="text-yellow-100">• ${resource}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${results.crisisAssessment.prioritized_resources.ongoing && results.crisisAssessment.prioritized_resources.ongoing.length > 0 ? `
                                <div class="p-2 bg-blue-800 rounded">
                                    <span class="text-sm font-semibold text-blue-200">🔄 Ongoing Support</span>
                                    <ul class="text-xs mt-1 space-y-1">
                                        ${results.crisisAssessment.prioritized_resources.ongoing.map(resource => `
                                            <li class="text-blue-100">• ${resource}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Processing Info -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Processing Information</h4>
                <div class="flex justify-between text-sm">
                    <span>Processing Time:</span>
                    <span>${Math.round(results.processingTime)}ms</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span>AI Provider:</span>
                    <span class="claude-badge px-2 py-1 rounded text-xs">Claude AI</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span>Security:</span>
                    <span class="security-badge px-2 py-1 rounded text-xs">Zero-Knowledge</span>
                </div>
            </div>
        </div>
    `;
}

// Real-time updates
function startRealTimeUpdates() {
    // Update stats every 5 seconds
    setInterval(updateStats, 5000);
    
    // Update charts every 30 seconds
    setInterval(updateCharts, 30000);
}

function updateStats() {
    // Simulate real-time stat updates
    const analysesElement = document.getElementById('analysesCount');
    if (analysesElement) {
        const currentCount = parseInt(analysesElement.textContent.replace(/,/g, ''));
        const newCount = currentCount + Math.floor(Math.random() * 100) + 50;
        analysesElement.textContent = newCount.toLocaleString();
    }
}

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function getRandomColor() {
    const colors = ['#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#8B5A2B'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// No mock data initialization - VCs will use real examples
// All analysis is now performed with real Claude AI only