# Quick Start Guide (5 Minutes)

Get the Voice AI Production package up and running in minutes.

---

## Step 1: Extract & Setup (1 minute)

```bash
# Extract the package
unzip voice-ai-production.zip
cd voice-ai-production

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## Step 2: Configure (1 minute)

```bash
# Copy example configuration
cp .env.example .env

# Edit .env and add your Groq API key
export GROQ_API_KEY="your-api-key-here"

# Verify configuration
python -c "from voice_ai import config; print('✓ Config loaded')"
```

---

## Step 3: Run Example (2 minutes)

### Option A: Run Basic Example
```bash
python examples/basic_usage.py
```

Output should show:
```
============================================================
VOICE AI PRODUCTION PACKAGE - EXAMPLES
============================================================

EXAMPLE 1: Configuration Management

VAD Configuration:
  Threshold: 0.015
  Min speech frames: 3
  Min silence frames: 8
  Max buffer size: 2097152 bytes
```

### Option B: Run FastAPI Server
```bash
pip install fastapi uvicorn
python examples/fastapi_integration.py
```

Then open browser: http://localhost:8000

---

## Step 4: Integrate into Your Project (1 minute)

### Add to your FastAPI app:
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
    finally:
        await manager.cleanup()
```

---

## 📚 Documentation

**Start here based on your need:**

| Goal | Read This |
|------|-----------|
| Understand architecture | `docs/ARCHITECTURE.md` |
| See what we fixed | `docs/CRITICAL_ISSUES_FIXES.md` |
| Deploy to production | `docs/IMPLEMENTATION_GUIDE.md` |
| Review all issues | `docs/ARCHITECTURE_REVIEW.md` |
| Visual overview | `docs/architecture-diagram.svg` |

---

## 🎯 Common Tasks

### Set environment-specific config
```bash
# Development
export LOG_LEVEL=DEBUG
export LLM_TIMEOUT=60

# Production
export LOG_LEVEL=WARNING
export LLM_MAX_RETRIES=5
```

### View logs
```bash
tail -f logs/voice_ai.log | jq '.message'
```

### Check system health
```bash
curl http://localhost:8000/health
```

### Change VAD threshold
```bash
export VAD_THRESHOLD=0.020  # More sensitive
```

---

## ⚠️ Troubleshooting

### Error: "GROQ_API_KEY not set"
```bash
export GROQ_API_KEY="your-actual-key"
```

### Error: "Circuit breaker is OPEN"
```bash
# Wait 60 seconds (automatic recovery)
# Or check: https://status.anthropic.com
```

### Error: "Timeout on transcription"
```bash
export TRANSCRIPTION_TIMEOUT=20
```

### Can't import voice_ai
```bash
# Make sure you're in the right directory and venv is activated
pwd  # Should be voice-ai-production/
which python  # Should show venv path
```

---

## 🚀 Next Steps

1. **Read Architecture** → `docs/ARCHITECTURE.md`
2. **Understand Improvements** → `docs/CRITICAL_ISSUES_FIXES.md`
3. **Configure for Production** → `docs/IMPLEMENTATION_GUIDE.md`
4. **Deploy** → See FastAPI example in `examples/fastapi_integration.py`
5. **Monitor** → Check logs in `logs/voice_ai.log`

---

## 📞 Support

- **Configuration questions?** → See `voice_ai/config.py`
- **Logging questions?** → See `voice_ai/logging_config.py`
- **Error handling?** → See `voice_ai/resilience.py`
- **State machine?** → See `voice_ai/manager.py`

---

**All set! 🎉**

Your production-ready voice AI system is ready to deploy.
