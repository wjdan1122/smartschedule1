import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Container, Card, ListGroup, Button, Spinner, Alert, Form, Badge, Table, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

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
  const levels = [3,4,5,6,7,8];
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, courses] = await Promise.all([
        fetchJson('http://localhost:5000/api/schedule-versions/pending-committee'),
        fetchJson('http://localhost:5000/api/courses')
      ]);
      setPending(list || []);
      setAllCourses(courses || []);
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
        <Table bordered className="text-center align-middle">
          <thead>
            <tr>
              <th style={{width:'12%'}}>Day</th>
              {timeSlots.map(ts => (<th key={ts}>{ts}</th>))}
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
                  cells.push(<td key={`${day}-${slot}`} colSpan={span} className="bg-light fw-semibold">{block.content}</td>);
                  i += span;
                } else {
                  const overlapped = blocks.some(b => {
                    const s = parseInt(b.start.split(':')[0],10);
                    const e = parseInt(b.end.split(':')[0],10);
                    const h = parseInt(slot.split(':')[0],10);
                    return h >= s && h < e;
                  });
                  cells.push(<td key={`${day}-${slot}`} className="text-muted">{overlapped ? '' : '-'}</td>);
                  i += 1;
                }
              }
              return (<tr key={day}><th>{day}</th>{cells}</tr>);
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  const handleApprove = async (version) => {
    setSubmittingId(version.id);
    try {
      await fetchJson(`http://localhost:5000/api/schedule-versions/${version.id}/committee-review`, 'PATCH', {
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
      await fetchJson(`http://localhost:5000/api/schedule-versions/${version.id}/committee-review`, 'PATCH', {
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
    <div className="min-h-screen bg-light">
      <Container fluid="lg" className="py-4">
        <div className="d-flex justify-content-start align-items-center mb-4 p-3 bg-dark text-white rounded">
          <h1 className="h3 mb-0">Load Committee Review</h1>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card className="mb-3">
          <Card.Header><strong>Filter</strong></Card.Header>
          <Card.Body>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold">Level:</span>
              {levels.map(l => (
                <Button key={l} variant={selectedLevel===l? 'primary':'outline-primary'} size="sm" onClick={()=>setSelectedLevel(l)}>Level {l}</Button>
              ))}
            </div>
            <div className="mt-2 text-muted" style={{fontSize:'0.9rem'}}>
              Clicking Approve marks the selected schedule as the only approved one for this level.
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><strong>Pending Schedules for Level {selectedLevel}</strong></Card.Header>
          <Card.Body>
            {loading ? (
              <div className="text-center py-5"><Spinner /></div>
            ) : filteredPending.length === 0 ? (
              <Alert variant="info" className="mb-0">No schedules awaiting committee approval for this level.</Alert>
            ) : (
              <ListGroup variant="flush">
                {filteredPending.map(version => (
                  <ListGroup.Item key={version.id} className={`d-flex flex-column gap-3 ${version.committee_approved ? 'border border-success' : ''}`}>
                    <Row>
                      <Col md={8}>
                        <div className="mb-2">
                          <div className="fw-bold">{version.version_comment || 'Untitled Version'}</div>
                          <small className="text-muted">Level {version.level} • {new Date(version.created_at).toLocaleString()}</small>
                          <div className="mt-2 d-flex gap-2">
                            {version.is_active && <Badge bg="primary">Active</Badge>}
                            {version.scheduler_approved && <Badge bg="secondary">From Scheduler</Badge>}
                            {version.committee_approved && <Badge bg="success">Approved</Badge>}
                          </div>
                        </div>
                        {renderTable(version.sections)}
                      </Col>
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-semibold">Committee Note (optional)</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={5}
                            value={noteById[version.id] || ''}
                            onChange={(e) => setNoteById(prev => ({ ...prev, [version.id]: e.target.value }))}
                            placeholder="Write feedback or approval note..."
                          />
                        </Form.Group>
                        <div className="d-flex gap-2 flex-wrap mt-2">
                          <Button
                            variant="success"
                            disabled={submittingId === version.id}
                            onClick={() => handleApprove(version)}
                          >
                            {submittingId === version.id ? <Spinner size="sm" /> : <FaCheckCircle className="me-1" />} Approve
                          </Button>
                          <Button
                            variant="outline-danger"
                            disabled={submittingId === version.id}
                            onClick={() => handleRequestChanges(version)}
                          >
                            {submittingId === version.id ? <Spinner size="sm" /> : <FaTimesCircle className="me-1" />} Request Changes
                          </Button>
                        </div>
                      </Col>
                    </Row>
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

export default LoadCommittee;
