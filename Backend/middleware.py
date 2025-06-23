from firebase_admin import auth
from flask import request, jsonify

def verify_firebase_token(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'message': 'Missing Authorization Header'}), 401

        token = auth_header.replace('Bearer ', '')
        try:
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
        except Exception as e:
            return jsonify({'message': 'Invalid or expired token', 'error': str(e)}), 403

        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper
