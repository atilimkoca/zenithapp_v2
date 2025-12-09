import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export const getExpoPushToken = async () => {
  try {
    // Expo Go / dev-client keeps project info available automatically
    if (__DEV__ && Constants.appOwnership === 'expo') {
      return await Notifications.getExpoPushTokenAsync();
    }

    // Resolve projectId for standalone/App Store builds (required by Expo push service)
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.expoConfig?.projectId ||
      Constants?.easConfig?.projectId;

    if (!projectId) {
      throw new Error('Expo projectId missing; set extra.eas.projectId in app.config.js');
    }

    return await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    throw new Error(`Failed to get push token: ${error.message}`);
  }
};
