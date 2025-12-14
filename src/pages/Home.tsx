import { Link } from "react-router";
import { textStyles } from "../theme/classNames";

function Home() {
    // placeholder slop
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <h1 className="text-4xl font-bold mb-8">ProxKit</h1>
            <nav className="flex flex-col gap-4">
                <Link
                    to="/print-and-cut"
                    className="text-xl hover:underline"
                >
                    Print and Cut
                </Link>
                <Link
                    to="/docs"
                    className="text-xl hover:underline"
                >
                    Documentation
                </Link>
            </nav>
            <p className={`${textStyles.muted}  text-xs text-center opacity-60`}>
                © {new Date().getFullYear()} Alec Parkes
            </p>
        </div>
    );
}

export default Home;
