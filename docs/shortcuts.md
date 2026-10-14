# Game Shortcuts

## Movement and camera

| Shortcut | Action |
| --- | --- |
| **W** | Move forward in the direction the camera is facing. |
| **S** | Move backward. |
| **A** | Move left. |
| **D** | Move right. |
| **Space** | Jump while standing on a solid block. |
| **Left or Right Control while moving** | Sprint. Horses also move faster than walking speed. |
| **Left or Right Shift** | Crouch and move carefully. While riding, dismount instead. |
| **Space while submerged** | Swim upward through water or lava. |
| **Left Shift or Right Shift while submerged** | Swim downward. |
| **Space while touching a ladder** | Climb upward. |
| **Left Shift or Right Shift while touching a ladder** | Climb downward. |
| **Mouse movement** | Look around while pointer lock is active. |
| **Click the game world** | Activate pointer lock and capture mouse movement. |
| **Escape** | Release pointer lock so the menu and hotbar can be clicked. |
| **E** | Open or close the inventory. Opening it releases pointer lock. |
| **F3** | Toggle coordinates, lighting, live frame/draw/triangle/memory measurements, mesh timings, and distance 2/4 performance profiles. |
| **M** | Open or close the explored-chunk map, compass markers, discoveries, and peaceful goals. Every world includes a **Small City** marker to help you find its single generated city. |

## Block interaction

| Shortcut | Action |
| --- | --- |
| **Left mouse button** | Place the selected block against the targeted face or use the selected placement item. When a pickaxe, axe, or shovel is selected, remove the targeted block, fluid, creature, or vehicle immediately instead. |
| **Right mouse button — short click** | Use the targeted block. Opens crafting tables, furnaces, and chests; toggles doors, trapdoors, and switches; harvests mature crops; and rests in a bed at night. |
| **Right mouse button — hold** | Break the targeted block. Matching tools break blocks faster and lose durability in survival; an exhausted tool renews automatically and stays in its slot. Bedrock and unsupported solid blocks with empty space directly below cannot be broken. |
| **Place Wooden Door** | Places one coordinated structure two blocks high. Both halves open, close, and break together. Placement requires two empty vertical spaces. |
| **Place Framed Window** | Places a one-block window with a solid wooden border and transparent central pane. |
| **Place a slab or stair** | Clicking the upper half of a side or the underside of a block places an upper shape; other faces place a lower shape. Stairs face the camera direction. |
| **Place a fence, wall, or railing** | Connects automatically to compatible neighboring solid blocks, including connections across chunk boundaries. |
| **Place a beam** | Places the beam horizontally according to the camera direction. Posts remain vertical. |
| **Place furniture or decorations** | Places the selected low-poly object in one voxel. Directional furniture faces the camera direction; rugs, rocks, plants, lamps, and wall decorations retain their specialized shape. |
| **Wooden/Stone Bridge Builder — first left-click** | Select any visible face of a solid block as the bridge start. Bridge tools can target rendered terrain up to 64 blocks away. |
| **Bridge Builder — move crosshair** | Preview the complete bridge. Green means the placement is valid; red marks an invalid endpoint or blocked route. |
| **Bridge Builder — second left-click** | Build the complete bridge atomically between same-height endpoints. Bridges may run straight or diagonally, span 4–48 blocks, and require clear deck and railing space. Diagonal bridges follow a smooth block-grid approximation of the line between the selected points. |
| **Bridge Builder — right-click or Escape** | Cancel the selected bridge start without changing the world. |
| **Left mouse button with a hoe** | Till the top of a dirt or grass block into farmland. |
| **Left mouse button with seeds** | Plant a crop on top of farmland. Crops grow when water is within four blocks. |
| **Right mouse button on a mature crop** | Harvest wheat and seeds, then replant the crop automatically. |
| **Right mouse button on a Dream Portal** | Travel between the Overworld and the peaceful Dream Grove. A return portal is created in a new destination. |
| **Either mouse button on a creature without a destructive tool selected** | Pet and befriend the creature. Friendly interactions show hearts and may provide a gift. |
| **Click a villager** | Open dialogue with the named villager. View their profession, build friendship, complete a community task, or trade. |
| **Right-click a horse, rowboat, sailing ship, or minecart** | Mount it. Horses can jump, watercraft travel across connected water, and minecarts move fastest on track. Press **Shift** to dismount. |
| **Right mouse button — short click on an elevator** | Travel to the next elevator platform directly above, wrapping to the lowest platform after the top floor. |

