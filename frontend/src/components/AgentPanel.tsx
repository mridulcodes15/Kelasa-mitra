import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';

interface AgentPanelProps {
  /** Text already on screen (e.g. the follow-up card); an identical agent reply is not repeated. */
  hideReplyEqualTo?: string | null;
}

/**
 * Shows the IBM watsonx Orchestrate agent's reply, or a banner when the built-in rules
 * answered instead. Job and skill-gap cards never come from this text.
 */
export function AgentPanel({ hideReplyEqualTo }: AgentPanelProps) {
  const { lang, agentReply, isAskingAgent } = useAppStore();

  if (isAskingAgent) {
    return (
      <p role="status" className="mx-auto max-w-sm text-xs text-[#5a6475] animate-pulse motion-reduce:animate-none">
        {t(lang, 'agentThinking')}
      </p>
    );
  }
  if (!agentReply) return null;

  if (agentReply.source === 'rules') {
    return (
      <p role="status" className="mx-auto max-w-sm text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        {t(lang, 'agentOffline')}
      </p>
    );
  }

  const reply = agentReply.reply?.trim();
  if (!reply || reply === hideReplyEqualTo?.trim()) return null;

  return (
    <section
      aria-label={t(lang, 'agentLabel')}
      className="mx-auto max-w-sm bg-white rounded-3xl shadow-md p-4 border border-[#0d6e6e]/30"
    >
      <p className="text-xs font-semibold text-[#0d6e6e] mb-2">🤖 {t(lang, 'agentLabel')}</p>
      <p className="text-sm text-[#1a1a2e] whitespace-pre-line">{reply}</p>
      <p className="text-xs text-[#5a6475] italic mt-2">{t(lang, 'sampleData')}</p>
    </section>
  );
}
