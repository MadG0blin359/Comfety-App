/**
 * Zero-Dependency Devanagari to Urdu Nastaliq Script Transliterator.
 *
 * Converts Hindi Devanagari characters (\u0900-\u097F) produced by Whisper
 * into standard Urdu Nastaliq orthography with zero network overhead (< 1ms on Hermes).
 */

const NUKTA_MAP: Record<string, string> = {
  'क': 'ق',
  'ख': 'خ',
  'ग': 'غ',
  'ज': 'ز',
  'ड': 'ڑ',
  'ढ': 'ڑھ',
  'फ': 'ف',
  'य': 'ی',
};

const COMMON_WORD_MAP: Record<string, string> = {
  'नमस्ते': 'السلام علیکم',
  'नमस्कार': 'السلام علیکم',
  'धन्यवाद': 'شکریہ',
  'शुक्रिया': 'شکریہ',
  'अलविदा': 'الوداع',
  'कृपया': 'برائے مہربانی',
  'हाँ': 'ہاں',
  'नहीं': 'نہیں',
  'क्या': 'کیا',
  'क्यों': 'کیوں',
  'कैसे': 'کیسے',
  'कहाँ': 'کہاں',
  'कौन': 'کون',
  'कब': 'کب',
  'यह': 'یہ',
  'वह': 'وہ',
  'है': 'ہے',
  'हैं': 'ہیں',
  'था': 'تھا',
  'थी': 'تھی',
  'थे': 'تھے',
  'होगा': 'ہوگا',
  'होगी': 'ہوگی',
  'होंगे': 'ہوں گے',
  'मैं': 'میں',
  'हम': 'ہم',
  'आप': 'آپ',
  'तुम': 'تم',
  'तू': 'تو',
  'मेरा': 'میرا',
  'मेरी': 'میری',
  'मेरे': 'میرے',
  'आपका': 'آپ کا',
  'आपकी': 'آپ کی',
  'आपके': 'آپ کے',
  'उसका': 'اس کا',
  'उसकी': 'اس کی',
  'उसके': 'اس کے',
  'इनका': 'ان کا',
  'इनकी': 'ان کی',
  'इनके': 'ان کے',
  'उनका': 'ان کا',
  'उनकी': 'ان کی',
  'उनके': 'ان کے',
  'अच्छा': 'اچھا',
  'अच्छी': 'اچھی',
  'अच्छे': 'اچھے',
  'बहुत': 'بہت',
  'थोड़ा': 'تھوڑا',
  'ज्यादा': 'زیادہ',
  'कम': 'کم',
  'ठीक': 'ٹھیک',
  'दिन': 'دن',
  'रात': 'رات',
  'सुबह': 'صبح',
  'शाम': 'شام',
  'डॉक्टर': 'ڈاکٹر',
  'अस्पताल': 'ہسپتال',
  'दुकान': 'دکان',
  'बाजार': 'بازار',
  'पैसे': 'پیسے',
  'रुपये': 'روپے',
  'दवा': 'دوا',
  'मदद': 'مدد',
  'जिंदगी': 'زندگی',
  'ज़िंदगी': 'زندگی',
  'रास्ता': 'راستہ',
  'ज़रूरत': 'ضرورت',
  'जरूरत': 'ضرورت',
  'सही': 'صحیح',
  'चाहिए': 'چاہیے',
  'लिए': 'لیے',
};

