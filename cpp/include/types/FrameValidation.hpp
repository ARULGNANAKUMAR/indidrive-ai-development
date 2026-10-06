// IndiDrive AI — Phase 1 | C++ Foundation
// Structural validation mirroring
// core/carla_integration/sensor_types.py's validate_camera_frame /
// validate_lidar_frame / validate_radar_frame. Checks shape/finiteness
// only — no perception.
#pragma once

#include <cmath>
#include <string>
#include <utility>

#include "types/SensorFrame.hpp"

namespace indidrive {

inline std::pair<bool, std::string> validate_camera_frame(const CameraFrame& f) {
    if (f.image.empty()) return {false, "image is empty"};
    const size_t expected = static_cast<size_t>(f.width) * f.height * f.channels;
    if (f.image.size() != expected) return {false, "image size does not match declared dimensions"};
    if (f.width <= 0 || f.height <= 0) return {false, "non-positive dimensions"};
    if (f.frame_id < 0) return {false, "invalid frame_id"};
    return {true, "ok"};
}

inline std::pair<bool, std::string> validate_lidar_frame(const LiDARFrame& f) {
    if (f.points.empty()) return {false, "empty point cloud"};
    if (f.dimensions <= 0 || f.points.size() % static_cast<size_t>(f.dimensions) != 0) {
        return {false, "point buffer size not divisible by dimensions"};
    }
    if (static_cast<int64_t>(f.points.size() / f.dimensions) != f.point_count) {
        return {false, "point_count does not match actual buffer size"};
    }
    for (float v : f.points) {
        if (std::isnan(v) || std::isinf(v)) return {false, "point cloud contains NaN or Inf"};
    }
    return {true, "ok"};
}

inline std::pair<bool, std::string> validate_radar_frame(const RadarFrame& f) {
    if (static_cast<int64_t>(f.detections.size()) != f.detection_count) {
        return {false, "detection_count does not match actual size"};
    }
    for (const auto& d : f.detections) {
        if (std::isnan(d.depth) || std::isnan(d.velocity) || std::isnan(d.azimuth) || std::isnan(d.altitude)) {
            return {false, "detection contains NaN"};
        }
    }
    return {true, "ok"};
}

}  // namespace indidrive
