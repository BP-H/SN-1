<!--
STRICTLY A SOCIAL MEDIA PLATFORM
Intellectual Property & Artistic Inspiration
Legal & Ethical Safeguards
-->
# Video Chat Translation Module Plan

This document sketches a roadmap for integrating real-time communication features with translation and enhanced interactivity.

## Overview

The module aims to provide video chat with live translation, lip-sync overlays, voice cloning, AR effects, transcription, gestural commands, emotion cues, noise suppression, and real-time collaboration tools.

## Components

1. **Integrated Video Chat** – Build or integrate a WebRTC-based system for peer-to-peer or group calls. Screen sharing and recording should be supported.
2. **Live Translation** – Use a cloud translation API or on-device model to provide subtitles or synthesized audio in the participant's chosen language.
3. **Lip-Sync Overlay** – Apply a pre-trained model that adjusts mouth movements to match translated speech.
4. **AI Voice Cloning** – Capture a speaker profile and generate translated audio using their voice via TTS.
5. **AR Filters** – Allow participants to apply masks, backgrounds, or effects during calls.
6. **Transcription & Recording** – Store call transcripts and optional video recordings for later review.
7. **Gestural Commands** – Detect basic hand gestures or facial expressions to trigger mute, unmute, or recording actions.
8. **Emotion Detection** – Provide visual indicators of sentiment or tone using facial or voice cues.
9. **AI Noise Suppression** – Filter background noise and enhance vocal clarity.
10. **Real-Time Co-Working** – Offer collaborative whiteboards, shared notes, or screen annotations with AI summarization of meeting minutes.

## Next Steps

- Evaluate open-source WebRTC libraries and select one for integration.
- Research translation APIs that provide low latency streaming and investigate model-based alternatives for offline use.
- Prototype lip-sync and voice cloning using small sample datasets.
- Add a demo interface that layers AR filters and records the session for later playback.
- Design REST or websocket endpoints for these features and document them under `docs/routes.md`.


## Implementation Details

- The `video_chat_router` exposes a `/ws/video` WebSocket for session signaling.
- `realtime_comm.video_chat.VideoChatManager` manages active streams and provides
  methods to translate audio using Google TTS when available.
- Translation overlays are updated in real time and synthesized speech is played
  back through `pygame` when audio output is enabled.
- A demo page lives in `transcendental_resonance_frontend/tr_pages/video_chat.py`
  which starts and stops sessions via the router.

## Configuration Steps

1. Install optional packages for voice and translation:
   ```bash
   pip install gtts pygame googletrans==4.0.0rc1
   ```
2. Set a `TRANSLATION_API_KEY` environment variable if using a cloud provider.
3. Start the backend API:
   ```bash
   uvicorn superNova_2177:app --reload --port 8000
   ```
4. Launch the Streamlit UI and open the **Video Chat** page:
   ```bash
     USE_REAL_BACKEND=1 streamlit run ui.py
   ```
5. Click **Start Session** to begin a call and choose the target language for
   live subtitles and voice.
