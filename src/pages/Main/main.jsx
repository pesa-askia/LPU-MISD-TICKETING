import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../MainDashboard/maindashboard.css";
import "../MainDashboard/submitticket.css";
import App from "../App/App";
import { BrowserRouter } from "react-router-dom";
import { LoadingProvider } from "../../context/LoadingContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </BrowserRouter>
  </StrictMode>,
);
