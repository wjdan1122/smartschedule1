import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

function Signup() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        level: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateEmail = (email) => {
        return email.endsWith('@student.ksu.edu.sa') || email.endsWith('@ksu.edu.sa');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => {
            const updatedData = {
                ...prevData,
                [name]: value
            };

            if (name === 'email') {
                if (value.endsWith('@student.ksu.edu.sa')) {
                    updatedData.role = '';
                } else {
                    updatedData.level = '';
                }
            }

            return updatedData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        console.log('=== SIGNUP ATTEMPT ===');
        console.log('Form Data:', formData);

        // Validation
        if (!formData.name.trim()) {
            console.log('ERROR: Name is empty');
            setError('Name is required');
            return;
        }

        if (!validateEmail(formData.email)) {
            console.log('ERROR: Invalid email format');
            setError('Please enter a valid KSU university email address');
            return;
        }

        if (formData.password.length < 6) {
            console.log('ERROR: Password too short');
            setError('Password must be at least 6 characters long');
            return;
        }

        const isStudent = formData.email.endsWith('@student.ksu.edu.sa');
        console.log('Is Student:', isStudent);

        if (!isStudent && !formData.role) {
            console.log('ERROR: No role selected for staff');
            setError('Please select a role');
            return;
        }

        if (isStudent) {
            const levelNumber = parseInt(formData.level, 10);
            if (!levelNumber || levelNumber < 1) {
                console.log('ERROR: Invalid level for student');
                setError('Please enter a valid level for the student (positive number)');
                return;
            }
        }

        setLoading(true);

        try {
            if (isStudent) {
                console.log('Attempting STUDENT registration...');
                const requestData = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    level: parseInt(formData.level, 10),
                    is_ir: false,
                    committeePassword: '123'
                };
                console.log('Student Request Data:', requestData);

                const response = await authAPI.registerStudent(requestData);
                console.log('Student Registration SUCCESS:', response.data);
            } else {
                console.log('Attempting USER registration...');
                const requestData = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    committeePassword: '123'
                };
                console.log('User Request Data:', requestData);

                const response = await authAPI.registerUser(requestData);
                console.log('User Registration SUCCESS:', response.data);
            }

            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            console.error('=== REGISTRATION ERROR ===');
            console.error('Full Error:', err);
            console.error('Error Response:', err.response);
            console.error('Error Data:', err.response?.data);
            console.error('Error Status:', err.response?.status);
            console.error('Error Message:', err.message);

            setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isStudentEmail = formData.email.endsWith('@student.ksu.edu.sa');

    return (
        <div className="min-vh-100 d-flex align-items-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6} lg={5}>
                        <Card className="shadow-lg border-0">
                            <Card.Header className="bg-primary text-white text-center py-4">
                                <h2 className="mb-2">King Saud University</h2>
                                <p className="mb-0">Create Account - SmartSchedule</p>
                            </Card.Header>
                            <Card.Body className="p-4">
                                {error && <Alert variant="danger">{error}</Alert>}
                                {success && <Alert variant="success">{success}</Alert>}

                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Full Name</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            placeholder="Enter your full name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            disabled={loading}
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>University Email</Form.Label>
                                        <Form.Control
                                            type="email"
                                            name="email"
                                            placeholder="######@student.ksu.edu.sa or @ksu.edu.sa"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            disabled={loading}
                                        />
                                        <Form.Text className="text-muted">
                                            Use @student.ksu.edu.sa for students, @ksu.edu.sa for staff
                                        </Form.Text>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Password</Form.Label>
                                        <Form.Control
                                            type="password"
                                            name="password"
                                            placeholder="Enter password (min 6 characters)"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            disabled={loading}
                                        />
                                    </Form.Group>

                                    {isStudentEmail && (
                                        <Form.Group className="mb-3">
                                            <Form.Label>Level</Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="level"
                                                min="1"
                                                placeholder="Enter your current level"
                                                value={formData.level}
                                                onChange={handleChange}
                                                required
                                                disabled={loading}
                                            />
                                            <Form.Text className="text-muted">
                                                Example: level 1 for new students
                                            </Form.Text>
                                        </Form.Group>
                                    )}

                                    <Form.Group className="mb-3">
                                        <Form.Label>Role</Form.Label>
                                        <Form.Select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                            required={!isStudentEmail}
                                            disabled={loading || isStudentEmail}
                                        >
                                            <option value="">Select your role</option>
                                            <option value="register">Registrar</option>
                                            <option value="faculty member">Faculty Member</option>
                                            <option value="load committee">Load Committee</option>
                                            <option value="schedule">Scheduler</option>
                                        </Form.Select>
                                        {isStudentEmail && (
                                            <Form.Text className="text-muted">
                                                Student role will be assigned automatically
                                            </Form.Text>
                                        )}
                                    </Form.Group>

                                    <Button variant="primary" type="submit" className="w-100 mb-3" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                                Creating Account...
                                            </>
                                        ) : (
                                            'Create Account'
                                        )}
                                    </Button>

                                    <div className="text-center">
                                        <span className="text-muted">Already have an account? </span>
                                        <Button
                                            variant="link"
                                            className="p-0"
                                            onClick={() => navigate('/login')}
                                            disabled={loading}
                                        >
                                            Login here
                                        </Button>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

export default Signup;
