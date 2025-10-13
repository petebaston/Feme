import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize BigCommerce B3 settings from environment
if (window.B3?.setting) {
  window.B3.setting.store_hash = import.meta.env.VITE_STORE_HASH || '';
  window.B3.setting.channel_id = parseInt(import.meta.env.VITE_CHANNEL_ID || '1');
}

createRoot(document.getElementById("root")!).render(<App />);
