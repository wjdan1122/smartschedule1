import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Container, Card, ListGroup, Button, Spinner, Alert, Form, Badge, Table, Row, Col, Navbar, Nav } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaArrowRight, FaCheckCircle, FaTimesCircle, FaHome, FaCalendarAlt, FaUsers, FaBook, FaBalanceScale, FaBell, FaVoteYea, FaSignOutAlt, FaUserTie } from 'react-icons/fa';
import '../App.css';

// Fetch Helper
const fetchJson = async (url, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = data.message || data.error || `Request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
};

const LoadCommittee = () => {
  const [pending, setPending] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteById, setNoteById] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [facultyCommentsById, setFacultyCommentsById] = useState({});
  const levels = [3,4,5,6,7,8];
  const navigate = useNavigate();
  const location = useLocation();

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
              <Navbar.Brand className="fw-bold fs-4 d-flex align-items-center">
                  <span className="me-2">🎓</span> KSU SmartSchedule
              </Navbar.Brand>
              <Navbar.Toggle aria-controls="navbar-nav" />
              <Navbar.Collapse id="navbar-nav">
                <Nav className="mx-auto">
                    {role.includes('committee') && (
                        <>
                             <Nav.Link onClick={() => navigate('/load-committee')} className={`text-white mx-2 fw-bold text-warning`}><FaCheckCircle className="me-1"/> Review</Nav.Link>
                             {/* Add other committee links here if needed */}
                        </>
                    )}
                     {/* Fallback for other roles if they access this page */}
                    {(role.includes('schedule') || role.includes('admin')) && (
                         <Nav.Link onClick={() => navigate('/dashboard')} className={`text-white mx-2`}><FaHome className="me-1"/> Home</Nav.Link>
                    )}
                </Nav>
                <div className="d-flex align-items-center mt-3 mt-lg-0">
                   <div className="text-white text-end me-3 lh-1 d-none d-lg-block">
                      <div className="fw-bold">{user.name || 'Committee Member'}</div>
                      <small className="text-white-50 text-uppercase">{user.role || 'Load Committee'}</small>
                   </div>
                   <Button variant="danger" size="sm" className="fw-bold px-3 rounded-pill" onClick={handleLogout}><FaSignOutAlt className="me-1"/> Logout</Button>
                </div>
              </Navbar.Collapse>
            </Container>
          </Navbar>
      );
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, courses] = await Promise.all([
        fetchJson('https://smartschedule1-b64l.onrender.com/api/schedule-versions/pending-committee'),
        fetchJson('https://smartschedule1-b64l.onrender.com/api/courses')
      ]);
      setPending(list || []);
      setAllCourses(courses || []);
      
      const entries = await Promise.all(
        (list || []).map(async v => {
          try {
            const data = await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${v.id}/faculty-comments`);
            return [v.id, data];
          } catch { return [v.id, []]; }
        })
      );
      setFacultyCommentsById(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
      if (err.message.toLowerCase().includes('auth')) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPending = useMemo(() => (pending || []).filter(v => String(v.level) === String(selectedLevel)), [pending, selectedLevel]);

  const dayLabel = (code) => ({ S: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', H: 'Thursday' }[code] || code);
  const timeSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00'];

  const buildScheduleMap = (sections) => {
    const arr = typeof sections === 'string' ? (()=>{ try { return JSON.parse(sections); } catch { return []; } })() : (Array.isArray(sections) ? sections : []);
    const map = {};
    arr.forEach(sec => {
      const day = dayLabel(sec.day_code);
      if (!day || !sec.start_time || !sec.end_time) return;
      if (!map[day]) map[day] = [];
      const courseInfo = allCourses.find(c => c.course_id === sec.course_id);
      const courseName = courseInfo ? courseInfo.name : `Course ${sec.course_id}`;
      map[day].push({ start: sec.start_time.substring(0,5), end: sec.end_time.substring(0,5), content: `${sec.dept_code || ''} ${courseName}`.trim() });
    });
    return map;
  };

  const renderTable = (sections) => {
    const scheduleMap = buildScheduleMap(sections);
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday'];
    return (
      <div className="overflow-x-auto">
        <Table bordered className="text-center align-middle mb-0">
          <thead className="bg-light">
            <tr>
              <th style={{width:'12%'}}>Day</th>
              {timeSlots.map(ts => (<th key={ts} className="small">{ts}</th>))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const blocks = scheduleMap[day] || [];
              const cells = [];
              let i = 0;
              while (i < timeSlots.length) {
                const slot = timeSlots[i];
                const block = blocks.find(b => b.start === slot);
                if (block) {
                  const startH = parseInt(block.start.split(':')[0],10);
                  const endH = parseInt(block.end.split(':')[0],10);
                  const span = Math.max(1, endH - startH);
                  cells.push(<td key={`${day}-${slot}`} colSpan={span} className="bg-primary bg-opacity-10 fw-bold text-primary small">{block.content}</td>);
                  i += span;
                } else {
                  const overlapped = blocks.some(b => {
                    const s = parseInt(b.start.split(':')[0],10);
                    const e = parseInt(b.end.split(':')[0],10);
                    const h = parseInt(slot.split(':')[0],10);
                    return h >= s && h < e;
                  });
                  cells.push(<td key={`${day}-${slot}`} className="text-muted bg-white">-</td>);
                  i += 1;
                }
              }
              return (<tr key={day}><th className="bg-light small">{day}</th>{cells}</tr>);
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  const handleApprove = async (version) => {
    setSubmittingId(version.id);
    try {
      await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}/committee-review`, 'PATCH', {
        approved: true,
        committee_comment: noteById[version.id] || ''
      });
      setPending(prev => prev.filter(v => v.id !== version.id));
      await loadData();
    } catch (err) {
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRequestChanges = async (version) => {
    setSubmittingId(version.id);
    try {
      await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}/committee-review`, 'PATCH', {
        approved: false,
        committee_comment: noteById[version.id] || ''
      });
      alert('Feedback submitted. Scheduler can revise.');
      await loadData();
    } catch (err) {
      alert(`Failed to submit feedback: ${err.message}`);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
      <Container fluid="lg" className="pt-3">
        <InternalNavbar />

        <Card className="border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
            <Card.Header className="text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                <h1 className="fw-bold mb-1">Load Committee Review</h1>
                <p className="mb-0 opacity-75">Review and approve schedule versions</p>
            </Card.Header>

            <Card.Body className="p-4 p-lg-5">
                {error && <Alert variant="danger" className="shadow-sm text-center fw-bold">{error}</Alert>}

                <Card className="mb-4 border-0 shadow-sm bg-light">
                  <Card.Body>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <span className="fw-bold text-primary"><FaUserTie className="me-2"/> Filter by Level:</span>
                      {levels.map(l => (
                        <Button key={l} variant={selectedLevel===l? 'primary':'outline-primary'} size="sm" onClick={()=>setSelectedLevel(l)} className="rounded-pill px-3">
                            Level {l}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-2 text-muted small ms-1">
                      * Approving a schedule marks it as the official version for this level.
                    </div>
                  </Card.Body>
                </Card>

                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white fw-bold border-bottom py-3 text-dark">
                      Pending Schedules for Level {selectedLevel}
                  </Card.Header>
                  <Card.Body className="p-0">
                    {loading ? (
                      <div className="text-center py-5"><Spinner animation="border" variant="primary"/></div>
                    ) : filteredPending.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                          <p className="mb-0">No schedules awaiting approval for Level {selectedLevel}.</p>
                      </div>
                    ) : (
                      <ListGroup variant="flush">
                        {filteredPending.map(version => (
                          <ListGroup.Item key={version.id} className={`p-4 ${version.committee_approved ? 'bg-success bg-opacity-10' : ''}`}>
                            <Row>
                              <Col lg={8}>
                                <div className="mb-3 d-flex justify-content-between align-items-start">
                                  <div>
                                      <h5 className="fw-bold text-dark mb-1">{version.version_comment || 'Untitled Version'}</h5>
                                      <small className="text-muted">Created: {new Date(version.created_at).toLocaleString()}</small>
                                  </div>
                                  <div className="d-flex gap-2">
                                    {version.is_active && <Badge bg="primary">Active</Badge>}
                                    {version.scheduler_approved && <Badge bg="secondary">From Scheduler</Badge>}
                                    {version.committee_approved && <Badge bg="success">Approved</Badge>}
                                  </div>
                                </div>
                                {renderTable(version.sections)}
                              </Col>
                              
                              <Col lg={4} className="border-start mt-4 mt-lg-0 ps-lg-4">
                                <Form.Group className="mb-3">
                                  <Form.Label className="fw-bold small text-uppercase text-muted">Committee Decision Note</Form.Label>
                                  <Form.Control
                                    as="textarea"
                                    rows={4}
                                    className="bg-light border-0 shadow-sm"
                                    value={noteById[version.id] || ''}
                                    onChange={(e) => setNoteById(prev => ({ ...prev, [version.id]: e.target.value }))}
                                    placeholder="Write feedback for changes or approval note..."
                                  />
                                </Form.Group>
                                
                                <div className="d-grid gap-2">
                                  <Button
                                    variant="success"
                                    className="fw-bold shadow-sm"
                                    disabled={submittingId === version.id}
                                    onClick={() => handleApprove(version)}
                                  >
                                    {submittingId === version.id ? <Spinner size="sm" /> : <><FaCheckCircle className="me-2" /> Approve Schedule</>}
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    className="fw-bold"
                                    disabled={submittingId === version.id}
                                    onClick={() => handleRequestChanges(version)}
                                  >
                                    {submittingId === version.id ? <Spinner size="sm" /> : <><FaTimesCircle className="me-2" /> Request Changes</>}
                                  </Button>
                                </div>

                                <div className="mt-4 pt-3 border-top">
                                  <div className="fw-bold small text-uppercase text-muted mb-2">Faculty Comments</div>
                                  <div className="rounded bg-light p-2 border" style={{maxHeight:'200px', overflowY:'auto', fontSize:'0.85rem'}}>
                                    {(facultyCommentsById[version.id] || []).length === 0 ? (
                                      <div className="text-center text-muted py-2">No faculty comments yet.</div>
                                    ) : (
                                      (facultyCommentsById[version.id] || []).map(c => (
                                        <div key={c.id} className="mb-2 pb-2 border-bottom last:border-0">
                                          <div className="fw-bold text-dark">{c.faculty_name || 'Faculty Member'}</div>
                                          <div className="text-secondary">{c.comment}</div>
                                          <div className="text-muted" style={{fontSize:'0.7rem'}}>{new Date(c.created_at).toLocaleDateString()}</div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                  </Card.Body>
                </Card>
            </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default LoadCommittee;