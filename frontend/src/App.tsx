import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth, { RequireRole } from './components/RequireAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskListPage from './pages/TaskListPage';
import TaskDetail from './pages/TaskDetail';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Calendar from './pages/Calendar';
import Departments from './pages/Departments';
import Staff from './pages/Staff';
import Admin from './pages/Admin';

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
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/staff" element={<Staff />} />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['ADMIN', 'GMA']}>
                <Admin />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
