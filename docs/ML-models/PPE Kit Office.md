# PPE Kit Office Model

This model is a workplace PPE detection model meant for office and industrial safety monitoring. It is stored under `backend/storage/models/PPE Kit Office/1.0.0`.

## Files
- `PPE KIT Office.pt` - PyTorch model
- `PPE KIT Office.onnx` - ONNX model for optimized inference

## Purpose
This model is intended to identify PPE-related conditions such as workers with or without safety gear, and to support site compliance automation. It is designed to work with the project’s rule templates for face, helmet, vest, and body safety rules.

## Input requirements
The model receives the same input contract used by the backend inference engine:
- image frame in OpenCV/BGR format
- RTSP or other camera feed frame
- confidence threshold from assignment settings
- optional zone/polygon constraints
- optional class-specific filtering

Typical frame input:
- `numpy.ndarray` with `(height, width, 3)` dimensions
- non-blank, valid image frames from the monitoring camera

## Integration into the project
The runtime loads this model and uses it as a standard YOLO detection model for the configured camera assignment. The pipeline then applies:
- ROI filtering
- confidence threshold checks
- class mapping
- tracking and incident generation

This allows the application to trigger compliance rules when people are missing required protective equipment.

## Output fields
The backend emits outputs in a format similar to:

```json
{
  "class_name": "person",
  "class_index": 0,
  "confidence": 0.96,
  "x1": 300,
  "y1": 180,
  "x2": 680,
  "y2": 520,
  "track_id": 8,
  "camera_id": 4,
  "assignment_id": 22,
  "zone_id": 2,
  "should_alert": true
}
```

The key outputs include:
- `class_name`: label detected by the PPE model
- `class_index`: model class ID mapping
- `confidence`: model confidence score
- `x1`, `y1`, `x2`, `y2`: bounding box coordinates
- `track_id`: tracked identity after the tracker stage
- `camera_id`, `assignment_id`, `zone_id`: project metadata
- `should_alert`: alert decision from the incident or rule logic

## Recommended use
- worker compliance detection
- missing helmet or missing vest checks
- site-wide protection monitoring in offices or industrial spaces

## Notes
This model is meant to be paired with the project’s safety violation templates and works best when the camera viewpoint remains stable and the defined monitoring zones are configured correctly.
