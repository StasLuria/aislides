/**
 * App.tsx — Root component with routing
 * Swiss Precision Design: Dark theme, minimal transitions
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Generate from "./pages/Generate";
import Viewer from "./pages/Viewer";
import History from "./pages/History";
import AppLayout from "./components/AppLayout";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/generate/:id" component={Generate} />
        <Route path="/view/:id" component={Viewer} />
        <Route path="/history" component={History} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "oklch(0.15 0.015 270)",
                border: "1px solid oklch(1 0 0 / 8%)",
                color: "oklch(0.88 0.005 270)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
