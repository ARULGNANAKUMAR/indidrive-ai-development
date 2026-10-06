// IndiDrive AI — Phase 3 | C++ Foundation self-test
// Not a unit test framework — just asserts the data contracts and
// coordinate transform compile and behave sanely, mirroring
// src/perception/perception_selftest.cpp's role for Phase 2.
#include <cassert>
#include <cmath>
#include <iostream>

#include "fusion/coordinate_transform.hpp"
#include "fusion/fused_object.hpp"
#include "fusion/fusion_types.hpp"

int main() {
    using namespace indidrive::fusion;

    // Identity transform leaves a point unchanged.
    Transform3D identity = Transform3D::Identity();
    Vec3 p = identity.Apply({1.0f, 2.0f, 3.0f});
    assert(std::fabs(p[0] - 1.0f) < 1e-6f);
    assert(std::fabs(p[1] - 2.0f) < 1e-6f);
    assert(std::fabs(p[2] - 3.0f) < 1e-6f);

    // Translation-only transform.
    Transform3D t = Transform3D::FromExtrinsics({1.0f, -2.0f, 0.5f}, {0.0f, 0.0f, 0.0f});
    Vec3 tp = t.Apply({0.0f, 0.0f, 0.0f});
    assert(std::fabs(tp[0] - 1.0f) < 1e-6f);
    assert(std::fabs(tp[1] + 2.0f) < 1e-6f);

    // A default-constructed FusedObject has no fabricated fields.
    FusedObject obj;
    assert(!obj.position_3d.has_value());
    assert(!obj.velocity.has_value());
    assert(obj.sensor_count() == 0);
    assert(std::string(ToString(obj.lifecycle_state)) == "NEW");

    std::string json = ToJson(obj);
    assert(json.find("\"position_3d\":null") != std::string::npos);

    std::cout << "fusion_selftest: OK\n";
    return 0;
}
