// IndiDrive AI — Phase 1 | C++ Foundation
// Mirrors core/carla_integration/sensor_types.py's SensorFrame family.
// These are plain structs — no perception logic, matching the Python
// side's role as a pure data contract. std::vector<float> is used for
// point clouds instead of a matrix library; Eigen is intentionally NOT
// pulled in here since Phase 1 does no linear algebra on this data.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "common/Timestamp.hpp"
#include "common/SensorStatus.hpp"

namespace indidrive {

enum class SensorType { CAMERA, LIDAR, RADAR };

struct SensorFrameBase {
    std::string sensor_id;
    SensorType sensor_type;
    int64_t frame_id = 0;
    Timestamp timestamp;
    int64_t sequence_number = 0;
    FrameStatus status = FrameStatus::OK;
    std::string invalid_reason;  // set when status == INVALID
};

struct CameraFrame : public SensorFrameBase {
    int width = 0;
    int height = 0;
    int channels = 3;
    std::string encoding = "rgb8";
    // Row-major, height*width*channels bytes. Ownership: caller-managed;
    // Phase 1 C++ layer does not decide allocation strategy, only shape.
    std::vector<uint8_t> image;

    CameraFrame() { sensor_type = SensorType::CAMERA; }
};

struct LiDARFrame : public SensorFrameBase {
    int64_t point_count = 0;
    int dimensions = 4;  // x, y, z, intensity
    // Flat, row-major: points[i*dimensions + d]
    std::vector<float> points;

    LiDARFrame() { sensor_type = SensorType::LIDAR; }
};

struct RadarDetection {
    float depth = 0.0f;
    float velocity = 0.0f;
    float azimuth = 0.0f;
    float altitude = 0.0f;
};

struct RadarFrame : public SensorFrameBase {
    int64_t detection_count = 0;
    std::vector<RadarDetection> detections;

    RadarFrame() { sensor_type = SensorType::RADAR; }
};

}  // namespace indidrive
