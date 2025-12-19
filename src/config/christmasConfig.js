// ========================================
// 🎄 CHRISTMAS CONFIGURATION
// ========================================
// Set this to false after Christmas to disable all Christmas effects
// This is the ONLY place you need to change to remove Christmas effects
// ========================================

export const CHRISTMAS_CONFIG = {
  // 🎅 MAIN TOGGLE - Set to false after Christmas!
  enabled: true,
  
  // Auto-disable after a specific date (e.g., January 2nd, 2026)
  autoDisableDate: new Date('2026-01-02'),
  
  // Individual effect toggles
  effects: {
    snowfall: true,        // Falling snowflakes animation
    christmasColors: true, // Christmas accent colors (red/green highlights)
    santaHat: true,        // Santa hat on logo
    christmasGreeting: true, // Special Christmas greeting message
  },
  
  // Snowfall settings
  snowfall: {
    snowflakeCount: 25,    // Number of snowflakes on screen
    minSize: 6,            // Minimum snowflake size
    maxSize: 16,           // Maximum snowflake size
    minDuration: 8000,     // Minimum fall duration (ms)
    maxDuration: 15000,    // Maximum fall duration (ms)
    opacity: 0.8,          // Snowflake opacity
  },
  
  // Christmas colors
  colors: {
    christmasRed: '#D42426',
    christmasGreen: '#165B33',
    christmasGold: '#FFD700',
    snow: '#FFFFFF',
  },
};

// Helper function to check if Christmas mode should be active
export const isChristmasActive = () => {
  if (!CHRISTMAS_CONFIG.enabled) return false;
  
  const now = new Date();
  if (now > CHRISTMAS_CONFIG.autoDisableDate) return false;
  
  return true;
};

// Get specific effect status
export const isEffectEnabled = (effectName) => {
  if (!isChristmasActive()) return false;
  return CHRISTMAS_CONFIG.effects[effectName] ?? false;
};
