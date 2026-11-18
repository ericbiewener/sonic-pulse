import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Pick one starting point per page load, shared by every animated palette color.
document.documentElement.style.setProperty(
  "--palette-phase",
  String(Math.random()),
);

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
