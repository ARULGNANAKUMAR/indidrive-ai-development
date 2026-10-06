# IndiDrive AI

## Adaptive Path Planning, Collision Avoidance, and Experience-Driven Decision Support for Autonomous Vehicles on Unstructured Indian Roads

IndiDrive AI is a modular autonomous-driving research and development project focused on building a safety-oriented driving stack for **unstructured and mixed-traffic Indian road environments**.

The project combines:

- sensor ingestion and replay
- perception
- sensor fusion
- prediction
- object/feature memory
- road understanding
- world modeling
- reasoning
- safety supervision and validation
- path planning
- trajectory tracking
- MPC-based control
- vehicle/simulator integration
- driving-experience capture
- Situation → Action → Outcome recording
- outcome evaluation
- experience retrieval
- adaptive knowledge management
- experience-driven decision improvement

The current repository represents development through **Phase 12.6**.

> **Important:** Phase 13 and Phase 14 are not part of this repository's current implementation. They may be developed later depending on project selection, time, evaluation requirements, or research direction.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Current Development Status](#current-development-status)
3. [Project Goals](#project-goals)
4. [System Architecture](#system-architecture)
5. [Phase-by-Phase Development](#phase-by-phase-development)
6. [Phase 12 Experience Architecture](#phase-12-experience-architecture)
7. [Safety Architecture](#safety-architecture)
8. [Repository Structure](#repository-structure)
9. [Core Runtime Pipeline](#core-runtime-pipeline)
10. [Experience and Adaptive Decision Pipeline](#experience-and-adaptive-decision-pipeline)
11. [Indian Road Context](#indian-road-context)
12. [Installation](#installation)
13. [Running the Project](#running-the-project)
14. [Testing](#testing)
15. [Verification Snapshot](#verification-snapshot)
16. [Configuration](#configuration)
17. [CARLA Integration](#carla-integration)
18. [Legacy Simulator](#legacy-simulator)
19. [Data, Storage, and Models](#data-storage-and-models)
20. [Design Principles](#design-principles)
21. [Safety and Scope Boundaries](#safety-and-scope-boundaries)
22. [Known Limitations](#known-limitations)
23. [Development Roadmap](#development-roadmap)
24. [Future Phase 13–14 Direction](#future-phase-13-14-direction)
25. [Contributing / Development Workflow](#contributing--development-workflow)
26. [License](#license)

---

# Project Overview

Indian road environments can differ substantially from structured autonomous-driving benchmarks.

A practical autonomous-driving system for such environments may need to handle:

- mixed traffic
- motorcycles
- auto-rickshaws
- pedestrians
- cattle
- buses stopping unpredictably
- narrow roads
- poorly marked roads
- potholes and damaged road surfaces
- sudden road blockage
- dense intersections
- informal lane behavior
- vulnerable road users
- incomplete or degraded sensor information

IndiDrive AI is structured as a sequence of controlled development phases so that each major capability can be developed, validated, tested, and integrated without unnecessarily replacing earlier work.

The architecture is intentionally modular.

The project does not assume that every component is a trained machine-learning model. Where learned models are unavailable, the system can use deterministic, geometric, rule-based, replay, or clearly labeled baseline implementations.

---

# Current Development Status

## Implemented Development Scope

| Phase | Area | Status |
|---|---|---|
| Phase 0 | Foundation / project baseline | Implemented |
| Phase 1 | Sensor pipeline | Implemented |
| Phase 2 | Perception | Implemented |
| Phase 3 | Sensor fusion | Implemented |
| Phase 4 | Prediction | Implemented |
| Phase 5 | Object / feature memory and related platform components | Implemented |
| Phase 6.x | Road understanding | Implemented across the current road-understanding stack |
| Phase 7 | World model | Implemented |
| Phase 8.x | Reasoning / driving situation understanding | Implemented |
| Phase 9.x | Planning / adaptive path planning | Implemented |
| Phase 10.x | Vehicle control / MPC / tracking | Implemented |
| Phase 10.5 | Integrated pipeline validation and test infrastructure | Implemented |
| Phase 11.1 | Safety foundation / safety supervision | Implemented |
| Phase 11.2 | Safety decision-related capabilities | Implemented |
| Phase 11.3 | Safety integration / monitoring capabilities | Implemented |
| Phase 11.4 | Safety hardening | Implemented |
| Phase 11.5 | Safety validation and stress/scenario/property testing | Implemented |
| Phase 12.1 | Driving Experience Capture | Implemented |
| Phase 12.2 | Situation → Action → Outcome Recording | Implemented |
| Phase 12.3 | Outcome Evaluation | Implemented |
| Phase 12.4 | Experience Retrieval + Reuse | Implemented |
| Phase 12.5 | Adaptive Knowledge Update | Implemented |
| Phase 12.6 | Experience-driven Decision Improvement | Implemented |
| Phase 13 | Future development | Not implemented |
| Phase 14 | Future development | Not implemented |

The repository should be understood as a **research/development stack**, not as a claim of production-certified autonomous driving.

---

# Project Goals

The main goals of IndiDrive AI are:

### 1. Modular autonomy

Build the autonomous-driving stack as separable components rather than one monolithic program.

### 2. Safety-first operation

Current safety constraints and safety validation must always take priority over historical experience or adaptive knowledge.

### 3. Indian-road awareness

Support reasoning and validation scenarios relevant to mixed and unstructured Indian traffic.

### 4. Offline-first development

Core functionality should not require cloud services or network connectivity.

### 5. Deterministic behavior

Where possible, identical inputs, configuration, and state should produce reproducible outputs.

### 6. Explicit degradation

When required sensors, models, calibration, or data are unavailable, the system should represent that condition instead of silently fabricating information.

### 7. Experience-driven improvement

Use recorded driving experiences as structured evidence that can later support knowledge and decision improvement.

### 8. Auditability

Important decisions, knowledge updates, retrieval results, and safety outcomes should be inspectable.

---

# System Architecture

At a high level, the current architecture is:

```text
Sensors / Replay / Simulator / CARLA
                |
                v
        Sensor Pipeline
                |
                v
           Perception
                |
                v
         Sensor Fusion
                |
                v
           Prediction
                |
                v
       Object / Feature Memory
                |
                v
         World Model
                |
                v
        Reasoning / Situation
                |
                v
          Safety Systems
                |
                v
           Path Planning
                |
                v
       Trajectory Tracking
                |
                v
             MPC
                |
                v
            Control
                |
                v
       Vehicle / Simulator
```

The Phase 12 experience layer operates around the driving cycle as an observational and decision-support layer:

```text
Current Driving State
        |
        v
Experience Capture
        |
        v
Situation -> Action -> Outcome
        |
        v
Outcome Evaluation
        |
        v
Experience Retrieval
        |
        v
Adaptive Knowledge
        |
        v
Decision Improvement
        |
        v
Existing Reasoning / Decision Architecture
        |
        v
Safety Validation
        |
        v
Planning -> Tracking -> MPC -> Control
```

The Phase 12 components are deliberately bounded so that the adaptive subsystem does not become an uncontrolled replacement for the existing driving stack.

---

# Phase-by-Phase Development

## Phase 0 — Foundation

Phase 0 established the project foundation and common infrastructure.

Major areas include:

- configuration
- health checking
- logging
- operating modes
- application structure
- project audit
- baseline documentation

The purpose was to establish a stable base before adding the autonomous-driving capabilities.

---

## Phase 1 — Sensor Pipeline

Phase 1 introduced a structured sensor pipeline.

Major capabilities include:

- sensor data contracts
- bounded sensor buffering
- thread-safe buffering
- sensor lifecycle management
- sensor health monitoring
- sensor recording
- sensor replay
- offline sensor interfaces
- initial C++ data-contract foundation

The sensor layer is intentionally separated from higher-level perception.

---

## Phase 2 — Perception

Phase 2 introduced the perception layer.

Major areas include:

- camera object detection interfaces
- pluggable model backend
- LiDAR ground separation
- LiDAR clustering
- classical road/drivable-area baseline
- road anomaly interface
- perception health and quality tracking
- perception benchmark support

Model availability is explicitly represented.

The repository does not claim that trained perception weights are included when they are not.

---

## Phase 3 — Sensor Fusion

Phase 3 introduced multi-sensor fusion.

Major areas include:

- timestamp synchronization
- coordinate transforms
- data association
- deterministic confidence fusion
- camera + LiDAR fusion
- optional radar-shaped input support
- short-term object lifecycle tracking
- fusion health monitoring
- fusion benchmarking

The primary output is a fused environmental representation for downstream modules.

---

## Phase 4 — Prediction

Prediction extends the fused environmental representation with future-state estimation.

The prediction stack supports structured trajectory/motion reasoning for downstream planning and decision-making.

---

## Phase 5 — Memory and Platform Integration

The project contains memory, dataset, model, benchmark, scenario, reporting, deployment, simulator, API, and supporting platform components.

These provide infrastructure for:

- storing runtime information
- replaying scenarios
- managing datasets
- benchmarking
- reporting
- deployment-related state
- simulator access

---

## Phase 6 — Road Understanding

The road-understanding stack provides structured information about the road environment.

Current capabilities include road geometry and related contextual understanding such as:

- drivable corridor
- road boundaries
- road width profiles
- lane-related structures
- road damage/anomaly interfaces
- road context state

The system is designed to degrade honestly when required inputs are missing or stale.

---

## Phase 7 — World Model

The World Model provides a structured representation of the current driving environment.

It acts as a bridge between raw/processed perception information and higher-level reasoning.

The World Model can represent:

- environmental objects
- road context
- hazards
- vehicle state
- dynamic context
- relevant planning information

---

## Phase 8 — Reasoning Brain

The reasoning layer is responsible for understanding driving situations and generating structured requirements for downstream planning.

Major reasoning components include:

- situation assessment
- hazard analysis
- hazard prioritization
- behavior reasoning
- intent estimation
- interaction analysis
- interaction graph construction
- multi-hazard reasoning
- complexity analysis
- response requirement classification
- action abstraction
- arbitration
- safety gating

The reasoning layer is not intended to directly actuate the vehicle.

---

## Phase 9 — Path Planning

The planning layer transforms structured requirements and environmental constraints into candidate paths/trajectories suitable for tracking and control.

The planning stack includes:

- planner configuration
- planner engine
- planner pipeline
- planning types/contracts
- validation
- benchmarking
- adaptive planning-related capabilities

Safety constraints remain authoritative over planning outputs.

---

## Phase 10 — Tracking and Control

The control architecture includes trajectory tracking and model-predictive control.

Major areas include:

- reference trajectory handling
- trajectory matching
- interpolation
- tracking error computation
- tracking quality
- steering control
- speed control
- MPC prediction
- MPC cost
- MPC solver
- MPC constraints
- MPC validation
- control snapshots and contracts

The control layer is downstream of planning and safety validation.

---

## Phase 10.5 — Integrated Validation

Phase 10.5 strengthened the complete stack and its test infrastructure.

Important validation goals include:

- end-to-end pipeline behavior
- regression protection
- deterministic tests
- safety-aware integration
- custom test-runner compatibility
- full project regression

The test infrastructure supports existing project tests without requiring broad rewrites of production code.

---

# Phase 11 — Safety Architecture

Phase 11 introduced the dedicated safety architecture.

The current project contains:

```text
core/safety/
core/safety_supervisor/
core/safety_validation/
core/failsafe/
```

Safety-related capabilities include:

- emergency detection
- safety monitoring
- safety configuration
- safety supervision
- fail-safe behavior
- safety validation
- scenario execution
- stress testing
- property-based validation
- Indian-road safety scenarios

Safety is treated as a separate concern rather than being hidden inside the planner or controller.

---

# Phase 12 — Experience and Adaptive Decision Support

Phase 12 is divided into six sub-phases.

```text
12.1 Capture
   ↓
12.2 Record
   ↓
12.3 Evaluate
   ↓
12.4 Retrieve
   ↓
12.5 Learn structured knowledge
   ↓
12.6 Improve decision support
```

The objective is to allow the system to use previous driving experiences without introducing uncontrolled self-modification.

---

# Phase 12.1 — Driving Experience Capture

Phase 12.1 captures structured observations of what happened during driving.

It can observe information from areas such as:

- World Model
- reasoning
- planning
- tracking
- control
- safety
- degradation states
- hazards
- replanning events
- fail-safe events

Important boundaries:

- no learning
- no reward calculation
- no decision improvement
- no policy mutation
- no direct control

The capture subsystem is designed to be bounded and failure-isolated.

Relevant implementation area:

```text
core/experience/
```

---

# Phase 12.2 — Situation → Action → Outcome Recording

Phase 12.2 converts captured observations into structured experience records.

Conceptually:

```text
Situation
   +
Action
   +
Outcome
   =
Experience Record
```

The record can preserve incomplete or degraded experiences.

The action represents what the existing system actually requested/applied rather than creating a new driving action.

Phase 12.2 does not judge whether the action was good or bad.

That responsibility belongs to Phase 12.3.

Relevant implementation area:

```text
core/experience/record/
```

---

# Phase 12.3 — Outcome Evaluation

Phase 12.3 evaluates recorded outcomes.

Possible classifications include:

- `SUCCESS`
- `PARTIAL_SUCCESS`
- `FAILURE`
- `UNSAFE_OUTCOME`
- `NO_OUTCOME`
- `INCONCLUSIVE`
- `DEGRADED`
- `INVALID`

Evaluation is evidence-based and deterministic.

Safety evidence has priority.

The evaluator does not directly modify:

- steering
- throttle
- braking
- MPC
- planner configuration
- SafetyGate

Relevant implementation area:

```text
core/experience/evaluation/
```

---

# Phase 12.4 — Experience Retrieval + Reuse

Phase 12.4 retrieves relevant historical experiences.

Retrieval can consider structured contextual information such as:

- road type
- traffic context
- hazards
- dynamic objects
- vehicle state
- planning state
- tracking state
- control state
- safety state
- environment
- event types
- scenario characteristics

Retrieval is designed to be:

- deterministic
- bounded
- explainable
- outcome-aware
- temporally compatible
- safety-aware

The project does not require a cloud vector database for this layer.

Relevant implementation area:

```text
core/experience/retrieval/
```

---

# Phase 12.5 — Adaptive Knowledge Update

Phase 12.5 converts sufficiently supported experiences into structured knowledge.

The conceptual flow is:

```text
Experience
   ↓
Outcome Evaluation
   ↓
Retrieved Similar Experiences
   ↓
Evidence Aggregation
   ↓
Knowledge Candidate
   ↓
Validation
   ↓
Versioned Knowledge
```

Knowledge is:

- versioned
- provenance-aware
- inspectable
- conflict-aware
- bounded
- auditable

Possible knowledge lifecycle states include:

- candidate
- validated
- active
- weak
- conflicting
- degraded
- stale
- deprecated
- rejected
- invalid

Adaptive knowledge is not allowed to directly rewrite safety limits or actuator behavior.

Relevant implementation area:

```text
core/experience/knowledge/
```

---

# Phase 12.6 — Experience-driven Decision Improvement

Phase 12.6 is the final implemented Phase 12 capability.

Its purpose is to use validated historical knowledge as bounded decision-support information.

The intended conceptual flow is:

```text
Current Situation
       |
       v
Baseline Decision Candidates
       |
       v
Relevant Historical Experiences
       |
       v
Validated Adaptive Knowledge
       |
       v
Decision Improvement Context
       |
       v
Bounded Candidate Preference / Ranking Support
       |
       v
Current Safety Validation
       |
       v
Final Approved Decision
```

Phase 12.6 is explicitly not:

- a second planner
- a second controller
- a second MPC
- a replacement SafetyGate
- an unrestricted learning system
- an unrestricted policy optimizer
- a direct actuator interface

The baseline decision must remain available.

If the experience, retrieval, knowledge, or decision-improvement subsystem fails, the system must be able to fall back to baseline behavior.

Relevant implementation area:

```text
core/experience/decision_improvement/
```

Important components include:

```text
improvement_engine.py
experience_scorer.py
knowledge_filter.py
improvement_types.py
safety_veto.py
```

---

# Phase 12 Integration Adapter

The repository also contains:

```text
core/experience/phase12_pipeline_adapter.py
```

This adapter provides a controlled integration boundary for Phase 12.1–12.6.

Its architectural intention is:

```text
Autonomous Pipeline Step
        |
        v
Pipeline Snapshot
        |
        v
Phase12PipelineAdapter
        |
        +--> Capture
        +--> Record
        +--> Evaluation
        +--> Retrieval
        +--> Knowledge
        +--> Decision Improvement
```

The adapter is designed as an observational/failure-isolated layer.

It should not modify the primary control flow or directly actuate the vehicle.

---

# Safety Architecture

Safety is one of the most important design constraints in IndiDrive AI.

The project maintains dedicated safety components:

```text
core/safety/
core/safety_supervisor/
core/safety_validation/
core/failsafe/
core/reasoning/safety_gate.py
```

The intended priority is:

```text
Current Safety State
        >
Safety Validation
        >
Current Environment
        >
Current World Model
        >
Current Decision Constraints
        >
Validated Historical Knowledge
        >
Historical Experience
```

Historical experience can support decisions.

It cannot override current safety.

---

# Repository Structure

A simplified structure is:

```text
indidrive/
│
├── api/
│   └── server.py
│
├── config/
│   ├── control_config.yaml
│   ├── fusion_config.yaml
│   ├── mpc_config.yaml
│   ├── perception_config.yaml
│   ├── pipeline_config.yaml
│   ├── planner_config.yaml
│   ├── prediction_config.yaml
│   ├── reasoning_config.yaml
│   ├── sensor_config.yaml
│   ├── system_config.yaml
│   ├── vehicle_config.yaml
│   ├── world_model_config.yaml
│   └── indian_road_context_config.yaml
│
├── core/
│   ├── benchmark/
│   ├── carla_integration/
│   ├── control/
│   ├── dataset/
│   ├── echo/
│   ├── experience/
│   ├── failsafe/
│   ├── fusion/
│   ├── health/
│   ├── integration/
│   ├── memory/
│   ├── models/
│   ├── perception/
│   ├── planning/
│   ├── prediction/
│   ├── reasoning/
│   ├── reports/
│   ├── safety/
│   ├── safety_supervisor/
│   ├── safety_validation/
│   ├── scenarios/
│   ├── tracking/
│   ├── vehicle/
│   └── world_model/
│
├── docs/
│
├── frontend/
│
├── legacy_simulator/
│
├── models/
│
├── scripts/
│
├── storage/
│
├── tests/
│   ├── perception/
│   ├── fusion/
│   ├── prediction/
│   ├── memory/
│   ├── reasoning/
│   ├── planning/
│   ├── tracking102/
│   ├── control103/
│   ├── control104/
│   ├── safety/
│   ├── safety_validation/
│   ├── experience121/
│   ├── experience122/
│   ├── experience123/
│   ├── experience124/
│   ├── experience125/
│   ├── experience126/
│   └── experience126_integration/
│
├── requirements.txt
├── setup.sh
├── setup.bat
├── run.sh
├── run.bat
└── README.md
```

---

# Core Runtime Pipeline

The core autonomous-driving architecture can be understood as:

```text
1. Sensors / Replay
       ↓
2. Sensor Health + Buffering
       ↓
3. Perception
       ↓
4. Fusion
       ↓
5. Prediction
       ↓
6. Memory
       ↓
7. Road / Environment Understanding
       ↓
8. World Model
       ↓
9. Reasoning
       ↓
10. Safety Gate / Safety Systems
       ↓
11. Planning
       ↓
12. Tracking
       ↓
13. MPC
       ↓
14. Control
       ↓
15. Vehicle / Simulator
```

Phase 12 can observe this cycle and build structured experience without becoming a replacement for the core driving stack.

---

# Experience and Adaptive Decision Pipeline

The Phase 12 pipeline is:

```text
Driving Cycle
     |
     v
[12.1] Experience Capture
     |
     v
[12.2] Situation → Action → Outcome
     |
     v
[12.3] Outcome Evaluation
     |
     v
[12.4] Experience Retrieval
     |
     v
[12.5] Adaptive Knowledge Update
     |
     v
[12.6] Decision Improvement
     |
     v
Existing Reasoning / Decision Architecture
     |
     v
Safety Validation
     |
     v
Planning
     |
     v
Tracking
     |
     v
MPC
     |
     v
Control
```

This architecture intentionally separates:

- observation
- recording
- evaluation
- retrieval
- knowledge creation
- decision support

so that each stage can be tested independently.

---

# Indian Road Context

The project is designed with Indian-road scenarios in mind.

Representative scenarios include:

- pedestrian crossing
- motorcycle cut-in
- auto-rickshaw interaction
- cattle crossing
- bus-stop interaction
- narrow roads
- unmarked roads
- potholes
- road damage
- dense mixed traffic
- sudden road blockage
- intersection conflicts
- slow-moving vehicles
- vulnerable road users
- perception degradation
- tracking degradation
- planning degradation
- emergency situations

These scenarios are particularly relevant to the reasoning, safety, planning, and experience layers.

---

# Installation

## Requirements

Recommended environment:

- Python 3.x
- pip
- Git
- optional CARLA installation for CARLA-based simulation
- optional trained ML model weights for model-backed perception

Install dependencies:

```bash
bash setup.sh
```

or on Windows:

```bat
setup.bat
```

The main dependency file is:

```text
requirements.txt
```

It includes dependencies for:

- FastAPI
- Uvicorn
- Pydantic
- PyYAML
- HTTPX
- Pytest
- Flask
- Flask-CORS
- a2wsgi
- NumPy
- OpenCV
- optional reporting/model tooling

CARLA's Python API may need to be installed separately depending on the CARLA distribution and local environment.

---

# Running the Project

## Linux / macOS

```bash
bash run.sh
```

## Windows

```bat
run.bat
```

The project is structured around a single application/server process for the merged application.

Typical local endpoints include:

```text
http://localhost:8004/
http://localhost:8004/simulator/
http://localhost:8004/api/docs
```

The exact availability of optional integrations depends on the installed environment and configured backends.

---

# Testing

The project contains extensive tests across the stack.

Examples:

```text
tests/sensors/
tests/sensor_buffer/
tests/sensor_health/
tests/perception/
tests/fusion/
tests/prediction/
tests/memory/
tests/world_model/
tests/reasoning/
tests/planning/
tests/tracking102/
tests/control103/
tests/control104/
tests/safety/
tests/safety_supervisor/
tests/safety_validation/
```

Phase 12 tests:

```text
tests/experience121/
tests/experience122/
tests/experience123/
tests/experience124/
tests/experience125/
tests/experience126/
tests/experience126_integration/
```

Run the normal repository test suite with:

```bash
pytest
```

For focused Phase 12 testing:

```bash
pytest tests/experience121
pytest tests/experience122
pytest tests/experience123
pytest tests/experience124
pytest tests/experience125
pytest tests/experience126
pytest tests/experience126_integration
```

For a complete regression, run:

```bash
pytest
```

and inspect all failures rather than assuming a failure is caused by the latest phase.

---

# Verification Snapshot

A verification pass was performed against the current `indidrive-ai-phase12-6-final.zip`.

Observed archive characteristics:

- project root: `indidrive/`
- source Python files: approximately 610
- generated `__pycache__` / `.pyc` artifacts: 0 in the final archive

The Phase 12 focused suites were observed passing in the verification environment, including:

```text
Phase 12.1              193 passed
Phase 12.2              175 passed
Phase 12.3              140 passed
Phase 12.4              117 passed
Phase 12.5              149 passed
Phase 12.6               85 passed
Phase 12 integration     38 passed
```

A broader regression run in the verification environment produced:

```text
5055 passed
6 failed
1 skipped
```

The six observed failures were related to the legacy simulator tests reporting a missing Flask module in that particular execution environment, while the repository's `requirements.txt` declares:

```text
flask>=3.0.0
flask-cors>=4.0.0
```

Therefore, these numbers should be treated as an environment-specific verification snapshot rather than a permanent guarantee for every machine.

Before claiming a completely green build, install the declared dependencies and rerun the full regression in a clean environment.

---

# Configuration

Configuration is primarily located under:

```text
config/
```

Important configuration groups include:

### Sensor

```text
config/sensor_config.yaml
```

### Perception

```text
config/perception_config.yaml
```

### Fusion

```text
config/fusion_config.yaml
```

### Prediction

```text
config/prediction_config.yaml
```

### World Model

```text
config/world_model_config.yaml
```

### Reasoning

```text
config/reasoning_config.yaml
```

### Planning

```text
config/planner_config.yaml
config/planner96_config.yaml
```

### MPC

```text
config/mpc_config.yaml
```

### Vehicle

```text
config/vehicle_config.yaml
```

### Control

```text
config/control_config.yaml
```

### Pipeline

```text
config/pipeline_config.yaml
```

### Indian Road Context

```text
config/indian_road_context_config.yaml
```

The configuration architecture is intended to keep system behavior explicit and adjustable without embedding every policy directly in source code.

---

# CARLA Integration

The repository contains:

```text
core/carla_integration/
scripts/carla_test_connection.py
scripts/carla_spawn_and_record.py
```

CARLA is treated as an optional simulation/integration environment.

The project can also operate with offline/replay-oriented components where real CARLA access is unavailable.

The CARLA Python package itself may need separate installation depending on the user's CARLA setup.

---

# Legacy Simulator

The repository also contains:

```text
legacy_simulator/
```

This is the existing canvas-based simulator/application preserved as part of the merged project.

The architecture uses the FastAPI application as the main application server and can mount the legacy Flask application through the WSGI-to-ASGI bridge dependency.

This preserves the existing simulator without requiring the entire project to be rewritten around it.

---

# Data, Storage, and Models

Runtime and persistent resources are separated from core source code.

Important directories include:

```text
storage/
models/
```

Storage may contain:

- deployment state
- datasets
- reports
- runtime experience-related data
- model metadata
- benchmark information
- Echo-related state

Model directories provide locations for optional model assets.

The repository does not automatically claim that trained production-quality model weights are included simply because model directories exist.

---

# Design Principles

## 1. Modular architecture

Each capability has a defined responsibility.

## 2. Safety first

Safety systems have authority over adaptive historical information.

## 3. Failure isolation

Non-critical subsystems should not unnecessarily stop the primary driving pipeline.

## 4. Determinism

Prefer deterministic algorithms and stable outputs.

## 5. Offline-first

Core logic should not depend on cloud services.

## 6. Explicit uncertainty

Unknown, stale, invalid, degraded, or incomplete states should be represented explicitly.

## 7. Bounded resources

Buffers, stores, retrieval results, and adaptive knowledge must remain bounded.

## 8. Explainability

Important decisions should have inspectable reasons and evidence.

## 9. No hidden self-modification

Adaptive knowledge is structured and versioned rather than an unrestricted modification of arbitrary source code or safety policy.

## 10. Backward compatibility

New phases should preserve the functionality of earlier phases wherever possible.

---

# Safety and Scope Boundaries

Phase 12 is intentionally constrained.

The adaptive experience layer must NOT:

- directly control steering
- directly control throttle
- directly control braking
- bypass the planner
- bypass the MPC
- bypass SafetyGate
- disable emergency behavior
- change safety thresholds without explicit controlled architecture
- perform uncontrolled self-modification
- perform unsafe exploration
- require cloud services for core operation
- treat historical experience as more authoritative than current safety

The intended relationship is:

```text
Historical Experience
        |
        v
Supporting Evidence
        |
        v
Decision Improvement
        |
        v
Current Safety Validation
        |
        v
Approved Driving Decision
```

---

# Known Limitations

This repository is a research/development implementation and has important limitations.

## 1. Model availability

Some perception capabilities depend on external model weights or optional model packages.

A model interface existing in the repository does not mean a production-trained model is included.

## 2. Calibration

Real sensor calibration depends on the deployment environment.

Coordinate-transform infrastructure may therefore operate in a configured or degraded mode.

## 3. CARLA dependency

CARLA itself may require separate installation and configuration.

## 4. Simulator dependency environment

The legacy Flask simulator requires the Flask dependencies declared in `requirements.txt`.

## 5. Real vehicle deployment

This repository should not be interpreted as a production-certified autonomous-driving system.

Real-world deployment requires substantially more:

- hardware validation
- sensor calibration
- vehicle integration
- safety engineering
- redundancy
- formal verification
- field testing
- regulatory compliance
- cybersecurity
- operational design-domain validation

## 6. Adaptive knowledge scope

Phase 12.5 and Phase 12.6 are controlled decision-support mechanisms.

They are not unrestricted machine-learning systems capable of autonomously rewriting the complete driving policy.

## 7. Phase 13 and Phase 14

Phase 13 and Phase 14 are not currently implemented in this repository.

---

# Development Roadmap

The current completed development line is:

```text
Phase 0
  ↓
Phase 1
  ↓
Phase 2
  ↓
Phase 3
  ↓
Phase 4
  ↓
Phase 5
  ↓
Phase 6.x
  ↓
Phase 7
  ↓
Phase 8.x
  ↓
Phase 9.x
  ↓
Phase 10.x
  ↓
Phase 10.5
  ↓
Phase 11.1
  ↓
Phase 11.2
  ↓
Phase 11.3
  ↓
Phase 11.4
  ↓
Phase 11.5
  ↓
Phase 12.1
  ↓
Phase 12.2
  ↓
Phase 12.3
  ↓
Phase 12.4
  ↓
Phase 12.5
  ↓
Phase 12.6
```

This is the current development boundary represented by the repository.

---

# Future Phase 13–14 Direction

Phase 13 and Phase 14 are intentionally left open for future development.

Depending on project selection and available development time, future work could potentially focus on areas such as:

### Phase 13 — possible future direction

- optimization
- broader benchmarking
- performance profiling
- adaptive-system evaluation
- scenario coverage expansion
- resource optimization
- decision-improvement effectiveness measurement

### Phase 14 — possible future direction

- stronger closed-loop integration
- end-to-end runtime validation
- simulation-driven closed-loop evaluation
- long-duration scenario testing
- integrated autonomous-system benchmarking

These are **future possibilities, not implemented features** in the current repository.

---

# Contributing / Development Workflow

For continued development, use the following workflow:

```text
1. Start from the current repository
2. Inspect existing architecture
3. Identify the smallest integration point
4. Preserve earlier phases
5. Add focused implementation
6. Add focused tests
7. Run the new tests
8. Run affected regression tests
9. Run full regression
10. Review safety boundaries
11. Remove generated artifacts
12. Commit the verified changes
```

When extending the project:

- do not silently remove old functionality
- do not weaken existing safety tests
- do not bypass failing tests
- do not claim unimplemented features
- keep optional dependencies explicit
- keep model requirements explicit
- keep adaptive behavior bounded
- keep historical knowledge subordinate to current safety

---

# Recommended GitHub Repository Presentation

A clean GitHub repository should expose:

```text
README.md
requirements.txt
setup.sh
setup.bat
run.sh
run.bat

api/
config/
core/
docs/
frontend/
legacy_simulator/
models/
scripts/
storage/
tests/
```

Generated runtime artifacts such as:

```text
__pycache__/
*.pyc
.pytest_cache/
```

should not be committed.

Use `.gitignore` to keep development artifacts out of the repository.

---

# Project Philosophy

IndiDrive AI is built around a simple progression:

```text
Understand the environment
        ↓
Predict what may happen
        ↓
Remember relevant state
        ↓
Understand the driving situation
        ↓
Plan a safe response
        ↓
Control the vehicle
        ↓
Observe what happened
        ↓
Record the experience
        ↓
Evaluate the outcome
        ↓
Retrieve relevant history
        ↓
Build validated knowledge
        ↓
Improve future decision support
        ↓
Always remain subordinate to current safety
```

The central principle of the experience architecture is:

> **Learn from what happened without allowing historical experience to override what is safe now.**

---

# Current Repository Summary

**Project:** IndiDrive AI

**Current implementation:** Phase 0 → Phase 12.6

**Primary domain:** Autonomous driving on unstructured Indian roads

**Architecture style:** Modular, safety-oriented, offline-first

**Major capabilities:** Perception, fusion, prediction, memory, world modeling, reasoning, safety, planning, tracking, MPC, control, experience capture, evaluation, retrieval, adaptive knowledge, decision improvement

**Simulation support:** Legacy canvas simulator + CARLA integration support

**Testing:** Extensive unit, integration, safety, scenario, determinism, and negative-scope testing

**Phase 13:** Not implemented

**Phase 14:** Not implemented

**Production certification:** Not claimed

---

## Final Note

This repository represents the current development state of IndiDrive AI through Phase 12.6.

The project should be evaluated based on the code, tests, configurations, and actual available runtime/model dependencies rather than assuming that every optional capability is production-ready.

For future development, preserve the safety hierarchy, modular architecture, deterministic behavior, explicit degradation, and traceable experience-to-knowledge-to-decision flow established through Phase 12.6.
