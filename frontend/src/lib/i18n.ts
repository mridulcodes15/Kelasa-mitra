import type { LangCode } from './types';

type StringKey =
  | 'appName'
  | 'tagline'
  | 'tapToSpeak'
  | 'orType'
  | 'typeHere'
  | 'listening'
  | 'findJobs'
  | 'profileTitle'
  | 'skillsLabel'
  | 'expLabel'
  | 'areaLabel'
  | 'langsLabel'
  | 'noMicPermission'
  | 'micNotSupported';

const strings: Record<LangCode, Record<StringKey, string>> = {
  en: {
    appName: 'Kelasa Mitra',
    tagline: 'Work Friend — Find jobs near you',
    tapToSpeak: 'Tap to Speak',
    orType: 'or type below',
    typeHere: 'Tell us about your work…',
    listening: 'Listening…',
    findJobs: 'Find Jobs for Me →',
    profileTitle: 'Your Profile',
    skillsLabel: 'Skills',
    expLabel: 'Experience',
    areaLabel: 'Location',
    langsLabel: 'Languages',
    noMicPermission: 'Microphone access denied. Please type instead.',
    micNotSupported: 'Voice not supported on this browser. Please type instead.',
  },
  kn: {
    appName: 'ಕೆಲಸ ಮಿತ್ರ',
    tagline: 'ಕೆಲಸದ ಸ್ನೇಹಿತ — ನಿಮ್ಮ ಹತ್ತಿರ ಕೆಲಸ ಹುಡುಕಿ',
    tapToSpeak: 'ಮಾತನಾಡಿ',
    orType: 'ಅಥವಾ ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ',
    typeHere: 'ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಹೇಳಿ…',
    listening: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…',
    findJobs: 'ಕೆಲಸ ಹುಡುಕಿ →',
    profileTitle: 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್',
    skillsLabel: 'ಕೌಶಲ್ಯಗಳು',
    expLabel: 'ಅನುಭವ',
    areaLabel: 'ಸ್ಥಳ',
    langsLabel: 'ಭಾಷೆಗಳು',
    noMicPermission: 'ಮೈಕ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.',
    micNotSupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.',
  },
  hi: {
    appName: 'केलस मित्र',
    tagline: 'काम का दोस्त — पास में काम खोजें',
    tapToSpeak: 'बोलने के लिए टैप करें',
    orType: 'या नीचे टाइप करें',
    typeHere: 'अपने काम के बारे में बताएं…',
    listening: 'सुन रहा हूँ…',
    findJobs: 'मेरे लिए काम खोजें →',
    profileTitle: 'आपकी प्रोफ़ाइल',
    skillsLabel: 'कौशल',
    expLabel: 'अनुभव',
    areaLabel: 'स्थान',
    langsLabel: 'भाषाएँ',
    noMicPermission: 'माइक्रोफ़ोन अनुमति अस्वीकार। कृपया टाइप करें।',
    micNotSupported: 'इस ब्राउज़र में आवाज़ समर्थित नहीं। कृपया टाइप करें।',
  },
};

export function t(lang: LangCode, key: StringKey): string {
  return strings[lang]?.[key] ?? strings.en[key];
}
