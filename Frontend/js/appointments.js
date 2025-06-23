(async function() {
// Import Firebase
const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
  .then(res => res.json());

// Then initialize Firebase with it
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// DOM Elements
const appointmentsList = document.getElementById('appointmentsList');
const noAppointments = document.getElementById('noAppointments');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const logoutBtn = document.getElementById('logoutBtn');

// Loading and error handling
function showLoading() {
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
    }
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
}

function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
}

function showError(message) {
    if (errorMessage) {
        errorMessage.classList.remove('hidden');
        errorMessage.querySelector('span').textContent = message;
    }
}

// Load user appointments
async function loadAppointments() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        showLoading();
        const response = await fetch(`http://localhost:5000/api/appointments/${user.uid}`);
        
        if (response.ok) {
            const data = await response.json();
            displayAppointments(data.appointments);
        } else {
            showError('Failed to load appointments.');
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
        showError('Error loading appointments.');
    } finally {
        hideLoading();
    }
}

// Display appointments in the UI
function displayAppointments(appointments) {
    if (!appointments || appointments.length === 0) {
        appointmentsList.classList.add('hidden');
        noAppointments.classList.remove('hidden');
        return;
    }

    appointmentsList.classList.remove('hidden');
    noAppointments.classList.add('hidden');
    appointmentsList.innerHTML = '';
    
    appointments.forEach(appointment => {
        const appointmentCard = document.createElement('div');
        appointmentCard.className = 'bg-white shadow rounded-lg border-l-4 border-blue-500';
        
        const date = appointment.createdAt ? new Date(appointment.createdAt.toDate()).toLocaleDateString() : 'Unknown date';
        const appointmentDate = appointment.preferredDate ? new Date(appointment.preferredDate).toLocaleDateString() : 'Not specified';
        
        // Get urgency color
        const urgencyColor = appointment.urgency === 'high' ? 'text-red-600' : 
                           appointment.urgency === 'medium' ? 'text-yellow-600' : 'text-green-600';
        
        // Get status color
        const statusColor = appointment.status === 'confirmed' ? 'text-green-600' :
                          appointment.status === 'pending' ? 'text-yellow-600' :
                          appointment.status === 'cancelled' ? 'text-red-600' : 'text-gray-600';
        
        appointmentCard.innerHTML = `
            <div class="p-6">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-medium text-gray-900">
                                Appointment #${appointment.appointmentId}
                            </h3>
                            <div class="flex space-x-2">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${urgencyColor} bg-gray-100">
                                    ${appointment.urgency.toUpperCase()} URGENCY
                                </span>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor} bg-gray-100">
                                    ${appointment.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Appointment Details</h4>
                                <div class="space-y-1 text-sm text-gray-600">
                                    <p><strong>Date:</strong> ${appointmentDate}</p>
                                    <p><strong>Time:</strong> ${appointment.preferredTime || 'Not specified'}</p>
                                    <p><strong>Booked on:</strong> ${date}</p>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Patient Information</h4>
                                <div class="space-y-1 text-sm text-gray-600">
                                    <p><strong>Name:</strong> ${appointment.patientInfo.name}</p>
                                    <p><strong>Email:</strong> ${appointment.patientInfo.email}</p>
                                    <p><strong>Phone:</strong> ${appointment.patientInfo.phone}</p>
                                </div>
                            </div>
                        </div>
                        
                        ${appointment.symptoms && appointment.symptoms.length > 0 ? `
                            <div class="mb-4">
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Reported Symptoms</h4>
                                <div class="flex flex-wrap gap-1">
                                    ${appointment.symptoms.map(symptom => 
                                        `<span class="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">${symptom}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${appointment.aiAnalysis && Object.keys(appointment.aiAnalysis).length > 0 ? `
                            <div class="mb-4 p-3 bg-gray-50 rounded border">
                                <h4 class="text-sm font-medium text-gray-700 mb-2">AI Analysis</h4>
                                ${appointment.aiAnalysis.possibleAilments && appointment.aiAnalysis.possibleAilments.length > 0 ? `
                                    <div class="mb-2">
                                        <span class="text-xs font-medium text-gray-600">Possible Conditions:</span>
                                        <ul class="text-xs text-gray-700 ml-2 mt-1">
                                            ${appointment.aiAnalysis.possibleAilments.map(ailment => 
                                                `<li>• ${ailment.name} (${ailment.confidence} confidence)</li>`
                                            ).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                                ${appointment.aiAnalysis.recommendations && appointment.aiAnalysis.recommendations.length > 0 ? `
                                    <div class="mb-2">
                                        <span class="text-xs font-medium text-gray-600">Recommendations:</span>
                                        <ul class="text-xs text-gray-700 ml-2 mt-1">
                                            ${appointment.aiAnalysis.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        ${appointment.notes ? `
                            <div class="mb-4">
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Additional Notes</h4>
                                <p class="text-sm text-gray-600 bg-gray-50 p-3 rounded">${appointment.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 mt-4 pt-4 border-t border-gray-200">
                    <button onclick="cancelAppointment('${appointment.id}')" 
                            class="px-3 py-1 border border-red-300 text-red-700 text-sm rounded hover:bg-red-50">
                        <i class="fas fa-times mr-1"></i> Cancel
                    </button>
                    <button onclick="rescheduleAppointment('${appointment.id}')" 
                            class="px-3 py-1 border border-blue-300 text-blue-700 text-sm rounded hover:bg-blue-50">
                        <i class="fas fa-calendar-alt mr-1"></i> Reschedule
                    </button>
                </div>
            </div>
        `;
        
        appointmentsList.appendChild(appointmentCard);
    });
}

// Cancel appointment
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    
    try {
        // Here you would typically call an API to cancel the appointment
        // For now, we'll just show a message
        showError('Appointment cancellation feature will be implemented soon.');
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showError('Error cancelling appointment.');
    }
}

// Reschedule appointment
async function rescheduleAppointment(appointmentId) {
    try {
        // Here you would typically show a modal to reschedule
        // For now, we'll just show a message
        showError('Appointment rescheduling feature will be implemented soon.');
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        showError('Error rescheduling appointment.');
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
        loadAppointments();
    }
});

})(); 