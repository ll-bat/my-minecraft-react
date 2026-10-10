import {useEffect} from "react";
import {useStore} from "../hooks/useStore";
import {HOTBAR_SIZE} from "../world/inventory";
import {ItemIcon} from "./ItemIcon";

export const TextureSelector = () => {
    const inventory = useStore((state) => state.inventory);
    const selectedHotbar = useStore((state) => state.selectedHotbar);
    const inventoryOpen = useStore((state) => state.inventoryOpen);
    const selectHotbar = useStore((state) => state.selectHotbar);

    useEffect(() => {
        const selectByNumber = (event) => {
            const slot = Number(event.key) - 1;
            if (!inventoryOpen && slot >= 0 && slot < HOTBAR_SIZE) {
                selectHotbar(slot);
            }
        };

        const selectByWheel = (event) => {
            event.preventDefault();
            if (inventoryOpen) return;
            const direction = event.deltaY > 0 ? 1 : -1;
            const nextIndex = (selectedHotbar + direction + HOTBAR_SIZE) % HOTBAR_SIZE;
            selectHotbar(nextIndex);
        };

        document.addEventListener("keydown", selectByNumber);
        document.addEventListener("wheel", selectByWheel, {passive: false});
        return () => {
            document.removeEventListener("keydown", selectByNumber);
            document.removeEventListener("wheel", selectByWheel);
        };
    }, [inventoryOpen, selectHotbar, selectedHotbar]);

    return (
        <div className="hotbar" aria-label="Block selection" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            {inventory.slice(0, HOTBAR_SIZE).map((stack, index) => (
                <button
                    type="button"
                    key={index}
                    className={`hotbar-slot ${selectedHotbar === index ? "active" : ""}`}
                    onClick={() => selectHotbar(index)}
                    title={`${index + 1}: ${stack?.itemId ?? "Empty"}`}
                    aria-label={`Select hotbar slot ${index + 1}`}
                    aria-pressed={selectedHotbar === index}
                >
                    <span className="hotbar-key">{index + 1}</span>
                    {stack && <ItemIcon {...stack}/>}
                </button>
            ))}
        </div>
    );
};
