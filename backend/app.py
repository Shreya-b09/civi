from flask import Flask, request, jsonify
import torch
from PIL import Image
import io
import cv2
import numpy as np
from flask_cors import CORS
import base64
import sqlite3
import uuid
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Initialize SQLite database with enhanced schema
def init_db():
    conn = sqlite3.connect('complaints.db')
    c = conn.cursor()
    # Drop old table and recreate with new schema
    c.execute('DROP TABLE IF EXISTS complaints')
    c.execute('''CREATE TABLE complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL CHECK(length(phone) = 10),
        user_id TEXT NOT NULL UNIQUE,
        violation_type TEXT NOT NULL CHECK(violation_type IN ('No Parking', 'No Helmet')),
        detection_result TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        image_path TEXT NOT NULL,
        location TEXT,
        description TEXT
    )''')
    conn.commit()
    conn.close()

# Load YOLOv5 model
model = torch.hub.load('./yolov5', 'custom', path='yolov5/runs/train/exp10/weights/best.pt', source='local', force_reload=True)
model.eval()

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    if 'violationType' not in request.form:
        return jsonify({'error': 'No violation type provided'}), 400
    if 'phone' not in request.form:
        return jsonify({'error': 'No phone number provided'}), 400

    file = request.files['image']
    violation_type = request.form['violationType']
    phone = request.form['phone']
    location = request.form.get('location', '')
    description = request.form.get('description', '')

    # Validate phone length
    if len(phone) != 10 or not phone.isdigit():
        return jsonify({'error': 'Invalid phone number'}), 400

    # Generate unique user ID
    user_id = str(uuid.uuid4())

    # Process image
    img_bytes = file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    # Run detection
    results = model(img_cv)
    detections = results.pandas().xyxy[0]

    detected = False
    result = ""
    bounding_boxes = []

    if violation_type == "No Parking":
        no_parking_detections = detections[detections['name'] == 'no_parking']
        count = len(no_parking_detections)
        result = f"Detected {count} 'No Parking' sign(s)" if count > 0 else "No 'No Parking' signs detected"
        detected = count > 0

        for _, row in no_parking_detections.iterrows():
            xmin, ymin, xmax, ymax = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
            confidence = row['confidence']
            cv2.rectangle(img_cv, (xmin, ymin), (xmax, ymax), (0, 255, 0), 2)
            cv2.putText(img_cv, f"No Parking: {confidence:.2f}", (xmin, ymin - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            bounding_boxes.append({'xmin': xmin, 'ymin': ymin, 'xmax': xmax, 'ymax': ymax, 'confidence': float(confidence)})

    elif violation_type == "No Helmet":
        result = "No Helmet detection not yet implemented"
        detected = False
    else:
        return jsonify({'error': 'Invalid violation type'}), 400

    # Save image
    image_path = f"images/{user_id}.jpg"
    cv2.imwrite(image_path, img_cv)

    # Store in database if detected
    if detected:
        conn = sqlite3.connect('complaints.db')
        c = conn.cursor()
        timestamp = datetime.now().isoformat()
        c.execute("INSERT INTO complaints (phone, user_id, violation_type, detection_result, timestamp, image_path, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (phone, user_id, violation_type, result, timestamp, image_path, location, description))
        conn.commit()
        conn.close()

    # Return response
    _, buffer = cv2.imencode('.jpg', img_cv)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return jsonify({
        'result': result,
        'detected': detected,
        'bounding_boxes': bounding_boxes,
        'image': f"data:image/jpeg;base64,{img_base64}"
    })

@app.route('/complaints', methods=['GET'])
def get_complaints():
    conn = sqlite3.connect('complaints.db')
    c = conn.cursor()
    c.execute("SELECT * FROM complaints")
    rows = c.fetchall()
    conn.close()
    return jsonify([{
        'id': r[0], 'phone': r[1], 'user_id': r[2], 'violation_type': r[3],
        'detection_result': r[4], 'timestamp': r[5], 'image_path': r[6],
        'location': r[7], 'description': r[8]
    } for r in rows])

if __name__ == '__main__':
    init_db()
    if not os.path.exists('images'):
        os.makedirs('images')
    app.run(debug=True, host='0.0.0.0', port=5001)