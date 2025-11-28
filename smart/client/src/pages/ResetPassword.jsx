import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../App.css';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token'); // جلب الرمز من الرابط
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        
        if (password !== confirmPassword) {
            setMessage({ text: 'Passwords do not match', type: 'danger' });
            return;
        }
        if (password.length < 6) {
            setMessage({ text: 'Password must be at least 6 characters', type: 'danger' });
            return;
        }

        setLoading(true);
        try {
            // الاتصال بمسار reset-password في السيرفر
            const response = await authAPI.resetPassword(token, password);
            setMessage({ text: response.data.message || 'Password reset successful! Redirecting...', type: 'success' });
            
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            console.error("Reset Error:", err);
            const errMsg = err.response?.data?.error || 'Failed to reset password. Token may be invalid or expired.';
            setMessage({ text: errMsg, type: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    if (!token) return <div className="text-center mt-5">Invalid Link. Token missing.</div>;

    return (
        <div className="page-background d-flex align-items-center" style={{minHeight: '100vh', padding: '2rem'}}>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6} lg={5}>
                        <Card className="card-custom shadow-lg border-0">
                            <Card.Header className="card-header-custom text-white text-center py-4">
                                <h2 className="mb-2">Set New Password</h2>
                                <p className="mb-0 page-subtitle">Enter your new secure password</p>
                            </Card.Header>
                            <Card.Body className="p-4">
                                {message.text && (
                                    <Alert variant={message.type} className="text-center fw-bold">
                                        {message.text}
                                    </Alert>
                                )}
                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">New Password</Form.Label>
                                        <Form.Control 
                                            type="password" 
                                            value={password} 
                                            onChange={(e)=>setPassword(e.target.value)} 
                                            placeholder="Min 6 characters"
                                            required 
                                            disabled={loading}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-bold">Confirm Password</Form.Label>
                                        <Form.Control 
                                            type="password" 
                                            value={confirmPassword} 
                                            onChange={(e)=>setConfirmPassword(e.target.value)} 
                                            placeholder="Re-enter new password"
                                            required 
                                            disabled={loading}
                                        />
                                    </Form.Group>
                                    <Button 
                                        type="submit" 
                                        className="w-100 btn-custom-primary fw-bold"
                                        style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none'}}
                                        disabled={loading}
                                    >
                                        {loading ? <Spinner as="span" animation="border" size="sm" className="me-2" /> : 'Reset Password'}
                                    </Button>
                                    <div className="text-center mt-3">
                                        <Button variant="link" className="p-0" onClick={() => navigate('/login')} disabled={loading}>
                                            Back to login
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

export default ResetPassword;