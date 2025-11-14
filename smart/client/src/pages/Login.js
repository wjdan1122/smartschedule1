import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({}); // Field-level errors
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const studentPattern = /^[0-9]{9}@student\.ksu\.edu\.sa$/;
    const staffPattern = /^[a-zA-Z0-9._-]+@ksu\.edu\.sa$/;
    return studentPattern.test(email) || staffPattern.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errors = {};

    // Validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      if (email.endsWith('@student.ksu.edu.sa')) {
        const emailPrefix = email.split('@')[0];
        if (!/^[0-9]{9}$/.test(emailPrefix)) {
          errors.email = 'Student email must be exactly 9 digits (e.g., 123456789@student.ksu.edu.sa)';
        } else {
          errors.email = 'Invalid email format';
        }
      } else {
        errors.email = 'Please use a valid KSU email address';
      }
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // If there are validation errors, show them
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      console.log('Full login response:', response.data);

      const token = response.data?.token;
      const user = response.data?.user;

      if (!token || !user) {
        throw new Error('Invalid login response from server');
      }

      // Backend returns the correct structure
      const userToStore = {
        user_id: user.user_id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        is_ir: user.is_ir,
        type: user.type
      };

      console.log('✅ User to store:', userToStore);

      // Save token and user to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userToStore));

      // Verify saved values
      const savedUser = JSON.parse(localStorage.getItem('user'));
      console.log('✅ Saved user to localStorage:', savedUser);

      // Navigate based on user role/type
      const roleStr = String(userToStore.role || '').toLowerCase();
      if (userToStore.type === 'student' || roleStr === 'student') {
        navigate('/student-dashboard');
      } else if (roleStr.includes('schedule') || roleStr.includes('scheduler')) {
        navigate('/manageschedules');
      } else if (roleStr.includes('committee') || roleStr.includes('load committee')) {
        navigate('/load-committee');
      } else if (roleStr.includes('faculty')) {
        navigate('/faculty');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);

      const backendError = err.response?.data?.error;

      if (err.response?.status === 401) {
        setError('❌ Invalid email or password. Please try again.');
      } else if (backendError) {
        if (backendError.includes('9 digits')) {
          setFieldErrors({ email: backendError });
          setError('Please check your email format');
        } else if (backendError.includes('Email')) {
          setFieldErrors({ email: backendError });
        } else {
          setError('❌ ' + backendError);
        }
      } else {
        setError('❌ Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="shadow-lg border-0">
              <Card.Header className="bg-primary text-white text-center py-4">
                <h2 className="mb-2">King Saud University</h2>
                <p className="mb-0">SmartSchedule</p>
              </Card.Header>
              <Card.Body className="p-4">
                {error && (
                  <Alert variant="danger" className="d-flex align-items-center">
                    <span style={{ fontSize: '1.2rem', marginRight: '10px' }}>⚠️</span>
                    <div>{error}</div>
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>University Email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="123456789@student.ksu.edu.sa"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors(prev => ({ ...prev, email: '' }));
                        setError('');
                      }}
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
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors(prev => ({ ...prev, password: '' }));
                        setError('');
                      }}
                      required
                      disabled={loading}
                      isInvalid={!!fieldErrors.password}
                    />
                    {fieldErrors.password && (
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.password}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  <div className="text-center mb-3">
                    <Button
                      variant="link"
                      className="p-0"
                      onClick={() => navigate('/forgot-password')}
                      disabled={loading}
                    >
                      Forgot password?
                    </Button>
                  </div>

                  <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Logging in...
                      </>
                    ) : (
                      'Login to Dashboard'
                    )}
                  </Button>

                  <div className="text-center mt-3">
                    <span className="text-muted">Don't have an account? </span>
                    <Button
                      variant="link"
                      className="p-0"
                      onClick={() => navigate('/Signup')}
                      disabled={loading}
                    >
                      Sign up here
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

export default Login;
