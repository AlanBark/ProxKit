import { Sidebar } from "../components/Settings/Sidebar";
import { CardList } from "../components/CardList";
import { useThumbnailBackfill } from "../hooks/useThumbnailBackfill";

function Project() {
    // Cards opened from a project arrive without previews; fill them in.
    useThumbnailBackfill();

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
