// Import Firebase and Chart.js
const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
  .then(res => res.json());

// Then initialize Firebase with it
firebase.initializeApp(firebaseConfig);

// UI Elements
const loginForm = document.getElementById('loginForm');
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

// Handle successful login
async function handleSuccessfulLogin(user) {
    try {
        // Get the ID token
        const idToken = await user.getIdToken();
        
        // Store the token in localStorage
        localStorage.setItem('token', idToken);

        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Store user data in localStorage
            localStorage.setItem('userData', JSON.stringify(userData));
        }

        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Error during login:', error);
        showError('Error during login. Please try again.');
    }
}

// Email/Password Login
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        showLoading();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (!auth) {
                throw new Error('Authentication not initialized');
            }
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            await handleSuccessfulLogin(userCredential.user);
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Failed to login. ';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += 'Please enter a valid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage += 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += 'Incorrect password.';
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
            await handleSuccessfulLogin(result.user);
        } catch (error) {
            console.error('Error handling successful login:', error);
            showError('Failed to complete login process. Please try again.');
        }
    }
}).catch((error) => {
    console.error('Error getting redirect result:', error);
    showError('Failed to complete Google sign in. Please try again.');
    hideLoading();
});

// Handle logout
async function handleLogout() {
    try {
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
        showError('Error during logout. Please try again.');
    }
}

// Add logout button handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Check for existing session
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        const currentPath = window.location.pathname;
        if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
            // Redirect to dashboard if trying to access login/register pages while logged in
            window.location.href = 'dashboard.html';
        }
    } else {
        // User is signed out
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html') && !currentPath.includes('index.html')) {
            // Redirect to login if trying to access protected pages while logged out
            window.location.href = 'login.html';
        }
    }
}); 