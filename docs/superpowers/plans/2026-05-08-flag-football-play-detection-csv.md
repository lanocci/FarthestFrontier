# Flag Football Play Detection CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local CLI that analyzes a coach-provided flag football video file and exports candidate play start/end timestamps as CSV rows that the existing video room importer can ingest.

**Architecture:** Keep the analyzer outside the Next.js runtime under `tools/video-analysis`. Put deterministic interval, timestamp, confidence, and CSV behavior in pure Python functions with unit tests. Isolate OpenCV usage in a small video reader so the core detector is testable without a sample video or installed video codec.

**Tech Stack:** Python 3 standard library for core logic and tests, optional `opencv-python` for video frame sampling, existing video room CSV importer columns: `プレー名`, `開始時刻`, `終了時刻`, `メモ`.

---

## File Structure

- Create `tools/video-analysis/play_detector.py`: pure dataclasses and functions for timestamps, interval cleanup, confidence scoring, and motion-series detection.
- Create `tools/video-analysis/csv_export.py`: CSV row formatting and writing for the existing video room importer.
- Create `tools/video-analysis/video_reader.py`: OpenCV-backed frame sampler and motion score generator.
- Create `tools/video-analysis/detect_plays.py`: CLI entrypoint that wires video reading, detection, and CSV writing.
- Create `tools/video-analysis/README.md`: setup, usage, CSV import flow, and tuning guidance.
- Create `tools/video-analysis/tests/test_play_detector.py`: unit tests for pure detection behavior.
- Create `tools/video-analysis/tests/test_csv_export.py`: unit tests for CSV formatting.

## Task 1: Core Detector Types, Timestamps, And Interval Cleanup

**Files:**
- Create: `tools/video-analysis/play_detector.py`
- Create: `tools/video-analysis/tests/test_play_detector.py`

- [ ] **Step 1: Write failing tests for timestamp formatting and interval cleanup**

Create `tools/video-analysis/tests/test_play_detector.py`:

```python
import unittest

from play_detector import (
    CandidateClip,
    DetectionConfig,
    apply_padding,
    filter_intervals,
    format_timestamp,
    merge_close_intervals,
)


class PlayDetectorUtilityTests(unittest.TestCase):
    def test_format_timestamp_uses_video_room_friendly_text(self):
        self.assertEqual(format_timestamp(0), "0:00")
        self.assertEqual(format_timestamp(42), "0:42")
        self.assertEqual(format_timestamp(83), "1:23")
        self.assertEqual(format_timestamp(3661), "1:01:01")

    def test_merge_close_intervals_combines_short_gaps(self):
        clips = [
            CandidateClip(start_seconds=10.0, end_seconds=15.0, confidence=0.5),
            CandidateClip(start_seconds=16.5, end_seconds=20.0, confidence=0.7),
            CandidateClip(start_seconds=30.0, end_seconds=35.0, confidence=0.9),
        ]

        merged = merge_close_intervals(clips, merge_gap_seconds=2.0)

        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0].start_seconds, 10.0)
        self.assertEqual(merged[0].end_seconds, 20.0)
        self.assertAlmostEqual(merged[0].confidence, 0.6)
        self.assertEqual(merged[1].start_seconds, 30.0)
        self.assertEqual(merged[1].end_seconds, 35.0)

    def test_apply_padding_stays_inside_video_bounds(self):
        clip = CandidateClip(start_seconds=0.5, end_seconds=8.0, confidence=0.8)
        padded = apply_padding(clip, pre_roll_seconds=2.0, post_roll_seconds=3.0, duration_seconds=10.0)

        self.assertEqual(padded.start_seconds, 0.0)
        self.assertEqual(padded.end_seconds, 10.0)
        self.assertEqual(padded.confidence, 0.8)

    def test_filter_intervals_uses_min_and_max_duration(self):
        config = DetectionConfig(min_play_seconds=3.0, max_play_seconds=35.0)
        clips = [
            CandidateClip(start_seconds=1.0, end_seconds=2.0, confidence=0.9),
            CandidateClip(start_seconds=10.0, end_seconds=20.0, confidence=0.8),
            CandidateClip(start_seconds=30.0, end_seconds=80.0, confidence=0.7),
        ]

        filtered = filter_intervals(clips, config)

        self.assertEqual(filtered, [clips[1]])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify they fail because the module does not exist**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest tools/video-analysis/tests/test_play_detector.py
```

