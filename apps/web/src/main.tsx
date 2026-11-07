import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./store/auth";
import { RealtimeProvider } from "./store/realtime";
import ErrorBoundary from "./components/ErrorBoundary";
import { installErrorReporting } from "./lib/report";
import { registerServiceWorker } from "./lib/pwa";
import { armSoundUnlock } from "./lib/sound";
import "@fontsource-variable/bricolage-grotesque";
import "./styles/global.css";
import "./styles/theme.css";
import "./styles/skeleton.css";

armSoundUnlock();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 15 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <RealtimeProvider>
              <App />
            </RealtimeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

installErrorReporting();

registerServiceWorker();
