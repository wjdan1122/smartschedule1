import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Navbar, Nav, Button, Badge, Spinner, Alert, ListGroup, Form } from 'react-bootstrap';
import { FaUsers, FaCheckCircle, FaComments, FaVoteYea, FaBell, FaCalendarAlt, FaBook, FaBalanceScale, FaHome, FaSignOutAlt, FaUserGraduate } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

// ✅✅✅ FIX: Define the Render API Base URL
const API_BASE_URL = 'https://smartschedule1-b64l.onrender.com';

// Generic fetchData function
const fetchData = async (url, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
  };
  if (body) { options.body = JSON.stringify(body); }
  // ✅✅✅ FIX: Prepend the API_BASE_URL to the request URL
  const response = await fetch(`${API_BASE_URL}${url}`, options); 
  if (response.status === 401 || response.status === 403) { throw new Error("Authentication failed."); }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request Failed' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// --- Sub-Components ---
const StatCard = ({ icon, number, label, description, loading }) => (
  <Card className="shadow-sm stat-card-custom h-100 border-0"><Card.Body className="d-flex flex-column align-items-center justify-content-center p-3 p-md-4">{icon}<div className="stat-number-custom my-2">{loading ? <Spinner animation="border" size="sm" /> : number}</div><div className="stat-label text-dark fw-bold mb-1">{label}</div><p className="stat-description text-muted text-center" style={{ fontSize: '0.9rem' }}>{description}</p></Card.Body></Card>
);
const NotificationItem = ({ notification }) => (
  <div className="notification-item-custom bg-light rounded p-3 mb-3"><div className="d-flex justify-content-between align-items-center mb-1"><span className="notification-title fw-bold text-dark">{notification.title}</span><span className="notification-time text-muted" style={{ fontSize: '0.8rem' }}>{notification.time}</span></div><div className="notification-content text-secondary" style={{ lineHeight: '1.5', fontSize: '0.9rem' }}>{notification.content}</div></div>
);

