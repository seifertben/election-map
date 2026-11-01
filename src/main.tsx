import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installLocale } from './i18n/runtime';

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
installLocale(root);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
