"""
Van der Pol Oscillator for Circadian Rhythm Generation
Based on biological circadian clock models
"""

import numpy as np
from scipy.integrate import odeint
import matplotlib.pyplot as plt
import json
from typing import Tuple, List, Dict
import os

class CircadianVanDerPolGenerator:
    """
    Generates realistic circadian oscillations using Van der Pol equation
    Based on: dx/dt = y, dy/dt = μ(1-x²)y - x
    """
    
    def __init__(self, mu: float = 1.0, tau: float = 24.0, noise_level: float = 0.1):
        """
        Initialize Van der Pol oscillator
        
        Args:
            mu: Nonlinearity parameter (0.1-3.0, controls oscillation shape)
            tau: Period in hours (22-26 for individual variation)
            noise_level: Biological noise (0.05-0.2)
        """
        self.mu = mu
        self.tau = tau  # Period in hours
        self.omega = 2 * np.pi / tau  # Angular frequency
        self.noise_level = noise_level
        
    def van_der_pol_equations(self, state: List[float], t: float) -> List[float]:
        """
        Van der Pol differential equations with period adjustment
        """
        x, y = state
        
        # Van der Pol equations with period scaling
        dxdt = self.omega * y
        dydt = self.omega * (self.mu * (1 - x**2) * y - x)
        
        return [dxdt, dydt]
    
    def generate_circadian_oscillation(self, days: int = 30, hours_per_day: int = 24) -> Dict:
        """
        Generate circadian oscillation for specified number of days
        
        Returns:
            Dict with time, activity, and metadata
        """
        # Time array (hours)
        total_hours = days * hours_per_day
        t = np.linspace(0, total_hours, total_hours * 4)  # 15-minute resolution
        
        # Initial conditions (starting at peak activity)
        initial_state = [1.0, 0.0]
        
        # Solve Van der Pol equation
        solution = odeint(self.van_der_pol_equations, initial_state, t)
        
        # Extract activity level (normalized to 0-1)
        activity_raw = solution[:, 0]
        
        # Normalize to physiological range (0.1 to 1.0)
        activity_normalized = (activity_raw - np.min(activity_raw)) / (np.max(activity_raw) - np.min(activity_raw))
        activity_normalized = 0.1 + 0.9 * activity_normalized
        
        # Add biological noise
        noise = np.random.normal(0, self.noise_level, len(activity_normalized))
        activity_with_noise = np.clip(activity_normalized + noise, 0.05, 1.0)
        
        # Create hourly averages for practical use
        hourly_times = []
        hourly_activities = []
        
        for hour in range(total_hours):
            hour_indices = (t >= hour) & (t < hour + 1)
            if np.any(hour_indices):
                hourly_times.append(hour)
                hourly_activities.append(np.mean(activity_with_noise[hour_indices]))
        
        return {
            'time_hours': np.array(hourly_times),
            'activity_level': np.array(hourly_activities),
            'parameters': {
                'mu': self.mu,
                'tau': self.tau,
                'noise_level': self.noise_level,
                'days': days
            },
            'raw_solution': {
                'time': t,
                'x': solution[:, 0],
                'y': solution[:, 1],
                'activity_raw': activity_with_noise
            }
        }

class ChronotypeGenerator:
    """
    Generates different circadian chronotypes based on research
    """
    
    @staticmethod
    def generate_early_chronotype() -> CircadianVanDerPolGenerator:
        """Early chronotype: τ < 24h, morning preference"""
        mu = np.random.uniform(0.8, 1.5)  # Moderate nonlinearity
        tau = np.random.uniform(22.5, 23.8)  # Shorter period
        noise = np.random.uniform(0.05, 0.12)  # Lower noise (more stable)
        return CircadianVanDerPolGenerator(mu, tau, noise)
    
    @staticmethod
    def generate_late_chronotype() -> CircadianVanDerPolGenerator:
        """Late chronotype: τ > 24h, evening preference"""
        mu = np.random.uniform(1.2, 2.5)  # Higher nonlinearity
        tau = np.random.uniform(24.2, 25.5)  # Longer period
        noise = np.random.uniform(0.08, 0.18)  # Higher noise (less stable)
        return CircadianVanDerPolGenerator(mu, tau, noise)
    
    @staticmethod
    def generate_intermediate_chronotype() -> CircadianVanDerPolGenerator:
        """Intermediate chronotype: τ ≈ 24h, flexible"""
        mu = np.random.uniform(0.9, 1.8)  # Medium nonlinearity
        tau = np.random.uniform(23.8, 24.2)  # Near 24-hour period
        noise = np.random.uniform(0.06, 0.15)  # Medium noise
        return CircadianVanDerPolGenerator(mu, tau, noise)

