"""
FastAPI Integration Example
Full WebSocket endpoint with VoiceConversationManager.

Run with: uvicorn examples.fastapi_integration:app --reload
Connect at: ws://localhost:8000/ws/voice
"""

import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager

from voice_ai import VoiceConversationManager, get_logger, config

# Initialize logger
logger = get_logger(__name__)

# Track active connections for metrics
active_connections = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown."""
    print("🚀 Voice AI Server Starting...")
    logger.info("Voice AI server starting", version="1.0.0")

    # Startup
    yield

    # Shutdown
    print("🛑 Voice AI Server Shutting Down...")
    logger.info("Voice AI server shutting down", active_connections=len(active_connections))


# Create FastAPI app
app = FastAPI(
    title="Voice AI Production Server",
    description="Multi-agent voice router for industrial operations",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================================
# WebSocket Endpoint
# ============================================================================


@app.websocket("/ws/voice")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for voice communication.

    Message types from client:
    - {"type": "audio", "data": base64_encoded_pcm}
    - {"type": "query", "text": "user question"}
    - {"type": "set_agent", "agent_id": "safety_quality"}

    Response types to client:
    - {"type": "transcript", "text": "...", "role": "user"}
    - {"type": "agent_routed", "agent_id": "...", "agent_name": "..."}
    - {"type": "agent_text_chunk", "text": "..."}
    - {"type": "audio_chunk", "audio": "base64_audio"}
    - {"type": "error", "message": "..."}
    - {"type": "stop_audio", "generation_id": "..."}
    """
    await websocket.accept()

    # Track connection
    connection_id = str(id(websocket))[:8]
    active_connections.add(connection_id)

    logger.info("Client connected", connection_id=connection_id, total_connections=len(active_connections))

    # Create conversation manager
    manager = VoiceConversationManager(websocket, agent_id="auto")

    try:
        # Main message loop
        while True:
            # Receive message from client
            message = await websocket.receive()

            # Handle text messages (JSON)
            if "text" in message:
                try:
                    data = json.loads(message["text"])

                    # Audio data (base64 encoded PCM)
                    if data.get("type") == "audio":
                        import base64

                        pcm_data = base64.b64decode(data.get("data", ""))
                        await manager.handle_audio_frame(pcm_data)

                    # Text query
                    elif data.get("type") == "query":
                        user_text = data.get("text", "").strip()
                        if user_text:
                            await manager.process_text_turn(user_text)
                        else:
                            await websocket.send_json(
                                {"type": "error", "message": "Empty query"}
                            )

                    # Change agent
                    elif data.get("type") == "set_agent":
                        agent_id = data.get("agent_id", "auto")
                        await manager.set_agent(agent_id)
                        await websocket.send_json(
                            {"type": "agent_changed", "agent_id": agent_id}
                        )

                    # Ping (keep-alive)
                    elif data.get("type") == "ping":
                        await websocket.send_json(
                            {"type": "pong", "timestamp": str(asyncio.get_event_loop().time())}
                        )

                except json.JSONDecodeError:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid JSON"}
                    )
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}", connection_id=connection_id)
                    await websocket.send_json(
                        {"type": "error", "message": str(e)[:100]}
                    )

            # Handle binary messages (audio frames)
            elif "bytes" in message:
                pcm_data = message["bytes"]
                await manager.handle_audio_frame(pcm_data)

    except WebSocketDisconnect:
        logger.info("Client disconnected gracefully", connection_id=connection_id)

    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}", connection_id=connection_id)

    finally:
        # Cleanup
        await manager.cleanup()
        active_connections.discard(connection_id)

        logger.info(
            "Client cleanup complete",
            connection_id=connection_id,
            turns=manager.turn_count,
            interruptions=manager.interruption_count,
            errors=manager.error_count,
            total_connections=len(active_connections),
        )


# ============================================================================
# HTTP Endpoints
# ============================================================================


