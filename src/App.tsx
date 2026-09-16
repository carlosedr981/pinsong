import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Environments from "./pages/Environments";
import EmployeeEnvironments from "./pages/EmployeeEnvironments";
import Financial from "./pages/Financial";
import Tickets from "./pages/Tickets";
import NotFound from "./pages/NotFound";
import { AdminScheduleExtension } from "@/components/AdminScheduleExtension";

const queryClient = new QueryClient();

const AdminWithSchedule = () => (
  <>
    <Admin />
    <AdminScheduleExtension />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminWithSchedule />} />
            <Route path="/environments" element={<Environments />} />
            <Route path="/employee-environments" element={<EmployeeEnvironments />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
