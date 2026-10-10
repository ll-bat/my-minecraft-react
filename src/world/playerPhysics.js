export function fluidMovement(direction, verticalVelocity, actions, fluidId) {
    if (fluidId !== "water" && fluidId !== "lava") {
        return null;
    }

    const speedMultiplier = fluidId === "water" ? 0.55 : 0.35;
    const vertical = actions.jump
        ? 2.4
        : actions.swimDown
            ? -2
            : Math.max(-1.25, Math.min(1.25, verticalVelocity * 0.8));

    return [direction.x * speedMultiplier, vertical, direction.z * speedMultiplier];
}
