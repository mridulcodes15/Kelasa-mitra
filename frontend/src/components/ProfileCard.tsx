import { motion, AnimatePresence } from 'framer-motion';
import type { WorkerProfile } from '../lib/types';
import type { LangCode } from '../lib/types';
import { t } from '../lib/i18n';
import { skillName } from '../lib/skills';

interface SkillBadgeProps {
  label: string;
}

function SkillBadge({ label }: SkillBadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full mr-1 mb-1"
    >
      {label}
    </motion.span>
  );
}

interface ProfileRow {
  icon: string;
  label: string;
  value: string;
}

function ProfileRowItem({ icon, label, value }: ProfileRow) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 py-3 border-b border-stone-100 last:border-0"
    >
      <span className="text-2xl w-8 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-[#5a6475] font-medium uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-[#1a1a2e] font-semibold text-sm">{value}</p>
      </div>
    </motion.div>
  );
}

interface ProfileCardProps {
  profile: WorkerProfile;
  lang: LangCode;
  isLoading?: boolean;
}

export function ProfileCard({ profile, lang, isLoading }: ProfileCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-md p-6 w-full max-w-sm mx-auto animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-1/3 mb-4" />
        <div className="h-3 bg-stone-100 rounded w-full mb-2" />
        <div className="h-3 bg-stone-100 rounded w-2/3 mb-2" />
      </div>
    );
  }

  const rows: ProfileRow[] = [];

  if (profile.experience_years !== null) {
    rows.push({
      icon: '📅',
      label: t(lang, 'expLabel'),
      value: `${profile.experience_years} ${profile.experience_years === 1 ? 'year' : 'years'}`,
    });
  }

  if (profile.area) {
    rows.push({ icon: '📍', label: t(lang, 'areaLabel'), value: profile.area.name });
  }

  if (profile.languages.length > 0) {
    rows.push({
      icon: '🗣',
      label: t(lang, 'langsLabel'),
      value: profile.languages.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(', '),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-3xl shadow-md p-6 w-full max-w-sm mx-auto"
    >
      <h2 className="text-lg font-bold text-[#0d6e6e] mb-4">{t(lang, 'profileTitle')}</h2>

      {/* Skill chips */}
      {profile.skills.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-[#5a6475] font-medium uppercase tracking-wide mb-2">
            {t(lang, 'skillsLabel')}
          </p>
          <AnimatePresence>
            {profile.skills.map((s) => (
              <SkillBadge key={s} label={skillName(s, lang)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info rows */}
      {rows.map((row) => (
        <ProfileRowItem key={row.label} {...row} />
      ))}
    </motion.div>
  );
}
