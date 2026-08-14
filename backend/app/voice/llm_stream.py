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

async def stream_llm_response(prompt: str, history: list = None, agent_context: str = "") -> AsyncGenerator[str, None]:
    """
    Streams a voice-optimized response from Groq LLM (llama-3.1-8b-instant).
    Converts rich agent database findings into concise, spoken 1-2 sentence speech.
    """
    if history is None:
        history = []

    system_instruction = (
        "You are Deva, the voice interaction layer for Industrial AI Agents (created by Moksh Bhardwaj). "
        "Your job is to speak the operational answers directly to the user (addressing them respectfully as 'sir'). "
        "RULES FOR VOICE OUTPUT:\n"
        "1. MUST respond in the EXACT same language the user spoke in (English or Hindi).\n"
        "2. If responding in Hindi, YOU MUST USE DEVANAGARI SCRIPT (e.g., नमस्ते सर, आज २ सुरक्षा नियम उल्लंघन हुए हैं). NEVER use Latin/English alphabets for Hindi.\n"
        "3. Keep answers EXTREMELY short and natural for speech (1 to 2 spoken sentences maximum).\n"
        "4. Summarize key figures, alerts, or status numbers clearly. DO NOT use markdown, tables, bullet points, asterisks (*), hashtags, or parentheses, as this text will be read aloud by Text-to-Speech.\n"
    )

    user_content = prompt
    if agent_context:
        user_content = f"{prompt}\n\n[Agent Ground-Truth Database Insights]:\n{agent_context}\n\n[Task]: Speak a 1-2 sentence spoken summary of this ground-truth data for the user."

    messages = [
        {"role": "system", "content": system_instruction}
    ] + history + [{"role": "user", "content": user_content}]

    try:
        stream = await client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",
            temperature=0.3,
            max_tokens=200,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        print(f"LLM Stream Error: {e}")
        yield "Sir, I encountered an issue retrieving the live agent data."

