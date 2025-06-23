// Import Firebase and Chart.js
// const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
//   .then(res => res.json());

// Initialize Firebase
let auth;
let db;

// Wait for DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Fetch Firebase config
        const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
            .then(res => res.json());
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Handle logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                // If not logged in, redirect to login page
                window.location.href = 'login.html';
            } else {
                // Update UI with user data
                await setUserName(user);
                // Animate greeting
                const greeting = document.getElementById('greeting');
                if (greeting) {
                    setTimeout(() => {
                        greeting.classList.remove('opacity-0', 'translate-y-4');
                        greeting.classList.add('opacity-100', 'translate-y-0');
                    }, 200); // slight delay for effect
                }
                // Load recent activity
                loadRecentActivity(user.uid);
                // Load last health trends
                loadLastHealthTrends(user.uid);
            }
        });

        // Initialize health trends chart
        initHealthTrendsChart();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
});

// UI Elements
const userNameElement = document.getElementById('userName');
const activityList = document.getElementById('activityList');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');

// Show loading spinner
function showLoading() {
    loadingSpinner.classList.remove('hidden');
    errorMessage.classList.add('hidden');
}

// Hide loading spinner
function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// Show error message
function showError(message) {
    errorMessage.classList.remove('hidden');
    errorMessage.querySelector('span').textContent = message;
}

