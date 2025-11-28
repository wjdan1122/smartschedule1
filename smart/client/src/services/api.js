// smart3/client/src/services/api.js
import axios from 'axios';

// 👇 التعديل هنا: وضعنا رابط سيرفر Render الجديد
const api = axios.create({
  baseURL: 'https://smartschedule1-b64l.onrender.com', 
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --------------------------------------------------------
// 👇 تعريف الدوال كـ NAMED EXPORTS (يحل مشكلة "authAPI is not exported")
// --------------------------------------------------------

// Authentication API
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  registerUser: (data) => api.post('/api/auth/register-user', data),
  registerStudent: (data) => api.post('/api/auth/register-student', data),
  requestPasswordReset: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/api/auth/reset-password', { token, newPassword }) // ✅ الميزة الجديدة
};

// Student API
export const studentAPI = {
  getAll: () => api.get('/api/students'),
  getById: (userId) => api.get(`/api/student/${userId}`),
  // ... (يجب إضافة الدوال هنا إذا كانت موجودة في ملفك الأصلي)
};

// Course API
export const courseAPI = {
  getAll: () => api.get('/api/courses'),
  getElective: () => api.get('/api/courses/elective'),
  create: (data) => api.post('/api/courses', data),
  // ...
};

// Voting API
export const voteAPI = {
  vote: (data) => api.post('/api/vote', data),
  getVotesByCourse: (courseId) => api.get(`/api/votes/course/${courseId}`)
};

// Schedule API
export const scheduleAPI = {
  getAll: () => api.get('/api/schedules'),
  create: (data) => api.post('/api/schedules', data)
};

// Section API
export const sectionAPI = {
  getAll: () => api.get('/api/sections')
};

// Statistics API
export const statisticsAPI = {
  get: () => api.get('/api/statistics')
};

export default api;