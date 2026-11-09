import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { AGENT_STEPS } from '../lib/agentSteps';

interface AgentPanelProps {
  /** Text already on screen (e.g. the follow-up card); an identical agent reply is not repeated. */
  hideReplyEqualTo?: string | null;
  /**
   * The rules' "not recognised" card is on screen with its skill chips. The agent's own text
   * would ask the same thing in other words (often the old generic question), so it is not shown.
   */
  preferRulesMessage?: boolean;
}

/**
 * Shows the IBM watsonx Orchestrate agent's reply, or a banner when the built-in rules
 * answered instead. Job and skill-gap cards never come from this text.
 */
export function AgentPanel({ hideReplyEqualTo, preferRulesMessage = false }: AgentPanelProps) {
  const { lang, agentReply, isAskingAgent, askedQuestions } = useAppStore();

  if (isAskingAgent) {
    return (
      <div className="mx-auto max-w-sm bg-white/70 rounded-2xl border border-[#0d6e6e]/20 px-3 py-2" data-agent-thinking>
        <p role="status" className="text-xs text-[#5a6475]">{t(lang, 'agentThinking')}</p>
        {/* The dots move in turn as a waiting sign; they do not show which step is running. */}
        <ol aria-label={t(lang, 'agentStepsLabel')} className="mt-2 grid grid-cols-3 gap-2">
          {AGENT_STEPS.map((step, i) => (
            <li key={step.tool} className="flex flex-col items-center text-center gap-1 min-w-0">
              <span
                aria-hidden="true"
                className="thinking-dot block h-2.5 w-2.5 rounded-full bg-[#0d6e6e]"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
              <span className="text-xs font-semibold text-[#1a1a2e] leading-tight break-words">{t(lang, step.label)}</span>
              <code className="text-[10px] text-[#5a6475] break-all">{step.tool}</code>
            </li>
          ))}
        </ol>
      </div>
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
  if (!reply || reply === hideReplyEqualTo?.trim() || preferRulesMessage) return null;
  // A follow-up question the app already asked is either on screen or already answered (the
  // worker may be looking at jobs): never show it again here.
  if (askedQuestions.includes(reply)) return null;

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
