(async function() {
// Import Firebase and Chart.js
const firebaseConfig = await fetch("http://localhost:5000/firebase-config")
  .then(res => res.json());

// Then initialize Firebase with it
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// DOM Elements
const startRecordingBtn = document.getElementById('startRecording');
const recordingStatus = document.getElementById('recordingStatus');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const audioPlayer = audioPlayerContainer.querySelector('audio');
const transcriptionTextarea = document.getElementById('transcription');
const analyzeButton = document.getElementById('analyzeButton');
const predictButton = document.getElementById('predictButton');
const clearButton = document.getElementById('clearButton');
const logoutBtn = document.getElementById('logoutBtn');
const canvas = document.getElementById('audioVisualizer');
const canvasCtx = canvas.getContext('2d');

// State variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let audioBlob = null;
let transcriptionInProgress = false;
let currentRecordingId = null;
let analyser = null;
let dataArray = null;
let currentSymptoms = [];
let currentSymptomId = null;

// UI Helper functions
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('hidden');
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    }
}

// Add these variables at the top with other variables
let transcriptionProgress = 0;

// Initialize audio context and analyzer
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Convert blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Visualize audio
function visualize() {
    if (!isRecording || !analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!isRecording || !analyser) return;
        
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(239, 68, 68)';
        canvasCtx.beginPath();
        
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }
    
    draw();
}

// Add this function to create and update the progress bar
function updateTranscriptionProgress(progress) {
    let progressBar = document.getElementById('transcriptionProgress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'transcriptionProgress';
        progressBar.className = 'w-full bg-gray-200 rounded-full h-2.5 mt-2';
        const progressInner = document.createElement('div');
        progressInner.className = 'bg-red-500 h-2.5 rounded-full transition-all duration-300';
        progressInner.style.width = '0%';
        progressBar.appendChild(progressInner);
        document.getElementById('transcription').parentNode.appendChild(progressBar);
    }
    progressBar.querySelector('div').style.width = `${progress}%`;
}

// Add this function to handle Firestore errors
async function handleFirestoreError(error, operation) {
    console.error(`Firestore ${operation} error:`, error);
    
    if (error.code === 'permission-denied' || error.message.includes('blocked') || error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        showError('Access to database was blocked. Please check your ad blocker or security settings and try again.');
        return false;
    }
    
    showError(`Failed to ${operation}. Please try again.`);
    return false;
}

// Add this function to retry Firestore operations
async function retryFirestoreOperation(operation, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await operation();
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
    }
}

// Store recording in Firestore and transcribe with AssemblyAI streaming
async function storeRecordingAndTranscribe(audioBlob) {
    try {
        // Get current user
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        showLoading();
        // TODO: Convert audioBlob to PCM 16kHz chunks (currently webm/opus, needs conversion for AssemblyAI)
        // For now, just read as a single chunk (not real streaming)
        const base64Audio = await blobToBase64(audioBlob);
        const audioChunks = [base64Audio];
        // Send to backend for streaming transcription
        const response = await fetch('http://localhost:5000/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.uid,
                audio_chunks: audioChunks,
                meta: { filename: 'voice-input', timestamp: Date.now() }
            })
        });
        let transcriptText = '';
        if (response.ok) {
            const result = await response.json();
            transcriptText = result.text;
            // Log activity for voice input
            logUserActivity && logUserActivity('voice_input', 'User recorded symptoms');
        } else {
            transcriptText = 'Transcription failed.';
        }
        // Store in Firestore (already done by backend)
        // Show transcript in UI
        transcriptionTextarea.value = transcriptText;
        transcriptionTextarea.disabled = false;
        hideLoading();
    } catch (error) {
        console.error('Error storing or transcribing recording:', error);
        showError('Failed to save or transcribe recording.');
        hideLoading();
    }
}

