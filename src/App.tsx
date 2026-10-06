import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import PrintAndCut from "./pages/PrintAndCut";
import Docs from "./pages/Docs";
import Download from "./pages/Download";
import { GettingStarted } from "./components/GettingStarted";
import { useColorTheme } from "./theme/useColorTheme";

function App() {
    useColorTheme();

    return (
        <>
            <GettingStarted />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/print-and-cut" element={<PrintAndCut />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/download" element={<Download />} />
            </Routes>
        </>
    );
}

export default App;