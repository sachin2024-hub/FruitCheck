import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fruitcheck.onboarding.done';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Not critical: onboarding would simply show again.
  }
}
