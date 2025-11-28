import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, ListGroup, Table, Form } from 'react-bootstrap';
import { FaUserGraduate, FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaChartLine, FaSave, FaComment, FaArrowCircleRight, FaPaperPlane } from 'react-icons/fa';
import '../App.css';

// Generic fetchData function
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
        throw new Error("Authentication failed. Please log in again.");
    }
    const data = await response.json().catch(() => ({ message: 'Server returned a non-JSON response.' }));
    if (!response.ok) {
        throw new Error(data.message || `Request failed with status: ${response.status}`);
    }
    return data;
};

// --- Schedule Viewer Component (Simplified for Comment Test) ---
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
            // 👇 تم تعديل الرابط هنا
            const coursesData = await fetchData('https://smartschedule1-b64l.onrender.com/api/courses');
            setAllCourses(coursesData || []);
            // 👇 تم تعديل الرابط هنا
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
            // 👇 تم تعديل الرابط هنا
            await fetchData('https://smartschedule1-b64l.onrender.com/api/comments', 'POST', payload);
            setNewComment("");
            setSubmitSuccess("Comment submitted successfully!");
        } catch (err) {
            setSubmitError(`Failed to post comment: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-4 mt-4"><Spinner /></div>;
    if (error) return <Alert variant="warning" className="text-center mt-4">{error}</Alert>;
    if (!schedule) return <Alert variant="info" className="text-center mt-4">No active schedule for Level {level}.</Alert>;

    // Table rendering logic... (unchanged)
    const renderTable = () => {
        // ... (The full table rendering logic goes here)
        const scheduleMap = {};
        const sectionsArray = schedule.sections && typeof schedule.sections === 'string' ? JSON.parse(schedule.sections) : (Array.isArray(schedule.sections) ? schedule.sections : []);
        sectionsArray.forEach(sec => {
            const dayMap = { 'S': 'Sunday', 'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 'H': 'Thursday' };
            const dayKey = dayMap[sec.day_code];
            if (dayKey && sec.start_time && sec.end_time) {
                if (!scheduleMap[dayKey]) scheduleMap[dayKey] = [];
                const courseInfo = allCourses.find(c => c.course_id === sec.course_id);
                const courseName = courseInfo ? courseInfo.name : `Course ${sec.course_id}`;
                scheduleMap[dayKey].push({ start: sec.start_time.substring(0, 5), end: sec.end_time.substring(0, 5), content: `${sec.dept_code || ''} ${courseName}` });
            }
        });
        return (
            <div className="overflow-x-auto">
                <Table bordered className="text-center align-middle mt-3">
                    <thead className="table-light"><tr><th style={{ minWidth: '100px' }}>Day</th>{timeSlots.map(time => <th key={time}>{`${time} - ${String(parseInt(time.substring(0, 2)) + 1).padStart(2, '0')}:00`}</th>)}</tr></thead>
                    <tbody>{daysOfWeek.map(day => { const daySections = scheduleMap[day] || []; const cells = []; let i = 0; while (i < timeSlots.length) { const slotStart = timeSlots[i]; const section = daySections.find(s => s.start === slotStart); if (section) { const duration = parseInt(section.end.split(':')[0]) - parseInt(section.start.split(':')[0]); cells.push(<td key={slotStart} colSpan={duration || 1} className="bg-primary bg-opacity-10 fw-bold">{section.content}</td>); i += (duration || 1); } else { const isOverlapped = daySections.some(s => parseInt(slotStart.split(':')[0]) > parseInt(s.start.split(':')[0]) && parseInt(slotStart.split(':')[0]) < parseInt(s.end.split(':')[0])); if (!isOverlapped) { cells.push(<td key={slotStart} className="text-muted"> - </td>); } i++; } } return <tr key={day}><td className="fw-bold bg-light">{day}</td>{cells}</tr>; })}</tbody>
                </Table>
            </div>
        );
    };

    return (
        <Card className="mt-4 shadow-sm">
            <Card.Header className="bg-primary text-white"><h4 className="mb-0">Active Schedule for Level {level}</h4></Card.Header>
            <Card.Body>{renderTable()}</Card.Body>
            <Card.Footer>
                <Form onSubmit={handleCommentSubmit}>
                    {submitError && <Alert variant="danger">{submitError}</Alert>}
                    {submitSuccess && <Alert variant="success">{submitSuccess}</Alert>}
                    <Form.Group>
                        <Form.Label className="fw-bold">Add a New Comment</Form.Label>
                        <Form.Control
                            as="textarea" rows={3} value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write your feedback..." required />
                    </Form.Group>
                    <Button variant="primary" type="submit" className="mt-2" disabled={isSubmitting}>
                        {isSubmitting ? <Spinner size="sm" /> : <FaPaperPlane />} Post Comment
                    </Button>
                </Form>
            </Card.Footer>
        </Card>
    );
};

// --- Main StudentDashboard Component ---
function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewingLevel, setViewingLevel] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) { navigate('/login'); return; }
        try {
            const userData = JSON.parse(userStr);
            if (userData && userData.email) { setUser(userData); }
            else { throw new Error("Invalid user data in storage."); }
        } catch (err) {
            console.error("Failed to parse user data:", err);
            localStorage.clear(); navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            navigate('/login');
        }
    };

    if (loading || !user) {
        return <div className="d-flex justify-content-center align-items-center min-vh-100"><Spinner /></div>;
    }

    return (
        <div className="dashboard-page">
            <Container fluid="lg" className="container-custom shadow-lg">
                <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
                    <Navbar.Brand className="fw-bold fs-5">STUDENT DASHBOARD</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto my-2 my-lg-0 nav-menu">
                            <Nav.Link onClick={() => navigate('/student-dashboard')} className="nav-link-custom active"><FaHome className="me-2" /> DASHBOARD</Nav.Link>
                            <Nav.Link onClick={() => navigate('/elective-voting')} className="nav-link-custom"><FaVoteYea className="me-2" /> VOTING</Nav.Link>
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

                <main className="main-content p-4 p-md-5">
                    <header className="welcome-section text-center mb-5">
                        <h2 className="text-dark fw-bolder mb-3">Welcome, {user.name}!</h2>
                    </header>
                    <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm">
                        <h3 className="text-dark mb-3 d-flex align-items-center"><FaCalendarAlt className="me-2 text-primary" /> View Schedules</h3>
                        <p className="text-muted mb-4">You are currently in Level {user.level}. Select a schedule to view and add comments.</p>
                        <div className="d-flex flex-wrap gap-2">
                            <Button
                                variant={viewingLevel === user.level ? 'primary' : 'outline-primary'}
                                onClick={() => setViewingLevel(user.level)}
                            >
                                View My Current Level ({user.level}) Schedule
                            </Button>
                            <Button
                                variant={viewingLevel === user.level + 1 ? 'primary' : 'outline-primary'}
                                onClick={() => setViewingLevel(user.level + 1)}
                            >
                                Preview Next Level ({user.level + 1}) Schedule <FaArrowCircleRight className="ms-1" />
                            </Button>
                        </div>
                        {viewingLevel && <ScheduleViewer level={viewingLevel} token={localStorage.getItem('token')} studentId={user.id} />}
                    </section>
                </main>
            </Container>
        </div>
    );
}

export default StudentDashboard;