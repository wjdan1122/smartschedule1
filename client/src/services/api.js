import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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

// API methods
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registerUser: (data) => api.post('/auth/register-user', data),
  registerStudent: (data) => api.post('/auth/register-student', data)
};

export const studentAPI = {
  getAll: () => api.get('/students')
};

export const courseAPI = {
  getAll: () => api.get('/courses'),
  getElective: () => api.get('/courses/elective'),
  create: (data) => api.post('/courses', data)
};

export const voteAPI = {
  vote: (data) => api.post('/vote', data),
  getVotesByCourse: (courseId) => api.get(`/votes/course/${courseId}`)
};

export const scheduleAPI = {
  getAll: () => api.get('/schedules'),
  create: (data) => api.post('/schedules', data)
};

export const sectionAPI = {
  getAll: () => api.get('/sections')
};

export const statisticsAPI = {
  get: () => api.get('/statistics')
};

export default api;