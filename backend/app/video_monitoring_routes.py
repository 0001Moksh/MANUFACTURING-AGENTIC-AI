from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any
import asyncio
import json
import io
import time
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import StreamingResponse

from .db import get_va_db
from .crypto import decrypt_value, build_rtsp_url

router = APIRouter(prefix="/api/video-monitoring", tags=["Video Monitoring"])


@router.get("/devices")
async def get_devices(db: AsyncSession = Depends(get_va_db)):
    """
    Fetch registered camera devices strictly from construction_ai (PostgreSQL, Read-Only).
    Decrypts encrypted camera passwords in memory and constructs valid RTSP connection strings.
    """
    try:
        # Strict SELECT query on construction_ai database
        result = await db.execute(text("""
            SELECT id, name, ip, port, camera_number, user_id, password, rtsp_template, status 
            FROM cameras 
            ORDER BY id ASC
            LIMIT 20
        """))
        devices = []
        rows = result.fetchall()
        
        for row in rows:
            cam_id = row[0]
            name = row[1] or f"Camera {row[4]}"
            ip = row[2]
            port = row[3]
            camera_number = row[4]
            user_id = row[5] or ""
            raw_password = row[6] or ""
            rtsp_template = row[7] or ""
            status = row[8] or "active"

            decrypted_password = decrypt_value(raw_password)

            cam_dict = {
                "id": cam_id,
                "name": name,
                "ip": ip,
                "port": port,
                "camera_number": camera_number,
                "user_id": user_id,
                "password": raw_password,
                "decrypted_password": decrypted_password,
                "rtsp_template": rtsp_template,
                "status": status,
            }

            rtsp_url = build_rtsp_url(cam_dict)
            stream_url = f"/api/video-monitoring/stream/{cam_id}"

            devices.append({
                "id": cam_id,
                "name": name,
                "ip": ip,
                "port": port,
                "camera_number": camera_number,
                "user_id": user_id,
                "status": status,
                "rtsp_url": rtsp_url,
                "stream_url": stream_url
            })
            
        return devices
    except Exception as e:
        print(f"Error fetching devices from construction_ai: {e}")
        raise HTTPException(status_code=500, detail=f"Database Connection Unavailable or Query Failed: {str(e)}")


@router.get("/evidence")
async def get_evidence(db: AsyncSession = Depends(get_va_db)):
    """Fetch recent visual evidence logs strictly read-only from construction_ai."""
    try:
        # Query alerts table for snapshot evidence
        result = await db.execute(text("""
            SELECT id, class_name, created_at, snapshot_path 
            FROM alerts 
            WHERE snapshot_path IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 8
        """))
        evidence = []
        rows = result.fetchall()
        for row in rows:
            evidence.append({
                "id": row[0],
                "label": row[1] or "Detection Anomaly",
                "timestamp": str(row[2]),
                "imageUrl": row[3]
            })
            
        if not evidence:
            # Fallback to anomaly_flags if alerts snapshots empty
            res_anom = await db.execute(text("""
                SELECT id, anomaly_type, created_at 
                FROM anomaly_flags 
                ORDER BY created_at DESC 
                LIMIT 8
            """))
            for row in res_anom.fetchall():
                evidence.append({
                    "id": row[0],
                    "label": row[1] or "Anomaly Event",
                    "timestamp": str(row[2]),
                    "imageUrl": "/placeholder.jpg"
                })
                
        return evidence
    except Exception as e:
        print(f"Error fetching evidence: {e}")
        raise HTTPException(status_code=500, detail=f"Database Connection Unavailable or Query Failed: {str(e)}")