Block interaction has a maximum reach of six world units. Placement is rejected when the target position is occupied, outside the build-height limits, or intersects the player.
Mining is rejected when removing a solid block would expose empty space directly beneath it; the game displays a safety message instead.

Creatures never cause damage. Left-clicking one with a pickaxe, axe, or shovel removes it immediately as a world-edit action; there is no combat, health-loss, or hostile response. Befriended creatures otherwise follow calmly without entering the player's personal space.

## Hotbar and inventory

| Shortcut | Action |
| --- | --- |
| **1–9** | Select the corresponding hotbar slot. |
| **Mouse wheel up** | Select the previous hotbar slot, wrapping from the first slot to the last. |
| **Mouse wheel down** | Select the next hotbar slot, wrapping from the last slot to the first. |
| **Click a hotbar slot** | Select that inventory slot directly after releasing pointer lock. |
| **Left-click an inventory slot** | Pick up, place, merge, or swap a stack. |
| **Right-click an inventory slot** | Take half a stack or place one held item. |
| **Shift-click an inventory slot** | Move the stack between the hotbar and main inventory. |
| **Drag an inventory stack** | Move or merge the stack into the destination slot. |
| **Click an item in the category catalog** | Add a full stack of that item to an available inventory slot. Categories include Blocks, Windows, Doors, Utility, Nature, Fluids, Furniture, Decor, Outdoor, Bridges, Materials, Tools, Creatures, and Transport. Water and Lava are in Fluids. |
| **Carry or drag a stack to Trash** | Permanently remove that stack from the inventory. It can be added again later from the category catalog. |
| **Left-click with a creature or transport item selected** | Place a persistent friendly creature, horse, or minecart on top of the targeted block. Rowboats and sailing ships must target water and float on its surface. |
| **Left-click water with a fish item selected** | Release one blue, orange, or pink fish into that exact water block. Fish remain in connected water and swim independently. |
| **Click a crafting output** | Craft the matched recipe into inventory and consume one set of ingredients. |
| **Click furnace slots** | Insert smeltable input and fuel, or take completed output. |
| **Click chest slots** | Store and retrieve persistent item stacks. Chest revisions prevent a stale open interface from overwriting newer contents. |
| **Enchanting table button** | Apply Efficiency I and Durability I to the selected tool. Survival mode consumes one crystal. |

## World controls

These controls appear in the menu at the top of the game.

| Control | Action |
| --- | --- |
| **Seed field** | Enter a numeric or text seed for deterministic world generation. The field does not change the active world until **New world** is selected. |
| **New world** | Permanently delete the current world's saved progress, replace it with fresh terrain from the Seed field, and immediately save the clean baseline. Other world slots remain untouched. |
| **Save** | Save immediately. The game also saves persistent progress to PostgreSQL automatically every 2.5 seconds and when the page is hidden or refreshed. On startup, the active world is restored from the backend. |
| **Regenerate** | Permanently delete the current world's saved progress, recreate its original terrain from the same seed, and immediately save the clean baseline. Other world slots remain untouched. |
| **Mode** | Switch between survival inventory rules and the creative item catalog. |
| **View** | Change the streamed render distance from 1 (Low) through 4 (Ultra), 6 (Extra), or 9 (Extra 2x). Ultra remains the default. |
| **Time** | Select Morning, Noon, Evening, or Night. Choosing a period pauses the automatic day cycle at that period; it can be enabled again in Worlds settings. |
| **Weather** | Select Sunny, Partly cloudy, Cloudy, Rainy, Snowy, or Windy. Weather also advances automatically through natural neighboring conditions every 5–10 minutes, with a gradual visual transition. A manual selection restarts that interval. |
| **Worlds** | Create, open, duplicate, export, import, or delete isolated worlds and configure current world rules. |
| **Map** | Open the explored map, marker list, compass readout, biome discoveries, structures, and goals. |
| **Packs** | Validate and enable a version-1 JSON data pack with namespaced blocks and recipes. |

## Quick reference

```text
Move:          W A S D
Sprint:        Control
Crouch/dismount: Shift
Jump/swim up:  Space
Swim down:     Shift
Climb ladder:  Space / Shift
Look:          Mouse movement
Break:         Hold right mouse button
Place:         Left mouse button
Inventory:     E
Debug:         F3
Map:           M
Select slot:   1–9 or mouse wheel
Release mouse: Escape
```
