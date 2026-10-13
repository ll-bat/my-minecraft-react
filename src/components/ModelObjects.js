import {useLayoutEffect, useMemo, useState, useEffect, forwardRef, useRef} from "react";
import {Color, Euler, Matrix4, Quaternion, Vector3} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {indexToLocal, parseChunkKey, worldPosition} from "../world/chunks";
import {positionKey} from "../world/coordinates";
import {registerModelMetrics, unregisterModelMetrics} from "../world/renderMetrics";

const modelCache = new Map();
const chunkModelCache = new WeakMap();
const FACING_ANGLE = {north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2};

export function loadModelAsset(url) {
    if (!modelCache.has(url)) {
        modelCache.set(url, new Promise((resolve, reject) => {
            new GLTFLoader().load(url, (gltf) => {
                let source = null;
                gltf.scene.traverse((object) => {
                    if (!source && object.isMesh) source = object;
                });
                if (!source) reject(new Error(`Model contains no mesh: ${url}`));
                else resolve({geometry: source.geometry, material: source.material});
            }, undefined, reject);
        }));
    }
    return modelCache.get(url);
}

function useModel(url) {
    const [asset, setAsset] = useState(null);
    useEffect(() => {
        let active = true;
        loadModelAsset(url).then((loaded) => { if (active) setAsset(loaded); }).catch(() => {});
        return () => { active = false; };
    }, [url]);
    return asset;
}

function modelMaterial(asset, block) {
    if (!asset) return null;
    const material = asset.material.clone();
    material.vertexColors = true;
    if (block.emissive) {
        material.emissive = new Color(block.emissive);
        material.emissiveIntensity = 0.45;
    }
    return material;
}

function modelsInChunk(chunkMap, chunk) {
    const cached = chunkModelCache.get(chunkMap);
    if (cached) return cached;
    const models = [];
    chunkMap.forEach((blockId, index) => {
        if (!BLOCK_BY_ID[blockId]?.modelId) return;
        models.push({blockId, position: worldPosition(chunk, indexToLocal(index))});
    });
    chunkModelCache.set(chunkMap, models);
    return models;
}

const ModelBatch = ({block, instances, onPointerDown, onPointerOut}) => {
    const ref = useRef();
    const asset = useModel(block.modelUrl);
    const material = useMemo(() => modelMaterial(asset, block), [asset, block]);

    useLayoutEffect(() => {
        if (!ref.current) return;
        const matrix = new Matrix4();
        const quaternion = new Quaternion();
        const scale = new Vector3(...(block.modelScale ?? [1, 1, 1]));
        instances.forEach(({position, facing}, index) => {
            quaternion.setFromEuler(new Euler(0, FACING_ANGLE[facing] ?? 0, 0));
            matrix.compose(new Vector3(...position), quaternion, scale);
            ref.current.setMatrixAt(index, matrix);
        });
        ref.current.instanceMatrix.needsUpdate = true;
    }, [instances, asset, block.modelScale]);

    useEffect(() => () => material?.dispose(), [material]);
    useEffect(() => {
        if (!asset || instances.length === 0) return undefined;
        registerModelMetrics(block.id, block.modelCategory, asset.geometry, instances.length);
        return () => unregisterModelMetrics(block.id);
    }, [asset, block.id, block.modelCategory, instances.length]);
    if (!asset || !material || instances.length === 0) return null;
    return (
        <instancedMesh
            args={[asset.geometry, material, instances.length]}
            frustumCulled={false}
            onPointerDown={onPointerDown}
            onPointerOut={onPointerOut}
            ref={ref}
        />
    );
};

export const ModelObjects = ({onPointerDown, onPointerOut}) => {
    const activeChunkKeys = useStore((state) => state.activeChunkKeys);
    const modelRevision = useStore((state) => state.modelRevision);
    const playerChunk = useStore((state) => state.playerChunk);
    const renderDistance = useStore((state) => state.renderDistance);
    const batches = useMemo(() => {
        if (!Number.isFinite(modelRevision)) return new Map();
        const {chunks, blockStates} = useStore.getState();
        const grouped = new Map();
        const modelDistance = renderDistance >= 6 ? 4 : renderDistance;
        activeChunkKeys.forEach((key) => {
            const chunkMap = chunks.get(key);
            if (!chunkMap) return;
            const chunk = parseChunkKey(key);
            if (Math.max(Math.abs(chunk[0] - playerChunk[0]), Math.abs(chunk[2] - playerChunk[1])) > modelDistance) return;
            modelsInChunk(chunkMap, chunk).forEach(({blockId, position}) => {
                const state = blockStates.get(positionKey(position)) ?? {};
                const entries = grouped.get(blockId) ?? [];
                entries.push({position, facing: state.facing ?? "north"});
                grouped.set(blockId, entries);
            });
        });
        return grouped;
    }, [activeChunkKeys, modelRevision, playerChunk, renderDistance]);

    return Array.from(batches, ([blockId, instances]) => (
        <ModelBatch
            block={BLOCK_BY_ID[blockId]}
            instances={instances}
            key={blockId}
            onPointerDown={onPointerDown}
            onPointerOut={onPointerOut}
        />
    ));
};

export const ModelItemMesh = forwardRef(({block, ...props}, ref) => {
    const asset = useModel(block.modelUrl);
    const material = useMemo(() => modelMaterial(asset, block), [asset, block]);
    useEffect(() => () => material?.dispose(), [material]);
    if (!asset || !material) return null;
    return <group ref={ref} {...props}><mesh geometry={asset.geometry} material={material} scale={block.modelScale ?? [1, 1, 1]}/></group>;
});

