import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Navbar, Nav, Button, Badge, Spinner, Alert, ListGroup, Form } from 'react-bootstrap';
import { FaUsers, FaCheckCircle, FaComments, FaVoteYea, FaBell, FaCalendarAlt, FaBook, FaBalanceScale, FaHome, FaSignOutAlt, FaUserGraduate, FaSync } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

// --- Fetch Helper IMPROVED ---
const fetchData = async (url, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  console.log(`🔗 Fetching: ${url}, Method: ${method}, Token: ${token ? 'Present' : 'Missing'}`);
  
  const options = {
    method,
    headers: { 
      'Content-Type': 'application/json', 
      ...(token && { 'Authorization': `Bearer ${token}` }) 
    },
    credentials: 'include'
  };
  
  if (body) { 
    options.body = JSON.stringify(body);
    console.log('📤 Request Body:', body);
  }
  
  try {
    const response = await fetch(url, options);
    console.log(`📥 Response Status: ${response.status} for ${url}`);
    
    if (response.status === 401 || response.status === 403) { 
      localStorage.clear();
      window.location.href = '/login';
      throw new Error("Authentication failed. Redirecting to login.");
    }
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` };
      }
      throw new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Success: ${url}`, data);
    return data;
  } catch (error) {
    console.error(`❌ Fetch error for ${url}:`, error);
    throw error;
  }
};

// --- Sub-Components ---
const StatCard = ({ icon, number, label, description, loading }) => (
  <Card className="border-0 shadow-sm h-100" style={{borderRadius: '15px', background: 'rgba(255,255,255,0.9)'}}>
    <Card.Body className="d-flex flex-column align-items-center justify-content-center p-4">
      <div className="mb-3 text-primary" style={{fontSize: '2.5rem'}}>{icon}</div>
      <div style={{fontSize: '2rem', fontWeight: 'bold', color: '#2d3748'}}>
        {loading ? <Spinner animation="border" size="sm" /> : number}
      </div>
      <div className="text-muted fw-bold mb-1">{label}</div>
      <p className="text-muted text-center small mb-0">{description}</p>
    </Card.Body>
  </Card>
);

const NotificationItem = ({ notification }) => (
  <div className="bg-light rounded p-3 mb-3 border-start border-4 border-primary shadow-sm">
    <div className="d-flex justify-content-between align-items-center mb-1">
      <span className="fw-bold text-dark">{notification.title}</span>
      <span className="text-muted small">{notification.time}</span>
    </div>
    <div className="text-secondary small">{notification.content}</div>
  </div>
);

