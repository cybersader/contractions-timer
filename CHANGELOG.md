# Changelog

All notable changes to the Obsidian Contractions Timer plugin will be documented in this file.

## [0.1.7] - 2026-02-09

### Added
- **"Earlier..." custom time stepper**: "Had one" picker now includes an "Earlier..." option that opens an hour/minute stepper (up to 48h ago) for contractions missed long ago.
- **Skip button on rating pickers**: Post-contraction intensity/location pickers now have a "Skip" button and are visually grouped in a bordered card, making it clear they're optional and dismissible.

### Fixed
- Untimed contractions no longer trigger the regular intensity/location pickers (the untimed confirmation has its own inline intensity picker).

## [0.1.6] - 2026-02-09

### Added
- **"Had one" untimed picker**: Redesigned missed-contraction logging with a compact "Had one" button next to Start. Tap it to choose how long ago (Just now, ~5 min, ~15 min, ~30 min), then rate intensity. Replaces the old full-width untimed button.
- **Smart rest timer**: Rest display now switches from `M:SS` to `Xh Ym` after 1 hour and `Xd Yh` after 24 hours, so long gaps between contractions are readable at a glance.
- **Always-visible sections**: Pattern Assessment, Trend Analysis, and Hospital Advisor sections now always appear with a placeholder message when there isn't enough data, so you can see and reorder all sections from the start.
- **Untimed contractions in charts**: Wave chart shows untimed contractions as dashed markers with diamond tips instead of bell curves. History table shows "Untimed" in the duration column.
- Untimed contractions are excluded from duration-based stats (average duration, 5-1-1 duration check, stage estimation) but included in interval and count calculations.

### Fixed
- Location picker disappearing when intensity was set before location (both pickers now stay visible until both are rated).

## [0.1.5] - 2026-02-09

### Fixed
- Post-contraction picker bug: setting intensity before location caused location picker to vanish on re-render. Condition now checks both fields.

## [0.1.4] - 2026-02-09

### Added
- Untimed contraction logging (initial version, later redesigned in 0.1.6).
- Smart rest timer formatting.
- Always-visible sections with placeholders.
- Untimed filtering in duration stats and Braxton Hicks assessment.

## [0.1.3] - 2026-02-08

### Fixed
- Mobile styling refinements for event buttons and pickers.

## [0.1.2] - 2026-02-08

### Added
- Configurable Braxton Hicks assessment thresholds.
- Duration editing in history timeline.
- Trend analysis clarity improvements.
- Wave chart threshold overlay.

## [0.1.1] - 2026-02-07

### Fixed
- Mobile layout and touch target sizing.
- Button spacing on narrow screens.

## [0.1.0] - 2026-02-07

### Added
- Initial release with full contraction timer widget.
- Big start/stop button with live timer display.
- Intensity (1-5) and location (front/back/wrapping) rating.
- Wave chart (TOCO-style) visualization.
- Summary cards (count, avg duration, avg interval).
- Timeline history table with inline editing.
- Hospital advisor with 5-1-1 rule tracking.
- Braxton Hicks pattern assessment (6 criteria).
- Trend analysis with session-filtered intervals.
- Water break event tracking.
- Contextual tips and clinical reference guide.
- Collapsible, reorderable sections.
- Stage duration bar and labor stage estimation.
- Haptic feedback support for mobile.
- Pause/resume functionality.
- Data stored as JSON in markdown code blocks.
