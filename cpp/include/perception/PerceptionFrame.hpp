// IndiDrive AI — Phase 2 | C++ Foundation
// Mirrors core/perception/perception_types.py's RoadState, DrivableArea,
// RoadAnomaly, ProcessingMetrics, PerceptionQuality, and PerceptionFrame.
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "perception/Object.hpp"

namespace indidrive {

struct RoadState {
    bool road_present = false;
    float road_confidence = 0.0f;
    std::optional<float> road_width_estimate_m;
    std::string lane_marking = "NOT_AVAILABLE";  // valid state for unmarked Indian roads
    std::optional<int> lane_count_estimate;
    BackendKind backend = BackendKind::NOT_CONFIGURED;
};

struct DrivableArea {
    bool drivable_mask_available = false;
    int mask_width = 0;
    int mask_height = 0;
    float drivable_confidence = 0.0f;
    BackendKind backend = BackendKind::NOT_CONFIGURED;
    // The mask buffer itself is intentionally not embedded here (mirrors
    // Python's PerceptionFrame.to_dict() excluding the raw mask array).
};

struct RoadAnomaly {
    std::string anomaly_type;   // pothole | crack | debris | mud | gravel | road_edge_damage | water_patch
    float confidence = 0.0f;
    std::optional<BoundingBox2D> location;
    std::string severity = "UNKNOWN";
    SourceSensor source = SourceSensor::CAMERA;
    double timestamp = 0.0;
    std::string status = "NOT_AVAILABLE";  // REAL | BASELINE | NOT_CONFIGURED
};

struct ProcessingMetrics {
    double preprocessing_latency_ms = 0.0;
    double inference_latency_ms = 0.0;
    double postprocessing_latency_ms = 0.0;
    double total_perception_latency_ms = 0.0;
    double input_fps = 0.0;
    double processing_fps = 0.0;
    int64_t dropped_frames = 0;
};

enum class HealthState { HEALTHY, DEGRADED, FAILED, NOT_CONFIGURED, NOT_AVAILABLE };

struct PerceptionQuality {
    bool frame_valid = true;
    bool model_ready = false;
    bool inference_success = false;
    int64_t detection_count = 0;
    float average_confidence = 0.0f;
    HealthState health = HealthState::NOT_CONFIGURED;
};

struct PerceptionFrame {
    double timestamp = 0.0;
    int64_t frame_id = 0;
    std::vector<PerceptionObject> objects;
    RoadState road_state;
    DrivableArea drivable_area;
    std::vector<RoadAnomaly> road_anomalies;
    ProcessingMetrics processing_metrics;
    PerceptionQuality quality;
    std::vector<std::string> warnings;
};

}  // namespace indidrive
