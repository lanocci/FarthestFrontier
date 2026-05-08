# Flag Football Play Detection CSV Design

## Goal

Build a first version of automatic play timestamp assistance for flag football videos. The first milestone is a local command-line tool that analyzes a user-provided video file and exports candidate play clips as CSV rows that can be imported into the existing video room workflow.

The initial version should reduce manual searching through long practice or game videos. It does not need to be fully automatic or perfectly accurate. Coaches should be able to review and correct the generated timestamps before saving them as official clips.

## Context

The current app stores videos as `film_videos` and clips as `film_clips`. Clips already have `startSeconds` and `endSeconds`, and the video room has CSV-style import support for play title, start time, and end time. The first implementation should reuse that path rather than adding new database tables or a new review UI immediately.

YouTube URLs remain useful for video management and playback, but the first analysis workflow uses a local `mp4` or `mov` file to avoid relying on unsupported YouTube download behavior.

## User Workflow

1. The coach keeps registering and watching videos in the app as they do today.
2. For analysis, the coach provides the original local video file.
3. A local CLI analyzes the file and writes a CSV.
4. The coach imports or pastes the CSV into the existing video room import flow.
5. The coach reviews the generated clips, fixes timing where needed, and saves them.

## CSV Output

The output must match the existing import vocabulary:

```csv
プレー名,開始時刻,終了時刻,メモ
Play 1,0:42,0:58,auto-detected confidence=0.82
Play 2,1:18,1:33,auto-detected confidence=0.76
```

Required columns:

- `プレー名`
- `開始時刻`
- `終了時刻`

Optional column:

- `メモ`

The current importer preserves `メモ` as the clip comment. Additional detector metadata, such as confidence and source, should be written inside `メモ` for the first version rather than adding new importer columns.

## Detection Strategy

The first version uses video motion analysis rather than a trained sports model.

The CLI samples the video at a configurable rate. The default sample rate is 3 frames per second. It computes a motion score for each sampled moment using frame differences. It smooths the score over a short window and looks for flag football play rhythm:

- Low-motion setup period before the snap.
- Sharp motion increase near the start of a play.
- Sustained motion during the play.
- Motion drop after a flag pull, incomplete pass, touchdown, or whistle.
- Low-motion reset before the next play.

The detector should convert those motion regions into candidate clip intervals.

## Candidate Rules

The detector should apply conservative default filters:

- Ignore candidate clips shorter than 3 seconds by default.
- Ignore candidate clips longer than 35 seconds by default.
- Merge intervals separated by gaps shorter than 2 seconds by default.
- Add 1 second of pre-roll and 2 seconds of post-roll by default, so clips include the snap and immediate aftermath.
- Suppress duplicate starts caused by camera shake or brief occlusion.

Each candidate receives a confidence score based on signal strength, duration plausibility, and how clearly the motion rises and falls.

## Configuration

The CLI should expose options for common tuning:

- Input video path.
- Output CSV path.
- Sample rate.
- Minimum play duration.
- Maximum play duration.
- Pre-roll seconds.
- Post-roll seconds.
- Motion threshold.
- Merge-gap seconds.

Defaults should target youth flag football sideline footage, but all thresholds should be adjustable because practice videos, games, camera distance, zoom, and audio quality vary.

## Architecture

Add a local analysis tool under `tools/video-analysis`. The implementation shape is:

- A CLI entrypoint that parses arguments and reports progress.
- A video reader that samples frames and timestamps.
- A motion scorer that produces a time series.
- A segment detector that turns scores into play intervals.
- A CSV writer that formats rows for the video room importer.
- Unit-testable pure functions for timestamp formatting, interval merging, filtering, and confidence calculation.

The CLI may depend on OpenCV or a similar video-processing library. That dependency stays outside the Next.js browser runtime and is documented separately from the web app setup.

## Error Handling

The tool should fail clearly when:

- The input file does not exist.
- The video cannot be opened.
- FPS or duration cannot be detected.
- No candidate plays are found.
- Too many candidate plays are found, suggesting thresholds are too sensitive.

Errors should include a suggested next action, such as lowering the motion threshold or checking whether the file is playable locally.

## Testing

Unit tests should cover:

- Timestamp parsing and formatting.
- Interval merging.
- Minimum and maximum duration filtering.
- Pre-roll and post-roll bounds.
- Confidence scoring on synthetic motion series.
- CSV output headers and row formatting.

Manual verification should use a short sample video. The expected result is not perfect detection, but a candidate CSV that is faster to review than fully manual timestamp entry.

## Out Of Scope For First Version

- Downloading or directly analyzing YouTube video streams.
- Training a custom machine learning model.
- Detecting formation, play type, down, distance, or players.
- Automatically saving clips into Supabase.
- Adding an in-app review UI.
- Audio whistle detection, unless video-only detection is clearly insufficient.

## Future Extensions

After the CSV workflow proves useful, the app can add:

- An in-app upload and analysis job flow.
- A review screen that shows detected segments beside the video player.
- Direct creation of draft clips.
- Optional audio features for whistle and cadence detection.
- Team-specific threshold presets.
- A supervised model trained from corrected clip timestamps.
