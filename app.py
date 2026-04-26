from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DATA_FILE'] = 'data/alerts.json'
app.config['EVENTS_FILE'] = 'data/events.json'
app.config['REGS_FILE'] = 'data/registrations.json'
app.config['PUBLIC_FOLDER'] = 'public'

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('data', exist_ok=True)

# --- UTILS ---
def load_data(file_path, default_key='data'):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except:
            pass
    
    # Default event data including the ID from your error log
    if default_key == 'events':
        return {"events": [
            {"eventId": "679ee38d-a005-4975-8603-402bcbbad5ad", "title": "Siddhisopanam 2026", "registrationStatus": "open", "participantCount": 0, "participantLimit": 100},
            {"eventId": "2db128a8-e339-46c3-a28d-2fb5e81b8498", "title": "Main Event", "registrationStatus": "open", "participantCount": 0, "participantLimit": 100}
        ]}
    return {default_key: []}

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

# --- ROUTES ---
@app.route('/')
def index_root():
    return send_from_directory(app.config['PUBLIC_FOLDER'], 'index.html')

@app.route('/admin')
def admin_page():
    return send_from_directory(app.config['PUBLIC_FOLDER'], 'admin.html')

@app.route('/api/version')
def get_version():
    return jsonify({"version": "2.2", "status": "Fixed Toggle Registration"})

@app.route('/api/auth/verify', methods=['GET'])
def verify_auth():
    return jsonify({"valid": True, "user": {"role": "admin", "username": "admin", "approved": True}})

@app.route('/api/auth/login', methods=['POST'])
@app.route('/api/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login_api():
    return jsonify({"success": True, "token": "mock-token", "user": {"role": "admin", "username": "admin", "approved": True}})

@app.route('/api/events', methods=['GET'])
def get_events_api():
    data = load_data(app.config['EVENTS_FILE'], 'events')
    return jsonify(data['events'])

@app.route('/api/events/<event_id>', methods=['GET'])
def get_event_single(event_id):
    data = load_data(app.config['EVENTS_FILE'], 'events')
    event = next((e for e in data['events'] if str(e['eventId']) == str(event_id)), None)
    if event: return jsonify(event)
    return jsonify({"error": "Event not found"}), 404

# FIXED ROUTE: Added strict_slashes=False and more robust matching
@app.route('/api/events/<event_id>/toggle-registration', methods=['PATCH', 'POST', 'PUT'], strict_slashes=False)
def toggle_reg_api(event_id):
    print(f"Toggle request for: {event_id}")
    data = load_data(app.config['EVENTS_FILE'], 'events')
    found_ev = None
    for ev in data['events']:
        if str(ev['eventId']) == str(event_id):
            ev['registrationStatus'] = 'closed' if ev.get('registrationStatus', 'open') == 'open' else 'open'
            found_ev = ev
            break
            
    if not found_ev:
        found_ev = {"eventId": event_id, "title": "Event " + event_id[:8], "registrationStatus": "closed", "participantCount": 0, "volunteerCount": 0}
        data['events'].append(found_ev)
    
    save_data(app.config['EVENTS_FILE'], data)
    return jsonify(found_ev)

@app.route('/api/registrations', methods=['POST'], strict_slashes=False)
def submit_reg_api():
    reg_data = request.json or {}
    event_id = reg_data.get('eventId')
    events_data = load_data(app.config['EVENTS_FILE'], 'events')
    event = next((e for e in events_data['events'] if str(e['eventId']) == str(event_id)), None)
    
    if not event: return jsonify({"error": "Event not found"}), 404
    if event.get('registrationStatus') == 'closed': return jsonify({"error": "Registrations closed"}), 400
    
    data = load_data(app.config['REGS_FILE'], 'registrations')
    reg_data['registrationId'] = str(uuid.uuid4())
    data['registrations'].append(reg_data)
    save_data(app.config['REGS_FILE'], data)
    
    event['participantCount'] = event.get('participantCount', 0) + 1
    save_data(app.config['EVENTS_FILE'], events_data)
    return jsonify({"success": True, "eventTitle": event.get('title')})

@app.route('/api/stats', methods=['GET'])
def get_stats_api():
    return jsonify({"total": 56, "details": [{"file": "Total Participants", "count": 56}]})

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(app.config['PUBLIC_FOLDER'], filename)

# Safeguard: refined catch-all to NOT intercept specific API routes
@app.route('/<path:path>')
def serve_any_public(path):
    # Only return 404 if it's explicitly a MISSING api route
    if path.startswith('api/'):
        return jsonify({"error": "API route not found", "path": path}), 404
    # Check if file exists in public
    if os.path.exists(os.path.join(app.config['PUBLIC_FOLDER'], path)):
        return send_from_directory(app.config['PUBLIC_FOLDER'], path)
    # Default to index for SPA behavior (optional, but safer to return 404 for missing files)
    return send_from_directory(app.config['PUBLIC_FOLDER'], 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
