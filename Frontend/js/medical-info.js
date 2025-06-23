(async function() {
// Import Firebase and Chart.js
const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
  .then(res => res.json());

// Then initialize Firebase with it
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get Firestore instance
const db = firebase.firestore();

// UI Elements
const medicalInfoForm = document.getElementById('medicalInfoForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const logoutBtn = document.getElementById('logoutBtn');

// Show loading spinner
function showLoading() {
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
    }
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
}

// Hide loading spinner
function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    if (errorMessage) {
        errorMessage.classList.remove('hidden');
        errorMessage.querySelector('span').textContent = message;
    }
}

// Load user's medical information
async function loadMedicalInfo(userId) {
    try {
        showLoading();
        const doc = await db.collection('medicalInformation').doc(userId).get();
        
        if (doc.exists) {
            const data = doc.data();
            // Populate form fields
            document.getElementById('bloodType').value = data.bloodType || '';
            document.getElementById('height').value = data.height || '';
            document.getElementById('weight').value = data.weight || '';
            document.getElementById('allergies').value = data.allergies || '';
            document.getElementById('medications').value = data.medications || '';
            document.getElementById('conditions').value = data.conditions || '';
            document.getElementById('emergencyName').value = data.emergencyName || '';
            document.getElementById('emergencyRelation').value = data.emergencyRelation || '';
            document.getElementById('emergencyPhone').value = data.emergencyPhone || '';
        }
    } catch (error) {
        console.error('Error loading medical info:', error);
        showError('Failed to load medical information. Please try again.');
    } finally {
        hideLoading();
    }
}

// Save medical information
async function saveMedicalInfo(userId, formData) {
    try {
        showLoading();
        await db.collection('medicalInformation').doc(userId).set({
            ...formData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: userId
        }, { merge: true });
        // Log activity for medical info update
        logUserActivity && logUserActivity('medical_info', 'User updated their medical info');
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative';
        successMessage.innerHTML = '<span class="block sm:inline">Medical information saved successfully!</span>';
        medicalInfoForm.insertAdjacentElement('beforebegin', successMessage);
        
        // Remove success message after 3 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
    } catch (error) {
        console.error('Error saving medical info:', error);
        showError('Failed to save medical information. Please try again.');
    } finally {
        hideLoading();
    }
}

// Handle form submission
if (medicalInfoForm) {
    medicalInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const user = firebase.auth().currentUser;
        if (!user) {
            showError('You must be logged in to save medical information.');
            return;
        }

        const formData = {
            bloodType: document.getElementById('bloodType').value,
            height: document.getElementById('height').value,
            weight: document.getElementById('weight').value,
            allergies: document.getElementById('allergies').value,
            medications: document.getElementById('medications').value,
            conditions: document.getElementById('conditions').value,
            emergencyName: document.getElementById('emergencyName').value,
            emergencyRelation: document.getElementById('emergencyRelation').value,
            emergencyPhone: document.getElementById('emergencyPhone').value
        };

        await saveMedicalInfo(user.uid, formData);
    });
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

// Check authentication state
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        await loadMedicalInfo(user.uid);
    } else {
        // User is signed out
        window.location.href = 'login.html';
    }
});
})(); 