// Initialize health trends charts
async function initHealthTrendsChart() {
    const chartContainer = document.getElementById('healthTrendsChart');
    if (!chartContainer) {
        console.warn('Chart container not found');
        return;
    }

    // Clear any existing content
    chartContainer.innerHTML = '';

    // Create containers for each chart
    const symptomFreqDiv = document.createElement('div');
    symptomFreqDiv.className = 'mb-8';
    const mostCommonDiv = document.createElement('div');
    mostCommonDiv.className = 'mb-8';
    const healthScoreDiv = document.createElement('div');
    healthScoreDiv.className = 'mb-8';

    // Add section titles and canvases with explicit height
    symptomFreqDiv.innerHTML = '<h4 class="font-semibold mb-2">Symptom Frequency Over Time</h4><canvas id="symptomFreqChart" height="220"></canvas>';
    mostCommonDiv.innerHTML = '<h4 class="font-semibold mb-2">Most Common Symptoms</h4><canvas id="mostCommonChart" height="220"></canvas>';
    healthScoreDiv.innerHTML = '<h4 class="font-semibold mb-2">Health Score Trend</h4><canvas id="healthScoreChart" height="220"></canvas>';

    chartContainer.appendChild(symptomFreqDiv);
    chartContainer.appendChild(mostCommonDiv);
    chartContainer.appendChild(healthScoreDiv);

    // Fetch healthReports for the logged-in user
    let user = firebase.auth().currentUser;
    if (!user) {
        // If not logged in, do not render chart
        return;
    }

    try {
        const snapshot = await db.collection('healthReports')
            .where('userId', '==', user.uid)
            .orderBy('created', 'asc')
            .get();

        // Prepare data
        let allDates = [];
        let allSymptoms = [];
        let healthScores = [];
        let healthScoreDates = [];
        let symptomCountByDate = {};
        let symptomTotals = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            // Date
            let date = null;
            if (data.created) {
                date = data.created.toDate ? data.created.toDate() : new Date(data.created);
                allDates.push(date);
            }
            // Symptoms
            let symptoms = [];
            if (Array.isArray(data.symptoms)) {
                symptoms = data.symptoms;
            } else if (data.symptomAnalysis && Array.isArray(data.symptomAnalysis.symptoms)) {
                symptoms = data.symptomAnalysis.symptoms;
            }
            // Count symptoms for frequency over time
            if (date && symptoms.length > 0) {
                const dateStr = date.toLocaleDateString();
                if (!symptomCountByDate[dateStr]) symptomCountByDate[dateStr] = {};
                symptoms.forEach(symptom => {
                    // Frequency over time
                    symptomCountByDate[dateStr][symptom] = (symptomCountByDate[dateStr][symptom] || 0) + 1;
                    // Totals for pie chart
                    symptomTotals[symptom] = (symptomTotals[symptom] || 0) + 1;
                });
                allSymptoms.push(...symptoms);
            }
            // Health score
            let score = null;
            if (typeof data.healthScore === 'number') {
                score = data.healthScore;
            } else if (data.aiAnalysis && typeof data.aiAnalysis.healthScore === 'number') {
                score = data.aiAnalysis.healthScore;
            } else {
                // Calculate a simple score: 100 - (number of symptoms * 10)
                if (symptoms.length > 0) {
                    score = Math.max(0, 100 - (symptoms.length * 10));
                }
            }
            if (score !== null && date) {
                healthScores.push(score);
                healthScoreDates.push(date.toLocaleDateString());
            }
        });

        // 1. Symptom Frequency Over Time (bar chart, top 3 symptoms)
        // Find top 3 symptoms overall
        const topSymptoms = Object.entries(symptomTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([symptom]) => symptom);
        // X-axis: Dates, Y-axis: Count for each top symptom
        const uniqueDates = Array.from(new Set(allDates.map(d => d.toLocaleDateString()))).sort((a, b) => new Date(a) - new Date(b));
        const freqDatasets = topSymptoms.map(symptom => ({
            label: symptom,
            data: uniqueDates.map(date => (symptomCountByDate[date]?.[symptom] || 0)),
            backgroundColor: symptom === topSymptoms[0] ? '#ef4444' : symptom === topSymptoms[1] ? '#f59e42' : '#3b82f6',
            borderColor: symptom === topSymptoms[0] ? '#ef4444' : symptom === topSymptoms[1] ? '#f59e42' : '#3b82f6',
            borderWidth: 1
        }));
        new Chart(document.getElementById('symptomFreqChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: uniqueDates,
                datasets: freqDatasets
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true } },
                scales: { y: { beginAtZero: true, precision: 0 } }
            }
        });

        // 2. Most Common Symptoms (pie chart)
        const pieLabels = Object.keys(symptomTotals);
        const pieData = Object.values(symptomTotals);
        new Chart(document.getElementById('mostCommonChart').getContext('2d'), {
            type: 'pie',
            data: {
                labels: pieLabels,
                datasets: [{
                    data: pieData,
                    backgroundColor: [
                        '#ef4444', '#f59e42', '#3b82f6', '#10b981', '#6366f1', '#fbbf24', '#a21caf', '#eab308', '#14b8a6', '#f472b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true, position: 'right' } }
            }
        });

        // 3. Health Score Trend (line chart)
        if (healthScores.length > 0) {
            new Chart(document.getElementById('healthScoreChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: healthScoreDates,
                    datasets: [{
                        label: 'Health Score',
                        data: healthScores,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        } else {
            healthScoreDiv.innerHTML += '<div class="text-center text-gray-400">No health score data available.</div>';
        }

        // If no data at all
        if (snapshot.empty) {
            chartContainer.innerHTML = '<div class="text-center text-gray-400">No health trend data available.</div>';
        }
    } catch (error) {
        console.error('Error loading health trends:', error);
        chartContainer.innerHTML = '<div class="text-center text-red-400">Failed to load health trend data.</div>';
    }
}

// Helper to set user name in dashboard
async function setUserName(user) {
    const userNameElement = document.getElementById('userName');
    let name = '';
    // 1. Try localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.fullName) {
        name = userData.fullName;
    } else if (userData.name) {
        name = userData.name;
    }
    // 2. Try Firebase Auth displayName
    if (!name && user.displayName) {
        name = user.displayName;
    }
    // 3. Try Firestore (if you have a users collection)
    if (!name && db) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                if (data.fullName) name = data.fullName;
                else if (data.name) name = data.name;
            }
        } catch (e) {
            console.warn('Could not fetch user name from Firestore:', e);
        }
    }
    // 4. Fallback
    if (!name) name = 'User';
    if (userNameElement) userNameElement.textContent = name;
}

// Load recent activity
async function loadRecentActivity(userId) {
    try {
        showLoading();
        const activityList = document.getElementById('activityList');
        // Get recent activities from Firestore
        const snapshot = await firebase.firestore()
            .collection('recentActivity')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(4)
            .get();
        if (snapshot.empty) {
            activityList.innerHTML = `
                <li class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-center text-gray-500">
                        <i class="fas fa-info-circle mr-2"></i>
                        No recent activity
                    </div>
                </li>
            `;
            hideLoading();
            return;
        }
        // Clear existing activities
        activityList.innerHTML = '';
        // Convert to array and sort by timestamp
        const activities = [];
        snapshot.forEach(doc => {
            activities.push({ id: doc.id, ...doc.data() });
        });
        // Already sorted by timestamp desc, so just take up to 4
        activities.slice(0, 4).forEach(activity => {
            const activityItem = createActivityListItem(activity);
            activityList.appendChild(activityItem);
        });
        hideLoading();
    } catch (error) {
        console.error('Error loading recent activity:', error);
        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = `
                <li class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-center text-red-500">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        Failed to load recent activity. Please try again.
                    </div>
                </li>
            `;
        }
        hideLoading();
        showError('Failed to load recent activity. Please try again.');
    }
}

