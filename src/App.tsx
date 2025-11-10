import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { backgroundStyles, textStyles } from "./theme/classNames";

import githubLogo from './assets/github-mark-white.svg';
import { CardList } from "./components/CardList";

function App() {
    return (
        <AppProvider>
            <div 
                className={`flex h-dvh`}
                style={{background: "linear-gradient(135deg,rgba(25, 35, 45, 1) 0%, rgba(128, 117, 255, 1) 100%)"}}
            >
                <Sidebar />
                <CardList />
            </div>
        </AppProvider>
    );
}

export default App;
