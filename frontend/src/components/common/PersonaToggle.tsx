import React from 'react';

interface PersonaToggleProps {
  persona: 'both' | 'mfg' | 'it';
  setPersona: (p: 'both' | 'mfg' | 'it') => void;
}

export const PersonaToggle: React.FC<PersonaToggleProps> = ({ persona, setPersona }) => {
  return (
    <div className="flex bg-canvas border border-border-color rounded-[9px] p-[3px] gap-[2px]">
      <button
        onClick={() => setPersona('both')}
        className={`border-none bg-transparent py-[7px] px-[12px] text-[12px] font-semibold rounded-[7px] transition-colors cursor-pointer ${
          persona === 'both' ? 'bg-navy-900 text-white' : 'text-muted hover:text-ink hover:bg-black/5'
        }`}
      >
        Both
      </button>
      <button
        onClick={() => setPersona('mfg')}
        className={`border-none bg-transparent py-[7px] px-[12px] text-[12px] font-semibold rounded-[7px] transition-colors cursor-pointer ${
          persona === 'mfg' ? 'bg-navy-900 text-white' : 'text-muted hover:text-ink hover:bg-black/5'
        }`}
      >
        Manufacturing Head
      </button>
      <button
        onClick={() => setPersona('it')}
        className={`border-none bg-transparent py-[7px] px-[12px] text-[12px] font-semibold rounded-[7px] transition-colors cursor-pointer ${
          persona === 'it' ? 'bg-navy-900 text-white' : 'text-muted hover:text-ink hover:bg-black/5'
        }`}
      >
        Digital & IT Head
      </button>
    </div>
  );
};
