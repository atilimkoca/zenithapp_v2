import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export const getExpoPushToken = async () => {
  try {
    // For Expo Go development, no projectId needed
    if (__DEV__ && Constants.appOwnership === 'expo') {
      return await Notifications.getExpoPushTokenAsync();
    }
    
    // For standalone builds, try without projectId first (Expo SDK 50+)
    try {
      return await Notifications.getExpoPushTokenAsync();
    } catch (error) {
      // If it specifically mentions projectId validation error, 
      // this means we're in a context that requires it but don't have a valid one
      if (error.message.includes('projectId') || error.message.includes('VALIDATION_ERROR')) {
        // Log the error for debugging but don't crash the app
        console.warn('Push notifications require proper project setup for standalone builds');
        throw new Error('Push notifications not available in this build configuration');
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to get push token: ${error.message}`);
  }
};