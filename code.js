// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;
// ============================================================
// Transperth Train Widget v4.6
// Cancellation-aware, cache-horizon and accessible multi-line edition
// ============================================================
//
// Uses Transperth's combined "All" station boards and identifies
// services that actually make the configured journey by:
//   1. Matching TripId at a destination station at a later time; or
//   2. Matching a train terminating at the destination station.
//
// Preserves the journey-correlation engine and responsive layouts.
// Adds delay-aware countdowns, accessibility profiles, isolated journey
// caches, shared rate-limit backoff, shared short-lived station boards,
// render-time expiry pruning, cache coverage, cache provenance metadata,
// richer migration diagnostics, clearer cache-exhausted states, and
// first-class cancellation detection, alerts, styling and cache coverage.
//
// Scriptable can request a refresh time, but iOS ultimately decides
// when a Home Screen widget is refreshed.
// ============================================================

const CONFIG = {
  journey: {
    originStation: "Mt Lawley Stn",
    originAlias: "Mt Lawley",
    destinationStations: ["Perth Stn"],
    destinationLabel: "Perth",
    apiLine: "All",
    maximumJourneyHours: 4,
    allowTerminalDestinationFallback: true
  },

  departuresShown: {
    small: 2,
    medium: 3,
    large: 6
  },
  // Display limits and cache depth are deliberately independent.
  cacheDepartureBuffer: 2,
  cacheHorizonMinutes: 180,
  maximumCachedDepartures: 40,
  cachedDepartureGraceMinutes: 2,
  maximumCachedRealtimeAgeMinutes: 180,
  staleStatusDisplay: "suppress", // "show", "suppress", or "replace"
  staleStatusReplacement: "Cached schedule",

  // Supported values: "alert", "show", or "hide".
  // alert shows cancellations separately without consuming usable-service rows.
  cancelledServiceDisplay: "alert",
  cancelledAlertsShown: {
    small: 1,
    medium: 1,
    large: 1
  },
  cancelledLabel: "Cancelled",

  normalRefreshMinutes: 60,
  travelRefreshMinutes: 10,
  useTravelWindows: true,
  travelWindows: [
    { start: "06:00", end: "08:30" },
    { start: "16:00", end: "18:30" }
  ],
  refreshAtTravelWindowStart: true,

  reuseFreshCacheWithoutRequest: false,
  freshCacheReuseMinutes: 1,
  staleMinutes: 10,
  maximumCacheAgeMinutes: 180,
  cacheSchemaVersion: 7,

  requestTimeoutSeconds: 15,
  retryTransientFailures: true,
  maximumRequestAttempts: 2,
  retryDelayMilliseconds: 400,
  rateLimitBackoffMinutes: 15,
  sharedBoardReuseSeconds: 45,
  instanceId: "",

  showBoardScope: true,
  showDestination: true,
  destinationStyle: "full", // "short" or "full"
  showServiceLine: true,
  serviceLineStyle: "short", // "short" or "full"
  showPlatform: true,
  showCars: true,
  showTrainSeries: true,
  showStatus: true,
  showUpdatedTime: true,
  useExpectedCountdowns: true,
  sortMode: "scheduled", // "scheduled" or "expected"

  accessibility: {
    highContrastMode: false,
    fontProfile: "normal", // "normal", "large", or "extra-large"
    layoutProfile: "standard" // "standard" or "countdown"
  },

  smallWidget: {
    showDestination: false,
    showServiceLine: true,
    showPlatform: false,
    showCars: true,
    showTrainSeries: true,
    showStatus: false
  },

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
  },

  cachePrefix: "transperth-journey-widget",
  debugShowCounts: false,
  debugShowDiagnostics: false,
  debugLogging: true,
  debugCacheLogging: true
};

const RUN_STARTED_AT = new Date();
const RUN_STARTED_MS = RUN_STARTED_AT.getTime();
const BASE_URL = "https://www.transperth.wa.gov.au";
const WIDGET_VERSION = "4.6";
const fm = FileManager.local();

function debug(message, value) {
  if (!CONFIG.debugLogging) return;
  console.log(value === undefined ? message : `${message}: ${JSON.stringify(value)}`);
}

function sleep(milliseconds) {
  return new Promise(resolve => Timer.schedule(milliseconds, false, resolve));
}

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normaliseStationName(value) {
  return text(value).toLowerCase().replace(/\s+stn$/i, "").replace(/\s+/g, " ").trim();
}

function safeFilePart(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function originDisplayName() {
  return text(CONFIG.journey.originAlias) || text(CONFIG.journey.originStation).replace(/\s+Stn$/i, "");
}

function getBoardUrl(station) {
  return `${BASE_URL}/API/TrainLiveTimes/LiveStatus/GetStationLiveStatusAsync/` +
    `${encodeURIComponent(CONFIG.journey.apiLine)}/${encodeURIComponent(station)}/false`;
}

function getLiveUrl() {
  return `${BASE_URL}/Timetables/Live-Train-Times?line=` +
    `${encodeURIComponent(CONFIG.journey.apiLine)}&station=` +
    `${encodeURIComponent(CONFIG.journey.originStation)}`;
}

function requireNonEmptyString(value, description) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${description} must be a non-empty string.`);
  }
}

function requirePositiveNumber(value, description) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${description} must be a positive number.`);
  }
}

