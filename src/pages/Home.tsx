import { Link } from "react-router";
import { textStyles } from "../theme/classNames";

function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
            <div className="text-center space-y-4 animate-fade-in">
                <h1 className="text-6xl md:text-7xl font-bold mb-2 bg-gradient-to-r from-teal-300 via-cyan-400 to-purple-300 bg-clip-text text-transparent">
                    ProxKit
                </h1>
                <p className={`${textStyles.secondary} text-lg md:text-xl max-w-md mx-auto`}>
                    Tools for proxy card creation and printing
                </p>
            </div>

            <nav className="flex flex-col gap-4 w-full max-w-md">
                <Link
                    to="/print-and-cut"
                    className="group relative px-8 py-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center"
                >
                    <span className="text-xl font-medium text-white group-hover:text-cyan-300 transition-colors">
                        Print and Cut
                    </span>
                    <span className={`${textStyles.muted} block text-sm mt-1`}>
                        File Generation for Sillhouette Cutting Machines
                    </span>
                </Link>
                <Link
                    to="/docs"
                    className="group relative px-8 py-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center"
                >
                    <span className="text-xl font-medium text-white group-hover:text-purple-300 transition-colors">
                        Documentation
                    </span>
                    <span className={`${textStyles.muted} block text-sm mt-1`}>
                        Under construction
                    </span>
                </Link>
            </nav>

            <footer className="absolute bottom-6">
                <p className={`${textStyles.muted} text-xs text-center opacity-50 hover:opacity-75 transition-opacity`}>
                    © {new Date().getFullYear()} Alec Parkes
                </p>
            </footer>
        </div>
    );
}

export default Home;
