"""
Quick validation of generated synthetic data
"""

import numpy as np
import matplotlib.pyplot as plt
import json
import os

def validate_data():
    print("🔍 Validating synthetic circadian data...")
    
    # Load enhanced features
    data_path = "ml-services/test-data/synthetic/ml_features_enhanced.npz"
    if not os.path.exists(data_path):
        print("❌ Enhanced data not found. Please run data generation first.")
        return
    
    data = np.load(data_path, allow_pickle=True)
    
    print("✅ Data loaded successfully!")
    print(f"  Basic circadian shape: {data['basic_circadian'].shape}")
    print(f"  Enhanced features: {data['with_jetlag'].shape}")
    print(f"  Chronotype labels: {data['chronotype_labels'].shape}")
    
    # Validate chronotype distribution
    chronotype_counts = np.bincount(data['chronotype_labels'])
    print(f"  Chronotype distribution: Early={chronotype_counts[0]}, Intermediate={chronotype_counts[1]}, Late={chronotype_counts[2]}")
    
    # Check data quality
    basic_patterns = data['basic_circadian']
    
    print(f"  Activity range: {np.min(basic_patterns):.3f} to {np.max(basic_patterns):.3f}")
    print(f"  Mean activity: {np.mean(basic_patterns):.3f}")
    print(f"  Data completeness: {np.sum(~np.isnan(basic_patterns)) / basic_patterns.size * 100:.1f}%")
    
    # Quick visualization
    plt.figure(figsize=(12, 8))
    
    # Plot sample users from each chronotype
    for i, chronotype in enumerate(['Early', 'Intermediate', 'Late']):
        plt.subplot(2, 2, i+1)
        
        # Find users of this chronotype
        user_indices = np.where(data['chronotype_labels'] == i)[0]
        sample_user = user_indices[0]
        
        # Plot first week (168 hours)
        hours = np.arange(168)
        activity = basic_patterns[sample_user][:168]
        
        plt.plot(hours, activity, label=f'{chronotype} User {sample_user}')
        plt.title(f'Sample {chronotype} Chronotype')
        plt.xlabel('Hours')
        plt.ylabel('Activity Level')
        plt.grid(True, alpha=0.3)
        plt.legend()
    
    # Plot chronotype comparison
    plt.subplot(2, 2, 4)
    for i, (chronotype, color) in enumerate([('Early', 'blue'), ('Intermediate', 'green'), ('Late', 'red')]):
        user_indices = np.where(data['chronotype_labels'] == i)[0]
        
        # Average daily pattern for this chronotype
        daily_patterns = []
        for user_idx in user_indices[:50]:  # Sample 50 users
            user_pattern = basic_patterns[user_idx]
            # Average across days to get typical daily pattern
            daily_pattern = []
            for hour in range(24):
                hour_values = user_pattern[hour::24]  # Every 24th hour
                daily_pattern.append(np.mean(hour_values))
            daily_patterns.append(daily_pattern)
        
        mean_pattern = np.mean(daily_patterns, axis=0)
        std_pattern = np.std(daily_patterns, axis=0)
        
        hours_24 = np.arange(24)
        plt.plot(hours_24, mean_pattern, color=color, label=chronotype, linewidth=2)
        plt.fill_between(hours_24, mean_pattern - std_pattern, mean_pattern + std_pattern, 
                        color=color, alpha=0.2)
    
    plt.title('Average Daily Patterns by Chronotype')
    plt.xlabel('Hour of Day')
    plt.ylabel('Activity Level')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('ml-services/test-data/synthetic/data_validation.png', dpi=200, bbox_inches='tight')
    plt.show()
    
    print("✅ Data validation complete!")
    print("📊 Validation plot saved: ml-services/test-data/synthetic/data_validation.png")
    
    # Load summary
    summary_path = "ml-services/test-data/synthetic/data_summary.json"
    if os.path.exists(summary_path):
        with open(summary_path, 'r') as f:
            summary = json.load(f)
        print("📋 Data Summary:")
        print(f"  Total users: {summary['total_users']}")
        print(f"  Files generated: {len(summary['data_files'])}")
        print(f"  Ready for ML training: ✅")
    
    return True

if __name__ == "__main__":
    validate_data()
