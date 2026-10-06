// IndiDrive AI — Phase 3 | C++ Foundation
// Mirrors core/fusion/fusion_types.py's FusedObject/FusedWorldState.
// Plain structs, no fusion logic — this establishes the future
// production interface; Python (core/fusion/) owns fusion research and
// prototype implementation for now (see docs/FUSION_ARCHITECTURE.md
// "Python / C++ Responsibility"). Deliberately does NOT depend on any
// Kalman/prediction types -- those belong to Phase 4.
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "perception/Object.hpp"
#include "perception/PerceptionFrame.hpp"

namespace indidrive {
namespace fusion {

enum class FusionMode { FULL_FUSION, PARTIAL_FUSION, SINGLE_SENSOR, NO_VALID_SENSOR };

enum class ConflictState { CONSISTENT, MINOR_CONFLICT, MAJOR_CONFLICT, UNRESOLVED };

enum class ObjectLifecycleState { NEW, CONFIRMED, FUSED, DEGRADED, LOST, REMOVED };

enum class SyncStatus { OK, STALE, MISSING };

struct Velocity3D {
    float vx = 0.0f, vy = 0.0f, vz = 0.0f;
};

struct FusedObject {
    std::string fused_object_id;
    std::string object_class;
    float class_confidence = 0.0f;

    // Optional: absent rather than fabricated when no contributing
    // sensor measured the field (mirrors Python's None / NOT_AVAILABLE).
    std::optional<Position3D> position_3d;
    std::optional<Velocity3D> velocity;
    std::optional<Dimensions3D> dimensions;
    std::optional<float> heading;
    std::optional<float> distance;
    std::optional<BoundingBox2D> bbox_2d;

    std::vector<SourceSensor> source_sensors;
    float position_confidence = 0.0f;
    float velocity_confidence = 0.0f;
    float existence_probability = 0.0f;
    float quality = 0.0f;

    ConflictState conflict_state = ConflictState::CONSISTENT;
    ObjectLifecycleState lifecycle_state = ObjectLifecycleState::NEW;

    double timestamp = 0.0;
    int age_cycles = 0;
    std::optional<std::string> track_id;

    int sensor_count() const { return static_cast<int>(source_sensors.size()); }
};

struct FusionMetrics {
    double timestamp_alignment_latency_ms = 0.0;
    double coordinate_transform_latency_ms = 0.0;
    double association_latency_ms = 0.0;
    double confidence_fusion_latency_ms = 0.0;
    double fusion_latency_ms = 0.0;
    double objects_per_second = 0.0;
    double fusion_fps = 0.0;
};

struct FusedWorldState {
    double timestamp = 0.0;
    int64_t frame_id = 0;
    FusionMode fusion_mode = FusionMode::NO_VALID_SENSOR;
    std::vector<FusedObject> objects;
    HealthState fusion_health = HealthState::NOT_CONFIGURED;
    double synchronization_quality = 0.0;
    FusionMetrics metrics;
};

}  // namespace fusion
}  // namespace indidrive
