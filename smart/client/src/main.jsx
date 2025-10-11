import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- استيراد المكونات ---
import Dashboard from './pages/Dashboard'; // Assuming Dashboard is in pages
import Login from './pages/Login';       // Assuming Login is in pages
import ManageSchedules from './pages/ManageSchedules';
import ManageStudents from './pages/ManageStudents'; // Assuming you have this page
import ManageRules from './pages/ManageRules';       // Assuming you have this page
import ManageNotifications from './pages/ManageNotifications'; // ✅ 1. استيراد الصفحة الجديدة

// --- استيراد التنسيقات ---
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const isAuthenticated = () => {
    return localStorage.getItem('token') !== null && localStorage.getItem('user') !== null;
};

const PrivateRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
};


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Router>
            <Routes>
                {/* --- مسار الدخول العام --- */}
                <Route path="/login" element={<Login />} />

                {/* --- المسارات المحمية --- */}
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/managestudents" element={<PrivateRoute><ManageStudents /></PrivateRoute>} />
                <Route path="/manageschedules" element={<PrivateRoute><ManageSchedules /></PrivateRoute>} />
                <Route path="/managerules" element={<PrivateRoute><ManageRules /></PrivateRoute>} />

                {/* ✅ 2. إضافة المسار الجديد هنا */}
                <Route path="/managenotifications" element={<PrivateRoute><ManageNotifications /></PrivateRoute>} />


                {/* --- المسار الاحتياطي --- */}
                <Route path="*" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} />} />
            </Routes>
        </Router>
    </React.StrictMode>,
);

