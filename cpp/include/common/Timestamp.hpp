// IndiDrive AI — Phase 1 | C++ Foundation
// Lightweight timestamp mirroring core/carla_integration/sensor_types.py's
// Timestamp dataclass. Header-only, standard library only.
#pragma once

#include <optional>
#include <chrono>

namespace indidrive {

struct Timestamp {
    std::optional<double> sensor_time;     // simulation/sensor clock, seconds
    double reception_time = 0.0;           // wall clock, seconds since epoch
    std::optional<double> processing_time; // wall clock, seconds since epoch

    static double now() {
        using namespace std::chrono;
        return duration<double>(system_clock::now().time_since_epoch()).count();
    }

    void mark_processed() { processing_time = now(); }

    std::optional<double> transport_delay() const {
        if (!sensor_time.has_value()) return std::nullopt;
        double d = reception_time - sensor_time.value();
        return d < 0.0 ? 0.0 : d;
    }

    std::optional<double> processing_delay() const {
        if (!processing_time.has_value()) return std::nullopt;
        double d = processing_time.value() - reception_time;
        return d < 0.0 ? 0.0 : d;
    }

    double age() const {
        double d = now() - reception_time;
        return d < 0.0 ? 0.0 : d;
    }
};

}  // namespace indidrive
