/**
 * MLService.ts
 * Direct ML API communication service for chronotype detection and circadian analytics
 * Handles all interactions with the Python Flask ML server
 */

// ==================== INTERFACES ====================

export interface MLAPIHealth {
  status: 'healthy' | 'unhealthy';
  models_loaded: boolean;
  version: string;
}

export interface ChronotypePrediction {
  chronotype: number; // 0=Early, 1=Intermediate, 2=Late
  chronotype_name: string;
  confidence: number; // 0-1000 (converted from 0-1 API response)
  success: boolean;
  error?: string;
}

export interface CircadianRateCalculation {
  adjusted_rate: number;
  base_rate: number;
  chronotype: number;
  chronotype_name: string;
  confidence: number;
  hourly_multiplier: number;
  behavior_multiplier: number;
  current_hour: number;
}

export interface UserInsights {
  chronotype: number;
  chronotype_name: string;
  confidence: number;
  peak_activity_hour: number;
  optimal_borrowing_hours: number[];
  activity_summary: {
    morning_avg: number;
    afternoon_avg: number;
    evening_avg: number;
    night_avg: number;
  };
  success: boolean;
  error?: string;
}

export interface MLConfiguration {
  apiUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheExpiry: number; // in milliseconds
}

export interface ActivityPattern {
  hours: number[];
  values: number[];
  timestamp: number;
  source: 'user_input' | 'generated' | 'historical';
}

export interface MLAnalytics {
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  average_confidence: number;
  chronotype_distribution: {
    early: number;
    intermediate: number;
    late: number;
  };
  last_prediction_time: number;
}

// ==================== CACHE INTERFACE ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

interface MLCache {
  predictions: Map<string, CacheEntry<ChronotypePrediction>>;
  insights: Map<string, CacheEntry<UserInsights>>;
  rates: Map<string, CacheEntry<CircadianRateCalculation>>;
}

// ==================== ML SERVICE CLASS ====================

class MLService {
  private config: MLConfiguration;
  private cache: MLCache;
  private analytics: MLAnalytics;
  private isOnline: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private activeControllers: Set<AbortController> = new Set();

