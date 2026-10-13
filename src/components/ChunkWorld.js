import {useTrimesh} from "@react-three/cannon";
import {useFrame, useThree} from "@react-three/fiber";
import {memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3} from "three";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {voxelFromIntersection} from "../world/chunkGeometry";
import {CHUNK_SIZE, chunkCoordinate, getBlock, meshingChunkNeighborhood, parseChunkKey} from "../world/chunks";
import {blockIntersectsPlayer, MAX_INTERACTION_DISTANCE, positionKey} from "../world/coordinates";
import {isPartialShape, rotateBounds, shapeParts} from "../world/blockShapes";
import {miningDuration} from "../world/mining";
import {facingFromDirection} from "../world/interactions";
import {buildChunkMeshAsync} from "../world/meshStreaming";
import {atlasMaterialDefinition} from "../images/gameAssets";
import {ModelObjects} from "./ModelObjects";
import {registerChunkMetrics, unregisterChunkMetrics} from "../world/renderMetrics";
import {BRIDGE_INTERACTION_DISTANCE, planBridge} from "../world/bridges";
import {ITEM_BY_ID} from "../world/items";

const MIN_BREAK_HOLD_MS = 450;
const BRIDGE_CHUNK_REACH = Math.ceil(BRIDGE_INTERACTION_DISTANCE / CHUNK_SIZE) + 1;
const BRIDGE_PREVIEW_CAPACITY = 512;
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
    const materials = useRef([]);
    const parts = useMemo(() => breakingParts(breaking, chunks, blockStates), [breaking, blockStates, chunks]);
    useFrame(() => {
        const progress = Math.min(1, (performance.now() - breaking.startedAt) / breaking.duration);
        materials.current.forEach((material) => {
            if (material) material.opacity = 0.15 + progress * 0.6;
        });
    });

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
                        ref={(material) => { materials.current[index] = material; }}
                        color="white"
                        depthWrite={false}
                        opacity={0.15}
                        transparent
                        wireframe
                    />
                </mesh>
            ))}
        </group>
    );
};

const ChunkCollision = ({collision, token}) => {
    const markChunkCollisionReady = useStore((state) => state.markChunkCollisionReady);
    const [collisionRef] = useTrimesh(() => ({
        args: [collision.vertices, collision.indices],
        type: "Static",
    }), undefined, [collision]);
    useEffect(() => {
        markChunkCollisionReady(token, true);
        return () => markChunkCollisionReady(token, false);
    }, [collision, markChunkCollisionReady, token]);
    return <mesh ref={collisionRef} visible={false}/>;
};

const Chunk = memo(({chunkKey, collisionEnabled, collisionToken, interactive, onPointerDown, onPointerMove, onPointerOut}) => {
    const blockMap = useStore((state) => state.chunks.get(chunkKey));
    const revision = useStore((state) => state.chunkRevisions.get(chunkKey) ?? 0);
    const [meshData, setMeshData] = useState(EMPTY_MESH_DATA);

    useEffect(() => {
        let cancelled = false;
        const state = useStore.getState();
        const chunks = meshingChunkNeighborhood(state.chunks, chunkKey);

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
                        onPointerDown={interactive ? onPointerDown : undefined}
                        onPointerMove={interactive ? onPointerMove : undefined}
                        onPointerOut={interactive ? onPointerOut : undefined}
                        renderOrder={atlas?.layer === "translucent" ? 3 : atlas?.layer === "cutout" ? 1 : 0}
                    >
                        <ChunkMaterial atlas={atlas} block={block} materialKey={materialKey}/>
                    </mesh>
                );
            })}
            {collisionEnabled && meshData !== EMPTY_MESH_DATA
                && <ChunkCollision collision={meshData.collision} token={collisionToken}/>}
        </group>
    );
});

const BridgePreviewBatch = ({placements, color, scale}) => {
    const mesh = useMemo(() => {
        const geometry = new BoxGeometry();
        const material = new MeshBasicMaterial({
            color: "white",
            opacity: 0.34,
            transparent: true,
            depthWrite: false,
        });
        const instance = new InstancedMesh(geometry, material, BRIDGE_PREVIEW_CAPACITY);
        instance.count = 0;
        instance.frustumCulled = false;
        instance.raycast = () => null;
        return instance;
    }, []);
    useEffect(() => () => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.dispose();
    }, [mesh]);
    useLayoutEffect(() => {
        mesh.material.color.set(color);
        placements.forEach(({position}, index) => {
            const matrix = new Matrix4().makeScale(...scale);
            matrix.setPosition(...position);
            mesh.setMatrixAt(index, matrix);
        });
        mesh.count = placements.length;
        mesh.instanceMatrix.needsUpdate = true;
    }, [color, mesh, placements, scale]);
    return <primitive object={mesh}/>;
};

