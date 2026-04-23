# pages/music.py
import streamlit as st
import numpy as np
from io import BytesIO
import wave

def generate_wav(tone_freq=440, duration=5, sample_rate=44100):
    """Generate a simple sine wave tone as WAV bytes."""
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    tone = np.sin(tone_freq * t * 2 * np.pi)
    audio = tone * (2**15 - 1) / np.max(np.abs(tone))  # 16-bit scale
    audio = audio.astype(np.int16)
    buf = BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)  # Mono
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(audio.tobytes())
    return buf.getvalue()

def main():
    st.markdown("### Music")
    st.write("Placeholder music player – generating a simple tone.")
    
    # Generate and play simple tone
    wav_bytes = generate_wav()
    st.audio(wav_bytes, format="audio/wav")
    
    # Controls (placeholder)
    tone_freq = st.slider("Tone Frequency (Hz)", min_value=220, max_value=880, value=440)
    if st.button("Play Custom Tone"):
        custom_wav = generate_wav(tone_freq=tone_freq)
        st.audio(custom_wav, format="audio/wav")

if __name__ == "__main__":
    main()