function validateColour(value, description) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${description} must be a six-digit hexadecimal colour.`);
  }
}

function clockToMinutes(value) {
  const match = text(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function validateConfiguration() {
  requireNonEmptyString(CONFIG.journey.originStation, "Origin station");
  requireNonEmptyString(CONFIG.journey.destinationLabel, "Destination label");
  requireNonEmptyString(CONFIG.journey.apiLine, "API line selector");
  requirePositiveNumber(CONFIG.journey.maximumJourneyHours, "Maximum journey hours");
  if (!Array.isArray(CONFIG.journey.destinationStations) ||
      CONFIG.journey.destinationStations.length === 0) {
    throw new Error("At least one destination station is required.");
  }
  CONFIG.journey.destinationStations.forEach((station, index) =>
    requireNonEmptyString(station, `Destination station ${index + 1}`));

  ["small", "medium", "large"].forEach(family =>
    requirePositiveNumber(CONFIG.departuresShown[family], `${family} departure limit`));
  requirePositiveNumber(CONFIG.normalRefreshMinutes, "Normal refresh interval");
  requirePositiveNumber(CONFIG.travelRefreshMinutes, "Travel refresh interval");
  requirePositiveNumber(CONFIG.staleMinutes, "Stale threshold");
  requirePositiveNumber(CONFIG.maximumCacheAgeMinutes, "Maximum cache age");
  requirePositiveNumber(CONFIG.requestTimeoutSeconds, "Request timeout");
  requirePositiveNumber(CONFIG.maximumRequestAttempts, "Maximum request attempts");
  requirePositiveNumber(CONFIG.cacheHorizonMinutes, "Cache horizon");
  requirePositiveNumber(CONFIG.maximumCachedDepartures, "Maximum cached departures");
  requirePositiveNumber(CONFIG.cachedDepartureGraceMinutes, "Cached departure grace");
  requirePositiveNumber(CONFIG.maximumCachedRealtimeAgeMinutes, "Maximum cached real-time age");
  requirePositiveNumber(CONFIG.rateLimitBackoffMinutes, "Rate-limit backoff");
  requirePositiveNumber(CONFIG.sharedBoardReuseSeconds, "Shared board reuse interval");
  if (typeof CONFIG.instanceId !== "string") throw new Error("instanceId must be a string.");

  if (!["short", "full"].includes(CONFIG.destinationStyle)) {
    throw new Error('destinationStyle must be "short" or "full".');
  }
  if (!["short", "full"].includes(CONFIG.serviceLineStyle)) {
    throw new Error('serviceLineStyle must be "short" or "full".');
  }
  if (!["scheduled", "expected"].includes(CONFIG.sortMode)) {
    throw new Error('sortMode must be "scheduled" or "expected".');
  }
  if (!["show", "suppress", "replace"].includes(CONFIG.staleStatusDisplay)) {
    throw new Error('staleStatusDisplay must be "show", "suppress", or "replace".');
  }
  if (!["alert", "show", "hide"].includes(CONFIG.cancelledServiceDisplay)) {
    throw new Error('cancelledServiceDisplay must be "alert", "show", or "hide".');
  }
  requireNonEmptyString(CONFIG.cancelledLabel, "Cancelled label");
  ["small", "medium", "large"].forEach(family =>
    requirePositiveNumber(CONFIG.cancelledAlertsShown[family], `${family} cancellation alert limit`));
  if (!CONFIG.accessibility || !["normal", "large", "extra-large"].includes(CONFIG.accessibility.fontProfile)) {
    throw new Error('accessibility.fontProfile is invalid.');
  }
  if (!["standard", "countdown"].includes(CONFIG.accessibility.layoutProfile)) {
    throw new Error('accessibility.layoutProfile is invalid.');
  }
  if (CONFIG.useTravelWindows) {
    if (!Array.isArray(CONFIG.travelWindows)) throw new Error("travelWindows must be an array.");
    CONFIG.travelWindows.forEach((window, index) => {
      if (!window || clockToMinutes(window.start) === null || clockToMinutes(window.end) === null) {
        throw new Error(`Travel window ${index + 1} must use valid HH:MM times.`);
      }
    });
  }

  const colours = CONFIG.colours;
  [
    [colours.dark.background, "Dark background"],
    [colours.dark.primary, "Dark primary"],
    [colours.dark.secondary, "Dark secondary"],
    [colours.light.background, "Light background"],
    [colours.light.primary, "Light primary"],
    [colours.light.secondary, "Light secondary"],
    [colours.live, "Live"], [colours.delayed, "Delayed"],
    [colours.moderate, "Moderate delay"], [colours.severe, "Severe"],
    [colours.cancelled, "Cancelled"], [colours.information, "Information"],
    [colours.cached, "Cached"], [colours.unavailable, "Unavailable"]
  ].forEach(item => validateColour(item[0], item[1]));
}

function stableHash(value) {
  let hash = 2166136261;
  const input = text(value);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function scriptIdentity() {
  try { return text(Script.name()) || "transperth-widget"; }
  catch (_) { return "transperth-widget"; }
}

function cacheIdentityData() {
  return {
    script: scriptIdentity(),
    instanceId: text(CONFIG.instanceId),
    origin: normaliseStationName(CONFIG.journey.originStation),
    destinations: CONFIG.journey.destinationStations.map(normaliseStationName).sort(),
    apiLine: text(CONFIG.journey.apiLine).toLowerCase(),
    maximumJourneyHours: Number(CONFIG.journey.maximumJourneyHours),
    terminalFallback: Boolean(CONFIG.journey.allowTerminalDestinationFallback),
    useExpectedCountdowns: Boolean(CONFIG.useExpectedCountdowns),
    sortMode: text(CONFIG.sortMode),
    schemaVersion: Number(CONFIG.cacheSchemaVersion)
  };
}

const JOURNEY_ID = [CONFIG.journey.originStation, ...CONFIG.journey.destinationStations.slice().sort()]
  .map(safeFilePart).join("-to-");
const INSTANCE_HASH = stableHash(JSON.stringify(cacheIdentityData()));
const INSTANCE_LABEL = text(CONFIG.instanceId) || safeFilePart(scriptIdentity());
const CACHE_FILE = `${CONFIG.cachePrefix}-${INSTANCE_LABEL}-${JOURNEY_ID}-${INSTANCE_HASH}.json`;
const CACHE_PATH = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
const LEGACY_CACHE_PATH = fm.joinPath(fm.documentsDirectory(), `${CONFIG.cachePrefix}-${JOURNEY_ID}.json`);
const GLOBAL_RATE_LIMIT_PATH = fm.joinPath(fm.documentsDirectory(), `${CONFIG.cachePrefix}-global-rate-limit.json`);
const SHARED_BOARD_PREFIX = `${CONFIG.cachePrefix}-station-board`;

function cacheDebug(message, value) {
  if (!CONFIG.debugCacheLogging && !CONFIG.debugLogging) return;
  console.log(value === undefined
    ? `[Cache ${INSTANCE_HASH}] ${message}`
    : `[Cache ${INSTANCE_HASH}] ${message}: ${JSON.stringify(value)}`);
}

function sharedBoardPath(station) {
  const key = `${safeFilePart(station)}-${stableHash(normaliseStationName(station))}`;
  return fm.joinPath(fm.documentsDirectory(), `${SHARED_BOARD_PREFIX}-${key}.json`);
}

function fontScaleFactor() {
  if (CONFIG.accessibility.fontProfile === "extra-large") return 1.3;
  if (CONFIG.accessibility.fontProfile === "large") return 1.15;
  return 1;
}

function scaledFontSize(size) {
  return Math.max(8, Math.round(size * fontScaleFactor()));
}

function buildStyles() {
  const highContrast = Boolean(CONFIG.accessibility.highContrastMode);
  const base = CONFIG.darkMode ? CONFIG.colours.dark : CONFIG.colours.light;
  const theme = highContrast
    ? (CONFIG.darkMode
      ? { background: "#000000", primary: "#FFFFFF", secondary: "#FFFFFF" }
      : { background: "#FFFFFF", primary: "#000000", secondary: "#000000" })
    : base;
  return {
    colours: {
      background: new Color(theme.background), primary: new Color(theme.primary),
      secondary: new Color(theme.secondary),
      live: new Color(highContrast ? "#00E676" : CONFIG.colours.live),
      delayed: new Color(highContrast ? "#FFD600" : CONFIG.colours.delayed),
      moderate: new Color(highContrast ? "#FF8500" : CONFIG.colours.moderate),
      severe: new Color(highContrast ? "#FF3B30" : CONFIG.colours.severe),
      cancelled: new Color(highContrast ? "#FF3B30" : CONFIG.colours.cancelled),
      information: new Color(highContrast ? theme.primary : CONFIG.colours.information),
      cached: new Color(highContrast ? "#FFD600" : CONFIG.colours.cached),
      unavailable: new Color(highContrast ? theme.secondary : CONFIG.colours.unavailable)
    },
    fonts: {
      smallTitle: Font.boldSystemFont(scaledFontSize(14)), regularTitle: Font.boldSystemFont(scaledFontSize(16)),
      smallSubtitle: Font.systemFont(scaledFontSize(10)), regularSubtitle: Font.systemFont(scaledFontSize(11)),
      smallTime: Font.mediumMonospacedSystemFont(scaledFontSize(17)), smallCountdown: Font.boldSystemFont(scaledFontSize(17)),
      smallCountdownFocus: Font.boldSystemFont(scaledFontSize(22)), smallDetails: Font.systemFont(scaledFontSize(10)),
      mediumTime: Font.mediumMonospacedSystemFont(scaledFontSize(15)), mediumCountdown: Font.boldSystemFont(scaledFontSize(14)),
      mediumCountdownFocus: Font.boldSystemFont(scaledFontSize(20)), mediumInformation: Font.systemFont(scaledFontSize(10)),
      mediumStatus: Font.mediumSystemFont(scaledFontSize(10)), largeTime: Font.mediumMonospacedSystemFont(scaledFontSize(16)),
      largeCountdown: Font.boldSystemFont(scaledFontSize(15)), largeCountdownFocus: Font.boldSystemFont(scaledFontSize(22)),
      largeInformation: Font.systemFont(scaledFontSize(11)), largeStatus: Font.mediumSystemFont(scaledFontSize(11)),
      emptyHeading: Font.semiboldSystemFont(scaledFontSize(13)), emptyDetails: Font.systemFont(scaledFontSize(10)),
      smallFooter: Font.systemFont(scaledFontSize(9)), regularFooter: Font.systemFont(scaledFontSize(10))
    }
  };
}

const STYLES = buildStyles();

function parseApiDate(value) {
  const match = text(value).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]),
    Number(match[4]), Number(match[5]), Number(match[6]), 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLastUpdated(value) {
  return parseApiDate(text(value).replace(/\s+at\s+/i, " "));
}

function parseIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesBetweenMs(later, earlier) {
  return Math.floor((later - earlier) / 60000);
}

function minutesUntilTimestamp(timestamp) {
  return Number.isFinite(timestamp) ? Math.ceil((timestamp - RUN_STARTED_MS) / 60000) : null;
}

function formatCountdown(minutes) {
  if (minutes === null || !Number.isFinite(minutes)) return "--";
  if (minutes <= 0) return "Due";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function shortTime(date) {
  if (!(date instanceof Date)) return "--:--";
  const formatter = new DateFormatter();
  formatter.locale = "en_AU";
  formatter.dateFormat = "HH:mm";
  return formatter.string(date);
}

function localDateTime(date) {
  if (!(date instanceof Date)) return "--";
  const formatter = new DateFormatter();
  formatter.locale = "en_AU";
  formatter.dateFormat = "dd/MM/yyyy HH:mm:ss";
  return formatter.string(date);
}

function timeWithinWindow(current, start, end) {
  if (start === null || end === null) return false;
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

function millisecondsUntilNextClockTime(targetMinutes) {
  const target = new Date(RUN_STARTED_MS);
  target.setHours(Math.floor(targetMinutes / 60), targetMinutes % 60, 0, 0);
  if (target.getTime() <= RUN_STARTED_MS) target.setDate(target.getDate() + 1);
  return target.getTime() - RUN_STARTED_MS;
}

function determineRefreshSchedule() {
  const normal = Math.max(1, Number(CONFIG.normalRefreshMinutes) || 10);
  const travel = Math.max(1, Number(CONFIG.travelRefreshMinutes) || 2);
  const current = RUN_STARTED_AT.getHours() * 60 + RUN_STARTED_AT.getMinutes();
  let inTravelWindow = false;
  if (CONFIG.useTravelWindows && Array.isArray(CONFIG.travelWindows)) {
    inTravelWindow = CONFIG.travelWindows.some(window =>
      timeWithinWindow(current, clockToMinutes(window.start), clockToMinutes(window.end)));
  }
  let milliseconds = (inTravelWindow ? travel : normal) * 60000;
  let reason = inTravelWindow ? "travel interval" : "normal interval";
  if (!inTravelWindow && CONFIG.useTravelWindows && CONFIG.refreshAtTravelWindowStart) {
    for (const window of CONFIG.travelWindows) {
      const start = clockToMinutes(window.start);
      if (start === null) continue;
      const until = millisecondsUntilNextClockTime(start);
      if (until > 0 && until < milliseconds) {
        milliseconds = until;
        reason = `next travel window at ${window.start}`;
      }
    }
  }
  return {
    refreshDate: new Date(RUN_STARTED_MS + Math.max(60000, milliseconds)),
    intervalMinutes: Math.max(1, Math.ceil(milliseconds / 60000)),
    inTravelWindow,
    reason
  };
}

function buildConfigurationSignature() {
  return JSON.stringify({
    origin: CONFIG.journey.originStation,
    destinations: CONFIG.journey.destinationStations.slice().sort(),
    apiLine: CONFIG.journey.apiLine,
    maximumJourneyHours: CONFIG.journey.maximumJourneyHours,
    terminalFallback: CONFIG.journey.allowTerminalDestinationFallback,
    useExpectedCountdowns: CONFIG.useExpectedCountdowns,
    sortMode: CONFIG.sortMode,
    instanceHash: INSTANCE_HASH
  });
}

function buildCacheSignature(payload) {
  const departures = payload.departures.map(item => [item.tripId, item.departure, item.tripStopSchedule,
    item.destination, item.serviceLine, item.platform, item.cars, item.series, item.status,
    item.statusDetail, item.isRealTime, item.matchMethod, item.matchedDestinationStation,
    item.destinationCallSchedule].join("|")).join("~");
  return [payload.schemaVersion, payload.configurationSignature, payload.updated,
    payload.originCount, payload.matchedCount, departures].join("::");
}

function cacheValidation(payload, allowLegacy) {
  if (!payload || typeof payload !== "object") return { valid: false, reason: "cache payload is not an object" };
  const acceptedLegacySchemas = [5, 6];
  if (allowLegacy ? !acceptedLegacySchemas.includes(Number(payload.schemaVersion))
      : Number(payload.schemaVersion) !== Number(CONFIG.cacheSchemaVersion)) {
    return { valid: false, reason: `schema ${payload.schemaVersion}; expected ${CONFIG.cacheSchemaVersion}` };
  }
  if (!Array.isArray(payload.departures)) return { valid: false, reason: "departures array is missing" };
  if (!allowLegacy && payload.configurationSignature !== buildConfigurationSignature()) {
    return { valid: false, reason: "configuration fingerprint does not match" };
  }
  if (allowLegacy) {
    try {
      const legacy = JSON.parse(payload.configurationSignature || "{}");
      if (legacy.origin !== CONFIG.journey.originStation ||
          JSON.stringify(legacy.destinations || []) !== JSON.stringify(CONFIG.journey.destinationStations.slice().sort()) ||
          legacy.apiLine !== CONFIG.journey.apiLine) return { valid: false, reason: "legacy journey does not match" };
    } catch (_) { return { valid: false, reason: "legacy signature is invalid" }; }
  }
  const cachedAt = parseIsoDate(payload.cachedAt);
  if (!cachedAt) return { valid: false, reason: "cachedAt cannot be parsed" };
  const ageMinutes = Math.max(0, minutesBetweenMs(RUN_STARTED_MS, cachedAt.getTime()));
  if (ageMinutes > CONFIG.maximumCacheAgeMinutes) return { valid: false, reason: `cache is ${ageMinutes}m old`, ageMinutes };
  return { valid: true, reason: "valid", ageMinutes };
}

function readCacheFile(path, allowLegacy) {
  if (!fm.fileExists(path)) return { cache: null, reason: "file does not exist", path };
  try {
    const payload = JSON.parse(fm.readString(path));
    const validation = cacheValidation(payload, allowLegacy);
    return validation.valid
      ? { cache: payload, reason: allowLegacy ? "valid legacy cache" : "valid isolated cache", path, ageMinutes: validation.ageMinutes }
      : { cache: null, reason: validation.reason, path, ageMinutes: validation.ageMinutes };
  } catch (error) { return { cache: null, reason: `read or JSON error: ${error}`, path }; }
}

function nativeCacheProfile(coverage) {
  return {
    cacheOrigin: "native",
    createdByVersion: WIDGET_VERSION,
    migratedByVersion: "",
    originalSchemaVersion: CONFIG.cacheSchemaVersion,
    horizonMinutes: CONFIG.cacheHorizonMinutes,
    maximumDepartures: CONFIG.maximumCachedDepartures,
    extendedHorizonPopulated: true,
    coverage: coverage || null
  };
}

function legacyCacheProfile(payload, coverage) {
  const existing = payload && payload.cacheProfile ? payload.cacheProfile : {};
  return {
    cacheOrigin: "legacy-migrated",
    createdByVersion: text(existing.createdByVersion) || `schema-${payload.schemaVersion}`,
    migratedByVersion: WIDGET_VERSION,
    originalSchemaVersion: Number(payload.schemaVersion),
    horizonMinutes: Number(existing.horizonMinutes || 0) || null,
    maximumDepartures: Number(existing.maximumDepartures || 0) || null,
    extendedHorizonPopulated: false,
    coverage: coverage || null
  };
}

function cacheOrigin(payload) {
  return text(payload && payload.cacheProfile && payload.cacheProfile.cacheOrigin) || "unknown";
}

function migrateLegacyCache(result) {
  const source = result.cache;
  const coverage = buildCoverage(source.departures);
  const profile = legacyCacheProfile(source, coverage);
  const migrated = {
    ...source,
    schemaVersion: CONFIG.cacheSchemaVersion,
    configurationSignature: buildConfigurationSignature(),
    instanceHash: INSTANCE_HASH,
    scriptIdentity: scriptIdentity(),
    migratedFromSchema: Number(source.schemaVersion),
    migratedAt: new Date().toISOString(),
    coverage,
    cacheProfile: profile
  };
  migrated.signature = buildCacheSignature(migrated);

  const first = parseIsoDate(coverage.firstDeparture);
  const last = parseIsoDate(coverage.lastDeparture);
  const diagnostics = {
    from: result.path,
    to: CACHE_PATH,
    fromSchema: Number(source.schemaVersion),
    departureCount: coverage.departureCount,
    firstDepartureUtc: coverage.firstDeparture,
    firstDepartureLocal: first ? localDateTime(first) : null,
    lastDepartureUtc: coverage.lastDeparture,
    lastDepartureLocal: last ? localDateTime(last) : null,
    cacheAgeMinutes: result.ageMinutes,
    cacheOrigin: profile.cacheOrigin,
    createdByVersion: profile.createdByVersion,
    migratedByVersion: profile.migratedByVersion,
    extendedHorizonPopulated: false
  };

  try {
    fm.writeString(CACHE_PATH, JSON.stringify(migrated));
    cacheDebug("Legacy cache migrated with limited coverage", diagnostics);
    cacheDebug(
      "A successful v4.5.1 live refresh is required to populate the extended cache horizon"
    );
  } catch (error) {
    cacheDebug("Legacy migration failed", { error: String(error), ...diagnostics });
  }
  return migrated;
}

function loadCacheDetailed() {
  const isolated = readCacheFile(CACHE_PATH, false);
  if (isolated.cache) {
    cacheDebug("Cache accepted", {
      path: isolated.path,
      ageMinutes: isolated.ageMinutes,
      entries: isolated.cache.departures.length,
      coverage: isolated.cache.coverage,
      cacheOrigin: cacheOrigin(isolated.cache),
      cacheProfile: isolated.cache.cacheProfile || null
    });
    return isolated;
  }
  cacheDebug("Isolated cache unavailable", isolated);
  const legacy = readCacheFile(LEGACY_CACHE_PATH, true);
  if (legacy.cache) return { cache: migrateLegacyCache(legacy), reason: "legacy cache migrated",
    path: CACHE_PATH, ageMinutes: legacy.ageMinutes, migrated: true };
  cacheDebug("Legacy cache unavailable", legacy);
  return { cache: null, reason: `isolated: ${isolated.reason}; legacy: ${legacy.reason}`, path: CACHE_PATH };
}

function loadCache() { return loadCacheDetailed().cache; }

function saveCacheIfChanged(payload) {
  try {
    payload.signature = buildCacheSignature(payload);
    const existing = readCacheFile(CACHE_PATH, false);
    if (existing.cache && existing.cache.signature === payload.signature) return false;
    fm.writeString(CACHE_PATH, JSON.stringify(payload));
    cacheDebug("Cache written", {
      path: CACHE_PATH,
      entries: payload.departures.length,
      usableEntries: payload.coverage ? payload.coverage.usableDepartureCount : null,
      cancelledEntries: payload.coverage ? payload.coverage.cancelledDepartureCount : null,
      coverage: payload.coverage
    });
    return true;
  } catch (error) { console.log(`Could not save cache: ${error}`); return false; }
}

function readJsonFile(path) {
  try { return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null; }
  catch (_) { return null; }
}
function writeJsonFile(path, value) { try { fm.writeString(path, JSON.stringify(value)); return true; } catch (_) { return false; } }

function activeGlobalBackoff() {
  const state = readJsonFile(GLOBAL_RATE_LIMIT_PATH);
  const until = state ? parseIsoDate(state.rateLimitUntil) : null;
  if (!until || until.getTime() <= RUN_STARTED_MS) return null;
  return {
    until,
    untilUtc: until.toISOString(),
    untilLocal: localDateTime(until),
    minutesRemaining: Math.max(1, Math.ceil((until - RUN_STARTED_MS) / 60000)),
    station: text(state.station),
    sourceInstance: text(state.instanceHash)
  };
}

function recordGlobalBackoff(station) {
  const until = new Date(RUN_STARTED_MS + CONFIG.rateLimitBackoffMinutes * 60000);
  const state = {
    rateLimitUntil: until.toISOString(),
    station,
    instanceHash: INSTANCE_HASH,
    script: scriptIdentity(),
    recordedAt: new Date().toISOString()
  };
  writeJsonFile(GLOBAL_RATE_LIMIT_PATH, state);
  cacheDebug("Shared rate-limit backoff recorded", {
    station,
    retryAfterUtc: until.toISOString(),
    retryAfterLocal: localDateTime(until),
    backoffMinutes: CONFIG.rateLimitBackoffMinutes,
    statePath: GLOBAL_RATE_LIMIT_PATH
  });
  return until;
}

function clearExpiredGlobalBackoff() {
  const state = readJsonFile(GLOBAL_RATE_LIMIT_PATH);
  const until = state ? parseIsoDate(state.rateLimitUntil) : null;
  if (until && until.getTime() <= RUN_STARTED_MS) {
    try { fm.remove(GLOBAL_RATE_LIMIT_PATH); } catch (_) {}
  }
}

function cacheAgeMinutes(payload) {
  const cachedAt = payload ? parseIsoDate(payload.cachedAt) : null;
  return cachedAt ? Math.max(0, minutesBetweenMs(RUN_STARTED_MS, cachedAt.getTime())) : null;
}

function canReuseFreshCache(payload) {
  const age = cacheAgeMinutes(payload);
  return Boolean(CONFIG.reuseFreshCacheWithoutRequest && payload && age !== null &&
    age <= Math.max(0, Number(CONFIG.freshCacheReuseMinutes) || 0));
}

function destinationDisplayText(value) {
  const destination = text(value);
  if (CONFIG.destinationStyle === "full") return destination;
  const lower = destination.toLowerCase();
  if (lower.includes("perth underground")) return "PUG";
  if (lower.includes("elizabeth quay")) return "EQY";
  if (lower.includes("airport central")) return "APT";
  if (lower === "perth") return "PER";
  return destination.replace(/\s+Stn$/i, "").split(/\s+/)
    .map(part => part.charAt(0).toUpperCase()).join("").slice(0, 4);
}

function serviceLineDisplayText(value) {
  const line = text(value);
  return CONFIG.serviceLineStyle === "full" ? line : line.replace(/\s+Line$/i, "");
}

function delayMinutesFromText(value) {
  const match = text(value).match(/(\d+)\s*min(?:ute)?s?\s+delay/i);
  return match ? Number(match[1]) : 0;
}

function clockDateNear(clockValue, anchorDate) {
  const match = text(clockValue).match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !(anchorDate instanceof Date)) return null;
  const candidate = new Date(anchorDate.getTime());
  candidate.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (candidate.getTime() < anchorDate.getTime() - 12 * 3600000) candidate.setDate(candidate.getDate() + 1);
  else if (candidate.getTime() > anchorDate.getTime() + 12 * 3600000) candidate.setDate(candidate.getDate() - 1);
  return candidate;
}

function expectedDepartureDate(departure) {
  const scheduled = parseApiDate(departure.tripStopSchedule);
  if (!scheduled) return null;
  if (departure.isRealTime) {
    const live = clockDateNear(departure.departure, scheduled);
    if (live) return live;
  }
  return new Date(scheduled.getTime() + delayMinutesFromText(departure.statusDetail) * 60000);
}

function departureSortTimestamp(departure, useExpected) {
  const scheduled = parseApiDate(departure.tripStopSchedule);
  if (!scheduled) return Number.MAX_SAFE_INTEGER;
  if (useExpected) {
    const expected = expectedDepartureDate(departure);
    if (expected) return expected.getTime();
  }
  return scheduled.getTime();
}

function isCancelledService(departure) {
  const detail = text(departure && departure.statusDetail);
  return /\bcancel(?:led|ed)\b/i.test(detail);
}

function resolvedStatusText(departure) {
  if (isCancelledService(departure)) return CONFIG.cancelledLabel;
  if (departure.statusDetail) return departure.statusDetail;
  if (departure.isRealTime === false) return "Scheduled";
  if (Number(departure.status) === 1) return "On Time";
  if (Number(departure.status) === 2) return "Delayed";
  return "Live";
}

function resolvedStatusKey(departure) {
  if (isCancelledService(departure)) return "cancelled";
  const delay = delayMinutesFromText(departure.statusDetail);
  if (delay >= 10) return "severe";
  if (delay >= 5) return "moderate";
  if (delay >= 1 || Number(departure.status) === 2) return "delayed";
  if (departure.isRealTime === false) return "unavailable";
  return "live";
}

function colourForStatusKey(key) {
  return STYLES.colours[key] || STYLES.colours.unavailable;
}

function compactApiDeparture(entry, boardStation) {
  return {
    boardStation: text(boardStation),
    tripId: Number(entry.TripId || 0),
    departure: text(entry.Departure),
    tripStopSchedule: text(entry.TripStopSchedule),
    destination: text(entry.Destination),
    serviceLine: text(entry.LineName),
    platform: text(entry.Platform),
    cars: text(entry.Ncar),
    series: text(entry.Series),
    status: entry.Status === null || entry.Status === undefined ? null : Number(entry.Status),
    statusDetail: text(entry.StatusDetail),
    isRealTime: Boolean(entry.IsRealTime)
  };
}

function retryableHttpStatus(status) {
  return [408, 425, 500, 502, 503, 504].includes(status);
}

function classifyFailure(error) {
  if (error && error.kind) return error.kind;
  const message = text(error && (error.message || error)).toLowerCase();
  if (message.includes("rate limit")) return "rate-limited";
  if (message.includes("not recognised") || message.includes("configuration")) return "configuration";
  if (message.includes("network") || message.includes("internet") || message.includes("timed out")) return "network";
  if (message.includes("json") || message.includes("response structure")) return "api-response";
  return "request";
}
function failureLabel(kind) {
  return ({ "rate-limited": "Rate limited", network: "Network error", configuration: "Configuration error",
    "api-response": "API response error", "cache-exhausted": "Cache exhausted" })[kind] || "Live data error";
}

function loadSharedBoard(station) {
  const path = sharedBoardPath(station);
  const payload = readJsonFile(path);
  const fetchedAt = payload ? parseIsoDate(payload.fetchedAt) : null;
  if (!payload || !fetchedAt || !Array.isArray(payload.departures)) return null;
  const ageSeconds = Math.max(0, Math.floor((RUN_STARTED_MS - fetchedAt.getTime()) / 1000));
  if (ageSeconds > CONFIG.sharedBoardReuseSeconds) return null;
  cacheDebug("Shared station board reused", { station, ageSeconds, path });
  return payload;
}

function saveSharedBoard(result) {
  const payload = { ...result, fetchedAt: new Date().toISOString(), schemaVersion: 1 };
  writeJsonFile(sharedBoardPath(result.requestedStation), payload);
}

async function performBoardRequest(station) {
  const shared = loadSharedBoard(station);
  if (shared) return shared;
  const request = new Request(getBoardUrl(station));
  request.timeoutInterval = Math.max(5, Number(CONFIG.requestTimeoutSeconds) || 15);
  request.headers = { "ModuleId": "5111", "TabId": "248",
    "Accept": "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) AppleWebKit/605.1.15" };
  const responseText = await request.loadString();
  const status = request.response ? Number(request.response.statusCode) : null;
  if (status === 429) {
    const error = new Error(`${station}: Transperth rate limit reached.`);
    error.retryable = false; error.kind = "rate-limited"; error.station = station;
    error.retryAfterDate = recordGlobalBackoff(station); throw error;
  }
  if (Number.isFinite(status) && status !== 200) {
    const error = new Error(`${station}: HTTP ${status}.`);
    error.retryable = retryableHttpStatus(status); error.kind = error.retryable ? "network" : "api-response";
    throw error;
  }
  let body;
  try { body = JSON.parse(responseText); }
  catch (_) { const error = new Error(`${station}: invalid JSON response.`); error.retryable = false; error.kind = "api-response"; throw error; }
  if (!body || body.result !== "success" || !body.data || !Array.isArray(body.data.StatusDetailList)) {
    const error = new Error(`${station}: unexpected API response structure.`); error.retryable = false; error.kind = "api-response"; throw error;
  }
  const returnedStation = text(body.data.Station);
  if (returnedStation.toLowerCase().includes("check spelling")) {
    const error = new Error(`${station}: station was not recognised.`); error.retryable = false; error.kind = "configuration"; throw error;
  }
  const result = { requestedStation: station, returnedStation: returnedStation || station,
    updated: text(body.data.LastUpdated), departures: body.data.StatusDetailList.map(entry => compactApiDeparture(entry, returnedStation || station)) };
  saveSharedBoard(result);
  return result;
}

async function requestBoardWithRetry(station) {
  const attempts = CONFIG.retryTransientFailures
    ? Math.min(2, Math.max(1, Math.floor(Number(CONFIG.maximumRequestAttempts) || 1)))
    : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      debug("Requesting station board", { station, attempt, attempts });
      return await performBoardRequest(station);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || error.retryable === false) throw error;
      await sleep(Math.max(100, Number(CONFIG.retryDelayMilliseconds) || 400));
    }
  }
  throw lastError || new Error(`${station}: request failed.`);
}

function buildTripIndex(departures) {
  const index = new Map();
  for (const departure of departures) {
    if (!departure.tripId) continue;
    if (!index.has(departure.tripId)) index.set(departure.tripId, []);
    index.get(departure.tripId).push(departure);
  }
  return index;
}

function derivedTerminalNames() {
  const names = new Set();
  for (const station of CONFIG.journey.destinationStations) {
    names.add(normaliseStationName(station));
  }
  return names;
}

function findLaterDestinationCall(originDeparture, destinationBoards) {
  const originDate = parseApiDate(originDeparture.tripStopSchedule);
  if (!originDate || !originDeparture.tripId) return null;
  const maximumMilliseconds = Number(CONFIG.journey.maximumJourneyHours) * 3600000;
  let best = null;
  for (const board of destinationBoards) {
    const matches = board.index.get(originDeparture.tripId) || [];
    for (const call of matches) {
      const callDate = parseApiDate(call.tripStopSchedule);
      if (!callDate) continue;
      const difference = callDate.getTime() - originDate.getTime();
      if (difference <= 0 || difference > maximumMilliseconds) continue;
      if (!best || callDate < best.callDate) {
        best = {
          station: board.station,
          call,
          callDate,
          journeyMinutes: Math.round(difference / 60000)
        };
      }
    }
  }
  return best;
}

function matchJourney(originDeparture, destinationBoards, terminalNames) {
  const laterCall = findLaterDestinationCall(originDeparture, destinationBoards);
  if (laterCall) {
    return {
      matched: true,
      method: "trip-id",
      destinationStation: laterCall.station,
      destinationCallSchedule: laterCall.call.tripStopSchedule,
      journeyMinutes: laterCall.journeyMinutes
    };
  }
  const terminalMatch = CONFIG.journey.allowTerminalDestinationFallback &&
    terminalNames.has(normaliseStationName(originDeparture.destination));
  if (terminalMatch) {
    return {
      matched: true,
      method: "terminal",
      destinationStation: originDeparture.destination,
      destinationCallSchedule: "",
      journeyMinutes: null
    };
  }
  return { matched: false, method: "none" };
}

function departureReferenceTimestamp(departure, useExpected) {
  return departureSortTimestamp(departure, useExpected);
}

function correlateJourney(originBoard, destinationResults) {
  const destinationBoards = destinationResults.map(result => ({ station: result.returnedStation, index: buildTripIndex(result.departures) }));
  const terminalNames = derivedTerminalNames();
  const lowerCutoff = RUN_STARTED_MS - CONFIG.cachedDepartureGraceMinutes * 60000;
  const matched = [];
  for (const departure of originBoard.departures) {
    const reference = departureReferenceTimestamp(departure, CONFIG.useExpectedCountdowns);
    if (!Number.isFinite(reference) || reference < lowerCutoff) continue;
    const journeyMatch = matchJourney(departure, destinationBoards, terminalNames);
    if (!journeyMatch.matched) continue;
    matched.push({ ...departure, matchMethod: journeyMatch.method,
      matchedDestinationStation: journeyMatch.destinationStation,
      destinationCallSchedule: journeyMatch.destinationCallSchedule, journeyMinutes: journeyMatch.journeyMinutes });
  }
  matched.sort((a,b) => departureSortTimestamp(a, CONFIG.sortMode === "expected") - departureSortTimestamp(b, CONFIG.sortMode === "expected"));
  return matched;
}

function departuresForCache(departures) {
  const horizon = RUN_STARTED_MS + CONFIG.cacheHorizonMinutes * 60000;
  return departures.filter(item => {
    const timestamp = departureReferenceTimestamp(item, true);
    return Number.isFinite(timestamp) && timestamp <= horizon;
  }).slice(0, Math.floor(CONFIG.maximumCachedDepartures));
}

function buildCoverage(departures) {
  const records = departures.map(item => ({
    timestamp: departureReferenceTimestamp(item, true),
    cancelled: isCancelledService(item)
  })).filter(item => Number.isFinite(item.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const usable = records.filter(item => !item.cancelled);
  const cancelled = records.filter(item => item.cancelled);
  return {
    firstDeparture: usable.length ? new Date(usable[0].timestamp).toISOString() : null,
    lastDeparture: usable.length ? new Date(usable[usable.length - 1].timestamp).toISOString() : null,
    departureCount: records.length,
    usableDepartureCount: usable.length,
    cancelledDepartureCount: cancelled.length,
    firstUsableDeparture: usable.length ? new Date(usable[0].timestamp).toISOString() : null,
    lastUsableDeparture: usable.length ? new Date(usable[usable.length - 1].timestamp).toISOString() : null,
    firstCancelledDeparture: cancelled.length ? new Date(cancelled[0].timestamp).toISOString() : null,
    lastCancelledDeparture: cancelled.length ? new Date(cancelled[cancelled.length - 1].timestamp).toISOString() : null
  };
}

function effectiveRealtimePolicy(cacheAgeMinutes) {
  return !Number.isFinite(cacheAgeMinutes) || cacheAgeMinutes <= CONFIG.maximumCachedRealtimeAgeMinutes;
}

function prepareViewModel(departure, context) {
  const details = context || {};
  const scheduled = parseApiDate(departure.tripStopSchedule);
  if (!scheduled) return null;
  const cancelled = isCancelledService(departure);
  const useCachedRealtime = details.source !== "cached" || effectiveRealtimePolicy(details.cacheAgeMinutes);
  const expected = useCachedRealtime ? (expectedDepartureDate(departure) || scheduled) : scheduled;
  const countdownDate = CONFIG.useExpectedCountdowns && useCachedRealtime ? expected : scheduled;
  if (countdownDate.getTime() < RUN_STARTED_MS - CONFIG.cachedDepartureGraceMinutes * 60000) return null;
  const sortTimestamp = CONFIG.sortMode === "expected" && useCachedRealtime ? expected.getTime() : scheduled.getTime();
  let status = resolvedStatusText(departure);
  let statusKey = resolvedStatusKey(departure);
  if (details.source === "cached" && !useCachedRealtime && !cancelled) {
    if (CONFIG.staleStatusDisplay === "suppress") status = "";
    else if (CONFIG.staleStatusDisplay === "replace") status = CONFIG.staleStatusReplacement;
    statusKey = "unavailable";
  }
  return {
    raw: departure,
    cancelled,
    departureTimestamp: scheduled.getTime(),
    sortTimestamp,
    time: /^\d{1,2}:\d{2}$/.test(departure.departure) && useCachedRealtime
      ? departure.departure.padStart(5, "0") : shortTime(scheduled),
    countdown: cancelled ? CONFIG.cancelledLabel : formatCountdown(minutesUntilTimestamp(countdownDate.getTime())),
    destination: destinationDisplayText(departure.destination),
    serviceLine: serviceLineDisplayText(departure.serviceLine),
    platform: departure.platform,
    compactCars: departure.cars ? `${departure.cars} car` : "",
    regularCars: departure.cars ? `${departure.cars} cars` : "",
    series: departure.series ? `${departure.series}-Series` : "",
    status: cancelled ? "" : status,
    statusKey
  };
}

function prepareViewModels(departures, context) {
  return departures.map(item => prepareViewModel(item, context)).filter(Boolean)
    .sort((a, b) => a.sortTimestamp - b.sortTimestamp);
}

function partitionViewModels(viewModels) {
  const cancelled = viewModels.filter(item => item.cancelled);
  const usable = viewModels.filter(item => !item.cancelled);
  if (CONFIG.cancelledServiceDisplay === "hide") {
    return { viewModels: usable, cancelledViewModels: [] };
  }
  if (CONFIG.cancelledServiceDisplay === "show") {
    return { viewModels, cancelledViewModels: [] };
  }
  return { viewModels: usable, cancelledViewModels: cancelled };
}

function dataFromCache(cached, context) {
  const details = context || {};
  const age = Number.isFinite(details.cacheAgeMinutes) ? details.cacheAgeMinutes : cacheAgeMinutes(cached);
  const prepared = prepareViewModels(cached.departures, { source: "cached", cacheAgeMinutes: age });
  const partitioned = partitionViewModels(prepared);
  const coverage = buildCoverage(cached.departures);
  const usableFutureCount = prepared.filter(item => !item.cancelled).length;
  return {
    source: usableFutureCount ? "cached" : "cache-exhausted",
    updated: cached.updated,
    cachedAt: cached.cachedAt,
    viewModels: partitioned.viewModels,
    cancelledViewModels: partitioned.cancelledViewModels,
    originCount: Number(cached.originCount || 0),
    matchedCount: Number(cached.matchedCount || cached.departures.length),
    correlationComplete: true,
    failureKind: usableFutureCount ? text(details.failureKind) : "cache-exhausted",
    failureMessage: text(details.failureMessage),
    cacheReason: details.cacheReason || "valid cache fallback",
    cacheAgeMinutes: age,
    retryAfterDate: details.retryAfterDate || null,
    coverage,
    cacheProfile: cached.cacheProfile || null,
    cacheOrigin: cacheOrigin(cached),
    extendedHorizonPopulated: Boolean(cached.cacheProfile && cached.cacheProfile.extendedHorizonPopulated),
    instanceHash: INSTANCE_HASH
  };
}

async function fetchJourneyData() {
  const cacheResult = loadCacheDetailed(); const cached = cacheResult.cache;
  if (canReuseFreshCache(cached)) return dataFromCache(cached, { cacheReason: "fresh cache reused", cacheAgeMinutes: cacheResult.ageMinutes });
  clearExpiredGlobalBackoff();
  const backoff = activeGlobalBackoff();
  if (backoff) {
    cacheDebug("Live request skipped during shared rate-limit backoff", backoff);
    if (cached) return dataFromCache(cached, { failureKind: "rate-limited", cacheReason: cacheResult.reason,
      cacheAgeMinutes: cacheResult.ageMinutes, retryAfterDate: backoff.until });
    return { source: "rate-limited", viewModels: [], cancelledViewModels: [], originCount: 0, matchedCount: 0, failureKind: "rate-limited",
      cacheReason: cacheResult.reason, retryAfterDate: backoff.until, instanceHash: INSTANCE_HASH };
  }
  try {
    const stations = [CONFIG.journey.originStation, ...CONFIG.journey.destinationStations];
    const results = await Promise.all(stations.map(requestBoardWithRetry));
    const originBoard = results[0]; const allMatched = correlateJourney(originBoard, results.slice(1));
    const retained = departuresForCache(allMatched);
    const coverage = buildCoverage(retained);
    const cacheProfile = nativeCacheProfile(coverage);
    const payload = {
      schemaVersion: CONFIG.cacheSchemaVersion,
      configurationSignature: buildConfigurationSignature(),
      instanceHash: INSTANCE_HASH,
      scriptIdentity: scriptIdentity(),
      source: "live",
      updated: originBoard.updated,
      cachedAt: new Date().toISOString(),
      originCount: originBoard.departures.length,
      matchedCount: allMatched.length,
      coverage,
      cacheProfile,
      departures: retained
    };
    saveCacheIfChanged(payload);
    const prepared = prepareViewModels(retained, { source: "live", cacheAgeMinutes: 0 });
    const partitioned = partitionViewModels(prepared);
    return {
      source: "live",
      updated: payload.updated,
      cachedAt: payload.cachedAt,
      viewModels: partitioned.viewModels,
      cancelledViewModels: partitioned.cancelledViewModels,
      originCount: payload.originCount,
      matchedCount: payload.matchedCount,
      correlationComplete: true,
      cacheAgeMinutes: 0,
      coverage,
      cacheProfile,
      cacheOrigin: "native",
      extendedHorizonPopulated: true,
      instanceHash: INSTANCE_HASH
    };
  } catch (error) {
    const failureKind = classifyFailure(error);
    const retryAfterDate = error && error.retryAfterDate ? error.retryAfterDate :
      (failureKind === "rate-limited" ? recordGlobalBackoff(error.station || "") : null);
    console.log(`Live journey correlation failed [${failureKind}]: ${error}`);
    cacheDebug("Fallback decision", {
      cacheAvailable: Boolean(cached),
      cacheReason: cacheResult.reason,
      cacheAgeMinutes: cacheResult.ageMinutes,
      failureKind,
      cacheOrigin: cacheOrigin(cached),
      extendedHorizonPopulated: Boolean(
        cached && cached.cacheProfile && cached.cacheProfile.extendedHorizonPopulated
      ),
      retryAfterUtc: retryAfterDate ? retryAfterDate.toISOString() : null,
      retryAfterLocal: retryAfterDate ? localDateTime(retryAfterDate) : null
    });
    if (cached) return dataFromCache(cached, { failureKind, failureMessage: text(error && (error.message || error)),
      cacheReason: cacheResult.reason, cacheAgeMinutes: cacheResult.ageMinutes, retryAfterDate });
    return { source: failureKind, viewModels: [], cancelledViewModels: [], originCount: 0, matchedCount: 0, failureKind,
      failureMessage: text(error && (error.message || error)), cacheReason: cacheResult.reason,
      retryAfterDate, instanceHash: INSTANCE_HASH };
  }
}

function setTextStyle(item, font, colour, lineLimit, minimumScale) {
  item.font = font;
  item.textColor = colour;
  if (lineLimit !== undefined) item.lineLimit = lineLimit;
  if (minimumScale !== undefined) item.minimumScaleFactor = minimumScale;
}

function subtitleText(family) {
  if (!CONFIG.showBoardScope) return "";
  return family === "small" ? "All train lines" : "All train lines • journey matched";
}

function addHeader(widget, family) {
  const titleValue = family === "small"
    ? `🚆 ${CONFIG.journey.destinationLabel}`
    : `🚆 ${originDisplayName()} → ${CONFIG.journey.destinationLabel}`;
  const title = widget.addText(titleValue);
  setTextStyle(title,
    family === "small" ? STYLES.fonts.smallTitle : STYLES.fonts.regularTitle,
    STYLES.colours.primary, 1, 0.7);
  const subtitleValue = subtitleText(family);
  if (subtitleValue) {
    const subtitle = widget.addText(subtitleValue);
    setTextStyle(subtitle,
      family === "small" ? STYLES.fonts.smallSubtitle : STYLES.fonts.regularSubtitle,
      STYLES.colours.secondary, 1, 0.65);
  }
}

function usingCountdownLayout() { return CONFIG.accessibility.layoutProfile === "countdown"; }
function accessibilityInformationParts(vm) {
  if (CONFIG.accessibility.fontProfile === "extra-large") return vm.destination ? [vm.destination] : [];
  if (CONFIG.accessibility.fontProfile === "large" || usingCountdownLayout()) return [vm.destination, vm.serviceLine].filter(Boolean);
  return null;
}

function buildSmallInformation(vm) {
  const accessible = accessibilityInformationParts(vm);
  if (accessible) return accessible.join(" • ");
  const parts = [];
  if (CONFIG.smallWidget.showDestination && vm.destination) parts.push(vm.destination);
  if (CONFIG.smallWidget.showServiceLine && vm.serviceLine) parts.push(vm.serviceLine);
  if (CONFIG.smallWidget.showPlatform && vm.platform) parts.push(`Platform ${vm.platform}`);
  if (CONFIG.smallWidget.showCars && vm.compactCars) parts.push(vm.compactCars);
  if (CONFIG.smallWidget.showTrainSeries && vm.series) parts.push(vm.series);
  if (CONFIG.smallWidget.showStatus && vm.status) parts.push(vm.status);
  return parts.join(" • ");
}

function addSmallRow(widget, vm) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const time = row.addText(vm.time);
  setTextStyle(time, STYLES.fonts.smallTime, STYLES.colours.primary, 1, 0.8);
  row.addSpacer();
  const countdown = row.addText(vm.countdown);
  setTextStyle(countdown, usingCountdownLayout() ? STYLES.fonts.smallCountdownFocus : STYLES.fonts.smallCountdown,
    colourForStatusKey(vm.statusKey), 1, 0.65);
  const information = buildSmallInformation(vm);
  if (information) {
    const details = widget.addText(information);
    setTextStyle(details, STYLES.fonts.smallDetails, STYLES.colours.secondary, 1, 0.55);
  }
}

function buildRegularInformation(vm, large) {
  const accessible = accessibilityInformationParts(vm);
  if (accessible) return accessible.join(" • ");
  const parts = [];
  if (CONFIG.showDestination && vm.destination) parts.push(vm.destination);
  if (CONFIG.showServiceLine && vm.serviceLine) parts.push(vm.serviceLine);
  if (CONFIG.showPlatform && vm.platform) parts.push(large ? `Platform ${vm.platform}` : `P${vm.platform}`);
  if (CONFIG.showCars && vm.regularCars) parts.push(vm.regularCars);
  if (CONFIG.showTrainSeries && vm.series) parts.push(vm.series);
  return parts.join(" • ");
}

function addMediumRow(widget, vm) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const time = row.addText(vm.time);
  setTextStyle(time, STYLES.fonts.mediumTime, STYLES.colours.primary, 1, 0.8);
  row.addSpacer(8);
  const countdown = row.addText(vm.countdown);
  setTextStyle(countdown, usingCountdownLayout() ? STYLES.fonts.mediumCountdownFocus : STYLES.fonts.mediumCountdown,
    colourForStatusKey(vm.statusKey), 1, 0.6);
  const information = buildRegularInformation(vm, false);
  if (information) {
    row.addSpacer(10);
    const details = row.addText(information);
    setTextStyle(details, STYLES.fonts.mediumInformation,
      STYLES.colours.information, 1, 0.45);
  }
  if (CONFIG.showStatus && vm.status) {
    row.addSpacer();
    const status = row.addText(vm.status);
    setTextStyle(status, STYLES.fonts.mediumStatus,
      colourForStatusKey(vm.statusKey), 1, 0.5);
  }
}

function addLargeRow(widget, vm) {
  const first = widget.addStack();
  first.layoutHorizontally();
  first.centerAlignContent();
  const time = first.addText(vm.time);
  setTextStyle(time, STYLES.fonts.largeTime, STYLES.colours.primary, 1, 0.8);
  first.addSpacer(10);
  const countdown = first.addText(vm.countdown);
  setTextStyle(countdown, usingCountdownLayout() ? STYLES.fonts.largeCountdownFocus : STYLES.fonts.largeCountdown,
    colourForStatusKey(vm.statusKey), 1, 0.65);
  if (CONFIG.showStatus && vm.status) {
    first.addSpacer();
    const status = first.addText(vm.status);
    setTextStyle(status, STYLES.fonts.largeStatus,
      colourForStatusKey(vm.statusKey), 1, 0.65);
  }
  const information = buildRegularInformation(vm, true);
  if (information) {
    const details = widget.addText(information);
    setTextStyle(details, STYLES.fonts.largeInformation,
      STYLES.colours.information, 1, 0.55);
  }
}

function cancellationAlertLimit(family) {
  const configured = Number(CONFIG.cancelledAlertsShown[family]);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1;
}

function buildCancellationInformation(vm, family) {
  const parts = [];
  if (vm.destination) parts.push(vm.destination);
  if (vm.serviceLine) parts.push(vm.serviceLine);
  if (family !== "small" && vm.platform) parts.push(family === "large" ? `Platform ${vm.platform}` : `P${vm.platform}`);
  return parts.join(" • ");
}

function addCancellationAlert(widget, vm, family) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const time = row.addText(vm.time);
  const timeFont = family === "small" ? STYLES.fonts.smallTime
    : family === "large" ? STYLES.fonts.largeTime : STYLES.fonts.mediumTime;
  setTextStyle(time, timeFont, STYLES.colours.cancelled, 1, 0.75);
  row.addSpacer(family === "small" ? 6 : 8);
  const cancelled = row.addText(CONFIG.cancelledLabel);
  const cancelledFont = family === "small" ? STYLES.fonts.smallDetails
    : family === "large" ? STYLES.fonts.largeStatus : STYLES.fonts.mediumStatus;
  setTextStyle(cancelled, cancelledFont, STYLES.colours.cancelled, 1, 0.65);
  const information = buildCancellationInformation(vm, family);
  if (information) {
    row.addSpacer(family === "small" ? 6 : 10);
    const details = row.addText(information);
    const detailsFont = family === "small" ? STYLES.fonts.smallDetails
      : family === "large" ? STYLES.fonts.largeInformation : STYLES.fonts.mediumInformation;
    setTextStyle(details, detailsFont, STYLES.colours.secondary, 1, 0.45);
  }
}

function addCancellationAlerts(widget, data, family) {
  if (!Array.isArray(data.cancelledViewModels) || data.cancelledViewModels.length === 0) return 0;
  const alerts = data.cancelledViewModels.slice(0, cancellationAlertLimit(family));
  alerts.forEach((vm, index) => {
    addCancellationAlert(widget, vm, family);
    if (index < alerts.length - 1) widget.addSpacer(4);
  });
  return alerts.length;
}

function buildFooterState(data) {
  const updated = parseLastUpdated(data.updated); const cachedAt = parseIsoDate(data.cachedAt);
  const reference = updated || cachedAt;
  const age = reference ? Math.max(0, minutesBetweenMs(RUN_STARTED_MS, reference.getTime())) : null;
  if (data.source === "cache-exhausted") return { marker: "⚠", label: "Cache exhausted", time: "", colour: STYLES.colours.severe };
  if (data.source !== "live" && data.source !== "cached") return { marker: "⚠", label: failureLabel(data.failureKind || data.source), time: "", colour: STYLES.colours.severe };
  if (age !== null && age > CONFIG.staleMinutes) return { marker: "⚠", label: `Data ${age}m old`, time: shortTime(reference), colour: STYLES.colours.severe };
  if (data.source === "cached") {
    const reason = data.failureKind ? failureLabel(data.failureKind) : "Cached";
    return { marker: "⚠", label: reason === "Cached" ? "Cached" : `${reason} • Cached`,
      time: reference ? shortTime(reference) : "", colour: STYLES.colours.cached };
  }
  return { marker: "●", label: "Live", time: reference ? shortTime(reference) : "", colour: STYLES.colours.live };
}

function addFooter(widget, data, family) {
  if (!CONFIG.showUpdatedTime) return;
  const state = buildFooterState(data); let value = `${state.marker} ${state.label}`;
  if (state.time) value += ` ${state.time}`;
  if (CONFIG.debugShowCounts) value += ` (${data.matchedCount}/${data.originCount})`;
  if (CONFIG.debugShowDiagnostics) value += ` • ${data.instanceHash || INSTANCE_HASH} • cache ${Number.isFinite(data.cacheAgeMinutes) ? data.cacheAgeMinutes + "m" : "n/a"}`;
  const footer = widget.addText(value);
  setTextStyle(footer, family === "small" ? STYLES.fonts.smallFooter : STYLES.fonts.regularFooter, state.colour, 1, 0.65);
}

function addMessageState(widget, heading, explanation, severe) {
  const headingText = widget.addText(heading);
  setTextStyle(headingText, STYLES.fonts.emptyHeading,
    severe ? STYLES.colours.severe : STYLES.colours.primary, 2, 0.7);
  if (explanation) {
    widget.addSpacer(4);
    const explanationText = widget.addText(explanation);
    setTextStyle(explanationText, STYLES.fonts.emptyDetails,
      STYLES.colours.secondary, 3, 0.7);
  }
}

function normalisedWidgetFamily() {
  return ["small", "medium", "large"].includes(config.widgetFamily)
    ? config.widgetFamily : "medium";
}

function departureLimitForFamily(family) {
  const configured = Number(CONFIG.departuresShown[family]);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return family === "small" ? 2 : family === "large" ? 6 : 3;
}

async function createWidget() {
  const family = normalisedWidgetFamily();
  const widget = new ListWidget();
  widget.backgroundColor = STYLES.colours.background;
  widget.url = getLiveUrl();
  widget.setPadding(12, family === "small" ? 12 : 14, 10,
    family === "small" ? 12 : 14);

  let configurationError = null;
  try {
    validateConfiguration();
  } catch (error) {
    configurationError = error;
  }

  addHeader(widget, family);
  widget.addSpacer(family === "small" ? 7 : 8);

  if (configurationError) {
    addMessageState(widget, "Configuration error",
      text(configurationError.message || configurationError), true);
    widget.refreshAfterDate = new Date(
      RUN_STARTED_MS + Math.max(1, Number(CONFIG.normalRefreshMinutes) || 10) * 60000);
    return widget;
  }

  const data = await fetchJourneyData();
  const cancellationAlertCount = addCancellationAlerts(widget, data, family);
  if (cancellationAlertCount > 0) widget.addSpacer(family === "small" ? 5 : 6);
  if (!Array.isArray(data.viewModels) || data.viewModels.length === 0) {
    const failed = data.source !== "live" && data.source !== "cached";
    let heading = failed ? failureLabel(data.failureKind || data.source) : "No matching services";
    let explanation = failed ? "A complete live journey could not be obtained and no useful cached service remains."
      : (cancellationAlertCount > 0
        ? "No non-cancelled service is currently confirmed for this journey."
        : "No current train is confirmed to serve the configured destination.");
    if (data.source === "cache-exhausted") {
      heading = "No future cached services";
      const last = data.coverage && parseIsoDate(data.coverage.lastDeparture);
      explanation = last
        ? `The last cached service departed at ${shortTime(last)}.`
        : "The cached journey contains no future departures.";
      if (data.retryAfterDate) {
        explanation += ` Live updates will retry after ${shortTime(data.retryAfterDate)}.`;
      }
      if (CONFIG.debugShowDiagnostics && data.cacheOrigin === "legacy-migrated") {
        explanation += " The migrated legacy cache had limited coverage.";
      }
    } else if (data.source === "rate-limited" && data.retryAfterDate) {
      explanation = `Transperth rate-limited requests. Retry after ${shortTime(data.retryAfterDate)}. ${explanation}`;
    }
    if (CONFIG.debugShowDiagnostics && data.cacheReason) explanation += ` Cache: ${data.cacheReason}.`;
    addMessageState(widget, heading, explanation, failed);
    widget.addSpacer();
    addFooter(widget, data, family);
  } else {
    const visible = data.viewModels.slice(0, departureLimitForFamily(family));
    visible.forEach((vm, index) => {
      if (family === "small") addSmallRow(widget, vm);
      else if (family === "large") addLargeRow(widget, vm);
      else addMediumRow(widget, vm);
      if (index < visible.length - 1) {
        widget.addSpacer(family === "small" ? 7 : 6);
      }
    });
    widget.addSpacer();
    addFooter(widget, data, family);
  }

  const schedule = determineRefreshSchedule();
  if (data && data.retryAfterDate instanceof Date && data.retryAfterDate > schedule.refreshDate) {
    widget.refreshAfterDate = data.retryAfterDate;
    debug("Refresh delayed by shared rate-limit backoff", {
      refreshDateUtc: data.retryAfterDate.toISOString(),
      refreshDateLocal: localDateTime(data.retryAfterDate),
      instanceHash: INSTANCE_HASH
    });
  } else {
    widget.refreshAfterDate = schedule.refreshDate;
    debug("Refresh scheduled", schedule);
  }
  return widget;
}

const widget = await createWidget();
Script.setWidget(widget);

if (!config.runsInWidget) {
  // Change to presentSmall(), presentMedium(), or presentLarge() for testing.
  await widget.presentLarge();
}

Script.complete();
