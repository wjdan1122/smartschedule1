// smart3/client/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
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

// Authentication API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registerUser: (data) => api.post('/auth/register-user', data),
  registerStudent: (data) => api.post('/auth/register-student', data)
};

// Student API
export const studentAPI = {
  getAll: () => api.get('/students'),
  getById: (userId) => api.get(`/student/${userId}`)
};

// Course API
export const courseAPI = {
  getAll: () => api.get('/courses'),
  getElective: () => api.get('/courses/elective'),
  create: (data) => api.post('/courses', data)
};

// Voting API
export const voteAPI = {
  vote: (data) => api.post('/vote', data),
  getVotesByCourse: (courseId) => api.get(`/votes/course/${courseId}`)
};

// Schedule API
export const scheduleAPI = {
  getAll: () => api.get('/schedules'),
  create: (data) => api.post('/schedules', data)
};

// Section API
export const sectionAPI = {
  getAll: () => api.get('/sections')
};

// Statistics API
export const statisticsAPI = {
  get: () => api.get('/statistics')
};



export default api;