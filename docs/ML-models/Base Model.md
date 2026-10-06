# Base Model

This is the general-purpose fallback model for the project. It is stored in the model registry under `backend/storage/models/Base Model/1.0.0` and is used as the default YOLOv8 base detector when a more specific model is not assigned.

## Files
- `yolov8n.pt` - PyTorch model for training/inference workflows
- `yolov8n.onnx` - ONNX export for faster deployment and portable inference

## Purpose
Use this model when you need a lightweight, general detection model that can recognize standard object categories in a camera frame. It is useful for baseline detection, benchmarking, and fallback inference when a site-specific model is unavailable.

## Input requirements
The backend loads this model with Ultralytics YOLO and expects:
- a video frame or image array in OpenCV/BGR format
- a valid camera stream or frame source
- optional confidence threshold configured at assignment level
- optional zone polygon / ROI filtering

Typical input shape:
- `numpy.ndarray` with shape `(H, W, 3)` and `uint8` values
- usually a frame from RTSP, webcam, or recorded video

## Integration into the project
The application loads models using the YOLO runtime builder and calls them through the inference engine. A model assignment includes:
- model ID
- confidence threshold
- zone/ROI information
- optional class filter

Once assigned, the frame is processed and detections are filtered by model class, confidence, and polygon constraints before they are sent to the rule engine.

## Output fields
The model returns detection records in the following structure:

```json
{
  "class_index": 0,
  "class_name": "person",
  "confidence": 0.92,
  "x1": 120,
  "y1": 80,
  "x2": 320,
  "y2": 260,
  "track_id": 12,
  "camera_id": 3,
  "assignment_id": 7,
  "zone_id": 2,
  "should_alert": false
}
```

Common fields returned by the backend:
- `class_name`: label predicted by the model
- `class_index`: index of the detected class
- `confidence`: detection confidence score
- `x1`, `y1`, `x2`, `y2`: bounding box coordinates
- `track_id`: tracked object ID after ByteTrack processing
- `camera_id`, `assignment_id`, `zone_id`: project context metadata
- `should_alert`: flag used by the alert/incident pipeline

## Recommended use
- general object detection benchmarking
- fallback model for non-custom workflows
- prototype deployment before site-specific models are configured

## Notes
This is not the primary safety model for PPE or hazard detection in the current deployment. For production safety monitoring, the dedicated site-specific models are preferred.
