import { Link } from "react-router";

function Docs() {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Link to="/" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Back to Home
            </Link>
            <h1 className="text-3xl font-bold mb-6">Documentation</h1>
            <p className="text-gray-600">Documentation content coming soon...</p>
        </div>
    );
}

export default Docs;
