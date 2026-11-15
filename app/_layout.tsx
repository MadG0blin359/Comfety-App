import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAudioModeAsync } from 'expo-audio';
import * as SplashScreen from 'expo-splash-screen';
import { THEME } from '../src/constants/theme';

// Keep native splash screen visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  // Silky animation values for Apple-grade transition
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    // 1. Entrance animation: organic breathing arrival
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Audio configuration & intentional brand presence duration
    async function prepare() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      } catch (err: unknown) {
        console.warn('[RootLayout] Audio mode configuration warning:', err);
      }

      // Smooth hold duration: ~2.3 seconds so user comfortably absorbs the brand
      setTimeout(() => {
        // Synchronously release native OS splash
        SplashScreen.hideAsync().catch(() => {});

        // 3. Silky exit dissolve transition (650ms smooth crossfade into Home)
        Animated.parallel([
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1.06,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            setIsSplashVisible(false);
          }
        });
      }, 2300);
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

      {/* Silky Animated Splash Screen Overlay */}
      {isSplashVisible && (
        <Animated.View
          style={[styles.splashContainer, { opacity: splashOpacity }]}
          pointerEvents="none"
        >
          <Animated.Image
            source={require('../assets/splash-icon.png')}
            style={[
              styles.splashIcon,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
            resizeMode="contain"
          />
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.splashTitle}>Comfety</Text>
            <Text style={styles.splashSubtitle}>Assistive Communication & Navigation</Text>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <SafeAreaProvider>
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Application Error</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <Pressable style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryButtonText}>Reload App</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: {
    color: '#001E2C',
    fontSize: 16,
    fontWeight: '700',
  },
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


