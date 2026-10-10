import {useTrimesh} from "@react-three/cannon";
import {useThree} from "@react-three/fiber";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {BufferGeometry, DoubleSide, Float32BufferAttribute, Vector3} from "three";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {voxelFromIntersection} from "../world/chunkGeometry";
import {neighboringChunkKeys} from "../world/chunks";
import {blockIntersectsPlayer, MAX_INTERACTION_DISTANCE} from "../world/coordinates";
import {miningDuration} from "../world/mining";
import {facingFromDirection} from "../world/interactions";
import {buildChunkMeshAsync} from "../world/meshStreaming";

const MIN_BREAK_HOLD_MS = 450;
const BLOCK_MESH_DEFINITIONS = Object.fromEntries(Object.values(BLOCK_BY_ID).map((block) => [
    block.id,
    {
        fluid: Boolean(block.fluid),
        shape: block.shape,
        solid: Boolean(block.solid),
        transparent: Boolean(block.transparent),
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
    geometry.computeBoundingSphere();
    return geometry;
}

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
        }).then((nextMeshData) => {
            if (!cancelled) setMeshData(nextMeshData);
        });

        return () => {
            cancelled = true;
        };
    }, [blockMap, chunkKey, revision]);

    const geometries = useMemo(() => (
        Array.from(meshData.materials, ([blockId, data]) => ({
            blockId,
            geometry: createGeometry(data),
        }))
    ), [meshData]);
    const [collisionRef] = useTrimesh(() => ({
        args: [meshData.collision.vertices, meshData.collision.indices],
        type: "Static",
    }), undefined, [meshData]);

    useEffect(() => () => {
        geometries.forEach(({geometry}) => geometry.dispose());
    }, [geometries]);

    return (
        <group>
            {geometries.map(({blockId, geometry}) => {
                const block = BLOCK_BY_ID[blockId];
                return (
                    <mesh
                        key={blockId}
                        geometry={geometry}
                        onPointerDown={onPointerDown}
                        onPointerOut={onPointerOut}
                    >
                        <meshStandardMaterial
                            alphaTest={block.shape === "cross" ? 0.5 : 0}
                            depthWrite={!block.fluid}
                            emissive={block.emissive}
                            emissiveIntensity={block.emissive ? 0.8 : block.light ? 0.45 : 0}
                            map={block.texture}
                            opacity={blockId === "glass" ? 0.7 : blockId === "water" ? 0.58 : blockId === "lava" ? 0.86 : 1}
                            roughness={block.fluid ? 0.25 : 1}
                            side={block.shape === "cross" ? DoubleSide : undefined}
                            transparent={Boolean(block.transparent)}
                        />
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
        setBreaking({position, progress: 0.05});

        breakingTimer.current = window.setInterval(() => {
            const progress = (performance.now() - startedAt) / duration;
            if (progress >= 1) {
                cancelBreaking();
                removeCube(...position);
                return;
            }
            setBreaking({position, progress});
        }, 30);
    }, [cancelBreaking, interactBlock, removeCube]);

    useEffect(() => () => cancelBreaking(), [cancelBreaking]);

    const handlePointerDown = useCallback((event) => {
        event.stopPropagation();
        if (useStore.getState().inventoryOpen || !event.face || event.distance > MAX_INTERACTION_DISTANCE) {
            return;
        }

        if (event.button === 0) {
            const target = voxelFromIntersection(event.point, event.face.normal);
            const position = voxelFromIntersection(event.point, event.face.normal, true);
            if (selectedItemAction(target, position)) return;
            if (!blockIntersectsPlayer(position, camera.position.toArray())) {
                const direction = camera.getWorldDirection(new Vector3()).toArray();
                addCube(...position, facingFromDirection(direction));
            }
            return;
        }

        if (event.button === 2) {
            event.nativeEvent.preventDefault();
            const target = voxelFromIntersection(event.point, event.face.normal);
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
            {breaking && (
                <mesh position={breaking.position} raycast={() => null} scale={1.01}>
                    <boxGeometry />
                    <meshBasicMaterial
                        color="white"
                        opacity={0.15 + breaking.progress * 0.6}
                        transparent
                        wireframe
                    />
                </mesh>
            )}
        </>
    );
};
