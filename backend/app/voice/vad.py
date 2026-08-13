import math
import struct
import numpy as np

class EnergyVAD:
    """
    A simple energy-based Voice Activity Detector (VAD).
    Computes RMS (Root Mean Square) energy of the PCM audio frame.
    If the energy is above a threshold for `min_speech_frames`, it signals speech.
    If it stays below the threshold for `min_silence_frames`, it signals silence.
    """
    def __init__(self, sample_rate=16000, threshold=0.015, min_speech_frames=3, min_silence_frames=5):
        self.sample_rate = sample_rate
        self.threshold = threshold
        self.min_speech_frames = min_speech_frames
        self.min_silence_frames = min_silence_frames
        
        self.speech_frames = 0
        self.silence_frames = 0
        self.is_speaking = False

    def process_frame(self, pcm_data: bytes) -> str:
        """
        Process a raw 16-bit PCM frame.
        Returns:
            "speech_started" if speech just began
            "speech_stopped" if silence just began
            None otherwise
        """
        if not pcm_data:
            return None
            
        # Convert raw bytes to 16-bit integers
        # Using numpy is much faster for this
        try:
            audio_data = np.frombuffer(pcm_data, dtype=np.int16)
        except ValueError:
            return None
            
        if len(audio_data) == 0:
            return None
            
        # Convert to float to avoid overflow during square
        audio_data = audio_data.astype(np.float32) / 32768.0
        
        # Calculate RMS energy
        rms = np.sqrt(np.mean(np.square(audio_data)))
        
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

