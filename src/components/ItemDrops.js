import {useFrame} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {useStore} from "../hooks/useStore";
import {ITEM_BY_ID} from "../world/items";

const ItemDrop = ({drop}) => {
    const ref = useRef();
    const item = ITEM_BY_ID[drop.itemId];
    useFrame(({clock}) => {
        if (!ref.current) return;
        ref.current.rotation.y += 0.025;
        ref.current.position.y = drop.position[1] + Math.sin(clock.elapsedTime * 3 + drop.position[0]) * 0.08;
    });
    return (
        <mesh ref={ref} position={drop.position} raycast={() => null}>
            <boxGeometry args={[0.3, 0.3, 0.3]}/>
            <meshStandardMaterial map={item.texture} color={item.uiColor ?? "white"}/>
        </mesh>
    );
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
