# Architecture Diagram & System Design

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser/Mobile)                     │
│                          WebSocket Connection                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    Audio Frames + Text Queries
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   VoiceConversationManager (v2)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  State Machine (Atomic with Locks)                          │   │
│  │  - IDLE → LISTENING → PROCESSING → THINKING → SPEAKING      │   │
│  │  - INTERRUPTING (barge-in detection)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Audio Processing Pipeline                                  │   │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │   │
│  │  │ VAD (Voice  │ ─→ │ Audio Buffer │ ─→ │ Transcribe  │    │   │
│  │  │ Detection)  │    │ (Max 2MB)    │    │ (Groq)      │    │   │
│  │  └─────────────┘    └──────────────┘    └──────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  LLM Pipeline                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ Route Agent  │→ │ Execute      │→ │ Stream LLM   │       │   │
│  │  │ (Keyword)    │  │ Agent Query  │  │ Response     │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Resilience Layer                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ Circuit      │  │ Retry Policy │  │ Timeout      │       │   │
│  │  │ Breaker      │  │ (Exponential)│  │ Handler      │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Output Pipeline                                            │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐      │   │
│  │  │ Sentence    │ → │ TTS Streaming│ → │ Audio Chunks│      │   │
│  │  │ Batching    │   │ (Edge TTS)   │   │ (Base64)    │      │   │
│  │  └─────────────┘   └──────────────┘   └──────────────┘      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Observability                                              │   │
│  │  - JSON Structured Logging (via structlog)                  │   │
│  │  - Correlation IDs (Request Tracing)                        │   │
│  │  - Metrics Collection                                       │   │
│  │  - Error Tracking                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────┐          ┌──────────────┐         ┌──────────┐
    │  Groq   │          │  Edge TTS    │         │  Agents  │
    │  API    │          │  (Microsoft) │         │  (Async) │
    │ - STT   │          │              │         │          │
    │ - LLM   │          │  - EN Voice  │         │ - Safety │
    │         │          │  - HI Voice  │         │ - PPE    │
    └─────────┘          │  - Caching   │         │ - Maint. │
                         └──────────────┘         └──────────┘
```

---

## Component Breakdown

### 1. VoiceConversationManager (Core Orchestrator)

**Responsibilities:**
- Manages conversation state (IDLE, LISTENING, THINKING, SPEAKING)
- Handles audio frame processing with VAD
- Orchestrates transcription → routing → LLM → TTS pipeline
- Detects and handles user interruptions (barge-in)
- Manages WebSocket connection lifecycle
- Implements request tracing with correlation IDs

**Key Improvements:**
- ✅ **Atomic state transitions** (asyncio locks prevent race conditions)
- ✅ **Bounded audio buffer** (max 2MB, prevents OOM)
- ✅ **Proper task cleanup** (no orphaned async tasks)
- ✅ **Connection validation** (handles WebSocket disconnects gracefully)
- ✅ **History management** (trimmed to 50 turns, configurable)

**State Machine Flow:**
```
IDLE ──speech_started──> LISTENING
  ↑                          │
  │                    speech_stopped
  │                          │
  │                          ▼
  │              PROCESSING_NEW_TURN
  │                          │
  │                    transcribe()
  │                          │
  │                          ▼
  │                     THINKING
  │                          │
  │              query_agent() + stream_llm()
  │                          │
  │                          ▼
  │                    SPEAKING ────user_interrupts───> INTERRUPTING
  └──────────────────────────┘                              │
                              └─────────cancel_llm()────────┘
```

---

### 2. Audio Processing (VAD + Transcription)

**VAD (Voice Activity Detector):**
- Energy-based RMS detection
- Configurable threshold (default: 0.015)
- Debouncing to prevent micro-pause issues
- Buffer management (capped at 2MB)

**Transcription (Groq Whisper):**
- Async transcription with timeout (15s)
- Retry policy: exponential backoff (1s → 2s → 4s)
- Circuit breaker: Open after 5 failures
- Hallucination filtering (min length: 10 chars)

**Flow:**
```
Audio Frame (PCM)
    ↓
[VAD] Energy Check
    ├─ RMS > threshold → speech_started
    ├─ RMS < threshold → silence_frames++
    └─ silence_frames ≥ 8 → speech_stopped
    ↓
Buffer (Max 2MB)
    ↓
[Groq Whisper API]
    ├─ Timeout: 15s
    ├─ Retries: 3x with exponential backoff
    └─ Circuit Breaker: Open after 5 failures
    ↓
