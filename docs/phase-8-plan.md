# Phase 8 Plan: Friendly Creatures and Companionship

**Status:** Complete

Phase 8 makes the world feel inhabited without adding combat, enemies, player health, or death. Every creature is peaceful. Creatures may wander or calmly follow a befriended player, but they never attack, damage, aggressively chase, or flee from the player.

## 1. Entity framework

- Define creature types separately from entity instances.
- Store position, velocity, health metadata, animation state, heading, friendship, and chunk ownership.
- Update only creatures near the player.
- Persist creatures and spawned-column markers in the world save.

## 2. Peaceful spawning

- Spawn blocky sheep in plains and forests during the day.
- Spawn rabbits in dry and mountain terrain.
- Spawn gentle glow sprites during nighttime periods.
- Place creatures on dry terrain and keep initial spawns away from the player.

## 3. Friendly movement

- Give wild creatures deterministic idle and wandering behavior.
- Avoid solid obstacles, steep terrain, water, and lava.
- Let befriended creatures calmly follow while maintaining personal space.
- Never run away from or collide harmfully with the player.

## 4. Interaction and feedback

- Let either mouse button pet a creature within normal reach.
- Increase friendship and start a temporary follow period.
- Show floating heart feedback and a short HUD message.
- Apply an interaction cooldown without any attack or damage path.

## 5. Peaceful gifts and lifecycle

- Let a creature offer a small flower or material gift after becoming a friend.
- Preserve befriended creatures across distance and saves.
- Remove only distant temporary wild creatures when population limits require it.

## 6. Player invulnerability

- Keep the player without health, hunger, oxygen damage, combat damage, or a death state.
- Remove the remaining lava exposure respawn behavior; lava only changes movement and appearance.
- Retain below-world recovery as navigation recovery rather than death.

## 7. Validation and documentation

- Test deterministic spawning, dry spawn placement, friendly following, obstacle avoidance, cooldowns, gifts, persistence, and save migration.
- Update shortcuts, README, the roadmap, and codebase analysis.

**Milestone:** Seeded worlds contain persistent peaceful creatures that wander and become companions, with no hostile behavior and no way for the player or creatures to be hurt or killed.
