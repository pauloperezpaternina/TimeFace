export const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Cancel any ongoing speech

  const utterance = new SpeechSynthesisUtterance(text);
  
  const setVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    // Intentar buscar una voz femenina en español (nombres comunes de voces de MS/Google)
    let femaleSpanishVoice = voices.find(v => 
      v.lang.startsWith('es') && 
      (v.name.includes('Sabina') || v.name.includes('Helena') || v.name.includes('Laura') || 
       v.name.includes('Paulina') || v.name.includes('Monica') || v.name.includes('Google español') ||
       v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('mujer'))
    );

    // Fallback: cualquier voz en español
    if (!femaleSpanishVoice) {
      femaleSpanishVoice = voices.find(v => v.lang.startsWith('es'));
    }

    if (femaleSpanishVoice) {
      utterance.voice = femaleSpanishVoice;
    }
    
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.2; // Un tono un poco más agudo ayuda si la voz por defecto no es muy femenina
    
    window.speechSynthesis.speak(utterance);
  };

  // En algunos navegadores las voces cargan de forma asíncrona
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
    // Si después de 50ms no cambian, intentar hablar con la voz por defecto
    setTimeout(() => {
        if (window.speechSynthesis.getVoices().length === 0) {
            utterance.lang = 'es-ES';
            utterance.pitch = 1.2;
            window.speechSynthesis.speak(utterance);
        }
    }, 50);
  } else {
    setVoiceAndSpeak();
  }
};
