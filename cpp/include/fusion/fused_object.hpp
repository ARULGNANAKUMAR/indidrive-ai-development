// IndiDrive AI — Phase 3 | C++ Foundation
// Serialization helpers for FusedObject. No fusion algorithm here.
#pragma once

#include <string>

#include "fusion/fusion_types.hpp"

namespace indidrive {
namespace fusion {

// to_string helpers for enums (used by the .cpp's ToJson, and directly
// by any future logging/debug tooling).
const char* ToString(FusionMode mode);
const char* ToString(ConflictState state);
const char* ToString(ObjectLifecycleState state);
const char* ToString(SyncStatus status);

// Minimal, dependency-free JSON serialization matching the shape of
// Python's FusedObject.to_dict() (core/fusion/fusion_types.py) — kept
// in sync manually since this is a future-optimization interface, not
// the source of truth (Python is, for now).
std::string ToJson(const FusedObject& obj);

}  // namespace fusion
}  // namespace indidrive