// Start recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await initAudioContext();
        // Set up audio analyzer
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            audioPlayerContainer.classList.remove('hidden');
            // Add confirm and discard buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'mt-4 flex justify-center space-x-4';
            const confirmButton = document.createElement('button');
            confirmButton.className = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500';
            confirmButton.innerHTML = '<i class="fas fa-check mr-2"></i> Confirm';
            confirmButton.onclick = async () => {
                confirmButton.disabled = true;
                discardButton.disabled = true;
                await storeRecordingAndTranscribe(audioBlob);
                buttonContainer.remove();
            };
            const discardButton = document.createElement('button');
            discardButton.className = 'inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500';
            discardButton.innerHTML = '<i class="fas fa-times mr-2"></i> Discard';
            discardButton.onclick = () => {
                audioPlayerContainer.classList.add('hidden');
                audioPlayer.src = '';
                audioBlob = null;
                buttonContainer.remove();
            };
            buttonContainer.appendChild(confirmButton);
            buttonContainer.appendChild(discardButton);
            audioPlayerContainer.appendChild(buttonContainer);
        };
        mediaRecorder.start();
        isRecording = true;
        startRecordingBtn.innerHTML = '<i class="fas fa-stop mr-2"></i> Stop Recording';
        recordingStatus.textContent = 'Recording in progress...';
        // Start visualization
        visualize();
    } catch (error) {
        showError('Error accessing microphone: ' + error.message);
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        startRecordingBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Start Recording';
        startRecordingBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        startRecordingBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        recordingStatus.textContent = 'Click the button to start recording';
        recordingStatus.classList.remove('text-red-500');
        recordingStatus.classList.add('text-gray-500');
    }
}

// Handle clear button
if (clearButton) {
    clearButton.addEventListener('click', () => {
        transcriptionTextarea.value = '';
        audioPlayerContainer.classList.add('hidden');
        audioPlayerContainer.innerHTML = '';
        // Clear symptoms and hide predict button
        currentSymptoms = [];
        currentSymptomId = null;
        predictButton.classList.add('hidden');
        document.getElementById('symptomsList').innerHTML = '';
        document.getElementById('analysisResults').classList.add('hidden');
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
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// Handle recording button click
if (startRecordingBtn) {
    startRecordingBtn.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });
}

// Analyze Symptoms button handler
if (analyzeButton) {
    analyzeButton.addEventListener('click', async () => {
        const transcript = transcriptionTextarea.value;
        if (!transcript || transcript.trim() === '') {
            showError('No transcript to analyze.');
            return;
        }
        showLoading();
        try {
            console.log(transcript);
            // Send transcript to backend for Gemini analysis
            const response = await fetch('http://localhost:5000/api/analyze-symptoms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });
            if (response.ok) {
                const result = await response.json();
                currentSymptoms = result.symptoms || [];
                
                // Display symptoms in the UI
                const symptomsList = document.getElementById('symptomsList');
                symptomsList.innerHTML = '';
                if (currentSymptoms.length > 0) {
                    currentSymptoms.forEach(symptom => {    
                        const li = document.createElement('li');
                        li.textContent = symptom;
                        symptomsList.appendChild(li);
                    });
                    
                    // Show the predict button
                    predictButton.classList.remove('hidden');
                    
                    // Save symptoms to Firestore
                    await saveSymptomsToFirestore(transcript, currentSymptoms);
                } else {
                    symptomsList.innerHTML = '<li>No symptoms found.</li>';
                    predictButton.classList.add('hidden');
                }
            } else {
                showError('Failed to analyze symptoms.');
            }
        } catch (error) {
            showError('Error analyzing symptoms.');
        } finally {
            hideLoading();
        }
    });
}

// Save symptoms to Firestore
async function saveSymptomsToFirestore(transcript, symptoms) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : '';
        
        const response = await fetch('http://localhost:5000/api/save-symptoms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.uid,
                transcript: transcript,
                symptoms: symptoms,
                audioUrl: audioUrl
            })
        });

        if (response.ok) {
            // Log activity for medical info update
            logUserActivity && logUserActivity('medical_info', 'User updated their medical info from voice input');
            const result = await response.json();
            currentSymptomId = result.symptomId;
            console.log('Symptoms saved with ID:', currentSymptomId);
        } else {
            console.error('Failed to save symptoms');
        }
    } catch (error) {
        console.error('Error saving symptoms:', error);
    }
}

