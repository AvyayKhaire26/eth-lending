"""
ML API Server for Circadian DeFi Lending
Serves chronotype predictions to smart contracts
Fixed import paths for Windows
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pickle
import tensorflow as tf
import os
import sys

# Fix import paths for Windows
current_dir = os.path.dirname(os.path.abspath(__file__))
ml_services_dir = os.path.dirname(current_dir)
models_dir = os.path.join(ml_services_dir, 'models')
project_root = os.path.dirname(ml_services_dir)

# Add paths to sys.path
sys.path.insert(0, models_dir)
sys.path.insert(0, ml_services_dir)

# Import after path setup
try:
    import circadian_autoencoder
    import pattern_recognizer
    print("✅ Imports successful")
except Exception as e:
    print(f"❌ Import error: {e}")

app = Flask(__name__)
CORS(app)

class MLPredictor:
    def __init__(self):
        self.autoencoder = None
        self.classifier_model = None
        self.classifier_scaler = None
        self.models_loaded = False
        self.load_models()
    
    def load_models(self):
        """Load trained ML models"""
        try:
            print("🧠 Loading ML models...")
            
            # Load autoencoder
            self.autoencoder = circadian_autoencoder.CircadianAutoencoder()
            if self.autoencoder.load_model():
                print("✅ Autoencoder loaded successfully")
            else:
                print("⚠️ Autoencoder not loaded")
            
            # Load classifier
            classifier_path = os.path.join(models_dir, "trained", "chronotype_classifier.keras")
            scaler_path = os.path.join(models_dir, "trained", "chronotype_scaler.pkl")
            
            if os.path.exists(classifier_path) and os.path.exists(scaler_path):
                self.classifier_model = tf.keras.models.load_model(classifier_path)
                with open(scaler_path, 'rb') as f:
                    self.classifier_scaler = pickle.load(f)
                print("✅ Classifier loaded successfully")
                self.models_loaded = True
            else:
                print(f"❌ Classifier files not found:")
                print(f"   {classifier_path}")
                print(f"   {scaler_path}")
                
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            self.models_loaded = False
    
    def predict_chronotype(self, activity_pattern):
        """Predict user chronotype from activity pattern"""
        if not self.models_loaded:
            return {"error": "Models not loaded", "chronotype": 1, "success": False}
        
        try:
            # Ensure proper shape
            activity_array = np.array(activity_pattern).reshape(1, -1)
            
            if len(activity_pattern) < 720:
                # Pad with mean value if too short
                mean_val = np.mean(activity_pattern)
                activity_array = np.pad(activity_array, ((0, 0), (0, 720 - len(activity_pattern))), 'constant', constant_values=mean_val)
            elif len(activity_pattern) > 720:
                activity_array = activity_array[:, :720]
            
            # Get autoencoder features
            if self.autoencoder and self.autoencoder.encoder:
                autoencoder_features = self.autoencoder.encode_patterns(activity_array)
            else:
                # Fallback: use first 32 features as dummy autoencoder features
                autoencoder_features = activity_array[:, :32]
            
            # Create engineered features
            engineered_features = self.create_engineered_features(activity_pattern[:24] if len(activity_pattern) >= 24 else activity_pattern)
            
            # Combine features
            combined_features = np.hstack([autoencoder_features, engineered_features.reshape(1, -1)])
            
            # Scale features
            scaled_features = self.classifier_scaler.transform(combined_features)
            
            # Predict
            prediction = self.classifier_model.predict(scaled_features, verbose=0)
            chronotype = int(np.argmax(prediction[0]))
            confidence = float(np.max(prediction[0]))
            
            chronotype_names = ['Early', 'Intermediate', 'Late']
            
            return {
                "chronotype": chronotype,
                "chronotype_name": chronotype_names[chronotype],
                "confidence": confidence,
                "success": True
            }
            
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return {"error": str(e), "chronotype": 1, "success": False}
    
    def create_engineered_features(self, pattern):
        """Create engineered features from activity pattern"""
        if len(pattern) == 0:
            return np.zeros(9)
            
        pattern_24h = pattern[:24] if len(pattern) >= 24 else pattern
        
        if len(pattern_24h) < 24:
            # Pad with mean if less than 24 hours
            mean_val = np.mean(pattern_24h)
            pattern_24h = np.pad(pattern_24h, (0, 24 - len(pattern_24h)), 'constant', constant_values=mean_val)
        
        peak_hour = np.argmax(pattern_24h)
        trough_hour = np.argmin(pattern_24h)
        mean_activity = np.mean(pattern_24h)
        std_activity = np.std(pattern_24h)
        
        morning_activity = np.mean(pattern_24h[6:12])
        evening_activity = np.mean(pattern_24h[18:24])
        night_activity = np.mean(pattern_24h[0:6])
        
        features = [
            peak_hour, trough_hour, mean_activity, std_activity,
            morning_activity, evening_activity, night_activity,
            morning_activity / (evening_activity + 1e-6),
            (peak_hour - 12) / 12
        ]
        
        return np.array(features)

# Initialize predictor
predictor = MLPredictor()

@app.route('/health', methods=['GET'])
def health_check():
    """API health check"""
    return jsonify({
        "status": "healthy",
        "models_loaded": predictor.models_loaded,
        "version": "1.0.0"
    })

@app.route('/predict_chronotype', methods=['POST'])
def predict_chronotype():
    """Predict chronotype from user activity pattern"""
    try:
        data = request.get_json()
        
        if 'activity_pattern' not in data:
            return jsonify({"error": "Missing activity_pattern"}), 400
        
        activity_pattern = data['activity_pattern']
        
        if not isinstance(activity_pattern, list) or len(activity_pattern) == 0:
            return jsonify({"error": "Invalid activity_pattern format"}), 400
        
        result = predictor.predict_chronotype(activity_pattern)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/calculate_circadian_rate', methods=['POST'])
def calculate_circadian_rate():
    """Calculate circadian-adjusted interest rate"""
    try:
        data = request.get_json()
        
        required_fields = ['base_rate', 'current_hour', 'user_activity']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing {field}"}), 400
        
        base_rate = data['base_rate']
        current_hour = data['current_hour']
        user_activity = data['user_activity']
        
        # Get chronotype prediction
        chronotype_result = predictor.predict_chronotype(user_activity)
        
        if not chronotype_result.get('success', False):
            chronotype = 1  # Default to intermediate
            confidence = 0.5
        else:
            chronotype = chronotype_result['chronotype']
            confidence = chronotype_result['confidence']
        
        # Apply circadian multipliers
        hourly_multipliers = {
            2: 8500, 3: 8500, 4: 8500, 5: 8500, 6: 8500,  # Night discount
            9: 11000, 10: 11000, 11: 11000, 12: 11000, 13: 11000,  # Peak premium
            14: 11000, 15: 11000, 16: 11000, 17: 11000,
            22: 9000, 23: 9000, 0: 9000, 1: 9000  # Late night discount
        }
        
        hourly_multiplier = hourly_multipliers.get(current_hour, 10000)
        
        # Chronotype-based adjustments
        chronotype_adjustments = {
            0: 9500,   # Early chronotype bonus
            1: 10000,  # Intermediate standard
            2: 10500   # Late chronotype adjustment
        }
        
        behavior_multiplier = chronotype_adjustments.get(chronotype, 10000)
        
        # Calculate adjusted rate
        adjusted_rate = (base_rate * hourly_multiplier * behavior_multiplier) // (10000 * 10000)
        
        return jsonify({
            "adjusted_rate": int(adjusted_rate),
            "base_rate": base_rate,
            "chronotype": chronotype,
            "chronotype_name": chronotype_result.get('chronotype_name', 'Intermediate'),
            "confidence": confidence,
            "hourly_multiplier": hourly_multiplier,
            "behavior_multiplier": behavior_multiplier,
            "current_hour": current_hour
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint with sample data"""
    try:
        # Create sample activity pattern (24 hours)
        sample_pattern = [0.3, 0.2, 0.1, 0.1, 0.2, 0.4, 0.7, 0.9, 0.8, 0.9, 0.8, 0.7, 
                         0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0.3, 0.3]
        
        result = predictor.predict_chronotype(sample_pattern)
        
        return jsonify({
            "test_result": result,
            "sample_pattern": sample_pattern,
            "status": "Test successful"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Circadian ML API Server...")
    print(f"📁 Models directory: {models_dir}")
    print(f"📊 Models loaded: {predictor.models_loaded}")
    
    if predictor.models_loaded:
        print("✅ Ready to serve predictions!")
    else:
        print("⚠️ Models not loaded - check file paths")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
