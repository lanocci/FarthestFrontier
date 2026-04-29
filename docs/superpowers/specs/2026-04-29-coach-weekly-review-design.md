# Coach Weekly Review View Design

## Context

Coaches need a read-focused view where they can review weekly goals and reflections for all players at once. The current app already stores weekly practice data as `PlayerPracticeEntry` records per player and practice date, and individual player pages already handle goal and reflection entry. This feature should reuse that model and avoid adding a second editing surface.

## Goals

- Let coaches review all players' weekly goals and reflections from one screen.
- Make missing goals, missing reflections, and completed reflections easy to spot.
- Preserve the current individual player goal and reflection pages as the place for edits.
- Keep the experience consistent with the existing dashboard card style.

## Non-Goals

- No coach review notes, approval state, or "reviewed" flag in this iteration.
- No new database tables or migrations.
- No bulk editing from the review list.
- No guardian-specific review workflow.

## User Experience

Add a coach-only weekly review view with a card list layout. The page has a practice-date selector at the top, summary counts, search/filter controls, and one card per player.

Each player card shows:

- Player name, jersey number, grade, offense and defense position labels, and active/rest status.
- Offense goal for the selected practice date.
- Offense reflection rating and comment, if present.
- Defense goal for the selected practice date.
- Defense reflection rating and comment, if present.
- Status chips for missing goal, goal set, partial reflection, and reflection complete.
- Links to the existing individual weekly goal and reflection pages for the same practice date.

The screen is read-focused. Coaches use the cards to spot what needs attention, then jump to the individual page when they need to add or adjust content.

## Navigation

Add an entry point visible to coaches:

- Add a compact button from the home dashboard's weekly panel.
- Use `/weekly-review` as the route.
- In `GlobalHeader`, keep the dashboard/home tab active for the weekly review view so the header does not gain another top-level tab.

Guardians do not see the review entry point. If a guardian reaches the route directly, the page shows a concise no-access state with a link back to home.

## Data Flow

The view consumes existing `players`, `positionMasters`, `teamRole`, `linkedPlayerIds`, `teamMessage`, and date helpers from `useTeam` through `AppShell`.

For the selected practice date:

1. Use `getPracticeEntry(player, selectedPracticeDate)` for each player.
2. Derive counts from active players:
   - players with at least one goal
   - players with any reflection rating
   - players with both offense and defense reflection complete when both goals exist
   - players with missing goal/reflection work
3. Sort players in the same stable order as the dashboard: linked players first, jersey number, then Japanese name order.
4. Apply search and optional status filters locally.

No persistence is required for this feature because it does not create new data.

## Components

Create a dedicated `CoachWeeklyReview` component instead of expanding `TeamDashboard`.

Responsibilities:

- Own selected practice date, search text, and status filter state.
- Compute summary counts and filtered players.
- Render review cards and individual page links.
- Keep card markup focused and testable through small helper functions when useful.

Update `AppShell` to support a new view value for the review screen and pass the existing team context data to `CoachWeeklyReview`.

Add a Next.js route file for `/weekly-review` that renders `AppShell view="weekly-review"`.

## Visual Design

Use the selected card-list direction from the brainstorming mockup:

- Dense enough for coaches to scan multiple players.
- Similar card shape and controls to the current home dashboard.
- Avoid table-first layout so it remains usable on phones and tablets.
- Use status chips and rating emojis to make completion state quick to read.
- Keep buttons compact and reuse existing `button`, `secondary`, and `button-compact` styles where possible.

Add only the CSS needed for the review page. Reuse existing dashboard, toolbar, chip, player card, and practice summary patterns when they fit.

## Error and Empty States

- If there are no players, show the same kind of empty state used elsewhere.
- If the selected date has no entries, show all players with missing state rather than hiding them.
- If the user cannot access the coach review view, show a concise no-access message with a link back to home.
- If remote data is loading, rely on the existing app-level loading state.

## Testing

Use test-first implementation for logic that can be isolated:

- Date option generation includes recent practice dates plus dates from player entries.
- Status classification handles missing goals, goal-only, partial reflection, and complete reflection.
- Filtering by player name and status returns the expected players.

After implementation, run:

- `npm run typecheck`
- Any focused test command added for the review helpers
- A browser check for the `/weekly-review` page at desktop and mobile widths

## Implementation Notes

Extract pure helper functions for date options, player sorting, status classification, and filtering. Avoid new database fields or writes. The first version is a coach's review surface while leaving richer review workflows for a later iteration.