  constructor(config?: Partial<MLConfiguration>) {
    // Default configuration
    this.config = {
      apiUrl: 'http://localhost:5000',
      timeout: 10000, // 10 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableCaching: true,
      cacheExpiry: 300000, // 5 minutes
      ...config
    };

    // Initialize cache
    this.cache = {
      predictions: new Map(),
      insights: new Map(),
      rates: new Map()
    };

    // Initialize analytics
    this.analytics = {
      total_predictions: 0,
      successful_predictions: 0,
      failed_predictions: 0,
      average_confidence: 0,
      chronotype_distribution: {
        early: 0,
        intermediate: 0,
        late: 0
      },
      last_prediction_time: 0
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  // ==================== HEALTH MONITORING ====================

  /**
   * Start automatic health monitoring
   */
  private startHealthMonitoring(): void {
    // Initial health check
    this.checkHealth();

    // Set up interval for periodic health checks
    setInterval(() => {
      this.checkHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Check ML API health with improved error handling
   */
  async checkHealth(): Promise<MLAPIHealth> {
    const controller = new AbortController();
    this.activeControllers.add(controller);

    try {
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const health: MLAPIHealth = await response.json();
      this.isOnline = health.status === 'healthy' && health.models_loaded;
      this.lastHealthCheck = Date.now();

      return health;
    } catch (error) {
      this.isOnline = false;
      
      // Handle specific error types
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS policy error - check ML server configuration';
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error - ML server may be offline';
        } else {
          errorMessage = error.message;
        }
      }
      
      console.warn(`ML API health check failed: ${errorMessage}`);
      
      return {
        status: 'unhealthy',
        models_loaded: false,
        version: 'unknown'
      };
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  /**
   * Get current service status
   */
  getServiceStatus(): { isOnline: boolean; lastCheck: number; nextCheck: number } {
    return {
      isOnline: this.isOnline,
      lastCheck: this.lastHealthCheck,
      nextCheck: this.lastHealthCheck + this.healthCheckInterval
    };
  }

  // ==================== ENHANCED REQUEST HANDLER ====================

  /**
   * Enhanced fetch with proper error handling and cleanup
   */
  private async makeAPIRequest<T>(
    endpoint: string, 
    data: any, 
    operation: string
  ): Promise<T> {
    const controller = new AbortController();
    this.activeControllers.add(controller);

    try {
      const timeoutId = setTimeout(() => {
        console.log(`Request timeout for ${operation}`);
        controller.abort();
      }, this.config.timeout);

      console.log(`Making ${operation} request to ${endpoint}`, data);

      const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      clearTimeout(timeoutId);

      console.log(`${operation} response status:`, response.status);

      if (!response.ok) {
        let errorMessage = `${operation} failed: ${response.status} ${response.statusText}`;
        
        try {
          const errorBody = await response.text();
          console.log(`${operation} error body:`, errorBody);
          
          // Try to parse as JSON for better error info
          try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error) {
              errorMessage = `${operation} failed: ${errorJson.error}`;
            }
          } catch {
            // Not JSON, use text response
            if (errorBody) {
              errorMessage = `${operation} failed: ${errorBody}`;
            }
          }
        } catch {
          // Can't read error body, use status
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`${operation} result:`, result);
      
      return result;
    } catch (error) {
      // Enhanced error handling
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`${operation} timed out after ${this.config.timeout}ms`);
        } else if (error.message.includes('CORS')) {
          throw new Error(`CORS error: Please ensure ML server has CORS enabled for ${window.location.origin}`);
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          throw new Error(`Network error: ML server at ${this.config.apiUrl} may be offline`);
        } else if (error.message.includes('JSON')) {
          throw new Error(`${operation} failed: Invalid response format from ML server`);
        }
      }
      
      throw error;
    } finally {
      this.activeControllers.delete(controller);
    }
  }

  // ==================== CHRONOTYPE PREDICTION ====================

  /**
   * Predict user chronotype from activity pattern with proper confidence scaling
   */
  async predictChronotype(
    activityPattern: number[],
    useCache: boolean = true
  ): Promise<ChronotypePrediction> {
    // Enhanced input validation
    if (!this.validateActivityPattern(activityPattern)) {
      console.error('Invalid activity pattern for chronotype prediction:', activityPattern);
      return {
        chronotype: 1,
        chronotype_name: 'Intermediate',
        confidence: 500,
        success: false,
        error: 'Invalid activity pattern: must be 24 numbers representing hourly activity levels'
      };
    }

    // Normalize pattern to ensure consistent input
    const normalizedPattern = this.normalizeActivityPattern(activityPattern);
    
    // Check cache if enabled
    if (useCache && this.config.enableCaching) {
      const cacheKey = this.generateCacheKey('prediction', normalizedPattern);
      const cached = this.getFromCache(this.cache.predictions, cacheKey);
      if (cached) {
        console.log('Returning cached chronotype prediction');
        return cached;
      }
    }

    // Make API request with retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`Chronotype prediction attempt ${attempt}/${this.config.retryAttempts}`);
        
        const result = await this.makeAPIRequest<any>(
          '/predict_chronotype',
          { activity_pattern: normalizedPattern },
          'Chronotype Prediction'
        );
        
        // ✅ FIXED: Proper confidence scaling
        const prediction: ChronotypePrediction = {
          chronotype: result.chronotype || 1,
          chronotype_name: result.chronotype_name || 'Intermediate',
          confidence: this.scaleConfidence(result.confidence), // Convert 0-1 to 0-1000
          success: true
        };

        // Cache successful result
        if (useCache && this.config.enableCaching) {
          const cacheKey = this.generateCacheKey('prediction', normalizedPattern);
          this.setCache(this.cache.predictions, cacheKey, prediction);
        }

        // Update analytics
        this.updateAnalytics(prediction);

        console.log('Chronotype prediction successful:', prediction);
        return prediction;
        
      } catch (error) {
        console.warn(`Chronotype prediction attempt ${attempt} failed:`, error);
        
        if (attempt === this.config.retryAttempts) {
          // Final attempt failed
          const fallbackPrediction: ChronotypePrediction = {
            chronotype: 1,
            chronotype_name: 'Intermediate',
            confidence: 500,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };

          this.updateAnalytics(fallbackPrediction);
          return fallbackPrediction;
        }

        // Wait before retry with exponential backoff
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      chronotype: 1,
      chronotype_name: 'Intermediate',
      confidence: 500,
      success: false,
      error: 'All retry attempts failed'
    };
  }

