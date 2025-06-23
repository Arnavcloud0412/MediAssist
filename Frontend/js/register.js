// UI Elements
const registerForm = document.getElementById('registerForm');
const googleSignInBtn = document.getElementById('googleSignIn');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');

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
    } else {
        console.error('Error:', message);
    }
}

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCkzzBIvMgTUO14zJiVukT3tdrzsy5a5B8",
    projectId: "mediassit-45853",
    authDomain: "mediassit-45853.firebaseapp.com",
    storageBucket: "mediassit-45853.appspot.com",
    messagingSenderId: "107027733847534681542",
    appId: "1:107027733847534681542:web:d20b8b16a812360376f04f6ae59f12cf932316ed"
};

// Initialize Firebase
let auth;
let db;
let provider;

try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    provider = new firebase.auth.GoogleAuthProvider();
} catch (error) {
    console.error('Firebase initialization error:', error);
    showError('Failed to initialize authentication. Please refresh the page.');
}

// Handle successful registration
async function handleSuccessfulRegistration(user, additionalData = null) {
    try {
        // Get the ID token
        const idToken = await user.getIdToken();
        
        // Store the token in localStorage
        localStorage.setItem('token', idToken);

        // If we have additional data from email/password registration
        if (additionalData) {
            // Update the user's profile
            await user.updateProfile({
                displayName: additionalData.fullName
            });

            // Create user profile in Firestore
            await db.collection('users').doc(user.uid).set({
                name: additionalData.fullName,
                email: additionalData.email,
                phone: additionalData.phone,
                age: parseInt(additionalData.age),
                gender: additionalData.gender,
                address: additionalData.address,
                role: 'patient',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Initialize empty medical information
            await db.collection('medicalInformation').doc(user.uid).set({
                userId: user.uid,
                allergies: '',
                conditions: [],
                medications: '',
                emergencyName: '',
                emergencyPhone: '',
                emergencyRelationship: '',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Redirect to medical info page
        window.location.href = 'medical-info.html';
    } catch (error) {
        console.error('Error during registration:', error);
        showError('Error during registration. Please try again.');
    }
}

// Email/Password Registration
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        showLoading();

        const fullName = document.getElementById('full-name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const age = document.getElementById('age').value;
        const gender = document.getElementById('gender').value;
        const phone = document.getElementById('phone').value;
        const address = document.getElementById('address').value;

        // Validate passwords match
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            hideLoading();
            return;
        }

        // Validate password strength
        const strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})');
        if (!strongPassword.test(password)) {
            showError('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
            hideLoading();
            return;
        }

        try {
            if (!auth) {
                throw new Error('Authentication not initialized');
            }
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await handleSuccessfulRegistration(userCredential.user, {
                fullName,
                email,
                phone,
                age,
                gender,
                address
            });
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Failed to create account. ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'This email is already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Please enter a valid email address.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage += 'Email/password accounts are not enabled.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Please choose a stronger password.';
                    break;
                default:
                    errorMessage += 'Please try again.';
            }
            showError(errorMessage);
        } finally {
            hideLoading();
        }
    });
}

// Handle Google Sign In
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        try {
            showLoading();
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithRedirect(provider);
        } catch (error) {
            console.error('Error during Google sign in:', error);
            showError('Failed to sign in with Google. Please try again.');
            hideLoading();
        }
    });
}

// Handle redirect result
firebase.auth().getRedirectResult().then(async (result) => {
    if (result.user) {
        try {
            // Get additional user data from Google
            const additionalData = {
                fullName: result.user.displayName,
                email: result.user.email,
                photoURL: result.user.photoURL
            };
            await handleSuccessfulRegistration(result.user, additionalData);
        } catch (error) {
            console.error('Error handling successful registration:', error);
            showError('Failed to complete registration process. Please try again.');
        }
    }
}).catch((error) => {
    console.error('Error getting redirect result:', error);
    showError('Failed to complete Google sign in. Please try again.');
    hideLoading();
});

// Password strength validation
const passwordInput = document.getElementById('password');
if (passwordInput) {
    passwordInput.addEventListener('input', function(e) {
        const password = e.target.value;
        const strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})');
        
        if (strongPassword.test(password)) {
            e.target.classList.remove('border-red-500');
            e.target.classList.add('border-green-500');
        } else {
            e.target.classList.remove('border-green-500');
            e.target.classList.add('border-red-500');
        }
    });
}

// Phone number formatting
const phoneInput = document.getElementById('phone');
if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });
} 