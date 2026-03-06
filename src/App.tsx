import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import BottomNav from "./components/BottomNav";
import Index from "./pages/Index";
import Benefits from "./pages/Benefits";
import Recipes from "./pages/Recipes";
import KetosisTimer from "./pages/KetosisTimer";
import Ingredients from "./pages/Ingredients";
import Exercise from "./pages/Exercise";
import Cravings from "./pages/Cravings";
import Stories from "./pages/Stories";
import Sustain from "./pages/Sustain";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/benefits" element={<Benefits />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/timer" element={<KetosisTimer />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/exercise" element={<Exercise />} />
            <Route path="/cravings" element={<Cravings />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/sustain" element={<Sustain />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
