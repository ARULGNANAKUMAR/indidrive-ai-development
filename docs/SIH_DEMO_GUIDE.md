# IndiDrive AI — SIH Demo Guide

> **Note (post-merge):** this guide was written for the old 5-process
> setup started via `scripts/launch_all.sh` on separate ports. In this
> merged project, Phase 1 and Phase 5 now run as **one process** on
> **one port** (`bash run.sh`, port 8004; Phase 1 lives at `/simulator`).
> Phases 2–4 still aren't part of any uploaded archive. See the
> top-level `README.md` for the current run instructions — the rest of
> this guide's content/timing notes are otherwise still accurate.

A practical run-of-show for demoing all 5 phases together in front of
judges, sized for a ~7-10 minute slot. Simulation only — no live
vehicle control at any point.

## Before the demo (10 min prior)

1. `bash scripts/launch_all.sh` from `indidrive-phase5/`.
2. `bash scripts/launch_all.sh --status` — confirm all 5 phases show
   healthy before walking on stage. If Phase 1/2/3/4 aren't present as
   sibling folders, Phase 5 still runs standalone — the launcher/UI
   will just show those as offline, which is fine for a Phase-5-only demo.
3. Open `http://localhost:8004` (product UI) and `http://localhost:8080`
   (3D world) in two browser tabs ahead of time — don't type URLs live.
4. Pre-load one dataset and run one benchmark once before judges arrive,
   so caches are warm and you know the numbers you'll see.

## Suggested flow

**1. Dashboard (30s)**
Open the Dashboard tab. Point at the launcher grid — all phases green.
Say: "This is one unified platform behind one launcher, not five
separate demos stitched together."

**2. Drive / 3D World (1-2 min)**
Switch to the Drive tab, launch the Three.js world. Narrate what's
rendering: perception boxes, planned path, risk overlay (whatever
Phase 1-4 actually renders — verify this against your Phase 1-4 build,
this guide doesn't assume specifics it can't confirm from Phase 5 alone).

**3. Scenario Manager (1 min)**
Trigger `cattle_crossing` or `wrong_side_traffic` — the two most
viscerally "Indian roads" scenarios for judges. Show the hazard list
in the response.

**4. Dataset + Model Manager (1-2 min)**
Show a dataset's stats (image count, dedup count, split). Show the
Model Manager list — YOLOv11/YOLOP/ByteTrack/SAM2 registered, one
marked active per role. This demonstrates the "product," not just "one
demo run."

**5. Benchmark & Testing Center (1-2 min)**
Click "Run Full Benchmark." While it runs, explain: 10 categories,
speed/brake/steering/detection/prediction/collision/localization/SLAM/
planner-latency/end-to-end-safety. When results appear, **point out the
`mode` field** — if Phase 4 was live, say so; if synthetic, be upfront:
"these categories are running against seeded synthetic data right now
in this offline demo environment — the live numbers come from Phase 4's
C++ engine when it's connected." Judges respect that more than a claim
that can't survive a follow-up question.

**6. ECHO V2 self-learning (1-2 min)**
This is usually the most impressive part if you set it up right:
- Before the demo, seed 15-20 experiences via the API for one scenario
  (e.g. cattle_crossing near-misses) so clustering has something to find.
- Live, click Cluster -> Promote Principles -> Promote Capabilities.
- Show the resulting capability, e.g. "Reduce Speed And Increase
  Following Distance (cattle crossing)" — explain this was *mined*
  from recorded experience, not hand-coded.

**7. Reports (30s)**
Click "Run Benchmark + Generate Reports," download the PDF, show it's a
real formatted document with per-category scores.

**8. Close (30s)**
Deployment Modes page — flip to "Demo Mode," explain the same platform
runs in Research/Training/Benchmark/Offline modes for different phases
of development.

## Anticipated judge questions — honest answers

- **"Is this trained on real Indian road data?"** — Be accurate about
  what dataset you've actually imported. Don't claim scale you haven't
  loaded.
- **"Does ECHO actually retrain the model?"** — No — it mines patterns
  and principles from experience and exports a training-hints artifact;
  retraining is a separate pipeline. Say this plainly if asked.
- **"What happens with 200 lakh images?"** — The dataset index is
  JSONL-streamed and SHA-256-deduped specifically so it doesn't need to
  load the whole set into memory; it hasn't been load-tested at that
  scale in this environment, and that's worth saying rather than
  guaranteeing a number you haven't measured.
- **"Is any of this running on a real car?"** — No — simulation only,
  explicitly, every time this comes up.

## If something breaks live

- Run `bash scripts/launch_all.sh --status` in a terminal tab kept
  visible but muted; if a phase drops, `--restart N` it while talking.
- The Phase 5 UI and API keep working even if Phases 1-4 are down —
  fall back to walking through Dataset/Model/ECHO/Benchmark/Reports,
  which need no other phase.
