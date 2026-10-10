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

const BlockPreview = ({block}) => {
    if (block.shape === "door") {
        return (
            <span className="item-block-preview item-door-preview">
                <TextureCanvas texture={BLOCK_BY_ID.door_top.texture}/>
                <TextureCanvas texture={block.texture}/>
            </span>
        );
    }

    return (
        <span className={`item-block-preview item-${block.shape ?? "cube"}-preview`}>
            {block.image
                ? <img src={block.image} alt=""/>
                : <TextureCanvas texture={block.texture}/>
            }
        </span>
    );
};

export const ItemIcon = ({itemId, count, durability, className = ""}) => {
    const item = ITEM_BY_ID[itemId];
    if (!item) return null;
    const block = item.blockId ? BLOCK_BY_ID[item.blockId] : null;
    return (
        <span className={`item-icon ${className}`} title={item.name}>
            {block
                ? <BlockPreview block={block}/>
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
