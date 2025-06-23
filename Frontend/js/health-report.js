import { logUserActivity } from './dashboard.js';

(async function() {
// Import Firebase
const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
  .then(res => res.json());

// Then initialize Firebase with it
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// DOM Elements
const logoutBtn = document.getElementById('logoutBtn');

// Loading and error handling
function showLoading() {
    const spinner = document.createElement('div');
    spinner.id = 'loadingSpinner';
    spinner.className = 'flex justify-center mt-4';
    spinner.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>';
    document.querySelector('.max-w-7xl').appendChild(spinner);
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative';
    errorDiv.innerHTML = `<span class="block sm:inline">${message}</span>`;
    document.querySelector('.max-w-7xl').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Load health reports from backend
async function loadHealthReports() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        showLoading();

        const latestReportId = localStorage.getItem('latestReportId');
        if (latestReportId) {
            try {
                // Load the detailed health report from the ID passed from the previous page
                const detailedResponse = await fetch(`http://localhost:5000/api/health-reports/detailed/${latestReportId}`);
                if (detailedResponse.ok) {
                    const detailedData = await detailedResponse.json();
                    displayLatestReport(detailedData.healthReport);
                } else {
                    console.error('Failed to load detailed health report with ID, falling back to most recent.');
                    await loadMostRecentHealthReport(user.uid);
                }
                // Clear the stored report ID so it's only used once
                localStorage.removeItem('latestReportId');
            } catch (error) {
                console.error('Error loading detailed health report by ID:', error);
                await loadMostRecentHealthReport(user.uid); // Fallback to most recent
            }
        } else {
            // If no report ID is available, fetch the most recent one for the user
            await loadMostRecentHealthReport(user.uid);
        }
    } catch (error) {
        console.error('Error loading health reports:', error);
        showError('Error loading health reports.');
    } finally {
        hideLoading();
    }
}

// Load the most recent health report for the user
async function loadMostRecentHealthReport(userId) {
    try {
        // First, get the most recent symptom record
        const response = await fetch(`http://localhost:5000/api/health-reports/${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            const reports = data.healthReports;
            
            if (reports && reports.length > 0) {
                // Get the most recent report (first in the array since it's ordered by DESC)
                const mostRecentReport = reports[0];
                
                // Check if this report has a detailed health report
                try {
                    const detailedUrl = `http://localhost:5000/api/health-reports/detailed/${mostRecentReport.id}`;
                    console.log('Fetching detailed health report:', detailedUrl);
                    const detailedResponse = await fetch(detailedUrl);
                    console.log('Detailed report fetch status:', detailedResponse.status);
                    if (detailedResponse.ok) {
                        const detailedData = await detailedResponse.json();
                        displayLatestReport(detailedData.healthReport);
                    } else if (detailedResponse.status === 404) {
                        // If no detailed report exists, create one from the symptom data
                        await generateHealthReportFromSymptoms(mostRecentReport);
                    } else {
                        // Other errors
                        console.error('Failed to load detailed health report:', await detailedResponse.text());
                        displayBasicHealthReport(mostRecentReport);
                    }
                } catch (error) {
                    console.error('Error loading detailed health report:', error);
                    // Fallback: create a report from the symptom data
                    await generateHealthReportFromSymptoms(mostRecentReport);
                }
            } else {
                // No reports found, show a message
                displayNoReportsMessage();
            }
        } else {
            console.error('Failed to load health reports for most recent report');
        }
    } catch (error) {
        console.error('Error loading most recent health report:', error);
    }
}

// Generate a health report from symptom data
async function generateHealthReportFromSymptoms(symptomReport) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const response = await fetch('http://localhost:5000/api/generate-health-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.uid,
                symptomId: symptomReport.id
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Generate health report response:', result);
            
            // Now fetch the generated detailed report by symptomId
            const detailedResponse = await fetch(`http://localhost:5000/api/health-reports/detailed/${symptomReport.id}`);
            if (detailedResponse.ok) {
                const detailedData = await detailedResponse.json();
                displayLatestReport(detailedData.healthReport);
                // Log activity for health report
                logUserActivity && logUserActivity('health_report', 'User generated a health report');
            }
        } else {
            console.error('Failed to generate health report');
            // Fallback: display the symptom report as a basic health report
            displayBasicHealthReport(symptomReport);
        }
    } catch (error) {
        console.error('Error generating health report:', error);
        // Fallback: display the symptom report as a basic health report
        displayBasicHealthReport(symptomReport);
    }
}