Expected: `ModuleNotFoundError: No module named 'play_detector'`.

- [ ] **Step 3: Implement the detector utility module**

Create `tools/video-analysis/play_detector.py`:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MotionSample:
    timestamp_seconds: float
    score: float


@dataclass(frozen=True)
class CandidateClip:
    start_seconds: float
    end_seconds: float
    confidence: float

    @property
    def duration_seconds(self) -> float:
        return self.end_seconds - self.start_seconds


@dataclass(frozen=True)
class DetectionConfig:
    sample_rate: float = 3.0
    min_play_seconds: float = 3.0
    max_play_seconds: float = 35.0
    pre_roll_seconds: float = 1.0
    post_roll_seconds: float = 2.0
    motion_threshold: float = 0.12
    merge_gap_seconds: float = 2.0
    smoothing_window: int = 3


def format_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(round(seconds)))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    remaining_seconds = total_seconds % 60

    if hours:
        return f"{hours}:{minutes:02d}:{remaining_seconds:02d}"
    return f"{minutes}:{remaining_seconds:02d}"


def merge_close_intervals(clips: list[CandidateClip], merge_gap_seconds: float) -> list[CandidateClip]:
    if not clips:
        return []

    ordered = sorted(clips, key=lambda clip: clip.start_seconds)
    merged: list[CandidateClip] = [ordered[0]]

    for clip in ordered[1:]:
        previous = merged[-1]
        gap = clip.start_seconds - previous.end_seconds
        if gap <= merge_gap_seconds:
            merged[-1] = CandidateClip(
                start_seconds=previous.start_seconds,
                end_seconds=max(previous.end_seconds, clip.end_seconds),
                confidence=(previous.confidence + clip.confidence) / 2,
            )
        else:
            merged.append(clip)

    return merged


def apply_padding(
    clip: CandidateClip,
    pre_roll_seconds: float,
    post_roll_seconds: float,
    duration_seconds: float | None,
) -> CandidateClip:
    start_seconds = max(0.0, clip.start_seconds - pre_roll_seconds)
    end_seconds = clip.end_seconds + post_roll_seconds
    if duration_seconds is not None:
        end_seconds = min(duration_seconds, end_seconds)
    return CandidateClip(start_seconds=start_seconds, end_seconds=end_seconds, confidence=clip.confidence)


def filter_intervals(clips: list[CandidateClip], config: DetectionConfig) -> list[CandidateClip]:
    return [
        clip
        for clip in clips
        if config.min_play_seconds <= clip.duration_seconds <= config.max_play_seconds
    ]
```

- [ ] **Step 4: Run tests and verify Task 1 passes**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest tools/video-analysis/tests/test_play_detector.py
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add tools/video-analysis/play_detector.py tools/video-analysis/tests/test_play_detector.py
git commit -m "feat: add play detection interval utilities"
```

## Task 2: Motion-Series Detection And Confidence

**Files:**
- Modify: `tools/video-analysis/play_detector.py`
- Modify: `tools/video-analysis/tests/test_play_detector.py`

- [ ] **Step 1: Add failing tests for smoothing, candidate detection, and confidence**

Append these tests inside `PlayDetectorUtilityTests` in `tools/video-analysis/tests/test_play_detector.py`:

