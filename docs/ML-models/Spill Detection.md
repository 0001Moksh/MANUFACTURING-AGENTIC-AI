# Spill Detection Model

This model is intended for liquid spill and hazard detection in camera frames. It is stored in `backend/storage/models/Spill Detection/1.0.0`.

## Files
- `Spill Office 1.pt` - PyTorch model
- `Spill Office 1.onnx` - ONNX exported version for faster runtime use

## Purpose
Use this model to detect spills or similar surface-level hazards in industrial or operational areas. Once detected, the project can raise alerts, restrict the relevant ROI, and propagate the result through the incident management workflow.

## Input requirements
The inference engine expects:
- a valid camera frame as `numpy.ndarray`
- image in OpenCV/BGR format
- optional confidence threshold for object validation
- optional zone filtering to limit detection to a work area
- optional class filtering for specific hazard classes

Typical input:
- RTSP or stream-derived frame
- video frame with floor or ground-level hazard view

## Integration into the project
The project integrates this model using the same detection lifecycle used for all YOLO models:
1. model is loaded from the configured storage path
2. assignment links the model to a camera and zone
3. frame is processed by YOLO
4. detections are filtered by confidence and geometry
5. output is sent to the tracking and alert pipeline

This allows spill detection to trigger rule-based monitoring and safety notifications.

## Output fields
The model returns detection records similar to:

```json
{
  "class_name": "spill",
  "class_index": 0,
  "confidence": 0.88,
  "x1": 180,
  "y1": 220,
  "x2": 420,
  "y2": 370,
  "track_id": 76,
  "camera_id": 5,
  "assignment_id": 12,
  "zone_id": 3,
  "should_alert": true
}
```

Common output values:
- `class_name`: label produced by the spill detector
- `class_index`: assigned YOLO class index
- `confidence`: confidence score of the detection
- `x1`, `y1`, `x2`, `y2`: bounding box around the spill region
- `track_id`: tracking identifier
- `camera_id`, `assignment_id`, `zone_id`: project metadata
- `should_alert`: whether the event meets the configured rule logic

## Recommended use
- spill monitoring in plant and warehouse floors
- hazard identification in walkways and processing zones
- integration with safety alerts and incident workflows

## Notes
The exact class labels can vary depending on the model export and training set. For project usage, treat the output as a standard YOLO detection record and combine it with zone and alert rules to make operational decisions.
