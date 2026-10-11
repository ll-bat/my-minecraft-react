import {forwardRef} from "react";
import {BoxGeometry, DoubleSide, PlaneGeometry} from "three";
import {atlasMaterialDefinition, blockAtlasEntry} from "../images/gameAssets";
import {isPartialShape, shapeParts} from "../world/blockShapes";

const FACE_NAMES = ["east", "west", "top", "bottom", "south", "north"];
const geometryCache = new Map();
const artworkGeometryCache = new Map();

function previewGeometry(block) {
    if (!block?.atlasEntries) return null;
    if (geometryCache.has(block.id)) return geometryCache.get(block.id);
    const geometry = new BoxGeometry();
    const uvs = geometry.getAttribute("uv");
    FACE_NAMES.forEach((faceName, faceIndex) => {
        const entry = blockAtlasEntry(block, faceName);
        if (!entry) return;
        const [u0, v0, u1, v1] = entry.uv;
        for (let corner = 0; corner < 4; corner += 1) {
            const index = faceIndex * 4 + corner;
            const sourceU = uvs.getX(index);
            const sourceV = uvs.getY(index);
            uvs.setXY(index, u0 + sourceU * (u1 - u0), v0 + sourceV * (v1 - v0));
        }
    });
    uvs.needsUpdate = true;
    geometryCache.set(block.id, geometry);
    return geometry;
}

const BlockMaterials = ({block, color}) => {
    const geometry = previewGeometry(block);
    return geometry ? FACE_NAMES.map((faceName, index) => {
                const entry = blockAtlasEntry(block, faceName);
                const atlas = entry ? atlasMaterialDefinition(`atlas:${entry.layer}`) : null;
                const translucent = atlas?.layer === "translucent";
                const cutout = atlas?.layer === "cutout";
                const emissive = atlas?.layer === "emissive";
                return <meshStandardMaterial
                    key={faceName}
                    attach={`material-${index}`}
                    alphaTest={cutout ? 0.5 : 0}
                    depthWrite={!translucent}
                    emissive={emissive ? "white" : block?.emissive}
                    emissiveIntensity={emissive ? 0.65 : block?.emissive ? 0.8 : 0}
                    emissiveMap={emissive ? atlas.texture : null}
                    map={atlas?.texture}
                    transparent={translucent || Boolean(block?.transparent)}
                />;
            }) : <meshStandardMaterial color={color} map={block?.texture}/>;
};

export const BlockItemMesh = forwardRef(({block, color = "white", ...props}, ref) => {
    const geometry = previewGeometry(block);
    const parts = block && isPartialShape(block.shape)
        ? shapeParts(block, {facing: "north", half: "lower"}, () => ({solid: true}))
        : [[-0.5, 0.5, -0.5, 0.5, -0.5, 0.5]];
    return (
        <group ref={ref} {...props}>
            {parts.map(([minX, maxX, minY, maxY, minZ, maxZ], index) => (
                <mesh
                    geometry={geometry ?? undefined}
                    key={index}
                    position={[(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]}
                    scale={[maxX - minX, maxY - minY, maxZ - minZ]}
                >
                    {!geometry && <boxGeometry/>}
                    <BlockMaterials block={block} color={color}/>
                </mesh>
            ))}
        </group>
    );
});

function itemGeometry(artwork) {
    if (artworkGeometryCache.has(artwork)) return artworkGeometryCache.get(artwork);
    const geometry = new PlaneGeometry();
    const uvs = geometry.getAttribute("uv");
    const [width, height] = artwork.atlasSize;
    const u0 = artwork.x / width;
    const u1 = (artwork.x + artwork.size) / width;
    const v0 = 1 - (artwork.y + artwork.size) / height;
    const v1 = 1 - artwork.y / height;
    for (let index = 0; index < 4; index += 1) {
        uvs.setXY(index, u0 + uvs.getX(index) * (u1 - u0), v0 + uvs.getY(index) * (v1 - v0));
    }
    uvs.needsUpdate = true;
    artworkGeometryCache.set(artwork, geometry);
    return geometry;
}

export const ItemArtworkMesh = forwardRef(({artwork, ...props}, ref) => (
    <mesh ref={ref} geometry={itemGeometry(artwork)} {...props}>
        <meshStandardMaterial alphaTest={0.1} map={artwork.texture} side={DoubleSide} transparent/>
    </mesh>
));
