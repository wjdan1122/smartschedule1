// smart3/client/src/services/api.js
import axios from 'axios';

// 1. التعديل: الرابط الأساسي الآن لا يحتوي على /api
const api = axios.create({
  // الكود القديم
  baseURL: process.env.REACT_APP_API_BASE_URL,
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

// 2. التعديل: تمت إضافة /api إلى كل المسارات بالأسفل

// Authentication API
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  registerUser: (data) => api.post('/api/auth/register-user', data),
  registerStudent: (data) => api.post('/api/auth/register-student', data),
  requestPasswordReset: (email) => api.post('/api/auth/forgot-password', { email })
};

// Student API
export const studentAPI = {
  getAll: () => api.get('/api/students'),
  getById: (userId) => api.get(`/api/student/${userId}`)
};

// Course API
export const courseAPI = {
  getAll: () => api.get('/api/courses'),
  getElective: () => api.get('/api/courses/elective'),
  create: (data) => api.post('/api/courses', data)
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