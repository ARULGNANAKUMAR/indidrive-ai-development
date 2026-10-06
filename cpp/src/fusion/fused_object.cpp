// IndiDrive AI — Phase 3 | C++ Foundation
#include "fusion/fused_object.hpp"

#include <sstream>

namespace indidrive {
namespace fusion {

const char* ToString(FusionMode mode) {
    switch (mode) {
        case FusionMode::FULL_FUSION: return "FULL_FUSION";
        case FusionMode::PARTIAL_FUSION: return "PARTIAL_FUSION";
        case FusionMode::SINGLE_SENSOR: return "SINGLE_SENSOR";
        case FusionMode::NO_VALID_SENSOR: return "NO_VALID_SENSOR";
    }
    return "NO_VALID_SENSOR";
}

const char* ToString(ConflictState state) {
    switch (state) {
        case ConflictState::CONSISTENT: return "CONSISTENT";
        case ConflictState::MINOR_CONFLICT: return "MINOR_CONFLICT";
        case ConflictState::MAJOR_CONFLICT: return "MAJOR_CONFLICT";
        case ConflictState::UNRESOLVED: return "UNRESOLVED";
    }
    return "UNRESOLVED";
}

const char* ToString(ObjectLifecycleState state) {
    switch (state) {
        case ObjectLifecycleState::NEW: return "NEW";
        case ObjectLifecycleState::CONFIRMED: return "CONFIRMED";
        case ObjectLifecycleState::FUSED: return "FUSED";
        case ObjectLifecycleState::DEGRADED: return "DEGRADED";
        case ObjectLifecycleState::LOST: return "LOST";
        case ObjectLifecycleState::REMOVED: return "REMOVED";
    }
    return "REMOVED";
}

const char* ToString(SyncStatus status) {
    switch (status) {
        case SyncStatus::OK: return "OK";
        case SyncStatus::STALE: return "STALE";
        case SyncStatus::MISSING: return "MISSING";
    }
    return "MISSING";
}

std::string ToJson(const FusedObject& obj) {
    std::ostringstream out;
    out << "{"
        << "\"fused_object_id\":\"" << obj.fused_object_id << "\","
        << "\"class\":\"" << obj.object_class << "\","
        << "\"class_confidence\":" << obj.class_confidence << ","
        << "\"sensor_count\":" << obj.sensor_count() << ","
        << "\"existence_probability\":" << obj.existence_probability << ","
        << "\"quality\":" << obj.quality << ","
        << "\"conflict_state\":\"" << ToString(obj.conflict_state) << "\","
        << "\"lifecycle_state\":\"" << ToString(obj.lifecycle_state) << "\","
        << "\"position_3d\":" << (obj.position_3d.has_value() ? "true" : "null") << ","
        << "\"timestamp\":" << obj.timestamp
        << "}";
    return out.str();
}

}  // namespace fusion
}  // namespace indidrive
