import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { FaUserGraduate, FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaCheckCircle } from 'react-icons/fa';
import '../App.css';

function ElectiveVoting() {
  const [electives, setElectives] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState(null); // This will be the ACTUAL student_id from students table
  const [userInfo, setUserInfo] = useState({ name: 'Student', email: '' });
  const [error, setError] = useState(null);
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

  const loadElectivesData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userStr = localStorage.getItem('user');
      console.log('User string from localStorage:', userStr);
      
      if (!userStr) {
        navigate('/login');
        return;
      }

      const user = JSON.parse(userStr);
      console.log('Parsed user object:', user);

      // ✅ Get the actual student data from the API to ensure we have the correct student_id
      const userId = user.user_id;
      
      if (!userId) {
        throw new Error('User ID not found. Please log in again.');
      }

      // Fetch student data to get the correct student_id
      const studentData = await fetchData(`http://localhost:5000/api/student/${userId}`);
      console.log('Student data from API:', studentData);

      // ✅ Use the student_id from the students table (not user_id!)
      setStudentId(studentData.student_id);
      setUserInfo({
        name: studentData.name || user.name || 'Student',
        email: studentData.email || user.email || ''
      });

      // Fetch electives
      const electivesData = await fetchData("http://localhost:5000/api/courses/elective");
      console.log('Electives data:', electivesData);
      setElectives(electivesData);

    } catch (err) {
      console.error("Error loading data:", err);
      setError(`Failed to load data: ${err.message}`);
      setElectives([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadElectivesData();

    document.body.style.direction = 'ltr';
    return () => {
      document.body.style.direction = 'rtl';
    };
  }, [loadElectivesData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentId) {
      alert("Student ID not found. Please refresh the page and try again.");
      return;
    }

    const selected = Array.from(document.querySelectorAll(".priority-select"))
      .filter(sel => sel.value)
      .map(sel => ({
        course_id: parseInt(sel.dataset.id),
        priority: parseInt(sel.value),
      }));

    if (selected.length === 0) return alert("Please assign at least one priority.");
    if (selected.length > 3) return alert("You can assign up to three priorities only.");

    const priorities = selected.map(s => s.priority);
    if (new Set(priorities).size !== priorities.length)
      return alert("Each priority number (1, 2, 3) must be used only once.");

    try {
      const token = localStorage.getItem('token');
      
      console.log('Submitting votes with student_id:', studentId); // Debug log
      
      // ✅ Backend expects: { student_id, course_id, vote_value }
      // Send votes one by one
      for (const vote of selected) {
        console.log('Voting:', { student_id: studentId, course_id: vote.course_id, vote_value: vote.priority }); // Debug
        
        const res = await fetch("http://localhost:5000/api/vote", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({ 
            student_id: studentId,  // ✅ This is now the correct student_id from students table
            course_id: vote.course_id, 
            vote_value: vote.priority 
          }),
        });

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          throw new Error("Authentication failed. Please log in again.");
        }

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Error saving vote");
        }
      }
      
      setSubmitted(true);
    } catch (err) {
      alert(`Error submitting votes: ${err.message}`);
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard-page">
      <Alert variant="info" className="text-center m-0 rounded-0">
        **Elective Voting** - Rank your preferred elective courses (Maximum 3 priorities)
      </Alert>
      
      <Container fluid="lg" className="container-custom shadow-lg">
        <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
          <div className="logo-section d-flex align-items-center">
            <Navbar.Brand className="fw-bold fs-5">SMART SCHEDULE</Navbar.Brand>
            <Badge bg="light" text="dark" className="committee-badge me-3 p-2">Student Portal</Badge>
          </div>

          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="ms-auto">
            <Nav className="me-auto my-2 my-lg-0 nav-menu" style={{ fontSize: '0.9rem' }}>
              <Nav.Link 
                onClick={() => navigate('/student-dashboard')} 
                className="nav-link-custom rounded-2 p-2 mx-1"
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
                className="nav-link-custom active rounded-2 p-2 mx-1"
              >
                <FaVoteYea className="me-2" /> VOTING
              </Nav.Link>
            </Nav>
            <div className="user-section d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
              <div className="user-info text-white text-start me-3">
                <div className="user-name fw-bold">{userInfo.name}</div>
                <div className="user-role" style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                  {userInfo.email}
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
            <h2 className="text-dark fw-bolder mb-3">Elective Course Voting</h2>
            <p className="text-secondary fs-6">
              Rank your preferred elective courses by priority (1 = Most Preferred, 3 = Least Preferred)
            </p>
            {error && (
              <Alert variant="danger" className="mt-3">
                <strong>Error:</strong> {error}
                <br />
                <small>Please check the browser console for more details.</small>
              </Alert>
            )}
          </header>

          {/* Voting Statistics */}
          <section className="stats-grid mb-5">
            <Row xs={1} sm={2} md={3} className="g-3">
              <Col>
                <Card className="voting-stat-card-custom h-100 shadow-sm border-0">
                  <Card.Body className="p-3 text-center">
                    <div className="voting-stat-number-custom">
                      {loading ? <Spinner animation="border" size="sm" /> : electives.length}
                    </div>
                    <div className="voting-stat-label text-secondary fw-bold">Available Electives</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="voting-stat-card-custom h-100 shadow-sm border-0">
                  <Card.Body className="p-3 text-center">
                    <div className="voting-stat-number-custom">3</div>
                    <div className="voting-stat-label text-secondary fw-bold">Max Priorities</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card className="voting-stat-card-custom h-100 shadow-sm border-0">
                  <Card.Body className="p-3 text-center">
                    <div className="voting-stat-number-custom">{submitted ? '✓' : '○'}</div>
                    <div className="voting-stat-label text-secondary fw-bold">Vote Status</div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </section>

          {/* Voting Form Section */}
          <section className="elective-voting-section bg-white rounded-4 p-4 p-md-5 shadow-sm">
            <h3 className="text-dark mb-4 d-flex align-items-center">
              <FaVoteYea className="me-2 text-primary" /> Select Your Elective Preferences
            </h3>

            {!submitted ? (
              <>
                <Alert variant="info" className="mb-4">
                  <strong>ℹ️ Instructions:</strong> Assign a unique <strong>priority number</strong>{" "}
                  (1 = most preferred, 3 = least preferred). You can select up to <strong>3 courses</strong>.
                </Alert>

                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Loading elective courses...</p>
                  </div>
                ) : electives.length === 0 ? (
                  <Alert variant="warning" className="text-center">
                    {error || 'No elective courses available at this time.'}
                  </Alert>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="elective-courses mb-4">
                      <Row xs={1} className="g-3">
                        {electives.map((course, index) => (
                          <Col key={course.course_id}>
                            <Card 
                              className="border-2 shadow-sm notification-item-custom"
                              style={{ animation: `fadeInUp 0.6s ease ${index * 0.1}s both` }}
                            >
                              <Card.Body className="p-4">
                                <Row className="align-items-center">
                                  <Col md={8}>
                                    <h5 className="fw-bold text-dark mb-2">{course.name || 'Unnamed Course'}</h5>
                                    <Badge bg="primary" className="me-2">Course ID: {course.course_id}</Badge>
                                    <Badge bg="secondary">{course.credit} Credits</Badge>
                                  </Col>
                                  <Col md={4}>
                                    <select
                                      className="form-select form-select-lg priority-select"
                                      data-id={course.course_id}
                                    >
                                      <option value="">-- Select Priority --</option>
                                      <option value="1">🥇 Priority 1 (Most Preferred)</option>
                                      <option value="2">🥈 Priority 2</option>
                                      <option value="3">🥉 Priority 3</option>
                                    </select>
                                  </Col>
                                </Row>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>

                    <div className="d-grid">
                      <Button 
                        type="submit" 
                        size="lg"
                        className="vote-btn-custom fw-bold py-3"
                        disabled={loading || electives.length === 0 || !studentId}
                      >
                        <FaCheckCircle className="me-2" /> Submit My Priorities
                      </Button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="text-center py-5">
                <div style={{ fontSize: '5rem', color: '#28a745' }}>
                  <FaCheckCircle />
                </div>
                <h3 className="text-success fw-bold mt-4 mb-3">Success!</h3>
                <p className="text-muted fs-5 mb-4">
                  Your elective priorities have been submitted successfully.
                </p>
                <Button 
                  size="lg"
                  className="vote-btn-custom fw-bold"
                  onClick={() => navigate('/student-dashboard')}
                >
                  <FaHome className="me-2" /> Return to Dashboard
                </Button>
              </div>
            )}
          </section>
        </main>
      </Container>
    </div>
  );
}

export default ElectiveVoting;