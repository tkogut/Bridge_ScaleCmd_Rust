import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const [routes, setRoutes] = useState<string[]>([]);
  
  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);
  
  useEffect(() => {
    // Try to get all available routes from the app
    // This is a simplified approach - in a real app you might want to use React Router's 
    // useRoutes or other methods to get route information
    setRoutes(["/", "/health"]);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <p className="text-gray-500 mb-6">
          The requested URL <span className="font-mono bg-gray-200 px-2 py-1 rounded">{location.pathname}</span> was not found.
        </p>
        
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 text-left">
          <h2 className="font-semibold mb-2">Available Routes:</h2>
          <ul className="list-disc list-inside space-y-1">
            {routes.map((route, index) => (
              <li key={index}>
                <Link to={route} className="text-blue-500 hover:underline">
                  {route}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/">Return to Home</Link>
          </Button>
          
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p className="font-medium">Debug Information:</p>
          <p className="mt-1">Current Path: <span className="font-mono">{location.pathname}</span></p>
          <p className="mt-1">Search: <span className="font-mono">{location.search}</span></p>
          <p className="mt-1">Hash: <span className="font-mono">{location.hash}</span></p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;