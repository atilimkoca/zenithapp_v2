// 🎄 Christmas Components Export
// 
// Easy-to-remove Christmas effects for your app
// After Christmas, set enabled: false in src/config/christmasConfig.js

export { default as ChristmasWrapper } from './ChristmasWrapper';
export { default as Snowfall } from './Snowfall';
export { default as SantaHat } from './SantaHat';
export { default as ChristmasGreeting } from './ChristmasGreeting';

// Re-export config utilities
export { 
  CHRISTMAS_CONFIG, 
  isChristmasActive, 
  isEffectEnabled 
} from '../../config/christmasConfig';
