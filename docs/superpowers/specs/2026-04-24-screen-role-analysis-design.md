# Screen Role Analysis Design

## Purpose

This feature extends the current video AI proof of concept toward practical coaching support for youth flag football. The first analysis target is an offensive screen-role player, because the team currently needs stronger individual feedback for players who should interfere with a defender's running path without contact.

The goal is not to produce a fully automatic tactical judgment. The first version should help coaches compare a selected player's actual movement with the intended screen area from the playbook, then turn that comparison into one short, actionable improvement point for the player.

## Scope

The first version focuses on one offensive player in one clip:

- Select a clip from the film room.
- Select one target player assigned to a screen role.
- Define or reuse the player's intended screen target area on the playbook board.
- Display the player's detected movement trail over the video.
- Compare that trail against the intended screen area and related offensive lane.
- Generate a small set of coach-reviewable observations and one player-facing improvement comment.

Defense-aware analysis, multi-player unit timing, and automatic play design evaluation are intentionally out of scope for the first version. The data model should still leave room for those later phases.

## User Experience

The analysis should live near the existing audiovisual room and clip workflow, not as a separate standalone sandbox. The AI sandbox can remain useful for model experimentation, but the coaching workflow should be tied to real film clips and existing playbook assets.

The expected flow is:

1. A coach opens a film clip.
2. The coach starts screen-role analysis for that clip.
3. The coach chooses the target player from the clip's existing player links or active player list.
4. The coach chooses the related playbook asset or clip whiteboard.
5. The coach places a target screen area for that player if one is not already defined.
6. The system tracks the player's movement in the clip and shows the trail.
7. The system compares the movement with the target area and optional ball-carrier lane.
8. The coach reviews the generated observations and keeps, edits, or ignores the suggested comment.

For low-grade elementary players, the final comment should be short and encouraging. It should focus on the next practice cue, such as "move outside right away" or "stay half a step wider so the runner has space."

## Analysis Model

The first useful analysis can be based on four simple checks:

- Start position: whether the player begins near the expected side or area.
- First movement: whether the first movement after the snap goes toward the screen target area.
- Arrival: whether the player reaches the target area within the expected time.
- Lane interference: whether the player drifts into the ball carrier's intended running lane.

Each check should return a status, a measured value where possible, and a coach-readable note. The first version can use thresholds that are visible in code and easy to tune.

Example result shape:

```ts
type ScreenAnalysisCheck = {
  key: "start-position" | "first-movement" | "arrival" | "lane-interference";
  status: "good" | "watch" | "needs-work" | "unknown";
  measuredValue?: number;
  message: string;
};
```

## Data Model

The feature should add a clip-level analysis record rather than changing the existing video or playbook entities directly. This keeps analysis output separate from source material and allows repeated analysis attempts as the model improves.

Suggested assignment shape:

```ts
type ScreenAssignment = {
  targetPlayerId: string;
  role: "screen";
  targetArea: {
    x: number;
    y: number;
    radius: number;
  };
  expectedArrivalSeconds: number;
  avoidLaneForPlayerId?: string;
};
```

Suggested analysis result shape:

```ts
type ClipMovementAnalysis = {
  id: string;
  clipId: string;
  side: "offense" | "defense";
  targetType: "player" | "unit" | "play";
  role: "screen";
  assignment: ScreenAssignment;
  track: Array<{
    timeSeconds: number;
    x: number;
    y: number;
    confidence: number;
  }>;
  checks: ScreenAnalysisCheck[];
  suggestedComment: string;
  coachComment?: string;
  createdAt: string;
  updatedAt: string;
};
```

The normalized `x` and `y` coordinates should match the playbook board coordinate system when possible. If the first implementation cannot reliably transform camera pixels to board coordinates, it should clearly mark analysis confidence as low and keep the visual comparison coach-assisted.

## Technical Approach

The current AI sandbox runs YOLOv8 through `onnxruntime-web` in the browser. That is a reasonable starting point for detecting people, but screen analysis needs additional layers:

- Detection: identify people in sampled video frames.
- Tracking: keep a stable candidate track for the selected player across time.
- Calibration: map video positions into normalized field or board coordinates.
- Assignment: connect the selected player to a screen-role target area.
- Evaluation: run the four screen checks against the track.
- Review: let the coach accept or edit the generated comment.

The first version can use coach-assisted tracking if automatic identity assignment is unreliable. For example, the coach may click the target player at the start of the clip, and the system follows the closest person detection in subsequent frames.

## Future Expansion

Once individual screen-role feedback is useful, the same foundation can expand in this order:

1. Add ball-carrier lane comparison so screen feedback can account for the runner's intended path.
2. Add nearby defender tracking to judge whether the screen player gets between the defender and the runner.
3. Add multiple offensive players to evaluate spacing and timing as a unit.
4. Add defensive analysis for pursuit angle, spacing, and reaction to motion or fake actions.
5. Add play-design review that compares intended space creation with actual space creation.

This keeps the first version focused on individual improvement while preserving a route to later unit and play-level coaching.

## Error Handling

The analysis should be explicit when confidence is low. Common low-confidence cases include:

- The selected player is occluded or leaves the frame.
- Multiple players overlap and the tracker may have switched identities.
- The camera angle cannot be mapped to the playbook board with enough confidence.
- The target area or expected arrival time has not been configured.

In those cases, the UI should show the trail and notes as review aids, not definitive judgments.

## Testing

The first implementation should include focused tests for the pure analysis logic:

- Start position status based on distance from the expected area.
- First movement direction toward or away from the target area.
- Arrival status based on entering the target radius before the expected time.
- Lane interference status based on proximity to the runner's intended lane.
- Suggested comment selection from check results.

UI testing can stay light initially, but the analysis panel should be checked manually with at least one sample clip where the coach can confirm whether the generated observation is reasonable.
