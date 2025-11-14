import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (value) => {
    const trimmed = value.trim().toLowerCase();
    const studentPattern = /^[0-9]{9}@student\.ksu\.edu\.sa$/;
    const staffPattern = /^[a-zA-Z0-9._-]+@ksu\.edu\.sa$/;
    return studentPattern.test(trimmed) || staffPattern.test(trimmed);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid KSU email');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.requestPasswordReset(email.trim());
      setSuccess(response.data?.message || 'If the email exists, reset instructions were sent.');
    } catch (err) {
      console.error('Forgot password error:', err);
      const backendError = err.response?.data?.error;
      setError(backendError || 'Unable to process reset request. Please try again.');
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
                <h2 className="mb-2">Reset Password</h2>
                <p className="mb-0">Enter your university email to receive reset instructions</p>
              </Card.Header>
              <Card.Body className="p-4">
                {error && (
                  <Alert variant="danger" className="mb-3">
                    {error}
                  </Alert>
                )}
                {success && (
                  <Alert variant="success" className="mb-3">
                    {success}
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
                        setError('');
                        setSuccess('');
                      }}
                      required
                      disabled={loading}
                    />
                  </Form.Group>
                  <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Sending instructions...
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </Button>
                </Form>

                <div className="text-center mt-3">
                  <Button
                    variant="link"
                    className="p-0"
                    onClick={() => navigate('/login')}
                    disabled={loading}
                  >
                    Back to login
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default ForgotPassword;
