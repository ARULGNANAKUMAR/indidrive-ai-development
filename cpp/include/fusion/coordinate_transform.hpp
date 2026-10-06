// IndiDrive AI — Phase 3 | C++ Foundation
// Mirrors core/fusion/coordinate_transform.py's Transform3D — plain
// rigid transform (rotate then translate), no external geometry
// library dependency (spec section 10/37: avoid heavy dependencies).
#pragma once

#include <array>

#include "perception/Object.hpp"

namespace indidrive {
namespace fusion {

using Mat3 = std::array<std::array<float, 3>, 3>;
using Vec3 = std::array<float, 3>;

struct Transform3D {
    Mat3 rotation{{{1, 0, 0}, {0, 1, 0}, {0, 0, 1}}};
    Vec3 translation{0.0f, 0.0f, 0.0f};

    static Transform3D Identity();
    static Transform3D FromExtrinsics(const Vec3& translation, const Vec3& rotation_rpy);

    Vec3 Apply(const Vec3& point) const;
    Transform3D Inverse() const;
};

}  // namespace fusion
}  // namespace indidrive
