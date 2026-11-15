import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';
import { isUrduScript } from '../services/groqStt';

interface SavePhraseModalProps {
  visible: boolean;
  onSave: (phraseText: string) => Promise<void>;
  onClose: () => void;
}

export const SavePhraseModal: React.FC<SavePhraseModalProps> = ({
  visible,
  onSave,
  onClose,
}) => {
  const [text, setText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isUrdu = isUrduScript(text);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onSave(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText('');
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save phrase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="bookmark-outline" size={22} color={THEME.colors.conversationAccent} />
              <Text style={styles.headerTitle}>Save Custom Phrase</Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel adding phrase"
            >
              <Ionicons name="close" size={24} color={THEME.colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.description}>
            Add a frequent sentence (such as medical needs, addresses, or requests) for instant single-tap speech.
          </Text>

          {/* Text Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                isUrdu && styles.urduTextInput,
              ]}
              value={text}
              onChangeText={(val) => {
                setText(val);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Type phrase in Urdu or English... / نیا جملہ درج کریں"
              placeholderTextColor="#64748B"
              multiline={true}
              maxLength={120}
              autoFocus={true}
              accessible={true}
              accessibilityLabel="Custom phrase input"
            />
            <Text style={styles.counter}>{text.length}/120</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={THEME.colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveButton,
                (!text.trim() || isSubmitting) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!text.trim() || isSubmitting}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save phrase"
            >
              <Text style={styles.saveText}>
                {isSubmitting ? 'Saving...' : 'Save Phrase'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputContainer: {
    backgroundColor: '#131B2E',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  textInput: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  urduTextInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 28,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: THEME.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.5,
    minHeight: 50,
    backgroundColor: THEME.colors.conversationAccent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#001E2C',
    fontSize: 16,
    fontWeight: '700',
  },
});
