import { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { Landing } from './pages/Landing';
import { Jobs } from './pages/Jobs';
import { useSkipAnimationsWhenReduced } from './lib/motion';

export default function App() {
  const { screen, lang } = useAppStore();
  useSkipAnimationsWhenReduced();

  // Screen readers pick their voice from <html lang>; keep it in step with the picker.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    // reducedMotion="user" turns off Framer Motion transforms for prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      {/* Phones: full width. Wider screens: a centred phone-width column on a soft backdrop. */}
      <div className="app-backdrop min-h-screen">
      <div data-testid="app-column" className="app-column relative mx-auto w-full page-min-h bg-[#fdf8f0]">
      <AnimatePresence mode="wait">
        {screen === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <Landing />
          </motion.div>
        ) : (
          <motion.div
            key="jobs"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
          >
            <Jobs />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      </div>
    </MotionConfig>
  );
}
