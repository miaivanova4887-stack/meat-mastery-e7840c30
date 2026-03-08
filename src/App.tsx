import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ShoppingBagProvider } from "./contexts/ShoppingBagContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { AuthProvider } from "./contexts/AuthContext";
import BottomNav from "./components/BottomNav";
import Index from "./pages/Index";
import Benefits from "./pages/Benefits";
import Recipes from "./pages/Recipes";
import KetosisTimer from "./pages/KetosisTimer";
import RecipeCoach from "./pages/RecipeCoach";
import CreateRecipe from "./pages/CreateRecipe";
import MealPlan from "./pages/MealPlan";
import Ingredients from "./pages/Ingredients";
import Exercise from "./pages/Exercise";
import Cravings from "./pages/Cravings";
import Stories from "./pages/Stories";
import Sustain from "./pages/Sustain";
import Myths from "./pages/Myths";
import Guide from "./pages/Guide";
import GettingStarted from "./pages/GettingStarted";
import BudgetEating from "./pages/BudgetEating";
import AthleticPerformance from "./pages/AthleticPerformance";
import ShoppingBag from "./pages/ShoppingBag";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Community from "./pages/Community";
import ProfilePage from "./pages/Profile";
import NotFound from "./pages/NotFound";
import CmsEditor from "./pages/CmsEditor";
import CmsPageView from "./pages/CmsPageView";
import ProgressPage from "./pages/Progress";
import HealthSync from "./pages/HealthSync";
import NewsFeed from "./pages/NewsFeed";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
        <ShoppingBagProvider>
        <UserProfileProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Index />} />
              <Route path="/benefits" element={<Benefits />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/timer" element={<KetosisTimer />} />
              <Route path="/recipe-coach" element={<RecipeCoach />} />
              <Route path="/create-recipe" element={<CreateRecipe />} />
              <Route path="/meal-plan" element={<MealPlan />} />
              <Route path="/ingredients" element={<Ingredients />} />
              <Route path="/exercise" element={<Exercise />} />
              <Route path="/cravings" element={<Cravings />} />
              <Route path="/stories" element={<Stories />} />
              <Route path="/sustain" element={<Sustain />} />
              <Route path="/myths" element={<Myths />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/getting-started" element={<GettingStarted />} />
              <Route path="/budget" element={<BudgetEating />} />
              <Route path="/athletic" element={<AthleticPerformance />} />
              <Route path="/shopping-bag" element={<ShoppingBag />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/community" element={<Community />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/progress/sync" element={<HealthSync />} />
              <Route path="/cms" element={<CmsEditor />} />
              <Route path="/p/:slug" element={<CmsPageView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </BrowserRouter>
        </UserProfileProvider>
        </ShoppingBagProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
