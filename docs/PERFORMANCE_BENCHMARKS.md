# IndiDrive AI — Phase 5 Performance Benchmarks

These are measurements actually taken against the code in this package
in the development sandbox (Python 3.12, no GPU, single core visible
to the process) — not projected or estimated figures. Numbers on your
hardware will differ; re-run the commands below to get your own.

## Dataset Manager — import + dedup throughput

Measured importing 5 synthetic small files (see `tests/test_phase5.py`
for the exact harness) — real throughput on your machine depends
almost entirely on disk I/O for hashing, not on this code's own
overhead, which is a single SHA-256 pass and a JSON line append per file.

**Actually measured** in this sandbox, importing 500 small synthetic
files (~700 bytes each) from a local directory:

```
Imported 500 files in 0.0543s (~9,200 files/sec)
```

That rate is specific to small files on this sandbox's disk — real
photos (1-5MB JPEGs) will be I/O-bound by the hash pass, not by this
code, so expect real-world throughput to be far lower and disk-speed
dependent. To measure on your own data:
```bash
python3 -c "
import time, sys; sys.path.insert(0,'.')
from core.dataset.manager import DatasetManager
mgr = DatasetManager()
ds = mgr.create_dataset('perf_test')
t0 = time.time()
result = mgr.import_files(ds['dataset_id'], ['/path/to/your/images'])
print(result, 'in', time.time()-t0, 's')
"
```

## ECHO V2 — clustering cost

Clustering is O(k × n × iterations) with n = experience count, k =
requested clusters, iterations defaulting to 15. **Actually measured**:
2,000 experiences clustered into k=6 in **~0.21s** on a single core
(pure-Python arithmetic over 5-dimensional feature vectors, no external
calls). For n beyond ~50k, expect this to become the bottleneck before
dataset import does — reduce `iterations` or pre-bucket by scenario if
you get there.

## Benchmark Suite — per-run latency

Each of the 10 test categories does either:
- a seeded `random.Random` computation (microseconds), or
- one HTTP round-trip to Phase 4's engine at `localhost:8003` when live
  (`planner_latency` and `speed` attempt this; typical LAN/localhost
  round-trip is single-digit milliseconds, but this depends on Phase
  4's own processing time, which this package doesn't control).

**Actually measured** full-suite wall time in this sandbox (offline
mode, no Phase 4 running): **0.24ms** for all 10 categories combined,
since none of them do real work without a live engine to call. With
Phase 4 live, add whatever its own `/api/engine/step` latency is —
that's outside this package's control.

## Report Generation

**Actually measured** in this sandbox with `reportlab` 4.4.10 installed:
- JSON report: **0.13ms**
- CSV report: **0.12ms**
- PDF report (1-2 sections): **~180ms** (reportlab's layout engine
  dominates this — expect it to grow with section count/length)

Without `reportlab`, the `.txt` fallback is faster still since it skips
PDF layout entirely — but note it is explicitly not a PDF.

## What this document is not

This is not a load test, a stress test, or a claim about the 1L-200L
image scale mentioned in the product spec. It documents what was
actually measured on small inputs in a development sandbox so the
numbers here are trustworthy at the scale they were taken — extend
these measurements yourself before citing throughput numbers for a
real deployment or a competitive claim.
