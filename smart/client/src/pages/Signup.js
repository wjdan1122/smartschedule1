import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const STUDENT_DOMAIN = '@student.ksu.edu.sa';
  const STAFF_DOMAIN = '@ksu.edu.sa';

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const getEmailType = (email) => {
    const normalized = (email || '').trim().toLowerCase();
    if (normalized.endsWith(STUDENT_DOMAIN)) return 'student';
    if (normalized.endsWith(STAFF_DOMAIN)) return 'staff';
    if (validateEmail(normalized)) return 'generic';
    return 'invalid';
  };

  const emailType = getEmailType(formData.email);
  const roleDisabled = emailType !== 'staff';
  const roleRequired = emailType === 'staff';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  useEffect(() => {
    // Force role to student for student/generic emails
    if ((emailType === 'student' || emailType === 'generic') && formData.role !== 'student') {
      setFormData((prev) => ({ ...prev, role: 'student' }));
    }
    // Reset role when switching to staff email if role was student
    if (emailType === 'staff' && formData.role === 'student') {
      setFormData((prev) => ({ ...prev, role: '' }));
    }
  }, [emailType, formData.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    const isStudentType = emailType === 'student' || emailType === 'generic';
    const isStaff = emailType === 'staff';

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (isStaff && !formData.role) {
      setError('Please select a role');
      return;
    }

    setLoading(true);

    try {
      if (isStudentType) {
        const requestData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          level: 1,
          is_ir: false,
          committeePassword: '123'
        };
        await authAPI.registerStudent(requestData);
      } else {
        const requestData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          committeePassword: '123'
        };
        await authAPI.registerUser(requestData);
      }

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
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
                      placeholder="your email (student or university)"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                    <Form.Text className="text-muted">
                      Students: any email or @student.ksu.edu.sa — Staff: use @ksu.edu.sa
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

                  <Form.Group className="mb-3">
                    <Form.Label>Role</Form.Label>
                    <Form.Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required={roleRequired}
                      disabled={loading || roleDisabled}
                    >
                      <option value="">Select your role</option>
                      <option value="register">Registrar</option>
                      <option value="faculty member">Faculty Member</option>
                      <option value="load committee">Load Committee</option>
                      <option value="schedule">Scheduler</option>
                    </Form.Select>
                    {roleDisabled && (
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