// Predict Ailment button handler
if (predictButton) {
    predictButton.addEventListener('click', async () => {
        if (!currentSymptoms || currentSymptoms.length === 0) {
            showError('No symptoms to analyze.');
            return;
        }
        
        showLoading();
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const response = await fetch('http://localhost:5000/api/predict-ailment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    symptoms: currentSymptoms,
                    symptomId: currentSymptomId
                })
            });

            if (response.ok) {
                const prediction = await response.json();
                displayPredictionResults(prediction);
            } else {
                showError('Failed to predict ailment.');
            }
        } catch (error) {
            showError('Error predicting ailment.');
        } finally {
            hideLoading();
        }
    });
}

// Display prediction results
function displayPredictionResults(prediction) {
    const analysisResults = document.getElementById('analysisResults');
    const conditionsList = document.getElementById('conditionsList');
    const recommendationsList = document.getElementById('recommendationsList');
    const urgencyLevel = document.getElementById('urgencyLevel');
    const medicalAdvice = document.getElementById('medicalAdvice');

    // Clear previous results
    conditionsList.innerHTML = '';
    recommendationsList.innerHTML = '';

    // Display possible ailments
    if (prediction.possibleAilments && prediction.possibleAilments.length > 0) {
        prediction.possibleAilments.forEach(ailment => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${ailment.name}</strong> (${ailment.confidence} confidence) - ${ailment.description}`;
            conditionsList.appendChild(li);
        });
    } else {
        conditionsList.innerHTML = '<li>No specific conditions identified</li>';
    }

    // Display recommendations
    if (prediction.recommendations && prediction.recommendations.length > 0) {
        prediction.recommendations.forEach(recommendation => {
            const li = document.createElement('li');
            li.textContent = recommendation;
            recommendationsList.appendChild(li);
        });
    } else {
        recommendationsList.innerHTML = '<li>No specific recommendations available</li>';
    }

    // Display urgency level
    if (prediction.urgency) {
        const urgencyClass = prediction.urgency === 'high' ? 'text-red-600 font-semibold' : 
                           prediction.urgency === 'medium' ? 'text-yellow-600 font-semibold' : 
                           'text-green-600 font-semibold';
        urgencyLevel.innerHTML = `<span class="${urgencyClass}">${prediction.urgency.toUpperCase()}</span>`;
    }

    // Display medical advice
    if (prediction.shouldSeeDoctor !== undefined) {
        const adviceText = prediction.shouldSeeDoctor ? 
            'It is recommended to consult a healthcare professional.' : 
            'Monitor your symptoms and seek medical attention if they worsen.';
        const adviceClass = prediction.shouldSeeDoctor ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold';
        medicalAdvice.innerHTML = `<span class="${adviceClass}">${adviceText}</span>`;
    }

    // Add only Generate Health Report button
    const actionButtons = document.createElement('div');
    actionButtons.className = 'mt-6 flex justify-center';
    
    // Generate Health Report button
    const generateReportBtn = document.createElement('button');
    generateReportBtn.className = 'inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
    generateReportBtn.innerHTML = '<i class="fas fa-file-medical mr-2"></i>Generate Health Report';
    generateReportBtn.onclick = () => generateHealthReportAndRedirect();
    
    actionButtons.appendChild(generateReportBtn);
    
    // Add action buttons to results
    analysisResults.appendChild(actionButtons);

    // Show the results
    analysisResults.classList.remove('hidden');
    
    // Scroll to results
    analysisResults.scrollIntoView({ behavior: 'smooth' });
}

// Generate health report and redirect to health report page
async function generateHealthReportAndRedirect() {
    try {
        const user = firebase.auth().currentUser;
        if (!user || !currentSymptomId) {
            showError('User not authenticated or no symptoms available.');
            return;
        }

        showLoading();

        const response = await fetch('http://localhost:5000/api/generate-health-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.uid,
                symptomId: currentSymptomId
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Health report generated:', result.reportId);
            
            // Store the report ID in localStorage for the health report page
            localStorage.setItem('latestReportId', result.reportId);
            
            // Redirect to health report page
            window.location.href = 'health-report.html';
        } else {
            showError('Failed to generate health report. Please try again.');
        }
    } catch (error) {
        console.error('Error generating health report:', error);
        showError('Error generating health report. Please try again.');
    } finally {
        hideLoading();
    }
}
})(); 