jest.mock("nanoid", () => ({nanoid: () => "test-id"}));

import {act, render} from "@testing-library/react";
import {AutoSave, AUTO_SAVE_INTERVAL_MS, persistentWorldChanged} from "./AutoSave";
import {useStore} from "../hooks/useStore";
import {worldDocumentKey} from "../world/worldCatalog";

const savedDocument = () => window.localStorage.getItem(worldDocumentKey(useStore.getState().worldUid));

describe("automatic world saving", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.localStorage.clear();
        useStore.setState({
            worldUid: "world-autosave-test",
            worldName: "Autosave test",
            worldCreatedAt: 1,
            playerPosition: [0, 20, 0],
            saveStatus: "",
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test("writes changed progress after 2.5 seconds", () => {
        const view = render(<AutoSave/>);

        act(() => {
            useStore.setState({playerPosition: [12, 24, -8]});
            jest.advanceTimersByTime(AUTO_SAVE_INTERVAL_MS);
        });

        const saved = JSON.parse(savedDocument());
        expect(saved.playerPosition).toEqual([12, 24, -8]);
        expect(useStore.getState().saveStatus).toBe("Autosaved");
        view.unmount();
    });

    test("ignores interface-only changes", () => {
        const view = render(<AutoSave/>);

        act(() => {
            useStore.setState({saveStatus: "Menu changed"});
            jest.advanceTimersByTime(AUTO_SAVE_INTERVAL_MS);
        });

        expect(savedDocument()).toBeNull();
        view.unmount();
    });

    test("flushes pending progress when the page is left", () => {
        const view = render(<AutoSave/>);

        act(() => {
            useStore.setState({playerPosition: [-4, 18, 31]});
            window.dispatchEvent(new Event("pagehide"));
        });

        const saved = JSON.parse(savedDocument());
        expect(saved.playerPosition).toEqual([-4, 18, 31]);
        view.unmount();
    });

    test("recognizes persisted state references", () => {
        expect(persistentWorldChanged({chunks: new Map()}, {chunks: new Map()})).toBe(true);
        expect(persistentWorldChanged({saveStatus: "a"}, {saveStatus: "b"})).toBe(false);
    });
});
