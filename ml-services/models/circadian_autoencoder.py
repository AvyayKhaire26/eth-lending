import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt
import os
import json
from typing import Dict, Tuple, List
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle

class CircadianAutoencoder:
    """
    Autoencoder for learning circadian pattern representations
    """
    
    def __init__(self, input_dim: int = 720, encoding_dim: int = 32):
        """
        Initialize autoencoder
        
        Args:
            input_dim: Input dimension (720 hours = 30 days)
            encoding_dim: Compressed representation size
        """
        self.input_dim = input_dim
        self.encoding_dim = encoding_dim
        self.model = None
        self.encoder = None
        self.decoder = None
        self.scaler = StandardScaler()
        self.history = None
        
    def build_model(self) -> tf.keras.Model:
        """
        Build autoencoder model with fixed dimensions
        """
        # Input layer
        input_layer = tf.keras.layers.Input(shape=(self.input_dim,))
        
        # Encoder (compress circadian patterns)
        encoded = tf.keras.layers.Dense(256, activation='relu', name='encoder_1')(input_layer)
        encoded = tf.keras.layers.Dropout(0.2)(encoded)
        encoded = tf.keras.layers.Dense(128, activation='relu', name='encoder_2')(encoded)
        encoded = tf.keras.layers.Dropout(0.2)(encoded)
        encoded = tf.keras.layers.Dense(64, activation='relu', name='encoder_3')(encoded)
        encoded = tf.keras.layers.Dense(self.encoding_dim, activation='relu', name='bottleneck')(encoded)
        
        # Decoder (reconstruct patterns)
        decoded = tf.keras.layers.Dense(64, activation='relu', name='decoder_1')(encoded)
        decoded = tf.keras.layers.Dense(128, activation='relu', name='decoder_2')(decoded)
        decoded = tf.keras.layers.Dropout(0.2)(decoded)
        decoded = tf.keras.layers.Dense(256, activation='relu', name='decoder_3')(decoded)
        decoded = tf.keras.layers.Dropout(0.2)(decoded)
        decoded = tf.keras.layers.Dense(self.input_dim, activation='sigmoid', name='output')(decoded)
        
        # Create main autoencoder model
        self.model = tf.keras.Model(input_layer, decoded, name='circadian_autoencoder')
        
        # Create separate encoder model
        self.encoder = tf.keras.Model(input_layer, encoded, name='circadian_encoder')
        
        # Create separate decoder model with correct dimensions
        decoder_input = tf.keras.layers.Input(shape=(self.encoding_dim,))
        decoder_x = tf.keras.layers.Dense(64, activation='relu')(decoder_input)
        decoder_x = tf.keras.layers.Dense(128, activation='relu')(decoder_x)
        decoder_x = tf.keras.layers.Dropout(0.2)(decoder_x)
        decoder_x = tf.keras.layers.Dense(256, activation='relu')(decoder_x)
        decoder_x = tf.keras.layers.Dropout(0.2)(decoder_x)
        decoder_output = tf.keras.layers.Dense(self.input_dim, activation='sigmoid')(decoder_x)
        
        self.decoder = tf.keras.Model(decoder_input, decoder_output, name='circadian_decoder')
        
        # Compile model
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        print("🧠 Autoencoder model built successfully!")
        print(f"   Input dimension: {self.input_dim}")
        print(f"   Encoding dimension: {self.encoding_dim}")
        print(f"   Total parameters: {self.model.count_params():,}")
        
        return self.model
    
    def load_training_data(self, data_path: str = "ml-services/test-data/synthetic/ml_features_enhanced.npz") -> Tuple[np.ndarray, np.ndarray]:
        """
        Load generated synthetic data for training
        """
        print(f"📊 Loading training data from: {data_path}")
        
        if not os.path.exists(data_path):
            raise FileNotFoundError(f"Data file not found: {data_path}")
        
        # Load enhanced synthetic data
        data = np.load(data_path, allow_pickle=True)
        
        # Use basic circadian patterns for autoencoder training
        X = data['basic_circadian']  # Shape: (1000, 720)
        chronotype_labels = data['chronotype_labels']  # Shape: (1000,)
        
        print(f"   Data shape: {X.shape}")
        print(f"   Chronotype distribution: {np.bincount(chronotype_labels)}")
        print(f"   Activity range: {X.min():.3f} to {X.max():.3f}")
        
        # Check for any data issues
        if np.any(np.isnan(X)):
            print("⚠️  Warning: NaN values detected, cleaning data...")
            X = np.nan_to_num(X, nan=0.5)
        
        return X, chronotype_labels
    
    def prepare_data(self, X: np.ndarray, test_size: float = 0.2) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Prepare data for training (scaling, splitting)
        """
        print("🔧 Preparing data for training...")
        
        # Normalize data to [0, 1] range
        X_scaled = self.scaler.fit_transform(X)
        
        # Split data
        X_train, X_test = train_test_split(
            X_scaled, 
            test_size=test_size, 
            random_state=42
        )
        
        print(f"   Training samples: {X_train.shape[0]}")
        print(f"   Testing samples: {X_test.shape[0]}")
        print(f"   Feature dimension: {X_train.shape[1]}")
        
        return X_train, X_test, X_train, X_test
    
    def train(self, X_train: np.ndarray, X_test: np.ndarray, 
              epochs: int = 100, batch_size: int = 32, verbose: int = 1) -> Dict:
        """
        Train the autoencoder
        """
        print("🚀 Starting autoencoder training...")
        print(f"   Epochs: {epochs}")
        print(f"   Batch size: {batch_size}")
        
        # Callbacks for training
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=8,
                min_lr=1e-6,
                verbose=1
            )
        ]
        
        # Train model
        self.history = self.model.fit(
            X_train, X_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=(X_test, X_test),
            callbacks=callbacks,
            verbose=verbose
        )
        
        print("✅ Training completed!")
        
        # Calculate final metrics
        train_loss = self.model.evaluate(X_train, X_train, verbose=0)
        test_loss = self.model.evaluate(X_test, X_test, verbose=0)
        
        results = {
            'train_loss': float(train_loss[0]),
            'train_mae': float(train_loss[1]),
            'test_loss': float(test_loss[0]),
            'test_mae': float(test_loss[1]),
            'epochs_trained': len(self.history.history['loss'])
        }
        
        print(f"📊 Final Results:")
        print(f"   Training Loss: {results['train_loss']:.4f}")
        print(f"   Testing Loss: {results['test_loss']:.4f}")
        print(f"   Training MAE: {results['train_mae']:.4f}")
        print(f"   Testing MAE: {results['test_mae']:.4f}")
        
        return results
    
    def encode_patterns(self, X: np.ndarray) -> np.ndarray:
        """
        Extract circadian pattern features using trained encoder
        """
        if self.encoder is None:
            raise ValueError("Model not trained yet. Call build_model() and train() first.")
        
        X_scaled = self.scaler.transform(X)
        encoded_features = self.encoder.predict(X_scaled, verbose=0)
        
        return encoded_features
    
    def decode_patterns(self, encoded_features: np.ndarray) -> np.ndarray:
        """
        Reconstruct circadian patterns from encoded features
        """
        if self.decoder is None:
            raise ValueError("Model not trained yet. Call build_model() and train() first.")
        
        decoded_patterns = self.decoder.predict(encoded_features, verbose=0)
        decoded_patterns_scaled = self.scaler.inverse_transform(decoded_patterns)
        
        return decoded_patterns_scaled
    
    def calculate_reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        """
        Calculate reconstruction error for anomaly detection
        """
        X_scaled = self.scaler.transform(X)
        reconstructed = self.model.predict(X_scaled, verbose=0)
        
        # Mean squared error per sample
        mse_per_sample = np.mean((X_scaled - reconstructed) ** 2, axis=1)
        
        return mse_per_sample
    
    def save_model(self, save_dir: str = "ml-services/models/trained") -> Dict[str, str]:
        """
        Save trained model and scaler
        """
        os.makedirs(save_dir, exist_ok=True)
        
        # Save models
        model_path = os.path.join(save_dir, "circadian_autoencoder.h5")
        encoder_path = os.path.join(save_dir, "circadian_encoder.h5")
        decoder_path = os.path.join(save_dir, "circadian_decoder.h5")
        scaler_path = os.path.join(save_dir, "circadian_scaler.pkl")
        
        self.model.save(model_path)
        self.encoder.save(encoder_path)
        self.decoder.save(decoder_path)
        
        # Save scaler
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        
        # Save model info
        model_info = {
            'input_dim': self.input_dim,
            'encoding_dim': self.encoding_dim,
            'model_path': model_path,
            'encoder_path': encoder_path,
            'decoder_path': decoder_path,
            'scaler_path': scaler_path
        }
        
        info_path = os.path.join(save_dir, "model_info.json")
        with open(info_path, 'w') as f:
            json.dump(model_info, f, indent=2)
        
        print(f"💾 Model saved to: {save_dir}")
        
        return model_info
    
    def load_model(self, save_dir: str = "ml-services/models/trained") -> bool:
        """
        Load trained model and scaler
        """
        info_path = os.path.join(save_dir, "model_info.json")
        
        if not os.path.exists(info_path):
            print(f"❌ Model info not found: {info_path}")
            return False
        
        with open(info_path, 'r') as f:
            model_info = json.load(f)
        
        # Load models
        self.model = tf.keras.models.load_model(model_info['model_path'])
        self.encoder = tf.keras.models.load_model(model_info['encoder_path'])
        self.decoder = tf.keras.models.load_model(model_info['decoder_path'])
        
        # Load scaler
        with open(model_info['scaler_path'], 'rb') as f:
            self.scaler = pickle.load(f)
        
        self.input_dim = model_info['input_dim']
        self.encoding_dim = model_info['encoding_dim']
        
        print(f"✅ Model loaded from: {save_dir}")
        return True
    
    def visualize_results(self, X_test: np.ndarray, n_samples: int = 6) -> None:
        """
        Visualize reconstruction results
        """
        if self.model is None:
            print("❌ Model not trained yet")
            return
        
        # Get random samples
        sample_indices = np.random.choice(len(X_test), n_samples, replace=False)
        samples = X_test[sample_indices]
        
        # Reconstruct patterns
        reconstructed = self.model.predict(self.scaler.transform(samples), verbose=0)
        reconstructed = self.scaler.inverse_transform(reconstructed)
        
        # Plot original vs reconstructed
        fig, axes = plt.subplots(2, 3, figsize=(15, 8))
        fig.suptitle('Circadian Pattern Reconstruction Results', fontsize=16)
        
        for i in range(n_samples):
            row = i // 3
            col = i % 3
            ax = axes[row, col]
            
            # Plot first week (168 hours) for clarity
            hours = np.arange(168)
            original = samples[i][:168]
            reconstructed_sample = reconstructed[i][:168]
            
            ax.plot(hours, original, label='Original', alpha=0.7, linewidth=2)
            ax.plot(hours, reconstructed_sample, label='Reconstructed', alpha=0.7, linewidth=2, linestyle='--')
            
            # Calculate MSE for this sample
            mse = np.mean((samples[i] - reconstructed[i]) ** 2)
            ax.set_title(f'Sample {sample_indices[i]} (MSE: {mse:.4f})')
            ax.set_xlabel('Hours')
            ax.set_ylabel('Activity Level')
            ax.legend()
            ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('ml-services/test-data/synthetic/autoencoder_results.png', dpi=200, bbox_inches='tight')
        plt.show()
        
        print("📊 Visualization saved: ml-services/test-data/synthetic/autoencoder_results.png")

def train_circadian_autoencoder() -> CircadianAutoencoder:
    """
    Main training function
    """
    print("🧠 Starting Circadian Autoencoder Training")
    
    # Initialize autoencoder
    autoencoder = CircadianAutoencoder(input_dim=720, encoding_dim=32)
    
    # Build model
    autoencoder.build_model()
    
    # Load synthetic data
    X, chronotype_labels = autoencoder.load_training_data()
    
    # Prepare data
    X_train, X_test, _, _ = autoencoder.prepare_data(X)
    
    # Train model
    results = autoencoder.train(
        X_train, X_test,
        epochs=50,
        batch_size=16,
        verbose=1
    )
    
    # Save trained model
    model_info = autoencoder.save_model()
    
    # Visualize results
    autoencoder.visualize_results(X_test)
    
    print("🎉 Autoencoder training complete!")
    print(f"📁 Model saved at: {model_info['model_path']}")
    
    return autoencoder

if __name__ == "__main__":
    # Train the autoencoder
    trained_autoencoder = train_circadian_autoencoder()
