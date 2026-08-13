import os
import io
import wave
from typing import AsyncGenerator
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

# We need the GROQ API key for STT and LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Initialize the Groq client
client = AsyncGroq(api_key=GROQ_API_KEY)

async def transcribe_audio(pcm_data: bytes, sample_rate: int = 16000) -> str:
    """
    Takes raw PCM audio, converts it to a WAV file in memory, 
    and sends it to Groq Whisper for transcription.
    """
    if not pcm_data:
        return ""
        
    # Create in-memory WAV file
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2) # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
        
    wav_io.seek(0)
    
    try:
        # Pass the bytes directly to Groq Whisper API
        transcription = await client.audio.transcriptions.create(
            file=("audio.wav", wav_io.read()),
            model="whisper-large-v3",
            prompt="Specify context if needed.",
            response_format="text"
        )
        # the response might be a string if response_format="text"
        return str(transcription).strip()
    except Exception as e:
        print(f"STT Error: {e}")
        return ""

async def stream_llm_response(prompt: str, history: list = None) -> AsyncGenerator[str, None]:
    """
    Streams a response from Groq LLM (llama-3-8b or 70b).
    history is a list of {"role": "user"/"assistant", "content": "..."}
    """
    if history is None:
        history = []
        
    messages = [
        {"role": "system", "content": "You are a helpful Voice Assistant. You MUST respond in the EXACT same language the user spoke in. If responding in Hindi, YOU MUST USE THE DEVANAGARI SCRIPT (e.g., नमस्ते), NEVER use Latin/English script for Hindi. Keep your answers EXTREMELY short and conversational (1 sentence max). Do not use markdown or parentheses."}
    ] + history + [{"role": "user", "content": prompt}]
    
    try:
        stream = await client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant", # Fast inference model
            temperature=0.5,
            max_tokens=256,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        print(f"LLM Stream Error: {e}")
        yield "I encountered an error while thinking."
