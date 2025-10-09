import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // <--- إضافة Router و Routes
// استيراد المكونات
import Dashboard from './Dashboard.jsx';
import Login from './Login.jsx';
import ManageSchedules from './pages/ManageSchedules.jsx'; // <--- استيراد صفحة الجداول
// استيراد التنسيقات
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/**
 * يتحقق مما إذا كان المستخدم مسجلاً دخوله حاليًا
 */
const isAuthenticated = () => {
    return localStorage.getItem('token') !== null && localStorage.getItem('user') !== null;
};

// مكون الحماية (Private Route)
const PrivateRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" />;
};


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Router>
            <Routes>
                {/* مسار الدخول والتسجيل العام */}
                <Route path="/login" element={<Login />} />
                {/* يمكنك إضافة مسار التسجيل هنا إذا كان لديك صفحة Signup */}
                {/* <Route path="/signup" element={<Signup />} /> */}

                {/* المسارات المحمية التي تتطلب تسجيل الدخول */}
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/managestudents" element={<PrivateRoute><ManageStudents /></PrivateRoute>} />

                {/* مسار إدارة الجداول الجديد */}
                <Route path="/manageschedules" element={<PrivateRoute><ManageSchedules /></PrivateRoute>} />

                {/* التوجيه لأي مسار غير معروف إلى لوحة التحكم أو الدخول */}
                <Route path="*" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} />} />
            </Routes>
        </Router>
    </React.StrictMode>,
);
