import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Card, Row, Col, Button, Alert, Spinner, Form, ListGroup, Badge, Navbar, Nav } from 'react-bootstrap';
import { FaPlusCircle, FaListAlt, FaTrash, FaUsers, FaShareAlt, FaHome, FaCalendarAlt, FaUserGraduate, FaBook, FaBalanceScale, FaBell, FaCheckCircle, FaVoteYea, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
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
    const location = useLocation();
    
    // Yjs State
    const [collabDraft, setCollabDraft] = useState('');
    const [collabQueue, setCollabQueue] = useState([]);
    const [collabStatus, setCollabStatus] = useState('connecting');
    const collabRefs = useRef({ doc: null, provider: null, draft: null, queue: null });
    const collaboratorRef = useRef('Scheduler');

    // --- Internal Navbar ---
    const InternalNavbar = () => {
        let user = {};
        try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
        const role = String(user.role || '').toLowerCase();
        const type = user.type || '';
        const isActive = (path) => location.pathname === path ? 'active' : '';
        const handleLogout = () => { localStorage.clear(); navigate('/login'); };

        return (
            <Navbar expand="lg" variant="dark" className="shadow-lg p-3 mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
              <Container fluid>
                <Navbar.Brand className="fw-bold fs-4">🎓 KSU SmartSchedule</Navbar.Brand>
                <Navbar.Toggle aria-controls="navbar-nav" />
                <Navbar.Collapse id="navbar-nav">
                  <Nav className="mx-auto">
                    {(type === 'student' || role === 'student') ? (
                        <>
                            <Nav.Link onClick={() => navigate('/student-dashboard')} className={`text-white mx-2 ${isActive('/student-dashboard')}`}><FaHome className="me-1"/> Dashboard</Nav.Link>
                            <Nav.Link onClick={() => navigate('/elective-voting')} className={`text-white mx-2 ${isActive('/elective-voting')}`}><FaVoteYea className="me-1"/> Voting</Nav.Link>
                        </>
                    ) : (
                        <>
                            <Nav.Link onClick={() => navigate('/dashboard')} className={`text-white mx-2 ${isActive('/dashboard') && 'fw-bold'}`}><FaHome className="me-1"/> Home</Nav.Link>
                            <Nav.Link onClick={() => navigate('/manageSchedules')} className={`text-white mx-2 ${isActive('/manageSchedules') && 'fw-bold'}`}><FaCalendarAlt className="me-1"/> Schedules</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managestudents')} className={`text-white mx-2 ${isActive('/managestudents') && 'fw-bold'}`}><FaUserGraduate className="me-1"/> Students</Nav.Link>
                            <Nav.Link onClick={() => navigate('/addElective')} className={`text-white mx-2 ${isActive('/addElective') && 'fw-bold'}`}><FaBook className="me-1"/> Courses</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managerules')} className={`text-white mx-2 fw-bold text-warning`}><FaBalanceScale className="me-1"/> Rules</Nav.Link>
                            <Nav.Link onClick={() => navigate('/managenotifications')} className={`text-white mx-2 ${isActive('/managenotifications') && 'fw-bold'}`}><FaBell className="me-1"/> Comments</Nav.Link>
                        </>
                    )}
                  </Nav>
                  <div className="d-flex align-items-center mt-3 mt-lg-0">
                     <div className="text-white text-end me-3 lh-1 d-none d-lg-block">
                        <div className="fw-bold">{user.name || 'User'}</div>
                        <small className="text-white-50 text-uppercase">{user.role || 'Guest'}</small>
                     </div>
                     <Button variant="danger" size="sm" className="fw-bold px-3 rounded-pill" onClick={handleLogout}><FaSignOutAlt className="me-1"/> Logout</Button>
                  </div>
                </Navbar.Collapse>
              </Container>
            </Navbar>
        );
    };

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

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            const rulesData = await fetchData('https://smartschedule1-b64l.onrender.com/api/rules');
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
        const providerUrl = process.env.REACT_APP_COLLAB_ENDPOINT || 'wss://smartschedule1-b64l.onrender.com/collaboration';
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
        try { return new Date(value).toLocaleString(); } catch { return value || ''; }
    };

    const handleAddRule = async (e) => {
        e.preventDefault();
        if (!newRuleText.trim()) return;
        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData('https://smartschedule1-b64l.onrender.com/api/rules', 'POST', { text: newRuleText });
            setMessage(`Rule added successfully: ${newRuleText}`);
            setNewRuleText('');
            fetchRules();
        } catch (err) {
            setPageError(err.message || 'Failed to add rule.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("Are you sure you want to delete this rule? This will affect AI scheduling.")) return;
        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData(`https://smartschedule1-b64l.onrender.com/api/rules/${ruleId}`, 'DELETE');
            setMessage("Rule deleted successfully.");
            fetchRules();
        } catch (err) {
            setPageError(err.message || 'Failed to delete rule.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
            <Container fluid="lg" className="pt-3">
                <InternalNavbar />

                <Card className="border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
                    <Card.Header className="text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                        <h1 className="fw-bold mb-1">Rules & Constraints</h1>
                        <p className="mb-0 opacity-75">Manage scheduling constraints for AI generation</p>
                    </Card.Header>

                    <Card.Body className="p-4 p-lg-5">
                        {message && <Alert variant="success" className="text-center shadow-sm">{message}</Alert>}
                        {pageError && <Alert variant="danger" className="text-center shadow-sm">{pageError}</Alert>}

                        <Row className="g-4">
                            <Col lg={6}>
                                {/* Collaborative Section */}
                                <Card className="h-100 shadow-sm border-0 bg-light">
                                    <Card.Header className="bg-success text-white d-flex justify-content-between align-items-center">
                                        <span className="fw-bold"><FaUsers className="me-2" /> Collaboration Draft</span>
                                        <Badge bg={collabStatus === 'connected' ? 'light' : 'warning'} text="dark">
                                            {collabStatus}
                                        </Badge>
                                    </Card.Header>
                                    <Card.Body>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold small">Shared Pad (Live)</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={4}
                                                value={collabDraft}
                                                placeholder="Type here to collaborate with others..."
                                                onChange={(e) => updateCollaborativeDraft(e.target.value)}
                                            />
                                        </Form.Group>
                                        <Button variant="success" size="sm" className="w-100 mb-4" onClick={handleShareDraftWithTeam} disabled={!collabDraft.trim()}>
                                            <FaShareAlt className="me-2" /> Share to Queue
                                        </Button>

                                        <h6 className="fw-bold border-bottom pb-2">Team Queue</h6>
                                        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                                            {collabQueue.length === 0 ? (
                                                <p className="text-muted small text-center py-3">No shared drafts yet.</p>
                                            ) : (
                                                <ListGroup variant="flush">
                                                    {collabQueue.map(entry => (
                                                        <ListGroup.Item key={entry.id} className="bg-white mb-2 rounded border">
                                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                                <strong className="small text-primary">{entry.author}</strong>
                                                                <small className="text-muted" style={{fontSize:'0.7rem'}}>{formatCollaborativeTimestamp(entry.createdAt)}</small>
                                                            </div>
                                                            <p className="mb-2 small">{entry.text}</p>
                                                            <div className="d-flex gap-1">
                                                                <Button size="sm" variant="outline-primary" style={{fontSize:'0.7rem'}} onClick={() => handleLoadSharedRule(entry.text)}>Use</Button>
                                                                <Button size="sm" variant="outline-danger" style={{fontSize:'0.7rem'}} onClick={() => handleRemoveSharedRule(entry.id)}><FaTrash/></Button>
                                                            </div>
                                                        </ListGroup.Item>
                                                    ))}
                                                </ListGroup>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col lg={6}>
                                {/* Active Rules Section */}
                                <Card className="shadow-sm border-0 mb-4">
                                    <Card.Header className="bg-white fw-bold text-primary"><FaPlusCircle className="me-2"/> Add New Rule</Card.Header>
                                    <Card.Body>
                                        <Form onSubmit={handleAddRule}>
                                            <Form.Group className="mb-3">
                                                <Form.Control
                                                    as="textarea"
                                                    rows={3}
                                                    value={newRuleText}
                                                    onChange={(e) => setNewRuleText(e.target.value)}
                                                    disabled={loading}
                                                    placeholder="E.g. Core lectures must be before 12 PM..."
                                                    required
                                                />
                                            </Form.Group>
                                            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                                                {loading ? <Spinner size="sm" animation="border" /> : 'Add Rule'}
                                            </Button>
                                        </Form>
                                    </Card.Body>
                                </Card>

                                <Card className="shadow-sm border-0">
                                    <Card.Header className="bg-white fw-bold text-dark"><FaListAlt className="me-2"/> Active Rules ({rules.length})</Card.Header>
                                    <Card.Body style={{maxHeight: '400px', overflowY: 'auto'}}>
                                        {loading && rules.length === 0 ? (
                                            <div className="text-center py-4"><Spinner animation="border" variant="primary"/></div>
                                        ) : rules.length === 0 ? (
                                            <Alert variant="light" className="text-center small">No active rules.</Alert>
                                        ) : (
                                            <ListGroup variant="flush">
                                                {rules.map(rule => (
                                                    <ListGroup.Item key={rule.rule_id} className="d-flex justify-content-between align-items-center bg-transparent">
                                                        <span className="me-2">{rule.text}</span>
                                                        <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRule(rule.rule_id)} disabled={loading}>
                                                            <FaTrash />
                                                        </Button>
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageRules;