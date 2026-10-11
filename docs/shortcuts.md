# Game Shortcuts

## Movement and camera

| Shortcut | Action |
| --- | --- |
| **W** | Move forward in the direction the camera is facing. |
| **S** | Move backward. |
| **A** | Move left. |
| **D** | Move right. |
| **Space** | Jump while standing on a solid block. |
| **Space while submerged** | Swim upward through water or lava. |
| **Left Shift or Right Shift while submerged** | Swim downward. |
| **Space while touching a ladder** | Climb upward. |
| **Left Shift or Right Shift while touching a ladder** | Climb downward. |
| **Mouse movement** | Look around while pointer lock is active. |
| **Click the game world** | Activate pointer lock and capture mouse movement. |
| **Escape** | Release pointer lock so the menu and hotbar can be clicked. |
| **E** | Open or close the inventory. Opening it releases pointer lock. |
| **F3** | Toggle coordinates, lighting, live frame/draw/triangle/memory measurements, mesh timings, and distance 2/4 performance profiles. |
| **M** | Open or close the explored-chunk map, compass markers, discoveries, and peaceful goals. |

## Block interaction

| Shortcut | Action |
| --- | --- |
| **Left mouse button** | Place the selected block against the targeted face or use the selected placement item. |
| **Right mouse button — short click** | Use the targeted block. Opens crafting tables, furnaces, and chests; toggles doors, trapdoors, and switches; harvests mature crops; and rests in a bed at night. |
| **Right mouse button — hold** | Break the targeted block. Matching tools break blocks faster and lose durability in survival. Bedrock cannot be broken. |
| **Place Wooden Door** | Places one coordinated structure two blocks high. Both halves open, close, and break together. Placement requires two empty vertical spaces. |
| **Place Framed Window** | Places a one-block window with a solid wooden border and transparent central pane. |
| **Place a slab or stair** | Clicking the upper half of a side or the underside of a block places an upper shape; other faces place a lower shape. Stairs face the camera direction. |
| **Place a fence, wall, or railing** | Connects automatically to compatible neighboring solid blocks, including connections across chunk boundaries. |
| **Place a beam** | Places the beam horizontally according to the camera direction. Posts remain vertical. |
| **Place furniture or decorations** | Places the selected low-poly object in one voxel. Directional furniture faces the camera direction; rugs, rocks, plants, lamps, and wall decorations retain their specialized shape. |
| **Left mouse button with a hoe** | Till the top of a dirt or grass block into farmland. |
| **Left mouse button with seeds** | Plant a crop on top of farmland. Crops grow when water is within four blocks. |
| **Right mouse button on a mature crop** | Harvest wheat and seeds, then replant the crop automatically. |
| **Right mouse button on a Dream Portal** | Travel between the Overworld and the peaceful Dream Grove. A return portal is created in a new destination. |
| **Either mouse button on a creature** | Pet and befriend the creature. Friendly interactions show hearts and may provide a gift. |

Block interaction has a maximum reach of six world units. Placement is rejected when the target position is occupied, outside the build-height limits, or intersects the player.

Creatures never cause damage and cannot be attacked. Befriended creatures follow calmly without entering the player's personal space.

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
| **Click an item in the category catalog** | Add a full stack of that item to an available inventory slot. Categories include Blocks, Windows, Doors, Utility, Nature, Fluids, Furniture, Decor, Outdoor, Materials, Tools, and Creatures. Water and Lava are in Fluids. |
| **Carry or drag a stack to Trash** | Permanently remove that stack from the inventory. It can be added again later from the category catalog. |
| **Left-click with a creature item selected** | Place a persistent friendly sheep, rabbit, or glow sprite on top of the targeted block. |
| **Click a crafting output** | Craft the matched recipe into inventory and consume one set of ingredients. |
| **Click furnace slots** | Insert smeltable input and fuel, or take completed output. |
| **Click chest slots** | Store and retrieve persistent item stacks. Chest revisions prevent a stale open interface from overwriting newer contents. |
| **Enchanting table button** | Apply Efficiency I and Durability I to the selected tool. Survival mode consumes one crystal. |

## World controls

These controls appear in the menu at the top of the game.

| Control | Action |
| --- | --- |
| **Seed field** | Enter a numeric or text seed for deterministic world generation. The field does not change the active world until **New world** is selected. |
| **New world** | Create fresh terrain from the seed field after confirmation. Unsaved world data is discarded. |
| **Save** | Save terrain changes, inventory and crafting grids, tool durability, furnace and chest contents, block orientation and power, crop updates, world time, selected hotbar slot, and player position. |
| **Regenerate** | Recreate the current seed's original terrain after confirmation, discarding unsaved block changes. |
| **Mode** | Switch between survival inventory rules and the creative item catalog. |
| **View** | Change the streamed render distance from 1 (Low) through 4 (Ultra). Distance 4 is the default. |
| **Worlds** | Create, open, duplicate, export, import, or delete isolated worlds and configure current world rules. |
| **Map** | Open the explored map, marker list, compass readout, biome discoveries, structures, and goals. |
| **Packs** | Validate and enable a version-1 JSON data pack with namespaced blocks and recipes. |

## Quick reference

```text
Move:          W A S D
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
