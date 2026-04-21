import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Articles from "./pages/Articles";
import Summary from "./pages/Summary";
import FeedsConfig from "./pages/FeedsConfig";
import JobLogs from "./pages/JobLogs";
import CommoditiesPage from "./pages/Commodities";
import Pricing from "./pages/Pricing";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import ContentApproval from "./pages/ContentApproval";
import Conversion from "./pages/Conversion";
import LandingPage from "./pages/LandingPage";
import WhatsAppAdmin from "./pages/WhatsAppAdmin";
import MyProfile from "./pages/MyProfile";
import CommercialDashboard from "./pages/CommercialDashboard";
import WhatsAppAccess from "./pages/WhatsAppAccess";

function AppRouter() {
  return (
    <Switch>
      {/* Fully public routes — no layout at all */}
      <Route path="/landing" component={LandingPage} />
      {/* WhatsApp access link — standalone page, no sidebar */}
      <Route path="/acesso" component={WhatsAppAccess} />

      {/* All other routes use DashboardLayout */}
      {/* /pricing and /subscription/success are inside DashboardLayout but DashboardLayout */}
      {/* will show sidebar for logged-in users; for non-logged users they get the login prompt */}
      <Route>
        <DashboardLayout allowPublic>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/articles" component={Articles} />
            <Route path="/summary" component={Summary} />
            <Route path="/feeds" component={FeedsConfig} />
            <Route path="/jobs" component={JobLogs} />
            <Route path="/commodities" component={CommoditiesPage} />
            <Route path="/aprovacao" component={ContentApproval} />
            <Route path="/conversao" component={Conversion} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/subscription/success" component={SubscriptionSuccess} />
            <Route path="/whatsapp-admin" component={WhatsAppAdmin} />
            <Route path="/perfil" component={MyProfile} />
            <Route path="/admin/comercial" component={CommercialDashboard} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
