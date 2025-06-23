import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ========== CORE COLLECTIONS ==========

# USERS
db.collection("users").document("user123").set({
    "name": "Arnab",
    "email": "arnab@example.com",
    "role": "patient",
    "age": 22
})

# SYMPTOM CHECKS
db.collection("symptomChecks").add({
    "userId": "user123",
    "symptoms": ["cough", "fever"],
    "notes": "Dry cough since last night",
    "timestamp": datetime.utcnow()
})

# DISEASE PREDICTIONS
db.collection("diseasePredictions").add({
    "userId": "user123",
    "predictedDiseases": ["Common Cold", "Viral Fever"],
    "confidenceScores": [0.83, 0.74],
    "date": datetime.utcnow()
})

# HEALTH REPORTS
db.collection("healthReports").add({
    "userId": "user123",
    "title": "General Checkup",
    "summary": "Vitals are normal. Minor cold symptoms.",
    "files": [],  # URLs or Firebase Storage links
    "created": datetime.utcnow()
})

# APPOINTMENTS
db.collection("appointments").add({
    "userId": "user123",
    "doctorId": "doc456",
    "status": "confirmed",
    "date": "2025-06-13T10:30:00"
})

# HOSPITALS
db.collection("hospitals").add({
    "name": "Fortis Hiranandani",
    "location": "Vashi, Navi Mumbai",
    "emergencyAvailable": True,
    "contact": "+91-22-12345678"
})

# FEEDBACK
db.collection("feedback").add({
    "userId": "user123",
    "message": "Loved the AI disease prediction!",
    "rating": 5,
    "timestamp": datetime.utcnow()
})

# ========== OPTIONAL / FUTURE COLLECTIONS ==========

# VOICE INPUTS
db.collection("voiceInputs").add({
    "userId": "user123",
    "transcription": "I have chest pain and dizziness",
    "timestamp": datetime.utcnow()
})

# MEDICAL INFO (Learn More Section)
db.collection("medicalInfo").add({
    "title": "What is Diabetes?",
    "content": "Diabetes is a chronic condition affecting blood sugar levels.",
    "category": "Endocrine Disorders"
})

# NOTIFICATIONS
db.collection("notifications").add({
    "userId": "user123",
    "type": "appointment",
    "message": "Your appointment is confirmed for June 13, 10:30 AM.",
    "isRead": False,
    "created": datetime.utcnow()
})

# DOCTORS
db.collection("doctors").document("doc456").set({
    "name": "Dr. Sneha Shah",
    "specialization": "General Physician",
    "available": True,
    "email": "sneha@mediassist.com"
})

# ADMINS
db.collection("admins").document("admin001").set({
    "name": "System Admin",
    "email": "admin@mediassist.com",
    "role": "superadmin"
})

# PRESCRIPTIONS
db.collection("prescriptions").add({
    "userId": "user123",
    "doctorId": "doc456",
    "dateIssued": datetime.utcnow(),
    "medicines": ["Paracetamol", "Vitamin C"],
    "notes": "Take after food for 5 days"
})

# ERROR LOGS
db.collection("errorLogs").add({
    "component": "AI Predictor",
    "errorMessage": "Null symptom input received",
    "timestamp": datetime.utcnow()
})

# ANALYTICS
db.collection("analytics").add({
    "event": "login",
    "userId": "user123",
    "timestamp": datetime.utcnow()
})

print("✅ Firestore seeding complete — all collections & sample docs created.")
