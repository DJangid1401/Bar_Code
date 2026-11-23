import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { isSpeechRecognitionSupported } from '../utils/voiceHelper';

export interface VoiceSearchButtonProps {
  onTranscript: (transcript: string, alternatives?: string[]) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  buttonTitle?: string;
  lang?: string;
  showLangToggle?: boolean;
  onListeningStateChange?: (isListening: boolean) => void;
}

// Window typing for Web Speech API
interface SpeechRecognitionResultAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: {
    length: number;
    [altIndex: number]: SpeechRecognitionResultAlternative;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const VOICE_LANG_STORAGE_KEY = 'swati_voice_search_lang';

export function getSavedVoiceLang(): string {
  try {
    return localStorage.getItem(VOICE_LANG_STORAGE_KEY) || 'en-IN';
  } catch {
    return 'en-IN';
  }
}

export function setSavedVoiceLang(l: string): void {
  try {
    localStorage.setItem(VOICE_LANG_STORAGE_KEY, l);
  } catch {
    // ignore
  }
}

export default function VoiceSearchButton({
  onTranscript,
  className = '',
  size = 'md',
  buttonTitle = 'Voice Search (Bol kar search karein)',
  lang,
  showLangToggle = false,
  onListeningStateChange,
}: VoiceSearchButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>(() => lang || getSavedVoiceLang());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    if (lang) {
      setCurrentLang(lang);
    }
  }, [lang]);

  // Notify parent component about listening state
  useEffect(() => {
    if (onListeningStateChange) {
      onListeningStateChange(isListening);
    }
  }, [isListening, onListeningStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechClass = getSpeechRecognitionClass();
    if (!SpeechClass) {
      alert(
        'Voice search is not supported in this browser.\nPlease use Google Chrome or Microsoft Edge to use voice search.'
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 5; // Get up to 5 alternative candidate transcripts
      recognition.lang = currentLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const alternatives: string[] = [];
        const firstResult = event.results?.[0];
        if (firstResult) {
          for (let i = 0; i < firstResult.length; i++) {
            const item = firstResult[i];
            if (item && item.transcript) {
              alternatives.push(item.transcript.trim());
            }
          }
        }

        const primarySpoken = alternatives[0] || '';
        if (primarySpoken) {
          onTranscript(primarySpoken, alternatives);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          alert(
            'Microphone access is blocked.\nPlease allow microphone permission in your browser address bar to use voice search.'
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Voice recognition error:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
    }
  }, [currentLang, onTranscript]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleToggleLang = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextLang = currentLang === 'en-IN' ? 'hi-IN' : 'en-IN';
    setCurrentLang(nextLang);
    setSavedVoiceLang(nextLang);
  };

  const iconSizes = {
    sm: 15,
    md: 18,
    lg: 22,
  };

  const buttonPaddings = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  if (!isSupported) {
    return (
      <div
        className={`inline-flex items-center text-slate-300 opacity-60 cursor-not-allowed ${className}`}
        title="Voice search is not supported in this browser (use Chrome or Edge)"
      >
        <MicOff size={iconSizes[size]} />
      </div>
    );
  }

  const isHindi = currentLang.startsWith('hi');

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {showLangToggle && (
        <button
          type="button"
          onClick={handleToggleLang}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          title={`Click to switch speech language (Current: ${isHindi ? 'Hindi' : 'English'})`}
        >
          {isHindi ? 'HI' : 'EN'}
        </button>
      )}

      <button
        type="button"
        onClick={handleToggle}
        title={
          isListening
            ? 'Listening... Click to stop (Sun rahe hain...)'
            : `${buttonTitle} [${isHindi ? 'Hindi' : 'English'}]`
        }
        aria-label={buttonTitle}
        className={`relative inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
          buttonPaddings[size]
        } ${
          isListening
            ? 'bg-red-500 text-white shadow-lg ring-4 ring-red-200 animate-pulse scale-105'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        }`}
      >
        {isListening ? (
          <>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <Mic size={iconSizes[size]} className="animate-bounce" />
          </>
        ) : (
          <Mic size={iconSizes[size]} />
        )}
      </button>
    </div>
  );
}
