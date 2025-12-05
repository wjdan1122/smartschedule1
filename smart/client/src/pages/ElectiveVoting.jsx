import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, Badge, Form } from 'react-bootstrap';
// تم تعديل الأيقونات لتتوافق مع ملف StudentDashboard
import { FaUserGraduate, FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaChartLine, FaSave, FaComment, FaArrowCircleRight, FaPaperPlane, FaUserCircle } from 'react-icons/fa';
import '../App.css';

// Generic fetchData function (Remains unchanged)
const fetchData = async (url, method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
    };
    if (body) { options.body = JSON.stringify(body); }
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        throw new Error("Authentication failed.");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request Failed' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

function ElectiveVoting() {
    const [electives, setElectives] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [studentId, setStudentId] = useState(null);
    const [userInfo, setUserInfo] = useState({ name: 'Student', email: '' });
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // --- State to manage selections in real-time ---
    const [selections, setSelections] = useState({});

    const loadPageData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) { navigate('/login'); return; }
            const user = JSON.parse(userStr);
            setStudentId(user.id);
            // تم تعديل هذا الجزء ليتطابق مع ما يتم تخزينه في ملف StudentDashboard
            setUserInfo({ 
                name: user.name || 'Student', 
                email: user.email || '',
                level: user.level 
            });

            // Fetch existing votes (URLs kept as in the original code)
            const existingVotes = await fetchData(`https://smartschedule1-b64l.onrender.com/api/votes/student/${user.id}`);
            if (existingVotes.length > 0) {
                setSubmitted(true);
                return;
            }

            // Fetch electives data
            const electivesData = await fetchData("https://smartschedule1-b64l.onrender.com/api/courses/elective");
            setElectives(electivesData);
            
            // Initialize selections state
            const initialSelections = {};
            electivesData.forEach(course => {
                const existingVote = existingVotes.find(v => v.course_id === course.course_id);
                initialSelections[course.course_id] = existingVote ? String(existingVote.vote_value) : "";
            });
            setSelections(initialSelections);

        } catch (err) {
            console.error("Error loading data:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadPageData();
    }, [loadPageData]);

    // --- Function to handle dropdown changes ---
    const handleSelectionChange = (courseId, priority) => {
        setSelections(prev => ({
            ...prev,
            [courseId]: priority
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!studentId) return alert("Student ID not found. Please refresh.");

        const selected = Object.entries(selections)
            .filter(([courseId, priority]) => priority)
            .map(([courseId, priority]) => ({
                course_id: parseInt(courseId),
                priority: parseInt(priority),
            }));

        if (selected.length === 0) return alert("Please assign at least one priority.");
        if (selected.length > 3) return alert("You can assign a maximum of three priorities only.");

        // This check is now redundant due to the smart UI, but we keep it as a safeguard
        const priorities = selected.map(s => s.priority);
        if (new Set(priorities).size !== priorities.length)
            return alert("Each priority number (1, 2, 3) must be used only once.");

        try {
            for (const vote of selected) {
                await fetchData("https://smartschedule1-b64l.onrender.com/api/vote", "POST", {
                    student_id: studentId,
                    course_id: vote.course_id,
                    vote_value: vote.priority
                });
            }
            setSubmitted(true);
        } catch (err) {
            alert(`Error submitting votes: ${err.message}`);
            console.error(err);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            navigate('/login');
        }
    };

    // Get a list of priorities that are already in use (Smart UI Logic)
    const usedPriorities = Object.values(selections).filter(p => p);

    return (
        <div className="dashboard-page">
            <Container fluid="lg" className="container-custom shadow-lg p-0">
                {/* ==========================================================
                ✅ شريط التنقل الموحد (Unified Navbar)
                ========================================================== 
                */}
                <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
                    <Navbar.Brand className="fw-bold fs-5">STUDENT DASHBOARD</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto my-2 my-lg-0 nav-menu">
                            <Nav.Link onClick={() => navigate('/student-dashboard')} className="nav-link-custom"><FaHome className="me-2" /> DASHBOARD</Nav.Link>
                            {/* تم تعيين هذا الرابط كنشط */}
                            <Nav.Link onClick={() => navigate('/elective-voting')} className="nav-link-custom active"><FaVoteYea className="me-2" /> VOTING</Nav.Link>
                        </Nav>
                        <div className="d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
                            <div className="user-info text-white text-start me-3">
                                <div className="user-name fw-bold">{userInfo.name}</div>
                                <div className="user-role" style={{ opacity: 0.8, fontSize: '0.8rem' }}>{userInfo.email}</div>
                            </div>
                            <Button variant="danger" className="logout-btn fw-bold" onClick={handleLogout}>
                                <FaSignOutAlt className="me-1" /> Logout
                            </Button>
                        </div>
                    </Navbar.Collapse>
                </Navbar>
                
                {/* ==========================================================
                ✅ محتوى الصفحة الرئيسي
                ========================================================== 
                */}
                <main className="main-content p-4 p-md-5">
                    <Row className="justify-content-center">
                        <Col lg={12} xl={10}>
                            
                            <Card className="shadow-lg border-0 rounded-4">
                                <Card.Header className="bg-primary text-white p-4 rounded-top-4">
                                    <h3 className="mb-1 fw-bolder d-flex align-items-center"><FaVoteYea className="me-2" /> Elective Course Voting</h3>
                                    <p className="mb-0 fs-6">
                                        Rank your preferred elective courses by priority (1, 2, 3).
                                    </p>
                                </Card.Header>
                                <Card.Body className="p-4 p-md-5">

                                    {error && <Alert variant="danger" className="mt-3"><strong>Error:</strong> {error}</Alert>}

                                    {loading ? (
                                        <div className="text-center py-5"><Spinner animation="border" /><p className="mt-3 text-muted">Loading voting session...</p></div>
                                    ) : !submitted ? (
                                        <>
                                            <Alert variant="info" className="mb-4 d-flex align-items-center">
                                                <FaBook style={{ fontSize: '1.5rem', marginRight: '10px' }}/>
                                                <div>
                                                    <strong>Instructions:</strong> Assign a **unique priority number** (1, 2, or 3) to up to **3 courses**.
                                                </div>
                                            </Alert>
                                            
                                            <Form onSubmit={handleSubmit}>
                                                <Row as="ul" className="list-unstyled g-3">
                                                    {electives.map(course => (
                                                        <Col as="li" key={course.course_id} xs={12}>
                                                            <Card className="border-2 shadow-sm notification-item-custom">
                                                                <Card.Body className="p-4">
                                                                    <Row className="align-items-center">
                                                                        <Col md={7}>
                                                                            <h5 className="fw-bold text-dark mb-1">{course.name}</h5>
                                                                            <p className="text-muted mb-0">Code: {course.dept_code}-{course.course_id}</p>
                                                                            <Badge bg="secondary" className="mt-2">{course.credit} Credits</Badge>
                                                                        </Col>
                                                                        <Col md={5} className="mt-3 mt-md-0">
                                                                            <Form.Select
                                                                                className="form-select-lg"
                                                                                value={selections[course.course_id]}
                                                                                onChange={(e) => handleSelectionChange(course.course_id, e.target.value)}
                                                                            >
                                                                                <option value="">-- Select Priority --</option>
                                                                                {[1, 2, 3].map(p => (
                                                                                    <option
                                                                                        key={p}
                                                                                        value={p}
                                                                                        // Disable if this priority is used by another course
                                                                                        disabled={usedPriorities.includes(String(p)) && selections[course.course_id] !== String(p)}
                                                                                    >
                                                                                        Priority {p} {p === 1 ? '(Most Preferred)' : ''}
                                                                                    </option>
                                                                                ))}
                                                                            </Form.Select>
                                                                        </Col>
                                                                    </Row>
                                                                </Card.Body>
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                                <div className="d-grid mt-4">
                                                    <Button 
                                                        type="submit" 
                                                        size="lg" 
                                                        variant="primary" // استخدام اللون الأساسي ليتناسب مع لوحة التحكم
                                                        className="vote-btn-custom fw-bold py-3"
                                                        disabled={usedPriorities.length === 0} // Disable if nothing is selected
                                                    >
                                                        <FaCheckCircle className="me-2" /> Submit My Priorities ({usedPriorities.length} selected)
                                                    </Button>
                                                </div>
                                            </Form>
                                        </>
                                    ) : (
                                        <div className="text-center py-5">
                                            <div style={{ fontSize: '5rem', color: '#28a745' }}><FaCheckCircle /></div>
                                            <h3 className="text-success fw-bold mt-4 mb-3">Thank You for Voting!</h3>
                                            <p className="text-muted fs-5 mb-4">Your preferences have been submitted and can no longer be changed.</p>
                                            <Button size="lg" variant="primary" className="vote-btn-custom fw-bold" onClick={() => navigate('/student-dashboard')}>
                                                <FaHome className="me-2" /> Return to Dashboard
                                            </Button>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </main>
            </Container>
        </div>
    );
}

export default ElectiveVoting;
