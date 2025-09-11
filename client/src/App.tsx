import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import PrivateRoute from "@/routes/PrivateRoute";
import Layout from "@/components/Layout";

// Auth Pages
import Login from "@/pages/Auth/Login";
import Register from "@/pages/Auth/Register";

// Private Pages
import Dashboard from "@/pages/Dashboard/Dashboard";
import Contacts from "@/pages/Contacts/Contacts";
import Groups from "@/pages/Groups/Groups";
import Templates from "@/pages/Templates/Templates";
import EnhancedBulkUploads from "@/pages/BulkUploads/EnhancedBulkUploads";
import DigitalCard from "@/pages/DigitalCard/DigitalCard";
import ManageDigitalCards from "@/pages/ManageDigitalCards/ManageDigitalCards";
import Settings from "@/pages/Settings/Settings";
import NFCCard from "@/pages/NFCCard/NFCCard";
import Pricing from "@/pages/Pricing/Pricing";

// Public Pages
import PublicShare from "@/pages/PublicShare/PublicShare";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/share/:publicId" component={PublicShare} />

      {/* Private Routes */}
      <Route path="/">
        <PrivateRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/contacts">
        <PrivateRoute>
          <Layout>
            <Contacts />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/groups">
        <PrivateRoute>
          <Layout>
            <Groups />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/templates">
        <PrivateRoute>
          <Layout>
            <Templates />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/bulk-uploads">
        <PrivateRoute>
          <Layout>
            <EnhancedBulkUploads />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/digital-card">
        <PrivateRoute>
          <Layout>
            <DigitalCard />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/manage-cards">
        <PrivateRoute>
          <Layout>
            <ManageDigitalCards />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/settings">
        <PrivateRoute>
          <Layout>
            <Settings />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/nfc-card">
        <PrivateRoute>
          <Layout>
            <NFCCard />
          </Layout>
        </PrivateRoute>
      </Route>

      <Route path="/pricing">
        <PrivateRoute>
          <Layout>
            <Pricing />
          </Layout>
        </PrivateRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
