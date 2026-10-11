import {useFrame, useThree} from "@react-three/fiber";
import {useRef} from "react";
import {useStore} from "../hooks/useStore";
import {renderingMetrics} from "../world/renderMetrics";

export const RenderingDiagnostics = () => {
    const {gl} = useThree();
    const samples = useRef([]);
    const elapsed = useRef(0);

    useFrame((_, delta) => {
        samples.current.push(delta * 1000);
        if (samples.current.length > 120) samples.current.shift();
        elapsed.current += delta;
        if (elapsed.current < 0.5) return;
        elapsed.current = 0;
        const state = useStore.getState();
        useStore.setState({renderMetrics: renderingMetrics(gl, samples.current, state.renderDistance)});
    });
    return null;
};
