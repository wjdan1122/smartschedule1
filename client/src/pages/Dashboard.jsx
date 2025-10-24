import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Navbar, Nav, Button, Badge, ProgressBar, Spinner, Alert } from 'react-bootstrap';
// تأكد من تثبيت هذه المكتبة: npm install react-icons
import { FaUsers, FaCheckCircle, FaComments, FaVoteYea, FaBell, FaCalendarAlt, FaBook, FaBalanceScale, FaHome, FaSignOutAlt, FaUserGraduate } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // <--- المسار الصحيح للملف في المجلد الأب (src)

// --- Sub-Components ---
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

const ElectiveCourseCard = ({ course }) => {
  const votePercentage = course.percentage;

  const handleManage = () => {
    if (window.confirm(`Are you sure you want to review and potentially approve ${course.title_ar} (${course.code})?`)) {
      console.log(`Navigating to management for: ${course.code}`);
    }
  };

  return (
    <Card className="shadow-sm p-3 border-2" style={{ transition: 'all 0.3s ease' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="course-title fw-bold text-dark">{course.title_ar}</span>
        <Badge bg="primary" pill className="course-code">{course.code}</Badge>
      </div>

      <div className="voting-progress mb-3">
        <ProgressBar now={votePercentage} className="progress-bar rounded-pill" style={{ height: '8px', background: '#e9ecef' }}>
          <div
            className="progress-fill-custom"
            style={{ width: `${votePercentage}%`, height: '100%', borderRadius: '4px' }}
          ></div>
        </ProgressBar>
        <div className="d-flex justify-content-between text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          <span>{course.votes || 0} Votes</span>
          <span>{votePercentage}%</span>
        </div>
      </div>

      <Button
        onClick={handleManage}
        variant="success"
        className="fw-bold"
      >
        Review & Approve 📝
      </Button>
    </Card>
  );
};

const NotificationItem = ({ notification }) => (
  <div className="notification-item-custom bg-light rounded p-3 mb-3">
    <div className="d-flex justify-content-between align-items-center mb-1">
      <span className="notification-title fw-bold text-dark">{notification.title}</span>
      <span className="notification-time text-muted" style={{ fontSize: '0.8rem' }}>{notification.time}</span>
    </div>
    <div className="notification-content text-secondary" style={{ lineHeight: '1.5', fontSize: '0.9rem' }}>
      {notification.content}
    </div>
  </div>
);

// --- البيانات الوهمية (Mock Data) ---
const INITIAL_MOCK_DATA = {
  totalStudents: '...',
  votingStudents: '...',
  totalComments: '...',
  totalVotes: '...',
  participationRate: '...',
};

const DUMMY_NOTIFICATIONS = [
  { title: 'System Notification', time: 'Just now', content: 'Connecting to real-time data from server...' },
  { title: 'Test Alert', time: '1 min ago', content: 'Database connection successful.' },
];


// --- Main Component: CommitteeDashboard ---
const CommitteeDashboard = () => {
  // قسم useState
  const [stats, setStats] = useState(INITIAL_MOCK_DATA);
  const [votingCourses, setVotingCourses] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: 'Guest', role: 'Loading Committee' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate(); // تعريف دالة التنقل

  // دالة مساعدة لجلب البيانات و fetchDashboardData و fetchUserInfo تبقى كما هي...
  const fetchData = async (url) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const fetchUserInfo = async (token) => {
    const storedUser = JSON.parse(localStorage.getItem('user')) || {};

    if (storedUser.full_name && storedUser.role) {
      setUserInfo({ name: storedUser.full_name, role: storedUser.role });
    } else {
      setUserInfo({ name: 'Dr. Ahmed Al-Rashed (Mock)', role: 'Load Committee Head' });
    }
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsData = await fetchData('http://localhost:5000/api/statistics');

      const participationRate = statsData.totalStudents > 0
        ? ((statsData.votingStudents / statsData.totalStudents) * 100).toFixed(1)
        : 0;

      setStats({
        totalStudents: statsData.totalStudents,
        votingStudents: statsData.votingStudents,
        totalComments: 34,
        totalVotes: statsData.totalVotes,
        participationRate: participationRate,
      });

      // جلب المقررات الاختيارية
      const courses = await fetchData('http://localhost:5000/api/courses/elective');

      // جلب الأصوات وتجميعها
      const votesPromises = courses.map(course =>
        fetchData(`http://localhost:5000/api/votes/course/${course.course_id}`)
      );
      const votesResults = await Promise.all(votesPromises);

      // دمج الأصوات مع بيانات المقررات
      const coursesWithVotes = courses.map((course, index) => {
        const totalVotesForCourse = votesResults[index].length;
        const potentialVoters = statsData.votingStudents > 0 ? statsData.votingStudents : 1;

        // استخدام اسم المقرر ورمز القسم الأصلي للعرض
        const courseCode = course.dept_code || 'N/A';
        const courseTitle = course.name;

        return {
          course_id: course.course_id,
          code: courseCode,
          title_ar: courseTitle,
          votes: totalVotesForCourse,
          percentage: Math.round((totalVotesForCourse / potentialVoters) * 100),
        };
      });

      setVotingCourses(coursesWithVotes);

    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`فشل تحميل البيانات. يرجى التأكد من تشغيل الخادم والمصادقة. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [setStats, setVotingCourses, setLoading, setError]);

  useEffect(() => {
    fetchUserInfo();
    fetchDashboardData();
    document.body.style.direction = 'ltr';
    return () => {
      document.body.style.direction = 'rtl';
    };
  }, [fetchDashboardData]);

  // تحديد الإحصائيات التي ستعرض في البطاقات
  const displayStats = [
    { icon: <FaUserGraduate className="stat-icon-custom" />, number: stats.totalStudents, label: 'Total Students', description: 'Students enrolled this semester' },
    { icon: <FaCheckCircle className="stat-icon-custom" />, number: stats.votingStudents, label: 'Students Voted', description: `Participation Rate: ${stats.participationRate}%` },
    { icon: <FaComments className="stat-icon-custom" />, number: stats.totalComments, label: 'Student Comments', description: 'Notes received about schedules' },
  ];

  return (
    <div className="dashboard-page">
      <Alert variant="info" className="text-center m-0 rounded-0">
        **Note:** This dashboard is now fetching **live data** from the server on port 5000.
      </Alert>
      <Container fluid="lg" className="container-custom shadow-lg">
        <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
          <div className="logo-section d-flex align-items-center">
            <Navbar.Brand className="fw-bold fs-5">SMART SCHEDULE</Navbar.Brand>
            <Badge bg="light" text="dark" className="committee-badge me-3 p-2">Admin Dashboard</Badge>
          </div>

          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="ms-auto">
            <Nav className="me-auto my-2 my-lg-0 nav-menu" style={{ fontSize: '0.9rem' }}>
              <Nav.Link href="#" className="nav-link-custom active rounded-2 p-2 mx-1">
                <FaHome className="me-2" /> HOME
              </Nav.Link>
              <Nav.Link onClick={() => navigate('/manageSchedules')} className="nav-link-custom rounded-2 p-2 mx-1">
                <FaCalendarAlt className="me-2" /> Manage Schedules & Levels
              </Nav.Link>
              <Nav.Link href="manageStu-enhanced-display.html" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaUsers className="me-2" /> Manage Students
              </Nav.Link>
              <Nav.Link href="addElective.html" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaBook className="me-2" /> Course Information
              </Nav.Link>
              <Nav.Link href="rule.html" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaBalanceScale className="me-2" /> Manage Rules
              </Nav.Link>
              <Nav.Link href="loadNotification.html" className="nav-link-custom rounded-2 p-2 mx-1">
                <FaBell className="me-2" /> Notifications
              </Nav.Link>
            </Nav>
            <div className="user-section d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
              <div className="user-info text-white text-start me-3">
                <div className="user-name fw-bold">{loading ? 'Loading...' : userInfo.name}</div>
                <div className="user-role" style={{ opacity: 0.8, fontSize: '0.8rem' }}>{userInfo.role}</div>
              </div>
              <Button variant="danger" className="logout-btn fw-bold" onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.confirm('Logged out successfully. Redirecting to login...');
              }}>
                <FaSignOutAlt className="me-1" /> Logout
              </Button>
            </div>
          </Navbar.Collapse>
        </Navbar>

        <main className="main-content p-4 p-md-5">
          <header className="welcome-section text-center mb-5">
            <h2 className="text-dark fw-bolder mb-3">Welcome to Smart Schedule</h2>
            <p className="text-secondary fs-6">Manage academic schedules, registration, and planning for the Software Engineering Department - King Saud University.</p>
            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          </header>

          {/* Statistics Section */}
          <section className="stats-grid">
            <Row xs={1} md={2} lg={3} className="g-4 mb-5">
              {displayStats.map((stat, index) => (
                <Col key={index}>
                  <StatCard {...stat} loading={loading} />
                </Col>
              ))}
            </Row>
          </section>

          {/* Elective Voting Section */}
          <section className="elective-voting-section bg-white rounded-4 p-4 p-md-5 shadow-sm">
            <h3 className="text-dark mb-4 d-flex align-items-center">
              <FaVoteYea className="me-2 text-primary" /> Elective Course Voting Results
            </h3>

            <Row xs={1} sm={2} md={3} className="g-3 voting-stats mb-4">
              <Col><Card className="voting-stat-card-custom h-100 shadow-sm border-0"><Card.Body className="p-3 text-center"><div className="voting-stat-number-custom">{loading ? '...' : stats.totalVotes}</div><div className="voting-stat-label text-secondary fw-bold">Total Votes</div></Card.Body></Card></Col>
              <Col><Card className="voting-stat-card-custom h-100 shadow-sm border-0"><Card.Body className="p-3 text-center"><div className="voting-stat-number-custom">{loading ? '...' : stats.participationRate + '%'}</div><div className="voting-stat-label text-secondary fw-bold">Participation Rate</div></Card.Body></Card></Col>
              <Col><Card className="voting-stat-card-custom h-100 shadow-sm border-0"><Card.Body className="p-3 text-center"><div className="voting-stat-number-custom">5</div><div className="voting-stat-label text-secondary fw-bold">Days Remaining (Mock)</div></Card.Body></Card></Col>
            </Row>

            {loading && <div className="text-center my-4"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading course voting data...</p></div>}

            {!loading && votingCourses.length === 0 && (
              <Alert variant="warning" className="text-center">No elective courses or voting data found.</Alert>
            )}

            <div className="elective-courses">
              <Row xs={1} md={3} className="g-4">
                {votingCourses.map(course => (
                  <Col key={course.course_id}>
                    <ElectiveCourseCard course={course} />
                  </Col>
                ))}
              </Row>
            </div>
          </section>

                    /* Notifications Section - Remains Mock for now, requires dedicated /api/notifications route */
          <section className="notifications-section bg-white rounded-4 p-4 p-md-5 shadow-sm mt-5">
            <h3 className="text-dark mb-4 d-flex align-items-center">
              <FaBell className="me-2 text-primary" /> Recent Notifications (Mock Data)
            </h3>

            <div>
              {DUMMY_NOTIFICATIONS.map((notification, index) => (
                <NotificationItem key={index} notification={notification} />
              ))}
            </div>
          </section>
        </main>
      </Container>
    </div>
  );
};

export default CommitteeDashboard;
