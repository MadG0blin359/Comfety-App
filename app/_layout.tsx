import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { THEME } from '../src/constants/theme';

export default function RootLayout() {
  useEffect(() => {
    try {
      // Dynamically load to prevent native module evaluation crashes when running in Expo Go
      // In native development client builds, this configures the audio session cleanly
      const { Audio } = require('expo-av');
      if (Audio?.setAudioModeAsync) {
        Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        }).catch((err: unknown) => {
          console.warn('[RootLayout] Audio session warning:', err);
        });
      }
    } catch {
      // Safe fallback when ExponentAV native module is not linked in the current host (e.g. standard Expo Go)
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: {
            backgroundColor: THEME.colors.background,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="guide" />
      </Stack>
    </SafeAreaProvider>
  );
}
