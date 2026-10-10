import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const FurnaceSimulation = () => {
    const processFurnaces = useStore((state) => state.processFurnaces);
    useEffect(() => {
        const timer = window.setInterval(() => processFurnaces(), 250);
        return () => window.clearInterval(timer);
    }, [processFurnaces]);
    return null;
};
