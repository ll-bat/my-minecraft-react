import {useFrame} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {useStore} from "../hooks/useStore";
import {ITEM_BY_ID} from "../world/items";
import {BLOCK_BY_ID} from "../world/blocks";
import {BlockItemMesh, ItemArtworkMesh} from "./BlockItemMesh";
import {ModelItemMesh} from "./ModelObjects";

const ItemDrop = ({drop}) => {
    const ref = useRef();
    const item = ITEM_BY_ID[drop.itemId];
    const block = item.blockId ? BLOCK_BY_ID[item.blockId] : null;
    useFrame(({clock}) => {
        if (!ref.current) return;
        ref.current.rotation.y += 0.025;
        ref.current.position.y = drop.position[1] + Math.sin(clock.elapsedTime * 3 + drop.position[0]) * 0.08;
    });
    const shared = {position: drop.position, raycast: () => null, scale: 0.3};
    if (block?.modelUrl) return <ModelItemMesh ref={ref} block={block} {...shared}/>;
    return block || !item.artwork
        ? <BlockItemMesh ref={ref} block={block} color={item.uiColor ?? "white"} {...shared}/>
        : <ItemArtworkMesh ref={ref} artwork={item.artwork} {...shared}/>;
};

export const ItemDrops = () => {
    const drops = useStore((state) => state.drops);
    const updateDrops = useStore((state) => state.updateDrops);
    useEffect(() => {
        const timer = window.setInterval(() => updateDrops(), 100);
        return () => window.clearInterval(timer);
    }, [updateDrops]);
    return drops.map((drop) => <ItemDrop key={drop.id} drop={drop}/>);
};
