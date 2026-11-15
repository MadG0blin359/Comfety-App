import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuickReplyItem } from '../types';
import { STORAGE_KEYS } from './config';
import { isUrduScript } from '../services/groqStt';

export const DEFAULT_QUICK_REPLIES: readonly QuickReplyItem[] = [
  {
    id: 'reply-assalam',
    labelEn: 'Assalam-o-Alaikum',
    labelUr: 'السلام علیکم',
    spokenText: 'السلام علیکم',
    category: 'greeting',
  },
  {
    id: 'reply-price',
    labelEn: 'How much is this?',
    labelUr: 'یہ کتنے کا ہے؟',
    spokenText: 'یہ کتنے کا ہے؟',
    category: 'commerce',
  },
  {
    id: 'reply-write-down',
    labelEn: 'Please write it down',
    labelUr: 'برائے مہربانی لکھ دیں',
    spokenText: 'برائے مہربانی لکھ دیں',
    category: 'clarification',
  },
  {
    id: 'reply-speak-slowly',
    labelEn: 'Please speak slowly',
    labelUr: 'برائے مہربانی آہستہ بولیں',
    spokenText: 'برائے مہربانی آہستہ بولیں',
    category: 'clarification',
  },
  {
    id: 'reply-exit',
    labelEn: 'Where is the way / exit?',
    labelUr: 'راستہ کہاں ہے؟',
    spokenText: 'راستہ کہاں ہے؟',
    category: 'navigation',
  },
  {
    id: 'reply-doctor',
    labelEn: 'I need medical help',
    labelUr: 'مجھے ڈاکٹر کی ضرورت ہے',
    spokenText: 'مجھے ڈاکٹر کی ضرورت ہے',
    category: 'urgent',
  },
  {
    id: 'reply-thanks',
    labelEn: 'Thank you very much',
    labelUr: 'بہت شکریہ',
    spokenText: 'بہت شکریہ',
    category: 'greeting',
  },
  {
    id: 'reply-yes',
    labelEn: 'Yes / Correct',
    labelUr: 'جی ہاں',
    spokenText: 'جی ہاں',
    category: 'commerce',
  },
  {
    id: 'reply-no',
    labelEn: 'No / Not needed',
    labelUr: 'نہیں، شکریہ',
    spokenText: 'نہیں، شکریہ',
    category: 'commerce',
  },
] as const;

/**
 * Loads custom saved user phrases from AsyncStorage.
 */
export async function loadCustomPhrases(): Promise<QuickReplyItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PHRASES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuickReplyItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[QuickReplies] Failed to load custom phrases from AsyncStorage:', err);
    return [];
  }
}

/**
 * Saves a new custom phrase to AsyncStorage.
 */
export async function addCustomPhrase(phraseText: string): Promise<QuickReplyItem[]> {
  const trimmed = phraseText.trim();
  if (!trimmed) {
    throw new Error('Phrase cannot be empty.');
  }

  const existing = await loadCustomPhrases();
  const isUrdu = isUrduScript(trimmed);

  const newPhrase: QuickReplyItem = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    labelEn: isUrdu ? 'Custom Phrase' : trimmed,
    labelUr: isUrdu ? trimmed : 'ذاتی جملہ',
    spokenText: trimmed,
    category: 'custom',
    isCustom: true,
  };

  const updated = [newPhrase, ...existing];
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PHRASES, JSON.stringify(updated));
  } catch (err) {
    console.error('[QuickReplies] Failed to persist custom phrase to AsyncStorage:', err);
    throw new Error('Failed to save phrase to storage.');
  }

  return updated;
}

/**
 * Deletes a custom phrase from AsyncStorage.
 */
export async function deleteCustomPhrase(id: string): Promise<QuickReplyItem[]> {
  const existing = await loadCustomPhrases();
  const updated = existing.filter((item) => item.id !== id);

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PHRASES, JSON.stringify(updated));
  } catch (err) {
    console.error('[QuickReplies] Failed to delete custom phrase from AsyncStorage:', err);
    throw new Error('Failed to delete phrase from storage.');
  }

  return updated;
}
