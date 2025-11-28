import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Badge, Spinner, Navbar, Nav } from 'react-bootstrap';
import { FaUserGraduate, FaSave, FaUndo, FaTrash, FaHome, FaCalendarAlt, FaUsers, FaBook, FaBalanceScale, FaBell, FaCheckCircle, FaSignOutAlt, FaVoteYea } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import { studentAPI } from '../services/api'; 
import '../App.css';

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const ManageStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        studentId: '',
        studentName: '',
        currentLevel: ''
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('all');
    const navigate = useNavigate();
    const location = useLocation();

    const levels = [3, 4, 5, 6, 7, 8];

    // --- Internal Navbar Component (Self-Contained) ---
    const InternalNavbar = () => {
        let user = {};
        try {
            user = JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {
            console.error("Error parsing user data", e);
        }
        const role = String(user.role || '').toLowerCase();
        const type = user.type || '';
        
        const handleLogout = () => {
            if (window.confirm("Are you sure you want to logout?")) {
                localStorage.clear();
                navigate('/login');
            }
        };

        const isActive = (path) => location.pathname === path ? 'active' : '';

        return (
            <Navbar expand="lg" variant="dark" className="navbar-custom p-3 shadow-lg mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
                <Container fluid>
                    <Navbar.Brand className="fw-bold fs-4 d-flex align-items-center">
                        <span className="me-2">🎓</span> KSU SmartSchedule
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="navbar-nav" />
                    <Navbar.Collapse id="navbar-nav">
                        <Nav className="mx-auto my-2 my-lg-0">
                            {(type === 'student' || role === 'student') && (
                                <>
                                    <Nav.Link onClick={() => navigate('/student-dashboard')} className={`nav-link-custom ${isActive('/student-dashboard')}`}><FaHome className="me-2" /> Dashboard</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/elective-voting')} className={`nav-link-custom ${isActive('/elective-voting')}`}><FaVoteYea className="me-2" /> Voting</Nav.Link>
                                </>
                            )}
                            {(role.includes('schedule') || role.includes('admin') || role === 'registrar') && (
                                <>
                                    <Nav.Link onClick={() => navigate('/dashboard')} className={`nav-link-custom ${isActive('/dashboard')}`}><FaHome className="me-2" /> Home</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/manageSchedules')} className={`nav-link-custom ${isActive('/manageSchedules')}`}><FaCalendarAlt className="me-2" /> Schedules</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/managestudents')} className={`nav-link-custom ${isActive('/managestudents')}`}><FaUsers className="me-2" /> Students</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/addElective')} className={`nav-link-custom ${isActive('/addElective')}`}><FaBook className="me-2" /> Courses</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/managerules')} className={`nav-link-custom ${isActive('/managerules')}`}><FaBalanceScale className="me-2" /> Rules</Nav.Link>
                                    <Nav.Link onClick={() => navigate('/managenotifications')} className={`nav-link-custom ${isActive('/managenotifications')}`}><FaBell className="me-2" /> Comments</Nav.Link>
                                </>
                            )}
                            {role.includes('faculty') && (
                                <Nav.Link onClick={() => navigate('/faculty')} className={`nav-link-custom ${isActive('/faculty')}`}><FaBook className="me-2" /> Faculty</Nav.Link>
                            )}
                            {role.includes('committee') && (
                                <Nav.Link onClick={() => navigate('/load-committee')} className={`nav-link-custom ${isActive('/load-committee')}`}><FaCheckCircle className="me-2" /> Committee</Nav.Link>
                            )}
                        </Nav>
                        <div className="d-flex align-items-center mt-3 mt-lg-0">
                            <div className="text-white text-end me-3 d-none d-lg-block" style={{lineHeight: '1.2'}}>
                                <div className="fw-bold" style={{ fontSize: '0.9rem' }}>{user.name || 'User'}</div>
                                <div style={{ opacity: 0.7, fontSize: '0.75rem' }} className="text-uppercase">{user.role || 'Guest'}</div>
                            </div>
                            <Button variant="danger" size="sm" className="fw-bold px-3 py-2 rounded-pill shadow-sm" onClick={handleLogout}>
                                <FaSignOutAlt className="me-1" /> Logout
                            </Button>
                        </div>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        );
    };

    const showMessage = (text, type) => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Fetch Students
    const fetchAllStudents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await studentAPI.getAll();
            setStudents(response.data || []);
        } catch (err) {
            console.error('Error fetching students:', err.response || err);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                setError('Authentication failed. Please log in again.');
                showMessage('Authentication failed.', 'danger');
                navigate('/login');
            } else {
                setError('Failed to load student data.');
            }
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchAllStudents();
    }, [fetchAllStudents]);

    // Add New Student
    const handleSubmit = async (e) => {
        e.preventDefault();
        const { studentId, studentName, currentLevel } = formData;

        if (!studentId || !studentName || !currentLevel) {
            showMessage('Please fill in all fields.', 'danger');
            return;
        }

        try {
            const newStudentData = {
                studentId: studentId,
                studentName: studentName,
                level: parseInt(currentLevel),
                email: `${studentId}@student.ksu.edu.sa`,
                password: 'ksu_default_pwd',
                is_ir: true,
            };

            await studentAPI.create(newStudentData);
            fetchAllStudents();
            setFormData({ studentId: '', studentName: '', currentLevel: '' });
            showMessage(`Student ${studentName} added successfully!`, 'success');
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message || 'Failed to add student.';
            showMessage(errMsg, 'danger');
        }
    };

    // Delete Student
    const deleteStudent = async (studentId) => {
        if (window.confirm('Are you sure you want to delete this student?')) {
            try {
                await studentAPI.delete(studentId);
                fetchAllStudents();
                showMessage('Student deleted successfully.', 'info');
            } catch (err) {
                const errMsg = err.response?.data?.error || err.message || 'Failed to delete student.';
                showMessage(errMsg, 'danger');
            }
        }
    };

    // Save Changes
    const saveStudentChanges = async (studentId, newLevel) => {
        try {
            const updateData = { level: parseInt(newLevel) };
            await studentAPI.update(studentId, updateData);
            fetchAllStudents();
            showMessage(`Changes saved!`, 'success');
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message || 'Failed to save changes.';
            showMessage(errMsg, 'danger');
        }
    };

    const resetStudent = () => {
        showMessage('Student data reset (mock action)', 'info');
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredStudents = students.filter(student => {
        const name = (student?.name || student?.studentName || '').toLowerCase();
        const matchesSearch = !normalizedSearch || name.includes(normalizedSearch) || String(student?.student_id || '').includes(normalizedSearch);
        const matchesLevel = levelFilter === 'all' || Number(student?.level) === Number(levelFilter);
        return matchesSearch && matchesLevel;
    });

    return (
        <div className="page-background" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
            <Container fluid="lg" className="pt-3">
                <InternalNavbar />
            </Container>

            <Container fluid="lg" className="main-container">
                <Card className="card-custom border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
                    <Card.Header className="card-header-custom text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                        <h1 className="page-title fw-bold mb-1">Manage Students</h1>
                        <p className="page-subtitle mb-0 opacity-75">
                            Add, edit, or remove students and assign levels
                        </p>
                    </Card.Header>

                    <Card.Body className="p-4 p-lg-5">
                        {/* Add Student Form */}
                        <Card className="mb-4 shadow-sm border-0 bg-light" style={{ borderRadius: '15px' }}>
                            <Card.Body className="p-4">
                                <h4 className="mb-4 d-flex align-items-center text-primary fw-bold">
                                    <FaUserGraduate className="me-2" style={{ fontSize: '1.5rem' }} />
                                    Add New Student
                                </h4>

                                {(error || message.text) && (
                                    <Alert variant={error ? 'danger' : message.type} className="text-center fw-bold shadow-sm">
                                        {error || message.text}
                                    </Alert>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    <Row className="mb-3 g-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold text-secondary">Student ID</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="studentId"
                                                    placeholder="441000123"
                                                    value={formData.studentId}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="border-0 shadow-sm p-3"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold text-secondary">Student Name</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="studentName"
                                                    placeholder="Enter full student name"
                                                    value={formData.studentName}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="border-0 shadow-sm p-3"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row className="mb-4">
                                        <Col md={12}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold text-secondary">Current Level</Form.Label>
                                                <Form.Select
                                                    name="currentLevel"
                                                    value={formData.currentLevel}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="border-0 shadow-sm p-3"
                                                >
                                                    <option value="" disabled>Select current level</option>
                                                    {levels.map(level => (
                                                        <option key={level} value={level}>Level {level}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Button
                                        type="submit"
                                        className="w-100 fw-bold py-3 rounded-pill shadow-sm"
                                        style={{
                                            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                                            border: 'none',
                                            fontSize: '1rem'
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? <Spinner size="sm" animation="border" /> : 'Add Student'}
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>

                        {/* Filters */}
                        {!loading && (
                            <Row className="gy-3 gx-4 mb-4 align-items-end">
                                <Col md={8}>
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary">Quick Search</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search by student name or ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="border-0 shadow-sm p-2"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label className="fw-bold text-secondary">Filter by Level</Form.Label>
                                        <Form.Select
                                            value={levelFilter}
                                            onChange={(e) => setLevelFilter(e.target.value)}
                                            className="border-0 shadow-sm p-2"
                                        >
                                            <option value="all">All levels</option>
                                            {levels.map(level => (
                                                <option key={level} value={level}>Level {level}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                        )}

                        {/* Students List */}
                        {loading ? (
                            <div className="text-center p-5">
                                <Spinner animation="grow" variant="primary" />
                                <p className="mt-3 text-muted">Loading students list...</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="text-center text-gray-600 p-5 bg-light border border-2 border-light rounded-3">
                                <p className="mb-0 text-muted">No students currently in the list.</p>
                            </div>
                        ) : filteredStudents.length > 0 ? (
                            <Row xs={1} md={2} className="g-4">
                                {filteredStudents.map(student => (
                                    <Col key={student.student_id}>
                                        <Card
                                            className="h-100 shadow-sm border-0 bg-white"
                                            style={{ borderRadius: '15px', transition: 'transform 0.2s' }}
                                        >
                                            <Card.Body className="p-4">
                                                <div className="mb-3 pb-3 border-bottom">
                                                    <div className="mb-2">
                                                        <Badge bg="primary" className="px-3 py-2 rounded-pill me-2">
                                                            ID: {student.student_id}
                                                        </Badge>
                                                        {student.is_ir && (
                                                            <Badge bg="info" className="px-3 py-2 rounded-pill">
                                                                IR_ST
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="fs-5 fw-bold text-dark text-truncate">
                                                        {student.name}
                                                    </div>
                                                </div>

                                                <div className="bg-light p-3 rounded mb-3 border-start border-4 border-primary">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="fw-bold text-secondary small">Current Level:</span>
                                                        <span className="fw-bold text-dark">Level {student.level}</span>
                                                    </div>
                                                </div>

                                                <div className="d-flex gap-2 pt-2">
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        className="flex-fill fw-bold shadow-sm"
                                                        onClick={() => saveStudentChanges(student.student_id, student.level)}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        <FaSave className="me-1" /> Save
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="flex-fill fw-bold shadow-sm"
                                                        onClick={() => resetStudent(student.student_id)}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        <FaUndo className="me-1" /> Reset
                                                    </Button>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        className="flex-fill fw-bold shadow-sm"
                                                        onClick={() => deleteStudent(student.student_id)}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        <FaTrash className="me-1" /> Delete
                                                    </Button>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        ) : (
                            <div className="text-center text-gray-600 p-5 bg-light border border-2 border-light rounded-3">
                                <p className="mb-0 text-muted">No students match the current search or level filter.</p>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageStudents;