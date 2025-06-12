"""
Chronotype Pattern Recognition for Circadian DeFi Lending
Builds on trained autoencoder for user classification
Complete JSON serialization fix
"""

import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt
import os
import json
import pickle
from typing import Dict, Tuple, List
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.utils import resample
import seaborn as sns
from circadian_autoencoder import CircadianAutoencoder

class ChronotypeClassifier:
    """
    Classifies users into Early/Intermediate/Late chronotypes
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.autoencoder = None
        self.feature_type = None
        self.baseline_models = {}
        self.performance_metrics = {}
        
    def load_data(self, data_path: str = "ml-services/test-data/synthetic/ml_features_enhanced.npz") -> Tuple[np.ndarray, np.ndarray]:
        """
        Load synthetic circadian data
        """
        print("📊 Loading circadian data for classification...")
        
        if not os.path.exists(data_path):
            raise FileNotFoundError(f"Data file not found: {data_path}")
        
        data = np.load(data_path, allow_pickle=True)
        
        X = data['basic_circadian']
        y = data['chronotype_labels']
        
        if np.any(np.isnan(X)):
            X = np.nan_to_num(X, nan=0.5)
        
        print(f"   Data shape: {X.shape}")
        print(f"   Chronotype distribution: {np.bincount(y)}")
        
        return X, y
    
    def extract_autoencoder_features(self, X: np.ndarray) -> np.ndarray:
        """
        Extract features using trained autoencoder
        """
        print("🧠 Extracting autoencoder features...")
        
        self.autoencoder = CircadianAutoencoder()
        
        if self.autoencoder.load_model():
            encoded_features = self.autoencoder.encode_patterns(X)
            print(f"   Encoded features shape: {encoded_features.shape}")
            self.feature_type = "autoencoder"
            return encoded_features
        else:
            print("⚠️  Autoencoder not found, using raw features")
            self.feature_type = "raw"
            return X
    
    def create_time_based_features(self, X: np.ndarray) -> np.ndarray:
        """
        Create engineered features from circadian patterns
        """
        print("🔧 Creating time-based features...")
        
        features = []
        
        for i, pattern in enumerate(X):
            user_features = []
            
            pattern_24h = pattern[:24] if len(pattern) >= 24 else pattern
            
            peak_hour = np.argmax(pattern_24h)
            trough_hour = np.argmin(pattern_24h)
            mean_activity = np.mean(pattern_24h)
            std_activity = np.std(pattern_24h)
            
            morning_activity = np.mean(pattern_24h[6:12])
            evening_activity = np.mean(pattern_24h[18:24])
            night_activity = np.mean(pattern_24h[0:6])
            
            user_features.extend([
                peak_hour, trough_hour, mean_activity, std_activity,
                morning_activity, evening_activity, night_activity,
                morning_activity / (evening_activity + 1e-6),
                (peak_hour - 12) / 12
            ])
            
            features.append(user_features)
        
        engineered_features = np.array(features)
        print(f"   Engineered features shape: {engineered_features.shape}")
        
        return engineered_features
    
    def prepare_data(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Tuple:
        """
        Prepare data for training with multiple feature types
        """
        print("🔧 Preparing classification data...")
        
        autoencoder_features = self.extract_autoencoder_features(X)
        engineered_features = self.create_time_based_features(X)
        
        if self.feature_type == "autoencoder":
            combined_features = np.hstack([autoencoder_features, engineered_features])
        else:
            combined_features = engineered_features
        
        X_scaled = self.scaler.fit_transform(combined_features)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=test_size, random_state=42, stratify=y
        )
        
        print(f"   Training samples: {X_train.shape[0]}")
        print(f"   Testing samples: {X_test.shape[0]}")
        print(f"   Feature dimension: {X_train.shape[1]}")
        
        return X_train, X_test, y_train, y_test, combined_features
    
    def build_neural_classifier(self, input_dim: int) -> tf.keras.Model:
        """
        Build neural network classifier
        """
        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(64, activation='relu'),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation='relu'),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(16, activation='relu'),
            tf.keras.layers.Dense(3, activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def train_baseline_models(self, X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """
        Train baseline comparison models
        """
        print("📊 Training baseline models...")
        
        models = {
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Logistic Regression': LogisticRegression(random_state=42, max_iter=2000)
        }
        
        results = {}
        
        for name, model in models.items():
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            
            results[name] = {
                'model': model,
                'accuracy': accuracy,
                'predictions': y_pred
            }
            
            print(f"   {name}: {accuracy:.4f}")
        
        self.baseline_models = results
        return results
    
    def train_neural_classifier(self, X_train: np.ndarray, y_train: np.ndarray, 
                               X_test: np.ndarray, y_test: np.ndarray, 
                               epochs: int = 100, batch_size: int = 16) -> Dict:
        """
        Train neural network classifier
        """
        print("🚀 Training neural chronotype classifier...")
        
        self.model = self.build_neural_classifier(X_train.shape[1])
        
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_accuracy',
                patience=15,
                restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=8,
                min_lr=1e-6
            )
        ]
        
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        
        train_accuracy = history.history['accuracy'][-1]
        val_accuracy = history.history['val_accuracy'][-1]
        
        y_pred = self.model.predict(X_test, verbose=0)
        y_pred_classes = np.argmax(y_pred, axis=1)
        test_accuracy = accuracy_score(y_test, y_pred_classes)
        
        results = {
            'train_accuracy': float(train_accuracy),
            'val_accuracy': float(val_accuracy),
            'test_accuracy': float(test_accuracy),
            'predictions': y_pred_classes.tolist()
        }
        
        print(f"📊 Neural Network Results:")
        print(f"   Training Accuracy: {train_accuracy:.4f}")
        print(f"   Validation Accuracy: {val_accuracy:.4f}")
        print(f"   Test Accuracy: {test_accuracy:.4f}")
        
        return results
    
    def cross_validate_performance(self, X: np.ndarray, y: np.ndarray, cv_folds: int = 5) -> Dict:
        """
        Perform cross-validation for robust performance estimation
        """
        print("🔄 Performing cross-validation...")
        
        cv_results = {}
        skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
        
        for name, baseline_result in self.baseline_models.items():
            model = baseline_result['model']
            scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy')
            cv_results[name] = {
                'mean_accuracy': float(np.mean(scores)),
                'std_accuracy': float(np.std(scores)),
                'scores': [float(s) for s in scores]
            }
            print(f"   {name}: {np.mean(scores):.4f} ± {np.std(scores):.4f}")
        
        return cv_results
    
    def statistical_validation(self, y_true: np.ndarray, X_features: np.ndarray) -> Dict:
        """
        Perform statistical tests for chronotype separation
        """
        print("📊 Statistical validation of chronotype separation...")
        
        from scipy import stats
        
        validation_results = {}
        
        chronotype_names = ['Early', 'Intermediate', 'Late']
        
        for i in range(X_features.shape[1]):
            feature_values = [X_features[y_true == j, i] for j in range(3)]
            
            try:
                f_stat, p_value = stats.f_oneway(*feature_values)
                validation_results[f'feature_{i}'] = {
                    'f_statistic': float(f_stat),
                    'p_value': float(p_value),
                    'significant': bool(p_value < 0.05)
                }
            except:
                validation_results[f'feature_{i}'] = {
                    'f_statistic': 0.0,
                    'p_value': 1.0,
                    'significant': False
                }
        
        significant_features = sum(1 for v in validation_results.values() if v['significant'])
        total_features = len(validation_results)
        
        print(f"   Significant features: {significant_features}/{total_features}")
        print(f"   Percentage significant: {significant_features/total_features*100:.1f}%")
        
        return validation_results
    
    def generate_performance_report(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """
        Generate comprehensive performance report
        """
        print("📋 Generating performance report...")
        
        report = {
            'chronotype_names': ['Early', 'Intermediate', 'Late'],
            'class_distribution': [int(x) for x in np.bincount(y_test)],
            'models': {}
        }
        
        if self.model is not None:
            y_pred_nn = self.model.predict(X_test, verbose=0)
            y_pred_nn_classes = np.argmax(y_pred_nn, axis=1)
            
            cr_nn = classification_report(y_test, y_pred_nn_classes, output_dict=True)
            cm_nn = confusion_matrix(y_test, y_pred_nn_classes)
            
            report['models']['Neural Network'] = {
                'accuracy': float(accuracy_score(y_test, y_pred_nn_classes)),
                'classification_report': self.convert_classification_report(cr_nn),
                'confusion_matrix': [[int(x) for x in row] for row in cm_nn]
            }
        
        for name, baseline_result in self.baseline_models.items():
            y_pred = baseline_result['predictions']
            cr = classification_report(y_test, y_pred, output_dict=True)
            cm = confusion_matrix(y_test, y_pred)
            
            report['models'][name] = {
                'accuracy': float(accuracy_score(y_test, y_pred)),
                'classification_report': self.convert_classification_report(cr),
                'confusion_matrix': [[int(x) for x in row] for row in cm]
            }
        
        return report
    
    def convert_classification_report(self, cr_dict: Dict) -> Dict:
        """
        Convert classification report to JSON-serializable format
        """
        converted = {}
        for key, value in cr_dict.items():
            if isinstance(value, dict):
                converted[key] = {k: float(v) for k, v in value.items()}
            else:
                converted[key] = float(value)
        return converted
    
    def visualize_results(self, performance_report: Dict, save_path: str = "ml-services/test-data/synthetic") -> None:
        """
        Create visualizations of classification results
        """
        print("📊 Creating result visualizations...")
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Chronotype Classification Results', fontsize=16)
        
        model_names = list(performance_report['models'].keys())
        accuracies = [performance_report['models'][name]['accuracy'] for name in model_names]
        
        axes[0, 0].bar(model_names, accuracies, color=['skyblue', 'lightgreen', 'salmon'])
        axes[0, 0].set_title('Model Accuracy Comparison')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].set_ylim(0, 1)
        for i, acc in enumerate(accuracies):
            axes[0, 0].text(i, acc + 0.01, f'{acc:.3f}', ha='center')
        
        chronotype_dist = performance_report['class_distribution']
        axes[0, 1].pie(chronotype_dist, labels=performance_report['chronotype_names'], autopct='%1.1f%%')
        axes[0, 1].set_title('Test Set Chronotype Distribution')
        
        if 'Neural Network' in performance_report['models']:
            cm = np.array(performance_report['models']['Neural Network']['confusion_matrix'])
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                       xticklabels=performance_report['chronotype_names'],
                       yticklabels=performance_report['chronotype_names'],
                       ax=axes[1, 0])
            axes[1, 0].set_title('Neural Network Confusion Matrix')
            axes[1, 0].set_xlabel('Predicted')
            axes[1, 0].set_ylabel('Actual')
        
        precision_scores = []
        recall_scores = []
        for name in model_names:
            cr = performance_report['models'][name]['classification_report']
            precision_scores.append(cr['macro avg']['precision'])
            recall_scores.append(cr['macro avg']['recall'])
        
        x = np.arange(len(model_names))
        width = 0.35
        axes[1, 1].bar(x - width/2, precision_scores, width, label='Precision', alpha=0.8)
        axes[1, 1].bar(x + width/2, recall_scores, width, label='Recall', alpha=0.8)
        axes[1, 1].set_xlabel('Models')
        axes[1, 1].set_ylabel('Score')
        axes[1, 1].set_title('Precision & Recall Comparison')
        axes[1, 1].set_xticks(x)
        axes[1, 1].set_xticklabels(model_names)
        axes[1, 1].legend()
        axes[1, 1].set_ylim(0, 1)
        
        plt.tight_layout()
        plt.savefig(f'{save_path}/chronotype_classification_results.png', dpi=200, bbox_inches='tight')
        plt.show()
        
        print(f"📊 Visualization saved: {save_path}/chronotype_classification_results.png")
    
    def save_model(self, save_dir: str = "ml-services/models/trained") -> Dict[str, str]:
        """
        Save trained models and metadata with proper JSON serialization
        """
        os.makedirs(save_dir, exist_ok=True)
        
        model_paths = {}
        
        if self.model is not None:
            nn_path = os.path.join(save_dir, "chronotype_classifier.keras")
            self.model.save(nn_path)
            model_paths['neural_network'] = nn_path
        
        scaler_path = os.path.join(save_dir, "chronotype_scaler.pkl")
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        model_paths['scaler'] = scaler_path
        
        for name, result in self.baseline_models.items():
            model_path = os.path.join(save_dir, f"chronotype_{name.lower().replace(' ', '_')}.pkl")
            with open(model_path, 'wb') as f:
                pickle.dump(result['model'], f)
            model_paths[name.lower().replace(' ', '_')] = model_path
        
        json_safe_metrics = {}
        if hasattr(self, 'performance_metrics') and self.performance_metrics:
            for key, value in self.performance_metrics.items():
                if key == 'baseline_models':
                    json_safe_metrics[key] = {
                        name: {
                            'accuracy': float(result['accuracy']),
                            'predictions': [int(p) for p in result['predictions']]
                        }
                        for name, result in value.items()
                    }
                else:
                    json_safe_metrics[key] = value
        
        metadata = {
            'feature_type': self.feature_type,
            'model_paths': model_paths,
            'performance_metrics': json_safe_metrics
        }
        
        metadata_path = os.path.join(save_dir, "chronotype_models_info.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"💾 Models saved to: {save_dir}")
        return model_paths

def train_chronotype_classifier() -> ChronotypeClassifier:
    """
    Main training function for chronotype classification
    """
    print("🧠 Starting Chronotype Classification Training")
    
    classifier = ChronotypeClassifier()
    
    X, y = classifier.load_data()
    
    X_train, X_test, y_train, y_test, X_features = classifier.prepare_data(X, y)
    
    baseline_results = classifier.train_baseline_models(X_train, y_train, X_test, y_test)
    
    neural_results = classifier.train_neural_classifier(X_train, y_train, X_test, y_test, epochs=50, batch_size=16)
    
    cv_results = classifier.cross_validate_performance(X_features, y, cv_folds=5)
    
    statistical_results = classifier.statistical_validation(y, X_features)
    
    performance_report = classifier.generate_performance_report(X_test, y_test)
    
    classifier.visualize_results(performance_report)
    
    classifier.performance_metrics = {
        'neural_network': neural_results,
        'baseline_models': baseline_results,
        'cross_validation': cv_results,
        'statistical_validation': statistical_results,
        'performance_report': performance_report
    }
    
    classifier.save_model()
    
    print("🎉 Chronotype classification training complete!")
    print(f"📊 Best accuracy: {max([performance_report['models'][name]['accuracy'] for name in performance_report['models']]):.4f}")
    
    return classifier

if __name__ == "__main__":
    trained_classifier = train_chronotype_classifier()
