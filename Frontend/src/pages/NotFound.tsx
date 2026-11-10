import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <p className="text-5xl font-bold text-green-600">404</p>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">The page you are looking for doesn't exist or has moved.</p>
        <Link
          to="/home"
          className="mt-6 inline-block px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
