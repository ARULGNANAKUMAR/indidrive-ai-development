// IndiDrive AI — Phase 3 | C++ Foundation
#include "fusion/coordinate_transform.hpp"

#include <cmath>

namespace indidrive {
namespace fusion {

namespace {
Vec3 MatVec(const Mat3& m, const Vec3& v) {
    return {
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    };
}

Mat3 RotationMatrix(const Vec3& rpy) {
    const float roll = rpy[0], pitch = rpy[1], yaw = rpy[2];
    const float cr = std::cos(roll), sr = std::sin(roll);
    const float cp = std::cos(pitch), sp = std::sin(pitch);
    const float cy = std::cos(yaw), sy = std::sin(yaw);
    return {{
        {cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr},
        {sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr},
        {-sp, cp * sr, cp * cr},
    }};
}
}  // namespace

Transform3D Transform3D::Identity() { return Transform3D{}; }

Transform3D Transform3D::FromExtrinsics(const Vec3& translation, const Vec3& rotation_rpy) {
    Transform3D t;
    t.rotation = RotationMatrix(rotation_rpy);
    t.translation = translation;
    return t;
}

Vec3 Transform3D::Apply(const Vec3& point) const {
    Vec3 rotated = MatVec(rotation, point);
    return {rotated[0] + translation[0], rotated[1] + translation[1], rotated[2] + translation[2]};
}

Transform3D Transform3D::Inverse() const {
    Transform3D inv;
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j)
            inv.rotation[i][j] = rotation[j][i];  // transpose = inverse of a rotation matrix
    Vec3 neg_t = {-translation[0], -translation[1], -translation[2]};
    inv.translation = MatVec(inv.rotation, neg_t);
    return inv;
}

}  // namespace fusion
}  // namespace indidrive
