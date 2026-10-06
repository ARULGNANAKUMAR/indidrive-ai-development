// IndiDrive AI — Phase 3 | C++ Foundation
// Abstract entry point future low-latency fusion implementations would
// satisfy. No implementation lives here — see docs/FUSION_ARCHITECTURE.md
// "Python / C++ Responsibility" for why Python (core/fusion/) is the
// research/prototype implementation for now.
#pragma once

#include <vector>

#include "fusion/fusion_types.hpp"
#include "perception/PerceptionFrame.hpp"

namespace indidrive {
namespace fusion {

class IFusionEngine {
public:
    virtual ~IFusionEngine() = default;

    // Consumes one Phase 2 PerceptionFrame, produces one FusedWorldState.
    // Implementations must never fabricate a field: unavailable data
    // stays std::nullopt (mirrors Python's None / NOT_AVAILABLE).
    virtual FusedWorldState Process(const indidrive::PerceptionFrame& frame) = 0;

    virtual void Reset() = 0;
};

}  // namespace fusion
}  // namespace indidrive
