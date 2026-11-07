interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  label: string;
}

export function MicButton({ isListening, onClick, label }: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      {/* Animated pulse rings — hidden when not listening */}
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full bg-[#0d6e6e] opacity-20 mic-ring" />
          <span className="absolute inset-0 rounded-full bg-[#0d6e6e] opacity-15 mic-ring-2" />
          <span className="absolute inset-0 rounded-full bg-[#0d6e6e] opacity-10 mic-ring-3" />
        </>
      )}

      {/* Main orb */}
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={isListening}
        className={[
          'relative z-10 w-32 h-32 rounded-full flex items-center justify-center',
          'text-white text-5xl transition-all duration-200 shadow-lg touch-target',
          isListening
            ? 'bg-red-500 scale-110 mic-orb-pulse'
            : 'bg-[#0d6e6e] hover:bg-[#0f9d9d] active:scale-95',
        ].join(' ')}
      >
        {isListening ? '⏹' : '🎙'}
      </button>
    </div>
  );
}
