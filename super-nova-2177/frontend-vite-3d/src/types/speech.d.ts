// src/types/speech.d.ts
// Minimal shim so TS knows about webkitSpeechRecognition.
// DO NOT redeclare speechSynthesis here.
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}
export {};