@router.get("/stream")
async def alert_stream(db: AsyncSession = Depends(get_va_db)):
    """Server-Sent Events (SSE) stream for real-time alerts."""
    async def event_generator():
        last_id = 0
        try:
            while True:
                result = await db.execute(text("""
                    SELECT id, class_name, camera_name, created_at 
                    FROM alerts 
                    WHERE id > :last_id 
                    ORDER BY id ASC 
                    LIMIT 10
                """), {"last_id": last_id})
                rows = result.fetchall()
                if rows:
                    for row in rows:
                        last_id = row[0]
                        class_name = row[1] or "Violation"
                        cam_name = row[2] or "Camera"
                        data = {
                            "id": row[0],
                            "severity": "CRITICAL" if "person" in class_name.lower() else "WARNING",
                            "message": f"Safety Violation: {class_name} detected on {cam_name}",
                            "timestamp": str(row[3])
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                else:
                    yield f": keep-alive\n\n"
                await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Alert SSE stream error: {e}")
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


import cv2

@router.get("/stream/{device_id}")
async def video_feed_stream(device_id: int, db: AsyncSession = Depends(get_va_db)):
    """
    Live Video Stream Endpoint for camera feed (MJPEG format).
    Fetches device credentials, decrypts password, builds RTSP connection string,
    opens real RTSP stream via OpenCV, and streams live camera frames to MAI frontend.
    """
    try:
        res = await db.execute(text("""
            SELECT id, name, ip, port, camera_number, user_id, password, rtsp_template, status
            FROM cameras
            WHERE id = :cam_id
        """), {"cam_id": device_id})
        cam_row = res.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database connection error: {exc}")

    if not cam_row:
        raise HTTPException(status_code=404, detail="Camera device not found")

    cam_id, cam_name, cam_ip, cam_port, cam_num, user_id, raw_password, rtsp_template, status = cam_row
    rtsp_url = build_rtsp_url({
        "camera_number": cam_num,
        "user_id": user_id,
        "password": raw_password,
        "rtsp_template": rtsp_template,
        "ip": cam_ip,
        "port": cam_port
    })

    async def generate_mjpeg_frames():
        loop = asyncio.get_running_loop()

        def open_cap():
            try:
                c = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
                if c.isOpened():
                    c.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                return c
            except Exception as err:
                print(f"Error opening RTSP stream for camera {cam_id}: {err}")
                return None

        cap = await loop.run_in_executor(None, open_cap)

        try:
            while True:
                frame_bytes = None

                if cap and cap.isOpened():
                    def read_and_encode():
                        ret, frame = cap.read()
                        if ret and frame is not None:
                            ok, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                            if ok:
                                return buffer.tobytes()
                        return None

                    frame_bytes = await loop.run_in_executor(None, read_and_encode)

                if frame_bytes is None:
                    # Synthetic fallback frame if RTSP stream is buffering
                    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    width, height = 640, 360
                    img = Image.new("RGB", (width, height), color=(15, 23, 42))
                    draw = ImageDraw.Draw(img)
                    draw.rectangle([(0, 0), (width, 36)], fill=(30, 41, 59))
                    draw.ellipse([(14, 13), (22, 21)], fill=(245, 158, 11))
                    draw.text((32, 10), f"{cam_name.upper()} (CAM-{cam_num})", fill=(241, 245, 249))
                    draw.text((width - 200, 10), "RTSP BUFFERING...", fill=(245, 158, 11))
                    draw.text((width // 2 - 110, height // 2 - 10), "CONNECTING RTSP STREAM...", fill=(148, 163, 184))
                    draw.rectangle([(0, height - 32), (width, height)], fill=(15, 23, 42))
                    draw.text((12, height - 24), f"RTSP: {rtsp_url[:45]}...", fill=(148, 163, 184))
                    draw.text((width - 160, height - 24), now_str, fill=(203, 213, 225))

                    buffer = io.BytesIO()
                    img.save(buffer, format="JPEG", quality=75)
                    frame_bytes = buffer.getvalue()
                    await asyncio.sleep(0.2)
                else:
                    await asyncio.sleep(0.04)  # ~25 FPS real camera feed

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
        except asyncio.CancelledError:
            pass
        finally:
            if cap:
                await loop.run_in_executor(None, cap.release)

    return StreamingResponse(
        generate_mjpeg_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
