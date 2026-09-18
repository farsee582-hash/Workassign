import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskListPage from './pages/TaskListPage';
import TaskDetail from './pages/TaskDetail';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Calendar from './pages/Calendar';
import Admin from './pages/Admin';
import RecurringWork from './pages/RecurringWork';
import DigitalMarketing from './pages/DigitalMarketing';
import DepartmentWork from './pages/DepartmentWork';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/my-work" element={<TaskListPage title="My Work" />} />
          <Route path="/daily-work" element={<TaskListPage workType="DAILY" title="Daily Work" />} />
          <Route path="/recurring-work" element={<RecurringWork />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/departments" element={<Navigate to="/admin?tab=departments" replace />} />
          <Route path="/departments/digital-marketing" element={<DigitalMarketing />} />
          <Route path="/departments/:id" element={<DepartmentWork />} />
          <Route path="/staff" element={<Navigate to="/admin?tab=staff" replace />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
