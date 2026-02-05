import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css"
import MainDashboard from "./MainDashboard";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainDashboard />
  </StrictMode>,
);
