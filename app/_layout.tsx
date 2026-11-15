import { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAudioModeAsync } from 'expo-audio';
import * as SplashScreen from 'expo-splash-screen';
import { THEME } from '../src/constants/theme';

// Keep native splash screen visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      } catch (err: unknown) {
        console.warn('[RootLayout] Audio mode configuration warning:', err);
      } finally {
        // Hold splash screen for 1200ms so users clearly see the Comfety branding
        // even during development bundle reloads over Wi-Fi
        setTimeout(async () => {
          try {
            await SplashScreen.hideAsync();
          } catch {}
          setIsAppReady(true);
        }, 1200);
      }
    }

    prepare();
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

      {/* Branded Splash Screen Overlay: ensures the splash is always visible on cold start and Wi-Fi bundle reloads */}
      {!isAppReady && (
        <View style={styles.splashContainer} pointerEvents="none">
          <Image
            source={require('../assets/splash-icon.png')}
            style={styles.splashIcon}
            resizeMode="contain"
          />
          <Text style={styles.splashTitle}>Comfety</Text>
          <Text style={styles.splashSubtitle}>Assistive Communication & Navigation</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  splashIcon: {
    width: 140,
    height: 140,
    marginBottom: 20,
  },
  splashTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 0.2,
  },
});

