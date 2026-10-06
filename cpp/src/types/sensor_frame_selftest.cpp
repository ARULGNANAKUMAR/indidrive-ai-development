// IndiDrive AI — Phase 1 | C++ Foundation
// Minimal self-test executable (no test framework dependency added —
// Phase 1's C++ layer is a foundation, not a full test suite). Verifies
// the structs and validators compile and behave as expected.
// Build & run: see cpp/CMakeLists.txt (target: sensor_frame_selftest).
#include <cassert>
#include <iostream>

#include "types/SensorFrame.hpp"
#include "types/FrameValidation.hpp"

using namespace indidrive;

int main() {
    CameraFrame cam;
    cam.sensor_id = "rgb_front";
    cam.frame_id = 1;
    cam.width = 4;
    cam.height = 4;
    cam.channels = 3;
    cam.image.assign(4 * 4 * 3, 0);
    auto [cam_ok, cam_reason] = validate_camera_frame(cam);
    assert(cam_ok && "valid camera frame should pass");

    LiDARFrame lidar;
    lidar.sensor_id = "lidar_top";
    lidar.frame_id = 1;
    lidar.dimensions = 4;
    lidar.point_count = 10;
    lidar.points.assign(40, 0.5f);
    auto [lidar_ok, lidar_reason] = validate_lidar_frame(lidar);
    assert(lidar_ok && "valid lidar frame should pass");

    lidar.points[0] = std::nanf("");
    auto [lidar_bad, lidar_bad_reason] = validate_lidar_frame(lidar);
    assert(!lidar_bad && "NaN point cloud must fail validation");

    RadarFrame radar;
    radar.sensor_id = "radar_front";
    radar.detection_count = 0;
    auto [radar_ok, radar_reason] = validate_radar_frame(radar);
    assert(radar_ok && "empty-but-consistent radar frame should pass");

    std::cout << "cpp sensor_frame_selftest: ALL PASS\n";
    return 0;
}
