"""
Synthetic User Pattern Analysis and Enhancement
Adds behavioral factors and environmental influences
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import json
import os

class BehavioralPatternEnhancer:
    """
    Adds realistic behavioral patterns to circadian data
    """
    
    def __init__(self, base_data: Dict):
        self.base_data = base_data
        
    def add_social_jetlag(self, user_data: Dict) -> Dict:
        """
        Add social jetlag (weekday vs weekend patterns)
        """
        activity = user_data['activity_level'].copy()
        time_hours = user_data['time_hours']
        
        # Identify weekdays vs weekends
        for i, hour in enumerate(time_hours):
            day_of_week = (hour // 24) % 7
            hour_of_day = hour % 24
            
            # Weekend shift (Friday night, Saturday, Sunday)
            if day_of_week in [5, 6] or (day_of_week == 4 and hour_of_day >= 18):
                # Shift activity pattern later by 1-3 hours
                shift = np.random.uniform(1, 3)
                phase_shift = int(shift)
                
                # Simple phase shift implementation
                if i + phase_shift < len(activity):
                    activity[i] = activity[i + phase_shift] if i + phase_shift < len(activity) else activity[i]
        
        user_data['activity_level_with_social_jetlag'] = activity
        return user_data
    
    def add_stress_patterns(self, user_data: Dict) -> Dict:
        """
        Add stress-induced circadian disruption
        """
        activity = user_data['activity_level'].copy()
        chronotype = user_data['chronotype']
        
        # Stress affects different chronotypes differently
        stress_factors = {
            'early': 0.05,      # Early types are more stress-resistant
            'intermediate': 0.10,
            'late': 0.15        # Late types more affected by stress
        }
        
        stress_level = stress_factors[chronotype]
        
        # Add random stress events (5-10% of days)
        n_stress_days = int(np.random.uniform(0.05, 0.10) * (len(activity) // 24))
        stress_days = np.random.choice(len(activity) // 24, n_stress_days, replace=False)
        
        for stress_day in stress_days:
            start_hour = stress_day * 24
            end_hour = min(start_hour + 24, len(activity))
            
            # Stress reduces overall activity and increases variability
            for i in range(start_hour, end_hour):
                activity[i] *= (1 - stress_level)
                activity[i] += np.random.normal(0, stress_level * 0.5)
                activity[i] = np.clip(activity[i], 0.05, 1.0)
        
        user_data['activity_level_with_stress'] = activity
        user_data['stress_events'] = stress_days.tolist()
        return user_data
    
    def add_seasonal_variation(self, user_data: Dict) -> Dict:
        """
        Add seasonal affective patterns
        """
        activity = user_data['activity_level'].copy()
        time_hours = user_data['time_hours']
        
        # Seasonal amplitude modulation (stronger in late chronotypes)
        seasonal_strength = {
            'early': 0.05,
            'intermediate': 0.10,
            'late': 0.20
        }[user_data['chronotype']]
        
        for i, hour in enumerate(time_hours):
            # Assume starting in winter (day 0) and progressing through year
            day_of_year = (hour // 24) % 365
            
            # Seasonal modulation (cosine wave, minimum in winter)
            seasonal_factor = 1 + seasonal_strength * np.cos(2 * np.pi * (day_of_year - 80) / 365)
            activity[i] *= seasonal_factor
            activity[i] = np.clip(activity[i], 0.05, 1.0)
        
        user_data['activity_level_with_seasonal'] = activity
        return user_data
    
    def add_travel_jetlag(self, user_data: Dict, n_trips: int = 2) -> Dict:
        """
        Add travel-induced jetlag events
        """
        activity = user_data['activity_level'].copy()
        time_hours = user_data['time_hours']
        total_days = len(time_hours) // 24
        
        # Random travel events
        if n_trips > 0 and total_days > 7:
            trip_days = np.random.choice(
                range(7, total_days - 7), 
                min(n_trips, total_days // 10), 
                replace=False
            )
            
            travel_events = []
            
            for trip_day in trip_days:
                # Time zone change (1-8 hours)
                timezone_shift = np.random.choice([-8, -6, -3, 3, 6, 8])
                
                # Recovery period (3-7 days)
                recovery_days = np.random.randint(3, 8)
                
                travel_events.append({
                    'day': int(trip_day),
                    'timezone_shift': int(timezone_shift),
                    'recovery_days': int(recovery_days)
                })
                
                # Apply jetlag effect
                for recovery_day in range(recovery_days):
                    day_idx = trip_day + recovery_day
                    if day_idx < total_days:
                        start_hour = day_idx * 24
                        end_hour = min(start_hour + 24, len(activity))
                        
                        # Gradual recovery from jetlag
                        recovery_factor = recovery_day / recovery_days
                        shift_strength = abs(timezone_shift) * (1 - recovery_factor) / 8
                        
                        for hour_idx in range(start_hour, end_hour):
                            # Reduce activity and add noise during jetlag
                            activity[hour_idx] *= (1 - shift_strength * 0.3)
                            activity[hour_idx] += np.random.normal(0, shift_strength * 0.2)
                            activity[hour_idx] = np.clip(activity[hour_idx], 0.05, 1.0)
            
            user_data['travel_events'] = travel_events
        else:
            user_data['travel_events'] = []
            
        user_data['activity_level_with_jetlag'] = activity
        return user_data

def enhance_population_data(population_data: Dict) -> Dict:
    """
    Enhance all users with behavioral patterns
    """
    print("🔧 Enhancing population data with behavioral patterns...")
    
    enhancer = BehavioralPatternEnhancer(population_data)
    enhanced_data = population_data.copy()
    
    n_users = len(population_data['users'])
    
    for i, (user_id, user_data) in enumerate(population_data['users'].items()):
        if i % 100 == 0:
            print(f"  Enhancing user {i}/{n_users}")
            
        # Create copy for enhancement
        enhanced_user_data = user_data.copy()
        
        # Apply enhancements
        enhanced_user_data = enhancer.add_social_jetlag(enhanced_user_data)
        enhanced_user_data = enhancer.add_stress_patterns(enhanced_user_data)
        enhanced_user_data = enhancer.add_seasonal_variation(enhanced_user_data)
        enhanced_user_data = enhancer.add_travel_jetlag(enhanced_user_data)
        
        # Store enhanced data
        enhanced_data['users'][user_id] = enhanced_user_data
    
    print("✅ Population enhancement complete!")
    return enhanced_data

def create_ml_features(enhanced_data: Dict) -> Dict:
    """
    Create feature matrices for ML training
    """
    print("🔧 Creating ML feature matrices...")
    
    features = {
        'basic_circadian': [],           # Original circadian pattern
        'with_social_jetlag': [],        # With weekend shifts
        'with_stress': [],               # With stress events
        'with_seasonal': [],             # With seasonal variation
        'with_jetlag': [],               # With travel jetlag
        'chronotype_labels': [],         # Target labels
        'user_metadata': []              # User parameters
    }
    
    chronotype_map = {'early': 0, 'intermediate': 1, 'late': 2}
    
    for user_id, user_data in enhanced_data['users'].items():
        # Basic features
        features['basic_circadian'].append(user_data['activity_level'])
        features['chronotype_labels'].append(chronotype_map[user_data['chronotype']])
        
        # Enhanced features
        features['with_social_jetlag'].append(user_data['activity_level_with_social_jetlag'])
        features['with_stress'].append(user_data['activity_level_with_stress'])
        features['with_seasonal'].append(user_data['activity_level_with_seasonal'])
        features['with_jetlag'].append(user_data['activity_level_with_jetlag'])
        
        # Metadata
        features['user_metadata'].append({
            'user_id': user_data['user_id'],
            'chronotype': user_data['chronotype'],
            'mu': user_data['parameters']['mu'],
            'tau': user_data['parameters']['tau'],
            'noise_level': user_data['parameters']['noise_level'],
            'n_stress_events': len(user_data.get('stress_events', [])),
            'n_travel_events': len(user_data.get('travel_events', []))
        })
    
    # Convert to numpy arrays
    for key in ['basic_circadian', 'with_social_jetlag', 'with_stress', 'with_seasonal', 'with_jetlag']:
        features[key] = np.array(features[key])
    
    features['chronotype_labels'] = np.array(features['chronotype_labels'])
    
    print(f"✅ Feature matrices created!")
    print(f"  Shape: {features['basic_circadian'].shape}")
    print(f"  Chronotype distribution: {np.bincount(features['chronotype_labels'])}")
    
    return features

def save_enhanced_data(enhanced_data: Dict, features: Dict, output_dir: str = "ml-services/test-data/synthetic"):
    """
    Save enhanced data and features
    """
    print(f"💾 Saving enhanced data to {output_dir}...")
    
    # Save enhanced population data
    enhanced_json_path = os.path.join(output_dir, "population_data_enhanced.json")
    
    # Prepare JSON-serializable data
    json_data = {
        'metadata': enhanced_data['metadata'],
        'users': {}
    }
    
    for user_id, user_data in enhanced_data['users'].items():
        json_data['users'][user_id] = {
            'chronotype': user_data['chronotype'],
            'user_id': user_data['user_id'],
            'parameters': user_data['parameters'],
            'time_hours': user_data['time_hours'].tolist(),
            'activity_level': user_data['activity_level'].tolist(),
            'activity_level_with_social_jetlag': user_data['activity_level_with_social_jetlag'].tolist(),
            'activity_level_with_stress': user_data['activity_level_with_stress'].tolist(),
            'activity_level_with_seasonal': user_data['activity_level_with_seasonal'].tolist(),
            'activity_level_with_jetlag': user_data['activity_level_with_jetlag'].tolist(),
            'stress_events': user_data.get('stress_events', []),
            'travel_events': user_data.get('travel_events', [])
        }
    
    with open(enhanced_json_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    # Save ML features
    np.savez(
        os.path.join(output_dir, "ml_features_enhanced.npz"),
        **features
    )
    
    # Save summary statistics
    summary = {
        'total_users': len(enhanced_data['users']),
        'chronotype_distribution': {
            'early': int(np.sum(features['chronotype_labels'] == 0)),
            'intermediate': int(np.sum(features['chronotype_labels'] == 1)),
            'late': int(np.sum(features['chronotype_labels'] == 2))
        },
        'feature_shapes': {key: features[key].shape for key in features if isinstance(features[key], np.ndarray)},
        'data_files': [
            'population_data_enhanced.json',
            'ml_features_enhanced.npz'
        ]
    }
    
    with open(os.path.join(output_dir, "data_summary.json"), 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("✅ Enhanced data saved successfully!")
    print(f"  Files: {len(summary['data_files'])} data files + summary")

if __name__ == "__main__":
    # Load base population data
    with open("ml-services/test-data/synthetic/population_data_complete.json", 'r') as f:
        population_data = json.load(f)
    
    # Convert lists back to numpy arrays
    for user_id, user_data in population_data['users'].items():
        user_data['time_hours'] = np.array(user_data['time_hours'])
        user_data['activity_level'] = np.array(user_data['activity_level'])
    
    print("🔬 Starting behavioral pattern enhancement...")
    
    # Enhance with behavioral patterns
    enhanced_data = enhance_population_data(population_data)
    
    # Create ML features
    features = create_ml_features(enhanced_data)
    
    # Save everything
    save_enhanced_data(enhanced_data, features)
    
    print("🎉 Synthetic user patterns complete!")
