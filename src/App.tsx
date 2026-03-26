import { useEffect, useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ShoppingBagProvider } from "./contexts/ShoppingBagContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import BottomNav from "./components/BottomNav";
import SplashScreen from "./components/SplashScreen";
import Index from "./pages/Index";
import Benefits from "./pages/Benefits";
import Recipes from "./pages/Recipes";
import KetosisTimer from "./pages/KetosisTimer";
import RecipeCoach from "./pages/RecipeCoach";
import CreateRecipe from "./pages/CreateRecipe";
import EditRecipe from "./pages/EditRecipe";
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
import AdminNotifications from "./pages/AdminNotifications";
import AdminAnalytics from "./pages/AdminAnalytics";
import Pricing from "./pages/Pricing";
import Coaching from "./pages/Coaching";
import { usePageViewTracker } from "./hooks/useAnalytics";
import { HealthConnectProvider } from "./contexts/HealthConnectContext";
import { App as CapApp } from "@capacitor/app";
import { useScrollToTop } from "./hooks/useScrollToTop";
import { useContentOverrides } from "./hooks/useContentOverrides";

const queryClient = new QueryClient();

function PageViewTracker() {
  usePageViewTracker();
  return null;
}

function ScrollToTopHandler() {
  useScrollToTop();
  return null;
}

function ContentOverrideLoader() {
  useContentOverrides();
  return null;
}

/** Handles Android hardware back button for in-app navigation */
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const listener = CapApp.addListener("backButton", ({ canGoBack }) => {
      if (location.pathname === "/" || location.pathname === "/onboarding") {
        CapApp.exitApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        navigate("/");
      }
    });
    return () => { listener.then(h => h.remove()); };
  }, [navigate, location.pathname]);

  return null;
}

const App = () => {
  const [splashDone, setSplashDone] = useState(() => {
    // Only show splash once per session
    return sessionStorage.getItem("splash-shown") === "1";
  });

  const handleSplashFinished = useCallback(() => {
    sessionStorage.setItem("splash-shown", "1");
    setSplashDone(true);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
          <SubscriptionProvider>
          <ShoppingBagProvider>
          <UserProfileProvider>
          <HealthConnectProvider>
            {!splashDone && <SplashScreen onFinished={handleSplashFinished} />}
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ContentOverrideLoader />
              <PageViewTracker />
              <ScrollToTopHandler />
              <BackButtonHandler />
              <Routes>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/" element={<Index />} />
                <Route path="/benefits" element={<Benefits />} />
                <Route path="/recipes" element={<Recipes />} />
                <Route path="/timer" element={<KetosisTimer />} />
                <Route path="/recipe-coach" element={<RecipeCoach />} />
                <Route path="/create-recipe" element={<CreateRecipe />} />
                <Route path="/edit-recipe/:id" element={<EditRecipe />} />
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
                <Route path="/news" element={<NewsFeed />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/coaching" element={<Coaching />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <BottomNav />
              
            </BrowserRouter>
          </HealthConnectProvider>
          </UserProfileProvider>
          </ShoppingBagProvider>
          </SubscriptionProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
