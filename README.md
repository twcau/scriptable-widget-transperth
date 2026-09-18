# Transperth Journey-Aware Train Widget for Scriptable

A highly configurable iPhone and iPad Home Screen widget, which uses the [Scriptable app](https://scriptable.app/) to show upcoming [Transperth](https://www.transperth.wa.gov.au) train services from and to the stations of your choosing, and caches information in case of connectivity loss or API failure.

<p align="center">
<img src="D7ED281B-648B-4E92-9A5A-7EA01316FB3B.png" alt="Screenshot of Medium sized iOS widget in use, made possible with the Scriptable app, to display schedule information for upcoming journeys from Joondalup to Perth, showing the next three services - all running on time, and that it was updated with live data at 2131hrs on the day the screenshot was taken. The screenshot shows information about each of the three next journeys, including the destination and starting station for the train, which platform it departs from at the departure station, how many cars long the train is, and which class of Transperth train rolling stock the journey is being operated by." width="50%">
</p>

> [!WARNING]
>
> **Use at your own risk**
>
> Whilst all reasonable efforts have been made to ensure that this delivers reliable and accurate information, Live transport information may be delayed, incomplete, unavailable, or changed at short notice. Always follow official station signage, announcements, staff directions, and current Transperth information when making travel decisions.

> [!IMPORTANT]
>
> **Unofficial community project**
>
> This is an unofficial community project. It is not affiliated with, endorsed by, or supported by the Public Transport Authority of Western Australia, Transperth, Apple, or Scriptable.

## Contents

- [Contents](#contents)
- [Features](#features)
  - [Privacy and security](#privacy-and-security)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Finding correct station names](#finding-correct-station-names)
- [How does it do what it does?](#how-does-it-do-what-it-does)
  - [What each live update does](#what-each-live-update-does)
  - [Why are platform numbers are not used for journey direction?](#why-are-platform-numbers-are-not-used-for-journey-direction)
- [Quick configuration examples](#quick-configuration-examples)
  - [Mount Lawley to Perth](#mount-lawley-to-perth)
  - [Joondalup to Perth Underground](#joondalup-to-perth-underground)
  - [Multiple acceptable destinations](#multiple-acceptable-destinations)
- [A note on previewing a widget in Scriptable](#a-note-on-previewing-a-widget-in-scriptable)
- [Complete configuration reference](#complete-configuration-reference)
  - [Journey settings](#journey-settings)
    - [`originStation`](#originstation)
    - [`originAlias`](#originalias)
    - [`destinationStations`](#destinationstations)
    - [`destinationLabel`](#destinationlabel)
    - [`apiLine`](#apiline)
    - [`maximumJourneyHours`](#maximumjourneyhours)
    - [`allowTerminalDestinationFallback`](#allowterminaldestinationfallback)
  - [Visible departure limits](#visible-departure-limits)
  - [Cache depth and age](#cache-depth-and-age)
  - [Cancellation settings](#cancellation-settings)
  - [Refresh scheduling](#refresh-scheduling)
  - [Fresh-cache reuse](#fresh-cache-reuse)
  - [Cache compatibility](#cache-compatibility)
  - [Network and 429 protection](#network-and-429-protection)
  - [Multiple-instance identity](#multiple-instance-identity)
  - [Display controls](#display-controls)
  - [Expected countdown and sorting](#expected-countdown-and-sorting)
  - [Accessibility settings](#accessibility-settings)
  - [Small-widget controls](#small-widget-controls)
  - [Theme colours](#theme-colours)
  - [Diagnostics controls](#diagnostics-controls)
- [Cancellation handling](#cancellation-handling)
  - [Recommended `alert` policy](#recommended-alert-policy)
  - [`show` policy](#show-policy)
  - [`hide` policy](#hide-policy)
  - [Cancellation alert limits](#cancellation-alert-limits)
  - [Cancellation-aware cache coverage](#cancellation-aware-cache-coverage)
- [Delays and departure sorting](#delays-and-departure-sorting)
  - [Delay-aware countdowns](#delay-aware-countdowns)
  - [Delay severity bands](#delay-severity-bands)
- [Widget layouts](#widget-layouts)
  - [Small](#small)
  - [Medium](#medium)
  - [Large](#large)
- [Accessibility](#accessibility)
- [Refresh and rate-limit protection](#refresh-and-rate-limit-protection)
- [Caching and multiple widget instances](#caching-and-multiple-widget-instances)
  - [Isolated journey caches](#isolated-journey-caches)
  - [Shared station boards](#shared-station-boards)
  - [Render-time pruning](#render-time-pruning)
  - [Cache exhaustion](#cache-exhaustion)
  - [Cache provenance and migration](#cache-provenance-and-migration)
- [Diagnostics](#diagnostics)
  - [Scriptable log](#scriptable-log)
  - [On-widget diagnostics](#on-widget-diagnostics)
- [Common errors and troubleshooting](#common-errors-and-troubleshooting)
  - [Quick guide](#quick-guide)
  - [A cancelled train is missing](#a-cancelled-train-is-missing)
  - [A cancelled train appears separately above usable trains](#a-cancelled-train-appears-separately-above-usable-trains)
  - [A cancelled train occupies a normal row](#a-cancelled-train-occupies-a-normal-row)
  - [Rate limited with no cache](#rate-limited-with-no-cache)
  - [Configuration error](#configuration-error)
  - [Cache rejected](#cache-rejected)
  - [Blank widget or JavaScript error](#blank-widget-or-javascript-error)
- [Frequently asked questions](#frequently-asked-questions)
  - [Can the widget handle more than one train line?](#can-the-widget-handle-more-than-one-train-line)
  - [Must every possible terminal be configured?](#must-every-possible-terminal-be-configured)
  - [Can more than one destination be accepted?](#can-more-than-one-destination-be-accepted)
  - [Can several copies run at once?](#can-several-copies-run-at-once)
  - [Why does one copy have a cache while another does not?](#why-does-one-copy-have-a-cache-while-another-does-not)
  - [Why does the widget show stale data?](#why-does-the-widget-show-stale-data)
  - [Why is a train shown as `Due`?](#why-is-a-train-shown-as-due)
  - [Why did train order change?](#why-did-train-order-change)
  - [Does the widget know every disruption type?](#does-the-widget-know-every-disruption-type)
  - [Does the widget refresh exactly every 10 or 60 minutes?](#does-the-widget-refresh-exactly-every-10-or-60-minutes)
  - [Can logging be disabled?](#can-logging-be-disabled)
- [Upgrading](#upgrading)
  - [Before upgrading](#before-upgrading)
  - [Recommended process](#recommended-process)
  - [Post-upgrade checklist](#post-upgrade-checklist)
  - [Rollback](#rollback)
- [Known limitations](#known-limitations)
- [Credits and acknowledgements](#credits-and-acknowledgements)
  - [Project development](#project-development)
  - [Platforms and data](#platforms-and-data)
  - [External dependencies](#external-dependencies)
- [Change log](#change-log)
  - [v4.6](#v46)
  - [v4.5.1](#v451)
  - [v4.5](#v45)
  - [v4.4](#v44)
  - [v4.3](#v43)
  - [v4.2](#v42)
  - [v4.1](#v41)
  - [v4.0](#v40)
  - [v3.3.1](#v331)
  - [v3.3](#v33)
  - [Initial development](#initial-development)
- [Disclaimer](#disclaimer)

## Features

- Journey-aware results across every train line serving the configured stations.
- Combined `All` station-board requests.
- Exact `TripId` correlation for through-running trains.
- Terminal-destination fallback for trains ending at an accepted destination.
- One origin and one or more acceptable destination stations.
- Real-time, delay-aware departure countdowns.
- Scheduled or expected departure sorting.
- Four delay severity bands.
- First-class cancellation detection and display policies.
- Cancelled services excluded from usable cache coverage.
- Separate small, medium, and large layouts.
- High-contrast mode and three font profiles.
- Standard and countdown-focused layouts.
- Long-horizon cache containing up to 180 minutes of available future information.
- Render-time removal of departed cached services.
- Isolated caches for different scripts and journey configurations.
- Shared short-lived station-board data to reduce duplicate API traffic.
- Shared HTTP 429 backoff across all instances.
- Cache provenance, migration, coverage, and exhaustion diagnostics.
- No credentials, API keys, accounts, packages, or third-party JavaScript libraries required.

### Privacy and security

- No username, password, API key, or token is required.
- No device location permission is requested.
- Configured station names are sent to Transperth in live-board requests.
- Cache, station-board, and backoff data are stored locally in Scriptable's documents directory.
- The script itself includes no analytics, advertising, telemetry, or third-party tracking; however this does not prevent or suggest that Transperth or the Public Transport Authority doesn't use such services to analyise requests made to its servers.

## How it works

The widget answers these passenger-focused questions.

- Which upcoming trains from my departure station are confirmed to call at an acceptable destination?
- When does each train depart?
- What platform does each train depart from?
- Are any of the trains delayed, and if so by how long?
- How many cars long is the train?
- What type/series of train is it?

The answers to these questions are all obtained using Transperth's live data, and rendered to the user in a friendly format that can be cached locally to reduce network requests, and also be updated on demand if the user needs to.

## Requirements

- iPhone or iPad with Scriptable installed.
- Internet access for live Transperth information.
- A valid origin station name.
- At least one valid destination station name.
- A small, medium, or large Scriptable Home Screen widget.

## Installation

1. Install the [Scriptable app](https://apps.apple.com/us/app/scriptable/id1405459188?uo=4) on your Apple iOS/iPadOS device.
2. Download the complete `code.js` file from the repository.
3. Open Scriptable.
4. Import the JavaScript file, or create a new script and paste the complete source.
5. Keep the Scriptable metadata comments at the very beginning of the file.
6. Edit the values inside `CONFIG` for the required journey and preferences.
   NOTE: Follow the steps at [Finding correct station names](#finding-correct-station-names) to get ther correct values for your config.
7. Run the script directly in Scriptable to validate the configuration, and [view the results](#a-note-on-previewing-a-widget-in-scriptable).
8. Add a Scriptable widget to the Home Screen.
9. Long-press the widget and select **Edit Widget**.
10. Select this script.
11. Repeat for any additional sizes or journey combinations.

### Finding correct station names

Use Transperth's official **Live Train Times** page:

<https://www.transperth.wa.gov.au/Timetables/Live-Train-Times>

Recommended process:

1. Open the Live Train Times page.
2. Select **All** as the line.
3. Open the station selector.
4. Copy the station label exactly.
5. Use the exact value in `originStation` or `destinationStations`.

Common examples include:

```text
Joondalup Stn
Mt Lawley Stn
Perth Stn
Perth Underground Stn
Airport Central Stn
```

`Perth Stn` and `Perth Underground Stn` are different station boards. Configure the station actually served by the required train. Add both only when either station is genuinely acceptable for the journey.

Keep the API selector as:

```javascript
apiLine: "All"
```

Values such as `All Lines` or `[All Lines]` are not valid substitutes for the verified route value.

## How does it do what it does?

### What each live update does

For each live update, the widget:

1. Requests the combined `All` board for the origin station.
2. Requests the combined `All` board for each configured destination station.
3. Runs the required requests concurrently.
4. Indexes destination-board entries by `TripId`.
5. Looks for the same `TripId` at a destination station later than the origin departure.
6. Rejects implausible matches beyond `maximumJourneyHours`.
7. Accepts a train when a valid later destination call exists.
8. Uses a normalised terminal fallback when the train terminates at an accepted destination.
9. Classifies cancellations separately from usable services.
10. Sorts and renders usable services according to the configured widget size.

This allows a train displaying a terminal beyond the passenger's destination to be included correctly. For example, a train displaying `Claremont` can still qualify for a journey to Perth when its `TripId` appears at Perth later.

### Why are platform numbers are not used for journey direction?

Platform assignments differ between stations and may change during disruptions. Platforms remain available for display, but the journey engine uses confirmed train calls rather than assuming that a particular platform always represents one direction.

## Quick configuration examples

### Mount Lawley to Perth

The supplied script is configured for Mt Lawley to Perth:

```javascript
journey: {
  originStation: "Mt Lawley Stn",
  originAlias: "Mt Lawley",
  destinationStations: ["Perth Stn"],
  destinationLabel: "Perth",
  apiLine: "All",
  maximumJourneyHours: 4,
  allowTerminalDestinationFallback: true
}
```

### Joondalup to Perth Underground

```javascript
journey: {
  originStation: "Joondalup Stn",
  originAlias: "Joondalup",
  destinationStations: ["Perth Underground Stn"],
  destinationLabel: "Perth",
  apiLine: "All",
  maximumJourneyHours: 4,
  allowTerminalDestinationFallback: true
}
```

### Multiple acceptable destinations

Use case: Trains from the departure station may terminate at multiple locations, or you might want to get off at a different station.

```javascript
journey: {
  originStation: "Bayswater Stn",
  originAlias: "Bayswater",
  destinationStations: [
    "McIver Stn",
    "Perth Stn"
  ],
  destinationLabel: "Perth CBD",
  apiLine: "All",
  maximumJourneyHours: 4,
  allowTerminalDestinationFallback: true
}
```

## A note on previewing a widget in Scriptable

The end of the script uses a large preview by default:

```javascript
if (!config.runsInWidget) {
  await widget.presentLarge();
}
```

For testing, change only the preview call to one of:

```javascript
await widget.presentSmall();
```

```javascript
await widget.presentMedium();
```

```javascript
await widget.presentLarge();
```

The preview call does not control the size of an installed Home Screen widget.

## Complete configuration reference

### Journey settings

#### `originStation`

Exact Transperth station name where the passenger boards.

```javascript
originStation: "Mt Lawley Stn"
```

#### `originAlias`

Shorter name used in the widget heading. Leave blank to derive a name by removing a trailing `Stn`.

```javascript
originAlias: "Mt Lawley"
```

#### `destinationStations`

One or more acceptable destination station names.

```javascript
destinationStations: ["Perth Stn"]
```

#### `destinationLabel`

Human-readable heading label.

```javascript
destinationLabel: "Perth"
```

#### `apiLine`

Keep this set to the combined board selector:

```javascript
apiLine: "All"
```

#### `maximumJourneyHours`

Maximum accepted time between the origin departure and destination call.

```javascript
maximumJourneyHours: 4
```

Increase this only for a legitimately longer train journey.

#### `allowTerminalDestinationFallback`

Includes a train that terminates at an accepted destination even when the destination departure board cannot show a later call.

```javascript
allowTerminalDestinationFallback: true
```

### Visible departure limits

```javascript
departuresShown: {
  small: 2,
  medium: 3,
  large: 6
}
```

These limits control visible usable services. Cancellation alerts have separate limits and do not consume usable-service positions when the `alert` policy is selected.

### Cache depth and age

```javascript
cacheDepartureBuffer: 2,
cacheHorizonMinutes: 180,
maximumCachedDepartures: 40,
cachedDepartureGraceMinutes: 2,
maximumCachedRealtimeAgeMinutes: 180,
staleStatusDisplay: "suppress",
staleStatusReplacement: "Cached schedule"
```

- `cacheDepartureBuffer`: retained compatibility setting for additional cached capacity.
- `cacheHorizonMinutes`: maximum forward horizon the script attempts to retain from a successful API response.
- `maximumCachedDepartures`: defensive maximum number of stored matched records.
- `cachedDepartureGraceMinutes`: brief grace period before a past departure is removed during rendering.
- `maximumCachedRealtimeAgeMinutes`: maximum age at which cached real-time estimates may remain usable.
- `staleStatusDisplay`: action for stale real-time row status after the configured threshold.
- `staleStatusReplacement`: replacement text when `staleStatusDisplay` is `replace`.

Supported stale-status policies are:

```javascript
staleStatusDisplay: "show"
```

```javascript
staleStatusDisplay: "suppress"
```

```javascript
staleStatusDisplay: "replace"
```

The 180-minute cache settings are upper limits. Actual coverage depends on how many future services Transperth supplies in a successful response.

### Cancellation settings

```javascript
cancelledServiceDisplay: "alert",
cancelledAlertsShown: {
  small: 1,
  medium: 1,
  large: 1
},
cancelledLabel: "Cancelled"
```

See [Cancellation handling](#cancellation-handling) for policy behaviour.

### Refresh scheduling

```javascript
normalRefreshMinutes: 60,
travelRefreshMinutes: 10,
useTravelWindows: true,
travelWindows: [
  { start: "06:00", end: "08:30" },
  { start: "16:00", end: "18:30" }
],
refreshAtTravelWindowStart: true
```

- `normalRefreshMinutes`: requested refresh interval outside travel windows.
- `travelRefreshMinutes`: requested interval during travel windows.
- `useTravelWindows`: enables the travel-window policy.
- `travelWindows`: local device times in `HH:MM` format.
- `refreshAtTravelWindowStart`: requests a refresh at the next travel-window start when earlier than the next normal refresh.

Overnight windows are supported:

```javascript
{ start: "22:00", end: "01:00" }
```

### Fresh-cache reuse

```javascript
reuseFreshCacheWithoutRequest: false,
freshCacheReuseMinutes: 1
```

When enabled, a sufficiently fresh cache can be rendered without a new request.

### Cache compatibility

```javascript
staleMinutes: 10,
maximumCacheAgeMinutes: 180,
cacheSchemaVersion: 7
```

- `staleMinutes`: age after which data receives a prominent stale footer.
- `maximumCacheAgeMinutes`: age after which the cache is rejected completely.
- `cacheSchemaVersion`: internal compatibility version. Do not edit unless developing the cache format.

### Network and 429 protection

```javascript
requestTimeoutSeconds: 15,
retryTransientFailures: true,
maximumRequestAttempts: 2,
retryDelayMilliseconds: 400,
rateLimitBackoffMinutes: 15,
sharedBoardReuseSeconds: 45
```

- Requests have a bounded timeout.
- Only transient failures are retried.
- The implementation permits at most two attempts.
- HTTP 429 is not retried immediately.
- A 429 creates a shared backoff across every widget instance using the same cache prefix.
- Recent station boards can be reused briefly across separate journey scripts.

### Multiple-instance identity

```javascript
instanceId: ""
```

Leave blank for automatic isolation based on the Scriptable script name and journey-affecting configuration.

Set a stable explicit value when two copies would otherwise have the same name and configuration:

```javascript
instanceId: "weekday-commute"
```

Changing the script name, `instanceId`, journey, sort mode, expected-time policy, or schema may create a new isolated cache.

### Display controls

```javascript
showBoardScope: true,
showDestination: true,
destinationStyle: "full",
showServiceLine: true,
serviceLineStyle: "short",
showPlatform: true,
showCars: true,
showTrainSeries: true,
showStatus: true,
showUpdatedTime: true
```

Supported destination styles:

```javascript
destinationStyle: "full"
```

```javascript
destinationStyle: "short"
```

Supported service-line styles:

```javascript
serviceLineStyle: "short"
```

```javascript
serviceLineStyle: "full"
```

### Expected countdown and sorting

```javascript
useExpectedCountdowns: true,
sortMode: "scheduled"
```

Supported sort modes:

```javascript
sortMode: "scheduled"
```

```javascript
sortMode: "expected"
```

Scheduled sorting is stable and follows timetable order. Expected sorting can reorder trains as delays change.

### Accessibility settings

```javascript
accessibility: {
  highContrastMode: false,
  fontProfile: "normal",
  layoutProfile: "standard"
}
```

Supported font profiles:

```text
normal
large
extra-large
```

Supported layout profiles:

```text
standard
countdown
```

### Small-widget controls

```javascript
smallWidget: {
  showDestination: false,
  showServiceLine: true,
  showPlatform: false,
  showCars: true,
  showTrainSeries: true,
  showStatus: false
}
```

### Theme colours

```javascript
darkMode: true,
colours: {
  dark: {
    background: "#0D1117",
    primary: "#FFFFFF",
    secondary: "#8B949E"
  },
  light: {
    background: "#F8F9FA",
    primary: "#111111",
    secondary: "#5F6368"
  },
  live: "#30D158",
  delayed: "#FFB000",
  moderate: "#FF7A00",
  severe: "#FF453A",
  cancelled: "#FF453A",
  information: "#64D2FF",
  cached: "#FFD60A",
  unavailable: "#8B949E"
}
```

All colours must use six-digit hexadecimal notation.

### Diagnostics controls

```javascript
cachePrefix: "transperth-journey-widget",
debugShowCounts: false,
debugShowDiagnostics: false,
debugLogging: true,
debugCacheLogging: true
```

Logging is enabled in the supplied build to support initial validation. Disable both log settings after validation if quieter logs are preferred.

## Cancellation handling

Version 4.6 treats cancellations as an operational state rather than ordinary status text.

Cancellation detection is case-insensitive and recognises both spellings:

```text
Cancelled
Canceled
```

Longer phrases containing either spelling are also detected.

### Recommended `alert` policy

```javascript
cancelledServiceDisplay: "alert"
```

A cancelled train is:

- Displayed as a separate red alert.
- Shown with `Cancelled` instead of a countdown.
- Excluded from usable-service row limits.
- Prevented from displacing the next usable train.
- Excluded from determining the first or last useful cache coverage.
- Retained in total and cancelled cache counts for diagnostics.

### `show` policy

```javascript
cancelledServiceDisplay: "show"
```

Cancelled services remain in chronological order within the ordinary service list. The countdown position displays `Cancelled` in red and duplicate status text is suppressed.

A cancelled service consumes a visible row under this policy.

### `hide` policy

```javascript
cancelledServiceDisplay: "hide"
```

Cancelled services are omitted from the widget display. They remain identifiable in cached diagnostic counts and do not extend usable coverage.

### Cancellation alert limits

```javascript
cancelledAlertsShown: {
  small: 1,
  medium: 1,
  large: 1
}
```

These limits apply only to the separate alert policy.

### Cancellation-aware cache coverage

Coverage metadata distinguishes:

```text
departureCount
usableDepartureCount
cancelledDepartureCount
firstUsableDeparture
lastUsableDeparture
firstCancelledDeparture
lastCancelledDeparture
```

The general `firstDeparture` and `lastDeparture` coverage values represent usable, non-cancelled services.

## Delays and departure sorting

### Delay-aware countdowns

When `useExpectedCountdowns` is enabled, the widget uses the live departure clock supplied by Transperth. If that clock is unavailable, the widget falls back to the scheduled station time plus a numeric delay parsed from status text.

The clock-only live value is interpreted near the scheduled date, including services that cross midnight.

### Delay severity bands

| Delay | Default presentation |
|---|---|
| On time | Green |
| 1 to 4 minutes | Amber |
| 5 to 9 minutes | Orange |
| 10 minutes or more | Red |
| Cancelled | Red cancellation state |
| No real-time data | Grey |

Cancellation takes precedence over all delay classifications.

## Widget layouts

### Small

- Two usable services by default.
- Compact two-line service presentation.
- Separate detail controls.
- One cancellation alert by default under the alert policy.

### Medium

- Three usable services by default.
- Compact one-line service rows.
- One separate cancellation alert by default.

### Large

- Six usable services by default.
- Two-line usable service rows.
- First line contains time, countdown, and status.
- Second line contains destination, line, platform, cars, and train series.
- One separate cancellation alert by default.

## Accessibility

Enable maximum contrast with:

```javascript
highContrastMode: true
```

Choose larger typography with:

```javascript
fontProfile: "large"
```

or:

```javascript
fontProfile: "extra-large"
```

Larger profiles reduce lower-priority information density to preserve legibility.

Make the countdown dominant with:

```javascript
layoutProfile: "countdown"
```

Return to the default presentation with:

```javascript
layoutProfile: "standard"
```

## Refresh and rate-limit protection

The script requests a preferred refresh time, but iOS and iPadOS ultimately decide when a Home Screen widget runs.

The canonical anti-429 defaults are:

```javascript
normalRefreshMinutes: 60,
travelRefreshMinutes: 10,
rateLimitBackoffMinutes: 15,
sharedBoardReuseSeconds: 45
```

When Transperth returns HTTP 429:

1. The rejected request is not retried immediately.
2. A shared rate-limit backoff is written locally.
3. Other Transperth widget instances check the same backoff before making requests.
4. Each widget continues using its own isolated journey cache.
5. The next preferred refresh is delayed until backoff expiry when required.

Example footer:

```text
⚠ Rate limited • Cached 22:05
```

If no valid cache exists, the widget reports the rate limit and retry time instead of displaying a generic error.

## Caching and multiple widget instances

### Isolated journey caches

Each journey cache identity includes:

- Scriptable script name.
- Optional `instanceId`.
- Origin station.
- Sorted destination station list.
- API line selector.
- Maximum journey duration.
- Terminal fallback policy.
- Expected-countdown policy.
- Sort mode.
- Cache schema.

This prevents one journey from overwriting another.

### Shared station boards

Raw station-board data may be reused for 45 seconds by another script requiring the same station. Final matched journey caches remain isolated.

### Render-time pruning

Cached departures are re-evaluated whenever the widget renders. Services more than the configured grace period in the past are removed, and later cached services move into the visible positions.

### Cache exhaustion

When no useful future service remains, the widget displays:

```text
No future cached services

The last cached service departed at 21:18.
Live updates will retry after 22:04.
```

Footer:

```text
⚠ Cache exhausted
```

Cancelled trains do not falsely keep the cache useful after every non-cancelled service has departed.

### Cache provenance and migration

The cache records whether it is:

```text
native
legacy-migrated
```

A migrated legacy cache can be structurally valid while having less forward coverage than a native v4.6 cache. One successful v4.6 live update replaces the migrated profile with a native profile and populates the available extended horizon.

## Diagnostics

### Scriptable log

With logging enabled, the script reports:

- Instance fingerprint.
- Isolated cache path.
- Cache acceptance or rejection reason.
- Cache age and provenance.
- Cache coverage and usable/cancelled counts.
- Legacy migration coverage.
- Request station and attempt number.
- Shared station-board reuse.
- Failure classification.
- Cache fallback decision.
- Shared backoff time in UTC and local time.
- Refresh-scheduling decision.

### On-widget diagnostics

Enable:

```javascript
debugShowDiagnostics: true
```

The footer adds the instance fingerprint and cache age.

Enable counts with:

```javascript
debugShowCounts: true
```

Disable both after troubleshooting to preserve space.

## Common errors and troubleshooting

### Quick guide

| Message or symptom | Meaning | First action |
|---|---|---|
| `Rate limited` | HTTP 429 and no valid cache. | Wait until the displayed retry time. |
| `Rate limited • Cached` | HTTP 429 with usable cached services. | No immediate action; allow the backoff to expire. |
| `Cache exhausted` | A valid cache exists but no non-cancelled future service remains. | Wait for the next live update. |
| `Data Xm old` | Usable information remains, but the source is stale. | Check logs, connectivity, and backoff state. |
| `Network error` | A connection or timeout prevented complete correlation. | Restore connectivity and run once in Scriptable. |
| `Configuration error` | A required value or station name is invalid. | Compare values with Transperth Live Train Times. |
| `API response error` | Transperth returned unusable content. | Check the official service and retain logs. |
| `No matching services` | Boards loaded but no usable journey matched. | Verify the journey and destination station. |
| Blank widget | JavaScript or rendering failure. | Run the script directly and inspect the first log error. |

### A cancelled train is missing

Check the configured policy:

```javascript
cancelledServiceDisplay: "hide"
```

Use `alert` or `show` to display cancellations.

### A cancelled train appears separately above usable trains

This is expected under:

```javascript
cancelledServiceDisplay: "alert"
```

The alert does not consume one of the usable-service positions.

### A cancelled train occupies a normal row

This is expected under:

```javascript
cancelledServiceDisplay: "show"
```

Use `alert` to preserve useful departure capacity.

### Rate limited with no cache

A new or changed instance may not yet have completed a successful live update. Wait for the backoff to expire, then allow one successful run to create the isolated cache.

Do not repeatedly run the script during an active backoff.

### Configuration error

Check:

- Exact station names.
- `apiLine: "All"`.
- At least one destination.
- Positive numeric intervals and limits.
- Supported cancellation, sort, stale-status, font, and layout values.
- Six-digit hexadecimal colours.

### Cache rejected

Common log reasons include:

```text
file does not exist
schema mismatch
configuration fingerprint does not match
cache is too old
read or JSON error
```

A rejected cache is not used silently. Allow a successful live run to create the correct cache after resolving any configuration problem.

### Blank widget or JavaScript error

1. Run the script directly in Scriptable.
2. Read the first error and line number.
3. Confirm the entire release file was installed.
4. Confirm the metadata comments remain at the top.
5. Undo manual edits outside `CONFIG`.
6. Replace the complete script with a known-good release rather than combining partial patches.

## Frequently asked questions

### Can the widget handle more than one train line?

Yes. The `All` board includes services across every applicable line, and journey matching selects trains confirmed to serve the destination.

### Must every possible terminal be configured?

No. Through trains are identified using `TripId`. Terminal fallback handles trains ending at an accepted destination.

### Can more than one destination be accepted?

Yes. Add each exact station name to `destinationStations`.

### Can several copies run at once?

Yes. Journey caches are isolated. Use different Scriptable names or explicit `instanceId` values for otherwise identical copies.

### Why does one copy have a cache while another does not?

Each identity starts with its own cache. A new instance requires a successful live update or compatible migration before fallback data exists.

### Why does the widget show stale data?

Stale cached information may still be more useful than no information. The footer clearly reports the age, departed services are removed, and cache exhaustion is shown when no useful service remains.

### Why is a train shown as `Due`?

The expected or scheduled departure has been reached. The service remains briefly during the configured grace period because API and widget refresh timing are not instantaneous.

### Why did train order change?

Expected sorting can reorder services as real-time estimates change. Use `scheduled` for stable timetable order.

### Does the widget know every disruption type?

No. Version 4.6 explicitly recognises cancellations and numeric delays. Other disruption wording is displayed but may not receive specialised interpretation.

### Does the widget refresh exactly every 10 or 60 minutes?

No. The values are preferred earliest refresh times. iOS or iPadOS controls actual scheduling.

### Can logging be disabled?

Yes:

```javascript
debugLogging: false,
debugCacheLogging: false
```

## Upgrading

### Before upgrading

1. Save the current complete script as a rollback copy.
2. Copy the current `CONFIG` block into a private temporary note.
3. Record the script name and any explicit `instanceId`.
4. Read the target release notes and cache migration guidance.

### Recommended process

1. Import the complete new release as a separate Scriptable script.
2. Transfer configuration values into the new release's current `CONFIG` structure.
3. Do not overwrite a new configuration block wholesale if its structure has changed.
4. Run the new script directly in Scriptable.
5. Confirm the intended journey, cache identity, and log paths.
6. Test the required widget sizes.
7. Confirm a live result or documented cache migration.
8. Assign one Home Screen widget to the new script.
9. Upgrade additional journeys one at a time.
10. Keep the previous scripts until every upgraded instance has completed a successful live update.

### Post-upgrade checklist

- [ ] No JavaScript error occurs.
- [ ] The correct journey is shown.
- [ ] Through trains are included.
- [ ] Opposite-direction trains are excluded.
- [ ] Cancellations follow the selected policy.
- [ ] Cancelled trains do not extend useful coverage.
- [ ] Countdown and sorting policies behave correctly.
- [ ] All required layouts are readable.
- [ ] Cache and state paths are isolated correctly.
- [ ] Shared rate-limit behaviour is intact.
- [ ] The Home Screen widget opens the intended Transperth page.

### Rollback

If validation fails, reassign the Home Screen widget to the previous complete script. Preserve the failing log and do not delete the previous cache until rollback is confirmed.

## Known limitations

- The Transperth endpoint used by this project is unofficial and undocumented and may change without notice.
- Journey matching depends on stable `TripId` values between station boards.
- A through service must appear within the destination board's current window.
- Terminal fallback depends on normalised destination naming.
- Numeric delay interpretation depends on status text such as `6 min delay`.
- Cancellation recognition depends on status text containing `Cancelled` or `Canceled`.
- Other disruption types are not yet first-class states.
- Car count, train series, platform, and status depend on data supplied by Transperth.
- Actual cache coverage cannot exceed the future information returned by the API.
- iOS and iPadOS control actual widget refresh timing.

## Credits and acknowledgements

### Project development

- **Michael H**: project concept, requirements, configuration design, user experience direction, API diagnostics, real-world validation, layout evaluation, cache and rate-limit design requirements, cancellation requirements, and production acceptance.
- **Microsoft 365 Copilot**: collaborative architecture, implementation, optimisation, debugging support, test harness development, and documentation.

### Platforms and data

- **Transperth and the Public Transport Authority of Western Australia**: source of the public transport services and live train information consumed by the widget. Transperth and PTA retain ownership of their names, services, data, and trademarks.
- **Scriptable by Simon Støvring**: JavaScript automation and widget runtime used by the project.
- **Apple**: iOS and iPadOS Home Screen widget platform.

### External dependencies

Version 4.6 has no package dependencies and does not incorporate copied code from another widget or third-party library. The implementation was developed collaboratively from direct endpoint diagnostics, observed API behaviour, Scriptable APIs, and iterative real-world testing.

## Change log

### v4.6

- Added first-class cancellation detection.
- Recognised `Cancelled` and `Canceled` case-insensitively.
- Added `alert`, `show`, and `hide` cancellation policies.
- Added separate cancellation-alert limits by widget size.
- Added red cancellation styling.
- Replaced misleading countdowns with `Cancelled`.
- Suppressed duplicate cancellation status text.
- Prevented cancellation alerts from consuming usable-service positions under the default policy.
- Promoted later usable services into normal rows.
- Added usable and cancelled cache counts.
- Added first and last usable and cancelled coverage fields.
- Excluded cancelled trains from useful cache coverage and cache exhaustion decisions.
- Increased canonical cached real-time retention to 180 minutes.
- Preserved the 60-minute normal and 10-minute travel refresh strategy.

### v4.5.1

- Added detailed legacy-cache migration metadata.
- Added cache provenance and creation/migration version fields.
- Added extended-horizon population state.
- Added local and UTC retry timestamps to logs.
- Improved cache-exhausted passenger wording.
- Distinguished native and migrated limited-coverage caches.

### v4.5

- Separated cache horizon from visible row limits.
- Added a 180-minute forward cache horizon and 40-record safety limit.
- Re-evaluated cached departures at every render.
- Removed departed trains and promoted later cached services.
- Added stale real-time handling and scheduled fallback.
- Added `Cache exhausted` state and coverage metadata.
- Added shared global 429 backoff.
- Added shared short-lived station-board data.

### v4.4

- Added isolated cache identities for multiple scripts and journeys.
- Added optional `instanceId`.
- Added precise failure classifications.
- Added HTTP 429 backoff and cached fallback messaging.
- Added cache validation and migration diagnostics.
- Added on-widget instance and cache-age diagnostics.

### v4.3

- Added delay-aware countdowns.
- Added scheduled and expected sorting.
- Added green, amber, orange, and red delay bands.
- Added high-contrast mode.
- Added normal, large, and extra-large font profiles.
- Added countdown-focused layout.
- Strengthened cached, stale, and unavailable indicators.

### v4.2

- Replaced terminal-only filtering with journey-aware matching.
- Added combined `All` station boards.
- Added concurrent origin and destination requests.
- Added exact `TripId` correlation.
- Added terminal fallback and multiple destinations.
- Removed platform assumptions from direction filtering.
- Preserved complete-cache fallback when any required board failed.

### v4.1

- Added a dedicated two-line large-widget service layout.
- Preserved the accepted small and medium layouts.

### v4.0

- Introduced the optimised caching, validation, retry, refresh-scheduling, view-model, and rendering architecture.
- Parsed dates once per execution.
- Cached style objects.
- Stored compact API records.
- Added bounded retries and configuration validation.
- Avoided unnecessary cache writes.
- Preserved the dedicated readable small layout.

### v3.3.1

- Added the dedicated small-widget renderer.
- Preserved time and countdown prominence.
- Moved compact train details to a second line.
- Established the readable small-widget baseline.

### v3.3

- Consolidated configuration.
- Added dynamic live and tap-through URLs.
- Added destination filtering, countdowns, status, train details, caching, and commute refresh periods.
- Identified the need for a dedicated small-widget layout.

### Initial development

- Established the Scriptable Transperth train-widget concept.
- Added live station-board retrieval.
- Added configurable station and line values.
- Added basic departure, destination, platform, train, status, cache, theme, and refresh presentation.

## Credits

### aiotransperth

Special acknowledgement goes to **Chris112**, author of [`aiotransperth`](https://github.com/Chris112/aiotransperth), whose work on that client helped immensely with devising the JS code for this widget.

`aiotransperth` is an independent, MIT-licensed asynchronous Python client for Transperth bus and train departure information. The project documents and implements access to the unofficial internal endpoints used by the Transperth website, including train destination, platform, delay status, car count, scheduled time, and real-time estimates.

The project and its associated Transperth API research provided a useful external reference during the investigation and validation of:

- The unofficial Transperth train live-status endpoint
- Required request headers
- Valid train line and station naming
- The train departure response structure
- Scheduled and estimated departure concepts
- Real-time delay and status information
- Rate-limiting considerations

The Transperth Journey-Aware Train Widget is a separate JavaScript implementation written for Scriptable. It does not import, bundle, or depend on the `aiotransperth` Python package, and no `aiotransperth` source code is included in this repository.

- Project: [`Chris112/aiotransperth`](https://github.com/Chris112/aiotransperth)
- Author: [`Chris112`](https://github.com/cence: MIT
- Language and runtime: Python 3.12+ with `aiohttp`

## Disclaimer

Use this project at your own risk. Live transport information may be delayed, incomplete, unavailable, or changed at short notice. Always follow official station signage, announcements, staff directions, and current Transperth information when making travel decisions.
