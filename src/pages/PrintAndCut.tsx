import { Sidebar } from "../components/Settings/Sidebar";
import { CardList } from "../components/CardList";

function Project() {
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
