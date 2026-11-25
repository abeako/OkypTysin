import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Service worker: после первого открытия приложение и банк задач работают без интернета.
// В сборке-странице (VITE_NO_SW=1) service worker не нужен: там он не работает.
if (!import.meta.env.VITE_NO_SW) {
  import("virtual:pwa-register").then((m) => m.registerSW({ immediate: true }));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
