import {ambientTreePerches, birdMotion, isAmbientDaytime, MAX_AMBIENT_BIRDS} from "./ambientSky";

describe("ambient sky", () => {
    test("selects a sparse deterministic set of generated tree crowns", () => {
        const first = ambientTreePerches("ambient-test", [0, 0]);
        const second = ambientTreePerches("ambient-test", [0, 0]);
        expect(first).toEqual(second);
        expect(first.length).toBeLessThanOrEqual(MAX_AMBIENT_BIRDS);
        first.forEach((bird, index) => first.slice(index + 1).forEach((other) => {
            expect(Math.hypot(
                bird.position[0] - other.position[0],
                bird.position[2] - other.position[2]
            )).toBeGreaterThanOrEqual(7);
        }));
    });

    test("returns exactly to the perch between flights", () => {
        const bird = {position: [4, 12.5, -3], phase: 0, radius: 7, cycleSeconds: 30};
        expect(birdMotion(bird, 0)).toMatchObject({flying: false, position: bird.position});
        expect(birdMotion(bird, 18).flying).toBe(true);
        expect(birdMotion(bird, 30)).toMatchObject({flying: false, position: bird.position});
        const takeoff = birdMotion(bird, 30 * 0.3601);
        expect(Math.hypot(...takeoff.position.map((value, index) => value - bird.position[index])))
            .toBeLessThan(0.02);
    });

    test("keeps ambient traffic in daylight", () => {
        expect(isAmbientDaytime(0)).toBe(true);
        expect(isAmbientDaytime(180)).toBe(false);
    });
});
