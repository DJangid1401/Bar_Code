import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { isSpeechRecognitionSupported } from '../utils/voiceHelper';

export interface VoiceSearchButtonProps {
  onTranscript: (transcript: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  buttonTitle?: string;
  lang?: string;
  onListeningStateChange?: (isListening: boolean) => void;
}

// Window typing for Web Speech API
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
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

export default function VoiceSearchButton({
  onTranscript,
  className = '',
  size = 'md',
  buttonTitle = 'Voice Search (Bol kar search karein)',
  lang = 'en-IN',
  onListeningStateChange,
}: VoiceSearchButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = isSpeechRecognitionSupported();

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
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const spoken = event.results?.[0]?.[0]?.transcript || '';
        if (spoken.trim()) {
          onTranscript(spoken.trim());
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
  }, [lang, onTranscript]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
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

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        isListening
          ? 'Listening... Click to stop (Bol sakte hain...)'
          : !isSupported
          ? 'Voice search not supported in this browser'
          : buttonTitle
      }
      aria-label={buttonTitle}
      className={`relative inline-flex items-center justify-center rounded-xl transition-all cursor-pointer ${
        buttonPaddings[size]
      } ${
        isListening
          ? 'bg-red-600 text-white shadow-md shadow-red-200 scale-105'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200'
      } ${className}`}
    >
      {/* Animated ripple effect when listening */}
      {isListening && (
        <>
          <span className="absolute -inset-1 rounded-xl bg-red-500 opacity-40 animate-ping" />
          <span className="absolute -inset-0.5 rounded-xl bg-red-400 opacity-30 animate-pulse" />
        </>
      )}

      {isListening ? (
        <Mic size={iconSizes[size]} className="relative z-10 animate-pulse" />
      ) : isSupported ? (
        <Mic size={iconSizes[size]} className="relative z-10" />
      ) : (
        <MicOff size={iconSizes[size]} className="relative z-10 text-slate-400" />
      )}
    </button>
  );
}
