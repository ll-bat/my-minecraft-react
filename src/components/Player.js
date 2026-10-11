import {useSphere} from "@react-three/cannon";
import {useFrame, useThree} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import {Vector3} from "three";
import {useKeyboard} from "../hooks/useKeyboard";
import {useStore} from "../hooks/useStore";
import {BLOCK_BY_ID} from "../world/blocks";
import {WORLD_MIN_Y} from "../world/terrain";
import {fluidMovement} from "../world/playerPhysics";

const JUMP_FORCE = 4;
const SPEED = 4;
const SPRINT_SPEED = 6.5;

export const Player = () => {
    const actions = useKeyboard();
    const {camera} = useThree();
    const spawn = useStore((state) => state.spawn);
    const worldId = useStore((state) => state.worldId);
    const setPlayerPosition = useStore((state) => state.setPlayerPosition);
    const inventoryOpen = useStore((state) => state.inventoryOpen);
    const teleportRequest = useStore((state) => state.teleportRequest);
    const [ref, api] = useSphere(() => ({
        args: [0.5],
        mass: 1,
        position: spawn,
        type: "Dynamic",
    }));
    const velocity = useRef([0, 0, 0]);
    const position = useRef(spawn);
    const lastPositionUpdate = useRef(0);
    const lastFootstep = useRef(0);
    const crouchHandled = useRef(false);

    useEffect(() => api.velocity.subscribe((value) => {
        velocity.current = value;
    }), [api.velocity]);

    useEffect(() => api.position.subscribe((value) => {
        position.current = value;
    }), [api.position]);

    useEffect(() => {
        api.position.set(...spawn);
        api.velocity.set(0, 0, 0);
        position.current = spawn;
    }, [api.position, api.velocity, spawn, worldId]);

    useEffect(() => {
        if (!teleportRequest?.position) return;
        api.position.set(...teleportRequest.position);
        api.velocity.set(0, 0, 0);
        position.current = teleportRequest.position;
    }, [api.position, api.velocity, teleportRequest]);

    useFrame(({clock}) => {
        if (position.current[1] < WORLD_MIN_Y - 10) {
            api.position.set(...spawn);
            api.velocity.set(0, 0, 0);
            position.current = spawn;
        }

        const state = useStore.getState();
        const mount = state.entities.find((entity) => entity.id === state.mountedEntityId);
        const crouching = actions.crouch && !mount;
        camera.position.fromArray(position.current);
        if (crouching) camera.position.y -= 0.22;

        const frontVector = new Vector3(
            0,
            0,
            inventoryOpen ? 0 : (actions.moveBackward ? 1 : 0) - (actions.moveForward ? 1 : 0)
        );
        const sideVector = new Vector3(
            inventoryOpen ? 0 : (actions.moveLeft ? 1 : 0) - (actions.moveRight ? 1 : 0),
            0,
            0
        );
        const minecartTrack = mount?.type === "minecart" && [Math.floor(position.current[1] - 0.2), Math.floor(position.current[1] - 0.8)]
            .some((blockY) => state.getBlock([Math.round(position.current[0]), blockY, Math.round(position.current[2])]) === "track");
        const movementSpeed = mount?.type === "horse" ? 7.5
            : mount?.type === "boat" ? 6
                : mount?.type === "minecart" ? (minecartTrack ? 8 : 2.5)
                    : actions.sprint && !crouching ? SPRINT_SPEED
                        : crouching ? 1.8 : SPEED;
        const direction = new Vector3()
            .subVectors(frontVector, sideVector)
            .normalize()
            .multiplyScalar(movementSpeed)
            .applyEuler(camera.rotation);

        const [x, y, z] = position.current;
        const fluidId = state.getBlock([
            Math.round(x),
            Math.round(y),
            Math.round(z),
        ]);
        const inFluid = fluidId === "water" || fluidId === "lava";
        const ladderId = state.getBlock([Math.round(x), Math.round(y), Math.round(z)]);
        const onLadder = ladderId === "ladder";

        if (onLadder) {
            const climb = actions.jump ? 3 : actions.crouch ? -3 : 0;
            api.velocity.set(direction.x * 0.5, climb, direction.z * 0.5);
        } else if (inFluid) {
            api.velocity.set(...fluidMovement(direction, velocity.current[1], {...actions, swimDown: actions.crouch}, fluidId));
        } else if (mount?.type === "boat") {
            api.velocity.set(direction.x, 0, direction.z);
            api.position.set(x, mount.position[1] + 0.55, z);
        } else {
            api.velocity.set(direction.x, velocity.current[1], direction.z);
        }

        const blockBelow = state.getBlock([
            Math.round(x),
            Math.floor(y - 0.01),
            Math.round(z),
        ]);
        const grounded = blockBelow && BLOCK_BY_ID[blockBelow]?.solid;
        if (!inventoryOpen && !inFluid && !onLadder && actions.jump && grounded && Math.abs(velocity.current[1]) < 0.2) {
            api.velocity.set(velocity.current[0], mount?.type === "horse" ? 5.5 : JUMP_FORCE, velocity.current[2]);
        }

        if (mount && actions.crouch && !crouchHandled.current) {
            crouchHandled.current = true;
            state.dismount();
        } else if (!actions.crouch) crouchHandled.current = false;

        const moving = Math.abs(direction.x) + Math.abs(direction.z) > 0.2;
        if (moving && (grounded || inFluid) && clock.elapsedTime - lastFootstep.current > 0.42) {
            lastFootstep.current = clock.elapsedTime;
            useStore.getState().emitSound(inFluid ? "water" : "step", blockBelow);
        }

        if (clock.elapsedTime - lastPositionUpdate.current > 0.25) {
            lastPositionUpdate.current = clock.elapsedTime;
            setPlayerPosition([...position.current]);
        }
    });

    return <mesh ref={ref} />;
};
