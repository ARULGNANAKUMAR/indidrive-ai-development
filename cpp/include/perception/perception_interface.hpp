// IndiDrive AI — Phase 2 | C++ Foundation
// Establishes the FUTURE production perception interface. Phase 2's real
// inference (model loading, NMS, clustering) lives in Python
// (core/perception/) — see docs/PHASE_2_ARCHITECTURE.md, section
// "Python / C++ Responsibility". This header/impl pair intentionally
// does NOT reimplement that logic; PerceptionInterfaceStub below simply
// proves the data contract compiles and round-trips, so a later
// low-latency C++ runtime has an exact, tested shape to implement against.
#pragma once

#include "perception/perception_types.hpp"
#include "types/SensorFrame.hpp"

namespace indidrive {

class IPerceptionEngine {
public:
    virtual ~IPerceptionEngine() = default;

    // Pure interface — no implementation shipped in Phase 2. A future
    // C++ perception runtime implements this; Python owns inference today.
    virtual PerceptionFrame processCameraFrame(const CameraFrame& frame) = 0;
    virtual PerceptionFrame processLidarFrame(const LiDARFrame& frame) = 0;
};

// Minimal stand-in used only by the selftest below to confirm the
// struct layout is usable from real C++ code (constructible, copyable,
// fields addressable) — NOT a perception implementation.
class PerceptionInterfaceStub : public IPerceptionEngine {
public:
    PerceptionFrame processCameraFrame(const CameraFrame& frame) override {
        PerceptionFrame out;
        out.timestamp = frame.timestamp.reception_time;
        out.frame_id = frame.frame_id;
        out.quality.health = HealthState::NOT_CONFIGURED;  // honest: no real backend here
        return out;
    }

    PerceptionFrame processLidarFrame(const LiDARFrame& frame) override {
        PerceptionFrame out;
        out.timestamp = frame.timestamp.reception_time;
        out.frame_id = frame.frame_id;
        out.quality.health = HealthState::NOT_CONFIGURED;
        return out;
    }
};

}  // namespace indidrive
