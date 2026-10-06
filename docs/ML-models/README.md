# Model Storage

This folder holds the machine learning models used by the backend inference pipeline.

## Folder structure
- `Base Model/`
- `Fire Detection/`
- `PPE Kit Demo/`
- `PPE Kit Office/`
- `Spill Detection/`
- `Testing/`

Each model folder includes:
- a `README.md` file explaining usage, input, and output contract
- a versioned subfolder such as `1.0.0/`
- the actual model weights (`.pt`) and export files (`.onnx`)

## General usage pattern
The backend loads trained YOLO models through the inference runtime and consumes camera frames in OpenCV image format. A standard detection record includes:

```json
{
  "class_name": "person",
  "class_index": 0,
  "confidence": 0.92,
  "x1": 150,
  "y1": 100,
  "x2": 450,
  "y2": 400,
  "track_id": 5,
  "assignment_id": 2,
  "camera_id": 1,
  "zone_id": 4,
  "should_alert": true
}
```

## Required input
- frame image in `numpy.ndarray` format
- valid camera stream or image source
- optional model confidence threshold
- optional zone/ROI restrictions

## Output
The backend typically returns bounding boxes, class labels, confidence, and tracking metadata that are then interpreted by the rule engine and alerting system.

## Integration note
The model path is configured via the main project settings and is expected to be under `backend/storage/models`.
