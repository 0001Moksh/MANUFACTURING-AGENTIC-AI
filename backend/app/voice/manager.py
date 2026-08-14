import asyncio
import uuid
import json
import string
from fastapi import WebSocket
from app.voice.vad import EnergyVAD
from app.voice.llm_stream import transcribe_audio, stream_llm_response
from app.voice.tts_stream import stream_tts
from app.voice.turn_detection import is_actual_interruption
from app.voice.agent_router import execute_agent_query

class VoiceConversationManager:
    def __init__(self, websocket: WebSocket, agent_id: str = "auto"):
        self.ws = websocket
        self.agent_id = agent_id or "auto"
        self.state = "IDLE"
        self.vad = EnergyVAD(threshold=0.01) # adjust threshold as needed
        
        self.current_generation_id = None
        self.llm_task = None
        
        self.audio_buffer = bytearray()
        self.history = []
        
        # To track what the user actually heard
        self.generated_text_so_far = ""
        self.played_text = ""

    async def set_agent(self, new_agent_id: str):
        self.agent_id = new_agent_id or "auto"
        await self._log(f"Active agent switched to: {self.agent_id}")

    async def _log(self, msg: str):
        print(f"[VOICE] {msg}")

    async def handle_audio_frame(self, pcm_data: bytes):
        """Called every time a binary audio chunk is received from the frontend"""
        event = self.vad.process_frame(pcm_data)
        
        if event == "speech_started":
            await self._log(f"speech_started (state: {self.state})")
            if self.state == "SPEAKING":
                # BARGE-IN DETECTED
                await self.handle_interruption()
            self.state = "LISTENING"
            self.audio_buffer = bytearray() # Clear buffer for new speech
            
        if self.state == "LISTENING" or self.state == "INTERRUPTING":
            self.audio_buffer.extend(pcm_data)
            
        if event == "speech_stopped":
            await self._log(f"speech_stopped. Buffer size: {len(self.audio_buffer)}")
            self.state = "PROCESSING_NEW_TURN"
            # Process the utterance
            asyncio.create_task(self.process_turn(bytes(self.audio_buffer)))

    async def handle_interruption(self):
        self.state = "INTERRUPTING"
        await self._log("INTERRUPTION_DETECTED")
        
        # 1. Cancel the active generation
        if self.llm_task and not self.llm_task.done():
            self.llm_task.cancel()
            await self._log("RESPONSE_CANCELLED")
            
        # 2. Stop TTS on frontend
        self.current_generation_id = str(uuid.uuid4())
        await self.ws.send_text(json.dumps({
            "type": "stop_audio",
            "generation_id": self.current_generation_id
        }))
        
        # 3. Truncate conversation history
        # In a real system, the frontend sends back exact byte counts of what was played.
        # For simplicity, we just save what was generated up to the interruption minus a heuristic,
        # or rely on frontend text acks.
        self.history.append({"role": "assistant", "content": self.played_text})
        await self._log(f"AUDIO_TRUNCATED. Kept: {self.played_text}")

    async def process_turn(self, pcm_audio: bytes):
        self.state = "THINKING"
        
        # 1. Transcribe
        user_text = await transcribe_audio(pcm_audio)
        if not user_text.strip():
            self.state = "IDLE"
            return
            
        # Whisper Hallucination Filter
        normalized = user_text.lower().strip().translate(str.maketrans('', '', string.punctuation))
        if normalized in ['thank you', 'thanks', 'thank u', 'thanks for watching'] and len(user_text) < 25:
            await self._log(f"Filtered out hallucination: '{user_text}'")
            self.state = "IDLE"
            return
            
        await self._log(f"User: {user_text}")
        
        # 2. Semantic turn detection (if interrupted)
        if len(self.history) > 0 and self.history[-1]["role"] == "assistant":
            # Was this an actual interruption or just a backchannel?
            if not is_actual_interruption(user_text):
                await self._log(f"Backchannel detected ('{user_text}'). Ignoring.")
                self.state = "IDLE"
                return
                
        self.history.append({"role": "user", "content": user_text})
        await self.ws.send_text(json.dumps({"type": "transcript", "text": user_text, "role": "user"}))
        
        # 3. Start LLM & TTS
        self.current_generation_id = str(uuid.uuid4())
        gen_id = self.current_generation_id
        
        self.llm_task = asyncio.create_task(self.run_llm_tts_pipeline(user_text, gen_id))

    async def process_text_turn(self, user_text: str):
        """Processes a typed query: executes the agent tool pipeline and speaks back the response."""
        if not user_text or not user_text.strip():
            return
            
        self.state = "THINKING"
        await self._log(f"User (Typed Query): {user_text}")
        
        # Cancel any previous ongoing speech/generation
        if self.llm_task and not self.llm_task.done():
            self.llm_task.cancel()
            
        self.history.append({"role": "user", "content": user_text})
        await self.ws.send_text(json.dumps({"type": "transcript", "text": user_text, "role": "user"}))
        
        self.current_generation_id = str(uuid.uuid4())
        gen_id = self.current_generation_id
        
        self.llm_task = asyncio.create_task(self.run_llm_tts_pipeline(user_text, gen_id))

    async def run_llm_tts_pipeline(self, prompt: str, gen_id: str):
        self.state = "SPEAKING"
        self.generated_text_so_far = ""
        self.played_text = ""
        
        try:
            # Query the multi-agent router to execute specialized agent tools
            agent_res = await execute_agent_query(
                prompt=prompt,
                agent_id=self.agent_id,
                thread_id=f"voice-session-{self.agent_id}"
            )
            
            # Send notification to UI about which agent answered
            await self.ws.send_text(json.dumps({
                "type": "agent_routed",
                "agent_id": agent_res["agent_id"],
                "agent_name": agent_res["agent_name"]
            }))
            
            db_insights = agent_res.get("reply", "")
            await self._log(f"Agent ({agent_res['agent_name']}) returned {len(db_insights)} chars of insights.")
                
            sentence_buffer = ""
            async for text_chunk in stream_llm_response(
                prompt=prompt,
                history=self.history[:-1],
                agent_context=db_insights
            ):
                if self.current_generation_id != gen_id:
                    return # Interrupted
                    
                sentence_buffer += text_chunk
                self.generated_text_so_far += text_chunk
                
                # Send text chunk to frontend for UI display
                await self.ws.send_text(json.dumps({
                    "type": "agent_text_chunk",
                    "text": text_chunk,
                    "generation_id": gen_id
                }))
                
                # Punctuation-based chunking for TTS
                if any(p in sentence_buffer for p in ['.', '!', '?', '\n']):
                    # Send to TTS
                    async for audio_chunk in stream_tts(sentence_buffer):
                        if self.current_generation_id != gen_id:
                            return # Interrupted during TTS
                        # Send audio over WS
                        # We send a JSON header, then the binary payload, or just use binary frames 
                        # prefixed with generation_id. For simplicity, send JSON with base64, OR binary.
                        # Binary is better for latency. We'll send JSON with a type indicator, 
                        # but in FastAPI you can just send bytes.
                        # Let's send JSON with base64 for simplicity of mixing control and data.
                        import base64
                        b64_audio = base64.b64encode(audio_chunk).decode('utf-8')
                        await self.ws.send_text(json.dumps({
                            "type": "audio_chunk",
                            "audio": b64_audio,
                            "generation_id": gen_id
                        }))
                        
                    sentence_buffer = ""
                    
            # Flush remaining TTS
            if sentence_buffer.strip() and self.current_generation_id == gen_id:
                async for audio_chunk in stream_tts(sentence_buffer):
                    if self.current_generation_id != gen_id:
                        return
                    import base64
                    b64_audio = base64.b64encode(audio_chunk).decode('utf-8')
                    await self.ws.send_text(json.dumps({
                        "type": "audio_chunk",
                        "audio": b64_audio,
                        "generation_id": gen_id
                    }))
                    
            if self.current_generation_id == gen_id:
                self.history.append({"role": "assistant", "content": self.generated_text_so_far})
                self.state = "IDLE"
                
        except asyncio.CancelledError:
            await self._log("LLM Task Cancelled explicitly.")
        except Exception as e:
            await self._log(f"Pipeline error: {e}")
            self.state = "IDLE"

