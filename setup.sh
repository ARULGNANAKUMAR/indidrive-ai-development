#!/usr/bin/env bash
# One dependency install for the whole merged project.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON=${PYTHON:-python3}
$PYTHON -m pip install -r "$ROOT/requirements.txt" --break-system-packages

echo ""
echo "NOTE: the 'carla' Python package itself is NOT installed by this step"
echo "(it isn't a normal PyPI wheel for every platform/version). Install it"
echo "from your CARLA distribution's PythonAPI folder — see docs/CARLA_SETUP.md."
echo ""
echo "Done. Next: bash run.sh"
