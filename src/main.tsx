import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import AdminApp from "./admin/AdminApp";
import { ToastProvider } from "./components/Toast";

// mount the admin console under /admin (path or #/admin hash), else the trader app.
// App.tsx already provides its own ToastProvider, so only the admin is wrapped here.
const isAdmin = /^\/admin(\/|$)/i.test(window.location.pathname) || /^#\/admin/i.test(window.location.hash);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isAdmin ? <ToastProvider><AdminApp /></ToastProvider> : <App />}</StrictMode>,
);
