import type { LangCode } from './types';

/**
 * Areas offered as tappable chips when the worker has not said where they live.
 * Names are copied from backend/data/areas.json (name, name_kn, name_hi), so a tapped
 * name is one the rule-based extractor already knows; backend/tests/test_area_follow_up.py
 * checks that they stay identical. Keep one object per line.
 */
export interface AreaChip {
  id: string;
  en: string;
  kn: string;
  hi: string;
}

export const AREA_CHIPS: AreaChip[] = [
  { id: 'whitefield', en: 'Whitefield', kn: 'ವೈಟ್‌ಫೀಲ್ಡ್', hi: 'व्हाइटफील्ड' },
  { id: 'koramangala', en: 'Koramangala', kn: 'ಕೋರಮಂಗಲ', hi: 'कोरमंगला' },
  { id: 'jayanagar', en: 'Jayanagar', kn: 'ಜಯನಗರ', hi: 'जयनगर' },
  { id: 'electronic_city', en: 'Electronic City', kn: 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ', hi: 'इलेक्ट्रॉनिक सिटी' },
  { id: 'yelahanka', en: 'Yelahanka', kn: 'ಯೆಲಹಂಕ', hi: 'येलहंका' },
  { id: 'marathahalli', en: 'Marathahalli', kn: 'ಮರಾಠಹಳ್ಳಿ', hi: 'मराठहल्ली' },
  { id: 'hsr_layout', en: 'HSR Layout', kn: 'ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್', hi: 'एचएसआर लेआउट' },
  { id: 'hoodi', en: 'Hoodi', kn: 'ಹೂಡಿ', hi: 'हूडी' },
];

export function chipName(chip: AreaChip, lang: LangCode): string {
  return chip[lang];
}
