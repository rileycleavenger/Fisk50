declare module 'react-speech-kit' {
    export function useSpeechSynthesis(): {
      speak: (options: { text: string }) => void;
    };
  }