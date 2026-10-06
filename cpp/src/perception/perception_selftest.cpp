// IndiDrive AI — Phase 2 | C++ Foundation
// Minimal self-test (no test framework dependency, matching Phase 1's
// cpp/src/types/sensor_frame_selftest.cpp pattern). Verifies the
// perception data-contract structs compile, construct, and round-trip
// through PerceptionInterfaceStub.
// Build & run: see cpp/CMakeLists.txt (target: perception_selftest).
#include <cassert>
#include <iostream>

#include "perception/perception_types.hpp"
#include "perception/perception_interface.hpp"
#include "types/SensorFrame.hpp"

using namespace indidrive;

int main() {
    PerceptionObject obj;
    obj.object_id = "camera_0001";
    obj.object_class = "pedestrian";
    obj.raw_class = "person";
    obj.confidence = 0.91f;
    obj.raw_confidence = 0.91f;
    obj.source_sensor = SourceSensor::CAMERA;
    obj.bbox_2d = BoundingBox2D{412.0f, 180.0f, 62.0f, 155.0f};
    obj.backend = BackendKind::MOCK;
    assert(!obj.position_3d.has_value() && "camera-only object must not fabricate 3D position");

    PerceptionObject lidar_obj;
    lidar_obj.object_class = "unknown";
    lidar_obj.source_sensor = SourceSensor::LIDAR;
    lidar_obj.position_3d = Position3D{1.0f, 2.0f, 0.5f};
    lidar_obj.point_count = 42;
    assert(lidar_obj.position_3d.has_value());
    assert(!lidar_obj.bbox_2d.has_value() && "lidar-only object must not fabricate a 2D box");

    PerceptionFrame frame;
    frame.frame_id = 1;
    frame.objects.push_back(obj);
    frame.objects.push_back(lidar_obj);
    frame.road_state.lane_marking = "NOT_AVAILABLE";
    assert(frame.objects.size() == 2);
    assert(frame.road_state.lane_marking == "NOT_AVAILABLE" &&
           "unmarked-road state must be representable, not fabricated");

    CameraFrame cam;
    cam.sensor_id = "rgb_front";
    cam.frame_id = 7;
    PerceptionInterfaceStub stub;
    PerceptionFrame out = stub.processCameraFrame(cam);
    assert(out.frame_id == 7);
    assert(out.quality.health == HealthState::NOT_CONFIGURED &&
           "stub must honestly report NOT_CONFIGURED, never a fabricated HEALTHY result");

    std::cout << "cpp perception_selftest: ALL PASS\n";
    return 0;
}
