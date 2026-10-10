import {useCallback, useEffect, useState} from "react";
import {useStore} from "../hooks/useStore";
import {addStack, interactSlot} from "../world/inventory";
import {findCraftingRecipe} from "../world/crafting";
import {FUEL_TIME, SMELTING_RECIPES, SMELT_TIME} from "../world/furnaces";
import {ITEM_BY_ID, ITEM_CATEGORY_NAMES, ITEM_CATEGORY_ORDER, itemsInCategory} from "../world/items";
import {positionKey} from "../world/coordinates";
import {ItemIcon} from "./ItemIcon";

const Slot = ({stack, className = "", label, children, ...props}) => (
    <button type="button" className={`inventory-slot ${className}`} aria-label={label} {...props}>
        {children}
        {stack && <ItemIcon {...stack}/>}
    </button>
);

export const Inventory = () => {
    const open = useStore((state) => state.inventoryOpen);
    const inventory = useStore((state) => state.inventory);
    const gameMode = useStore((state) => state.gameMode);
    const station = useStore((state) => state.station);
    const stationPosition = useStore((state) => state.stationPosition);
    const playerCrafting = useStore((state) => state.playerCrafting);
    const tableCrafting = useStore((state) => state.tableCrafting);
    const blockEntities = useStore((state) => state.blockEntities);
    const toggleInventory = useStore((state) => state.toggleInventory);
    const closeInventory = useStore((state) => state.closeInventory);
    const setInventory = useStore((state) => state.setInventory);
    const setCraftingGrid = useStore((state) => state.setCraftingGrid);
    const craftItem = useStore((state) => state.craftItem);
    const setFurnaceSlots = useStore((state) => state.setFurnaceSlots);
    const setChestSlots = useStore((state) => state.setChestSlots);
    const enchantSelectedTool = useStore((state) => state.enchantSelectedTool);
    const selectedHotbar = useStore((state) => state.selectedHotbar);
    const shiftInventoryStack = useStore((state) => state.shiftInventoryStack);
    const moveInventoryStack = useStore((state) => state.moveInventoryStack);
    const addCatalogItem = useStore((state) => state.addCatalogItem);
    const removeInventorySlot = useStore((state) => state.removeInventorySlot);
    const [held, setHeld] = useState(null);
    const [pointer, setPointer] = useState([0, 0]);
    const [draggedSlot, setDraggedSlot] = useState(null);
    const [category, setCategory] = useState("blocks");

    const putBackHeld = useCallback(() => {
        if (!held) return;
        setInventory(addStack(useStore.getState().inventory, held).slots);
        setHeld(null);
    }, [held, setInventory]);

    const close = useCallback(() => {
        putBackHeld();
        closeInventory();
    }, [closeInventory, putBackHeld]);

    useEffect(() => {
        const handleKey = (event) => {
            if (event.code !== "KeyE" || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
            event.preventDefault();
            if (useStore.getState().inventoryOpen) close();
            else toggleInventory();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [close, toggleInventory]);

    useEffect(() => {
        if (open && document.pointerLockElement) document.exitPointerLock();
    }, [open]);

    if (!open) return null;

    const interactInventory = (event, index) => {
        event.preventDefault();
        if (event.shiftKey && !held) {
            shiftInventoryStack(index);
            return;
        }
        const result = interactSlot(inventory, index, held, event.button === 2);
        setInventory(result.slots);
        setHeld(result.held);
    };

    const craftingKind = station === "crafting_table" ? "table" : "player";
    const craftingGrid = craftingKind === "table" ? tableCrafting : playerCrafting;
    const craftingSize = craftingKind === "table" ? 3 : 2;
    const recipe = findCraftingRecipe(craftingGrid, craftingSize);
    const interactCrafting = (event, index) => {
        event.preventDefault();
        const result = interactSlot(craftingGrid, index, held, event.button === 2);
        setCraftingGrid(craftingKind, result.slots);
        setHeld(result.held);
    };

    const furnace = station === "furnace" && stationPosition
        ? blockEntities.get(positionKey(stationPosition))
        : null;
    const furnaceSlots = furnace ? [furnace.input, furnace.fuel, furnace.output] : [];
    const interactFurnace = (event, index) => {
        event.preventDefault();
        if (!furnace || (index === 2 && held)) return;
        if (index === 0 && held && !SMELTING_RECIPES[held.itemId]) return;
        if (index === 1 && held && !FUEL_TIME[held.itemId]) return;
        const result = interactSlot(furnaceSlots, index, held, event.button === 2);
        setFurnaceSlots(stationPosition, result.slots);
        setHeld(result.held);
    };

    const chest = station === "chest" && stationPosition
        ? blockEntities.get(positionKey(stationPosition))
        : null;
    const interactChest = (event, index) => {
        event.preventDefault();
        if (!chest) return;
        const result = interactSlot(chest.slots, index, held, event.button === 2);
        if (setChestSlots(stationPosition, result.slots, chest.revision)) setHeld(result.held);
    };

    const title = station === "crafting_table" ? "Crafting table" : station === "furnace" ? "Furnace" : station === "chest" ? "Chest" : station === "enchanting_table" ? "Enchanting table" : gameMode === "creative" ? "Creative inventory" : "Inventory";

    return (
        <div className="inventory-backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onMouseMove={(event) => setPointer([event.clientX, event.clientY])}>
            <section className="inventory-panel" aria-label="Player inventory" onContextMenu={(event) => event.preventDefault()}>
                <header>
                    <strong>{title}</strong>
                    <span>Click to move · Right-click to split · Drag or carry unwanted stacks to Trash</span>
                    <button type="button" onClick={close} aria-label="Close inventory">×</button>
                </header>

                <div className="inventory-layout">
                    <aside className="catalog-sidebar" aria-label="Item catalog">
                        <nav>{ITEM_CATEGORY_ORDER.map((id) => <button type="button" className={category === id ? "active" : ""} key={id} onClick={() => setCategory(id)}>{ITEM_CATEGORY_NAMES[id]}</button>)}</nav>
                        <div className="catalog-items">
                            {itemsInCategory(category).map((item) => <button type="button" key={item.id} title={`Add ${item.name}`} onClick={() => addCatalogItem(item.id)}><ItemIcon itemId={item.id} count={item.maxStack}/></button>)}
                        </div>
                        <button
                            type="button"
                            className="trash-slot"
                            onClick={() => setHeld(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => { if (draggedSlot !== null) removeInventorySlot(draggedSlot); setDraggedSlot(null); }}
                            title="Delete the held or dragged stack"
                        >🗑<small>Trash</small></button>
                    </aside>
                    <main className="inventory-main">

                {station === "enchanting_table" ? (
                    <div className="enchanting-interface"><ItemIcon {...(inventory[selectedHotbar] ?? {itemId: "crystal", count: 1})}/><button type="button" onClick={enchantSelectedTool}>Enchant selected tool with 1 crystal</button><small>Adds Efficiency I and Durability I</small></div>
                ) : station === "chest" ? (
                    <div className="chest-grid" aria-label="Chest inventory">
                        {(chest?.slots ?? Array(27).fill(null)).map((stack, index) => (
                            <Slot key={index} stack={stack} onClick={(event) => interactChest(event, index)} onContextMenu={(event) => interactChest(event, index)} label={`Chest slot ${index + 1}`}/>
                        ))}
                    </div>
                ) : station === "furnace" ? (
                    <div className="furnace-interface">
                        <div><small>Input</small><Slot stack={furnaceSlots[0]} onClick={(event) => interactFurnace(event, 0)} onContextMenu={(event) => interactFurnace(event, 0)} label="Furnace input"/></div>
                        <div><small>Fuel</small><Slot stack={furnaceSlots[1]} onClick={(event) => interactFurnace(event, 1)} onContextMenu={(event) => interactFurnace(event, 1)} label="Furnace fuel"/></div>
                        <div className="furnace-progress" title="Smelting progress"><span style={{width: `${100 * (furnace?.cookProgress ?? 0) / SMELT_TIME}%`}}/></div>
                        <div><small>Output</small><Slot stack={furnaceSlots[2]} onClick={(event) => interactFurnace(event, 2)} onContextMenu={(event) => interactFurnace(event, 2)} label="Furnace output"/></div>
                    </div>
                ) : (
                    <div className="crafting-interface">
                        <div className={`crafting-grid grid-${craftingSize}`}>
                            {craftingGrid.map((stack, index) => <Slot key={index} stack={stack} onClick={(event) => interactCrafting(event, index)} onContextMenu={(event) => interactCrafting(event, index)} label={`Crafting slot ${index + 1}`}/>)}
                        </div>
                        <span className="crafting-arrow">→</span>
                        <Slot stack={recipe?.result} className="crafting-output" onClick={() => craftItem(craftingKind)} label={recipe ? `Craft ${ITEM_BY_ID[recipe.result.itemId].name}` : "No matching recipe"}/>
                    </div>
                )}

                <div className="inventory-grid">
                    {inventory.map((stack, index) => (
                        <Slot
                            stack={stack}
                            className={index < 9 ? "hotbar-row" : ""}
                            key={index}
                            onClick={(event) => { if (draggedSlot === null) interactInventory(event, index); }}
                            onContextMenu={(event) => interactInventory(event, index)}
                            draggable={Boolean(stack) && !held}
                            onDragStart={() => setDraggedSlot(index)}
                            onDragEnd={() => setDraggedSlot(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => { if (draggedSlot !== null) moveInventoryStack(draggedSlot, index); }}
                            label={stack ? `${stack.count} ${stack.itemId}` : `Empty slot ${index + 1}`}
                        >{index < 9 && <span className="inventory-key">{index + 1}</span>}</Slot>
                    ))}
                </div>
                    </main>
                </div>
            </section>
            {held && <div className="held-item" style={{left: pointer[0], top: pointer[1]}}><ItemIcon {...held}/></div>}
        </div>
    );
};
