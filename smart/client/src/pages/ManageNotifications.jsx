import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Card, Button, Spinner, Alert, ListGroup, Form, Badge, Navbar, Nav } from 'react-bootstrap';
import { FaBell, FaArrowLeft, FaHome, FaCalendarAlt, FaUsers, FaBook, FaBalanceScale, FaCheckCircle, FaVoteYea, FaSignOutAlt, FaUserGraduate } from 'react-icons/fa';
import '../App.css';

// Generic fetchData function
const fetchData = async (url) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
    });
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error("Authentication failed. Please log in again.");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

const ManageNotifications = () => {
    const [allComments, setAllComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const academicLevels = [3, 4, 5, 6, 7, 8];

    // --- Internal Navbar Component ---
    const InternalNavbar = () => {
        let user = {};
        try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
        const role = String(user.role || '').toLowerCase();
        const type = user.type || '';
        const isActive = (path) => location.pathname === path ? 'active' : '';
        const handleLogout = () => { localStorage.clear(); navigate('/login'); };

        return (
            <Navbar expand="lg" variant="dark" className="shadow-lg p-3 mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
              <Container fluid>
                <Navbar.Brand className="fw-bold fs-4 d-flex align-items-center">
                    <span className="me-2">🎓</span> KSU SmartSchedule
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="navbar-nav" />
                <Navbar.Collapse id="navbar-nav">
                  <Nav className="mx-auto">
                    {(type === 'student' || role === 'student') ? (
                        <>
                            <Nav.Link onClick={() => navigate('/student-dashboard')} className={`text-white mx-2 ${isActive('/student-dashboard')}`}><FaHome className="me-1"/> Dashboard</Nav.Link>
                            <Nav.Link onClick={() => navigate('/elective-voting')} className={`text-white mx-2 ${isActive('/elective-voting')}`}><FaVoteYea className="me-1"/> Voting</Nav.Link>
                        </>
                    ) : (
                        <>
                            <Nav.Link onClick={() => navigate('/dashboard')} className={`text-white mx-2 ${isActive('/dashboard') && 'fw-bold'}`}><FaHome className="me-1"/> Home</Nav.Link>
                            <Nav.Link onClick={() => navigate('/manageSchedules')} className={`text-white mx-2 ${isActive('/manageSchedules') && 'fw-bold'}`}><FaCalendarAlt className="me-1"/> Schedules</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managestudents')} className={`text-white mx-2 ${isActive('/managestudents') && 'fw-bold'}`}><FaUserGraduate className="me-1"/> Students</Nav.Link>
                            <Nav.Link onClick={() => navigate('/addElective')} className={`text-white mx-2 ${isActive('/addElective') && 'fw-bold'}`}><FaBook className="me-1"/> Courses</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managerules')} className={`text-white mx-2 ${isActive('/managerules') && 'fw-bold'}`}><FaBalanceScale className="me-1"/> Rules</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managenotifications')} className={`text-white mx-2 fw-bold text-warning`}><FaBell className="me-1"/> Comments</Nav.Link>
                        </>
                    )}
                  </Nav>
                  <div className="d-flex align-items-center mt-3 mt-lg-0">
                     <div className="text-white text-end me-3 lh-1 d-none d-lg-block">
                        <div className="fw-bold">{user.name || 'User'}</div>
                        <small className="text-white-50 text-uppercase">{user.role || 'Guest'}</small>
                     </div>
                     <Button variant="danger" size="sm" className="fw-bold px-3 rounded-pill" onClick={handleLogout}><FaSignOutAlt className="me-1"/> Logout</Button>
                  </div>
                </Navbar.Collapse>
              </Container>
            </Navbar>
        );
    };

    const fetchAllComments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 👇 الرابط صحيح (Render)
            const data = await fetchData('https://smartschedule1-b64l.onrender.com/api/comments/all');
            setAllComments(data);
        } catch (err) {
            if (err.message.includes("Authentication failed")) {
                navigate('/login');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchAllComments();
    }, [fetchAllComments]);

    // Filter comments based on the selected level
    const filteredComments = selectedLevel
        ? allComments.filter(comment => comment.student_level == selectedLevel) // eslint-disable-line eqeqeq
        : allComments;

    // Group comments by schedule version for better display
    const groupedComments = filteredComments.reduce((acc, comment) => {
        const key = comment.schedule_version_id;
        if (!acc[key]) {
            acc[key] = {
                version_id: key,
                version_comment: comment.version_comment,
                level: comment.student_level,
                comments: []
            };
        }
        acc[key].comments.push(comment);
        return acc;
    }, {});


    return (
        <div className="page-background" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
            <Container fluid="lg" className="pt-3">
                <InternalNavbar />
            </Container>

            <Container fluid="lg" className="main-container">
                <Card className="card-custom border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
                    <Card.Header className="card-header-custom text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                        <h1 className="page-title fw-bold mb-1">Student Feedback</h1>
                        <p className="page-subtitle mb-0 opacity-75">Review comments and feedback on schedule versions</p>
                    </Card.Header>

                    <Card.Body className="p-4 p-lg-5">
                        <div className="mb-4">
                            <Button variant="outline-primary" size="sm" onClick={() => navigate(-1)} className="d-flex align-items-center gap-2 mb-3">
                                <FaArrowLeft /> Back
                            </Button>
                            
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body>
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-primary">Filter Comments by Student Level</Form.Label>
                                        <Form.Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="border-0 shadow-sm">
                                            <option value="">Show All Levels</option>
                                            {academicLevels.map(level => (
                                                <option key={level} value={level}>Level {level}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Card.Body>
                            </Card>
                        </div>

                        {loading ? (
                            <div className="text-center p-5"><Spinner animation="border" variant="primary"/></div>
                        ) : error ? (
                            <Alert variant="danger" className="text-center shadow-sm">{error}</Alert>
                        ) : Object.keys(groupedComments).length === 0 ? (
                            <Alert variant="info" className="text-center border-0 shadow-sm py-5">
                                <h5>No comments found for the selected level.</h5>
                            </Alert>
                        ) : (
                            <div className="d-flex flex-column gap-4">
                                {Object.values(groupedComments).map(group => (
                                    <Card key={group.version_id} className="border-0 shadow-sm">
                                        <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                                            <div>
                                                <span className="text-muted small text-uppercase fw-bold">Version:</span>
                                                <span className="ms-2 fw-bold text-dark">{group.version_comment || `ID ${group.version_id}`}</span>
                                            </div>
                                            <Badge bg="info" className="px-3 py-2 rounded-pill">Level {group.level}</Badge>
                                        </Card.Header>
                                        <ListGroup variant="flush">
                                            {group.comments.map(comment => (
                                                <ListGroup.Item key={comment.comment_id} className="p-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <div className="d-flex align-items-center">
                                                            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{width:'30px', height:'30px', fontSize:'0.8rem'}}>
                                                                {comment.student_name ? comment.student_name.charAt(0).toUpperCase() : 'S'}
                                                            </div>
                                                            <span className="fw-bold text-dark">{comment.student_name}</span>
                                                        </div>
                                                        <small className="text-muted">{new Date(comment.created_at).toLocaleString()}</small>
                                                    </div>
                                                    <div className="bg-light p-3 rounded text-secondary" style={{borderLeft: '3px solid #667eea'}}>
                                                        {comment.comment}
                                                    </div>
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageNotifications;