import {useTrimesh} from "@react-three/cannon";
import {useFrame, useThree} from "@react-three/fiber";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Vector3} from "three";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {voxelFromIntersection} from "../world/chunkGeometry";
import {getBlock, neighboringChunkKeys} from "../world/chunks";
import {blockIntersectsPlayer, MAX_INTERACTION_DISTANCE, positionKey} from "../world/coordinates";
import {isPartialShape, rotateBounds, shapeParts} from "../world/blockShapes";
import {miningDuration} from "../world/mining";
import {facingFromDirection} from "../world/interactions";
import {buildChunkMeshAsync} from "../world/meshStreaming";
import {atlasMaterialDefinition} from "../images/gameAssets";
import {ModelObjects} from "./ModelObjects";
import {registerChunkMetrics, unregisterChunkMetrics} from "../world/renderMetrics";

const MIN_BREAK_HOLD_MS = 450;
const BLOCK_MESH_DEFINITIONS = Object.fromEntries(Object.values(BLOCK_BY_ID).map((block) => [
    block.id,
    {
        fluid: Boolean(block.fluid),
        shape: block.shape,
        solid: Boolean(block.solid),
        transparent: Boolean(block.transparent),
        textures: block.textures,
        variants: block.variants,
        atlasEntries: block.atlasEntries,
        collisionBounds: block.collisionBounds,
        biomeTint: block.biomeTint,
        biomeTintFaces: block.biomeTintFaces,
        animation: block.animation,
    },
]));
const EMPTY_MESH_DATA = {
    materials: new Map(),
    collision: {
        vertices: new Float32Array([0, -10000, 0, 0.01, -10000, 0, 0, -10000, 0.01]),
        indices: new Uint32Array([0, 1, 2]),
    },
};

function createGeometry(data) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(data.uvs, 2));
    if (data.colors?.length) geometry.setAttribute("color", new Float32BufferAttribute(data.colors, 3));
    if (data.tileUvs?.length) geometry.setAttribute("tileUv", new Float32BufferAttribute(data.tileUvs, 2));
    if (data.atlasRects?.length) geometry.setAttribute("atlasRect", new Float32BufferAttribute(data.atlasRects, 4));
    geometry.computeBoundingSphere();
    return geometry;
}

const ChunkMaterial = ({atlas, block, materialKey}) => {
    const ref = useRef();
    const lastStep = useRef(-1);
    const texture = useMemo(() => {
        if (!atlas?.animation) return atlas?.texture;
        const clone = atlas.texture.clone();
        clone.needsUpdate = true;
        return clone;
    }, [atlas?.animation, atlas?.texture]);
    const cutout = atlas?.layer === "cutout";
    const translucent = atlas?.layer === "translucent";
    const emissive = atlas?.layer === "emissive";
    useEffect(() => () => { if (atlas?.animation) texture?.dispose(); }, [atlas?.animation, texture]);
    useFrame(({clock}) => {
        if (!atlas?.animation || !texture) return;
        const step = Math.floor(clock.elapsedTime * 8);
        if (step === lastStep.current) return;
        lastStep.current = step;
        const width = texture.image?.width || 1024;
        const height = texture.image?.height || 1024;
        texture.offset.set((step % 2) / width, (Math.floor(step / 2) % 2) / height);
        if (ref.current && emissive) ref.current.emissiveIntensity = 0.55 + (step % 4) * 0.08;
    });
    const tileAtlas = useCallback((shader) => {
        if (!atlas) return;
        shader.vertexShader = shader.vertexShader
            .replace("void main() {", "attribute vec2 tileUv; attribute vec4 atlasRect; varying vec2 vTileUv; varying vec4 vAtlasRect; varying vec2 vAtlasOffset;\nvoid main() {")
            .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTileUv = tileUv;\nvAtlasRect = atlasRect;\nvAtlasOffset = vUv - uv;");
        shader.fragmentShader = shader.fragmentShader
            .replace("void main() {", "varying vec2 vTileUv; varying vec4 vAtlasRect; varying vec2 vAtlasOffset;\nvoid main() {")
            .replace("#include <map_fragment>", `#ifdef USE_MAP
                vec2 repeatedUv = fract(vTileUv);
                vec2 tileEnd = (vec2(1.0) - step(vec2(0.00001), repeatedUv)) * step(vec2(0.00001), vTileUv);
                repeatedUv = mix(repeatedUv, vec2(1.0), tileEnd);
                vec2 atlasUv = mix(vAtlasRect.xy, vAtlasRect.zw, repeatedUv) + vAtlasOffset;
                vec4 sampledDiffuseColor = texture2D(map, atlasUv);
                diffuseColor *= sampledDiffuseColor;
            #endif`);
    }, [atlas]);
    return <meshStandardMaterial
        ref={ref}
        alphaTest={cutout || block?.shape === "cross" ? 0.5 : 0}
        depthWrite={atlas ? !translucent : !block?.fluid}
        emissive={emissive ? "white" : block?.emissive}
        emissiveIntensity={emissive ? 0.65 : block?.emissive ? 0.8 : block?.light ? 0.45 : 0}
        emissiveMap={emissive ? texture : null}
        map={texture ?? block?.texture}
        opacity={atlas ? 1 : materialKey === "glass" ? 0.7 : materialKey === "water" ? 0.58 : materialKey === "lava" ? 0.86 : 1}
        onBeforeCompile={tileAtlas}
        roughness={atlas ? (translucent ? 0.28 : emissive ? 0.72 : 0.9) : block?.fluid ? 0.25 : 1}
        side={cutout || block?.shape === "cross" ? DoubleSide : undefined}
        transparent={translucent || Boolean(block?.transparent)}
        vertexColors
    />;
};

