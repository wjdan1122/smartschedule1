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
    const [fieldErrors, setFieldErrors] = useState({}); // Field-level errors
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const validateEmail = (email) => {
        // Check if it's 9 digits for student or valid staff email
        const studentPattern = /^[0-9]{9}@student\.ksu\.edu\.sa$/;
        const staffPattern = /^[a-zA-Z0-9._-]+@ksu\.edu\.sa$/;
        return studentPattern.test(email) || staffPattern.test(email);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Clear field error when user starts typing
        setFieldErrors(prev => ({ ...prev, [name]: '' }));
        setError('');

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
        setFieldErrors({});
        setSuccess('');

        const errors = {};

        // Validation
        if (!formData.name.trim()) {
            errors.name = 'Please enter your full name';
        }

        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (formData.email.endsWith('@student.ksu.edu.sa')) {
            // Check for 9 digits
            const emailPrefix = formData.email.split('@')[0];
            if (!/^[0-9]{9}$/.test(emailPrefix)) {
                errors.email = 'Student email must be exactly 9 digits (e.g., 123456789@student.ksu.edu.sa)';
            }
        } else if (!validateEmail(formData.email)) {
            errors.email = 'Please use a valid KSU email (@ksu.edu.sa for staff)';
        }

        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters long';
        } else if (['123456', 'password', '123456789'].includes(formData.password.toLowerCase())) {
            errors.password = 'This password is too weak. Please choose a stronger one';
        }

        const isStudent = formData.email.endsWith('@student.ksu.edu.sa');

        if (!isStudent && !formData.role) {
            errors.role = 'Please select a role';
        }

        if (isStudent) {
            const levelNumber = parseInt(formData.level, 10);
            if (!levelNumber || levelNumber < 1 || levelNumber > 12) {
                errors.level = 'Please enter a valid level (1-12)';
            }
        }

        // If there are validation errors, show them
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setError('Please fix the errors below');
            return;
        }

        setLoading(true);

        try {
            if (isStudent) {
                const requestData = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    level: parseInt(formData.level, 10),
                    is_ir: false,
                    committeePassword: '123'
                };

                const response = await authAPI.registerStudent(requestData);
                console.log('Student Registration SUCCESS:', response.data);
            } else {
                const requestData = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    committeePassword: '123'
                };

                const response = await authAPI.registerUser(requestData);
                console.log('User Registration SUCCESS:', response.data);
            }

            setSuccess('✅ Account created successfully! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (err) {
            console.error('=== REGISTRATION ERROR ===', err);

            // Better error messages from backend
            const backendError = err.response?.data?.error;
            if (backendError) {
                if (backendError.includes('9 digits')) {
                    setFieldErrors({ email: backendError });
                    setError('Please check your email format');
                } else if (backendError.includes('Password')) {
                    setFieldErrors({ password: backendError });
                    setError('Password issue detected');
                } else if (backendError.includes('already')) {
                    setError('❌ This email is already registered. Please login instead.');
                } else {
                    setError('❌ ' + backendError);
                }
            } else {
                setError('❌ Registration failed. Please try again.');
            }
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
                                {error && (
                                    <Alert variant="danger" className="d-flex align-items-center">
                                        <span style={{ fontSize: '1.2rem', marginRight: '10px' }}>⚠️</span>
                                        <div>{error}</div>
                                    </Alert>
                                )}
                                {success && (
                                    <Alert variant="success" className="d-flex align-items-center">
                                        <span style={{ fontSize: '1.2rem', marginRight: '10px' }}>✅</span>
                                        <div>{success}</div>
                                    </Alert>
                                )}

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
                                            isInvalid={!!fieldErrors.name}
                                        />
                                        {fieldErrors.name && (
                                            <Form.Control.Feedback type="invalid">
                                                {fieldErrors.name}
                                            </Form.Control.Feedback>
                                        )}
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>University Email</Form.Label>
                                        <Form.Control
                                            type="email"
                                            name="email"
                                            placeholder="123456789@student.ksu.edu.sa"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            disabled={loading}
                                            isInvalid={!!fieldErrors.email}
                                        />
                                        {fieldErrors.email ? (
                                            <Form.Control.Feedback type="invalid">
                                                {fieldErrors.email}
                                            </Form.Control.Feedback>
                                        ) : (
                                            <Form.Text className="text-muted">
                                            </Form.Text>
                                        )}
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
                                            isInvalid={!!fieldErrors.password}
                                        />
                                        {fieldErrors.password ? (
                                            <Form.Control.Feedback type="invalid">
                                                {fieldErrors.password}
                                            </Form.Control.Feedback>
                                        ) : (
                                            <Form.Text className="text-muted">

                                            </Form.Text>
                                        )}
                                    </Form.Group>

                                    {isStudentEmail && (
                                        <Form.Group className="mb-3">
                                            <Form.Label>Level</Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="level"
                                                min="1"
                                                max="12"
                                                placeholder="Enter your current level (1-12)"
                                                value={formData.level}
                                                onChange={handleChange}
                                                required
                                                disabled={loading}
                                                isInvalid={!!fieldErrors.level}
                                            />
                                            {fieldErrors.level ? (
                                                <Form.Control.Feedback type="invalid">
                                                    {fieldErrors.level}
                                                </Form.Control.Feedback>
                                            ) : (
                                                <Form.Text className="text-muted">

                                                </Form.Text>
                                            )}
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
                                            isInvalid={!!fieldErrors.role}
                                        >
                                            <option value="">Select your role</option>
                                            <option value="register">Registrar</option>
                                            <option value="faculty member">Faculty Member</option>
                                            <option value="load committee">Load Committee</option>
                                            <option value="schedule">Scheduler</option>
                                        </Form.Select>
                                        {fieldErrors.role ? (
                                            <Form.Control.Feedback type="invalid">
                                                {fieldErrors.role}
                                            </Form.Control.Feedback>
                                        ) : isStudentEmail ? (
                                            <Form.Text className="text-muted">
                                                👨‍🎓 Student role is assigned automatically
                                            </Form.Text>
                                        ) : null}
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
