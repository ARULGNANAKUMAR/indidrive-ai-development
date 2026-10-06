// IndiDrive AI — Phase 2 | C++ Foundation
// Mirrors core/perception/perception_types.py's PerceptionObject. Plain
// struct, no inference logic — this establishes the future production
// interface; Python (core/perception/) owns model inference for now
// (see docs/PHASE_2_ARCHITECTURE.md "Python / C++ Responsibility").
#pragma once

#include <optional>
#include <string>
#include <vector>

namespace indidrive {

enum class SourceSensor { CAMERA, LIDAR, RADAR, FUSED };

enum class BackendKind { REAL, BASELINE, MOCK, SIMULATION, NOT_CONFIGURED, NOT_AVAILABLE };

struct BoundingBox2D {
    float x = 0.0f, y = 0.0f, width = 0.0f, height = 0.0f;
};

struct Position3D {
    float x = 0.0f, y = 0.0f, z = 0.0f;
};

struct Dimensions3D {
    float length = 0.0f, width = 0.0f, height = 0.0f;
};

struct PerceptionObject {
    std::string object_id;
    std::string object_class;   // normalized taxonomy
    std::string raw_class;
    float confidence = 0.0f;
    float raw_confidence = 0.0f;
    SourceSensor source_sensor = SourceSensor::CAMERA;
    double timestamp = 0.0;
    float quality = 0.0f;

    // Optional fields mirror Python's `None` / NOT_AVAILABLE — absent
    // rather than fabricated when a sensor didn't measure them.
    std::optional<BoundingBox2D> bbox_2d;
    std::optional<Position3D> position_3d;
    std::optional<Dimensions3D> dimensions_3d;
    std::optional<float> heading;
    std::optional<float> distance;
    std::optional<int64_t> point_count;

    bool tracking_ready = false;
    float visibility = 1.0f;
    BackendKind backend = BackendKind::NOT_CONFIGURED;
};

}  // namespace indidrive
