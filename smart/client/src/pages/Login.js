import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (email) => {
    return email.endsWith('@student.ksu.edu.sa') || email.endsWith('@ksu.edu.sa');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid KSU university email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
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
      if (userToStore.type === 'student' || userToStore.role === 'student') {
        navigate('/StudentDashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || err.message || 'Login failed. Please check your credentials.');
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
                {error && <Alert variant="danger">{error}</Alert>}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>University Email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="######@student.ksu.edu.sa"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </Form.Group>

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