// Display a basic health report when no detailed report is available
function displayBasicHealthReport(report) {
    const basicReportSection = document.createElement('div');
    basicReportSection.className = 'mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6';
    
    const date = report.created ? new Date(report.created).toLocaleDateString() : 'Unknown date';
    const time = report.created ? new Date(report.created).toLocaleTimeString() : '';
    
    basicReportSection.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Report Header -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas fa-hospital text-3xl mr-4"></i>
                        <div>
                            <h1 class="text-2xl font-bold">MediAssist Health Assessment</h1>
                            <p class="text-blue-100">AI-Powered Symptom Analysis</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-blue-100">Assessment ID: ${report.id || 'N/A'}</p>
                        <p class="text-sm text-blue-100">Generated: ${date} ${time}</p>
                    </div>
                </div>
            </div>
            
            <!-- Report Content -->
            <div class="p-6 space-y-6">
                <!-- Chief Complaint & Symptom Analysis -->
                <div class="border-b border-gray-200 pb-4">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                        <i class="fas fa-microphone text-blue-600 mr-2"></i>
                        Chief Complaint & Symptom Analysis
                    </h2>
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 mb-2">Patient's Reported Symptoms:</h3>
                            <div class="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                                <p class="text-gray-800 italic">"${report.transcript || 'No transcript available'}"</p>
                            </div>
                        </div>
                        ${report.symptoms && report.symptoms.length > 0 ? `
                            <div>
                                <h3 class="text-sm font-medium text-gray-700 mb-2">Identified Symptoms:</h3>
                                <div class="flex flex-wrap gap-2">
                                    ${report.symptoms.map(symptom => 
                                        `<span class="inline-block bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium">${symptom}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- AI Analysis -->
                ${report.prediction && Object.keys(report.prediction).length > 0 ? `
                    <div class="border-b border-gray-200 pb-4">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <i class="fas fa-robot text-blue-600 mr-2"></i>
                            AI Analysis & Differential Diagnosis
                        </h2>
                        
                        ${report.prediction.possibleAilments && report.prediction.possibleAilments.length > 0 ? `
                            <div class="mb-6">
                                <h3 class="text-sm font-medium text-gray-700 mb-3">Possible Conditions:</h3>
                                <div class="space-y-3">
                                    ${report.prediction.possibleAilments.map((ailment, index) => 
                                        `<div class="bg-gray-50 p-3 rounded-lg border-l-4 ${index === 0 ? 'border-red-500' : 'border-blue-500'}">
                                            <div class="flex justify-between items-start">
                                                <div class="flex-1">
                                                    <h4 class="font-medium text-gray-900">${index + 1}. ${ailment.name}</h4>
                                                    <p class="text-gray-600 text-sm mt-1">${ailment.description}</p>
                                                </div>
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    ailment.confidence === 'high' ? 'bg-red-100 text-red-800' : 
                                                    ailment.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                                                    'bg-green-100 text-green-800'
                                                }">
                                                    ${ailment.confidence.toUpperCase()} CONFIDENCE
                                                </span>
                                            </div>
                                        </div>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${report.prediction.recommendations && report.prediction.recommendations.length > 0 ? `
                            <div class="mb-6">
                                <h3 class="text-sm font-medium text-gray-700 mb-3">Clinical Recommendations:</h3>
                                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <ul class="space-y-2">
                                        ${report.prediction.recommendations.map(rec => 
                                            `<li class="flex items-start">
                                                <span class="inline-block w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                                <span class="text-sm text-gray-800">${rec}</span>
                                            </li>`
                                        ).join('')}
                                    </ul>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Clinical Assessment -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${report.prediction.urgency ? `
                                <div class="bg-gray-50 p-4 rounded-lg">
                                    <h4 class="text-sm font-medium text-gray-700 mb-2">Clinical Urgency Assessment:</h4>
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        report.prediction.urgency === 'high' ? 'bg-red-100 text-red-800' : 
                                        report.prediction.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-green-100 text-green-800'
                                    }">
                                        <i class="fas fa-${report.prediction.urgency === 'high' ? 'exclamation-triangle' : 
                                                          report.prediction.urgency === 'medium' ? 'clock' : 'check-circle'} mr-2"></i>
                                        ${report.prediction.urgency.toUpperCase()} URGENCY
                                    </span>
                                </div>
                            ` : ''}
                            
                            ${report.prediction.shouldSeeDoctor !== undefined ? `
                                <div class="bg-gray-50 p-4 rounded-lg">
                                    <h4 class="text-sm font-medium text-gray-700 mb-2">Medical Recommendation:</h4>
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        report.prediction.shouldSeeDoctor ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                    }">
                                        <i class="fas fa-${report.prediction.shouldSeeDoctor ? 'user-md' : 'home'} mr-2"></i>
                                        ${report.prediction.shouldSeeDoctor ? 'CONSULT HEALTHCARE PROFESSIONAL' : 'MONITOR SYMPTOMS'}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Action Items -->
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h2 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <i class="fas fa-clipboard-list text-blue-600 mr-2"></i>
                        Recommended Actions
                    </h2>
                    <div class="space-y-3">
                        <div class="flex items-center">
                            <i class="fas fa-calendar-plus text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Schedule a consultation with a healthcare professional</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-file-medical text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Bring this assessment to your medical appointment</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-clock text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Monitor symptoms and report any changes</span>
                        </div>
                    </div>
                    
                    <div class="mt-4 pt-4 border-t border-blue-200">
                        <button onclick="showAppointmentModal('${report.id}')" 
                                class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            <i class="fas fa-calendar-plus mr-2"></i>
                            Book Medical Appointment
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Report Footer -->
            <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div class="flex justify-between items-center text-sm text-gray-600">
                    <div>
                        <p><strong>Disclaimer:</strong> This assessment is generated by AI and should not replace professional medical advice.</p>
                        <p>Always consult with a qualified healthcare provider for diagnosis and treatment.</p>
                    </div>
                    <div class="text-right">
                        <p>Generated by MediAssist AI</p>
                        <p>Assessment ID: ${report.id || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert the basic report into the placeholder
    const placeholder = document.getElementById('report-placeholder');
    if (placeholder) {
        placeholder.innerHTML = ''; // Clear existing content
        placeholder.appendChild(basicReportSection);
    }
}

// Display a message when no reports are found
function displayNoReportsMessage() {
    const noReportsSection = document.createElement('div');
    noReportsSection.className = 'mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6';
    
    noReportsSection.innerHTML = `
        <div class="text-center">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <i class="fas fa-file-medical text-yellow-600 text-xl"></i>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-2">No Health Reports Available</h2>
            <p class="text-gray-600 mb-4">You haven't generated any health reports yet. Start by recording your symptoms using voice input.</p>
            <a href="voice-input.html" 
               class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <i class="fas fa-microphone mr-2"></i>
                Record Symptoms
            </a>
        </div>
    `;
    
    // Insert the no reports message into the placeholder
    const placeholder = document.getElementById('report-placeholder');
    if (placeholder) {
        placeholder.innerHTML = ''; // Clear existing content
        placeholder.appendChild(noReportsSection);
    }
}

// Display the latest report prominently
function displayLatestReport(report) {
    // Create a prominent section for the latest report
    const latestReportSection = document.createElement('div');
    latestReportSection.className = 'mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6';
    
    const date = report.reportGeneratedAt ? new Date(report.reportGeneratedAt).toLocaleDateString() : 
                 report.created ? new Date(report.created).toLocaleDateString() : 'Unknown date';
    
    const time = report.reportGeneratedAt ? new Date(report.reportGeneratedAt).toLocaleTimeString() : 
                 report.created ? new Date(report.created).toLocaleTimeString() : '';
    
    latestReportSection.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Report Header -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas fa-hospital text-3xl mr-4"></i>
                        <div>
                            <h1 class="text-2xl font-bold">MediAssist Health Report</h1>
                            <p class="text-blue-100">AI-Powered Medical Assessment</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-blue-100">Report ID: ${report.reportId || 'N/A'}</p>
                        <p class="text-sm text-blue-100">Generated: ${date} ${time}</p>
                    </div>
                </div>
            </div>
            
            <!-- Report Content -->
            <div class="p-6 space-y-6">
                <!-- Patient Information -->
                ${report.patientInfo ? `
                    <div class="border-b border-gray-200 pb-4">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <i class="fas fa-user-circle text-blue-600 mr-2"></i>
                            Patient Information
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Full Name:</span>
                                    <span class="text-sm text-gray-900">${report.patientInfo.name || 'Not provided'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Age:</span>
                                    <span class="text-sm text-gray-900">${report.patientInfo.age || 'Not provided'}</span>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Gender:</span>
                                    <span class="text-sm text-gray-900">${report.patientInfo.gender || 'Not provided'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Email:</span>
                                    <span class="text-sm text-gray-900">${report.patientInfo.email || 'Not provided'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Medical Information -->
                ${report.medicalInfo ? `
                    <div class="border-b border-gray-200 pb-4">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <i class="fas fa-file-medical text-blue-600 mr-2"></i>
                            Medical History
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Blood Type:</span>
                                    <span class="text-sm text-gray-900">${report.medicalInfo.bloodType || 'Not provided'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Allergies:</span>
                                    <span class="text-sm text-gray-900">${report.medicalInfo.allergies || 'None reported'}</span>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Current Medications:</span>
                                    <span class="text-sm text-gray-900">${report.medicalInfo.medications || 'None'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-sm font-medium text-gray-600">Chronic Conditions:</span>
                                    <span class="text-sm text-gray-900">${report.medicalInfo.conditions || 'None reported'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Chief Complaint & Symptom Analysis -->
                <div class="border-b border-gray-200 pb-4">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                        <i class="fas fa-microphone text-blue-600 mr-2"></i>
                        Chief Complaint & Symptom Analysis
                    </h2>
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 mb-2">Patient's Reported Symptoms:</h3>
                            <div class="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                                <p class="text-gray-800 italic">"${report.symptomAnalysis?.transcript || report.transcript || 'No transcript available'}"</p>
                            </div>
                        </div>
                        ${(report.symptomAnalysis?.symptoms || report.symptoms) && (report.symptomAnalysis?.symptoms || report.symptoms).length > 0 ? `
                            <div>
                                <h3 class="text-sm font-medium text-gray-700 mb-2">Identified Symptoms:</h3>
                                <div class="flex flex-wrap gap-2">
                                    ${(report.symptomAnalysis?.symptoms || report.symptoms).map(symptom => 
                                        `<span class="inline-block bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium">${symptom}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- AI Analysis & Differential Diagnosis -->
                ${(report.aiAnalysis || report.prediction) && Object.keys(report.aiAnalysis || report.prediction).length > 0 ? `
                    <div class="border-b border-gray-200 pb-4">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <i class="fas fa-robot text-blue-600 mr-2"></i>
                            AI Analysis & Differential Diagnosis
                        </h2>
                        
                        ${report.highestConfidenceAilment ? `
                            <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h3 class="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    Primary Differential Diagnosis
                                </h3>
                                <div class="space-y-2">
                                    <p class="text-yellow-800"><strong>Condition:</strong> ${report.highestConfidenceAilment.name}</p>
                                    <p class="text-yellow-700 text-sm"><strong>Confidence Level:</strong> ${report.highestConfidenceAilment.confidence}</p>
                                    <p class="text-yellow-700 text-sm"><strong>Description:</strong> ${report.highestConfidenceAilment.description}</p>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${(report.aiAnalysis?.possibleAilments || report.prediction?.possibleAilments) && (report.aiAnalysis?.possibleAilments || report.prediction?.possibleAilments).length > 0 ? `
                            <div class="mb-6">
                                <h3 class="text-sm font-medium text-gray-700 mb-3">Complete Differential Diagnosis:</h3>
                                <div class="space-y-3">
                                    ${(report.aiAnalysis?.possibleAilments || report.prediction?.possibleAilments).map((ailment, index) => 
                                        `<div class="bg-gray-50 p-3 rounded-lg border-l-4 ${index === 0 ? 'border-red-500' : 'border-blue-500'}">
                                            <div class="flex justify-between items-start">
                                                <div class="flex-1">
                                                    <h4 class="font-medium text-gray-900">${index + 1}. ${ailment.name}</h4>
                                                    <p class="text-gray-600 text-sm mt-1">${ailment.description}</p>
                                                </div>
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    ailment.confidence === 'high' ? 'bg-red-100 text-red-800' : 
                                                    ailment.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                                                    'bg-green-100 text-green-800'
                                                }">
                                                    ${ailment.confidence.toUpperCase()} CONFIDENCE
                                                </span>
                                            </div>
                                        </div>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${(report.aiAnalysis?.recommendations || report.prediction?.recommendations) && (report.aiAnalysis?.recommendations || report.prediction?.recommendations).length > 0 ? `
                            <div class="mb-6">
                                <h3 class="text-sm font-medium text-gray-700 mb-3">Clinical Recommendations:</h3>
                                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <ul class="space-y-2">
                                        ${(report.aiAnalysis?.recommendations || report.prediction?.recommendations).map(rec => 
                                            `<li class="flex items-start">
                                                <span class="inline-block w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                                <span class="text-sm text-gray-800">${rec}</span>
                                            </li>`
                                        ).join('')}
                                    </ul>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Clinical Assessment -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${(report.aiAnalysis?.urgency || report.prediction?.urgency) ? `
                                <div class="bg-gray-50 p-4 rounded-lg">
                                    <h4 class="text-sm font-medium text-gray-700 mb-2">Clinical Urgency Assessment:</h4>
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        (report.aiAnalysis?.urgency || report.prediction?.urgency) === 'high' ? 'bg-red-100 text-red-800' : 
                                        (report.aiAnalysis?.urgency || report.prediction?.urgency) === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-green-100 text-green-800'
                                    }">
                                        <i class="fas fa-${(report.aiAnalysis?.urgency || report.prediction?.urgency) === 'high' ? 'exclamation-triangle' : 
                                                          (report.aiAnalysis?.urgency || report.prediction?.urgency) === 'medium' ? 'clock' : 'check-circle'} mr-2"></i>
                                        ${(report.aiAnalysis?.urgency || report.prediction?.urgency).toUpperCase()} URGENCY
                                    </span>
                                </div>
                            ` : ''}
                            
                            ${(report.aiAnalysis?.shouldSeeDoctor !== undefined || report.prediction?.shouldSeeDoctor !== undefined) ? `
                                <div class="bg-gray-50 p-4 rounded-lg">
                                    <h4 class="text-sm font-medium text-gray-700 mb-2">Medical Recommendation:</h4>
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        (report.aiAnalysis?.shouldSeeDoctor || report.prediction?.shouldSeeDoctor) ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                    }">
                                        <i class="fas fa-${(report.aiAnalysis?.shouldSeeDoctor || report.prediction?.shouldSeeDoctor) ? 'user-md' : 'home'} mr-2"></i>
                                        ${(report.aiAnalysis?.shouldSeeDoctor || report.prediction?.shouldSeeDoctor) ? 'CONSULT HEALTHCARE PROFESSIONAL' : 'MONITOR SYMPTOMS'}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Action Items -->
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h2 class="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <i class="fas fa-clipboard-list text-blue-600 mr-2"></i>
                        Recommended Actions
                    </h2>
                    <div class="space-y-3">
                        <div class="flex items-center">
                            <i class="fas fa-calendar-plus text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Schedule a consultation with a healthcare professional</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-file-medical text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Bring this report to your medical appointment</span>
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-clock text-blue-600 mr-3"></i>
                            <span class="text-sm text-gray-800">Monitor symptoms and report any changes</span>
                        </div>
                    </div>
                    
                    <div class="mt-4 pt-4 border-t border-blue-200">
                        <button onclick="showAppointmentModal('${report.symptomId || report.id}')" 
                                class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            <i class="fas fa-calendar-plus mr-2"></i>
                            Book Medical Appointment
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Report Footer -->
            <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div class="flex justify-between items-center text-sm text-gray-600">
                    <div>
                        <p><strong>Disclaimer:</strong> This report is generated by AI and should not replace professional medical advice.</p>
                        <p>Always consult with a qualified healthcare provider for diagnosis and treatment.</p>
                    </div>
                    <div class="text-right">
                        <p>Generated by MediAssist AI</p>
                        <p>Report ID: ${report.reportId || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert the latest report into the placeholder
    const placeholder = document.getElementById('report-placeholder');
    if (placeholder) {
        placeholder.innerHTML = ''; // Clear existing content
        placeholder.appendChild(latestReportSection);
    }
    // Log activity for viewing health report
    logUserActivity && logUserActivity('health_report', 'User viewed a health report');
}

// Show appointment booking modal
function showAppointmentModal(symptomId) {
    // Create modal HTML
    const modalHTML = `
        <div id="appointmentModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Book Appointment</h3>
                    <form id="appointmentForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Preferred Date</label>
                            <input type="date" id="preferredDate" required 
                                   class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Preferred Time</label>
                            <select id="preferredTime" required 
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500">
                                <option value="">Select time</option>
                                <option value="09:00">9:00 AM</option>
                                <option value="10:00">10:00 AM</option>
                                <option value="11:00">11:00 AM</option>
                                <option value="14:00">2:00 PM</option>
                                <option value="15:00">3:00 PM</option>
                                <option value="16:00">4:00 PM</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Urgency Level</label>
                            <select id="urgency" required 
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Additional Notes</label>
                            <textarea id="notes" rows="3" 
                                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                                      placeholder="Any additional information..."></textarea>
                        </div>
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="closeAppointmentModal()" 
                                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-500 hover:bg-blue-600">
                                Book Appointment
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('preferredDate').min = today;
    
    // Handle form submission
    document.getElementById('appointmentForm').addEventListener('submit', (e) => handleAppointmentBooking(e, symptomId));
}

// Close appointment modal
function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) {
        modal.remove();
    }
}

// Handle appointment booking
async function handleAppointmentBooking(e, symptomId) {
    e.preventDefault();
    
    try {
        const user = firebase.auth().currentUser;
        if (!user || !symptomId) {
            showError('User not authenticated or no symptoms available.');
            return;
        }

        const formData = {
            userId: user.uid,
            symptomId: symptomId,
            preferredDate: document.getElementById('preferredDate').value,
            preferredTime: document.getElementById('preferredTime').value,
            urgency: document.getElementById('urgency').value,
            notes: document.getElementById('notes').value
        };

        const response = await fetch('http://localhost:5000/api/book-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Appointment booked:', result.appointmentId);
            
            // Close modal
            closeAppointmentModal();
            
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative';
            successDiv.innerHTML = `
                <span class="block sm:inline">
                    <i class="fas fa-check mr-2"></i>
                    Appointment booked successfully! 
                    <a href="appointments.html" class="underline ml-2">View Appointments</a>
                </span>
            `;
            document.querySelector('.max-w-7xl').insertBefore(successDiv, document.querySelector('.max-w-7xl').firstChild);
            
            // Remove success message after 5 seconds
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.remove();
                }
            }, 5000);
        } else {
            showError('Failed to book appointment. Please try again.');
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        showError('Error booking appointment. Please try again.');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await firebase.auth().signOut();
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('rememberMe');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        showError('Failed to log out. Please try again.');
    }
}

// Add logout button handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Check authentication state and load data
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        loadHealthReports();
    }
});

})(); 