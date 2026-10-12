import {addStructure, cityForColumn, stadiumCenter, stadiumCenters, structureForColumn} from "./structures";
import {generateChunkColumn, spawnPosition} from "./terrain";
import {parseChunkKey} from "./chunks";

function findStructure(seed, type, radius = 40) {
    for (let chunkX = -radius; chunkX <= radius; chunkX += 1) {
        for (let chunkZ = -radius; chunkZ <= radius; chunkZ += 1) {
            const structure = structureForColumn(seed, chunkX, chunkZ);
            if (structure?.type === type) return structure;
        }
    }
    return null;
}

function generatedIds(seed, structure) {
    const generated = generateChunkColumn(seed, structure.chunkX, structure.chunkZ);
    const chunks = addStructure(generated, seed, structure);
    return Array.from(chunks.values()).flatMap((chunk) => Array.from(chunk.values()));
}

function generatedStructure(seed, structure) {
    return addStructure(generateChunkColumn(seed, structure.chunkX, structure.chunkZ), seed, structure);
}

describe("seeded structures", () => {
    test("placement decisions are deterministic", () => {
        expect(structureForColumn("same", 12, -8)).toEqual(structureForColumn("same", 12, -8));
    });

    test("builds a deterministic well", () => {
        const structure = {id: "well", type: "well", chunkX: 3, chunkZ: 3};
        const chunks = addStructure(new Map(), "structures", structure);
        expect(Array.from(chunks.values()).some((chunk) => Array.from(chunk.values()).includes("water"))).toBe(true);
    });

    test("places a restrained number of deterministic houses across the overworld", () => {
        const houses = [];
        for (let chunkX = -20; chunkX <= 20; chunkX += 1) {
            for (let chunkZ = -20; chunkZ <= 20; chunkZ += 1) {
                const structure = structureForColumn("beautiful-houses", chunkX, chunkZ);
                if (structure?.type === "house") houses.push(structure);
            }
        }

        expect(houses.length).toBeGreaterThan(8);
        expect(houses.length).toBeLessThan(70);
        expect(new Set(houses.map(({chunkX, chunkZ}) => `${Math.floor(chunkX / 4)},${Math.floor(chunkZ / 4)}`)).size).toBe(houses.length);
    });

    test("builds furnished houses with doors, windows, lighting, paths, and roofs", () => {
        const house = findStructure("beautiful-houses", "house", 24);
        expect(house).not.toBeNull();
        const ids = generatedIds("beautiful-houses", house);

        ["door", "door_top", "window", "lantern", "bed", "wood_table", "chair", "shelf", "wall_art", "stone_slab", "flowerpot", "bench"]
            .forEach((id) => expect(ids).toContain(id));
        expect(ids.filter((id) => ["red_wood", "sand", "gray_brick"].includes(id)).length).toBeGreaterThan(20);
    });

    test("spaces hotels, tall buildings, and stadiums as rarer regional landmarks", () => {
        const landmarks = [];
        for (let chunkX = -30; chunkX <= 30; chunkX += 1) {
            for (let chunkZ = -30; chunkZ <= 30; chunkZ += 1) {
                const structure = structureForColumn("landmark-density", chunkX, chunkZ);
                if (["hotel", "building", "stadium"].includes(structure?.type)) landmarks.push(structure);
            }
        }

        expect(landmarks.filter(({type}) => type === "hotel").length).toBeGreaterThan(2);
        expect(landmarks.filter(({type}) => type === "building").length).toBeGreaterThan(2);
        expect(landmarks.filter(({type}) => type === "stadium").length).toBeGreaterThan(3);
        expect(landmarks.length).toBeLessThan(80);
        const regional = landmarks.filter((structure) => !structure.guaranteed);
        expect(new Set(regional.map(({chunkX, chunkZ}) => `${Math.floor(chunkX / 7)},${Math.floor(chunkZ / 7)}`)).size).toBe(regional.length);
        expect(new Set(regional.filter(({type}) => type === "stadium").map(({size}) => size))).toEqual(new Set(["standard", "grand"]));
    });

    test("builds a four-floor furnished hotel with a deep outdoor pool", () => {
        const hotel = findStructure("resort-test", "hotel");
        expect(hotel).not.toBeNull();
        const ids = generatedIds("resort-test", hotel);

        ["door", "door_top", "window", "ladder", "lantern", "bed", "wood_table", "chair", "cabinet", "rug", "bench", "flowerpot"]
            .forEach((id) => expect(ids).toContain(id));
        expect(ids.filter((id) => id === "water").length).toBeGreaterThanOrEqual(48);
        expect(ids.filter((id) => id === "window").length).toBeGreaterThan(70);
    });

    test("builds an accessible five-floor furnished building with balconies", () => {
        const building = findStructure("tower-test", "building");
        expect(building).not.toBeNull();
        const ids = generatedIds("tower-test", building);

        ["door", "door_top", "window", "ladder", "lantern", "bed", "wood_table", "chair", "shelf", "cabinet", "rug", "planter", "sign"]
            .forEach((id) => expect(ids).toContain(id));
        expect(ids.filter((id) => id === "window").length).toBeGreaterThan(100);
        expect(ids.filter((id) => id === "wood_railing").length).toBeGreaterThan(50);
        expect(ids.filter((id) => id === "elevator").length).toBe(5);
    });

    test("builds a fenced stadium with visible field, stands, goals, entrance, and floodlights", () => {
        const stadium = findStructure("stadium-test", "stadium");
        expect(stadium).not.toBeNull();
        const ids = generatedIds("stadium-test", stadium);

        ["metal_fence", "grass", "snow", "gray_brick", "stone_slab", "door", "door_top", "lantern", "bench", "sign"]
            .forEach((id) => expect(ids).toContain(id));
        expect(ids.filter((id) => id === "metal_fence").length).toBeGreaterThan(180);
        expect(ids.filter((id) => id === "grass").length).toBeGreaterThan(150);
    });

    test("guarantees three standard stadiums nearby and three grand stadiums in the middle distance", () => {
        const positions = stadiumCenters("stadium-map-test");
        const spawn = spawnPosition("stadium-map-test");
        const spawnChunk = [Math.floor(spawn[0] / 16), Math.floor(spawn[2] / 16)];
        expect(positions).toHaveLength(6);
        positions.slice(0, 3).forEach((position, index) => {
            const chunkX = Math.floor(position[0] / 16);
            const chunkZ = Math.floor(position[2] / 16);
            expect(Math.abs(chunkX - spawnChunk[0])).toBeLessThanOrEqual(3);
            expect(Math.abs(chunkZ - spawnChunk[1])).toBeLessThanOrEqual(3);
            expect(structureForColumn("stadium-map-test", chunkX, chunkZ)).toMatchObject({type: "stadium", size: "standard"});
            positions.slice(index + 1, 3).forEach((other) => {
                expect(Math.hypot((position[0] - other[0]) / 16, (position[2] - other[2]) / 16)).toBeGreaterThanOrEqual(3);
            });
        });
        positions.slice(3).forEach((position, index) => {
            const chunkX = Math.floor(position[0] / 16);
            const chunkZ = Math.floor(position[2] / 16);
            const distance = Math.hypot(chunkX - spawnChunk[0], chunkZ - spawnChunk[1]);
            expect(distance).toBeGreaterThanOrEqual(5);
            expect(distance).toBeLessThanOrEqual(8);
            expect(structureForColumn("stadium-map-test", chunkX, chunkZ)).toMatchObject({type: "stadium", size: "grand"});
            positions.slice(index + 4).forEach((other) => {
                expect(Math.hypot((position[0] - other[0]) / 16, (position[2] - other[2]) / 16)).toBeGreaterThanOrEqual(5);
            });
        });
        expect(stadiumCenter("stadium-map-test")).toEqual(positions[0]);
    });

    test("builds grand stadiums at roughly twice the standard width and length", () => {
        const position = stadiumCenters("grand-stadium-test")[3];
        const grand = structureForColumn(
            "grand-stadium-test",
            Math.floor(position[0] / 16),
            Math.floor(position[2] / 16)
        );
        const ids = generatedIds("grand-stadium-test", grand);
        expect(grand).toMatchObject({type: "stadium", size: "grand"});
        expect(ids.filter((id) => id === "metal_fence").length).toBeGreaterThan(350);
        expect(ids.filter((id) => id === "grass").length).toBeGreaterThan(900);
        expect(ids.filter((id) => id === "stone_slab").length).toBeGreaterThan(400);
    });

    test("builds peaceful villages with homes, crops, a market, and rail stop", () => {
        const village = findStructure("community-test", "village");
        expect(village).not.toBeNull();
        const ids = generatedIds("community-test", village);
        ["door", "window", "bed", "crop_3", "chest", "crate", "track"].forEach((id) => expect(ids).toContain(id));
    });

    test("creates exactly one connected nine-district city per world", () => {
        const districts = [];
        for (let chunkX = -12; chunkX <= 12; chunkX += 1) for (let chunkZ = -12; chunkZ <= 12; chunkZ += 1) {
            const city = cityForColumn("one-small-city", chunkX, chunkZ);
            if (city) districts.push(city);
        }
        expect(districts).toHaveLength(9);
        expect(new Set(districts.map((city) => city.id)).size).toBe(1);
        expect(new Set(districts.map((city) => `${city.districtX},${city.districtZ}`)).size).toBe(9);
        expect(Math.hypot(districts[0].cityCenterChunkX, districts[0].cityCenterChunkZ)).toBeLessThanOrEqual(6);
    });

    test("builds city roads, residences, civic plaza, park, and market from current blocks", () => {
        const districts = [];
        for (let chunkX = -8; chunkX <= 8; chunkX += 1) for (let chunkZ = -8; chunkZ <= 8; chunkZ += 1) {
            const city = cityForColumn("city-build", chunkX, chunkZ);
            if (city) districts.push(city);
        }
        const allIds = districts.flatMap((district) => generatedIds("city-build", district));
        ["gray_brick", "polished_stone", "door", "window", "bed", "wood_table", "lantern", "elevator", "water", "bench", "bush", "crate", "barrel", "sign", "path_marker"]
            .forEach((id) => expect(allIds).toContain(id));
        districts.forEach((district) => {
            const chunks = generatedStructure("city-build", district);
            Array.from(chunks.keys()).forEach((key) => {
                const [chunkX, , chunkZ] = parseChunkKey(key);
                expect([chunkX, chunkZ]).toEqual([district.chunkX, district.chunkZ]);
            });
        });
    });

    test("keeps buildings in their source column and stadiums in their reserved three-by-three area", () => {
        [findStructure("column-safe-hotel", "hotel"), findStructure("column-safe-building", "building"), findStructure("column-safe-stadium", "stadium")]
            .forEach((structure) => {
                expect(structure).not.toBeNull();
                const sourceSeed = structure.type === "hotel" ? "column-safe-hotel"
                    : structure.type === "building" ? "column-safe-building" : "column-safe-stadium";
                const chunks = generatedStructure(sourceSeed, structure);
                Array.from(chunks.keys()).forEach((key) => {
                    const [chunkX, , chunkZ] = parseChunkKey(key);
                    if (structure.type === "stadium") {
                        expect(Math.abs(chunkX - structure.chunkX)).toBeLessThanOrEqual(1);
                        expect(Math.abs(chunkZ - structure.chunkZ)).toBeLessThanOrEqual(1);
                    } else {
                        expect([chunkX, chunkZ]).toEqual([structure.chunkX, structure.chunkZ]);
                    }
                });
            });
    });

    test("clones only the structure column when upgrading an explored world", () => {
        const target = new Map([[0, "stone"]]);
        const unrelated = new Map([[0, "grass"]]);
        const chunks = new Map([["3,0,3", target], ["20,0,20", unrelated]]);
        const upgraded = addStructure(chunks, "structures", {id: "well", type: "well", chunkX: 3, chunkZ: 3});

        expect(upgraded.get("20,0,20")).toBe(unrelated);
        expect(upgraded.get("3,0,3")).not.toBe(target);
        expect(chunks.get("3,0,3")).toBe(target);
    });
});
