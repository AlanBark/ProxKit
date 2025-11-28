import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { backgroundStyles, textStyles } from "./theme/classNames";

import githubLogo from './assets/github-mark-white.svg';
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
