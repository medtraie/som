import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      toast("Mise à jour disponible. Rechargez l'application pour appliquer les changements.");
    },
    onOfflineReady() {
      toast("L'application est prête pour une utilisation hors ligne.");
    },
  });
}
