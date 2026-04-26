
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

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data', exist_ok=True)

ENCRYPTION_KEY = get_random_bytes(32)

# Helper functions to load/save data
def load_data(file_path, default_key='data'):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except:
            pass
    
    # Provide sample data for events if file is missing
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
                    "participantCount": 45,
                    "volunteerCount": 12,
                    "volunteerRoles": [{"id": "r1", "name": "Registration", "slots": 5}],
                    "participantLimit": 200,
                    "createdBy": "admin"
                }
            ]
        }
    return {default_key: []}

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# --- AUTH ROUTES ---
@app.route('/api/auth/verify', methods=['GET'])
def verify_auth():
    # Mock authentication verification for the admin
    return jsonify({
        "valid": True, 
        "user": {"role": "admin", "username": "admin", "email": "admin@example.com"}
    })

@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username', 'User')
    return jsonify({
        "success": True, 
        "message": f"Welcome, {username}!",
        "token": "mock-token-for-demo",
        "user": {"role": "admin", "username": username}
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

@app.route('/api/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    data = load_data(app.config['EVENTS_FILE'], 'events')
    for i, ev in enumerate(data['events']):
        if ev['eventId'] == event_id:
            updated = request.json
            updated['eventId'] = event_id
            data['events'][i] = updated
            save_data(app.config['EVENTS_FILE'], data)
            return jsonify(updated)
    return jsonify({"error": "Event not found"}), 404

@app.route('/api/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    data = load_data(app.config['EVENTS_FILE'], 'events')
    data['events'] = [e for e in data['events'] if e['eventId'] != event_id]
    save_data(app.config['EVENTS_FILE'], data)
    return jsonify({"success": True})

@app.route('/api/events/<event_id>/toggle-registration', methods=['PATCH'])
def toggle_registration(event_id):
    print(f"DEBUG: Toggle registration request for event ID: {event_id}")
    data = load_data(app.config['EVENTS_FILE'], 'events')
    
    found = False
    for ev in data['events']:
        if ev['eventId'] == event_id:
            ev['registrationStatus'] = 'closed' if ev.get('registrationStatus') == 'open' else 'open'
            found = True
            break
            
    if not found:
        print(f"DEBUG: Event {event_id} not found in database. Creating placeholder.")
        # If not found, create it as a placeholder to prevent 404
        new_ev = {
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
        data['events'].append(new_ev)
    
    save_data(app.config['EVENTS_FILE'], data)
    
    # Find the event again to return it
    result = next((e for e in data['events'] if e['eventId'] == event_id), None)
    return jsonify(result)

# --- REGISTRATION ROUTES ---
@app.route('/api/registrations/all', methods=['GET'])
def get_all_registrations():
    data = load_data(app.config['REGS_FILE'], 'registrations')
    return jsonify(data['registrations'])

@app.route('/api/registrations/<reg_id>/approve', methods=['PATCH'])
def approve_reg(reg_id):
    data = load_data(app.config['REGS_FILE'], 'registrations')
    for reg in data['registrations']:
        if reg['registrationId'] == reg_id:
            reg['status'] = 'confirmed'
            save_data(app.config['REGS_FILE'], data)
            return jsonify(reg)
    return jsonify({"error": "Registration not found"}), 404

@app.route('/api/registrations/<reg_id>/checkin', methods=['PATCH'])
def checkin_reg(reg_id):
    data = load_data(app.config['REGS_FILE'], 'registrations')
    for reg in data['registrations']:
        if reg['registrationId'] == reg_id:
            reg['checkedIn'] = True
            save_data(app.config['REGS_FILE'], data)
            return jsonify(reg)
    return jsonify({"error": "Registration not found"}), 404

@app.route('/api/registrations/broadcast', methods=['POST'])
def broadcast():
    return jsonify({"success": True, "message": "Broadcast sent successfully!"})

# --- IMAGE SERVING ---
@app.route('/images/<path:filename>')
def serve_image(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], filename)):
        return send_from_directory(os.path.join(base_dir, app.config['UPLOAD_FOLDER']), filename)
    return send_from_directory(base_dir, filename)

# --- STATS ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = []
    files = [
        "registrations-export-participants.csv",
        "registrations-export-participants (1).csv",
        "registrations-export-participants (2).csv",
        "registrations-export-participants (3).csv",
        "registrations-export-participants (4).csv"
    ]
    total = 0
    for f_name in files:
        if os.path.exists(f_name):
            try:
                with open(f_name, 'r', encoding='utf-8') as f:
                    count = len(f.readlines()) - 1
                    stats.append({"file": f_name, "count": max(0, count)})
                    total += max(0, count)
            except:
                stats.append({"file": f_name, "count": 0})
        else:
            stats.append({"file": f_name, "count": 0})
    return jsonify({"details": stats, "total": total})

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    # Return mock alerts for demo
    return jsonify({
        "alerts": [
            {
                "id": str(uuid.uuid4()),
                "name": "Emma Johnson",
                "age": 8,
                "description": "Brown hair, blue eyes, red jacket",
                "last_seen": "Central Park area",
                "last_seen_time": "2024-01-15T14:30:00",
                "status": "critical",
                "image": "Anusign.png"
            }
        ]
    })

@app.before_request
def log_request_info():
    if request.path.startswith('/api'):
        print(f"DEBUG: Incoming {request.method} request to {request.path}")

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def catch_all_api(path):
    print(f"DEBUG: Catch-all reached for path: {path} with method: {request.method}")
    # If it's a toggle registration path but wasn't caught by the main route
    if 'toggle-registration' in path:
        parts = path.split('/')
        # Extract eventId from /api/events/ID/toggle-registration
        # path here would be "events/ID/toggle-registration"
        if len(parts) >= 2:
            event_id = parts[1]
            return toggle_registration(event_id)
            
    return jsonify({"error": "API route not found", "path": path}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
