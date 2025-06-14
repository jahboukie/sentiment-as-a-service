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

        if (!apiResult.success) {
            throw new Error('API returned error');
        }

        // Convert API result to display format
        const results = convertApiResultToDisplayFormat(apiResult.result);
        displayAnalysisResults(results);

    } catch (error) {
        console.error('Analysis failed:', error);
        document.getElementById('analysisResults').innerHTML = `
            <div class="text-red-400 text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Analysis failed. Please try again.</p>
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
    return {
        sentiment: {
            score: apiResult.sentiment.score,
            category: apiResult.sentiment.category,
            confidence: apiResult.sentiment.confidence
        },
        emotions: apiResult.emotions && typeof apiResult.emotions === 'object' ?
            Object.fromEntries(
                Object.entries(apiResult.emotions).filter(([key, value]) =>
                    typeof value === 'number' && !isNaN(value)
                )
            ) : {},
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
        crisisAssessment: apiResult.crisisAssessment ? {
            risk_level: apiResult.crisisAssessment.risk_level,
            recommended_action: apiResult.crisisAssessment.recommended_action,
            indicators: apiResult.crisisAssessment.indicators || []
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
                    ${Object.entries(results.emotions).map(([emotion, intensity]) => `
                        <div class="flex items-center justify-between">
                            <span class="capitalize">${emotion}:</span>
                            <div class="flex items-center">
                                <div class="w-20 bg-gray-600 rounded-full h-2 mr-2">
                                    <div class="bg-blue-400 h-2 rounded-full" style="width: ${intensity * 100}%"></div>
                                </div>
                                <span class="text-sm">${Math.round(intensity * 100)}%</span>
                            </div>
                        </div>
                    `).join('')}
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
                    ${results.crisisAssessment.indicators.length > 0 ? `
                        <div class="mt-2 p-2 bg-yellow-900 rounded">
                            <span class="text-sm font-semibold text-yellow-400">⚠️ Attention Required</span>
                            <p class="text-sm text-yellow-300 mt-1">${results.crisisAssessment.indicators.join(', ')}</p>
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

// Call initialization after a short delay
setTimeout(initializeDemoData, 1000);