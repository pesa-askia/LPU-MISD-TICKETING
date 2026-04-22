import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./pages/dashboard/maindashboard.css";
import "./pages/dashboard/submitticket.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { LoadingProvider } from "./context/LoadingContext";
import { TicketsCacheProvider } from "./context/TicketsCacheContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <LoadingProvider>
        <TicketsCacheProvider>
          <App />
        </TicketsCacheProvider>
      </LoadingProvider>
    </BrowserRouter>
  </StrictMode>,
);