function createActivityListItem(activity) {
    const li = document.createElement('li');
    li.className = 'px-4 py-4 sm:px-6 hover:bg-gray-50';

    // Format timestamp
    let formattedTime = '';
    if (activity.timestamp) {
        try {
            // Firestore Timestamp object
            if (typeof activity.timestamp.toDate === 'function') {
                formattedTime = activity.timestamp.toDate().toLocaleString();
            } else {
                formattedTime = new Date(activity.timestamp).toLocaleString();
            }
        } catch (e) {
            formattedTime = '';
        }
    }

    // Create activity content based on type
    let icon, title, details;
    switch (activity.type) {
        case 'voice_input':
            icon = 'fa-microphone';
            title = 'Voice Recording';
            details = activity.details || 'Recorded voice symptoms for analysis';
            break;
        case 'medical_info':
            icon = 'fa-file-medical';
            title = 'Medical Info Update';
            details = activity.details || 'Updated medical information';
            break;
        case 'health_report':
            icon = 'fa-chart-line';
            title = 'Health Report';
            details = activity.details || 'Generated health report';
            break;
        default:
            icon = 'fa-info-circle';
            title = 'Activity';
            details = activity.details || 'User activity';
    }

    li.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <i class="fas ${icon} text-red-500 text-lg"></i>
                </div>
                <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">${title}</div>
                    <div class="text-sm text-gray-500">${details}</div>
                </div>
            </div>
            <div class="text-sm text-gray-500">
                ${formattedTime}
            </div>
        </div>
    `;

    return li;
}

// Function to add a new activity
async function addActivity(userId, type, details = '') {
    try {
        const activityData = {
            userId: userId,
            type: type,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        await firebase.firestore()
            .collection('recentActivity')
            .add(activityData);

        // Refresh recent activity list
        await loadRecentActivity(userId);
    } catch (error) {
        console.error('Error adding activity:', error);
    }
}

// Handle logout
async function handleLogout() {
    try {
        console.log('Logout button clicked, signing out...');
        if (auth) {
            await auth.signOut();
        }
        // Clear all stored data
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('rememberMe');
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error during logout. Please try again.');
    }
}

// Helper to log activity from other pages
export async function logUserActivity(type, details = '') {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;
        await addActivity(user.uid, type, details);
    } catch (error) {
        console.error('Error logging user activity:', error);
    }
}

// Health Trends (Last Report) summary panel
async function loadLastHealthTrends(userId) {
    const container = document.getElementById('lastHealthTrendsContent');
    if (!container) return;
    container.innerHTML = '<div class="text-gray-400">Loading...</div>';
    try {
        // Get the most recent health report for the user
        const snapshot = await db.collection('healthReports')
            .where('userId', '==', userId)
            .orderBy('reportGeneratedAt', 'desc')
            .limit(1)
            .get();
        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-400">No health report data available.</div>';
            return;
        }
        const doc = snapshot.docs[0];
        const data = doc.data();
        // Extract fields
        const ai = data.aiAnalysis || {};
        const patient = data.patientInfo || {};
        const medical = data.medicalInfo || {};
        const symptoms = (data.symptomAnalysis && data.symptomAnalysis.symptoms) || data.symptoms || [];
        const transcript = (data.symptomAnalysis && data.symptomAnalysis.transcript) || data.transcript || '';
        // Most likely condition
        const mostLikely = ai.highestConfidenceAilment || (ai.possibleAilments && ai.possibleAilments[0]) || null;
        // Other possible ailments
        const otherAilments = (ai.possibleAilments || []).filter(a => !mostLikely || a.name !== mostLikely.name);
        // Recommendations
        const recommendations = ai.recommendations || [];
        // Urgency & doctor
        const urgency = ai.urgency || 'unknown';
        const shouldSeeDoctor = ai.shouldSeeDoctor === true ? 'Yes' : ai.shouldSeeDoctor === false ? 'No' : 'Unknown';
        // Build HTML
        let html = '';
        if (mostLikely) {
            html += `<div class="mb-4"><span class="font-semibold">Most Likely Condition:</span> <span class="text-red-600 font-semibold">${mostLikely.name}</span> <span class="ml-2 px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Confidence: ${mostLikely.confidence}</span><div class="text-gray-600 text-sm mt-1">${mostLikely.description}</div></div>`;
        }
        html += `<div class="mb-2"><span class="font-semibold">Urgency:</span> <span class="inline-block px-2 py-1 rounded text-xs ${urgency === 'high' ? 'bg-red-100 text-red-800' : urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">${urgency.charAt(0).toUpperCase() + urgency.slice(1)}</span></div>`;
        html += `<div class="mb-2"><span class="font-semibold">See a Doctor:</span> <span class="inline-block px-2 py-1 rounded text-xs ${shouldSeeDoctor === 'Yes' ? 'bg-red-100 text-red-800' : shouldSeeDoctor === 'No' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${shouldSeeDoctor}</span></div>`;
        if (recommendations.length > 0) {
            html += `<div class="mb-2"><span class="font-semibold">AI Recommendations:</span><ul class="list-disc ml-6 mt-1">`;
            recommendations.forEach(r => {
                html += `<li>${r}</li>`;
            });
            html += '</ul></div>';
        }
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading last health trends:', error);
        container.innerHTML = '<div class="text-red-400">Failed to load health trend data.</div>';
    }
} 