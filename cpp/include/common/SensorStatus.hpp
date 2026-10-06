// IndiDrive AI — Phase 1 | C++ Foundation
// Mirrors core/carla_integration/sensor_types.py FrameStatus /
// core/carla_integration/sensor_health.py health states. Kept as two
// separate enums exactly like the Python side does (a frame's validity
// is not the same concept as a sensor's overall health).
#pragma once

namespace indidrive {

enum class FrameStatus {
    OK,
    INVALID,
    DROPPED,
};

enum class SensorHealthState {
    ONLINE,
    OFFLINE,
    DEGRADED,
    NOT_CONFIGURED,
};

enum class SensorAvailability {
    AVAILABLE,
    NOT_CONFIGURED,
    NOT_AVAILABLE,
    DISABLED,
};

}  // namespace indidrive
