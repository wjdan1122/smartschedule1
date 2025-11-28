import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Navbar, Nav, Button, Spinner, Alert, Badge, Form } from 'react-bootstrap';
import { FaBook, FaCalendarAlt, FaVoteYea, FaHome, FaSignOutAlt, FaCheckCircle } from 'react-icons/fa';
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

    // --- NEW: State to manage selections in real-time ---
    const [selections, setSelections] = useState({});

    const loadPageData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) { navigate('/login'); return; }
            const user = JSON.parse(userStr);
            setStudentId(user.id);
            setUserInfo({ name: user.name || 'Student', email: user.email || '' });

            // 👇 تم تحديث الرابط هنا
            const existingVotes = await fetchData(`https://smartschedule1-b64l.onrender.com/api/votes/student/${user.id}`);
            if (existingVotes.length > 0) {
                setSubmitted(true);
                return;
            }

            // 👇 تم تحديث الرابط هنا
            const electivesData = await fetchData("https://smartschedule1-b64l.onrender.com/api/courses/elective");
            setElectives(electivesData);
            // Initialize selections state
            const initialSelections = {};
            electivesData.forEach(course => {
                initialSelections[course.course_id] = "";
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

    // --- NEW: Function to handle dropdown changes ---
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
                // 👇 تم تحديث الرابط هنا
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
        localStorage.clear();
        navigate('/login');
    };

    // Get a list of priorities that are already in use
    const usedPriorities = Object.values(selections).filter(p => p);

    return (
        <div className="dashboard-page">
            <Container fluid="lg" className="container-custom shadow-lg">
                <Navbar expand="lg" variant="dark" className="navbar-custom p-3">
                    {/* ... Navbar content ... */}
                </Navbar>

                <main className="main-content p-4 p-md-5">
                    <header className="welcome-section text-center mb-5">
                        <h2 className="text-dark fw-bolder mb-3">Elective Course Voting</h2>
                        <p className="text-secondary fs-6">
                            Rank your preferred elective courses by priority (1 = Most Preferred).
                        </p>
                        {error && <Alert variant="danger" className="mt-3"><strong>Error:</strong> {error}</Alert>}
                    </header>

                    <section className="bg-white rounded-4 p-4 p-md-5 shadow-sm">
                        {loading ? (
                            <div className="text-center py-5"><Spinner /><p className="mt-3 text-muted">Loading voting session...</p></div>
                        ) : !submitted ? (
                            <>
                                <Alert variant="info" className="mb-4">
                                    <strong>ℹ️ Instructions:</strong> Assign a unique <strong>priority number</strong> (1, 2, or 3) to up to <strong>3 courses</strong>.
                                </Alert>
                                <Form onSubmit={handleSubmit}>
                                    <Row as="ul" className="list-unstyled g-3">
                                        {electives.map(course => (
                                            <Col as="li" key={course.course_id} xs={12}>
                                                <Card className="border-2 shadow-sm notification-item-custom">
                                                    <Card.Body className="p-4">
                                                        <Row className="align-items-center">
                                                            <Col md={8}>
                                                                <h5 className="fw-bold text-dark mb-2">{course.name}</h5>
                                                                <Badge bg="secondary">{course.credit} Credits</Badge>
                                                            </Col>
                                                            <Col md={4} className="mt-3 mt-md-0">
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
                                                                            // --- THIS IS THE SMART LOGIC ---
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
                                        <Button type="submit" size="lg" className="vote-btn-custom fw-bold py-3">
                                            <FaCheckCircle className="me-2" /> Submit My Priorities
                                        </Button>
                                    </div>
                                </Form>
                            </>
                        ) : (
                            <div className="text-center py-5">
                                <div style={{ fontSize: '5rem', color: '#28a745' }}><FaCheckCircle /></div>
                                <h3 className="text-success fw-bold mt-4 mb-3">Thank You for Voting!</h3>
                                <p className="text-muted fs-5 mb-4">Your preferences have been submitted and can no longer be changed.</p>
                                <Button size="lg" className="vote-btn-custom fw-bold" onClick={() => navigate('/student-dashboard')}>
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