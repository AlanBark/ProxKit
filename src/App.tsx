import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { CardList } from "./components/CardList";

function App() {
    return (
        <AppProvider>
            <div 
                className="flex"
                style={{ height: "98dvh", background: "linear-gradient(90deg,rgba(30, 42, 52, 1) 25%, rgba(69, 63, 120, 1) 50%, rgba(30, 42, 52, 1) 75%)"}}
            >
                <Sidebar />
                <CardList />
            </div>
        </AppProvider>
    );
}

export default App;
