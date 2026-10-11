import {addStructure, cityForColumn, structureForColumn} from "./structures";
import {generateChunkColumn} from "./terrain";
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

    test("spaces hotels and tall buildings as rarer regional landmarks", () => {
        const landmarks = [];
        for (let chunkX = -30; chunkX <= 30; chunkX += 1) {
            for (let chunkZ = -30; chunkZ <= 30; chunkZ += 1) {
                const structure = structureForColumn("landmark-density", chunkX, chunkZ);
                if (["hotel", "building"].includes(structure?.type)) landmarks.push(structure);
            }
        }

        expect(landmarks.filter(({type}) => type === "hotel").length).toBeGreaterThan(3);
        expect(landmarks.filter(({type}) => type === "building").length).toBeGreaterThan(3);
        expect(landmarks.length).toBeLessThan(80);
        expect(new Set(landmarks.map(({chunkX, chunkZ}) => `${Math.floor(chunkX / 7)},${Math.floor(chunkZ / 7)}`)).size).toBe(landmarks.length);
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

    test("keeps large landmarks inside their source column for safe streaming", () => {
        [findStructure("column-safe-hotel", "hotel"), findStructure("column-safe-building", "building")]
            .forEach((structure) => {
                expect(structure).not.toBeNull();
                const chunks = generatedStructure(structure.type === "hotel" ? "column-safe-hotel" : "column-safe-building", structure);
                Array.from(chunks.keys()).forEach((key) => {
                    const [chunkX, , chunkZ] = parseChunkKey(key);
                    expect([chunkX, chunkZ]).toEqual([structure.chunkX, structure.chunkZ]);
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
