import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate('serviceAccountKey.json')  # path to your Firebase key
firebase_admin.initialize_app(cred)
