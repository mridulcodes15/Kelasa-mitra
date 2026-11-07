import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { Landing } from './pages/Landing';
import { Jobs } from './pages/Jobs';

export default function App() {
  const { screen } = useAppStore();

  return (
    // reducedMotion="user" turns off Framer Motion transforms for prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
