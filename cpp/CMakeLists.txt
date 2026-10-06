# IndiDrive AI — Phase 1 | C++ Foundation
# Lightweight, header-mostly foundation for the eventual real-time
# sensor layer (see docs/SENSOR_PIPELINE.md "Python / C++ Boundary").
# Deliberately minimal: standard library only, no CUDA/TensorFlow/
# PyTorch, no Eigen (not needed until real linear algebra shows up in
# a later phase).
cmake_minimum_required(VERSION 3.16)
project(indidrive_sensor_foundation CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(indidrive_sensor_types INTERFACE)
target_include_directories(indidrive_sensor_types INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

add_executable(sensor_frame_selftest src/types/sensor_frame_selftest.cpp)
target_link_libraries(sensor_frame_selftest PRIVATE indidrive_sensor_types)

# --- Phase 2: perception data-contract headers (interface only — no
# inference logic here; see docs/PHASE_2_ARCHITECTURE.md) ---
add_executable(perception_selftest src/perception/perception_selftest.cpp)
target_link_libraries(perception_selftest PRIVATE indidrive_sensor_types)

# --- Phase 3: fusion data contracts + coordinate transform (interface
# only — fusion algorithm stays in Python for now; see
# docs/FUSION_ARCHITECTURE.md "Python / C++ Responsibility") ---
add_library(indidrive_fusion STATIC
    src/fusion/fusion_types.cpp
    src/fusion/fused_object.cpp
    src/fusion/fusion_interface.cpp
    src/fusion/coordinate_transform.cpp
)
target_include_directories(indidrive_fusion PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(indidrive_fusion PUBLIC indidrive_sensor_types)

add_executable(fusion_selftest src/fusion/fusion_selftest.cpp)
target_link_libraries(fusion_selftest PRIVATE indidrive_fusion)

enable_testing()
add_test(NAME sensor_frame_selftest COMMAND sensor_frame_selftest)
add_test(NAME perception_selftest COMMAND perception_selftest)
add_test(NAME fusion_selftest COMMAND fusion_selftest)
