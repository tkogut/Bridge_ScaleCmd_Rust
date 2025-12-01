import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Check if root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element. Make sure index.html has an element with id 'root'.");
}

createRoot(rootElement).render(<App />);