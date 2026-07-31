import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import { AppLayout, SettingsGuard } from "@/components/AppLayout";
import { Login } from "@/routes/Login";
import { Home } from "@/routes/Home";
import { CustomerStyles } from "@/routes/CustomerStyles";
import { StyleProgress } from "@/routes/StyleProgress";
import { OverallTimeline } from "@/routes/OverallTimeline";
import { Dashboard } from "@/routes/Dashboard";
import { SettingsLayout } from "@/routes/settings/SettingsLayout";
import { GeneralInfo } from "@/routes/settings/GeneralInfo";
import { OrgChart } from "@/routes/settings/OrgChart";
import { StylesAssignmentGrid } from "@/routes/settings/StylesAssignmentGrid";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/customers/:customerId" element={<CustomerStyles />} />
            <Route path="/styles/:styleId" element={<StyleProgress />} />
            <Route path="/timeline" element={<OverallTimeline />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route element={<SettingsGuard />}>
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<GeneralInfo />} />
                <Route path="org-chart" element={<OrgChart />} />
                <Route path="styles" element={<StylesAssignmentGrid />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
