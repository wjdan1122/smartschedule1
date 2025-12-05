import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, ListGroup, Table, Form } from 'react-bootstrap';
import { FaUserGraduate, FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaChartLine, FaSave, FaComment, FaArrowCircleRight, FaPaperPlane } from 'react-icons/fa';
import '../App.css';

// Generic fetchData function (from StudentDashboard)
const fetchData = async (url, method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        throw new Error("Authentication failed. Please log in again.");
    }
    const data = await response.json().catch(() => ({ message: 'Server returned a non-JSON response.' }));
    if (!response.ok) {
        throw new Error(data.message || `Request failed with status: ${response.status}`);
    }
    return data;
};

function ElectiveVoting() {
    const [electives, setElectives] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [studentId, setStudentId] = useState(null);
    const [userInfo, setUserInfo] = useState({ name: 'Student', email: '' });
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [selections, setSelections] = useState({});
    const [viewingLevel, setViewingLevel] = useState(null);
    const [user, setUser] = useState(null);

    // --- Load user and voting data ---
    const loadPageData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) {
                navigate('/login');
                return;
            }
            const userData = JSON.parse(userStr);
            setUser(userData);
            setStudentId(userData.id);
            setUserInfo({ name: userData.name || 'Student', email: userData.email || '' });

            // Fetch existing votes
            const existingVotes = await fetchData(`https://smartschedule1-b64l.onrender.com/api/votes/student/${userData.id}`);
            if (existingVotes.length > 0) {
                setSubmitted(true);
                return;
            }

            // Fetch electives
            const electivesData = await fetchData("https://smartschedule1-b64l.onrender.com/api/courses/elective");
            setElectives(electivesData);

            // Initialize selections
            const initialSelections = {};
            electivesData.forEach(course => {
                const existingVote = existingVotes.find(v => v.course_id === course.course_id);
                initialSelections[course.course_id] = existingVote ? String(existingVote.vote_value) : "";
            });
            setSelections(initialSelections);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadPageData();
    }, [loadPageData]);

    // --- Handle selection change ---
    const handleSelectionChange = (courseId, priority) => {
        setSelections(prev => ({ ...prev, [courseId]: priority }));
    };

    // --- Submit votes ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!studentId) return alert("Student ID not found. Please refresh.");
        const selected = Object.entries(selections)
            .filter(([courseId, priority]) => priority)
            .map(([courseId, priority]) => ({
                course_id: parseInt(courseId),
                vote_value: parseInt(priority),
            }));
        if (selected.length === 0) return alert("Please assign at least one priority.");
        if (selected.length > 3) return alert("You can assign a maximum of three priorities only.");
        const priorities = selected.map(s => s.vote_value);
        if (new Set(priorities).size !== priorities.length) return alert("Each priority number (1, 2, 3) must be used only once.");
        try {
            for (const vote of selected) {
                await fetchData("https://smartschedule1-b64l.onrender.com/api/vote", "POST", {
                    student_id: studentId,
                    course_id: vote.course_id,
                    vote_value: vote.vote_value
                });
            }
            setSubmitted(true);
        } catch (err) {
            alert(`Error submitting votes: ${err.message}`);
            console.error(err);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.clear();
            navigate('/login');
        }
    };

    // Get used priorities for UI
    const usedPriorities = Object.values(selections).filter(p => p);

    // --- Schedule Viewer (copied from StudentDashboard) ---
    const ScheduleViewer = ({ level, token, studentId }) => {
        const [schedule, setSchedule] = useState(null);
        const [allCourses, setAllCourses] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [newComment, setNewComment] = useState("");
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [submitError, setSubmitError] = useState("");
        const [submitSuccess, setSubmitSuccess] = useState("");
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

        const fetchScheduleData = useCallback(async () => {
            if (!level || !token) return;
            setLoading(true);
            setError(null);
            try {
                const coursesData = await fetchData('https://smartschedule1-b64l.onrender.com/api/courses');
                setAllCourses(coursesData || []);
                const scheduleData = await fetchData(`https://smartschedule1-b64l.onrender.com/api/schedules/level/${level}`);
                setSchedule(scheduleData.schedule);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }, [level, token]);

        useEffect(() => {
            fetchScheduleData();
        }, [fetchScheduleData]);

        const handleCommentSubmit = async (e) => {
            e.preventDefault();
            setSubmitError("");
            setSubmitSuccess("");
            const payload = {
                student_id: studentId,
                schedule_version_id: schedule ? schedule.id : null,
                comment: newComment.trim()
            };
            if (!payload.comment || !payload.student_id || !payload.schedule_version_id) {
                setSubmitError("Cannot post comment: Missing required data.");
                return;
            }
            setIsSubmitting(true);
            try {
                await fetchData('https://smartschedule1-b64l.onrender.com/api/comments', 'POST', payload);
                setNewComment("");
                setSubmitSuccess("Comment submitted successfully!");
            } catch (err) {
                setSubmitError(`Failed to post comment: ${err.message}`);
            } finally {
                setIsSubmitting(false);
            }
        };

        if (loading) return (
            <div className="text-center p-4 mt-4">
                <Spinner animation="border" />
            </div>
        );
        if (error) return (
            <Alert variant="warning" className="text-center mt-4">
                {error}
            </Alert>
        );
        if (!schedule) return (
            <Alert variant="info" className="text-center mt-4">
                No active schedule for Level {level}.
            </Alert>
        );

        // Build schedule map
        const scheduleMap = {};
        const sectionsArray = typeof schedule.sections === 'string' ? JSON.parse(schedule.sections) : (Array.isArray(schedule.sections) ? schedule.sections : []);
        sectionsArray.forEach(sec => {
            const dayMap = { S: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', H: 'Thursday' };
            const dayKey = dayMap[sec.day_code];
            if (dayKey && sec.start_time && sec.end_time) {
                if (!scheduleMap[dayKey]) scheduleMap[dayKey] = [];
                const courseInfo = allCourses.find(c => c.course_id === sec.course_id);
                const courseName = courseInfo ? courseInfo.name : `Course ${sec.course_id}`;
                scheduleMap[dayKey].push({
                    start: sec.start_time.substring(0, 5),
                    end: sec.end_time.substring(0, 5),
                    content: `${sec.dept_code} ${courseName}`
                });
            }
        });

        const renderTable = () => {
            return (
                <Table bordered className="text-center align-middle mt-3">
                    <thead className="table-light">
                        <tr>
                            <th style={{ minWidth: '100px' }}>Day</th>
                            {timeSlots.map(time => (
                                <th key={time}>
                                    {time} - {String(parseInt(time.substring(0, 2)) + 1).padStart(2, '0')}:00
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {daysOfWeek.map(day => {
                            const daySections = scheduleMap[day] || [];
                            const cells = [];
                            let i = 0;
                            while (i < timeSlots.length) {
                                const slotStart = timeSlots[i];
                                const section = daySections.find(s => s.start === slotStart);
                                if (section) {
                                    const duration = parseInt(section.end.split(':')[0]) - parseInt(section.start.split(':')[0]);
                                    cells.push(
                                        <td key={slotStart} colSpan={duration || 1} className="bg-primary bg-opacity-10 fw-bold">
                                            {section.content}
                                        </td>
                                    );
                                    i += (duration || 1);
                                } else {
                                    const isOverlapped = daySections.some(s =>
                                        parseInt(slotStart.split(':')[0]) > parseInt(s.start.split(':')[0]) &&
                                        parseInt(slotStart.split(':')[0]) < parseInt(s.end.split(':')[0])
                                    );
                                    if (!isOverlapped) {
                                        cells.push(<td key={slotStart} className="text-muted">-</td>);
                                    }
                                    i++;
                                }
                            }
                            return (
                                <tr key={day}>
                                    <td className="fw-bold bg-light">{day}</td>
                                    {cells}
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            );
        };

        return (
            <Card className="mt-4 shadow-sm">
                <Card.Header className="bg-primary text-white">
                    <h4 className="mb-0">Active Schedule for Level {level}</h4>
                </Card.Header>
                <Card.Body>
                    {renderTable()}
                </Card.Body>
                <Card.Footer>
                    <Form onSubmit={handleCommentSubmit}>
                        {submitError && <Alert variant="danger">{submitError}</Alert>}
                        {submitSuccess && <Alert variant="success">{submitSuccess}</Alert>}
                        <Form.Group>
                            <Form.Label className="fw-bold">Add a New Comment</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write your feedback..."
                                required
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="mt-2" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner size="sm" /> : <FaPaperPlane />} Post Comment
                        </Button>
                    </Form>
                </Card.Footer>
            </Card>
        );
    };

    // --- Main JSX (same structure as StudentDashboard) ---
    if (loading && !user) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100">
                <Spinner animation="border" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100">
                <Alert variant="danger">User not found. Redirecting to login...</Alert>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <Container fluid="lg" className="container-custom shadow-lg">
                {/* Navbar */}
                <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
                    <Navbar.Brand className="fw-bold fs-5">STUDENT DASHBOARD</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto my-2 my-lg-0 nav-menu">
                            <Nav.Link onClick={() => navigate('/student-dashboard')} className="nav-link-custom active">
                                <FaHome className="me-2" /> DASHBOARD
                            </Nav.Link>
                            <Nav.Link onClick={() => navigate('/elective-voting')} className="nav-link-custom">
                                <FaVoteYea className="me-2" /> ELECTIVE VOTING
                            </Nav.Link>
                        </Nav>
                        <div className="d-flex align-items-center ms-lg-4 mt-3 mt-lg-0">
                            <div className="user-info text-white text-start me-3">
                                <div className="user-name fw-bold">{user.name}</div>
                                <div className="user-role" style={{ opacity: 0.8, fontSize: '0.8rem' }}>{user.email}</div>
                            </div>
                            <Button variant="danger" className="logout-btn fw-bold" onClick={handleLogout}>
                                <FaSignOutAlt className="me-1" /> Logout
                            </Button>
                        </div>
                    </Navbar.Collapse>
                </Navbar>

                {/* Main Content */}
                <main className="main-content p-4 p-md-5">
                    <header className="welcome-section text-center mb-5">
                        <h2 className="text-dark fw-bolder mb-3">Welcome, {user.name}!</h2>
                    </header>

                    <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm">
                        <h3 className="text-dark mb-3 d-flex align-items-center">
                            <FaBook className="me-2 text-primary" /> Elective Course Voting
                        </h3>
                        <p className="text-muted mb-4">
                            Rank your preferred elective courses by priority (1, 2, 3).
                        </p>

                        {error && (
                            <Alert variant="danger" className="mt-3">
                                <strong>Error:</strong> {error}
                            </Alert>
                        )}

                        {loading ? (
                            <div className="text-center py-5">
                                <Spinner animation="border" />
                                <p className="mt-3 text-muted">Loading voting session...</p>
                            </div>
                        ) : !submitted ? (
                            <>
                                <Alert variant="info" className="mb-4 d-flex align-items-center">
                                    <FaBook style={{ fontSize: '1.5rem', marginRight: '10px' }} />
                                    <div>
                                        <strong>Instructions</strong>
                                        <div>Assign a unique priority number (1, 2, or 3) to up to 3 courses.</div>
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
                                                                <Badge bg="secondary" className="mt-2">
                                                                    {course.credit} Credits
                                                                </Badge>
                                                            </Col>
                                                            <Col md={5} className="mt-3 mt-md-0">
                                                                <Form.Select
                                                                    className="form-select-lg"
                                                                    value={selections[course.course_id] || ""}
                                                                    onChange={(e) => handleSelectionChange(course.course_id, e.target.value)}
                                                                >
                                                                    <option value="">-- Select Priority --</option>
                                                                    {[1, 2, 3].map(p => (
                                                                        <option
                                                                            key={p}
                                                                            value={p}
                                                                            disabled={usedPriorities.includes(String(p)) && selections[course.course_id] !== String(p)}
                                                                        >
                                                                            Priority {p} {p === 1 ? "(Most Preferred)" : ""}
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
                                            className="vote-btn-custom fw-bold py-3"
                                            disabled={usedPriorities.length === 0}
                                        >
                                            <FaCheckCircle className="me-2" /> Submit My Priorities ({usedPriorities.length})
                                        </Button>
                                    </div>
                                </Form>
                            </>
                        ) : (
                            <div className="text-center py-5">
                                <div style={{ fontSize: '5rem', color: '#28a745' }}>
                                    <FaCheckCircle />
                                </div>
                                <h3 className="text-success fw-bold mt-4 mb-3">Thank You for Voting!</h3>
                                <p className="text-muted fs-5 mb-4">
                                    Your preferences have been submitted and can no longer be changed.
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
