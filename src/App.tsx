import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import PrintAndCut from "./pages/PrintAndCut";
import Docs from "./pages/Docs";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/print-and-cut" element={<PrintAndCut />} />
            <Route path="/docs" element={<Docs />} />
        </Routes>
    );
}

export default App;