function breakingParts(breaking, chunks, blockStates) {
    const definition = BLOCK_BY_ID[breaking.blockId];
    if (!definition) return [[-0.5, 0.5, -0.5, 0.5, -0.5, 0.5]];
    const state = blockStates.get(positionKey(breaking.position)) ?? {};
    if (definition.shape === "model") {
        return [rotateBounds(definition.collisionBounds ?? [-0.45, 0.45, -0.5, 0.5, -0.45, 0.45], state.facing)];
    }
    if (!isPartialShape(definition.shape)) return [[-0.5, 0.5, -0.5, 0.5, -0.5, 0.5]];
    const neighborAt = (offset) => BLOCK_BY_ID[getBlock(chunks, breaking.position.map((value, axis) => value + offset[axis]))];
    return shapeParts(definition, state, neighborAt);
}

const BreakingOverlay = ({breaking}) => {
    const chunks = useStore((state) => state.chunks);
    const blockStates = useStore((state) => state.blockStates);
    const parts = useMemo(() => breakingParts(breaking, chunks, blockStates), [breaking, blockStates, chunks]);

    return (
        <group position={breaking.position} raycast={() => null}>
            {parts.map(([minX, maxX, minY, maxY, minZ, maxZ], index) => (
                <mesh
                    key={index}
                    position={[(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]}
                    scale={[(maxX - minX) * 1.015, (maxY - minY) * 1.015, (maxZ - minZ) * 1.015]}
                >
                    <boxGeometry />
                    <meshBasicMaterial
                        color="white"
                        depthWrite={false}
                        opacity={0.15 + breaking.progress * 0.6}
                        transparent
                        wireframe
                    />
                </mesh>
            ))}
        </group>
    );
};

const Chunk = memo(({chunkKey, onPointerDown, onPointerOut}) => {
    const blockMap = useStore((state) => state.chunks.get(chunkKey));
    const revision = useStore((state) => state.chunkRevisions.get(chunkKey) ?? 0);
    const [meshData, setMeshData] = useState(EMPTY_MESH_DATA);

    useEffect(() => {
        let cancelled = false;
        const state = useStore.getState();
        const chunks = new Map(neighboringChunkKeys(chunkKey)
            .map((key) => [key, state.chunks.get(key)])
            .filter(([, chunk]) => Boolean(chunk)));

        buildChunkMeshAsync({
            chunks,
            chunkKey,
            revision,
            blockStates: state.blockStates,
            blockDefinitions: BLOCK_MESH_DEFINITIONS,
            worldSeed: state.seed,
        }).then((nextMeshData) => {
            if (!cancelled) setMeshData(nextMeshData);
        });

        return () => {
            cancelled = true;
        };
    }, [blockMap, chunkKey, revision]);

    const installed = useMemo(() => {
        const startedAt = performance.now();
        const geometries = Array.from(meshData.materials, ([materialKey, data]) => ({
            materialKey,
            geometry: createGeometry(data),
        }));
        return {geometries, installMs: performance.now() - startedAt};
    }, [meshData]);
    const geometries = installed.geometries;
    const [collisionRef] = useTrimesh(() => ({
        args: [meshData.collision.vertices, meshData.collision.indices],
        type: "Static",
    }), undefined, [meshData]);

    useEffect(() => () => {
        geometries.forEach(({geometry}) => geometry.dispose());
    }, [geometries]);
    useEffect(() => {
        registerChunkMetrics(chunkKey, meshData, installed.installMs);
        return () => unregisterChunkMetrics(chunkKey);
    }, [chunkKey, installed.installMs, meshData]);

    return (
        <group>
            {geometries.map(({materialKey, geometry}) => {
                const atlas = atlasMaterialDefinition(materialKey);
                const block = BLOCK_BY_ID[materialKey];
                return (
                    <mesh
                        key={materialKey}
                        geometry={geometry}
                        onPointerDown={onPointerDown}
                        onPointerOut={onPointerOut}
                        renderOrder={atlas?.layer === "translucent" ? 3 : atlas?.layer === "cutout" ? 1 : 0}
                    >
                        <ChunkMaterial atlas={atlas} block={block} materialKey={materialKey}/>
                    </mesh>
                );
            })}
            <mesh ref={collisionRef} visible={false} />
        </group>
    );
});

export const ChunkWorld = () => {
    const {camera} = useThree();
    const playerChunk = useStore((state) => state.playerChunk);
    const activeChunkKeys = useStore((state) => state.activeChunkKeys);
    const renderDistance = useStore((state) => state.renderDistance);
    const worldId = useStore((state) => state.worldId);
    const ensureColumns = useStore((state) => state.ensureColumns);
    const addCube = useStore((state) => state.addCube);
    const removeCube = useStore((state) => state.removeCube);
    const interactBlock = useStore((state) => state.interactBlock);
    const selectedItemAction = useStore((state) => state.applySelectedItemToBlock);
    const [breaking, setBreaking] = useState(null);
    const breakingTimer = useRef(null);
    const breakingRelease = useRef(null);

    useEffect(() => {
        ensureColumns(playerChunk[0], playerChunk[1], renderDistance);
    }, [ensureColumns, playerChunk, renderDistance, worldId]);

    const cancelBreaking = useCallback(() => {
        if (breakingRelease.current) {
            window.removeEventListener("pointerup", breakingRelease.current);
            breakingRelease.current = null;
        }
        if (breakingTimer.current !== null) {
            window.clearInterval(breakingTimer.current);
            breakingTimer.current = null;
        }
        setBreaking(null);
    }, []);

    const startBreaking = useCallback((position, blockId) => {
        const block = BLOCK_BY_ID[blockId];
        if (!block || !Number.isFinite(block.hardness)) {
            return;
        }

        cancelBreaking();
        const release = () => {
            cancelBreaking();
            interactBlock(position);
        };
        breakingRelease.current = release;
        window.addEventListener("pointerup", release, {once: true});
        const startedAt = performance.now();
        const currentState = useStore.getState();
        const duration = currentState.gameMode === "creative"
            ? MIN_BREAK_HOLD_MS
            : Math.max(MIN_BREAK_HOLD_MS, miningDuration(blockId, currentState.inventory[currentState.selectedHotbar]));
        setBreaking({position, blockId, progress: 0.05});

        breakingTimer.current = window.setInterval(() => {
            const progress = (performance.now() - startedAt) / duration;
            if (progress >= 1) {
                cancelBreaking();
                removeCube(...position);
                return;
            }
            setBreaking({position, blockId, progress});
        }, 30);
    }, [cancelBreaking, interactBlock, removeCube]);

    useEffect(() => () => cancelBreaking(), [cancelBreaking]);

    const handlePointerDown = useCallback((event) => {
        event.stopPropagation();
        if (useStore.getState().inventoryOpen || !event.face || event.distance > MAX_INTERACTION_DISTANCE) {
            return;
        }

        const normal = event.face.normal.clone();
        if (Number.isInteger(event.instanceId) && event.object.getMatrixAt) {
            const transform = new Matrix4();
            event.object.getMatrixAt(event.instanceId, transform);
            transform.premultiply(event.object.matrixWorld);
            normal.transformDirection(transform);
        } else {
            normal.transformDirection(event.object.matrixWorld);
        }

        if (event.button === 0) {
            const target = voxelFromIntersection(event.point, normal);
            const position = voxelFromIntersection(event.point, normal, true);
            if (selectedItemAction(target, position)) return;
            if (!blockIntersectsPlayer(position, camera.position.toArray())) {
                const direction = camera.getWorldDirection(new Vector3()).toArray();
                const upperHalf = normal.y < -0.5
                    || (Math.abs(normal.y) < 0.5 && event.point.y > target[1]);
                addCube(...position, facingFromDirection(direction), {half: upperHalf ? "upper" : "lower"});
            }
            return;
        }

        if (event.button === 2) {
            event.nativeEvent.preventDefault();
            const target = voxelFromIntersection(event.point, normal);
            const blockId = useStore.getState().getBlock(target);
            if (blockId) startBreaking(target, blockId);
        }
    }, [addCube, camera, selectedItemAction, startBreaking]);

    return (
        <>
            {activeChunkKeys.map((key) => (
                <Chunk
                    key={key}
                    chunkKey={key}
                    onPointerDown={handlePointerDown}
                    onPointerOut={cancelBreaking}
                />
            ))}
            <ModelObjects onPointerDown={handlePointerDown} onPointerOut={cancelBreaking}/>
            {breaking && <BreakingOverlay breaking={breaking}/>}
        </>
    );
};
