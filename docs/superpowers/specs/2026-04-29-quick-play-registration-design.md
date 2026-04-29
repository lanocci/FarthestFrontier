# Quick Play Registration Design

## Context

Coaches need a faster desktop workflow for registering plays while watching game video. The current clip editor supports detailed metadata, player links, comments, and whiteboards, but that full form is too heavy for first-pass registration during video review.

The desired workflow is a quick capture pass: mark the play's time range, add only the minimum searchable metadata, save, then refine details later.

## Goals

- Keep the coach's attention on the video while registering plays.
- Make timestamp capture and correction fast.
- Capture the minimum metadata needed for later search and analysis.
- Generate a useful temporary title automatically.
- Preserve the existing detailed clip editor for follow-up edits.

## Non-Goals

- Replacing the full clip editor.
- Adding player participation or focus-player selection to the quick capture flow.
- Adding whiteboard editing to the quick capture flow.
- Building automated play recognition from video.

## User Experience

Add a quick registration bar directly below the video player in the audiovisual room. The bar stays visually close to playback controls so the coach can mark and save plays without moving away from the video context.

The bar captures:

- Start timestamp
- End timestamp
- Side: offense or defense
- Formation
- Play type
- Down
- Distance

The quick bar should avoid the broader word "category." Formation and play type should remain separate fields because they already map to existing clip metadata and are more useful for filtering.

## Timestamp Capture

The coach can set timestamps from the current playback position:

- `Start = current time`
- `End = current time`

Start and end fields are directly editable text fields using the app's existing timestamp format, such as `1:24` or `08:12`.

When a timestamp field is focused:

- `Tab` moves between start and end fields.
- Arrow-key adjustment nudges the focused timestamp by one second.
- Manual typing remains available for exact corrections.

The design favors direct editing plus keyboard nudging instead of a large set of visible `+/-` buttons. This keeps the bar compact while still making corrections quick.

## Quick Metadata

The quick bar exposes short controls for:

- Side: offense or defense
- Formation: datalist or compact selector using existing formation masters
- Play type: datalist or compact selector using existing play type masters
- Down: 1st, 2nd, 3rd, 4th, and TFP if needed
- Distance: compact text or numeric field

Saving a quick clip creates a normal `VideoClip` record using the same fields as the existing detailed editor.

## Generated Title

On save, the app generates a temporary title from the quick metadata. The title is editable later in the detailed editor.

Example patterns:

- `攻撃 I-Formation Run 1st&10`
- `守備 Nickel Zone 3rd&6`

If some metadata is missing, the title should omit missing segments rather than insert placeholder text.

## Save Behavior

After saving:

- The clip appears immediately in the clip list.
- The quick bar stays active for the next play.
- Start and end timestamps reset so the next clip can be marked from the current playback position.
- Side, formation, play type, and distance default to the previous saved values.
- Down advances automatically: `1st -> 2nd -> 3rd -> 4th -> 1st`.

The automatic down advancement is a speed aid, not a source of truth. Coaches can correct it quickly when a fresh set of downs occurs before fourth down.

## Error Handling

The quick save should use the same validation rules as the existing clip editor where possible.

Required checks:

- A target video must exist.
- Start and end timestamps must parse successfully.
- End must be after start.

If validation fails, the bar should keep the entered values and show a compact inline error near the save action.

## Data Flow

The quick bar can share the existing `ClipForm` state shape where practical, but it should have a smaller UI surface than `VideoClipEditor`.

The save path should reuse the existing clip creation logic so quick-created clips behave the same as clips created through the detailed editor.

Expected flow:

1. The YouTube player reports the current playback position.
2. The coach sets start and end from the current time or manual edits.
3. The coach sets quick metadata.
4. The app generates a temporary title.
5. The existing insert/update pathway persists the clip.
6. The local video list updates and the quick bar resets for the next clip.

## Testing

Cover the quick registration behavior with focused tests around pure helpers where possible:

- Timestamp nudging handles lower bounds and normal increments.
- Generated titles omit missing fields cleanly.
- Down advancement cycles from fourth down back to first down.
- Quick form reset preserves the intended defaults and clears timestamps.

For UI verification:

- Confirm the quick bar can save a clip with only the quick metadata.
- Confirm invalid timestamp ranges show an inline error and preserve values.
- Confirm existing detailed editing still works for quick-created clips.
