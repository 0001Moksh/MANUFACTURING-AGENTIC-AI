import math
import struct
import numpy as np

from app.voice.config import voice_config


class EnergyVAD:
    """
    Energy-based Voice Activity Detector (VAD).
    Computes RMS energy per PCM frame to detect speech start/stop events.

    Configuration is pulled from voice_config so thresholds can be tuned
    via environment variables without code changes.
    """

    def __init__(
        self,
        sample_rate: int = None,
        threshold: float = None,
        min_speech_frames: int = None,
        min_silence_frames: int = None,
    ):
        # Fall back to centralized config defaults if not explicitly overridden
        self.sample_rate = sample_rate or voice_config.vad.sample_rate
        self.threshold = threshold or voice_config.vad.threshold
        self.min_speech_frames = min_speech_frames or voice_config.vad.min_speech_frames
        self.min_silence_frames = min_silence_frames or voice_config.vad.min_silence_frames

        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def process_frame(self, pcm_data: bytes) -> str:
        """
        Process a raw 16-bit PCM frame.

        Returns:
            "speech_started"  — speech onset detected
            "speech_stopped"  — end of speech detected
            None              — no state change
        """
        if not pcm_data:
            return None

        try:
            audio_data = np.frombuffer(pcm_data, dtype=np.int16)
        except ValueError:
            return None

        if len(audio_data) == 0:
            return None

        # Normalise to [-1.0, 1.0] and compute RMS energy
        audio_f32 = audio_data.astype(np.float32) / 32768.0
        rms = np.sqrt(np.mean(np.square(audio_f32)))

        if rms > self.threshold:
            self.speech_frames += 1
            self.silence_frames = 0
        else:
            self.silence_frames += 1
            self.speech_frames = 0

        event = None

        if not self.is_speaking and self.speech_frames >= self.min_speech_frames:
            self.is_speaking = True
            event = "speech_started"

        if self.is_speaking and self.silence_frames >= self.min_silence_frames:
            self.is_speaking = False
            event = "speech_stopped"

        return event