```python
    def test_smooth_scores_uses_centered_moving_average(self):
        samples = [
            ("0", 0.0),
            ("1", 0.3),
            ("2", 0.6),
            ("3", 0.0),
        ]

        smoothed = smooth_scores(
            [MotionSample(timestamp_seconds=float(t), score=s) for t, s in samples],
            window_size=3,
        )

        self.assertEqual([round(sample.score, 2) for sample in smoothed], [0.15, 0.3, 0.3, 0.3])

    def test_detect_candidates_finds_motion_regions(self):
        config = DetectionConfig(
            motion_threshold=0.2,
            min_play_seconds=3.0,
            max_play_seconds=35.0,
            pre_roll_seconds=1.0,
            post_roll_seconds=2.0,
            merge_gap_seconds=2.0,
            smoothing_window=1,
        )
        samples = [
            MotionSample(0, 0.02),
            MotionSample(1, 0.03),
            MotionSample(2, 0.25),
            MotionSample(3, 0.40),
            MotionSample(4, 0.38),
            MotionSample(5, 0.30),
            MotionSample(6, 0.06),
            MotionSample(7, 0.03),
            MotionSample(8, 0.02),
        ]

        clips = detect_play_candidates(samples, duration_seconds=12.0, config=config)

        self.assertEqual(len(clips), 1)
        self.assertEqual(clips[0].start_seconds, 1.0)
        self.assertEqual(clips[0].end_seconds, 7.0)
        self.assertGreater(clips[0].confidence, 0.5)

    def test_detect_candidates_merges_brief_motion_dropouts(self):
        config = DetectionConfig(
            motion_threshold=0.2,
            min_play_seconds=3.0,
            max_play_seconds=35.0,
            pre_roll_seconds=0.0,
            post_roll_seconds=0.0,
            merge_gap_seconds=2.0,
            smoothing_window=1,
        )
        samples = [
            MotionSample(0, 0.01),
            MotionSample(1, 0.30),
            MotionSample(2, 0.35),
            MotionSample(3, 0.04),
            MotionSample(4, 0.36),
            MotionSample(5, 0.33),
            MotionSample(6, 0.02),
        ]

        clips = detect_play_candidates(samples, duration_seconds=8.0, config=config)

        self.assertEqual(len(clips), 1)
        self.assertEqual(clips[0].start_seconds, 1.0)
        self.assertEqual(clips[0].end_seconds, 5.0)
```

Also update the import list:

```python
from play_detector import (
    CandidateClip,
    DetectionConfig,
    MotionSample,
    apply_padding,
    detect_play_candidates,
    filter_intervals,
    format_timestamp,
    merge_close_intervals,
    smooth_scores,
)
```

- [ ] **Step 2: Run tests and verify they fail because new functions are missing**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest tools/video-analysis/tests/test_play_detector.py
```

Expected: `ImportError` for `detect_play_candidates` or `smooth_scores`.

- [ ] **Step 3: Implement smoothing, region detection, and confidence**

Append to `tools/video-analysis/play_detector.py`:

```python
def smooth_scores(samples: list[MotionSample], window_size: int) -> list[MotionSample]:
    if window_size <= 1 or not samples:
        return samples

    radius = window_size // 2
    smoothed: list[MotionSample] = []

    for index, sample in enumerate(samples):
        start = max(0, index - radius)
        end = min(len(samples), index + radius + 1)
        window = samples[start:end]
        average = sum(item.score for item in window) / len(window)
        smoothed.append(MotionSample(timestamp_seconds=sample.timestamp_seconds, score=average))

    return smoothed


def _confidence_for_region(region: list[MotionSample], threshold: float, duration_seconds: float) -> float:
    if not region:
        return 0.0

    peak = max(sample.score for sample in region)
    average = sum(sample.score for sample in region) / len(region)
    signal_strength = min(1.0, max(0.0, (average - threshold) / max(threshold, 0.001)))
    duration_score = min(1.0, duration_seconds / 8.0)
    peak_score = min(1.0, peak / max(threshold * 3, 0.001))
    return round((signal_strength * 0.5) + (duration_score * 0.25) + (peak_score * 0.25), 2)


