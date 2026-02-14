/**
 * App.tsx — Root component with routing
 * Clean Light Design
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Generate from "./pages/Generate";
import Viewer from "./pages/Viewer";
import Interactive from "./pages/Interactive";
import ChatPage from "./pages/ChatPage";
import AppLayout from "./components/AppLayout";
import SharedViewer from "./pages/SharedViewer";
import Analytics from "./pages/Analytics";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Public shared viewer - no auth, no app layout */}
      <Route path="/shared/:token" component={SharedViewer} />
      {/* Main app routes with layout */}
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/generate/:id" component={Generate} />
            <Route path="/view/:id" component={Viewer} />
            {/* Redirect /history to /chat — history is now in the chat sidebar */}
            <Route path="/history">
              <Redirect to="/chat" />
            </Route>
            <Route path="/interactive/:id" component={Interactive} />
            <Route path="/chat" component={ChatPage} />
            <Route path="/chat/:id" component={ChatPage} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
