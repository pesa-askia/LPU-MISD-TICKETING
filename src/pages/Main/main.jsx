import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../SidePanel/sidepanel.css";
import "../MainDashboard/maindashboard.css";
import "../MainDashboard/submitticket.css";
import App from "../App/App";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
