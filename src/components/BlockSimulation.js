import {useEffect} from "react";
import {useStore} from "../hooks/useStore";

export const BlockSimulation = () => {
    const processScheduledUpdates = useStore((state) => state.processScheduledUpdates);
    useEffect(() => {
        const timer = window.setInterval(() => processScheduledUpdates(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [processScheduledUpdates]);
    return null;
};
