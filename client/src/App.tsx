/** Dawnveil Reverie: the game is a single immersive canvas experience, with no navigation that dilutes the ascent. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider><Toaster /><Home /></TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
