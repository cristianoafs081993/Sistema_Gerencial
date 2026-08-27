import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSuapTheme } from "@/components/suap/SuapThemeSwitcher";

initSuapTheme();

createRoot(document.getElementById("root")!).render(<App />);
