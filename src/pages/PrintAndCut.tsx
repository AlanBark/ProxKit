import { Sidebar } from "../components/Settings/Sidebar";
import { CardList } from "../components/CardList";
import { useThumbnailBackfill } from "../hooks/useThumbnailBackfill";
import { useCardReordering } from "../hooks/useCardReordering";
import { useDefaultBleedSync } from "../hooks/useDefaultBleedSync";

function Project() {
    // Before the backfill, so it renders thumbnails at the settled bleed.
    useDefaultBleedSync();
    // Renders any thumbnail that no longer matches the card it belongs to.
    useThumbnailBackfill();
    // Keeps cards grouped by their backs while that setting is on.
    useCardReordering();

    return (
        <div
            className="flex flex-col-reverse lg:flex-row gap-6 p-6"
            style={{ minHeight: "98dvh" }}
        >
            <Sidebar />
            <CardList />
        </div>
    );
}

export default Project;
