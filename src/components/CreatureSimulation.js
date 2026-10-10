import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const CreatureSimulation = () => {
    const updateCreatures = useStore((state) => state.updateCreatures);
    useEffect(() => {
        const timer = window.setInterval(() => updateCreatures(Date.now(), 0.2), 200);
        return () => window.clearInterval(timer);
    }, [updateCreatures]);
    return null;
};