def generate_population_data(n_users: int = 1000, days: int = 30) -> Dict:
    """
    Generate synthetic population with realistic chronotype distribution
    
    Args:
        n_users: Number of synthetic users to generate
        days: Number of days of data per user
        
    Returns:
        Dictionary with all user data and metadata
    """
    print(f"Generating {n_users} synthetic users with {days} days each...")
    
    # Chronotype distribution based on research
    n_early = int(0.25 * n_users)      # 25% early chronotypes
    n_late = int(0.25 * n_users)       # 25% late chronotypes  
    n_intermediate = n_users - n_early - n_late  # 50% intermediate
    
    population_data = {
        'users': {},
        'metadata': {
            'total_users': n_users,
            'days_per_user': days,
            'chronotype_distribution': {
                'early': n_early,
                'late': n_late,
                'intermediate': n_intermediate
            },
            'generation_timestamp': np.datetime64('now').astype(str)
        }
    }
    
    user_id = 0
    
    # Generate early chronotypes
    print(f"Generating {n_early} early chronotypes...")
    for i in range(n_early):
        generator = ChronotypeGenerator.generate_early_chronotype()
        data = generator.generate_circadian_oscillation(days)
        
        population_data['users'][f'user_{user_id:04d}'] = {
            'chronotype': 'early',
            'user_id': user_id,
            **data
        }
        user_id += 1
        
        if i % 50 == 0:
            print(f"  Early chronotypes: {i}/{n_early}")
    
    # Generate late chronotypes
    print(f"Generating {n_late} late chronotypes...")
    for i in range(n_late):
        generator = ChronotypeGenerator.generate_late_chronotype()
        data = generator.generate_circadian_oscillation(days)
        
        population_data['users'][f'user_{user_id:04d}'] = {
            'chronotype': 'late',
            'user_id': user_id,
            **data
        }
        user_id += 1
        
        if i % 50 == 0:
            print(f"  Late chronotypes: {i}/{n_late}")
    
    # Generate intermediate chronotypes
    print(f"Generating {n_intermediate} intermediate chronotypes...")
    for i in range(n_intermediate):
        generator = ChronotypeGenerator.generate_intermediate_chronotype()
        data = generator.generate_circadian_oscillation(days)
        
        population_data['users'][f'user_{user_id:04d}'] = {
            'chronotype': 'intermediate',
            'user_id': user_id,
            **data
        }
        user_id += 1
        
        if i % 100 == 0:
            print(f"  Intermediate chronotypes: {i}/{n_intermediate}")
    
    print(f"✅ Generated {n_users} users successfully!")
    return population_data

def save_population_data(population_data: Dict, output_dir: str = "ml-services/test-data/synthetic"):
    """Save population data in multiple formats for ML training"""
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print("Saving population data...")
    
    # Save complete data as JSON
    json_path = os.path.join(output_dir, "population_data_complete.json")
    with open(json_path, 'w') as f:
        # Convert numpy arrays to lists for JSON serialization
        json_data = {}
        json_data['metadata'] = population_data['metadata']
        json_data['users'] = {}
        
        for user_id, user_data in population_data['users'].items():
            json_data['users'][user_id] = {
                'chronotype': user_data['chronotype'],
                'user_id': user_data['user_id'],
                'time_hours': user_data['time_hours'].tolist(),
                'activity_level': user_data['activity_level'].tolist(),
                'parameters': user_data['parameters']
            }
    
    with open(json_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    # Save ML training format (numpy arrays)
    ml_data = {
        'X': [],  # Features: user activity patterns
        'y': [],  # Labels: chronotype (0=early, 1=intermediate, 2=late)
        'user_ids': [],
        'chronotypes': []
    }
    
    chronotype_map = {'early': 0, 'intermediate': 1, 'late': 2}
    
    for user_id, user_data in population_data['users'].items():
        ml_data['X'].append(user_data['activity_level'])
        ml_data['y'].append(chronotype_map[user_data['chronotype']])
        ml_data['user_ids'].append(user_data['user_id'])
        ml_data['chronotypes'].append(user_data['chronotype'])
    
    # Convert to numpy and save
    ml_data['X'] = np.array(ml_data['X'])  # Shape: (n_users, n_hours)
    ml_data['y'] = np.array(ml_data['y'])
    
    np.savez(os.path.join(output_dir, "ml_training_data.npz"), **ml_data)
    
    print(f"✅ Data saved to {output_dir}")
    print(f"  - Complete data: population_data_complete.json")
    print(f"  - ML training data: ml_training_data.npz")
    print(f"  - Shape: {ml_data['X'].shape} users x hours")

def visualize_sample_users(population_data: Dict, n_samples: int = 9):
    """Visualize sample users from each chronotype"""
    
    fig, axes = plt.subplots(3, 3, figsize=(15, 10))
    fig.suptitle('Sample Circadian Patterns by Chronotype', fontsize=16)
    
    chronotypes = ['early', 'intermediate', 'late']
    colors = ['blue', 'green', 'red']
    
    for i, chronotype in enumerate(chronotypes):
        # Find users of this chronotype
        users_of_type = [
            (user_id, data) for user_id, data in population_data['users'].items()
            if data['chronotype'] == chronotype
        ]
        
        # Sample 3 users
        sampled_users = np.random.choice(len(users_of_type), 3, replace=False)
        
        for j, user_idx in enumerate(sampled_users):
            user_id, user_data = users_of_type[user_idx]
            
            ax = axes[i, j]
            
            # Plot first 7 days (168 hours)
            hours = user_data['time_hours'][:168]
            activity = user_data['activity_level'][:168]
            
            ax.plot(hours, activity, color=colors[i], alpha=0.7, linewidth=1.5)
            ax.set_title(f'{chronotype.title()} User {user_data["user_id"]} (τ={user_data["parameters"]["tau"]:.1f}h)')
            ax.set_xlabel('Hours')
            ax.set_ylabel('Activity Level')
            ax.grid(True, alpha=0.3)
            ax.set_ylim(0, 1)
    
    plt.tight_layout()
    plt.savefig('ml-services/test-data/synthetic/sample_circadian_patterns.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    print("✅ Sample visualization saved!")

if __name__ == "__main__":
    print("🔬 Starting Circadian Data Generation...")
    
    # Generate population data (optimized for your 8GB RAM)
    # 1000 users x 30 days = ~30MB data (well within your limits)
    population_data = generate_population_data(n_users=1000, days=30)
    
    # Save data
    save_population_data(population_data)
    
    # Create visualization
    visualize_sample_users(population_data)
    
    print("🎉 Step 2 Complete! Synthetic circadian data ready for ML training.")
