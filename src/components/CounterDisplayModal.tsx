import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';
import { isUrduScript } from '../services/groqStt';

interface CounterDisplayModalProps {
  visible: boolean;
  text: string;
  onClose: () => void;
  onSpeakAgain?: (text: string) => void;
}

export const CounterDisplayModal: React.FC<CounterDisplayModalProps> = ({
  visible,
  text,
  onClose,
  onSpeakAgain,
}) => {
  if (!text) return null;

  const isUrdu = isUrduScript(text);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSpeak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSpeakAgain?.(text);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        {/* Top Header Controls */}
        <View style={styles.header}>
          <View style={styles.counterBadge}>
            <Ionicons name="card-outline" size={18} color={THEME.colors.conversationAccent} />
            <Text style={styles.counterBadgeText}>COUNTER DISPLAY (40px)</Text>
          </View>

          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close Counter Display"
            accessibilityHint="Dismisses the full-screen card"
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Counter Orientation Hint */}
        <View style={styles.hintBanner}>
          <Ionicons name="phone-portrait-outline" size={16} color={THEME.colors.textSecondary} />
          <Text style={styles.hintText}>
            Show this screen to the counter clerk, doctor, or teller in noisy spaces.
          </Text>
        </View>

        {/* Primary 40px High-Contrast Display Surface */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentContainer}
          alwaysBounceVertical={false}
        >
          <Text
            style={[
              styles.counterText,
              isUrdu ? styles.urduCounterText : styles.englishCounterText,
            ]}
            selectable={true}
          >
            {text}
          </Text>
        </ScrollView>

        {/* Bottom Actions Bar */}
        <View style={styles.bottomBar}>
          {onSpeakAgain && (
            <Pressable
              style={styles.speakButton}
              onPress={handleSpeak}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Speak message aloud"
            >
              <Ionicons name="volume-high" size={22} color="#001E2C" />
              <Text style={styles.speakButtonText}>Speak Aloud</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.dismissButton}
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Done and Return"
          >
            <Text style={styles.dismissButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  counterBadgeText: {
    color: THEME.colors.conversationAccent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  counterText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  englishCounterText: {
    lineHeight: 52,
    textAlign: 'left',
  },
  urduCounterText: {
    lineHeight: 68,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  speakButton: {
    flex: 1,
    minHeight: 52,
    backgroundColor: THEME.colors.conversationAccent,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  speakButtonText: {
    color: '#001E2C',
    fontSize: 17,
    fontWeight: '700',
  },
  dismissButton: {
    minWidth: 100,
    minHeight: 52,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
