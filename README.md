# Contractions Timer for Obsidian

[![GitHub release](https://img.shields.io/github/v/release/cybersader/obsidian-contractions-timer?style=flat-square)](https://github.com/cybersader/obsidian-contractions-timer/releases)
[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?color=7c3aed&label=downloads&query=%24%5B%22obsidian-contractions-timer%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&style=flat-square)](https://obsidian.md/plugins?id=obsidian-contractions-timer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![Mobile Ready](https://img.shields.io/badge/mobile-ready-green?style=flat-square)

A mobile-friendly contraction timer that lives right inside your Obsidian notes. Track contractions with a big one-tap button, monitor the 5-1-1 rule with detailed progress, estimate your labor stage, get hospital departure advice, assess whether contractions are real or practice, and visualize patterns with a TOCO-style wave chart -- all stored as markdown-native data.

<!-- TODO: Add screenshot/demo GIF here -->

## Features

### Core Timer
- **Big one-tap button** -- Start and stop contractions with a single tap, shows contraction count ("Start contraction #4")
- **Background tracking** -- Navigate to other notes and come back; active contractions resume from their stored start time
- **Pause and resume** -- Freeze the rest timer when you need a break from tracking
- **Markdown-native storage** -- All data stored as JSON inside a code block, fully portable and searchable
- **Dark mode** -- Calming color palette designed for dim labor rooms

### Analysis & Insights
- **5-1-1 rule tracking** -- Detailed progress showing each criterion (interval, duration, sustained) with actual values vs targets, plus a "Time to go!" alert when all are met
- **Labor stage estimation** -- Automatically estimates Pre-labor, Early labor, Active labor, or Transition based on your contraction patterns, with evidence-based stage duration estimates personalized to first-time vs. subsequent pregnancies
- **Trend analysis** -- Shows how intervals and durations are changing over time, with estimated time to 5-1-1 threshold. Session-aware: filters out cross-session gaps so a 12-hour break doesn't distort your trends
- **Pattern assessment** -- Evaluates 6 clinical criteria (regularity, duration trend, intensity progression, location pattern, shortening intervals, sustained activity) to estimate whether contractions are practice (Braxton Hicks) or real labor. All thresholds are configurable.
- **Hospital departure advisor** -- Personalized departure timing based on your contraction pattern, travel time, risk comfort level, and progression rate. Three display modes: range estimate, urgency-based, or minimal.

### Visualization
- **Wave chart** -- TOCO-style visualization with clock-time labels, intensity-based peak heights, live animation during active contractions, and optional threshold overlay showing how close intervals are to the 5-1-1 target (green/amber baseline segments)
- **Summary cards** -- Average contraction length, average time apart, and contraction count at a glance
- **Timeline table** -- Full history with duration, rest time (end-to-start gap), interval (start-to-start), intensity, and location. Tap any row to edit start time, end time, duration, intensity, location, and notes.
- **Stage duration bar** -- Visual progress through estimated stage duration range

### Rating & Tracking
- **Intensity rating** -- Post-contraction picker for intensity (3 or 5 levels) with descriptive hints
- **Location tracking** -- Front, back, or wrapping -- helps distinguish Braxton Hicks from real labor
- **Live contraction rating** -- Optional "past the peak" button during active contractions to shape the wave chart curve
- **Water break recording** -- Quick button to record when your water breaks, with population statistics
- **Contextual tips** -- Educational tips that change based on your current labor stage

### Editing & Data Management
- **Inline history editing** -- Tap any timeline row to edit start time, end time, duration, intensity, location, and notes
- **Duration editing** -- Edit contraction duration directly (M:SS format); end time updates automatically
- **Delete and clear** -- Remove the most recent contraction or reset the entire session
- **Collapsible sections** -- Drag to reorder panels; collapse sections you don't need right now

## How It Works

Add a `contraction-timer` code block to any note:

````markdown
```contraction-timer
{"contractions":[]}
```
````

The plugin renders an interactive widget in reading/live-preview mode. You can also use the command palette (**Insert contraction timer**) or the ribbon icon.

## Quick Start

1. Install the plugin (see [Installation](#installation))
2. Open any note and run **Insert contraction timer** from the command palette
3. Switch to reading or live-preview mode
4. **Tap the green button** when a contraction starts
5. **Tap the red button** when it ends
6. Optionally rate intensity and location
7. Watch the stats, wave chart, and labor stage update automatically

## Understanding the Display

### Timer Display

- **Ready to start** -- No contractions yet, with a hint to tap the button
- **Contracting...** -- Active contraction with elapsed time counting up (red)
- **Time since last contraction** -- Rest period with a subtitle showing last contraction's duration
- **Paused** -- Timer frozen (tap Resume in the controls to continue)

### Hero Display

Three modes (configurable in settings):
- **Stage badge** -- Current labor stage with color indicator (default)
- **Action card** -- What to do now based on your pattern
- **Compact timer** -- Minimal time display

### Summary Cards

Three cards showing:
- **Avg length** -- Average contraction duration
- **Avg apart** -- Average interval (start-to-start)
- **Contractions** -- Total count

### 5-1-1 Progress

Below the summary cards, each criterion is shown with its actual value and target:

| Criterion | Example | Target |
|-----------|---------|--------|
| Interval | 5.4 min avg | Need 5 min or less |
| Duration | 48s avg | Need 60s or more |
| Sustained | 32 min | Need 60 min or more |

A green dot means the criterion is met. When all three are met, a prominent **"Time to go!"** banner appears.

### Labor Stage

Based on your most recent contractions, the plugin estimates which stage you may be in:

| Stage | Interval | Duration | Color |
|-------|----------|----------|-------|
| Pre-labor | Irregular / >15 min | <30s | Gray |
| Early labor | 5-30 min | 30-45s | Green |
| Active labor | 3-5 min | 45-60s | Orange |
| Transition | 1-3 min | 60-90s | Red |

Stage boundaries are configurable and default to ACOG 2024 guidelines. Duration estimates are personalized for first-time vs. subsequent pregnancies using Zhang et al. 2010 population data.

This is an estimate based on general clinical patterns and is not medical advice.

### Hospital Departure Advisor

When enabled, shows personalized departure timing based on:
- Your contraction pattern (interval, duration, regularity)
- Travel time to hospital (5-120 min)
- Your risk comfort level (conservative/moderate/relaxed)
- Progression rate assumption (slower/average/faster)

Three display modes:
- **Range estimate** -- Earliest, likely, and latest departure windows
- **Urgency** -- Color-coded departure advice
- **Minimal** -- Pattern summary only

### Pattern Assessment (Braxton Hicks vs. Real Labor)

With 4+ contractions, the plugin evaluates 6 criteria:

| Criterion | Real Labor Sign | Practice Sign |
|-----------|----------------|---------------|
| Regular timing | Low variation (CV < 0.3) | High variation (CV > 0.6) |
| Growing intensity | Trend upward | Stable or mixed |
| Back/wrapping location | >50% back or wrapping | Mostly front |
| Shortening intervals | Intervals decreasing | No clear trend |
| Increasing duration | Getting longer | Stable or shorter |
| Sustained pattern | Active for 2+ hours | Short bursts |

Each criterion shows a colored badge (real labor / practice / inconclusive). The overall verdict combines all criteria into a weighted score. Hover over criteria for threshold details; click the gear icon to tune thresholds in settings.

### Trend Analysis

When you have 4+ contractions, the plugin shows:
- **Interval trend** -- Are contractions getting closer or further apart?
- **Duration trend** -- Are they getting longer or shorter?
- **Estimated time to 5-1-1** -- If trends are progressing toward the threshold

Trend analysis is session-aware: it filters out gaps longer than the chart gap threshold (default 30 min) so a break between tracking sessions doesn't distort the data.

### Wave Chart

Mimics a hospital fetal monitor (tocodynamometer) strip:
- Each **peak** is one contraction
- **Height** = intensity (taller = stronger)
- **Width** = duration (wider = longer)
- **Spacing** = interval (closer = more frequent)
- **Color** = intensity gradient (blue=mild, red=intense)
- **X-axis** = clock times (e.g., "2:15p", "2:30p")

Optional **threshold overlay** (enable in settings): colors the baseline green when intervals meet the 5-1-1 threshold and amber when within 1.5x the threshold.

### Timeline Table

Columns: #, Time, Duration, Rest (end-to-start gap), Interval (start-to-start), Intensity, Location. Displayed in reverse chronological order.

**Tap any row** to open the inline editor where you can modify start time, end time, duration (M:SS), intensity, location, and notes.

### Session Controls

At the bottom of the widget:
- **Pause / Resume** -- Freeze the rest timer and dismiss pickers
- **Delete last** -- Remove the most recent contraction
- **Clear all** -- Reset the entire session

## Installation

### With BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: `cybersader/obsidian-contractions-timer`
4. Enable the plugin

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/cybersader/obsidian-contractions-timer/releases)
2. Create a folder: `<your-vault>/.obsidian/plugins/obsidian-contractions-timer/`
3. Copy the three files into that folder
4. Reload Obsidian and enable the plugin in Settings > Community Plugins

## Settings

### Your Situation

| Setting | Default | Description |
|---------|---------|-------------|
| Pregnancy type | First baby | First-time vs. subsequent pregnancy (changes all duration estimates) |

### Hospital Advisor

| Setting | Default | Description |
|---------|---------|-------------|
| Travel time | 30 min | Door-to-door travel time to hospital |
| Risk comfort level | Moderate | Conservative / Moderate / Relaxed departure timing |
| Provider phone | (empty) | Shown in urgent situations for quick access |
| Advisor display mode | Range estimate | Range / Urgency / Minimal |
| Progression rate | Slower | Affects the time range estimates |

### Threshold Rule (5-1-1)

| Setting | Default | Description |
|---------|---------|-------------|
| Interval | 5 min | Contractions this far apart or less |
| Duration | 60 sec | Contractions this long or more |
| Sustained period | 60 min | How long the pattern must hold |

### Stage Boundaries

Configurable per stage (Transition, Active, Early): max interval and min duration thresholds. Defaults match ACOG guidelines.

### Features

| Setting | Default | Description |
|---------|---------|-------------|
| Show hospital advisor | On | Departure urgency based on patterns |
| Show contextual tips | On | Educational tips for current stage |
| Show pattern assessment | On | Practice vs. real labor evaluation |
| Show labor guide | On | Collapsible reference panel with stage info |
| Show water break button | On | Quick button to record water breaking |
| Live contraction rating | Off | "Past the peak" button during contractions |

### Display

| Setting | Default | Description |
|---------|---------|-------------|
| Hero display | Stage badge | Stage badge / Action card / Compact timer |
| Show wave chart | On | Toggle the wave visualization |
| Show timeline | On | Toggle the history table |
| Show summary cards | On | Toggle the statistics cards |
| Show trend analysis | On | Toggle progression trends and estimated time |
| Show intensity picker | On | Post-contraction intensity buttons |
| Show location picker | On | Post-contraction location buttons |
| Intensity scale | 5 levels | Choose 3 or 5 intensity levels |
| Time format | 12-hour | 12h or 24h clock for wave chart labels |
| Wave chart height | Medium | Small (100px) to Full (300px) |
| Chart gap compression | 30 min | Compress gaps longer than this in the wave chart |
| Wave chart threshold overlay | Off | Experimental: green/amber baseline segments |

### Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| Haptic feedback | On | Vibrate on button press (mobile only) |
| Persist pause | On | Keep timer paused across navigation |
| Stage time basis | Last recorded | Last recorded contraction vs. current clock |

### Pattern Assessment Thresholds (Advanced)

For power users who want to tune the Braxton Hicks assessment algorithm:

| Setting | Default | Description |
|---------|---------|-------------|
| Regularity CV (regular) | 0.3 | CV below this = "regular" pattern |
| Regularity CV (irregular) | 0.6 | CV above this = "irregular" pattern |
| Location ratio (back/wrapping) | 0.5 | Above = suggests real labor |
| Location ratio (front) | 0.2 | Below = suggests practice |
| Sustained minimum | 120 min | Total span needed for "sustained" |
| Sustained max gap | 30 min | Max gap within a sustained session |
| Verdict: real labor | 60 | Score at or above = "likely real labor" |
| Verdict: practice | 30 | Score at or below = "likely practice" |

### Clinical References

All clinical data (stage duration ranges, water break statistics, contraction patterns) is editable in settings with source links to original research:
- Zhang et al. 2010 -- Stage duration population data
- ACOG 2024 -- Stage classification guidelines
- StatPearls -- Braxton Hicks criteria, PROM statistics
- Cleveland Clinic -- Water break management

## Tips for Labor

- **Keep it simple**: The big button is all you really need. Stats, pickers, and charts are optional context.
- **One-handed use**: Designed for a partner to operate with one hand while supporting the laboring person.
- **Navigate freely**: You can switch to other notes. Active contractions keep their timestamp and resume when you return.
- **Pause when needed**: Tap Pause to stop the rest timer during breaks between tracking sessions.
- **Trust the stage indicator**: It's based on clinical patterns but every labor is different. Always follow your care provider's guidance.
- **Location tracking helps**: Wrapping contractions that start in the back are more likely to be real labor. Front-only may be Braxton Hicks.
- **Edit mistakes**: Tap any row in the timeline to fix times, duration, or ratings.
- **Pattern assessment is a guide**: The practice vs. real labor assessment uses 6 clinical criteria but is not a medical diagnosis. When in doubt, call your provider.

## Development

### Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Obsidian](https://obsidian.md/) (for manual testing)

### Setup

```bash
# Clone into a test vault's plugin directory
cd <your-test-vault>/.obsidian/plugins/
git clone https://github.com/cybersader/obsidian-contractions-timer.git

# Install dependencies
cd obsidian-contractions-timer
bun install

# Set up pre-commit hooks (prevents personal data leaks)
bash scripts/setup-hooks.sh

# Set up the test vault (creates community-plugins.json, sample note)
bash scripts/setup-test-vault.sh

# Start development (watches for changes)
bun run dev
```

### Commands

```bash
bun run dev          # Watch mode (auto-rebuild on save)
bun run build        # Production build (type-check + bundle)
bun test             # Run unit tests (117 tests)
bun run lint         # ESLint with Obsidian plugin rules
```

### Releasing

```bash
bash scripts/release.sh 0.2.0
```

This bumps the version, builds, commits, tags, and pushes. GitHub Actions creates the release automatically.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run `bash scripts/setup-hooks.sh` (required for pre-commit checks)
4. Make your changes
5. Run `bun run build && bun run lint && bun test`
6. Submit a pull request

## License

[MIT](LICENSE)
