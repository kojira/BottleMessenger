import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Messages from "@/pages/messages";
import Responses from "@/pages/responses";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/messages" component={Messages} />
      <Route path="/responses" component={Responses} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Router />
      </Layout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;