// IndiDrive AI — Phase 1 | C++ Foundation
// Abstract sensor interface, mirroring
// core/carla_integration/sensor_interface.py's SensorInterface ABC.
// This is the intended FUTURE migration point: once a given Python
// sensor path is proven correct, moving it to C++ means implementing
// this interface — no other layer needs to change (see
// docs/SENSOR_PIPELINE.md "Python / C++ Boundary").
//
// Phase 1 does NOT implement a real CARLA C++ client, a Python binding
// layer (pybind11 etc.), or CUDA/TensorFlow/PyTorch dependencies. This
// header exists so Phase 1's structures compile and are usable in unit
// tests, establishing the shape future real-time code will fill in.
#pragma once

#include <functional>
#include <string>

#include "types/SensorFrame.hpp"
#include "common/SensorStatus.hpp"

namespace indidrive {

class SensorInterface {
public:
    virtual ~SensorInterface() = default;

    virtual const std::string& sensor_id() const = 0;
    virtual SensorType sensor_type() const = 0;
    virtual SensorAvailability availability() const { return SensorAvailability::AVAILABLE; }

    // on_frame is invoked once per produced frame, analogous to the
    // Python on_frame(SensorFrame) callback passed to start().
    virtual void start(std::function<void(const SensorFrameBase&)> on_frame) = 0;
    virtual void stop() = 0;
};

}  // namespace indidrive