// --- Main Dashboard ---
const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [userInfo, setUserInfo] = useState({ name: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check server connection first
  const checkServerConnection = async () => {
    try {
      console.log('🔗 Checking server connection...');
      const healthCheck = await fetch('https://smartschedule1-b64l.onrender.com/api/health');
      if (healthCheck.ok) {
        const healthData = await healthCheck.json();
        console.log('✅ Server health:', healthData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Server connection failed:', error);
      return false;
    }
  };

  const fetchDashboardData = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setStatsError(null);
    
    try {
      const storedUser = JSON.parse(localStorage.getItem('user')) || {};
      console.log('📊 Fetching dashboard data for user:', storedUser);
      
      setUserInfo({ 
        name: storedUser.name || 'User', 
        role: storedUser.role || 'Unknown Role' 
      });
      
      const statsData = await fetchData('https://smartschedule1-b64l.onrender.com/api/statistics');
      console.log('📈 Stats data received:', statsData);
      
      setStats(statsData);
      setStatsError(null);
      
    } catch (err) { 
      console.error('❌ Failed to fetch dashboard data:', err);
      
      if (retryCount < 2) {
        console.log(`🔄 Retrying... Attempt ${retryCount + 1}`);
        setTimeout(() => fetchDashboardData(retryCount + 1), 2000);
      } else {
        setStatsError(err.message || 'Failed to load statistics');
        // Set default values for display
        setStats({
          totalStudents: 0,
          votingStudents: 0,
          totalComments: 0,
          participationRate: '0.0'
        });
      }
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('👤 Stored user:', storedUser);
        
        if (storedUser.role && storedUser.role.toLowerCase().includes('committee')) {
          console.log('🔄 Redirecting committee user...');
          navigate('/load-committee', { replace: true });
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    };
    
    checkUserRole();
  }, [navigate]);

  useEffect(() => {
    const initializeDashboard = async () => {
      const isServerConnected = await checkServerConnection();
      if (isServerConnected) {
        fetchDashboardData();
      } else {
        setStatsError('Cannot connect to server. Please check your connection.');
        setLoading(false);
      }
    };
    
    initializeDashboard();
  }, [fetchDashboardData]);

  const handleLogout = () => { 
    localStorage.clear(); 
    navigate('/login'); 
  };
  
  const isActive = (path) => location.pathname === path ? 'active' : '';

  const displayStats = [
    { 
      icon: <FaUserGraduate />, 
      number: stats.totalStudents ?? '0', 
      label: 'Total Students', 
      description: 'Students enrolled' 
    },
    { 
      icon: <FaCheckCircle />, 
      number: stats.votingStudents ?? '0', 
      label: 'Students Voted', 
      description: `Participation` 
    },
    { 
      icon: <FaComments />, 
      number: stats.totalComments ?? '0', 
      label: 'Student Comments', 
      description: 'Notes received' 
    },
  ];

  // --- Internal Navbar Component ---
  const InternalNavbar = () => (
    <Navbar expand="lg" variant="dark" className="shadow-lg p-3 mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
      <Container fluid>
        <Navbar.Brand className="fw-bold fs-4">🎓 KSU SmartSchedule</Navbar.Brand>
        <Navbar.Toggle aria-controls="navbar-nav" />
        <Navbar.Collapse id="navbar-nav">
          <Nav className="mx-auto">
            <Nav.Link onClick={() => navigate('/dashboard')} className={`text-white mx-2 fw-bold ${isActive('/dashboard') && 'text-warning'}`}>
              <FaHome className="me-1"/> Home
            </Nav.Link>
            <Nav.Link onClick={() => navigate('/manageSchedules')} className={`text-white mx-2 ${isActive('/manageSchedules') && 'fw-bold'}`}>
              <FaCalendarAlt className="me-1"/> Schedules
            </Nav.Link>
            <Nav.Link onClick={() => navigate('/managestudents')} className={`text-white mx-2 ${isActive('/managestudents') && 'fw-bold'}`}>
              <FaUsers className="me-1"/> Students
            </Nav.Link>
            <Nav.Link onClick={() => navigate('/addElective')} className={`text-white mx-2 ${isActive('/addElective') && 'fw-bold'}`}>
              <FaBook className="me-1"/> Courses
            </Nav.Link>
            <Nav.Link onClick={() => navigate('/managerules')} className={`text-white mx-2 ${isActive('/managerules') && 'fw-bold'}`}>
              <FaBalanceScale className="me-1"/> Rules
            </Nav.Link>
            <Nav.Link onClick={() => navigate('/managenotifications')} className={`text-white mx-2 ${isActive('/managenotifications') && 'fw-bold'}`}>
              <FaBell className="me-1"/> Comments
            </Nav.Link>
          </Nav>
          <div className="d-flex align-items-center mt-3 mt-lg-0">
             <div className="text-white text-end me-3 lh-1 d-none d-lg-block">
                <div className="fw-bold">{userInfo.name}</div>
                <small className="text-white-50 text-uppercase">{userInfo.role}</small>
             </div>
             <Button variant="danger" size="sm" className="fw-bold px-3 rounded-pill" onClick={handleLogout}>
               <FaSignOutAlt className="me-1"/> Logout
             </Button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );

  return (
    <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
      <Container fluid="lg" className="pt-3">
        <InternalNavbar />
        
        <Card className="border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
            <Card.Header className="text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                <div className="d-flex justify-content-between align-items-center">
                  <div></div>
                  <div>
                    <h1 className="fw-bold mb-1">Admin Dashboard</h1>
                    <p className="mb-0 opacity-75">Overview of system statistics and student engagement</p>
                  </div>
                  <Button 
                    variant="light" 
                    size="sm" 
                    onClick={() => fetchDashboardData()}
                    disabled={loading}
                  >
                    <FaSync className={loading ? 'spinning' : ''} />
                  </Button>
                </div>
            </Card.Header>
            <Card.Body className="p-4 p-lg-5">
                <div className="text-center mb-5">
                    <h2 className="text-dark fw-bolder">Welcome, {userInfo.name}!</h2>
                    {statsError && (
                      <Alert variant="warning" className="mt-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Stats Error: {statsError}</span>
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            onClick={() => fetchDashboardData()}
                            disabled={loading}
                          >
                            {loading ? <Spinner animation="border" size="sm" /> : 'Retry'}
                          </Button>
                        </div>
                      </Alert>
                    )}
                </div>

                <Row xs={1} md={2} lg={3} className="g-4 mb-5">
                    {displayStats.map((stat, index) => (
                        <Col key={index}><StatCard {...stat} loading={loading} /></Col>
                    ))}
                </Row>

                <section className="bg-white rounded-4 p-4 shadow-sm mt-5 border">
                    <h4 className="text-dark mb-3 d-flex align-items-center fw-bold">
                      <FaBell className="me-2 text-primary" /> Recent Notifications
                    </h4>
                    <NotificationItem notification={{ 
                      title: 'System Status', 
                      time: new Date().toLocaleTimeString(), 
                      content: loading ? 'Loading dashboard data...' : statsError ? 'Connection issues detected' : 'Dashboard data loaded successfully'
                    }} />
                </section>
            </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default Dashboard;
