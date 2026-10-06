# IndiDrive AI — CARLA Setup Guide

## 1. What you need

| Requirement | Notes |
|---|---|
| GPU | NVIDIA, 6GB+ VRAM recommended (CARLA runs Unreal Engine 4) |
| OS | Windows 10/11 or Ubuntu 20.04/22.04 (best supported) |
| Disk | ~30GB free (CARLA build + maps) |
| Python | 3.8–3.10 — **CARLA's Python API wheels are version-pinned**; 3.12 (used elsewhere in this project) will NOT work for the `carla` package itself |
| RAM | 16GB+ recommended |

This is the first real hardware constraint of this project: your
Phase 5 platform (dataset manager, ECHO, etc.) is fine on any modern
Python, but the CARLA client specifically needs a Python version CARLA
shipped wheels for. **Use a separate virtual environment for this.**

## 2. Download CARLA

Go to https://github.com/carla-simulator/carla/releases and download a
packaged release (not source) — e.g. `CARLA_0.9.15.zip` for Windows, or
`CARLA_0.9.15.tar.gz` for Linux. Recommended: 0.9.15, the last stable
0.9.x release as of writing — check the releases page for anything
newer, since CARLA is actively maintained and could have moved on.

Extract it anywhere, e.g. `C:\CARLA` or `~/carla`.

## 3. Create a dedicated Python environment

```bash
# Linux/macOS
python3.10 -m venv ~/.venvs/carla-env
source ~/.venvs/carla-env/bin/activate

# Windows (PowerShell)
py -3.10 -m venv $HOME\.venvs\carla-env
& "$HOME\.venvs\carla-env\Scripts\Activate.ps1"
```

## 4. Install the CARLA Python API

The wheel/egg ships inside the CARLA package itself:

```bash
# Linux example — adjust path to your extracted CARLA folder
pip install ~/carla/PythonAPI/carla/dist/carla-0.9.15-cp310-cp310-linux_x86_64.whl

# Windows example
pip install C:\CARLA\PythonAPI\carla\dist\carla-0.9.15-cp310-cp310-win_amd64.whl
```

If the exact wheel filename doesn't match your Python version, check
what's actually in that `dist/` folder — CARLA only ships wheels for
specific cp3x tags, which is the real reason this needs its own venv.

Then install this project's CARLA-side requirements:
```bash
pip install -r indidrive-carla/requirements.txt
```

## 5. Start the CARLA server

This is a separate process from your Python client — start it first,
then run client scripts against it.

```bash
# Linux
cd ~/carla
./CarlaUE4.sh -quality-level=Low   # -quality-level=Low if your GPU is modest

# Windows
cd C:\CARLA
CarlaUE4.exe -quality-level=Low
```

Wait for the simulator window to fully load (a 3D town view) before
running any client script. First launch can take a couple of minutes.

## 6. Verify the connection

```bash
cd indidrive-carla
python scripts/test_connection.py
```
Expected output: CARLA server version, current map name, and a list of
available maps. If this fails, check:
- Is `CarlaUE4.exe` / `CarlaUE4.sh` actually running and fully loaded?
- Same machine? Default connects to `localhost:2000` — see `--host`/`--port` flags.
- Firewall blocking port 2000/2001 (TCP)?

## 7. Run the camera feed demo

```bash
python scripts/spawn_and_record.py --duration 15
```
This spawns a vehicle, attaches an RGB camera, and saves frames to
`storage/carla_runs/<timestamp>/`. If you see image files with actual
CARLA town scenery in them, the pipeline is real and working end to end.

## Honest notes

- I could not run any of this in the sandbox that built it — no GPU,
  no display, no network access to download the ~800MB+ CARLA package.
  Every file here is written to CARLA's documented 0.9.x Python API as
  accurately as I can, but **you are the first one to actually execute
  it** — please report back exact errors if something doesn't connect,
  rather than assuming the fault is on your end.
- CARLA's API has changed across versions before (e.g. sensor blueprint
  attribute names). If you're on a CARLA version other than 0.9.15,
  check `PythonAPI/carla/agents` and the CARLA changelog for anything
  that shifted.
