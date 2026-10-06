# Fire Detection Model

This model is designed to detect fire-related hazards in live video streams and camera frames. The model files are stored under `backend/storage/models/Fire Detection/1.0.0`.

## Files
- `Fire Office.pt` - PyTorch weights for training and direct YOLO inference
- `Fire Office.onnx` - ONNX version for faster deployment and optimized runtime execution

## Purpose
Use this model for fire and smoke risk detection in industrial or construction environments. It is intended to identify hazardous fire conditions early and trigger alerting logic when a matching object is detected inside the configured zone or ROI.

## Input requirements
The project inference pipeline expects:
- a live frame or image array from the camera
- RGB/BGR image data in OpenCV format
- optional `confidence_threshold` from the assignment configuration
- optional zone polygon to restrict the detection area
- optional class filter if only a specific object class should be observed

Typical frame input:
- `numpy.ndarray` shaped like `(height, width, 3)`
- usually a real-time frame from RTSP, IP camera, or recorded footage

## Integration into the project
The backend integrates this model through the standard YOLO runtime workflow:
1. the model is loaded from the configured storage path
2. it is assigned to a camera or detection configuration
3. the frame is passed into the model pipeline
4. detections are filtered for confidence, class, and ROI restrictions
5. the results are passed to the tracker and alert engine

This is the same runtime path used by the project’s inference engine and centralized model loader.

## Output fields
A detected fire event can produce fields similar to the following:

```json
{
  "class_name": "fire",
  "class_index": 0,
  "confidence": 0.89,
  "x1": 220,
  "y1": 180,
  "x2": 510,
  "y2": 430,
  "track_id": 51,
  "camera_id": 2,
  "assignment_id": 18,
  "zone_id": 4,
  "should_alert": true
}
```

Common output values:
- `class_name`: model label such as `fire` or related hazard class
- `class_index`: internal YOLO class ID
- `confidence`: probability score for the detection
- `x1`, `y1`, `x2`, `y2`: bounding box coordinates
- `track_id`: object tracking identifier from the tracker
- `camera_id`, `assignment_id`, `zone_id`: monitoring metadata
- `should_alert`: whether the detection satisfies alert logic

## Recommended use
- fire hazard monitoring in warehouses and work zones
- area-specific detection near flammable materials
- integration with camera-based safety monitoring rules

## Notes
The exact class names can vary based on the training export. In the application, the model is used with the project’s rule engine and alert pipeline to support automated safety notifications.
