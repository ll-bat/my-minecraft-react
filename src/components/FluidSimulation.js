import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const FluidSimulation = () => {
    const processFluidStep = useStore((state) => state.processFluidStep);

    useEffect(() => {
        let tick = 0;
        const timer = window.setInterval(() => {
            tick += 1;
            processFluidStep(tick % 4 === 0);
        }, 100);
        return () => window.clearInterval(timer);
    }, [processFluidStep]);

    return null;
};
