import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- 1. استيراد كل مكونات الصفحات ---
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword'; // ✅ استيراد الصفحة الجديدة
import Dashboard from './pages/Dashboard.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import ManageSchedules from './pages/ManageSchedules.jsx';
import ManageStudents from './pages/ManageStudents.jsx';
import ManageRules from './pages/ManageRules.jsx';
import ElectiveVoting from './pages/ElectiveVoting.jsx';
import ManageNotifications from './pages/ManageNotifications.jsx';
import LoadCommittee from './pages/LoadCommittee.jsx';
import Faculty from './pages/Faculty.jsx';

// --- 2. استيراد ملفات التنسيق العامة ---
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// --- 3. تعريف مكون الحماية ---
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

// Central redirect based on stored role/type
const RedirectByRole = () => {
  const saved = JSON.parse(localStorage.getItem('user') || '{}');
  const role = String(saved.role || '').toLowerCase();
  const type = String(saved.type || '');
  if (type === 'student' || role === 'student') return <Navigate to="/student-dashboard" replace />;
  if (role.includes('schedule') || role.includes('scheduler')) return <Navigate to="/manageschedules" replace />;
  if (role.includes('committee') || role.includes('load committee')) return <Navigate to="/load-committee" replace />;
  if (role.includes('faculty')) return <Navigate to="/faculty" replace />;
  return <Navigate to="/dashboard" replace />;
};

// --- 4. تعريف التطبيق والمسارات ---
function App() {
  return (
    <Router>
      <Routes>
        {/* --- المسارات العامة (متاحة للجميع) --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* 👇 المسار الجديد لإعادة تعيين كلمة المرور (يحتوي على رمز التحقق) */}
        <Route path="/reset-password" element={<ResetPassword />} /> 

        {/* --- المسارات المحمية (تتطلب تسجيل الدخول) --- */}

        {/* مسارات لوحة تحكم المدير/اللجنة */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/manageschedules" element={<ProtectedRoute><ManageSchedules /></ProtectedRoute>} />
        <Route path="/managestudents" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />
        <Route path="/managerules" element={<ProtectedRoute><ManageRules /></ProtectedRoute>} />
        <Route path="/managenotifications" element={<ProtectedRoute><ManageNotifications /></ProtectedRoute>} />
        <Route path="/load-committee" element={<ProtectedRoute><LoadCommittee /></ProtectedRoute>} />
        <Route path="/faculty" element={<ProtectedRoute><Faculty /></ProtectedRoute>} />

        {/* مسارات لوحة تحكم الطالب */}
        <Route path="/student-dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        <Route path="/elective-voting" element={<ProtectedRoute><ElectiveVoting /></ProtectedRoute>} />

        {/* --- المسارات الافتراضية والاحتياطية --- */}
        <Route path="/" element={<ProtectedRoute><RedirectByRole /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><RedirectByRole /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;