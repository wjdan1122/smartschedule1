import React, { useEffect, useState, useCallback } from 'react';
import { Container, Card, Alert, Spinner, Table, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

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
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) {
    const msg = data.message || data.error || `Request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
};

const Faculty = () => {
  const [levels] = useState([3,4,5,6,7,8]);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [versions, setVersions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myCommentsById, setMyCommentsById] = useState({});
  const navigate = useNavigate();
  const [noteById, setNoteById] = useState({});
  const [sendingId, setSendingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 👇 تم تحديث الروابط هنا
      const [vers, crs] = await Promise.all([
        fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/approved?level=${selectedLevel}`),
        fetchJson('https://smartschedule1-b64l.onrender.com/api/courses')
      ]);
      const approved = vers || [];
      setVersions(approved);
      setCourses(crs || []);
      // load my own faculty comments for each version
      const entries = await Promise.all(
        approved.map(async v => {
          try {
            // 👇 تم تحديث الرابط هنا
            const mine = await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${v.id}/my-faculty-comments`);
            return [v.id, mine || []];
          } catch { return [v.id, []]; }
        })
      );
      setMyCommentsById(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedLevel]);

  useEffect(() => { loadData(); }, [loadData]);

  const dayLabel = (code) => ({ S: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', H: 'Thursday' }[code] || code);
  const timeSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00'];

  const buildScheduleMap = (sections) => {
    const arr = typeof sections === 'string' ? (()=>{ try { return JSON.parse(sections); } catch { return []; } })() : (Array.isArray(sections) ? sections : []);
    const map = {};
    arr.forEach(sec => {
      const day = dayLabel(sec.day_code);
      if (!day || !sec.start_time || !sec.end_time) return;
      if (!map[day]) map[day] = [];
      const courseInfo = courses.find(c => c.course_id === sec.course_id);
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

  const handleSend = async (version) => {
    const text = (noteById[version.id] || '').trim();
    if (!text) return alert('Please write a comment first.');
    setSendingId(version.id);
    try {
      // 👇 تم تحديث الرابط هنا
      await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}/faculty-comments`, 'POST', { comment: text });
      setNoteById(prev => ({ ...prev, [version.id]: '' }));
      // refresh my comments only
      // 👇 تم تحديث الرابط هنا
      const mine = await fetchJson(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}/my-faculty-comments`);
      setMyCommentsById(prev => ({ ...prev, [version.id]: mine || [] }));
    } catch (e) {
      alert(e.message || 'Failed to send comment.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-light">
      <Container fluid="lg" className="py-4">
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-dark text-white rounded">
          <h1 className="h3 mb-0">Faculty Approved Schedules</h1>
          <div>
            <Button variant="outline-light" size="sm" onClick={() => { localStorage.clear(); navigate('/login'); }}>
              Logout
            </Button>
          </div>
        </div>

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
              Showing schedules approved by the Load Committee for the selected level.
            </div>
          </Card.Body>
        </Card>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card>
          <Card.Header><strong>Approved Schedules for Level {selectedLevel}</strong></Card.Header>
          <Card.Body>
            {loading ? (
              <div className="text-center py-5"><Spinner /></div>
            ) : versions.length === 0 ? (
              <Alert variant="info" className="mb-0">No approved schedules for this level.</Alert>
            ) : (
              versions.map(v => (
                <Card key={v.id} className="mb-4">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">{v.version_comment || 'Untitled Version'}</div>
                      <small className="text-muted">Level {v.level} • {new Date(v.created_at).toLocaleString()}</small>
                    </div>
                    <div className="d-flex gap-2">
                      {v.is_active && <Badge bg="primary">Active</Badge>}
                      {v.committee_approved && <Badge bg="success">Approved</Badge>}
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {renderTable(v.sections)}
                    <Row className="mt-3">
                      <Col md={7}>
                        <h6 className="fw-semibold mb-2">Your Comments</h6>
                        <div className="border rounded p-2 bg-light" style={{maxHeight:'200px', overflowY:'auto'}}>
                          {(myCommentsById[v.id] || []).length === 0 ? (
                            <div className="text-muted">No comments yet.</div>
                          ) : (
                            (myCommentsById[v.id] || []).map(c => (
                              <div key={c.id} className="mb-2">
                                <div className="small text-muted">{new Date(c.created_at).toLocaleString()}</div>
                                <div>{c.comment}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </Col>
                      <Col md={5}>
                        <h6 className="fw-semibold mb-2">Add Your Comment</h6>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          placeholder="Write a note to the Load Committee..."
                          value={noteById[v.id] || ''}
                          onChange={(e)=> setNoteById(p=> ({...p, [v.id]: e.target.value}))}
                        />
                        <div className="mt-2">
                          <Button disabled={sendingId===v.id} onClick={()=>handleSend(v)}>
                            {sendingId===v.id ? 'Sending...' : 'Send Comment'}
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))
            )}
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default Faculty;