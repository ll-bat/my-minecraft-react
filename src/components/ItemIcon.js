import {useLayoutEffect, useRef} from "react";
import {BLOCK_BY_ID} from "../world/blocks";
import {ITEM_BY_ID} from "../world/items";

const TextureCanvas = ({texture, className = ""}) => {
    const canvasRef = useRef(null);

    useLayoutEffect(() => {
        const source = texture?.image;
        const canvas = canvasRef.current;
        if (!canvas || !source?.data || !source.width || !source.height) return;

        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext("2d");
        if (!context) return;
        const pixels = context.createImageData(source.width, source.height);
        pixels.data.set(source.data);
        context.putImageData(pixels, 0, 0);
    }, [texture]);

    return <canvas ref={canvasRef} className={className} aria-hidden="true"/>;
};

const AtlasPreview = ({preview}) => (
    <span className="atlas-item-preview">
        <img
            src={preview.source}
            alt=""
            style={{
                height: `${100 * (preview.height ?? preview.atlasSize[1]) / preview.size}%`,
                left: `${-100 * preview.x / preview.size}%`,
                top: `${-100 * preview.y / preview.size}%`,
                width: `${100 * (preview.width ?? preview.atlasSize[0]) / preview.size}%`,
            }}
        />
    </span>
);

const CubePreview = ({block}) => (
    <span className="item-cube-preview">
        <span className="item-cube-face item-cube-top"><AtlasPreview preview={block.atlasPreviews.top}/></span>
        <span className="item-cube-face item-cube-front"><AtlasPreview preview={block.atlasPreviews.north}/></span>
        <span className="item-cube-face item-cube-side"><AtlasPreview preview={block.atlasPreviews.east}/></span>
    </span>
);

const COMPOUND_PREVIEW_PARTS = {
    slab: ["slab"],
    stairs: ["stairs-base", "stairs-step"],
    fence: ["fence-post", "fence-rail-top", "fence-rail-bottom"],
    wall: ["wall-post", "wall-arm"],
    post: ["post"],
    beam: ["beam"],
    railing: ["railing-post", "railing-top", "railing-bottom"],
    torch: ["torch-stick", "torch-flame"],
    lantern: ["lantern-base", "lantern-body", "lantern-top", "lantern-handle"],
    track: ["track-rail-left", "track-rail-right", "track-tie-one", "track-tie-two"],
    elevator: ["elevator-platform"],
};

const CompoundPreview = ({block}) => (
    <span className={`item-compound-preview item-${block.shape}-preview`}>
        {COMPOUND_PREVIEW_PARTS[block.shape].map((part) => (
            <span className={`item-shape-part ${part}`} key={part}><AtlasPreview preview={block.atlasPreview}/></span>
        ))}
    </span>
);

const BlockPreview = ({block}) => {
    if (block.modelPreview) {
        return <span className="item-artwork item-model-artwork"><AtlasPreview preview={block.modelPreview}/></span>;
    }
    if (block.shape === "door") {
        return (
            <span className="item-block-preview item-door-preview">
                <AtlasPreview preview={BLOCK_BY_ID.door_top.atlasPreview}/>
                <AtlasPreview preview={block.atlasPreview}/>
            </span>
        );
    }

    if (COMPOUND_PREVIEW_PARTS[block.shape]) {
        return <span className="item-block-preview"><CompoundPreview block={block}/></span>;
    }

    if (block.atlasPreviews && !["bed", "farmland", "trapdoor", "cross", "ladder"].includes(block.shape)) {
        return <span className="item-block-preview"><CubePreview block={block}/></span>;
    }

    return (
        <span className={`item-block-preview item-${block.shape ?? "cube"}-preview`}>
            {block.atlasPreview
                ? <AtlasPreview preview={block.atlasPreview}/>
                : <TextureCanvas texture={block.texture}/>
            }
        </span>
    );
};

const TransportPreview = ({type}) => (
    <span className={`transport-preview transport-${type}`}>
        {type === "horse" && <><i className="horse-body"/><i className="horse-head"/><i className="horse-leg one"/><i className="horse-leg two"/><i className="horse-leg three"/><i className="horse-leg four"/><i className="horse-saddle"/></>}
        {type === "boat" && <><i className="boat-hull"/><i className="boat-rim left"/><i className="boat-rim right"/></>}
        {type === "minecart" && <><i className="cart-body"/><i className="cart-inside"/><i className="cart-wheel left"/><i className="cart-wheel right"/></>}
    </span>
);

export const ItemIcon = ({itemId, count, durability, className = ""}) => {
    const item = ITEM_BY_ID[itemId];
    if (!item) return null;
    const block = item.blockId ? BLOCK_BY_ID[item.blockId] : null;
    return (
        <span className={`item-icon ${className}`} title={item.name}>
            {block
                ? <BlockPreview block={block}/>
                : item.vehicleType
                    ? <TransportPreview type={item.vehicleType}/>
                : item.artwork
                    ? <span className="item-artwork"><AtlasPreview preview={item.artwork}/></span>
                    : <span className="item-swatch" style={{background: item.uiColor ?? "#777"}} />
            }
            {count > 1 && <span className="item-count">{count}</span>}
            {item.maxDurability && (
                <span className="durability-track">
                    <span style={{width: `${100 * (durability ?? item.maxDurability) / item.maxDurability}%`}}/>
                </span>
            )}
        </span>
    );
};
