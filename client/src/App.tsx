import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";

import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import CalendarPage from "./pages/CalendarPage";
import MySessions from "./pages/MySessions";
import InboxPage from "./pages/InboxPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRegistrations from "./pages/AdminRegistrations";
import AdminTrainers from "./pages/AdminTrainers";
import AdminCalendarPage from "./pages/AdminCalendarPage";
import AdminSettings from "./pages/AdminSettings";
import AdminUsers from "./pages/AdminUsers";
import AdminRoles from "./pages/AdminRoles";
import { PermissionKey } from "./api/types";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
}

function TrainerGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route element={<TrainerGuard><Outlet /></TrainerGuard>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/sessions" element={<MySessions />} />
          <Route path="/inbox" element={<InboxPage />} />
        </Route>
        <Route element={<AdminGuard><Outlet /></AdminGuard>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route
            path="/admin/registrations"
            element={<RequirePermission permission="REGISTRATIONS_MANAGE"><AdminRegistrations /></RequirePermission>}
          />
          <Route
            path="/admin/trainers"
            element={<RequirePermission permission="TRAINERS_MANAGE"><AdminTrainers /></RequirePermission>}
          />
          <Route
            path="/admin/calendar"
            element={<RequirePermission permission="SESSIONS_MANAGE"><AdminCalendarPage /></RequirePermission>}
          />
          <Route path="/admin/inbox" element={<InboxPage />} />
          <Route
            path="/admin/users"
            element={<RequirePermission permission="USERS_MANAGE"><AdminUsers /></RequirePermission>}
          />
          <Route
            path="/admin/roles"
            element={<RequirePermission permission="ROLES_MANAGE"><AdminRoles /></RequirePermission>}
          />
          <Route
            path="/admin/settings"
            element={<RequirePermission permission="SETTINGS_MANAGE"><AdminSettings /></RequirePermission>}
          />
        </Route>
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}