const BridgePreview = ({anchor, hover, chunks}) => {
    const plan = useMemo(() => anchor && hover
        ? planBridge(chunks, anchor.position, hover, anchor.style)
        : null, [anchor, chunks, hover]);
    const color = plan?.ok ? "#63e67d" : "#ef5d62";
    const axis = plan?.axis;
    const batches = useMemo(() => {
        const grouped = {deck: [], railing: [], support: [], lantern: []};
        (plan?.placements ?? []).forEach((placement) => grouped[placement.role]?.push(placement));
        return [
            {role: "deck", placements: grouped.deck, scale: [0.96, 0.96, 0.96]},
            {
                role: "railing",
                placements: grouped.railing,
                scale: axis === "x" ? [0.92, 0.72, 0.16]
                    : axis === "z" ? [0.16, 0.72, 0.92] : [0.42, 0.72, 0.42],
            },
            {role: "support", placements: grouped.support, scale: [0.28, 0.96, 0.28]},
            {role: "lantern", placements: grouped.lantern, scale: [0.32, 0.48, 0.32]},
        ];
    }, [axis, plan]);
    if (!anchor) return null;
    return <group raycast={() => null}>
        <mesh position={[anchor.position[0], anchor.position[1] + 0.54, anchor.position[2]]} scale={[1.08, 0.08, 1.08]} raycast={() => null}>
            <boxGeometry/><meshBasicMaterial color="#ffd45c" opacity={0.72} transparent depthWrite={false}/>
        </mesh>
        {hover && <mesh position={[hover[0], hover[1] + 0.56, hover[2]]} scale={[1.04, 0.12, 1.04]} raycast={() => null}>
            <boxGeometry/><meshBasicMaterial color={color} opacity={0.7} transparent depthWrite={false}/>
        </mesh>}
        {batches.map((batch) => <BridgePreviewBatch key={batch.role} {...batch} color={color}/>)}
    </group>;
};

