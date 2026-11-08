import type { LangCode } from './types';

/**
 * Skill names in en/kn/hi, copied from backend/data/skills.json (label_en, label_kn, label_hi,
 * category). src/test/jobCard.test.tsx checks the copy stays identical. Keep one skill per line.
 */
export interface SkillInfo {
  en: string;
  kn: string;
  hi: string;
  category: string;
}

export const SKILLS: Record<string, SkillInfo> = {
  hotel_helper: { en: 'Hotel Helper', kn: 'ಹೋಟೆಲ್ ಹೆಲ್ಪರ್', hi: 'होटल हेल्पर', category: 'hospitality' },
  cook: { en: 'Cook', kn: 'ಅಡುಗೆ', hi: 'रसोइया', category: 'hospitality' },
  housekeeping: { en: 'Housekeeping', kn: 'ಹೌಸ್‌ಕೀಪಿಂಗ್', hi: 'हाउसकीपिंग', category: 'domestic' },
  security_guard: { en: 'Security Guard', kn: 'ಸೆಕ್ಯೂರಿಟಿ ಗಾರ್ಡ್', hi: 'सुरक्षा गार्ड', category: 'security' },
  driver_car: { en: 'Car Driver', kn: 'ಕಾರ್ ಡ್ರೈವರ್', hi: 'कार ड्राइवर', category: 'transport' },
  two_wheeler: { en: 'Two-Wheeler Rider', kn: 'ಎರಡು ಚಕ್ರದ ವಾಹನ', hi: 'दोपहिया वाहन', category: 'transport' },
  delivery: { en: 'Delivery', kn: 'ಡೆಲಿವರಿ', hi: 'डिलीवरी', category: 'transport' },
  electrician: { en: 'Electrician', kn: 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್', hi: 'इलेक्ट्रीशियन', category: 'technical' },
  plumber: { en: 'Plumber', kn: 'ಪ್ಲಂಬರ್', hi: 'प्लंबर', category: 'technical' },
  tailoring: { en: 'Tailoring', kn: 'ಹೊಲಿಗೆ', hi: 'सिलाई', category: 'garment' },
  construction_helper: { en: 'Construction Helper', kn: 'ನಿರ್ಮಾಣ ಕಾರ್ಮಿಕ', hi: 'निर्माण मजदूर', category: 'construction' },
  mason: { en: 'Mason', kn: 'ಮೇಸ್ತ್ರಿ', hi: 'राजमिस्त्री', category: 'construction' },
  pos_billing: { en: 'POS / Billing', kn: 'ಬಿಲ್ಲಿಂಗ್', hi: 'बिलिंग', category: 'retail' },
  retail_sales: { en: 'Retail Sales', kn: 'ರಿಟೇಲ್ ಮಾರಾಟ', hi: 'खुदरा बिक्री', category: 'retail' },
  warehouse: { en: 'Warehouse / Packing', kn: 'ಗೋದಾಮು', hi: 'गोदाम', category: 'logistics' },
  data_entry: { en: 'Data Entry', kn: 'ಡೇಟಾ ಎಂಟ್ರಿ', hi: 'डेटा एंट्री', category: 'office' },
  ac_technician: { en: 'AC Technician', kn: 'ಎಸಿ ತಂತ್ರಜ್ಞ', hi: 'एसी तकनीशियन', category: 'technical' },
  mobile_repair: { en: 'Mobile Repair', kn: 'ಮೊಬೈಲ್ ರಿಪೇರಿ', hi: 'मोबाइल रिपेयर', category: 'technical' },
  painting: { en: 'Painting', kn: 'ಪೇಂಟಿಂಗ್', hi: 'पेंटिंग', category: 'construction' },
  welder: { en: 'Welder', kn: 'ವೆಲ್ಡಿಂಗ್', hi: 'वेल्डर', category: 'technical' },
  carpenter: { en: 'Carpenter', kn: 'ಬಡಗಿ', hi: 'बढ़ई', category: 'technical' },
  auto_driver: { en: 'Auto Driver', kn: 'ಆಟೋ ಚಾಲಕ', hi: 'ऑटो चालक', category: 'transport' },
  truck_driver: { en: 'Truck / HMV Driver', kn: 'ಲಾರಿ ಚಾಲಕ', hi: 'ट्रक ड्राइवर', category: 'transport' },
  watchman: { en: 'Watchman / Night Guard', kn: 'ಕಾವಲುಗಾರ', hi: 'चौकीदार', category: 'security' },
  barber: { en: 'Barber', kn: 'ಕ್ಷೌರಿಕ', hi: 'नाई', category: 'personal_services' },
  beautician: { en: 'Beautician', kn: 'ಬ್ಯೂಟಿಷಿಯನ್', hi: 'ब्यूटीशियन', category: 'personal_services' },
  gardener: { en: 'Gardener', kn: 'ತೋಟಗಾರ', hi: 'माली', category: 'domestic' },
  babysitter: { en: 'Babysitter / Nanny', kn: 'ಮಕ್ಕಳ ಆರೈಕೆ', hi: 'आया', category: 'domestic' },
  elder_care: { en: 'Elder Care', kn: 'ಹಿರಿಯರ ಆರೈಕೆ', hi: 'बुजुर्ग देखभाल', category: 'domestic' },
  laundry: { en: 'Laundry / Ironing', kn: 'ಬಟ್ಟೆ ಒಗೆಯುವಿಕೆ', hi: 'धोबी', category: 'domestic' },
  factory_worker: { en: 'Factory Worker', kn: 'ಕಾರ್ಖಾನೆ ಕಾರ್ಮಿಕ', hi: 'कारखाना मजदूर', category: 'manufacturing' },
  farm_worker: { en: 'Farm Worker', kn: 'ಕೃಷಿ ಕಾರ್ಮಿಕ', hi: 'खेत मजदूर', category: 'agriculture' },
  telecalling: { en: 'Telecalling / BPO', kn: 'ಟೆಲಿಕಾಲಿಂಗ್', hi: 'टेलीकालिंग', category: 'office' },
  sanitation: { en: 'Sanitation / Sweeping', kn: 'ಸ್ವಚ್ಛತಾ ಕಾರ್ಮಿಕ', hi: 'सफाई कर्मचारी', category: 'sanitation' },
  event_helper: { en: 'Event Helper', kn: 'ಈವೆಂಟ್ ಹೆಲ್ಪರ್', hi: 'इवेंट हेल्पर', category: 'hospitality' },
  gym_trainer: { en: 'Gym Trainer', kn: 'ಜಿಮ್ ತರಬೇತಿದಾರ', hi: 'जिम ट्रेनर', category: 'personal_services' },
  basic_english: { en: 'Basic English', kn: 'ಮೂಲ ಇಂಗ್ಲಿಷ್', hi: 'बेसिक अंग्रेजी', category: 'communication' },
  driving_licence: { en: 'Driving Licence', kn: 'ಚಾಲನಾ ಪರವಾನಗಿ', hi: 'ड्राइविंग लाइसेंस', category: 'certification' },
  forklift: { en: 'Forklift Operator', kn: 'ಫೋರ್ಕ್‌ಲಿಫ್ಟ್ ಆಪರೇಟರ್', hi: 'फोर्कलिफ्ट ऑपरेटर', category: 'logistics' },
  food_handler: { en: 'Food Handler', kn: 'ಆಹಾರ ನಿರ್ವಾಹಕ', hi: 'फूड हैंडलर', category: 'certification' },
  swimming_pool: { en: 'Swimming Pool Attendant', kn: 'ಈಜುಕೊಳ ಸಹಾಯಕ', hi: 'स्विमिंग पूल अटेंडेंट', category: 'hospitality' },
};

/** The skill's name in the chosen language; unknown IDs fall back to a readable form of the ID. */
export function skillName(id: string, lang: LangCode): string {
  return SKILLS[id]?.[lang] ?? id.replace(/_/g, ' ');
}

/** A large decorative icon for a job, from the category of its first required skill. */
const CATEGORY_ICON: Record<string, string> = {
  hospitality: '🍳',
  domestic: '🏠',
  security: '🛡️',
  transport: '🚗',
  technical: '🔧',
  garment: '🧵',
  construction: '🧱',
  retail: '🛒',
  logistics: '📦',
  office: '💻',
  personal_services: '✂️',
  manufacturing: '🏭',
  agriculture: '🌾',
  sanitation: '🧹',
  communication: '💬',
  certification: '📜',
};

export const DEFAULT_JOB_ICON = '💼';

export function jobIcon(skillsRequired: string[]): string {
  const category = SKILLS[skillsRequired[0]]?.category;
  return (category && CATEGORY_ICON[category]) || DEFAULT_JOB_ICON;
}

export function categoryIcons(): Record<string, string> {
  return { ...CATEGORY_ICON };
}
