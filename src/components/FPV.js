import {useThree} from "@react-three/fiber";
import {PointerLockControls} from "@react-three/drei";
import {useStore} from "../hooks/useStore";

export const FPV = () => {
    const {camera, gl} = useThree()
    const inventoryOpen = useStore((state) => state.inventoryOpen);
    const mapOpen = useStore((state) => state.mapOpen);
    const worldManagerOpen = useStore((state) => state.worldManagerOpen);
    const packsOpen = useStore((state) => state.packsOpen);
    const villagerPanelId = useStore((state) => state.villagerPanelId);

    if (inventoryOpen || mapOpen || worldManagerOpen || packsOpen || villagerPanelId) return null;
    return (<PointerLockControls args={[camera, gl.domElement]} /> )
}
