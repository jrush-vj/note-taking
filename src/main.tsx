import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import { localDb } from "./lib/localDb";

// Initialize local database for desktop app
localDb.initialize().catch(console.error);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);