// --- Self-Contained Voting Results Component ---
const VotingResults = () => {
  const [allResults, setAllResults] = useState([]);
  const [approvedByLevel, setApprovedByLevel] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('3');
  const [integrationStatus, setIntegrationStatus] = useState({
    loading: false,
    success: '',
    error: ''
  });
  const academicLevels = [3, 4, 5, 6, 7, 8];

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ FIX: Changed from 'http://localhost:5000/api/votes/results' to '/api/votes/results'
      const [data, approvedList] = await Promise.all([
        fetchData('/api/votes/results'), 
        fetchData('/api/electives/approved') // ✅ FIX: Changed
      ]);
      const processedResults = {};
      data.forEach(row => {
        const { course_id, name, is_approved, student_level, vote_count } = row;
        if (!processedResults[course_id]) {
          processedResults[course_id] = { course_id, name, is_approved, votes_by_level: {}, total_votes: 0 };
        }
        if (student_level && vote_count > 0) {
          processedResults[course_id].votes_by_level[student_level] = parseInt(vote_count);
        }
      });
      for (const courseId in processedResults) {
        processedResults[courseId].total_votes = Object.values(processedResults[courseId].votes_by_level).reduce((sum, count) => sum + count, 0);
      }
      setAllResults(Object.values(processedResults).sort((a, b) => b.total_votes - a.total_votes));

      const approvalMap = approvedList.reduce((acc, item) => {
        const levelKey = String(item.level);
        if (!acc[levelKey]) acc[levelKey] = [];
        acc[levelKey].push(item.course_id);
        return acc;
      }, {});
      setApprovedByLevel(approvalMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const autoUpdateScheduleForElective = useCallback(async (courseId, level, action = 'approve') => {
    const levelNumber = parseInt(level, 10);
    if (!levelNumber) {
      setIntegrationStatus({
        loading: false,
        success: '',
        error: 'Invalid level provided for schedule integration.'
      });
      return;
    }

    setIntegrationStatus({
      loading: true,
      success: '',
      error: ''
    });

    try {
      // ✅ FIX: Changed from 'http://localhost:5000/api/sections' to '/api/sections'
      const [sectionsData, versionsData] = await Promise.all([
        fetchData('/api/sections'), 
        fetchData(`/api/schedule-versions?level=${levelNumber}`) // ✅ FIX: Changed
      ]);

      const activeVersion = versionsData.find((version) => version.is_active);
      let sectionsSource = [];

      if (activeVersion && activeVersion.sections) {
        sectionsSource = typeof activeVersion.sections === 'string'
          ? JSON.parse(activeVersion.sections)
          : activeVersion.sections;
      } else {
        sectionsSource = sectionsData.filter(
          (section) => section.level != null && parseInt(section.level, 10) === levelNumber
        );
      }

      const groupOneSections = sectionsSource.filter((section) => {
        if (section.student_group == null) return true;
        const group = parseInt(section.student_group, 10);
        return Number.isNaN(group) ? true : group === 1;
      });

      const currentSchedule = {
        id: 1,
        sections: groupOneSections
      };

      const baseCommand = action === 'approve'
        ? `Integrate the newly approved elective course ${courseId} into the Level ${levelNumber} Software Engineering schedule while keeping existing non-SE sessions fixed.`
        : `Remove the elective course ${courseId} from the Level ${levelNumber} Software Engineering schedule, then rebalance the remaining SE sessions while keeping existing non-SE sessions fixed.`;

      // ✅ FIX: Changed from 'http://localhost:5000/api/schedule/generate' to '/api/schedule/generate'
      const aiResponse = await fetchData('/api/schedule/generate', 'POST', {
        currentLevel: levelNumber,
        currentSchedule,
        user_command: baseCommand
      });

      if (!aiResponse?.schedule) {
        throw new Error('AI schedule could not be generated for the requested update.');
      }

      // ✅ FIX: Changed from 'http://localhost:5000/api/schedule-versions' to '/api/schedule-versions'
      const savedVersion = await fetchData('/api/schedule-versions', 'POST', {
        level: levelNumber,
        student_count: activeVersion?.student_count || 25,
        version_comment: `Auto AI update after ${action === 'approve' ? 'approving' : 'removing'} course ${courseId} on ${new Date().toLocaleDateString()}`,
        sections: aiResponse.schedule
      });

      if (savedVersion?.id) {
        // ✅ FIX: Changed from 'http://localhost:5000/api/schedule-versions' to '/api/schedule-versions'
        await fetchData(`/api/schedule-versions/${savedVersion.id}/activate`, 'PATCH'); 
      }

      setIntegrationStatus({
        loading: false,
        success: action === 'approve'
          ? `AI schedule updated for Level ${levelNumber}.`
          : `AI schedule refreshed after removing course ${courseId} from Level ${levelNumber}.`,
        error: ''
      });
    } catch (integrationError) {
      console.error('Auto integration failed:', integrationError);
      setIntegrationStatus({
        loading: false,
        success: '',
        error: integrationError.message || 'Failed to integrate approved course into the schedule.'
      });
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleApprove = async (courseId) => {
    const levelNumber = parseInt(selectedLevel, 10);
    if (!levelNumber) {
      return alert('Please select a valid level from the dropdown before approving.');
    }
    try {
      // ✅ FIX: Changed from 'http://localhost:5000/api/electives/approve' to '/api/electives/approve'
      await fetchData('/api/electives/approve', 'POST', {
        course_id: courseId,
        level: levelNumber
      });
      alert(`Course approved for Level ${levelNumber}.`);
      await autoUpdateScheduleForElective(courseId, levelNumber, 'approve');
      fetchResults();
    } catch (err) {
      alert(`Failed to approve: ${err.message}`);
      setIntegrationStatus({
        loading: false,
        success: '',
        error: err.message
      });
    }
  };

  const handleUnapprove = async (courseId) => {
    const levelNumber = parseInt(selectedLevel, 10);
    if (!levelNumber) {
      alert('Invalid level selected.');
      return;
    }
    const confirmRemoval = window.confirm('Remove this elective from the schedule for the selected level?');
    if (!confirmRemoval) return;

    try {
      // ✅ FIX: Changed from 'http://localhost:5000/api/electives/approve' to '/api/electives/approve'
      await fetchData('/api/electives/approve', 'DELETE', {
        course_id: courseId,
        level: levelNumber
      });
      alert(`Course removed from Level ${levelNumber}.`);
      await autoUpdateScheduleForElective(courseId, levelNumber, 'remove');
      fetchResults();
    } catch (err) {
      alert(`Failed to remove course: ${err.message}`);
      setIntegrationStatus({
        loading: false,
        success: '',
        error: err.message
      });
    }
  };

  if (loading) return <div className="text-center mt-4"><Spinner /> <p>Loading voting results...</p></div>;
  if (error) return <Alert variant="danger" className="mt-4">{error}</Alert>;

  return (
    <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm mt-5">
      <h3 className="text-dark mb-4 d-flex align-items-center">
        <FaVoteYea className="me-2 text-primary" /> Elective Course Voting Results
      </h3>
      {integrationStatus.loading && (
        <Alert variant="info" className="mb-4">
          <Spinner animation="border" size="sm" className="me-2" />
          Integrating approved course into Level schedule using AI...
        </Alert>
      )}
      {!integrationStatus.loading && integrationStatus.success && (
        <Alert variant="success" className="mb-4">{integrationStatus.success}</Alert>
      )}
      {!integrationStatus.loading && integrationStatus.error && (
        <Alert variant="danger" className="mb-4">{integrationStatus.error}</Alert>
      )}
      <Form.Group className="mb-4">
        <Form.Label className="fw-bold">Show Votes From Student Level:</Form.Label>
        <Form.Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
          {academicLevels.map(level => (
            <option key={level} value={level}>Level {level}</option>
          ))}
        </Form.Select>
        <Form.Text className="text-muted">
          Select a level, then use the buttons below to add or remove multiple electives for that level.
        </Form.Text>
      </Form.Group>
      {(() => {
        const filteredCourses = allResults.filter(course =>
          course.votes_by_level[selectedLevel] ||
          (approvedByLevel[selectedLevel] && approvedByLevel[selectedLevel].includes(course.course_id))
        );
        if (filteredCourses.length === 0) {
          return <p className="text-muted mt-3">No voting results available for the selected student level.</p>;
        }
        return (
          <ListGroup>
            {filteredCourses.map(course => {
              const levelsForCourse = Object.keys(approvedByLevel).filter(
                levelKey => (approvedByLevel[levelKey] || []).includes(course.course_id)
              );
              const isApprovedForSelectedLevel = levelsForCourse.includes(selectedLevel);

              return (
                <ListGroup.Item key={course.course_id} className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-2">
                  <div>
                    <span className="fw-bold">{course.name}</span>
                    <Badge bg="primary" className="ms-3">
                      {course.votes_by_level[selectedLevel] || 0} votes
                    </Badge>
                    <Badge bg="secondary" className="ms-1" pill>Total: {course.total_votes}</Badge>
                    {levelsForCourse.length > 0 && (
                      <div className="text-muted small mt-1">
                        Approved levels: {levelsForCourse.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {isApprovedForSelectedLevel && (
                      <Badge bg="success" className="px-2 py-1">Selected for Level {selectedLevel}</Badge>
                    )}
                    {isApprovedForSelectedLevel ? (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        className="px-3"
                        onClick={() => handleUnapprove(course.course_id)}
                        disabled={integrationStatus.loading}
                      >
                        Cancel Selection
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-success"
                        className="px-3"
                        onClick={() => handleApprove(course.course_id)}
                        disabled={integrationStatus.loading}
                      >
                        Approve for a Level...
                      </Button>
                    )}
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        );
      })()}
    </section>
  );
};

// --- Main Dashboard Component ---
const Dashboard = () => {
  const [stats, setStats] = useState({ totalStudents: '...', votingStudents: '...', totalComments: '...', totalVotes: '...', participationRate: '...' });
  const [userInfo, setUserInfo] = useState({ name: 'Guest', role: 'Loading...' });
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const navigate = useNavigate();

  // Redirect committee users to their dedicated page
  React.useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const role = String(storedUser.role || '').toLowerCase();
      if (role.includes('committee')) {
        navigate('/load-committee', { replace: true });
      }
    } catch {}
  }, [navigate]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setStatsError(null);
    try {
      const storedUser = JSON.parse(localStorage.getItem('user')) || {};
      setUserInfo({ name: storedUser.name || 'Admin User', role: storedUser.role || 'Committee Head' });

      // ✅ FIX: Changed from 'http://localhost:5000/api/statistics' to '/api/statistics'
      const statsData = await fetchData('/api/statistics'); 
      const participationRate = statsData.totalStudents > 0 ? ((statsData.votingStudents / statsData.totalStudents) * 100).toFixed(1) : 0;

      setStats({
        totalStudents: statsData.totalStudents,
        votingStudents: statsData.votingStudents,
        totalComments: statsData.totalComments, // Now live
        totalVotes: statsData.totalVotes,
        participationRate: participationRate,
      });

    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setStatsError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const displayStats = [
    { icon: <FaUserGraduate className="stat-icon-custom" />, number: stats.totalStudents, label: 'Total Students', description: 'Students enrolled' },
    { icon: <FaCheckCircle className="stat-icon-custom" />, number: stats.votingStudents, label: 'Students Voted', description: `Participation: ${stats.participationRate}%` },
    { icon: <FaComments className="stat-icon-custom" />, number: stats.totalComments, label: 'Student Comments', description: 'Notes received' },
  ];

  const chartConfigs = useMemo(() => {
    const totals = {
      students: Number(stats.totalStudents) || 0,
      voters: Number(stats.votingStudents) || 0,
      votes: Number(stats.totalVotes) || 0,
      comments: Number(stats.totalComments) || 0,
    };
    const nonVoters = Math.max(totals.students - totals.voters, 0);
    const participationLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Current'];
    const historicalTrend = [48, 55, 61, 66, 69];
    const trimmedHistory = historicalTrend.slice(-(participationLabels.length - 1));
    const currentRate = Math.min(100, Math.max(0, Number(stats.participationRate) || 0));
    const participationSeries = [...trimmedHistory, currentRate];

    return {
      participation: {
        data: {
          labels: participationLabels,
          datasets: [
            {
              label: 'Participation %',
              data: participationSeries,
              borderColor: '#4c6ef5',
              backgroundColor: 'rgba(76, 110, 245, 0.15)',
              tension: 0.35,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (value) => `${value}%` },
            },
          },
        },
      },
      engagement: {
        data: {
          labels: ['Enrolled Learners', 'Votes Submitted', 'Comments Logged'],
          datasets: [
            {
              label: 'Volume',
              data: [totals.students, totals.votes, totals.comments],
              backgroundColor: ['#0dcaf0', '#6610f2', '#20c997'],
              borderRadius: 6,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true },
          },
        },
      },
      votingSplit: {
        data: {
          labels: ['Participating Students', 'Not Yet Participating'],
          datasets: [
            {
              label: 'Students',
              data: [totals.voters, nonVoters],
              backgroundColor: ['#198754', '#adb5bd'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${context.parsed} students`,
              },
            },
          },
        },
      },
    };
  }, [stats]);

  return (
    <div className="dashboard-page">
      <Container fluid="lg" className="container-custom shadow-lg">
        <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
          <Navbar.Brand className="fw-bold fs-5">ADMIN DASHBOARD</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto my-2 my-lg-0 nav-menu">
              <Nav.Link onClick={() => navigate('/dashboard')} className="nav-link-custom active"><FaHome className="me-2" /> HOME</Nav.Link>
              <Nav.Link onClick={() => navigate('/manageSchedules')} className="nav-link-custom"><FaCalendarAlt className="me-2" /> Schedules</Nav.Link>
              <Nav.Link onClick={() => navigate('/managestudents')} className="nav-link-custom"><FaUsers className="me-2" /> Students</Nav.Link>
              <Nav.Link onClick={() => navigate('/managerules')} className="nav-link-custom"><FaBalanceScale className="me-2" /> Rules</Nav.Link>
              {/* THE LINK IS HERE */}
              <Nav.Link onClick={() => navigate('/managenotifications')} className="nav-link-custom"><FaBell className="me-2" /> Comments</Nav.Link>
              {String(userInfo.role || '').toLowerCase().includes('faculty') && (
                <Nav.Link onClick={() => navigate('/faculty')} className="nav-link-custom"><FaBook className="me-2" /> Faculty</Nav.Link>
              )}
              {String(userInfo.role || '').toLowerCase().includes('committee') && (
                <Nav.Link onClick={() => navigate('/load-committee')} className="nav-link-custom"><FaCheckCircle className="me-2" /> Load Committee</Nav.Link>
              )}
            </Nav>
            <div className="d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
              <div className="text-white text-start me-3">
                <div className="fw-bold">{loading ? '...' : userInfo.name}</div>
                <div style={{ opacity: 0.8, fontSize: '0.8rem' }}>{userInfo.role}</div>
              </div>
              <Button variant="danger" className="fw-bold" onClick={handleLogout}>
                <FaSignOutAlt className="me-1" /> Logout
              </Button>
            </div>
          </Navbar.Collapse>
        </Navbar>

        <main className="main-content p-4 p-md-5">
          <header className="text-center mb-5">
            <h2 className="text-dark fw-bolder mb-3">Main Control Panel</h2>
            {statsError && <Alert variant="danger" className="mt-3"><strong>Statistics Error:</strong> {statsError}</Alert>}
          </header>

          <section>
            <Row xs={1} md={2} lg={3} className="g-4 mb-5">
              {displayStats.map((stat, index) => (
                <Col key={index}><StatCard {...stat} loading={loading} /></Col>
              ))}
            </Row>
          </section>

          <section className="mb-5">
            <Row className="g-4">
              <Col lg={8}>
                <Card className="h-100 shadow-sm border-0">
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h4 className="mb-1 fw-bold text-dark">Participation Trend</h4>
                        <small className="text-muted">Live rate blended with the last five reporting windows</small>
                      </div>
                      <Badge bg="primary" pill>{stats.participationRate || 0}% now</Badge>
                    </div>
                    <div style={{ height: 320 }}>
                      <Line data={chartConfigs.participation.data} options={chartConfigs.participation.options} />
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="h-100 shadow-sm border-0">
                  <Card.Body className="p-4">
                    <h4 className="fw-bold text-dark mb-3">Voting Split</h4>
                    <div style={{ height: 320 }}>
                      <Doughnut data={chartConfigs.votingSplit.data} options={chartConfigs.votingSplit.options} />
                    </div>
                    <p className="text-muted small mt-3 mb-0">
                      Shows how many enrolled students already voted versus those pending participation.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Row className="g-4 mt-1">
              <Col>
                <Card className="shadow-sm border-0">
                  <Card.Body className="p-4">
                    <h4 className="fw-bold text-dark mb-3">Engagement Volume</h4>
                    <div style={{ height: 320 }}>
                      <Bar data={chartConfigs.engagement.data} options={chartConfigs.engagement.options} />
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </section>

          <VotingResults />

          <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm mt-5">
            <h3 className="text-dark mb-4 d-flex align-items-center"><FaBell className="me-2 text-primary" /> Notifications (Mock)</h3>
            <div>
              {[{ title: 'System Notification', time: 'Just now', content: 'Connecting to real-time data from server...' }].map((notification, index) => (<NotificationItem key={index} notification={notification} />))}
            </div>
          </section>
        </main>
      </Container>
    </div>
  );
};

export default Dashboard;