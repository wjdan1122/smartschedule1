import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { FaUserGraduate, FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaChartLine } from 'react-icons/fa';
import '../App.css';

// StatCard Component
const StatCard = ({ icon, number, label, description, loading }) => (
  <Card className="shadow-sm stat-card-custom h-100 border-0">
    <Card.Body className="d-flex flex-column align-items-center justify-content-center p-3 p-md-4">
      {icon}
      <div className="stat-number-custom my-2">
        {loading ? <Spinner animation="border" size="sm" /> : number}
      </div>
      <div className="stat-label text-dark fw-bold mb-1">{label}</div>
      <p className="stat-description text-muted text-center" style={{ fontSize: '0.9rem' }}>{description}</p>
    </Card.Body>
  </Card>
);

function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: 'Student', email: '', role: 'Student' });
  const navigate = useNavigate();

  // Helper function to fetch data with authentication
  const fetchData = async (url) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      throw new Error("Authentication failed. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        navigate('/login');
        return;
      }

      const user = JSON.parse(userStr);
      const studentId = user.user_id;

      // Set user info from localStorage
      setUserInfo({
        name: user.name || 'Student',
        email: user.email || '',
        role: 'Student'
      });

      // Fetch student data from API
      const data = await fetchData(`http://localhost:5000/api/student/${studentId}`);
      setStudent(data);

    } catch (err) {
      console.error("Error fetching student data:", err);
      setError(`Failed to load data. Please ensure the server is running. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchStudentData();

    document.body.style.direction = 'ltr';
    return () => {
      document.body.style.direction = 'rtl';
    };
  }, [fetchStudentData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.confirm('Are you sure you want to logout?')) {
      navigate('/login');
    }
  };

  const displayStats = student ? [
    { 
      icon: <FaBook className="stat-icon-custom" />, 
      number: student.total_courses, 
      label: 'Total Courses', 
      description: 'Enrolled courses this semester' 
    },
    { 
      icon: <FaChartLine className="stat-icon-custom" />, 
      number: student.level, 
      label: 'Current Level', 
      description: 'Academic progress level' 
    },
    { 
      icon: <FaUserGraduate className="stat-icon-custom" />, 
      number: student.student_id, 
      label: 'Student ID', 
      description: 'Your university ID number' 
    },
  ] : [];

  return (
    <div className="dashboard-page">
   
      
      <Container fluid="lg" className="container-custom shadow-lg">
        <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
          <div className="logo-section d-flex align-items-center">
            <Navbar.Brand className="fw-bold fs-5">SMART SCHEDULE</Navbar.Brand>
          
          </div>

          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="ms-auto">
            <Nav className="me-auto my-2 my-lg-0 nav-menu" style={{ fontSize: '0.9rem' }}>
              <Nav.Link 
                onClick={() => navigate('/student-dashboard')} 
                className="nav-link-custom active rounded-2 p-2 mx-1"
              >
                <FaHome className="me-2" /> DASHBOARD
              </Nav.Link>
              <Nav.Link href="#" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaBook className="me-2" /> MY COURSES
              </Nav.Link>
              <Nav.Link href="#" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaCalendarAlt className="me-2" /> SCHEDULE
              </Nav.Link>
              <Nav.Link 
                onClick={() => navigate('/elective-voting')} 
                className="nav-link-custom rounded-2 p-2 mx-1"
              >
                <FaVoteYea className="me-2" /> VOTING
              </Nav.Link>
            </Nav>
            <div className="user-section d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
              <div className="user-info text-white text-start me-3">
                <div className="user-name fw-bold">{loading ? 'Loading...' : userInfo.name}</div>
                <div className="user-role" style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                  {loading ? 'Loading...' : userInfo.email}
                </div>
              </div>
              <Button variant="danger" className="logout-btn fw-bold" onClick={handleLogout}>
                <FaSignOutAlt className="me-1" /> Logout
              </Button>
            </div>
          </Navbar.Collapse>
        </Navbar>

        <main className="main-content p-4 p-md-5">
          <header className="welcome-section text-center mb-5">
            <h2 className="text-dark fw-bolder mb-3">Welcome to Your Dashboard</h2>
            <p className="text-secondary fs-6">
              View your academic information, manage courses, and participate in elective voting
            </p>
            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          </header>

          {/* Statistics Section */}
          <section className="stats-grid">
            <Row xs={1} md={2} lg={3} className="g-4 mb-5">
              {loading ? (
                <Col className="text-center">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading statistics...</p>
                </Col>
              ) : (
                displayStats.map((stat, index) => (
                  <Col key={index}>
                    <StatCard {...stat} loading={false} />
                  </Col>
                ))
              )}
            </Row>
          </section>

          {/* Student Information Section */}
          <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm mb-4">
            <h3 className="text-dark mb-4 d-flex align-items-center">
              <FaUserGraduate className="me-2 text-primary" /> Student Information
            </h3>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted">Loading your information...</p>
              </div>
            ) : error ? (
              <Alert variant="danger">{error}</Alert>
            ) : student ? (
              <Row className="g-3">
                <Col md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body>
                      <small className="text-muted d-block mb-1">Student ID</small>
                      <h5 className="fw-bold text-dark">{student.student_id}</h5>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body>
                      <small className="text-muted d-block mb-1">Full Name</small>
                      <h5 className="fw-bold text-dark">{student.name}</h5>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body>
                      <small className="text-muted d-block mb-1">Email Address</small>
                      <h5 className="fw-bold text-dark">{student.email}</h5>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body>
                      <small className="text-muted d-block mb-1">Academic Level</small>
                      <h5 className="fw-bold text-dark">Level {student.level}</h5>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            ) : (
              <Alert variant="warning">Unable to load student information</Alert>
            )}
          </section>

          {/* Quick Actions Section */}
          <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm">
            <h3 className="text-dark mb-4 d-flex align-items-center">
              <FaCalendarAlt className="me-2 text-primary" /> Quick Actions
            </h3>
            
            <Row xs={1} md={3} className="g-3">
              <Col>
                <Card 
                  className="border-0 shadow-sm h-100 stat-card-custom" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/elective-voting')}
                >
                  <Card.Body className="text-center p-4">
                    <FaVoteYea className="stat-icon-custom text-primary mb-3" />
                    <h5 className="fw-bold">Vote for Electives</h5>
                    <p className="text-muted mb-0">Select your preferred courses</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="border-0 shadow-sm h-100 stat-card-custom" style={{ cursor: 'pointer' }}>
                  <Card.Body className="text-center p-4">
                    <FaCalendarAlt className="stat-icon-custom text-success mb-3" />
                    <h5 className="fw-bold">View Schedule</h5>
                    <p className="text-muted mb-0">Check your class timetable</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="border-0 shadow-sm h-100 stat-card-custom" style={{ cursor: 'pointer' }}>
                  <Card.Body className="text-center p-4">
                    <FaBook className="stat-icon-custom text-info mb-3" />
                    <h5 className="fw-bold">My Courses</h5>
                    <p className="text-muted mb-0">View enrolled courses</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </section>
        </main>
      </Container>
    </div>
  );
}

export default StudentDashboard;