Text Output
```

---

### 3. Agent Routing

**Current:** Keyword-based classifier (fast, deterministic)
- PPE & CCTV keywords → PPE Vision Agent
- Quality & inspection → Safety & Quality Agent
- Maintenance & failure → Predictive Maintenance Agent
- Fallback → General Operations Agent

**Future:** ML-based classifier with confidence scores
- BERT fine-tuned on industrial vocabulary
- Confidence threshold (0.7); fallback if below
- Per-agent circuit breakers

---

### 4. LLM Streaming Pipeline

**Groq LLM (llama-3.1-8b-instant):**
- Streaming responses (token-by-token)
- System prompt: "You are Deva, industrial AI assistant"
- Supports English & Hindi (Devanagari script)
- Max tokens: 200 (configurable)
- Temperature: 0.3 (deterministic)

**Resilience:**
- Timeout: 30s per request
- Retry policy: 3x with exponential backoff
- Circuit breaker: Open after 5 failures
- Fallback response if circuit open

**Flow:**
```
Prompt + Agent Context
    ↓
[Circuit Breaker Check]
    ├─ OPEN → return fallback
    └─ CLOSED/HALF_OPEN → proceed
    ↓
[Retry Policy Loop]
    ├─ Attempt 1: [Timeout 30s]
    ├─ Attempt 2: [Wait 1s, Timeout 30s]
    ├─ Attempt 3: [Wait 2s, Timeout 30s]
    └─ Attempt 4: [Wait 4s, Timeout 30s]
    ↓
Stream LLM Response
    ├─ Yield chunks (character-by-character)
    └─ Check for interruption (generation_id)
    ↓
Text Output (1-2 sentences for voice)
```

---

### 5. Text-to-Speech (TTS) Pipeline

**Edge TTS (Microsoft):**
- English voice: en-US-ChristopherNeural
- Hindi voice: hi-IN-MadhurNeural
- Auto-detect language (Devanagari check)
- Response caching (optional, TTL: 1 hour)
- Timeout: 15s per request

**Optimization:**
- **Sentence batching:** Wait for 2+ sentences before calling TTS
- **Character limit:** Max 500 chars per TTS call
- **Caching:** Reduces duplicate requests
- **Concurrent streaming:** TTS + LLM stream in parallel

**Flow:**
```
LLM Text Stream (char-by-char)
    ↓
Sentence Buffer
    ├─ Accumulate until [.!?\n]
    └─ Check: ≥2 sentences OR ≥500 chars?
    ↓
[Edge TTS API]
    ├─ Timeout: 15s
    ├─ Cache: Optional (1 hour TTL)
    └─ Language: EN or HI (auto-detect)
    ↓
Audio Chunks (MP3/WAV)
    ↓
Base64 Encode
    ↓
Send via WebSocket
    ↓
Frontend: Decode → Play
```

---

### 6. Resilience Patterns

#### Circuit Breaker
```
States:
├─ CLOSED (normal): Pass requests through
├─ OPEN (failing): Reject immediately (fail-fast)
└─ HALF_OPEN (testing): Allow 1 request to test recovery

Transitions:
├─ CLOSED → OPEN: After 5 consecutive failures
├─ OPEN → HALF_OPEN: After 60s timeout
└─ HALF_OPEN → CLOSED: If recovery succeeds

Per-service circuit breakers:
├─ groq_circuit_breaker (STT/LLM)
├─ edge_tts_circuit_breaker (TTS)
└─ agent_circuit_breakers[agent_id] (per-agent)
```

#### Retry Policy
```
Exponential Backoff:
├─ Attempt 1: Immediate
├─ Attempt 2: Wait 1s
├─ Attempt 3: Wait 2s
└─ Attempt 4: Wait 4s

Max retries: 3 (configurable)
Max delay: 60s (configurable)
Backoff multiplier: 2.0x (configurable)

Applies to:
├─ Transcription (Groq Whisper)
└─ LLM streaming (Groq LLaMA)
```

#### Timeout Handling
```
Timeouts (configurable):
├─ Transcription: 15s
├─ LLM streaming: 30s
├─ TTS streaming: 15s
└─ Overall thinking: 45s

Behavior:
├─ Timeout → Raise asyncio.TimeoutError
├─ Error logged with operation name
└─ Retry policy triggered (if applicable)
```

---

### 7. Observability Layer

**Structured Logging (JSON):**
```json
{
  "timestamp": "2026-08-17T10:30:45.123Z",
  "correlation_id": "voice-a1b2c3d4",
  "request_id": "a1b2c3d4",
  "level": "INFO",
  "message": "Processing user turn",
  "turn": 1,
  "user_text": "how many defects today",
  "state": "thinking",
  "agent_id": "safety_quality",
  "latency_seconds": 2.34
}
```

**Request Tracing:**
- Correlation ID generated per connection
- All logs include correlation_id
- Trace full request flow: audio → text → LLM → TTS

**Metrics:**
- Turn count (conversations per session)
- Interruption count (barge-ins)
- Error count (failures)
- State transitions
- API latencies (Groq, TTS)
- Circuit breaker state changes

**Log Levels:**
- DEBUG: Frame-by-frame processing
- INFO: State changes, API calls
- WARNING: Timeouts, retries, buffer overflow
- ERROR: Failures, circuit breaker open

---

## Data Flow Examples

### Scenario 1: Normal Turn
```
User: "How many safety violations today?"
     ↓
