import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- 1. استيراد كل مكونات الصفحات ---
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import ManageSchedules from './pages/ManageSchedules';
import ManageStudents from './pages/ManageStudents';
import ManageRules from './pages/ManageRules';
import ElectiveVoting from './pages/ElectiveVoting';
import ManageNotifications from './pages/ManageNotifications';

// --- 2. استيراد ملفات التنسيق العامة ---
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// --- 3. تعريف مكون الحماية ---
// هذا المكون يتحقق فقط مما إذا كان المستخدم مسجل دخوله أم لا
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

// --- 4. تعريف التطبيق والمسارات ---
function App() {
  return (
    <Router>
      <Routes>
        {/* --- المسارات العامة (متاحة للجميع) --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* --- المسارات المحمية (تتطلب تسجيل الدخول) --- */}

        {/* مسارات لوحة تحكم المدير/اللجنة */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/manageschedules" element={<ProtectedRoute><ManageSchedules /></ProtectedRoute>} />
        <Route path="/managestudents" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />
        <Route path="/managerules" element={<ProtectedRoute><ManageRules /></ProtectedRoute>} />
        <Route path="/managenotifications" element={<ProtectedRoute><ManageNotifications /></ProtectedRoute>} />

        {/* مسارات لوحة تحكم الطالب */}
        <Route path="/student-dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        <Route path="/elective-voting" element={<ProtectedRoute><ElectiveVoting /></ProtectedRoute>} />
        {/* أضف هنا أي مسارات أخرى خاصة بالطالب مثل /my-courses */}

        {/* --- المسارات الافتراضية والاحتياطية --- */}
        <Route path="/" element={<Navigate to="/student-dashboard" replace />} />
        <Route path="*" element={<Navigate to="/student-dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

