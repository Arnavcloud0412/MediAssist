from flask import Flask, request, jsonify
import requests
import firebase_config  # initializes firebase_admin
import firebase_admin.auth as firebase_auth
from flask_cors import CORS
import assemblyai as aai
import base64
import tempfile
import os
import re
import json as pyjson
from dotenv import load_dotenv
from firebase_admin import firestore
import google.generativeai as genai
import time

# Load environment variables first
load_dotenv()

app = Flask(__name__)
CORS(app)

FIREBASE_API_KEY = os.getenv('FIREBASE_API_KEY')  # found in Project Settings > Web API key

# Google API Key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Configure AssemblyAI
aai.settings.api_key = os.getenv('ASSEMBLYAI_API_KEY')  # Set API key for AssemblyAI

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        # Firebase Auth REST API URL
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }

        response = requests.post(url, json=payload)
        result = response.json()

        if "idToken" in result:
            return jsonify({
                "message": "Login successful",
                "token": result["idToken"],
                "uid": result["localId"]
            }), 200
        else:
            return jsonify({"message": result.get("error", {}).get("message", "Login failed")}), 401

    except Exception as e:
        return jsonify({"message": "Internal Server Error", "error": str(e)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():

    try:
        data = request.json
        if not data or 'audio_chunks' not in data or not data['audio_chunks']:
            return jsonify({'error': 'No audio data provided'}), 400

        # Use the first chunk (assuming only one for now)
        audio_b64 = data['audio_chunks'][0]
        audio_data = base64.b64decode(audio_b64.split(',')[1])

        # Write to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(audio_data)
            audio_file_path = tmp_file.name

        # Call the transcription function
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_file_path)

        # Cleanup
        os.unlink(audio_file_path)

        if transcript.status == aai.TranscriptStatus.error:
            return jsonify({'error': transcript.error}), 500

        return jsonify({'text': transcript.text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/firebase-config', methods=['GET'])
def get_firebase_config():
    config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    return jsonify(config)

@app.route('/api/analyze-symptoms', methods=['POST'])
def analyze_symptoms():
    try:
        data = request.get_json()
        transcript = data.get('transcript', '')
        if not transcript:
            return jsonify({'error': 'No transcript provided'}), 400

        model = genai.GenerativeModel("gemini-1.5-flash")  # or "gemini-1.5-pro" for better accuracy

        prompt = ("You are a medical assistant.\n"
"Extract all **medical symptoms** mentioned in the following transcript.\n"
"Include both direct symptoms (e.g., 'fever', 'cough') and indirect or less obvious symptoms (e.g., 'loss of appetite', 'loss of smell or taste').\n"
"Also include any **pain descriptions**, such as headaches, stomach pain, chest tightness, or any mention of discomfort, even if described vividly (e.g., 'my head feels like it's being hit with a hammer').\n"
"Return the result strictly as a JSON array of strings, e.g., [\"fever\", \"cough\", \"loss of smell\", \"severe headache\"].\n\n"
f"Transcript:\n{transcript}"
        )

        response = model.generate_content(prompt)
        symptoms = []
        
        if response and hasattr(response, 'text'):
            # Try to extract the JSON array from the model's response
            text = response.text
            # Find the first JSON array in the text
            match = re.search(r'\[.*?\]', text, re.DOTALL)
            if match:
                try:
                    symptoms = pyjson.loads(match.group(0))
                except Exception:
                    symptoms = []
        
        return jsonify({'symptoms': symptoms})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-symptoms', methods=['POST'])
def save_symptoms():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        transcript = data.get('transcript', '')
        symptoms = data.get('symptoms', [])
        audio_url = data.get('audioUrl', '')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400

        # Save to Firestore with user association
        db = firestore.client()
        doc_ref = db.collection('userSymptoms').add({
            'userId': user_id,
            'transcript': transcript,
            'symptoms': symptoms,
            'audioUrl': audio_url,
            'created': firestore.SERVER_TIMESTAMP,
            'status': 'symptoms_identified'
        })

        return jsonify({
            'message': 'Symptoms saved successfully',
            'symptomId': doc_ref[1].id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict-ailment', methods=['POST'])
def predict_ailment():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        symptoms = data.get('symptoms', [])
        symptom_id = data.get('symptomId')
        
        if not user_id or not symptoms:
            return jsonify({'error': 'User ID and symptoms required'}), 400

        # Get user's medical information
        db = firestore.client()
        user_doc = db.collection('users').document(user_id).get()
        medical_info = {}
        if user_doc.exists:
            medical_info = user_doc.to_dict()

        # Prepare medical context
        medical_context = ""
        if medical_info:
            if medical_info.get('allergies'):
                medical_context += f"Allergies: {medical_info['allergies']}\n"
            if medical_info.get('medications'):
                medical_context += f"Current Medications: {medical_info['medications']}\n"
            if medical_info.get('conditions'):
                medical_context += f"Chronic Conditions: {medical_info['conditions']}\n"

        # Use Gemini to predict ailment
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = ("You are a knowledgeable and careful medical assistant.\n"
"Analyze the following list of symptoms and medical context to predict possible ailments.\n"
"Consider both direct and indirect symptoms, chronic conditions, recent medical events, and lifestyle indicators.\n"
"Be accurate, use common medical reasoning, and provide output strictly as a JSON object in the following structure:\n"
"{\n"
'  "possibleAilments": [\n'
'    {\n'
'      "name": "Name of the possible ailment",\n'
'      "confidence": "high" | "medium" | "low",\n'
'      "description": "A concise explanation of why this ailment is suspected based on symptoms and context."\n'
'    },\n'
'    ... (you may list multiple possibilities)\n'
'  ],\n'
'  "recommendations": [\n'
'    "Practical medical advice or next steps the user should take (e.g., rest, hydration, visit a specialist, etc.)"\n'
'  ],\n'
'  "urgency": "high" | "medium" | "low",  // Based on severity of symptoms or risk\n'
'  "shouldSeeDoctor": true | false       // True if medical attention is advisable soon\n'
"}\n\n"
f"Symptoms: {', '.join(symptoms)}\n"
f"Medical Context:\n{medical_context}"
        )

        response = model.generate_content(prompt)
        prediction = {}
        
        if response and hasattr(response, 'text'):
            text = response.text
            # Find JSON object in the response
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    prediction = pyjson.loads(match.group(0))
                except Exception:
                    prediction = {
                        "possibleAilments": [],
                        "recommendations": ["Unable to analyze symptoms. Please consult a healthcare professional."],
                        "urgency": "medium",
                        "shouldSeeDoctor": True
                    }
            else:
                prediction = {
                    "possibleAilments": [],
                    "recommendations": ["Unable to analyze symptoms. Please consult a healthcare professional."],
                    "urgency": "medium",
                    "shouldSeeDoctor": True
                }

        # Update the symptom record with prediction
        if symptom_id:
            db.collection('userSymptoms').document(symptom_id).update({
                'prediction': prediction,
                'status': 'ailment_predicted',
                'predictedAt': firestore.SERVER_TIMESTAMP
            })

        return jsonify(prediction)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health-reports/<user_id>', methods=['GET'])
def get_health_reports(user_id):
    try:
        print(f"Starting get_health_reports for user: {user_id}")
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400

        db = firestore.client()
        print("Firestore client initialized successfully")
        
        # Get user's symptom history with predictions
        try:
            print("Attempting to query userSymptoms collection...")
            # First try to query with ordering by created field
            try:
                symptoms_query = db.collection('userSymptoms').where('userId', '==', user_id).order_by('created', direction=firestore.Query.DESCENDING).limit(10)
                symptoms_docs = symptoms_query.stream()
                print("Query with ordering successful")
            except Exception as order_error:
                # If ordering fails, try without ordering
                print(f"Ordering failed, trying without order: {str(order_error)}")
                symptoms_query = db.collection('userSymptoms').where('userId', '==', user_id).limit(10)
                symptoms_docs = symptoms_query.stream()
                print("Query without ordering successful")
        except Exception as e:
            print(f"Error querying symptoms: {str(e)}")
            print(f"Error type: {type(e)}")
            import traceback
            print(f"Full traceback: {traceback.format_exc()}")
            return jsonify({'error': f'Error querying symptoms: {str(e)}'}), 500
        
        health_reports = []
        try:
            print("Processing symptom documents...")
            doc_count = 0
            for doc in symptoms_docs:
                doc_count += 1
                print(f"Processing document {doc_count}: {doc.id}")
                data = doc.to_dict()
                created_ts = data.get('created')
                
                # Handle different timestamp formats
                created_str = None
                if created_ts:
                    if hasattr(created_ts, 'isoformat'):
                        created_str = created_ts.isoformat()
                    elif isinstance(created_ts, str):
                        created_str = created_ts
                    else:
                        # Try to convert to string
                        created_str = str(created_ts)
                
                health_reports.append({
                    'id': doc.id,
                    'transcript': data.get('transcript', ''),
                    'symptoms': data.get('symptoms', []),
                    'prediction': data.get('prediction', {}),
                    'created': created_str,
                    'status': data.get('status', '')
                })
                print(f"Successfully processed document {doc.id}")
            
            print(f"Total documents processed: {doc_count}")
        except Exception as e:
            print(f"Error processing symptom data: {str(e)}")
            print(f"Error type: {type(e)}")
            import traceback
            print(f"Full traceback: {traceback.format_exc()}")
            return jsonify({'error': f'Error processing symptom data: {str(e)}'}), 500

        print(f"Returning {len(health_reports)} health reports")
        return jsonify({'healthReports': health_reports})
    except Exception as e:
        print(f"Unexpected error in get_health_reports: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Unexpected error in get_health_reports: {str(e)}'}), 500

@app.route('/api/health-reports/detailed/<report_id>', methods=['GET'])
def get_detailed_health_report(report_id):
    try:
        if not report_id:
            return jsonify({'error': 'Report ID required'}), 400

        db = firestore.client()
        
        # Get the detailed health report
        report_doc = db.collection('healthReports').document(report_id).get()
        if not report_doc.exists:
            return jsonify({'error': 'Health report not found'}), 404
            
        report_data = report_doc.to_dict()
        report_data['id'] = report_id

        # Convert timestamp fields to ISO 8601 strings for JSON serialization
        if report_data.get('reportGeneratedAt') and hasattr(report_data['reportGeneratedAt'], 'isoformat'):
            report_data['reportGeneratedAt'] = report_data['reportGeneratedAt'].isoformat()

        if 'symptomAnalysis' in report_data and report_data.get('symptomAnalysis', {}).get('recordedAt') and hasattr(report_data['symptomAnalysis']['recordedAt'], 'isoformat'):
            report_data['symptomAnalysis']['recordedAt'] = report_data['symptomAnalysis']['recordedAt'].isoformat()

        return jsonify({'healthReport': report_data})
    except Exception as e:
        return jsonify({'error': f'Error retrieving health report: {str(e)}'}), 500

@app.route('/api/generate-health-report', methods=['POST'])
def generate_health_report():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        symptom_id = data.get('symptomId')
        
        if not user_id or not symptom_id:
            return jsonify({'error': 'User ID and Symptom ID required'}), 400

        db = firestore.client()
        
        # Get the symptom record
        try:
            symptom_doc = db.collection('userSymptoms').document(symptom_id).get()
            if not symptom_doc.exists:
                return jsonify({'error': 'Symptom record not found'}), 404
                
            symptom_data = symptom_doc.to_dict()
        except Exception as e:
            return jsonify({'error': f'Error accessing symptom record: {str(e)}'}), 500
        
        # Get user information
        try:
            user_doc = db.collection('users').document(user_id).get()
            user_info = {}
            if user_doc.exists:
                user_info = user_doc.to_dict()
        except Exception as e:
            return jsonify({'error': f'Error accessing user record: {str(e)}'}), 500
            
        # Get medical information
        try:
            medical_doc = db.collection('medicalInformation').document(user_id).get()
            medical_info = {}
            if medical_doc.exists:
                medical_info = medical_doc.to_dict()
        except Exception as e:
            return jsonify({'error': f'Error accessing medical information: {str(e)}'}), 500
        
        # Get the highest confidence ailment
        highest_confidence_ailment = None
        if symptom_data.get('prediction') and symptom_data['prediction'].get('possibleAilments'):
            ailments = symptom_data['prediction']['possibleAilments']
            if ailments:
                # Sort by confidence (high > medium > low)
                confidence_order = {'high': 3, 'medium': 2, 'low': 1}
                highest_confidence_ailment = max(ailments, key=lambda x: confidence_order.get(x.get('confidence', 'low'), 0))
        
        # Generate comprehensive health report
        try:
            report_data = {
                'userId': user_id,
                'symptomId': symptom_id,
                'patientInfo': {
                    'name': user_info.get('name', 'Unknown'),
                    'age': user_info.get('age', 'Unknown'),
                    'gender': user_info.get('gender', 'Unknown'),
                    'email': user_info.get('email', 'Unknown')
                },
                'medicalInfo': {
                    'bloodType': medical_info.get('bloodType', 'Unknown'),
                    'allergies': medical_info.get('allergies', 'None'),
                    'medications': medical_info.get('medications', 'None'),
                    'conditions': medical_info.get('conditions', 'None')
                },
                'symptomAnalysis': {
                    'transcript': symptom_data.get('transcript', ''),
                    'symptoms': symptom_data.get('symptoms', []),
                    'recordedAt': symptom_data.get('created')
                },
                'aiAnalysis': symptom_data.get('prediction', {}),
                'highestConfidenceAilment': highest_confidence_ailment,
                'reportGeneratedAt': firestore.SERVER_TIMESTAMP,
                'reportId': f"HR_{user_id}_{int(time.time())}"
            }
        except Exception as e:
            return jsonify({'error': f'Error creating report data: {str(e)}'}), 500
        
        # Save the health report
        try:
            # Use symptomId as the document ID for healthReports
            report_ref = db.collection('healthReports').document(symptom_id)
            existing_report = report_ref.get()
            if existing_report.exists:
                print(f"Health report for symptomId {symptom_id} already exists. Returning existing report.")
                return jsonify({
                    'message': 'Health report already exists',
                    'reportId': symptom_id,
                    'existing': True
                })
            print(f"Creating new health report for symptomId {symptom_id}")
            report_ref.set(report_data)
        except Exception as e:
            return jsonify({'error': f'Error saving health report: {str(e)}'}), 500
        
        return jsonify({
            'message': 'Health report generated successfully',
            'reportId': symptom_id,
            'existing': False
        })
        
    except Exception as e:
        return jsonify({'error': f'Unexpected error in generate_health_report: {str(e)}'}), 500

@app.route('/api/book-appointment', methods=['POST'])
def book_appointment():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        symptom_id = data.get('symptomId')
        preferred_date = data.get('preferredDate')
        preferred_time = data.get('preferredTime')
        urgency = data.get('urgency', 'medium')
        notes = data.get('notes', '')
        
        if not user_id or not symptom_id:
            return jsonify({'error': 'User ID and Symptom ID required'}), 400

        db = firestore.client()
        
        # Get user information
        try:
            user_doc = db.collection('users').document(user_id).get()
            user_info = {}
            if user_doc.exists:
                user_info = user_doc.to_dict()
        except Exception as e:
            return jsonify({'error': f'Error accessing user record: {str(e)}'}), 500
            
        # Get symptom information
        try:
            symptom_doc = db.collection('userSymptoms').document(symptom_id).get()
            if not symptom_doc.exists:
                return jsonify({'error': 'Symptom record not found'}), 404
                
            symptom_data = symptom_doc.to_dict()
        except Exception as e:
            return jsonify({'error': f'Error accessing symptom record: {str(e)}'}), 500
        
        # Create appointment record
        try:
            appointment_data = {
                'userId': user_id,
                'symptomId': symptom_id,
                'patientInfo': {
                    'name': user_info.get('name', 'Unknown'),
                    'email': user_info.get('email', 'Unknown'),
                    'phone': user_info.get('phone', 'Unknown')
                },
                'symptoms': symptom_data.get('symptoms', []),
                'aiAnalysis': symptom_data.get('prediction', {}),
                'preferredDate': preferred_date,
                'preferredTime': preferred_time,
                'urgency': urgency,
                'notes': notes,
                'status': 'pending',
                'createdAt': firestore.SERVER_TIMESTAMP,
                'appointmentId': f"APT_{user_id}_{int(time.time())}"
            }
        except Exception as e:
            return jsonify({'error': f'Error creating appointment data: {str(e)}'}), 500
        
        # Save the appointment
        try:
            appointment_ref = db.collection('appointments').add(appointment_data)
        except Exception as e:
            return jsonify({'error': f'Error saving appointment: {str(e)}'}), 500
        
        return jsonify({
            'message': 'Appointment booked successfully',
            'appointmentId': appointment_ref[1].id,
            'appointmentData': appointment_data
        })
        
    except Exception as e:
        return jsonify({'error': f'Unexpected error in book_appointment: {str(e)}'}), 500

@app.route('/api/appointments/<user_id>', methods=['GET'])
def get_user_appointments(user_id):
    try:
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400

        db = firestore.client()
        
        # Get user's appointments
        appointments_query = db.collection('appointments').where('userId', '==', user_id).order_by('createdAt', direction=firestore.Query.DESCENDING)
        appointments_docs = appointments_query.stream()
        
        appointments = []
        for doc in appointments_docs:
            data = doc.to_dict()
            appointments.append({
                'id': doc.id,
                'appointmentId': data.get('appointmentId'),
                'patientInfo': data.get('patientInfo', {}),
                'symptoms': data.get('symptoms', []),
                'aiAnalysis': data.get('aiAnalysis', {}),
                'preferredDate': data.get('preferredDate'),
                'preferredTime': data.get('preferredTime'),
                'urgency': data.get('urgency'),
                'notes': data.get('notes'),
                'status': data.get('status'),
                'createdAt': data.get('createdAt')
            })

        return jsonify({'appointments': appointments})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
