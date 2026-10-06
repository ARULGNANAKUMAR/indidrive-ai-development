#!/usr/bin/env python3
"""
End-to-end milestone script: connect -> spawn ego vehicle -> attach RGB
camera + LIDAR + collision + lane-invasion sensors -> drive on
autopilot -> save real camera frames + run metadata to disk.

This is the thing to run to prove "it's not a mock" — the output
images are actual renders from CARLA's simulation, not synthetic
placeholders.

Usage:
    python scripts/spawn_and_record.py --duration 15 --map Town03
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.carla_integration.connection import CarlaConnection, CarlaUnavailableError
from core.carla_integration.vehicle import spawn_ego_vehicle, enable_autopilot
from core.carla_integration.sensors import (
    SensorBus, attach_rgb_camera, attach_lidar,
    attach_collision_sensor, attach_lane_invasion_sensor,
)

STORAGE_ROOT = Path(__file__).resolve().parent.parent / "storage" / "carla_runs"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=2000)
    parser.add_argument("--map", default=None, help="e.g. Town03 — leave unset to use current map")
    parser.add_argument("--duration", type=float, default=15.0, help="seconds of simulated driving")
    parser.add_argument("--fixed-delta", type=float, default=0.05, help="synchronous-mode tick length")
    parser.add_argument("--save-every-n-ticks", type=int, default=4, help="throttle frame saving to disk")
    args = parser.parse_args()

    run_id = time.strftime("%Y%m%d_%H%M%S")
    run_dir = STORAGE_ROOT / run_id
    frames_dir = run_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    conn = CarlaConnection(host=args.host, port=args.port, timeout=10.0)
    try:
        conn.connect()
    except CarlaUnavailableError as e:
        print(f"FAILED to connect: {e}")
        sys.exit(1)

    if args.map:
        print(f"Loading map {args.map} ...")
        conn.client.load_world(args.map)
        conn._world = conn.client.get_world()

    info = conn.server_info()
    print(f"Connected. Server {info['server_version']}, map {info['current_map']}")

    conn.set_synchronous_mode(True, fixed_delta_seconds=args.fixed_delta)

    actors = []
    bus = SensorBus()
    events_log = []

    try:
        vehicle = spawn_ego_vehicle(conn.world)
        actors.append(vehicle)
        print(f"Spawned vehicle: {vehicle.type_id} at {vehicle.get_location()}")

        camera = attach_rgb_camera(conn.world, vehicle, bus)
        lidar = attach_lidar(conn.world, vehicle, bus)
        collision = attach_collision_sensor(conn.world, vehicle, bus)
        lane_sensor = attach_lane_invasion_sensor(conn.world, vehicle, bus)
        actors += [camera, lidar, collision, lane_sensor]

        enable_autopilot(vehicle, enabled=True)

        n_ticks = int(args.duration / args.fixed_delta)
        print(f"Running {n_ticks} ticks (~{args.duration}s simulated) ...")

        try:
            import cv2
            have_cv2 = True
        except ImportError:
            have_cv2 = False
            print("NOTE: opencv-python not installed — frames will be saved as .npy instead of .png. "
                  "pip install opencv-python for image files.")

        saved_frames = 0
        for tick in range(n_ticks):
            conn.tick()

            frame = bus.get("rgb_front")
            if frame is not None and tick % args.save_every_n_ticks == 0:
                if have_cv2:
                    import cv2
                    out_path = frames_dir / f"frame_{tick:05d}.png"
                    cv2.imwrite(str(out_path), frame[:, :, ::-1])  # RGB -> BGR for cv2
                else:
                    import numpy as np
                    out_path = frames_dir / f"frame_{tick:05d}.npy"
                    np.save(out_path, frame)
                saved_frames += 1

            collision_event = bus.get("collision")
            if collision_event is not None:
                events_log.append({"tick": tick, "type": "collision", **collision_event})

            lane_event = bus.get("lane_invasion")
            if lane_event is not None:
                events_log.append({"tick": tick, "type": "lane_invasion", **lane_event})

            if tick % 20 == 0:
                loc = vehicle.get_location()
                vel = vehicle.get_velocity()
                speed_kmph = 3.6 * (vel.x**2 + vel.y**2 + vel.z**2) ** 0.5
                lidar_frame = bus.get("lidar_top")
                lidar_points = lidar_frame.shape[0] if lidar_frame is not None else 0
                print(f"  tick {tick}/{n_ticks}  pos=({loc.x:.1f},{loc.y:.1f})  "
                      f"speed={speed_kmph:.1f} km/h  lidar_points={lidar_points}")

        summary = {
            "run_id": run_id,
            "map": info["current_map"],
            "duration_s": args.duration,
            "ticks_run": n_ticks,
            "frames_saved": saved_frames,
            "camera_frame_count": bus.frame_count("rgb_front"),
            "lidar_frame_count": bus.frame_count("lidar_top"),
            "events": events_log,
        }
        (run_dir / "run_summary.json").write_text(json.dumps(summary, indent=2))
        print(f"\nDone. Saved {saved_frames} frames to {frames_dir}")
        print(f"Run summary: {run_dir / 'run_summary.json'}")
        if events_log:
            print(f"Recorded {len(events_log)} collision/lane events during the run.")

    finally:
        print("Cleaning up actors ...")
        conn.set_synchronous_mode(False)
        conn.cleanup_actors(actors)


if __name__ == "__main__":
    main()
