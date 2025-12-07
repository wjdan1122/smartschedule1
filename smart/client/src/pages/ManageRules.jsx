import React, { useEffect, useState, useCallback } from 'react';
import { Container, Card, Row, Col, Button, Alert, Spinner, Form, ListGroup, Navbar, Nav } from 'react-bootstrap';
import { FaPlusCircle, FaListAlt, FaTrash, FaHome, FaCalendarAlt, FaUserGraduate, FaBook, FaBalanceScale, FaBell, FaVoteYea, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css';

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
    throw new Error('AUTHENTICATION_FAILED');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown Error' }));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json();
};

const InternalNavbar = ({ navigate, location }) => {
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
  const role = String(user.role || '').toLowerCase();
  const type = user.type || '';
  const isActive = (path) => location.pathname === path ? 'active' : '';
  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  return (
    <Navbar expand="lg" variant="dark" className="shadow-lg p-3 mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
      <Container fluid>
        <Navbar.Brand className="fw-bold fs-4">dYZ" KSU SmartSchedule</Navbar.Brand>
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

const ManageRules = () => {
  const [rules, setRules] = useState([]);
  const [newRuleText, setNewRuleText] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const rulesData = await fetchData('https://smartschedule1-b64l.onrender.com/api/rules');
      setRules(rulesData || []);
    } catch (err) {
      if (err.message === 'AUTHENTICATION_FAILED') { navigate('/login'); return; }
      setPageError('Failed to load rules. Please make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    setLoading(true);
    setPageError(null);
    setMessage(null);
    try {
      await fetchData('https://smartschedule1-b64l.onrender.com/api/rules', 'POST', { text: newRuleText.trim() });
      setMessage('Rule added successfully.');
      setNewRuleText('');
      fetchRules();
    } catch (err) {
      setPageError(err.message || 'Failed to add rule.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this rule?')) return;
    setLoading(true);
    setPageError(null);
    setMessage(null);
    try {
      await fetchData(`https://smartschedule1-b64l.onrender.com/api/rules/${ruleId}`, 'DELETE');
      setMessage('Rule deleted.');
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
        <InternalNavbar navigate={navigate} location={location} />

        <Card className="border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
          <Card.Header className="text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
            <h1 className="fw-bold mb-1">Rules & Constraints</h1>
            <p className="mb-0 opacity-75">Add or remove rules for AI scheduling</p>
          </Card.Header>

          <Card.Body className="p-4 p-lg-5">
            {message && <Alert variant="success" className="text-center shadow-sm">{message}</Alert>}
            {pageError && <Alert variant="danger" className="text-center shadow-sm">{pageError}</Alert>}

            <Row className="g-4">
              <Col lg={6}>
                <Card className="shadow-sm border-0">
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
                          placeholder="E.g. Reserve 12:00-13:00 for lunch break..."
                          required
                        />
                      </Form.Group>
                      <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                        {loading ? <Spinner size="sm" animation="border" /> : 'Add Rule'}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={6}>
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
