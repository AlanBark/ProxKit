import { useEffect, useState } from "react";

interface PersistedStore {
    persist: {
        hasHydrated: () => boolean;
        onFinishHydration: (fn: () => void) => () => void;
    };
}

/**
 * Whether a persisted store has read its stored values back yet.
 *
 * The desktop backing store is async, so a store briefly holds defaults on
 * startup. Anything that treats a change as a user action - or that decides
 * whether to show first-run UI - must wait for this, or it will act on the
 * defaults-to-stored transition.
 */
export function useStoreHydrated(store: PersistedStore): boolean {
    const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated());

    useEffect(() => {
        const unsubscribe = store.persist.onFinishHydration(() => setHydrated(true));
        return () => { unsubscribe(); };
    }, [store]);

    return hydrated;
}