  // ==================== CIRCADIAN RATE CALCULATION ====================

  /**
   * Calculate circadian-adjusted interest rate
   */
  async calculateCircadianRate(
    baseRate: number,
    currentHour: number,
    userActivity: number[],
    useCache: boolean = true
  ): Promise<CircadianRateCalculation> {
    // Validate inputs
    if (baseRate < 0 || currentHour < 0 || currentHour > 23) {
      throw new Error('Invalid parameters: baseRate must be >= 0, currentHour must be 0-23');
    }

    if (!this.validateActivityPattern(userActivity)) {
      throw new Error('Invalid user activity pattern for rate calculation');
    }

    const normalizedActivity = this.normalizeActivityPattern(userActivity);

    // Check cache
    if (useCache && this.config.enableCaching) {
      const cacheKey = this.generateCacheKey('rate', [baseRate, currentHour, ...normalizedActivity]);
      const cached = this.getFromCache(this.cache.rates, cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const result = await this.makeAPIRequest<CircadianRateCalculation>(
        '/calculate_circadian_rate',
        {
          base_rate: baseRate,
          current_hour: currentHour,
          user_activity: normalizedActivity
        },
        'Circadian Rate Calculation'
      );

      // Cache result
      if (useCache && this.config.enableCaching) {
        const cacheKey = this.generateCacheKey('rate', [baseRate, currentHour, ...normalizedActivity]);
        this.setCache(this.cache.rates, cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('Circadian rate calculation failed:', error);
      throw error;
    }
  }

  // ==================== USER INSIGHTS ====================

  /**
   * Get comprehensive user insights
   */
  async getUserInsights(
    activityPattern: number[],
    useCache: boolean = true
  ): Promise<UserInsights> {
    // Validate input
    if (!this.validateActivityPattern(activityPattern)) {
      return {
        chronotype: 1,
        chronotype_name: 'Intermediate',
        confidence: 500,
        peak_activity_hour: 12,
        optimal_borrowing_hours: [9, 10, 14, 15, 16],
        activity_summary: {
          morning_avg: 0,
          afternoon_avg: 0,
          evening_avg: 0,
          night_avg: 0
        },
        success: false,
        error: 'Invalid activity pattern for insights'
      };
    }

    const normalizedPattern = this.normalizeActivityPattern(activityPattern);

    // Check cache
    if (useCache && this.config.enableCaching) {
      const cacheKey = this.generateCacheKey('insights', normalizedPattern);
      const cached = this.getFromCache(this.cache.insights, cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const result = await this.makeAPIRequest<any>(
        '/user_insights',
        { activity_pattern: normalizedPattern },
        'User Insights'
      );

      const insights: UserInsights = {
        ...result,
        confidence: this.scaleConfidence(result.confidence), // Scale confidence properly
        success: true
      };

      // Cache result
      if (useCache && this.config.enableCaching) {
        const cacheKey = this.generateCacheKey('insights', normalizedPattern);
        this.setCache(this.cache.insights, cacheKey, insights);
      }

      return insights;
    } catch (error) {
      console.error('User insights request failed:', error);
      
      return {
        chronotype: 1,
        chronotype_name: 'Intermediate',
        confidence: 500,
        peak_activity_hour: 12,
        optimal_borrowing_hours: [9, 10, 14, 15, 16],
        activity_summary: {
          morning_avg: 0,
          afternoon_avg: 0,
          evening_avg: 0,
          night_avg: 0
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ==================== ACTIVITY PATTERN UTILITIES ====================

  /**
   * Generate sample activity pattern for testing
   */
  generateSampleActivityPattern(
    chronotype: 'early' | 'intermediate' | 'late' = 'intermediate'
  ): ActivityPattern {
    const values = new Array(24).fill(0);
    
    switch (chronotype) {
      case 'early':
        // High activity 6-10 AM, medium 11-17, low 18-22, very low 23-5
        for (let i = 0; i < 24; i++) {
          if (i >= 6 && i <= 10) values[i] = Math.round(800 + Math.random() * 200);
          else if (i >= 11 && i <= 17) values[i] = Math.round(400 + Math.random() * 200);
          else if (i >= 18 && i <= 22) values[i] = Math.round(200 + Math.random() * 100);
          else values[i] = Math.round(50 + Math.random() * 50);
        }
        break;
      case 'late':
        // Low morning, medium afternoon, high evening/night
        for (let i = 0; i < 24; i++) {
          if (i >= 6 && i <= 12) values[i] = Math.round(100 + Math.random() * 100);
          else if (i >= 13 && i <= 18) values[i] = Math.round(400 + Math.random() * 200);
          else if (i >= 19 || i <= 2) values[i] = Math.round(800 + Math.random() * 200);
          else values[i] = Math.round(50 + Math.random() * 50);
        }
        break;
      default: // intermediate
        // Balanced pattern with peak in middle of day
        for (let i = 0; i < 24; i++) {
          if (i >= 9 && i <= 17) values[i] = Math.round(600 + Math.random() * 300);
          else if ((i >= 6 && i <= 8) || (i >= 18 && i <= 22)) values[i] = Math.round(300 + Math.random() * 200);
          else values[i] = Math.round(100 + Math.random() * 100);
        }
    }
    
    console.log(`Generated ${chronotype} pattern:`, values);
    
    return {
      hours: Array.from({ length: 24 }, (_, i) => i),
      values: values,
      timestamp: Date.now(),
      source: 'generated'
    };
  }

  /**
   * Enhanced activity pattern validation
   */
  validateActivityPattern(pattern: number[]): boolean {
    if (!Array.isArray(pattern)) {
      console.error('Activity pattern is not an array:', typeof pattern);
      return false;
    }
    
    if (pattern.length < 24) {
      console.error(`Activity pattern too short: ${pattern.length} < 24`);
      return false;
    }
    
    const isValid = pattern.every(value => 
      typeof value === 'number' && 
      value >= 0 && 
      isFinite(value) && 
      !isNaN(value)
    );
    
    if (!isValid) {
      console.error('Activity pattern contains invalid values:', pattern.filter(v => 
        typeof v !== 'number' || v < 0 || !isFinite(v) || isNaN(v)
      ));
    }
    
    return isValid;
  }

  /**
   * Normalize activity pattern to 0-1000 range with better handling
   */
  normalizeActivityPattern(pattern: number[]): number[] {
    if (!this.validateActivityPattern(pattern)) {
      throw new Error('Cannot normalize invalid activity pattern');
    }

    // Take only first 24 values if more are provided
    const trimmedPattern = pattern.slice(0, 24);
    
    const max = Math.max(...trimmedPattern);
    const min = Math.min(...trimmedPattern);
    
    // Handle edge case where all values are the same
    if (max === min) {
      return trimmedPattern.map(() => 500); // Default to middle value
    }

    // Normalize to 0-1000 range
    const normalized = trimmedPattern.map(value => 
      Math.round(((value - min) / (max - min)) * 1000)
    );
    
    console.log('Normalized pattern:', normalized);
    return normalized;
  }

  /**
   * Create activity pattern from user input
   */
  createActivityPatternFromInput(hourlyActivities: { hour: number; activity: number }[]): ActivityPattern {
    const values = new Array(24).fill(0);
    
    hourlyActivities.forEach(({ hour, activity }) => {
      if (hour >= 0 && hour < 24) {
        values[hour] = Math.max(0, Math.round(activity));
      }
    });

    return {
      hours: Array.from({ length: 24 }, (_, i) => i),
      values: values,
      timestamp: Date.now(),
      source: 'user_input'
    };
  }

  // ==================== CONFIDENCE SCALING ====================

  /**
   * ✅ FIXED: Proper confidence scaling from API response (0-1) to display format (0-1000)
   */
  private scaleConfidence(apiConfidence: number | undefined): number {
    if (typeof apiConfidence !== 'number') {
      console.warn('Invalid confidence value from API:', apiConfidence);
      return 500; // Default to medium confidence
    }
    
    // If already in 0-1000 range, return as is
    if (apiConfidence > 10) {
      return Math.min(1000, Math.max(0, Math.round(apiConfidence)));
    }
    
    // Convert from 0-1 range to 0-1000 range
    const scaled = Math.round(apiConfidence * 1000);
    console.log(`Scaled confidence: ${apiConfidence} -> ${scaled}`);
    return Math.min(1000, Math.max(0, scaled));
  }

  // ==================== CACHING SYSTEM ====================

  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(operation: string, data: any[]): string {
    const dataString = JSON.stringify(data);
    return `${operation}_${this.hashString(dataString)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get item from cache if not expired
   */
  private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set item in cache with expiry
   */
  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    const expires = Date.now() + this.config.cacheExpiry;
    cache.set(key, { data, timestamp: Date.now(), expires });
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.predictions.clear();
    this.cache.insights.clear();
    this.cache.rates.clear();
    console.log('All ML caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): { predictions: number; insights: number; rates: number; total: number } {
    return {
      predictions: this.cache.predictions.size,
      insights: this.cache.insights.size,
      rates: this.cache.rates.size,
      total: this.cache.predictions.size + this.cache.insights.size + this.cache.rates.size
    };
  }

  // ==================== ANALYTICS ====================

  /**
   * Update analytics with prediction result
   */
  private updateAnalytics(prediction: ChronotypePrediction): void {
    this.analytics.total_predictions++;
    
    if (prediction.success) {
      this.analytics.successful_predictions++;
      this.analytics.last_prediction_time = Date.now();
      
      // Update average confidence
      const totalSuccessful = this.analytics.successful_predictions;
      const currentAvg = this.analytics.average_confidence;
      this.analytics.average_confidence = 
        (currentAvg * (totalSuccessful - 1) + prediction.confidence) / totalSuccessful;
      
      // Update chronotype distribution
      switch (prediction.chronotype) {
        case 0:
          this.analytics.chronotype_distribution.early++;
          break;
        case 1:
          this.analytics.chronotype_distribution.intermediate++;
          break;
        case 2:
          this.analytics.chronotype_distribution.late++;
          break;
      }
    } else {
      this.analytics.failed_predictions++;
    }
  }

  /**
   * Get analytics data
   */
  getAnalytics(): MLAnalytics {
    return { ...this.analytics };
  }

  /**
   * Reset analytics
   */
  resetAnalytics(): void {
    this.analytics = {
      total_predictions: 0,
      successful_predictions: 0,
      failed_predictions: 0,
      average_confidence: 0,
      chronotype_distribution: {
        early: 0,
        intermediate: 0,
        late: 0
      },
      last_prediction_time: 0
    };
  }

  // ==================== CONFIGURATION ====================

  /**
   * Update service configuration
   */
  updateConfiguration(newConfig: Partial<MLConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('ML service configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): MLConfiguration {
    return { ...this.config };
  }

  // ==================== CLEANUP ====================

  /**
   * Cleanup method to abort pending requests
   */
  cleanup(): void {
    console.log(`Cleaning up ${this.activeControllers.size} active requests`);
    this.activeControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.activeControllers.clear();
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current hour
   */
  getCurrentHour(): number {
    return new Date().getHours();
  }

  /**
   * Get chronotype name from number
   */
  getChronotypeNameFromNumber(chronotype: number): string {
    const names = ['Early', 'Intermediate', 'Late'];
    return names[chronotype] || 'Unknown';
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevelDescription(confidence: number): string {
    if (confidence >= 900) return 'Very High';
    if (confidence >= 800) return 'High';
    if (confidence >= 700) return 'Medium-High';
    if (confidence >= 600) return 'Medium';
    if (confidence >= 400) return 'Medium-Low';
    if (confidence >= 200) return 'Low';
    return 'Very Low';
  }

  /**
   * Format rate as percentage
   */
  formatRateAsPercentage(rate: number): string {
    return (rate / 100).toFixed(2) + '%';
  }

  /**
   * Check if service is ready for requests
   */
  isReady(): boolean {
    return this.isOnline;
  }

  /**
   * Get detailed status for debugging
   */
  getDetailedStatus(): {
    isOnline: boolean;
    lastHealthCheck: number;
    cacheStats: any;
    analytics: MLAnalytics;
    config: MLConfiguration;
  } {
    return {
      isOnline: this.isOnline,
      lastHealthCheck: this.lastHealthCheck,
      cacheStats: this.getCacheStatistics(),
      analytics: this.getAnalytics(),
      config: this.getConfiguration()
    };
  }
}

// ==================== EXPORT SINGLETON ====================

// Create and export singleton instance
const mlService = new MLService();

export default mlService;

// Export class for custom instances if needed
export { MLService };