[VAD detects speech]
     ↓
[Buffer 2-3s of audio]
     ↓
[VAD detects silence]
     ↓
[Transcribe with Groq (retry 3x)]
     ↓
Text: "How many safety violations today?"
     ↓
[Route: Keywords match "safety" → safety_quality agent]
     ↓
[Execute safety_quality_agent (async)]
     ↓
Agent Response: "2 violations in Zone A today"
     ↓
[Stream LLM with agent context]
     ↓
LLM: "Sir, there were 2 safety violations recorded in Zone A today."
     ↓
[Batch sentences, call TTS]
     ↓
[Stream audio chunks to frontend]
     ↓
[Frontend plays audio]
     ↓
State: IDLE (ready for next turn)
```

### Scenario 2: User Interruption (Barge-in)
```
LLM: "According to the database, we had 3 quality hold..."
[Still SPEAKING, TTS streaming audio]
     ↓
User: "Wait, what about yesterday?" [interrupts]
     ↓
[VAD detects speech_started while SPEAKING]
     ↓
[State → INTERRUPTING]
     ↓
[Cancel LLM task]
     ↓
[Send stop_audio to frontend]
     ↓
[Truncate history]
     ↓
[Transcribe interruption]
     ↓
[Process as new turn]
     ↓
State: IDLE
```

### Scenario 3: API Failure with Retry
```
[Groq API request timeout]
     ↓
[Retry 1: Wait 1s, try again]
     ↓
[Groq API still timeout]
     ↓
[Retry 2: Wait 2s, try again]
     ↓
[Groq API responds successfully]
     ↓
Process continues normally
```

### Scenario 4: Circuit Breaker Open
```
[Groq API failure #1]
[Groq API failure #2]
[Groq API failure #3]
[Groq API failure #4]
[Groq API failure #5]
     ↓
[Circuit breaker opens]
     ↓
[New request arrives]
     ↓
[Circuit breaker rejects immediately]
     ↓
[Fallback response: "Service unavailable"]
     ↓
[Wait 60s before testing recovery]
     ↓
[After 60s: HALF_OPEN state]
     ↓
[Allow 1 test request]
     ↓
[If succeeds: CLOSED]
[If fails: OPEN again]
```

---

## Configuration Hierarchy

```
Default Values (code)
        ↓
Environment Variables (.env)
        ↓
Runtime Config (config.py)
        ↓
Active Configuration
```

**Example:**
```bash
# .env
VAD_THRESHOLD=0.015
LLM_MAX_RETRIES=3
LOG_LEVEL=INFO

# Python
from config import config
config.vad.threshold  # → 0.015
config.llm.max_retries  # → 3
```

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| VAD detection | 10-50ms | Real-time; per-frame |
| Transcription | 500-2000ms | Includes API call + retries |
| Agent routing | 1-5ms | Keyword matching |
| LLM streaming | 500-3000ms | Token-by-token; depends on response length |
| TTS streaming | 500-1500ms | Per sentence; batch multiple sentences |
| **Total per turn** | **1500-7000ms** | Optimized: 1500-2500ms |

---

## Deployment Options

### Option 1: FastAPI WebSocket
```python
from fastapi import FastAPI, WebSocket
from voice_ai import VoiceConversationManager

app = FastAPI()

@app.websocket("/ws/voice")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    manager = VoiceConversationManager(websocket)
    try:
        async for data in websocket.iter_data():
            if isinstance(data, bytes):
                await manager.handle_audio_frame(data)
            else:
                text = json.loads(data)
                await manager.process_text_turn(text['query'])
    finally:
        await manager.cleanup()
```

### Option 2: Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voice-ai
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: voice-ai
        image: voice-ai:1.0.0
        env:
        - name: GROQ_API_KEY
          valueFrom:
            secretKeyRef:
              name: groq-secrets
              key: api-key
        - name: LOG_LEVEL
          value: INFO
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
```

---

## Monitoring & Alerting

**Key Metrics to Monitor:**

```
CircuitBreaker.state == OPEN
  → Alert: Service degradation

API_latency_p95 > 5s
  → Alert: Performance degradation

Error_rate > 5%
  → Alert: System instability

Memory_usage > 1GB per connection
  → Alert: Potential memory leak

Transcription_timeout_count > 10 per minute
  → Alert: Groq API issues
```

---

## Next: See README.md for Setup & Usage
