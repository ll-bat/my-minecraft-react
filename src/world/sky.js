export const DAY_DURATION_SECONDS = 360;
export const MIN_WEATHER_DURATION_SECONDS = 300;
export const MAX_WEATHER_DURATION_SECONDS = 600;
export const WEATHER_TRANSITION_SECONDS = 15;

export const DAY_PERIODS = [
    {id: "morning", label: "Morning", worldTime: 315},
    {id: "noon", label: "Noon", worldTime: 0},
    {id: "evening", label: "Evening", worldTime: 45},
    {id: "night", label: "Night", worldTime: 180},
];

export const WEATHER_OPTIONS = [
    {id: "sunny", label: "Sunny"},
    {id: "partly_cloudy", label: "Partly cloudy"},
    {id: "cloudy", label: "Cloudy"},
    {id: "rain", label: "Rainy"},
    {id: "snow", label: "Snowy"},
    {id: "windy", label: "Windy"},
];

export const WEATHER_PROFILES = {
    sunny: {cloudOpacity: 0, haze: 0, precipitation: null, wind: 0.015},
    partly_cloudy: {cloudOpacity: 0.42, haze: 0.08, precipitation: null, wind: 0.025},
    cloudy: {cloudOpacity: 0.82, haze: 0.34, precipitation: null, wind: 0.018},
    rain: {cloudOpacity: 0.95, haze: 0.48, precipitation: "rain", wind: 0.055},
    snow: {cloudOpacity: 0.9, haze: 0.4, precipitation: "snow", wind: 0.035},
    windy: {cloudOpacity: 0.55, haze: 0.12, precipitation: "wind", wind: 0.14},
};

export function normalizeWeather(value) {
    return WEATHER_PROFILES[value] ? value : "sunny";
}

const WEATHER_PATHS = {
    sunny: ["partly_cloudy", "windy"],
    partly_cloudy: ["sunny", "cloudy", "windy"],
    cloudy: ["partly_cloudy", "rain", "snow"],
    rain: ["cloudy", "partly_cloudy"],
    snow: ["cloudy", "partly_cloudy"],
    windy: ["sunny", "partly_cloudy", "cloudy"],
};

export function automaticWeatherDelay(randomValue = Math.random()) {
    const value = Math.max(0, Math.min(1, Number(randomValue) || 0));
    return MIN_WEATHER_DURATION_SECONDS
        + value * (MAX_WEATHER_DURATION_SECONDS - MIN_WEATHER_DURATION_SECONDS);
}

export function nextAutomaticWeather(current, randomValue = Math.random()) {
    const options = WEATHER_PATHS[normalizeWeather(current)];
    const value = Math.max(0, Math.min(0.999999, Number(randomValue) || 0));
    return options[Math.floor(value * options.length)];
}

export function dayPeriodForWorldTime(worldTime) {
    const phase = ((Number(worldTime) / DAY_DURATION_SECONDS + 0.25) % 1 + 1) % 1;
    if (phase < 0.23) return "morning";
    if (phase < 0.36) return "noon";
    if (phase < 0.52) return "evening";
    return "night";
}

export function worldTimeForDayPeriod(period, currentWorldTime = 0) {
    const selected = DAY_PERIODS.find((entry) => entry.id === period) ?? DAY_PERIODS[1];
    const cycle = Math.floor(Math.max(0, Number(currentWorldTime) || 0) / DAY_DURATION_SECONDS);
    return cycle * DAY_DURATION_SECONDS + selected.worldTime;
}

export function nextMorningWorldTime(currentWorldTime) {
    const value = Math.max(0, Number(currentWorldTime) || 0);
    let morning = Math.floor(value / DAY_DURATION_SECONDS) * DAY_DURATION_SECONDS + 315;
    if (morning <= value) morning += DAY_DURATION_SECONDS;
    return morning;
}
