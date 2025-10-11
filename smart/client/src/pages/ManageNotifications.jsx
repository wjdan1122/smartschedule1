import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Spinner, Alert, ListGroup, Form, Badge } from 'react-bootstrap';
import { FaBell, FaArrowLeft } from 'react-icons/fa';
import '../App.css';

// Generic fetchData function
const fetchData = async (url) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }
    });
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        throw new Error("Authentication failed. Please log in again.");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

const ManageNotifications = () => {
    const [allComments, setAllComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedLevel, setSelectedLevel] = useState('');
    const navigate = useNavigate();

    const academicLevels = [3, 4, 5, 6, 7, 8];

    const fetchAllComments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchData('http://localhost:5000/api/comments/all');
            setAllComments(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllComments();
    }, [fetchAllComments]);

    // Filter comments based on the selected level
    const filteredComments = selectedLevel
        ? allComments.filter(comment => comment.student_level == selectedLevel)
        : allComments;

    // Group comments by schedule version for better display
    const groupedComments = filteredComments.reduce((acc, comment) => {
        const key = comment.schedule_version_id;
        if (!acc[key]) {
            acc[key] = {
                version_id: key,
                version_comment: comment.version_comment,
                level: comment.student_level, // Assuming comments for a version are from same level students
                comments: []
            };
        }
        acc[key].comments.push(comment);
        return acc;
    }, {});


    return (
        <div className="dashboard-page">
            <Container fluid="lg" className="container-custom shadow-lg">
                <header className="navbar-custom p-3 d-flex justify-content-between align-items-center">
                    <h1 className="text-white fs-4 fw-bold">Manage Student Comments</h1>
                    <Button variant="light" size="sm" onClick={() => navigate(-1)} className="d-flex align-items-center gap-2">
                        <FaArrowLeft /> Back to Dashboard
                    </Button>
                </header>

                <main className="main-content p-4 p-md-5">
                    <Card className="shadow-sm">
                        <Card.Header className="d-flex align-items-center gap-2 bg-light border-bottom">
                            <FaBell className="text-primary" />
                            <h3 className="mb-0 fs-5">Student Feedback on Schedules</h3>
                        </Card.Header>
                        <Card.Body>
                            <Form.Group className="mb-4">
                                <Form.Label className="fw-bold">Filter Comments by Student Level</Form.Label>
                                <Form.Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
                                    <option value="">Show All Levels</option>
                                    {academicLevels.map(level => (
                                        <option key={level} value={level}>Level {level}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            {loading ? (
                                <div className="text-center p-5"><Spinner /></div>
                            ) : error ? (
                                <Alert variant="danger">{error}</Alert>
                            ) : Object.keys(groupedComments).length === 0 ? (
                                <Alert variant="info" className="text-center">No comments found for the selected level.</Alert>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {Object.values(groupedComments).map(group => (
                                        <Card key={group.version_id} className="border">
                                            <Card.Header>
                                                <strong>Schedule Version:</strong> {group.version_comment || `Version ID ${group.version_id}`}
                                                <Badge bg="info" className="ms-2">Level {group.level}</Badge>
                                            </Card.Header>
                                            <ListGroup variant="flush">
                                                {group.comments.map(comment => (
                                                    <ListGroup.Item key={comment.comment_id}>
                                                        <div className="d-flex justify-content-between">
                                                            <span className="fw-bold">{comment.student_name} <Badge pill bg="secondary">Lvl {comment.student_level}</Badge></span>
                                                            <small className="text-muted">{new Date(comment.created_at).toLocaleString()}</small>
                                                        </div>
                                                        <p className="mb-0 mt-1">{comment.comment}</p>
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </main>
            </Container>
        </div>
    );
};

export default ManageNotifications;