@app.get("/")
async def root():
    """Root endpoint - HTML test client."""
    return HTMLResponse(
        """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Voice AI Test Client</title>
        <style>
            body { font-family: Arial; margin: 40px; }
            input, button { padding: 10px; margin: 5px; }
            #log { border: 1px solid #ccc; padding: 10px; height: 200px; overflow-y: auto; }
            .sent { color: green; }
            .received { color: blue; }
            .error { color: red; }
        </style>
    </head>
    <body>
        <h1>Voice AI Test Client</h1>
        <p>Connect and test the voice API</p>

        <div>
            <input type="text" id="query" placeholder="Enter query" value="How many defects today?">
            <button onclick="sendQuery()">Send Text Query</button>
        </div>

        <div>
            <select id="agent">
                <option value="auto">Auto (Keyword Router)</option>
                <option value="safety_quality">Safety & Quality</option>
                <option value="ppe_vision">PPE Vision</option>
                <option value="maintenance">Maintenance</option>
                <option value="general">General</option>
            </select>
            <button onclick="setAgent()">Set Agent</button>
        </div>

        <h3>Connection Status</h3>
        <p id="status">Disconnected</p>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>

        <h3>Messages</h3>
        <div id="log"></div>
        <button onclick="clearLog()">Clear Log</button>

        <script>
            let ws = null;

            function log(message, type = 'info') {
                const logDiv = document.getElementById('log');
                const entry = document.createElement('div');
                entry.className = type;
                entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logDiv.appendChild(entry);
                logDiv.scrollTop = logDiv.scrollHeight;
            }

            function connect() {
                if (ws) return;

                ws = new WebSocket('ws://localhost:8000/ws/voice');

                ws.onopen = () => {
                    document.getElementById('status').textContent = '✓ Connected';
                    log('Connected to server', 'info');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        log(`Received: ${data.type} - ${JSON.stringify(data).substring(0, 100)}`, 'received');
                    } catch (e) {
                        log(`Received: ${event.data}`, 'received');
                    }
                };

                ws.onerror = (error) => {
                    log(`Error: ${error}`, 'error');
                };

                ws.onclose = () => {
                    document.getElementById('status').textContent = '✗ Disconnected';
                    log('Disconnected from server', 'info');
                    ws = null;
                };
            }

            function disconnect() {
                if (ws) {
                    ws.close();
                    ws = null;
                }
            }

            function sendQuery() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    log('Not connected', 'error');
                    return;
                }

                const query = document.getElementById('query').value;
                ws.send(JSON.stringify({ type: 'query', text: query }));
                log(`Sent query: ${query}`, 'sent');
            }

            function setAgent() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    log('Not connected', 'error');
                    return;
                }

                const agent = document.getElementById('agent').value;
                ws.send(JSON.stringify({ type: 'set_agent', agent_id: agent }));
                log(`Set agent to: ${agent}`, 'sent');
            }

            function clearLog() {
                document.getElementById('log').innerHTML = '';
            }

            // Auto-connect on load
            window.onload = () => {
                connect();
            };
        </script>
    </body>
    </html>
    """
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "active_connections": len(active_connections),
        "config": {
            "log_level": config.logging.log_level,
            "vad_threshold": config.vad.threshold,
            "llm_retries": config.llm.max_retries,
        },
    }


@app.get("/config")
async def get_config():
    """Get current configuration."""
    return config.to_dict()


@app.get("/status")
async def get_status():
    """Get server status."""
    return {
        "timestamp": str(asyncio.get_event_loop().time()),
        "active_connections": len(active_connections),
        "uptime_seconds": 0,  # Would track from startup
    }


# ============================================================================
# Error Handlers
# ============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return {
        "error": "Internal server error",
        "message": str(exc)[:100],
    }


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    print("\n" + "="*60)
    print("VOICE AI FASTAPI SERVER")
    print("="*60)
    print("\nServer starting on http://localhost:8000")
    print("WebSocket endpoint: ws://localhost:8000/ws/voice")
    print("Test client: http://localhost:8000")
    print("\nAPI Endpoints:")
    print("  GET  /          - HTML test client")
    print("  GET  /health    - Health check")
    print("  GET  /config    - Current configuration")
    print("  GET  /status    - Server status")
    print("  WS   /ws/voice  - WebSocket connection")
    print("\n" + "="*60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