const CHAR_MAP: Record<string, string> = {
  // Punctuation
  '।': '۔',
  '॥': '۔',

  // Precomposed Nukta Characters (NFC single-codepoint)
  '\u0958': 'ق', // क़
  '\u0959': 'خ', // ख़
  '\u095A': 'غ', // ग़
  '\u095B': 'ز', // ज़
  '\u095C': 'ڑ', // ड़
  '\u095D': 'ڑھ', // ढ़
  '\u095E': 'ف', // फ़
  '\u095F': 'ی', // य़

  // Decomposed Nukta Characters (Consonant + \u093C)
  'क़': 'ق',
  'ख़': 'خ',
  'ग़': 'غ',
  'ज़': 'ز',
  'ड़': 'ڑ',
  'ढ़': 'ڑھ',
  'फ़': 'ف',
  'य़': 'ی',

  // Independent Vowels
  'अ': 'ا',
  'आ': 'آ',
  'इ': 'ای',
  'ई': 'ای',
  'उ': 'او',
  'ऊ': 'او',
  'ऋ': 'ر',
  'ए': 'اے',
  'ऐ': 'اے',
  'ओ': 'او',
  'औ': 'او',

  // Consonants
  'क': 'ک',
  'ख': 'کھ',
  'ग': 'گ',
  'घ': 'گھ',
  'ङ': 'ن',
  'च': 'چ',
  'छ': 'چھ',
  'ज': 'ج',
  'झ': 'جھ',
  'ञ': 'ن',
  'ट': 'ٹ',
  'ठ': 'ٹھ',
  'ड': 'ڈ',
  'ढ': 'ڈھ',
  'ण': 'ن',
  'त': 'ت',
  'थ': 'تھ',
  'द': 'د',
  'ध': 'دھ',
  'न': 'ن',
  'प': 'پ',
  'फ': 'پھ',
  'ब': 'ب',
  'भ': 'بھ',
  'म': 'م',
  'य': 'ی',
  'र': 'ر',
  'ल': 'ل',
  'व': 'و',
  'श': 'ش',
  'ष': 'ش',
  'स': 'س',
  'ह': 'ہ',

  // Matras (Dependent Vowels)
  'ा': 'ا',
  'ि': 'ی',
  'ी': 'ی',
  'ु': 'و',
  'ू': 'و',
  'ृ': 'ر',
  'े': 'ے',
  'ै': 'ے',
  'ो': 'و',
  'ौ': 'و',

  // Nasal signs & modifiers
  'ं': 'ں',
  'ँ': 'ں',
  'ः': 'ہ',
  '्': '', // Virama / Halant suppresses inherent vowel
};

/**
 * Checks whether text contains any Hindi Devanagari characters (\u0900-\u097F).
 */
export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Transliterates Devanagari text into clean Urdu Nastaliq script.
 * Preserves existing English, Urdu, numbers, and spaces without modification.
 */
export function devanagariToUrdu(text: string): string {
  if (!text || !hasDevanagari(text)) {
    return text;
  }

  // Normalize input to NFD so precomposed NFC nuktas expand to base consonant + \u093C
  let processed = text.normalize('NFD');

  // Step 1: Pre-process common whole-word replacements
  for (const [hindiWord, urduWord] of Object.entries(COMMON_WORD_MAP)) {
    const normalizedWord = hindiWord.normalize('NFD');
    if (processed.includes(normalizedWord)) {
      processed = processed.split(normalizedWord).join(urduWord);
    }
  }

  if (!hasDevanagari(processed)) {
    return cleanUrduFormatting(processed);
  }

  // Step 2: Handle consonant + explicit nukta character (\u093C) and direct NFC nukta codepoints
  // Ensures both decomposed and precomposed nukta variants correctly map to Urdu consonants
  processed = processed
    .replace(/\u0958/g, 'ق')
    .replace(/\u0959/g, 'خ')
    .replace(/\u095A/g, 'غ')
    .replace(/\u095B/g, 'ز')
    .replace(/\u095C/g, 'ڑ')
    .replace(/\u095D/g, 'ڑھ')
    .replace(/\u095E/g, 'ف')
    .replace(/\u095F/g, 'ی')
    .replace(/([कखगज़जडढफय])\u093C/g, (_, char) => {
      return NUKTA_MAP[char] ?? char;
    });

  // Step 3: Character-by-character context-aware phonetic mapping
  const result: string[] = [];
  const chars = Array.from(processed);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const nextChar = chars[i + 1];
    const isFollowedByWordChar =
      nextChar !== undefined &&
      !/[\s۔.!?،,;:\-–—\(\)\[\]"']/.test(nextChar);

    if (ch === 'े' || ch === 'ै') {
      // Medial vowel: In Urdu Nastaliq, medial "e/ai" is written with chhoti ye (ی).
      // Bari ye (ے) is a right-joining letter only valid at word endings.
      result.push(isFollowedByWordChar ? 'ی' : 'ے');
    } else if (ch === 'ं' || ch === 'ँ') {
      // Medial nasal: In Urdu, nasal noon in the middle of a word is written with dotted noon (ن).
      // Noon ghunna (ں) is dotless and only valid at the end of words.
      result.push(isFollowedByWordChar ? 'ن' : 'ں');
    } else if (ch in CHAR_MAP) {
      result.push(CHAR_MAP[ch]);
    } else {
      result.push(ch);
    }
  }

  return cleanUrduFormatting(result.join(''));
}

/**
 * Normalizes double vowels, spacing artifacts, and medial joining resulting from character mapping.
 */
function cleanUrduFormatting(text: string): string {
  return text
    // Replace double noon ghunna with single
    .replace(/ں+/g, 'ں')
    // Guard against any medial noon ghunna followed by an Urdu letter (convert to dotted noon)
    .replace(/ں(?=[\u0600-\u06FF])/g, 'ن')
    // Remove isolated halants or non-printable Devanagari artifacts
    .replace(/[\u0900-\u097F]/g, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}
