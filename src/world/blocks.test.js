import {BLOCKS, BLOCK_BY_ID} from "./blocks";
import {ITEM_BY_ID, droppedItemForBlock} from "./items";
import {isPartialShape, shapeParts} from "./blockShapes";

describe("block visuals", () => {
    test("every atlas-backed face points to generated metadata", () => {
        BLOCKS.filter((block) => block.textures).forEach((block) => {
            const textureSets = [block.textures, ...(block.variants ?? [])];
            textureSets.flatMap((textures) => Object.values(textures)).forEach((textureName) => {
                expect(block.atlasEntries[textureName]?.uv).toHaveLength(4);
                expect(["opaque", "cutout", "translucent", "emissive"]).toContain(block.atlasEntries[textureName]?.layer);
            });
        });
    });

    test("includes the first decorative building collection", () => {
        expect([
            "red_brick", "gray_brick", "mossy_stone", "polished_stone",
            "red_wood", "pale_wood", "pale_log", "cactus", "gravel", "snow", "ice",
        ].every((id) => Boolean(BLOCK_BY_ID[id]))).toBe(true);
    });

    test("functional blocks use coordinated directional artwork", () => {
        expect(BLOCK_BY_ID.crafting_table.textures).toMatchObject({top: "crafting_top", north: "crafting_front"});
        expect(BLOCK_BY_ID.chest.textures).toMatchObject({top: "chest_top", north: "chest_front"});
        expect(BLOCK_BY_ID.bed.textures).toMatchObject({top: "bed_top", north: "bed_end", bottom: "bed_frame"});
        expect(BLOCK_BY_ID.window.atlasEntries.window.layer).toBe("translucent");
        expect(BLOCK_BY_ID.lamp_on.atlasEntries.lamp_on.layer).toBe("emissive");
    });

    test("includes the lightweight construction collection", () => {
        const expected = {
            wood_slab: "slab", stone_slab: "slab", wood_stairs: "stairs", stone_stairs: "stairs",
            wood_fence: "fence", metal_fence: "fence", stone_wall: "wall", wood_post: "post", wood_beam: "beam",
            wood_railing: "railing", torch: "torch", lantern: "lantern",
        };
        Object.entries(expected).forEach(([id, shape]) => expect(BLOCK_BY_ID[id]?.shape).toBe(shape));
    });

    test("defines deterministic visual variants and restrained animation metadata", () => {
        ["dirt", "grass", "stone", "sand", "leaves", "coal_ore", "iron_ore", "copper_ore", "gold_ore", "crystal_ore"]
            .forEach((id) => expect(BLOCK_BY_ID[id].variants).toHaveLength(1));
        expect(BLOCK_BY_ID.water).toMatchObject({biomeTint: "water", animation: "water"});
        expect(BLOCK_BY_ID.lava.animation).toBe("lava");
        expect(BLOCK_BY_ID.portal.animation).toBe("portal");
        expect(BLOCK_BY_ID.lamp_on.animation).toBe("powered");
    });

    test("registers low-poly objects with models and matching previews", () => {
        ["chair", "wood_table", "shelf", "barrel", "flowerpot", "bench", "floor_lamp", "rug", "rock"].forEach((id) => {
            expect(BLOCK_BY_ID[id]).toMatchObject({shape: "model", modelId: expect.any(String), modelUrl: expect.any(String)});
            expect(BLOCK_BY_ID[id].modelPreview).toMatchObject({size: 128});
        });
    });

    test("every player-facing shaped object has a preview, inventory entry, and valid bounds", () => {
        BLOCKS.filter((block) => !block.internal && (isPartialShape(block.shape) || block.shape === "model")).forEach((block) => {
            expect(ITEM_BY_ID[block.id]).toBeDefined();
            expect(block.atlasPreview || block.modelPreview || block.texture).toBeTruthy();
            expect(droppedItemForBlock(block.id)).toBe(block.id);
            const parts = block.shape === "model"
                ? [block.collisionBounds]
                : shapeParts(block, {facing: "east", half: "upper"}, () => ({solid: true}));
            parts.forEach((bounds) => {
                expect(bounds).toHaveLength(6);
                expect(bounds[0]).toBeLessThan(bounds[1]);
                expect(bounds[2]).toBeLessThan(bounds[3]);
                expect(bounds[4]).toBeLessThan(bounds[5]);
            });
        });
    });
});