export const ChunkWorld = () => {
    const {camera} = useThree();
    const playerChunk = useStore((state) => state.playerChunk);
    const playerChunkY = useStore((state) => chunkCoordinate(state.playerPosition[1]));
    const activeChunkKeys = useStore((state) => state.activeChunkKeys);
    const renderDistance = useStore((state) => state.renderDistance);
    const worldId = useStore((state) => state.worldId);
    const ensureColumns = useStore((state) => state.ensureColumns);
    const addCube = useStore((state) => state.addCube);
    const removeCubeSafely = useStore((state) => state.removeCubeSafely);
    const destroyBlockWithSelectedTool = useStore((state) => state.destroyBlockWithSelectedTool);
    const interactBlock = useStore((state) => state.interactBlock);
    const selectedItemAction = useStore((state) => state.applySelectedItemToBlock);
    const bridgeAnchor = useStore((state) => state.bridgeAnchor);
    const bridgeChunks = useStore((state) => state.bridgeAnchor ? state.chunks : null);
    const bridgeStyle = useStore((state) => {
        const stack = state.inventory[state.selectedHotbar];
        return stack ? ITEM_BY_ID[stack.itemId]?.bridgeStyle ?? null : null;
    });
    const selectBridgeEndpoint = useStore((state) => state.selectBridgeEndpoint);
    const cancelBridge = useStore((state) => state.cancelBridge);
    const [breaking, setBreaking] = useState(null);
    const [bridgeHover, setBridgeHover] = useState(null);
    const [collisionChunkKeys, setCollisionChunkKeys] = useState(() => new Set());
    const breakingTimer = useRef(null);
    const breakingRelease = useRef(null);

    useEffect(() => {
        ensureColumns(playerChunk[0], playerChunk[1], renderDistance);
    }, [ensureColumns, playerChunk, renderDistance, worldId]);

    const collisionCandidates = useMemo(() => activeChunkKeys
        .filter((key) => {
            const [chunkX, chunkY, chunkZ] = parseChunkKey(key);
            return Math.max(
                Math.abs(chunkX - playerChunk[0]),
                Math.abs(chunkZ - playerChunk[1])
            ) <= 2 && Math.abs(chunkY - playerChunkY) <= 2;
        })
        .sort((left, right) => {
            const distance = (key) => {
                const [x, y, z] = parseChunkKey(key);
                return Math.max(Math.abs(x - playerChunk[0]), Math.abs(z - playerChunk[1])) * 10
                    + Math.abs(y - playerChunkY);
            };
            return distance(left) - distance(right);
        }), [activeChunkKeys, playerChunk, playerChunkY]);

    useEffect(() => {
        let cancelled = false;
        let frame = null;
        const desired = new Set(collisionCandidates);
        let installed = collisionChunkKeys;
        setCollisionChunkKeys((current) => {
            const retained = new Set(Array.from(current).filter((key) => desired.has(key)));
            installed = retained;
            return retained;
        });
        const pending = collisionCandidates.filter((key) => !installed.has(key));
        const installNext = () => {
            if (cancelled) return;
            const key = pending.shift();
            if (!key) return;
            setCollisionChunkKeys((current) => new Set(current).add(key));
            frame = window.requestAnimationFrame(installNext);
        };
        installNext();
        return () => {
            cancelled = true;
            if (frame !== null) window.cancelAnimationFrame(frame);
        };
    // The current set is read once to seed this reconciliation; including it
    // would restart the queue after every progressively installed body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collisionCandidates]);

    const cancelBreaking = useCallback(() => {
        if (breakingRelease.current) {
            window.removeEventListener("pointerup", breakingRelease.current);
            breakingRelease.current = null;
        }
        if (breakingTimer.current !== null) {
            window.clearTimeout(breakingTimer.current);
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
        setBreaking({position, blockId, startedAt, duration});

        breakingTimer.current = window.setTimeout(() => {
            cancelBreaking();
            removeCubeSafely(...position);
        }, duration);
    }, [cancelBreaking, interactBlock, removeCubeSafely]);

    useEffect(() => () => cancelBreaking(), [cancelBreaking]);

    useEffect(() => {
        if (!bridgeStyle) setBridgeHover(null);
    }, [bridgeStyle]);

    useEffect(() => {
        const cancel = (event) => {
            if (event.code === "Escape" && useStore.getState().bridgeAnchor) cancelBridge();
        };
        document.addEventListener("keydown", cancel);
        return () => document.removeEventListener("keydown", cancel);
    }, [cancelBridge]);

    const eventNormal = useCallback((event) => {
        const normal = event.face.normal.clone();
        if (Number.isInteger(event.instanceId) && event.object.getMatrixAt) {
            const transform = new Matrix4();
            event.object.getMatrixAt(event.instanceId, transform);
            transform.premultiply(event.object.matrixWorld);
            normal.transformDirection(transform);
        } else {
            normal.transformDirection(event.object.matrixWorld);
        }
        return normal;
    }, []);

    const handlePointerMove = useCallback((event) => {
        if (!bridgeStyle || !event.face || event.distance > BRIDGE_INTERACTION_DISTANCE) return;
        const normal = eventNormal(event);
        const nextHover = voxelFromIntersection(event.point, normal);
        setBridgeHover((current) => current?.every((value, axis) => value === nextHover[axis]) ? current : nextHover);
    }, [bridgeStyle, eventNormal]);

    const handlePointerDown = useCallback((event) => {
        event.stopPropagation();
        const interactionDistance = bridgeStyle ? BRIDGE_INTERACTION_DISTANCE : MAX_INTERACTION_DISTANCE;
        if (useStore.getState().inventoryOpen || !event.face || event.distance > interactionDistance) {
            return;
        }

        const normal = eventNormal(event);
        const target = voxelFromIntersection(event.point, normal);
        if (bridgeStyle) {
            event.nativeEvent?.preventDefault();
            if (event.button === 2) {
                cancelBridge();
                return;
            }
            if (event.button !== 0) return;
            selectBridgeEndpoint(target, bridgeStyle);
            setBridgeHover(target);
            return;
        }

        if (event.button === 0) {
            const position = voxelFromIntersection(event.point, normal, true);
            if (destroyBlockWithSelectedTool(...target)) return;
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
            const blockId = useStore.getState().getBlock(target);
            if (blockId) startBreaking(target, blockId);
        }
    }, [addCube, bridgeStyle, camera, cancelBridge, destroyBlockWithSelectedTool, eventNormal, selectBridgeEndpoint, selectedItemAction, startBreaking]);

    return (
        <>
            {activeChunkKeys.map((key) => {
                const [chunkX, chunkY, chunkZ] = parseChunkKey(key);
                const horizontalDistance = Math.max(
                    Math.abs(chunkX - playerChunk[0]),
                    Math.abs(chunkZ - playerChunk[1])
                );
                const verticalDistance = Math.abs(chunkY - playerChunkY);
                const interactive = bridgeStyle
                    ? horizontalDistance <= BRIDGE_CHUNK_REACH && verticalDistance <= BRIDGE_CHUNK_REACH
                    : horizontalDistance <= 1 && verticalDistance <= 1;
                return <Chunk
                    key={key}
                    chunkKey={key}
                    collisionEnabled={collisionChunkKeys.has(key)}
                    collisionToken={`${worldId}:${key}`}
                    interactive={interactive}
                    onPointerDown={interactive ? handlePointerDown : undefined}
                    onPointerMove={interactive ? handlePointerMove : undefined}
                    onPointerOut={interactive ? cancelBreaking : undefined}
                />;
            })}
            <ModelObjects onPointerDown={handlePointerDown} onPointerOut={cancelBreaking}/>
            {breaking && <BreakingOverlay breaking={breaking}/>}
            <BridgePreview anchor={bridgeAnchor} hover={bridgeHover} chunks={bridgeChunks}/>
        </>
    );
};
