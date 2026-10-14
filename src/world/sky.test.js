import {
    automaticWeatherDelay,
    dayPeriodForWorldTime,
    nextAutomaticWeather,
    nextMorningWorldTime,
    normalizeWeather,
    worldTimeForDayPeriod,
} from "./sky";

describe("sky controls", () => {
    test("maps the four selected periods to useful sun positions", () => {
        expect(dayPeriodForWorldTime(worldTimeForDayPeriod("morning"))).toBe("morning");
        expect(dayPeriodForWorldTime(worldTimeForDayPeriod("noon"))).toBe("noon");
        expect(dayPeriodForWorldTime(worldTimeForDayPeriod("evening"))).toBe("evening");
        expect(dayPeriodForWorldTime(worldTimeForDayPeriod("night"))).toBe("night");
    });

    test("keeps the current day when selecting a period", () => {
        expect(worldTimeForDayPeriod("evening", 800)).toBe(765);
        expect(nextMorningWorldTime(180)).toBe(315);
        expect(nextMorningWorldTime(350)).toBe(675);
    });

    test("falls back to sunny weather for unknown saved values", () => {
        expect(normalizeWeather("rain")).toBe("rain");
        expect(normalizeWeather("storm-from-future")).toBe("sunny");
    });

    test("changes weather after a randomized five-to-ten-minute period", () => {
        expect(automaticWeatherDelay(0)).toBe(300);
        expect(automaticWeatherDelay(0.5)).toBe(450);
        expect(automaticWeatherDelay(1)).toBe(600);
        expect(nextAutomaticWeather("sunny", 0)).toBe("partly_cloudy");
        expect(nextAutomaticWeather("sunny", 0.999)).toBe("windy");
        expect(nextAutomaticWeather("rain", 0)).toBe("cloudy");
    });
});
