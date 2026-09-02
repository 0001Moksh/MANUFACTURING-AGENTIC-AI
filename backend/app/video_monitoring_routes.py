from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List
import asyncio
from fastapi.responses import StreamingResponse
from .db import get_va_db
import json

router = APIRouter(prefix="/api/video-monitoring", tags=["Video Monitoring"])

@router.get("/devices")
async def get_devices(db: AsyncSession = Depends(get_va_db)):
    try:
        # Fetching strictly from cameras table
        result = await db.execute(text("""
            SELECT id, name, ip, port, camera_number, status 
            FROM cameras 
            LIMIT 20
        """))
        devices = []
        for row in result:
            devices.append({
                "id": row[0],
                "name": row[1] or f"Camera {row[4]}",
                "ip": row[2],
                "port": row[3],
                "camera_number": row[4],
                "status": row[5] or "unknown"
            })
        return devices
    except Exception as e:
        print(f"Error fetching devices: {e}")
        raise HTTPException(status_code=500, detail="Database Connection Unavailable or Query Failed")

@router.get("/evidence")
async def get_evidence(db: AsyncSession = Depends(get_va_db)):
    try:
        # Fetching strictly from anomaly_flags table
        result = await db.execute(text("""
            SELECT id, alert_type, created_at, snapshot_path 
            FROM anomaly_flags 
            WHERE snapshot_path IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 8
        """))
        evidence = []
        for row in result:
            evidence.append({
                "id": row[0],
                "label": row[1] or "Unknown Anomaly",
                "timestamp": str(row[2]),
                "imageUrl": row[3]
            })
        return evidence
    except Exception as e:
        print(f"Error fetching evidence: {e}")
        raise HTTPException(status_code=500, detail="Database Connection Unavailable or Query Failed")

@router.get("/stream")
async def alert_stream(db: AsyncSession = Depends(get_va_db)):
    async def event_generator():
        last_id = 0
        try:
            while True:
                # Polling for new alerts from alerts table
                result = await db.execute(text(f"""
                    SELECT id, severity, message, created_at 
                    FROM alerts 
                    WHERE id > {last_id} 
                    ORDER BY id ASC 
                    LIMIT 10
                """))
                rows = result.fetchall()
                if rows:
                    for row in rows:
                        last_id = row[0]
                        data = {
                            "id": row[0],
                            "severity": row[1] or "NORMAL",
                            "message": row[2] or "Alert",
                            "timestamp": str(row[3])
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                else:
                    yield f": keep-alive\n\n"
                await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Stream error: {e}")
            # Stream will close natively if error happens during generator execution
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
