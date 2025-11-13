import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Card, Row, Col, Button, Alert, Spinner, Form, ListGroup, Badge } from 'react-bootstrap';
import { FaArrowRight, FaPlusCircle, FaListAlt, FaTrash, FaUsers, FaShareAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import '../App.css';

// Utility function to handle API requests
const fetchData = async (url, method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: body ? JSON.stringify(body) : null,
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error("AUTHENTICATION_FAILED");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown Error' }));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
    }

    return response.json();
};

const ManageRules = () => {
    const [rules, setRules] = useState([]);
    const [newRuleText, setNewRuleText] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageError, setPageError] = useState(null);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();
    const [collabDraft, setCollabDraft] = useState('');
    const [collabQueue, setCollabQueue] = useState([]);
    const [collabStatus, setCollabStatus] = useState('connecting');
    const collabRefs = useRef({ doc: null, provider: null, draft: null, queue: null });
    const collaboratorRef = useRef('Scheduler');
    const toPlainQueueEntry = (entry) => {
        if (entry instanceof Y.Map) {
            return {
                id: entry.get('id'),
                text: entry.get('text'),
                author: entry.get('author'),
                createdAt: entry.get('createdAt'),
            };
        }
        return entry || {};
    };
    const getPlainQueueSnapshot = (queueInstance) => {
        if (!queueInstance) return [];
        return queueInstance.toArray().map(toPlainQueueEntry);
    };

    // Fetch rules from the server
    const fetchRules = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            const rulesData = await fetchData('http://localhost:5000/api/rules');
            setRules(rulesData);
        } catch (err) {
            console.error("Error fetching rules:", err);
            if (err.message === "AUTHENTICATION_FAILED") {
                navigate('/login');
                return;
            }
            setPageError("Failed to load rules. Please make sure the server is running.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    useEffect(() => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            collaboratorRef.current = storedUser.name || storedUser.email || 'Scheduler';
        } catch {
            collaboratorRef.current = 'Scheduler';
        }
    }, []);

    useEffect(() => {
        const doc = new Y.Doc();
        const providerUrl = process.env.REACT_APP_COLLAB_ENDPOINT || 'ws://localhost:5000/collaboration';
        const provider = new WebsocketProvider(providerUrl, 'manage-rules', doc, { connect: true });
        const draft = doc.getText('ruleDraft');
        const queue = doc.getArray('ruleQueue');

        collabRefs.current = { doc, provider, draft, queue };

        const draftObserver = () => setCollabDraft(draft.toString());
        const queueObserver = () => setCollabQueue(getPlainQueueSnapshot(queue));

        draft.observe(draftObserver);
        queue.observe(queueObserver);

        draftObserver();
        queueObserver();

        const statusListener = (event) => setCollabStatus(event.status || 'disconnected');
        provider.on('status', statusListener);

        return () => {
            draft.unobserve(draftObserver);
            queue.unobserve(queueObserver);
            if (typeof provider.off === 'function') {
                provider.off('status', statusListener);
            }
            provider.destroy();
            doc.destroy();
        };
    }, []);

    const updateCollaborativeDraft = (value) => {
        setCollabDraft(value);
        const { doc, draft } = collabRefs.current;
        if (!doc || !draft) return;
        doc.transact(() => {
            draft.delete(0, draft.length);
            if (value) {
                draft.insert(0, value);
            }
        });
    };

    const generateEntryId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const handleShareDraftWithTeam = () => {
        const text = collabDraft.trim();
        if (!text) return;

        const { doc, queue } = collabRefs.current;
        if (!doc || !queue) return;

        const entry = {
            id: generateEntryId(),
            text,
            author: collaboratorRef.current,
            createdAt: new Date().toISOString(),
        };

        const sharedEntry = new Y.Map();
        Object.entries(entry).forEach(([key, value]) => sharedEntry.set(key, value));

        doc.transact(() => queue.push([sharedEntry]));
        setMessage('Draft shared with collaborators.');
    };

    const handleLoadSharedRule = (text) => {
        if (!text) return;
        setNewRuleText(text);
        setMessage('Shared draft loaded into the form. Review and click Add & Save.');
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleRemoveSharedRule = (entryId) => {
        if (!entryId) return;
        const { doc, queue } = collabRefs.current;
        if (!doc || !queue) return;
        const rawEntries = queue.toArray();
        const index = rawEntries.findIndex(item => {
            if (item instanceof Y.Map) {
                return item.get('id') === entryId;
            }
            return item?.id === entryId;
        });
        if (index === -1) return;
        doc.transact(() => queue.delete(index, 1));
    };

    const formatCollaborativeTimestamp = (value) => {
        try {
            return new Date(value).toLocaleString();
        } catch {
            return value || '';
        }
    };

    // Add new rule
    const handleAddRule = async (e) => {
        e.preventDefault();
        if (!newRuleText.trim()) return;

        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData('http://localhost:5000/api/rules', 'POST', { text: newRuleText });
            setMessage(`Rule added successfully: ${newRuleText}`);
            setNewRuleText('');
            fetchRules();
        } catch (err) {
            setPageError(err.message || 'Failed to add rule.');
        } finally {
            setLoading(false);
        }
    };

    // Delete rule
    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("Are you sure you want to delete this rule? This will affect AI scheduling.")) return;

        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData(`http://localhost:5000/api/rules/${ruleId}`, 'DELETE');
            setMessage("Rule deleted successfully.");
            fetchRules();
        } catch (err) {
            setPageError(err.message || 'Failed to delete rule.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Container fluid="lg" className="bg-white p-4 rounded-lg shadow-lg">
                <div className="navbar bg-blue-900 mb-6 rounded-t-lg p-3 flex justify-between items-center">
                    <Button
                        onClick={() => navigate('/dashboard')}
                        className="back-button text-white flex items-center p-2 rounded-lg bg-opacity-20 hover:bg-opacity-30 border-0"
                    >
                        <FaArrowRight className="ml-2" /> Back to Dashboard
                    </Button>
                    <h1 className="text-white text-2xl font-bold mb-0">Rules & Constraints Management</h1>
                    <div></div>
                </div>

                <h1 className="text-3xl text-center text-blue-900 font-extrabold mb-4">
                    ⚖️ AI Scheduling Constraints (for Gemini)
                </h1>

                {message && <Alert variant="success" className="mt-3 text-center">{message}</Alert>}
                {pageError && <Alert variant="danger" className="mt-3 text-center">{pageError}</Alert>}

                <Card className="shadow-lg mb-6 border-success border-2">
                    <Card.Header className="bg-success text-white py-3 d-flex justify-content-between align-items-center">
                        <h4 className="mb-0 flex items-center text-xl font-bold">
                            <FaUsers className="me-2" /> Collaborative Rule Draft (Yjs)
                        </h4>
                        <Badge bg={collabStatus === 'connected' ? 'light' : 'warning'} className={`text-uppercase ${collabStatus === 'connected' ? 'text-success' : 'text-dark'}`}>
                            {collabStatus}
                        </Badge>
                    </Card.Header>
                    <Card.Body>
                        <Row className="gy-4">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Shared Draft Pad</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        value={collabDraft}
                                        placeholder="Co-edit a draft with other schedulers in real-time..."
                                        onChange={(e) => updateCollaborativeDraft(e.target.value)}
                                    />
                                    <Form.Text className="text-muted">
                                        Everyone connected to this page can see your typing instantly.
                                    </Form.Text>
                                </Form.Group>
                                <Button
                                    variant="primary"
                                    className="mt-3"
                                    onClick={handleShareDraftWithTeam}
                                    disabled={!collabDraft.trim()}
                                >
                                    <FaShareAlt className="me-2" /> Share With Team Queue
                                </Button>
                            </Col>
                            <Col md={6}>
                                <h5 className="fw-bold mb-3">Shared Queue</h5>
                                {collabQueue.length === 0 ? (
                                    <Alert variant="light" className="border border-2 border-secondary-subtle text-muted">
                                        No shared drafts yet. Use the pad on the left to propose a rule for review.
                                    </Alert>
                                ) : (
                                    <ListGroup>
                                        {collabQueue.map(entry => (
                                            <ListGroup.Item key={entry.id} className="d-flex flex-column gap-2">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <strong>{entry.author || 'Collaborator'}</strong>
                                                    <small className="text-muted">{formatCollaborativeTimestamp(entry.createdAt)}</small>
                                                </div>
                                                <div className="text-muted">{entry.text}</div>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline-success"
                                                        onClick={() => handleLoadSharedRule(entry.text)}
                                                    >
                                                        Use In Form
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline-danger"
                                                        onClick={() => handleRemoveSharedRule(entry.id)}
                                                    >
                                                        <FaTrash className="me-1" /> Remove
                                                    </Button>
                                                </div>
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                )}
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Add new rule */}
                <Card className="shadow-lg mb-6 border-blue-400 border-2">
                    <Card.Header className="bg-blue-500 text-white py-3">
                        <h4 className="mb-0 flex items-center text-xl font-bold">
                            <FaPlusCircle className="ml-2" /> Add New Rule
                        </h4>
                    </Card.Header>
                    <Card.Body>
                        <Form onSubmit={handleAddRule}>
                            <Row className="align-items-end">
                                <Col md={9}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>
                                            Rule Text (Example: Core lectures must be scheduled before 12:00 PM)
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={newRuleText}
                                            onChange={(e) => setNewRuleText(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Button variant="success" type="submit" className="w-100" disabled={loading}>
                                        {loading ? <Spinner size="sm" animation="border" className="ml-2" /> : <FaPlusCircle className="ml-2" />} Add & Save
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card.Body>
                </Card>

                {/* Display existing rules */}
                <Card className="shadow-lg">
                    <Card.Header className="bg-gray-100 py-3">
                        <h4 className="mb-0 flex items-center text-blue-800 text-xl font-bold">
                            <FaListAlt className="ml-2" /> Active Rules ({rules.length})
                        </h4>
                    </Card.Header>
                    <Card.Body>
                        {loading ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : rules.length === 0 ? (
                            <Alert variant="info" className="text-center">
                                No rules have been added yet for AI scheduling.
                            </Alert>
                        ) : (
                            <ListGroup as="ol" numbered>
                                {rules.map(rule => (
                                    <ListGroup.Item
                                        key={rule.rule_id}
                                        className="d-flex justify-content-between align-items-center"
                                    >
                                        <div className="ms-2 me-auto">
                                            <div className="fw-semibold">{rule.text}</div>
                                        </div>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDeleteRule(rule.rule_id)}
                                            disabled={loading}
                                        >
                                            <FaTrash /> Delete
                                        </Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageRules;