def _raw_motion_regions(samples: list[MotionSample], config: DetectionConfig) -> list[CandidateClip]:
    regions: list[CandidateClip] = []
    current_region: list[MotionSample] = []

    for sample in samples:
        if sample.score >= config.motion_threshold:
            current_region.append(sample)
            continue

        if current_region:
            start = current_region[0].timestamp_seconds
            end = current_region[-1].timestamp_seconds
            duration = max(0.0, end - start)
            confidence = _confidence_for_region(current_region, config.motion_threshold, duration)
            regions.append(CandidateClip(start_seconds=start, end_seconds=end, confidence=confidence))
            current_region = []

    if current_region:
        start = current_region[0].timestamp_seconds
        end = current_region[-1].timestamp_seconds
        duration = max(0.0, end - start)
        confidence = _confidence_for_region(current_region, config.motion_threshold, duration)
        regions.append(CandidateClip(start_seconds=start, end_seconds=end, confidence=confidence))

    return regions


def detect_play_candidates(
    samples: list[MotionSample],
    duration_seconds: float | None,
    config: DetectionConfig,
) -> list[CandidateClip]:
    if not samples:
        return []

    smoothed = smooth_scores(samples, config.smoothing_window)
    raw_regions = _raw_motion_regions(smoothed, config)
    merged = merge_close_intervals(raw_regions, config.merge_gap_seconds)
    padded = [
        apply_padding(
            clip,
            pre_roll_seconds=config.pre_roll_seconds,
            post_roll_seconds=config.post_roll_seconds,
            duration_seconds=duration_seconds,
        )
        for clip in merged
    ]
    return filter_intervals(padded, config)
```

- [ ] **Step 4: Run detector tests**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest tools/video-analysis/tests/test_play_detector.py
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add tools/video-analysis/play_detector.py tools/video-analysis/tests/test_play_detector.py
git commit -m "feat: detect play candidates from motion scores"
```

## Task 3: CSV Export

**Files:**
- Create: `tools/video-analysis/csv_export.py`
- Create: `tools/video-analysis/tests/test_csv_export.py`

- [ ] **Step 1: Write failing CSV export tests**

Create `tools/video-analysis/tests/test_csv_export.py`:

```python
import csv
import io
import unittest

from csv_export import build_csv_rows, write_candidate_csv
from play_detector import CandidateClip


class CsvExportTests(unittest.TestCase):
    def test_build_csv_rows_uses_existing_import_headers(self):
        clips = [
            CandidateClip(start_seconds=42.0, end_seconds=58.0, confidence=0.82),
            CandidateClip(start_seconds=78.0, end_seconds=93.0, confidence=0.76),
        ]

        rows = build_csv_rows(clips)

        self.assertEqual(rows[0]["プレー名"], "Play 1")
        self.assertEqual(rows[0]["開始時刻"], "0:42")
        self.assertEqual(rows[0]["終了時刻"], "0:58")
        self.assertEqual(rows[0]["メモ"], "auto-detected confidence=0.82")
        self.assertEqual(rows[1]["プレー名"], "Play 2")

    def test_write_candidate_csv_outputs_readable_csv(self):
        buffer = io.StringIO()
        write_candidate_csv(
            [CandidateClip(start_seconds=3.0, end_seconds=12.0, confidence=0.66)],
            buffer,
        )

        buffer.seek(0)
        rows = list(csv.DictReader(buffer))

        self.assertEqual(rows, [
            {
                "プレー名": "Play 1",
                "開始時刻": "0:03",
                "終了時刻": "0:12",
                "メモ": "auto-detected confidence=0.66",
            }
        ])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run CSV tests and verify they fail because the module does not exist**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest tools/video-analysis/tests/test_csv_export.py
```

Expected: `ModuleNotFoundError: No module named 'csv_export'`.

- [ ] **Step 3: Implement CSV export**

Create `tools/video-analysis/csv_export.py`:

