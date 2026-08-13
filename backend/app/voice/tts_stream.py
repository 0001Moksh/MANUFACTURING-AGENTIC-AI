import re
import edge_tts
from typing import AsyncGenerator

EN_VOICE = "en-US-ChristopherNeural" # Professional male voice
HI_VOICE = "hi-IN-MadhurNeural"      # Professional Hindi male voice

def is_hindi(text: str) -> bool:
    """Checks if the text contains Devanagari characters."""
    return bool(re.search(r'[\u0900-\u097F]', text))

async def stream_tts(text: str) -> AsyncGenerator[bytes, None]:
    """
    Streams text into audio chunks using Microsoft Edge TTS.
    Automatically switches to a Hindi voice if Devanagari text is detected.
    """
    if not text.strip():
        return
        
    # Choose voice based on text content
    voice = HI_VOICE if is_hindi(text) else EN_VOICE
        
    communicate = edge_tts.Communicate(text, voice)
    
    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    except Exception as e:
        print(f"TTS Stream Error: {e}")

