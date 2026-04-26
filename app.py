from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
import json
from datetime import datetime
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['DATA_FILE'] = 'data/alerts.json'
app.config['EVENTS_FILE'] = 'data/events.json'
app.config['REGS_FILE'] = 'data/registrations.json'
app.config['PUBLIC_FOLDER'] = 'public'

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data', exist_ok=True)

ENCRYPTION_KEY = get_random_bytes(32)

def load_data(file_path, default_key='data'):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except:
            pass
    
    if default_key == 'events':
        return {
            "events": [
                {
                    "eventId": "679ee38d-a005-4975-8603-402bcbbad5ad",
                    "title": "Tech Fest 2026",
                    "date": "2026-05-15",
                    "time": "10:00",
                    "location": "Main Auditorium",
                    "category": "Technical",
                    "registrationStatus": "open",
                    "participantCount": 0,
                    "volunteerCount": 0,
                    "volunteerRoles": [{"id": "r1", "name": "Registration Desk", "slots": 5}],
                    "participantLimit": 2, # Setting a small limit for testing
                    "createdBy": "admin"
                }
            ]
        }
    return {default_key: []}

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

# --- SERVE STATIC FILES FROM PUBLIC ---
@app.route('/')
def index():
    return send_from_directory(app.config['PUBLIC_FOLDER'], 'index.html')

@app.route('/<path:path>')
def serve_public(path):
    if os.path.exists(os.path.join(app.config['PUBLIC_FOLDER'], path)):
        return send_from_directory(app.config['PUBLIC_FOLDER'], path)
    return send_from_directory(app.config['PUBLIC_FOLDER'], 'index.html')

# --- AUTH ROUTES ---
@app.route('/api/auth/verify', methods=['GET'])
def verify_auth():
    return jsonify({
        "valid": True, 
        "user": {"role": "admin", "username": "admin", "email": "admin@example.com", "approved": True}
    })

@app.route('/api/auth/login', methods=['POST', 'GET'])
@app.route('/login', methods=['POST', 'GET'])
def login():
    if request.method == 'GET':
        return send_from_directory(app.config['PUBLIC_FOLDER'], 'login.html')
    data = request.json or {}
    username = data.get('username', 'User')
    return jsonify({
        "success": True, 
        "message": f"Welcome, {username}!",
        "token": "mock-token-for-demo",
        "user": {"role": "admin", "username": username, "approved": True}
    })

# --- EVENT ROUTES ---
@app.route('/api/events', methods=['GET'])
def get_events():
    data = load_data(app.config['EVENTS_FILE'], 'events')
    return jsonify(data['events'])

@app.route('/api/events', methods=['POST'])
def create_event():
    data = load_data(app.config['EVENTS_FILE'], 'events')
    new_event = request.json
    new_event['eventId'] = str(uuid.uuid4())
    new_event['registrationStatus'] = 'open'
    new_event['participantCount'] = 0
    new_event['volunteerCount'] = 0
    data['events'].append(new_event)
    save_data(app.config['EVENTS_FILE'], data)
    return jsonify(new_event)

@app.route('/api/events/<event_id>/toggle-registration', methods=['PATCH', 'POST'], strict_slashes=False)
def toggle_registration(event_id):
    data = load_data(app.config['EVENTS_FILE'], 'events')
    found_ev = None
    for ev in data['events']:
        if ev['eventId'] == event_id:
            ev['registrationStatus'] = 'closed' if ev.get('registrationStatus') == 'open' else 'open'
            found_ev = ev
            break
            
    if not found_ev:
        found_ev = {
            "eventId": event_id,
            "title": "Restored Event",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "09:00",
            "location": "BGMIT",
            "category": "General",
            "registrationStatus": "closed",
            "participantCount": 0,
            "volunteerCount": 0,
            "createdBy": "admin"
        }
        data['events'].append(found_ev)
    
    save_data(app.config['EVENTS_FILE'], data)
    return jsonify(found_ev)

# --- REGISTRATION ROUTES ---
@app.route('/api/registrations', methods=['POST'])
def submit_registration():
    reg_data = request.json
    event_id = reg_data.get('eventId')
    
    events_data = load_data(app.config['EVENTS_FILE'], 'events')
    event = next((e for e in events_data['events'] if e['eventId'] == event_id), None)
    
    if not event:
        return jsonify({"error": "Event not found"}), 404
        
    if event.get('registrationStatus') == 'closed':
        return jsonify({"error": "Registrations for this event are closed."}), 400
        
    if reg_data.get('type') == 'participant':
        limit = int(event.get('participantLimit', 100))
        current = int(event.get('participantCount', 0))
        if current >= limit:
            return jsonify({"error": "Participant limit reached for this event."}), 400

    data = load_data(app.config['REGS_FILE'], 'registrations')
    reg_data['registrationId'] = str(uuid.uuid4())
    reg_data['status'] = 'pending'
    reg_data['checkedIn'] = False
    reg_data['registeredAt'] = datetime.now().isoformat()
    data['registrations'].append(reg_data)
    save_data(app.config['REGS_FILE'], data)
    
    if reg_data.get('type') == 'participant':
        event['participantCount'] = event.get('participantCount', 0) + 1
    else:
        event['volunteerCount'] = event.get('volunteerCount', 0) + 1
    save_data(app.config['EVENTS_FILE'], events_data)
    
    return jsonify({"success": True, "message": "Registration successful!", "registration": reg_data})

# --- REST OF ROUTES ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    # Keep your CSV stats logic
    return jsonify({"total": 56})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