```python
from __future__ import annotations

import csv
from typing import TextIO

from play_detector import CandidateClip, format_timestamp


CSV_HEADERS = ["プレー名", "開始時刻", "終了時刻", "メモ"]


def build_csv_rows(clips: list[CandidateClip]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for index, clip in enumerate(clips, start=1):
        rows.append({
            "プレー名": f"Play {index}",
            "開始時刻": format_timestamp(clip.start_seconds),
            "終了時刻": format_timestamp(clip.end_seconds),
            "メモ": f"auto-detected confidence={clip.confidence:.2f}",
        })
    return rows


def write_candidate_csv(clips: list[CandidateClip], output: TextIO) -> None:
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS)
    writer.writeheader()
    writer.writerows(build_csv_rows(clips))
```

- [ ] **Step 4: Run all pure unit tests**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add tools/video-analysis/csv_export.py tools/video-analysis/tests/test_csv_export.py
git commit -m "feat: export detected plays as video room csv"
```

## Task 4: OpenCV Video Reader

**Files:**
- Create: `tools/video-analysis/video_reader.py`

- [ ] **Step 1: Add the OpenCV-backed video reader**

Create `tools/video-analysis/video_reader.py`:

```python
from __future__ import annotations

from pathlib import Path

from play_detector import DetectionConfig, MotionSample


class VideoReadError(RuntimeError):
    pass


def _import_cv2():
    try:
        import cv2  # type: ignore
    except ImportError as error:
        raise VideoReadError(
            "OpenCV is not installed. Install it with `python3 -m pip install opencv-python`."
        ) from error
    return cv2


def read_motion_samples(video_path: Path, config: DetectionConfig) -> tuple[list[MotionSample], float | None]:
    if not video_path.exists():
        raise VideoReadError(f"Input file does not exist: {video_path}")

    cv2 = _import_cv2()
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise VideoReadError(f"Could not open video file: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS)
    frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    if fps <= 0:
        capture.release()
        raise VideoReadError("Could not detect video FPS.")

    duration_seconds = frame_count / fps if frame_count > 0 else None
    stride = max(1, int(round(fps / config.sample_rate)))
    samples: list[MotionSample] = []
    previous_gray = None
    frame_index = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break

        if frame_index % stride == 0:
            timestamp_seconds = frame_index / fps
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (160, 90))
            if previous_gray is None:
                score = 0.0
            else:
                diff = cv2.absdiff(gray, previous_gray)
                score = float(diff.mean()) / 255.0
            samples.append(MotionSample(timestamp_seconds=timestamp_seconds, score=score))
            previous_gray = gray

        frame_index += 1

    capture.release()

    if not samples:
        raise VideoReadError("No frames could be sampled from the video.")

    return samples, duration_seconds
```

- [ ] **Step 2: Run pure tests to verify OpenCV isolation did not break core behavior**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
```

Expected: 9 tests pass without importing OpenCV.

- [ ] **Step 3: Commit Task 4**

Run:

```bash
git add tools/video-analysis/video_reader.py
git commit -m "feat: add video motion reader"
```

## Task 5: CLI Entrypoint

**Files:**
- Create: `tools/video-analysis/detect_plays.py`

- [ ] **Step 1: Create the CLI entrypoint**

Create `tools/video-analysis/detect_plays.py`:

