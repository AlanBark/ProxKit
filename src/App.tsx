import { Sidebar } from "./components/Settings/Sidebar";
import { AppProvider } from "./context/AppContext";
import { backgroundStyles, textStyles } from "./theme/classNames";

import githubLogo from './assets/github-mark-white.svg';
import { CardList } from "./components/CardList";

function App() {
    return (
            <AppProvider>
                <div className={`grid grid-cols-[20%_80%] grid-rows-[auto_1fr] h-screen ${backgroundStyles.app}`}>
                    <div className={`text-xl ${backgroundStyles.surface}`}>
                        <h1 className={`ml-12 mt-4 font-bold ${textStyles.primary}`}>
                            Proxy Print and Cut
                        </h1>
                    </div>

                    <div className={`flex flex-row-reverse items-center ${backgroundStyles.surface}`}>
                        <div className="mr-6">
                            <a href="https://github.com/AlanBark/proxy-print-and-cut" target="_blank" rel="noopener noreferrer">
                                <img src={githubLogo} alt="GitHub" className="w-6 h-6 opacity-50 hover:opacity-100 transition" />
                            </a>
                        </div>
                    </div>
                    <Sidebar />
                    <CardList />
                </div>
            </AppProvider>
    );
}

export default App;
