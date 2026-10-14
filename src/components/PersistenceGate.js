import {useEffect, useState} from "react";
import {initializePersistence} from "../world/persistenceBootstrap";

export function PersistenceGate({children}) {
    const [status, setStatus] = useState({ready: false, error: null, attempt: 0});
    useEffect(() => {
        let active = true;
        initializePersistence()
            .then(() => active && setStatus((value) => ({...value, ready: true, error: null})))
            .catch((error) => active && setStatus((value) => ({...value, error: error.message})));
        return () => { active = false; };
    }, [status.attempt]);
    if (status.ready) return children;
    return <main className="persistence-gate">
        <h1>Loading world</h1>
        {status.error
            ? <><p>Could not reach the Minecraft world server: {status.error}</p><button onClick={() => setStatus((value) => ({ready: false, error: null, attempt: value.attempt + 1}))}>Retry</button></>
            : <p>Restoring your PostgreSQL save…</p>}
    </main>;
}
