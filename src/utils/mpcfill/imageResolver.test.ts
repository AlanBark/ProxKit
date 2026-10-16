// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDriveImages } from "./imageResolver";
import { fetchIntoLibrary } from "../library";
import { downloadMultipleImages } from "./driveDownloader";
import type { ImageSource } from "../../types/card";

vi.mock("../library", () => ({
    isLibraryAvailable: (folder: string | null) => folder !== null,
    fetchIntoLibrary: vi.fn(),
}));

vi.mock("./driveDownloader", () => ({
    downloadMultipleImages: vi.fn(),
}));

const requests = ["island", "forest", "island", "island"].map(id => ({ id, name: `${id}.jpg` }));

async function resolveAll(libraryFolder: string | null) {
    const resolved: { index: number; source: ImageSource }[] = [];
    const rejected: number[] = [];
    await resolveDriveImages(
        requests,
        libraryFolder,
        (source, _id, index) => resolved.push({ index, source }),
        (_error, _id, index) => rejected.push(index)
    );
    resolved.sort((a, b) => a.index - b.index);
    return { resolved, rejected };
}

beforeEach(() => {
    vi.mocked(fetchIntoLibrary).mockReset();
    vi.mocked(downloadMultipleImages).mockReset();
});

describe("resolveDriveImages", () => {
    it("fetches each id into the library once and reports it for every request", async () => {
        vi.mocked(fetchIntoLibrary).mockImplementation(async (_folder, id) => ({ kind: "path", path: `/lib/${id}.jpg` }));

        const { resolved, rejected } = await resolveAll("/lib");

        expect(vi.mocked(fetchIntoLibrary).mock.calls.map(([, id]) => id)).toEqual(["island", "forest"]);
        expect(resolved.map(r => r.index)).toEqual([0, 1, 2, 3]);
        expect(resolved[3].source).toEqual({ kind: "path", path: "/lib/island.jpg" });
        expect(rejected).toEqual([]);
    });

    it("fails every request for an id that could not be fetched", async () => {
        vi.mocked(fetchIntoLibrary).mockImplementation(async (_folder, id) => {
            if (id === "island") throw new Error("gone");
            return { kind: "path", path: `/lib/${id}.jpg` };
        });

        const { resolved, rejected } = await resolveAll("/lib");

        expect(resolved.map(r => r.index)).toEqual([1]);
        expect(rejected.sort()).toEqual([0, 2, 3]);
    });

    it("downloads each id once without a library, giving every request its own object URL", async () => {
        vi.mocked(downloadMultipleImages).mockImplementation(async (files, onDownloaded) => {
            files.forEach((file, i) => onDownloaded?.(new File(["x"], file.name), file.id, i));
            return [];
        });

        const { resolved } = await resolveAll(null);

        expect(vi.mocked(downloadMultipleImages).mock.calls[0][0].map(f => f.id)).toEqual(["island", "forest"]);
        const islandUrls = [0, 2, 3].map(i => (resolved[i].source as { url: string }).url);
        expect(new Set(islandUrls).size).toBe(3);
    });
});
