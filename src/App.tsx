import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { CardList } from "./components/CardList";

function App() {
    return (
        <AppProvider>
            <div 
                className="flex flex-col-reverse lg:flex-row gap-6 p-6"
                style={{ minHeight: "98dvh" }}
            >
                <Sidebar />
                <CardList />
            </div>
        </AppProvider>
    );
}

export default App;