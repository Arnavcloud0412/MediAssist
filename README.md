# MediAssist - AI-Powered Medical Diagnosis Assistant

MediAssist is a comprehensive healthcare application that provides AI-powered symptom analysis, health monitoring, and medical guidance. The system uses voice input for symptom recording, AI analysis for condition prediction, and generates professional hospital-style health reports.

## Features

### 🎤 Voice Symptom Input
- Record symptoms using voice input
- Real-time audio visualization
- Automatic transcription using AssemblyAI
- AI-powered symptom extraction

### 🤖 AI-Powered Analysis
- Symptom analysis using Google Gemini AI
- Condition prediction with confidence levels
- Urgency assessment
- Personalized recommendations

### 📊 Health Reports
- **Professional Hospital-Style Reports**: Automatically generated comprehensive medical reports that look like official hospital documents
- **Most Recent Report Display**: When visiting the Health Report page, the system automatically fetches and displays the user's most recent health assessment
- **Complete Medical Information**: Includes patient details, medical history, symptom analysis, and AI diagnosis
- **Differential Diagnosis**: Professional medical terminology with confidence levels for each possible condition
- **Clinical Recommendations**: Actionable medical advice and next steps
- **PDF Export**: Download reports as professional PDF documents

### 🏥 Hospital Finder
- Find nearby hospitals and healthcare facilities
- Get directions and contact information
- Filter by specialty and services

### 📅 Appointment Booking
- Schedule appointments with healthcare providers
- Set urgency levels and preferred times
- Track appointment history

### 👤 User Management
- Secure authentication with Firebase
- Personal medical information storage
- Health history tracking

## Health Report System

### How It Works

1. **Voice Input**: Users record their symptoms using the voice input feature
2. **Symptom Analysis**: AI extracts and identifies symptoms from the voice transcript
3. **Condition Prediction**: AI analyzes symptoms to predict possible conditions with confidence levels
4. **Report Generation**: A comprehensive health report is automatically generated
5. **Display**: When users visit the Health Report page, the most recent report is automatically fetched and displayed in a professional hospital-style format

### Report Features

- **Professional Header**: Hospital-style header with report ID and generation timestamp
- **Patient Information**: Complete patient details and medical history
- **Chief Complaint**: Patient's reported symptoms with voice transcript
- **Differential Diagnosis**: Professional medical analysis with confidence levels
- **Clinical Assessment**: Urgency levels and medical recommendations
- **Action Items**: Clear next steps and appointment booking options
- **Medical Disclaimer**: Professional disclaimers and legal information

### Report Types

1. **Detailed Health Reports**: Full comprehensive reports with patient information, medical history, and complete AI analysis
2. **Basic Health Assessments**: Simplified reports for symptom-only data when detailed information isn't available
3. **No Reports Message**: Helpful guidance when no reports exist yet

## Technical Architecture

### Frontend
- **HTML5/CSS3**: Modern responsive design with Tailwind CSS
- **JavaScript**: Vanilla JS with ES6+ features
- **Firebase**: Authentication and real-time database
- **Chart.js**: Data visualization for health trends

### Backend
- **Python Flask**: RESTful API server
- **Firebase Admin**: Server-side Firebase operations
- **Google Gemini AI**: Advanced AI for medical analysis
- **AssemblyAI**: High-accuracy speech-to-text transcription

### Database
- **Firestore**: NoSQL database for user data and health records
- **Collections**: users, userSymptoms, healthReports, medicalInformation, appointments

## Installation and Setup

### Prerequisites
- Python 3.8+
- Node.js (for frontend development)
- Firebase project
- Google Gemini API key
- AssemblyAI API key

### Backend Setup
```bash
cd Backend
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd Frontend
# Serve with any static file server
python -m http.server 8000
# or use Live Server extension in VS Code
```

### Environment Variables
Create a `.env` file in the Backend directory:
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
GEMINI_API_KEY=your_gemini_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Voice Processing
- `POST /api/transcribe` - Audio transcription
- `POST /api/analyze-symptoms` - Symptom extraction
- `POST /api/save-symptoms` - Save symptom data

### Health Reports
- `GET /api/health-reports/<user_id>` - Get user's health reports
- `GET /api/health-reports/detailed/<report_id>` - Get detailed health report
- `POST /api/generate-health-report` - Generate new health report

### Appointments
- `POST /api/book-appointment` - Book medical appointment
- `GET /api/appointments/<user_id>` - Get user's appointments

## Usage Guide

### For Patients
1. **Register/Login**: Create an account or sign in
2. **Record Symptoms**: Use voice input to describe your symptoms
3. **Review Analysis**: Check AI-generated symptom analysis and predictions
4. **Generate Report**: Create a comprehensive health report
5. **View Reports**: Access your health reports in the Health Report section
6. **Book Appointments**: Schedule consultations with healthcare providers

### For Healthcare Providers
1. **Review Reports**: Access patient health reports
2. **Track History**: View patient's health history and trends
3. **Manage Appointments**: Handle appointment scheduling and management

## Security and Privacy

- **HIPAA Compliance**: Designed with healthcare privacy standards in mind
- **Secure Authentication**: Firebase Auth with secure token management
- **Data Encryption**: All sensitive data is encrypted in transit and at rest
- **User Consent**: Clear privacy policies and user consent mechanisms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Disclaimer

This application is for educational and informational purposes only. It should not replace professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions.
