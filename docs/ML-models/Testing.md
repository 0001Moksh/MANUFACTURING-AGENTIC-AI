# Testing Model

This model folder contains the testing/validation model used during project evaluation and internal verification. The model file is stored under `backend/storage/models/Testing/1.0.0`.

## Files
- `crowd_management_v1.onnx` - ONNX inference model used for testing and model validation workflows

## Purpose
Use this model for validation, smoke testing, or model-evaluation scenarios before promoting a model into an active production assignment. It is intended to help verify the project pipeline, detection behavior, and runtime integration with live frames.

## Input requirements
The standard inference flow in this project expects:
- a valid frame as a `numpy.ndarray`
- image array in OpenCV/BGR format
- camera stream or synthetic test image
- assignment-level confidence threshold if used in the runtime
- optional zone/ROI filtering in the project configuration

Typical input:
- `numpy.ndarray` with shape `(H, W, 3)`
- 8-bit image data from a camera or recorded video

## Integration into the project
This model uses the same YOLO/ONNX inference pipeline as the rest of the project:
1. model is placed in the storage directory
2. it is registered/assigned to a camera or detection configuration
3. frame data is passed through the inference pipeline
4. bounding boxes and metadata are filtered and tracked
5. alerting / rule logic can be applied to the resulting detections

## Output fields
The object detection output follows the same format used by the project runtime, for example:

```json
{
  "class_name": "person",
  "class_index": 0,
  "confidence": 0.91,
  "x1": 240,
  "y1": 150,
  "x2": 700,
  "y2": 520,
  "track_id": 12,
  "camera_id": 7,
  "assignment_id": 14,
  "zone_id": 2,
  "should_alert": false
}
```

Key output fields:
- `class_name`: object label or category detected by the model
- `class_index`: index corresponding to the model’s class map
- `confidence`: detection confidence score
- `x1`, `y1`, `x2`, `y2`: bounding box coordinates
- `track_id`: tracker assignment for frame-to-frame continuity
- `camera_id`, `assignment_id`, `zone_id`: detection context metadata
- `should_alert`: whether the detection meets the system rule logic

## Recommended use
- testing the application pipeline
- validating camera setup and detection confidence thresholds
- verifying integration before production deployment

## Notes
This is best treated as a validation model rather than a final operational hazard detector unless it is confirmed to match the site’s required classes and risk logic.