```python
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from csv_export import write_candidate_csv
from play_detector import DetectionConfig, detect_play_candidates
from video_reader import VideoReadError, read_motion_samples


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Detect flag football play candidates from a local video file.")
    parser.add_argument("input", type=Path, help="Input mp4/mov video path.")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output CSV path.")
    parser.add_argument("--sample-rate", type=float, default=3.0)
    parser.add_argument("--min-play-seconds", type=float, default=3.0)
    parser.add_argument("--max-play-seconds", type=float, default=35.0)
    parser.add_argument("--pre-roll-seconds", type=float, default=1.0)
    parser.add_argument("--post-roll-seconds", type=float, default=2.0)
    parser.add_argument("--motion-threshold", type=float, default=0.12)
    parser.add_argument("--merge-gap-seconds", type=float, default=2.0)
    parser.add_argument("--smoothing-window", type=int, default=3)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = DetectionConfig(
        sample_rate=args.sample_rate,
        min_play_seconds=args.min_play_seconds,
        max_play_seconds=args.max_play_seconds,
        pre_roll_seconds=args.pre_roll_seconds,
        post_roll_seconds=args.post_roll_seconds,
        motion_threshold=args.motion_threshold,
        merge_gap_seconds=args.merge_gap_seconds,
        smoothing_window=args.smoothing_window,
    )

    try:
        samples, duration_seconds = read_motion_samples(args.input, config)
        clips = detect_play_candidates(samples, duration_seconds=duration_seconds, config=config)
        if not clips:
            print(
                "No candidate plays found. Try lowering --motion-threshold or checking that the video has visible play motion.",
                file=sys.stderr,
            )
            return 2

        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", newline="", encoding="utf-8") as output:
            write_candidate_csv(clips, output)

        print(f"Wrote {len(clips)} candidate plays to {args.output}")
        return 0
    except VideoReadError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run the CLI help command**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py --help
```

Expected: exits 0 and prints options including `--motion-threshold`, `--pre-roll-seconds`, and `--merge-gap-seconds`.

- [ ] **Step 3: Run all pure tests again**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
```

Expected: 9 tests pass.

- [ ] **Step 4: Commit Task 5**

Run:

```bash
git add tools/video-analysis/detect_plays.py
git commit -m "feat: add play detection csv cli"
```

## Task 6: Documentation And Manual Verification

**Files:**
- Create: `tools/video-analysis/README.md`

- [ ] **Step 1: Write tool documentation**

Create `tools/video-analysis/README.md`:

````markdown
# Video Analysis Tools

This directory contains local tools for generating candidate flag football play clips from coach-provided video files.

## Setup

```bash
python3 -m pip install opencv-python
```

The detector keeps OpenCV outside the Next.js app runtime. The web app can continue using YouTube URLs for playback and sharing, while this tool analyzes the original local video file.

## Usage

```bash
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py path/to/video.mp4 -o detected-plays.csv
```

The output CSV uses the existing video room importer columns:

```csv
プレー名,開始時刻,終了時刻,メモ
Play 1,0:42,0:58,auto-detected confidence=0.82
```

## Tuning

Use these options when the detector returns too many or too few clips:

```bash
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py path/to/video.mp4 \
  -o detected-plays.csv \
  --motion-threshold 0.10 \
  --min-play-seconds 3 \
  --max-play-seconds 35 \
  --pre-roll-seconds 1 \
  --post-roll-seconds 2 \
  --merge-gap-seconds 2
```

Lower `--motion-threshold` when plays are missed. Raise it when camera shake or sideline movement creates too many clips.

## Import Flow

1. Run the detector on the original local `mp4` or `mov` file.
2. Open the app's video room.
3. Select the matching registered video.
4. Paste or upload the generated CSV in the clip import area.
5. Review and correct the generated start and end times before saving.

## Verification

Run pure unit tests:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
```

Run the CLI help check:

```bash
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py --help
```
````

- [ ] **Step 2: Run verification commands**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py --help
```

Expected: unit tests pass, and CLI help exits 0.

- [ ] **Step 3: Commit Task 6**

Run:

```bash
git add tools/video-analysis/README.md
git commit -m "docs: document play detection csv tool"
```

## Final Verification

- [ ] **Step 1: Run all automated checks available without sample video**

Run:

```bash
PYTHONPATH=tools/video-analysis python3 -m unittest discover -s tools/video-analysis/tests
npm run typecheck
```

Expected: Python tests pass and TypeScript typecheck passes.

- [ ] **Step 2: Optional manual smoke test with a real video**

Run with a local video owned by the team:

```bash
PYTHONPATH=tools/video-analysis python3 tools/video-analysis/detect_plays.py /path/to/team-video.mp4 -o /tmp/detected-plays.csv
```

Expected: CSV is created with candidate play rows. Import the CSV into the video room and verify the generated clips are faster to review than manual timestamp entry.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean working tree after the task commits.
