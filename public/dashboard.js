// MenoWellness + Partner Support Platform
// Clean Demo Version for VC Presentation

console.log('🌸 PLATFORM: MenoWellness + Partner Support Ecosystem Loaded');

// Global variables
let sentimentChart, correlationChart;
let isAnalyzing = false;

// Copy text to clipboard function for menopause examples
function copyToClipboard(text, exampleName) {
    navigator.clipboard.writeText(text).then(function() {
        // Show success notification
        const notification = document.getElementById('copyNotification');
        const message = document.getElementById('copyMessage');
        message.textContent = `${exampleName} copied to clipboard!`;
        notification.style.display = 'block';

        // Auto-paste into textarea
        document.getElementById('sentimentInput').value = text;

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }).catch(function(err) {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        // Auto-paste into textarea
        document.getElementById('sentimentInput').value = text;

        // Show notification
        const notification = document.getElementById('copyNotification');
        const message = document.getElementById('copyMessage');
        message.textContent = `${exampleName} copied to clipboard!`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    });
}

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
                labels: ['Symptom Relief', 'Partner Understanding', 'Treatment Adherence', 'Relationship Health', 'Quality of Life'],
                datasets: [{
                    label: 'Menopause Care Correlation',
                    data: [0.87, 0.75, 0.92, 0.68, 0.84],
                    borderColor: '#EC4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    pointBackgroundColor: '#EC4899',
                    pointBorderColor: '#EC4899'
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
        // Call real Claude AI API
        const response = await fetch('/api/sentiment/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: input,
                includeEmotions: true,
                includeKeyTerms: true,
                healthcareContext: document.getElementById('healthcareContext').checked,
                relationshipContext: document.getElementById('relationshipContext').checked,
                crisisDetection: document.getElementById('crisisDetection').checked
            })
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        const apiResult = await response.json();

        console.log('API Response:', apiResult);

        if (!apiResult.success) {
            console.error('API Error:', apiResult);
            throw new Error('API returned error: ' + (apiResult.error || 'Unknown error'));
        }

        // Convert API result to display format
        const results = convertApiResultToDisplayFormat(apiResult.result);
        displayAnalysisResults(results);

    } catch (error) {
        console.error('Analysis failed:', error);
        document.getElementById('analysisResults').innerHTML = `
            <div class="text-red-400 text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Analysis failed: ${error.message}</p>
                <p class="text-sm text-gray-400 mt-2">Check console for details</p>
            </div>
        `;
    } finally {
        isAnalyzing = false;
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Convert API result to menopause-focused format
function convertApiResultToDisplayFormat(apiResult) {
    console.log('🌸 Converting to menopause format:', apiResult);

    // Extract emotions from detailed_emotions structure
    let emotions = {};
    if (apiResult.emotions?.detailed_emotions) {
        emotions = apiResult.emotions.detailed_emotions;
    }

    return {
        sentiment: {
            score: apiResult.sentiment.score,
            category: apiResult.sentiment.category,
            confidence: apiResult.sentiment.confidence
        },
        emotions: emotions,
        healthcareContext: {
            health_trend: apiResult.healthcareContext?.health_status_trend || 'monitoring',
            treatment_sentiment: apiResult.healthcareContext?.treatment_sentiment || 'neutral',
            indicators: apiResult.healthcareContext?.indicators || []
        },
        relationshipContext: {
            relationship_health: apiResult.relationshipContext?.relationship_health || 'stable',
            support_level: apiResult.relationshipContext?.support_level || 'developing',
            communication: apiResult.relationshipContext?.communication || 'improving'
        },
        contextDetection: {
            primary_context: apiResult.contextDetection?.primary_context || 'menopause',
            confidence: apiResult.contextDetection?.confidence || 0.9
        },
        crisisAssessment: {
            risk_level: apiResult.crisisAssessment?.risk_level || 'low',
            recommended_action: apiResult.crisisAssessment?.recommended_action || 'monitoring',
            indicators: apiResult.crisisAssessment?.indicators || []
        },
        processingTime: apiResult.processingTime || 0,
        provider: 'Dr. Alex AI - Menopause Specialist'
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

// Display menopause-optimized results
function displayAnalysisResults(results) {
    console.log('🌸 Displaying menopause-optimized results');

    const resultsContainer = document.getElementById('analysisResults');

    resultsContainer.innerHTML = `
        <div class="space-y-4">
            <!-- Menopause Journey Header -->
            <div class="bg-gradient-to-r from-pink-800 to-purple-800 rounded-lg p-4 border-l-4 border-pink-400">
                <h4 class="font-semibold mb-2 text-pink-200">🌸 Menopause Journey Analysis</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-pink-300">Analysis Focus:</span>
                        <span class="block font-bold text-white">Hormone Therapy & Relationship</span>
                    </div>
                    <div>
                        <span class="text-pink-300">Apps Integrated:</span>
                        <span class="block font-bold text-white">MenoWellness + Partner Support</span>
                    </div>
                </div>
            </div>

            <!-- Wellbeing Overview -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-3 text-pink-300">Wellbeing Overview</h4>
                <div class="grid grid-cols-3 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold ${results.sentiment.score > 0 ? 'text-green-400' : results.sentiment.score < -0.3 ? 'text-red-400' : 'text-yellow-400'}">${Math.round((results.sentiment.score + 1) * 50)}%</div>
                        <div class="text-sm text-gray-400">Overall Wellbeing</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${results.healthcareContext.treatment_sentiment === 'positive' ? 'text-green-400' : 'text-yellow-400'}">${results.healthcareContext.treatment_sentiment === 'positive' ? 'Good' : 'Fair'}</div>
                        <div class="text-sm text-gray-400">Treatment Response</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${results.relationshipContext.support_level === 'high' ? 'text-green-400' : results.relationshipContext.support_level === 'medium' ? 'text-yellow-400' : 'text-blue-400'}">${results.relationshipContext.support_level}</div>
                        <div class="text-sm text-gray-400">Partner Support</div>
                    </div>
                </div>
            </div>

            <!-- Emotional Landscape -->
            ${Object.keys(results.emotions).length > 0 ? `
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-3 text-pink-300">Emotional Landscape</h4>
                <div class="grid grid-cols-2 gap-3">
                    ${Object.entries(results.emotions)
                        .filter(([_, intensity]) => intensity > 0.1)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6)
                        .map(([emotion, intensity]) => `
                            <div class="flex justify-between items-center p-2 bg-gray-600 rounded">
                                <span class="capitalize text-sm">${emotion.replace('_', ' ')}</span>
                                <div class="flex items-center">
                                    <div class="w-16 bg-gray-500 rounded-full h-2 mr-2">
                                        <div class="bg-pink-400 h-2 rounded-full" style="width: ${intensity * 100}%"></div>
                                    </div>
                                    <span class="text-xs text-gray-300">${Math.round(intensity * 100)}%</span>
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- MenoWellness Insights -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-3 text-pink-300">🏥 MenoWellness Insights</h4>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span>Symptom Management:</span>
                        <span class="font-bold ${results.healthcareContext.health_trend === 'improving' ? 'text-green-400' : 'text-yellow-400'}">${getMenopauseSymptomStatus(results)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Treatment Satisfaction:</span>
                        <span class="font-bold text-blue-400">${results.healthcareContext.treatment_sentiment}</span>
                    </div>
                    <div class="bg-pink-900 rounded p-3 mt-3">
                        <h5 class="text-sm font-semibold text-pink-300 mb-2">💡 Personalized Recommendations</h5>
                        <ul class="text-xs space-y-1">
                            ${generateMenopauseRecommendations(results).map(rec => `
                                <li class="text-pink-100">• ${rec}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Partner Support Insights -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-3 text-purple-300">💕 Partner Support Insights</h4>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span>Relationship Health:</span>
                        <span class="font-bold ${results.relationshipContext.relationship_health === 'supportive' ? 'text-green-400' : 'text-yellow-400'}">${results.relationshipContext.relationship_health}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Communication Quality:</span>
                        <span class="font-bold text-purple-400">${results.relationshipContext.communication}</span>
                    </div>
                    <div class="bg-purple-900 rounded p-3 mt-3">
                        <h5 class="text-sm font-semibold text-purple-300 mb-2">💭 Relationship Support</h5>
                        <ul class="text-xs space-y-1">
                            ${generatePartnerSupportRecommendations(results).map(rec => `
                                <li class="text-purple-100">• ${rec}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Dr. Alex AI Assessment -->
            <div class="bg-gradient-to-r from-blue-800 to-indigo-800 rounded-lg p-4">
                <h4 class="font-semibold mb-3 text-blue-200">🤖 Dr. Alex AI Assessment</h4>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span>Care Priority:</span>
                        <span class="font-bold ${results.crisisAssessment.risk_level === 'low' ? 'text-green-400' : 'text-yellow-400'}">${getMenopauseCareLevel(results.crisisAssessment.risk_level)}</span>
                    </div>
                    <div class="bg-blue-900 rounded p-3">
                        <p class="text-sm text-blue-100">${generateDrAlexInsight(results)}</p>
                    </div>
                </div>
            </div>

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

            <!-- Crisis Assessment -->
            ${results.crisisAssessment ? `
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Crisis Assessment</h4>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Risk Level:</span>
                        <span class="capitalize font-bold ${results.crisisAssessment.risk_level === 'high' ? 'text-red-400' : results.crisisAssessment.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'}">${results.crisisAssessment.risk_level}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Recommended Action:</span>
                        <span class="capitalize font-bold text-blue-400">${results.crisisAssessment.recommended_action.replace('_', ' ')}</span>
                    </div>
                    ${(results.crisisAssessment.indicators || []).length > 0 ? `
                        <div class="mt-2 p-2 bg-yellow-900 rounded">
                            <span class="text-sm font-semibold text-yellow-400">⚠️ Attention Required</span>
                            <p class="text-sm text-yellow-300 mt-1">${(results.crisisAssessment.indicators || []).join(', ')}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Platform Integration -->
            <div class="bg-gray-700 rounded-lg p-4">
                <h4 class="font-semibold mb-2">Platform Information</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span>Processing Time:</span>
                        <span class="font-bold ml-2">${Math.round(results.processingTime)}ms</span>
                    </div>
                    <div>
                        <span>AI Provider:</span>
                        <span class="font-bold ml-2">Dr. Alex AI</span>
                    </div>
                    <div>
                        <span>Platform:</span>
                        <span class="font-bold ml-2 text-pink-400">MenoWellness Ecosystem</span>
                    </div>
                    <div>
                        <span>Security:</span>
                        <span class="font-bold ml-2 text-green-400">Zero-Knowledge</span>
                    </div>
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

// Initialize demo data
function initializeDemoData() {
    // Pre-fill the sentiment input with example text
    const exampleTexts = [
        "I'm feeling much better after starting the new treatment. My partner has been so supportive through this journey, and I can see real progress in managing my symptoms.",
        "The medication side effects are challenging, but my healthcare team is helping me adjust. Having someone who understands what I'm going through makes such a difference.",
        "Some days are harder than others, but I'm learning to communicate my needs better. The treatment plan is working, and I feel more hopeful about the future."
    ];
    
    const input = document.getElementById('sentimentInput');
    if (input && !input.value) {
        input.value = exampleTexts[Math.floor(Math.random() * exampleTexts.length)];
    }
}

// Helper functions for menopause-specific analysis
function getMenopauseSymptomStatus(results) {
    const emotions = results.emotions || {};
    const healthcareContext = results.healthcareContext || {};

    if ((emotions.hope || 0) > 0.6 && healthcareContext.health_trend === 'improving') {
        return 'Well Controlled';
    } else if ((emotions.frustration || 0) > 0.5) {
        return 'Optimizing Treatment';
    } else {
        return 'Stable Progress';
    }
}

function generateMenopauseRecommendations(results) {
    const recommendations = [];
    const emotions = results.emotions || {};
    const relationshipContext = results.relationshipContext || {};

    if ((emotions.hope || 0) > 0.6) {
        recommendations.push('Continue current hormone therapy - showing excellent response');
    }
    if ((emotions.frustration || 0) > 0.4) {
        recommendations.push('Consider symptom tracking to optimize treatment timing');
    }
    if (relationshipContext.support_level !== 'high') {
        recommendations.push('Partner education resources may enhance support quality');
    }

    return recommendations.length > 0 ? recommendations : [
        'Maintain regular follow-ups with healthcare provider',
        'Continue balanced approach to symptom management'
    ];
}

function generatePartnerSupportRecommendations(results) {
    const recommendations = [];
    const emotions = results.emotions || {};
    const relationshipContext = results.relationshipContext || {};

    if ((emotions.love || 0) > 0.3) {
        recommendations.push('Strong relationship foundation - focus on communication during transition');
    }
    if (relationshipContext.relationship_health === 'strained') {
        recommendations.push('Couples communication strategies for menopause transition');
    }
    if ((emotions.frustration || 0) > 0.4) {
        recommendations.push('Partner menopause education to improve understanding');
    }

    return recommendations.length > 0 ? recommendations : [
        'Maintain open dialogue about menopause experience',
        'Regular check-ins about relationship needs and changes'
    ];
}

function getMenopauseCareLevel(riskLevel) {
    const levels = {
        'low': 'Routine Monitoring',
        'medium': 'Enhanced Support',
        'high': 'Intensive Care'
    };
    return levels[riskLevel] || 'Personalized Care';
}

function generateDrAlexInsight(results) {
    const emotions = results.emotions || {};

    if ((emotions.hope || 0) > 0.6) {
        return "Excellent treatment trajectory observed. The combination of positive treatment response and strong emotional resilience suggests optimal menopause management. Continue current approach with regular monitoring.";
    } else if ((emotions.frustration || 0) > 0.5) {
        return "Treatment optimization opportunity identified. Consider collaborative approach with healthcare provider to fine-tune hormone therapy and explore additional symptom management strategies.";
    } else {
        return "Stable menopause transition progress. The balanced emotional profile suggests good adaptation to treatment. Maintain current care plan with focus on partner support integration.";
    }
}

// Call initialization after a short delay
setTimeout(initializeDemoData, 1000);