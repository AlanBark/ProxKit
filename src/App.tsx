import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { CardList } from "./components/CardList";

function App() {
    return (
        <AppProvider>
            <div className="flex" style={{ height: "98dvh" }}>
                <Sidebar />
                <CardList />
            </div>
        </AppProvider>
    );
}

export default App;
