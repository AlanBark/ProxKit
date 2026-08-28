/**
 * Marker for a serialized Set. JSON has no set type, and JSON.stringify turns a
 * Set into `{}` silently - which would quietly empty `skipSlots` and `pageSize`
 * on every save.
 */
interface SerializedSet {
    __type: "Set";
    values: unknown[];
}

function isSerializedSet(value: unknown): value is SerializedSet {
    return (
        typeof value === "object" && value !== null &&
        (value as SerializedSet).__type === "Set" &&
        Array.isArray((value as SerializedSet).values)
    );
}

/** An in-memory object URL, which is meaningless once the session ends. */
function isBlobSource(value: unknown): boolean {
    return (
        typeof value === "object" && value !== null &&
        (value as { kind?: unknown }).kind === "blob"
    );
}

/**
 * Settings are stored as JSON, so values that JSON cannot represent need
 * handling here rather than at each call site.
 *
 * Blob-backed image sources are dropped rather than written: they have no
 * identity beyond the session that created them, so restoring one would
 * produce a dangling reference that fails at render time. A path-backed
 * source names a real file and survives, which is exactly the distinction
 * ImageSource exists to make.
 */
export function settingsReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Set) {
        return { __type: "Set", values: [...value] } satisfies SerializedSet;
    }
    if (isBlobSource(value)) {
        return null;
    }
    return value;
}

export function settingsReviver(_key: string, value: unknown): unknown {
    return isSerializedSet(value) ? new Set(value.values) : value;
}
