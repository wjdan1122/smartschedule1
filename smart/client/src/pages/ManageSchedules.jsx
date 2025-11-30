import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Table, Form, ListGroup, Badge, Navbar, Nav } from 'react-bootstrap';
import { FaFilter, FaCalendarAlt, FaSyncAlt, FaSave, FaCheckCircle, FaEdit, FaTrash, FaHome, FaUsers, FaBalanceScale, FaBell, FaBook, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import '../App.css';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const timeSlots = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00',
];

const fetchData = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        headers: {
            // ملاحظة: يتم إضافة 'Content-Type': 'application/json' هنا، لكن يجب التأكد من تمرير الـ body كنص JSON
            'Content-Type': 'application/json', 
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        ...options,
    });
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('AUTHENTICATION_FAILED');
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to process request' }));
        throw new Error(errorData.error || errorData.message || 'An unknown error occurred');
    }
    return response.json();
};

const ScheduleTable = ({ scheduleData, level, allCourses, isGenerating, onGenerate, onModify, onSave, isSaving }) => {
    const { id: scheduleId, sections } = scheduleData;
    const [aiCommand, setAiCommand] = useState('');

    const scheduleMap = {};
    sections.forEach((sec) => {
        let dayKey;
        switch (sec.day_code) {
            case 'S': case 'Sun': dayKey = 'Sunday'; break;
            case 'M': case 'Mon': dayKey = 'Monday'; break;
            case 'T': case 'Tue': dayKey = 'Tuesday'; break;
            case 'W': case 'Wed': dayKey = 'Wednesday'; break;
            case 'H': case 'Thu': dayKey = 'Thursday'; break;
            default: dayKey = sec.day_code;
        }
        const start = sec.start_time ? sec.start_time.substring(0, 5) : null;
        const end = sec.end_time ? sec.end_time.substring(0, 5) : null;
        if (start && end && dayKey) {
            const courseInfo = allCourses.find((c) => c.course_id === sec.course_id);
            const courseName = courseInfo ? courseInfo.name : `Course ${sec.course_id}`;
            scheduleMap[dayKey] = scheduleMap[dayKey] || [];
            scheduleMap[dayKey].push({
                timeStart: start, timeEnd: end,
                content: `${courseName} (${sec.section_type?.substring(0, 1) || 'L'})`,
                is_ai_generated: sec.is_ai_generated,
            });
        }
    });

    const generateTimeTable = () => daysOfWeek.map((day) => {
        const daySections = scheduleMap[day] || [];
        const cells = [];
        let i = 0;
        while (i < timeSlots.length) {
            const slot = timeSlots[i];
            const [slotStart] = slot.split(' - ');
            const section = daySections.find((sec) => sec.timeStart === slotStart);
            if (section) {
                const startHour = parseInt(section.timeStart.split(':')[0]);
                const endHour = parseInt(section.timeEnd.split(':')[0]);
                const duration = Math.max(1, endHour - startHour);
                cells.push(
                    <td key={slot} colSpan={duration} className={`border p-2 text-center fw-bold ${section.is_ai_generated ? 'bg-success bg-opacity-25 text-success' : 'bg-primary bg-opacity-10 text-primary'}`} style={{borderRadius:'8px', fontSize:'0.85rem'}}>
                        {section.content}
                    </td>
                );
                i += duration;
            } else {
                const isOverlapped = daySections.some(sec => {
                    const startH = parseInt(sec.timeStart.split(':')[0]);
                    const endH = parseInt(sec.timeEnd.split(':')[0]);
                    const slotH = parseInt(slotStart.split(':')[0]);
                    return slotH >= startH && slotH < endH;
                });
                if (!isOverlapped) cells.push(<td key={slot} className="border-0 bg-light text-muted text-center">-</td>);
                i++;
            }
        }
        return (
            <tr key={day}>
                <th className="bg-light text-center align-middle" style={{width:'100px', fontSize:'0.9rem'}}>{day}</th>
                {cells}
            </tr>
        );
    });

    return (
        <Card className="shadow-sm mb-4 border-0" style={{borderRadius:'15px', overflow:'hidden'}}>
            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold text-primary">Group {scheduleId}</h5>
                <Badge bg="info">Level {level}</Badge>
            </Card.Header>
            <Card.Body className="p-3">
                <div className="table-responsive">
                    <Table bordered className="mb-0">
                        <thead className="bg-dark text-white">
                            <tr>
                                <th className="p-2">Day</th>
                                {timeSlots.map((slot) => <th key={slot} className="p-2 small text-center">{slot}</th>)}
                            </tr>
                        </thead>
                        <tbody>{generateTimeTable()}</tbody>
                    </Table>
                </div>
                <div className="mt-4 pt-3 border-top bg-light rounded p-3">
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">AI Command / Adjustment</Form.Label>
                        <Form.Control as="textarea" rows={2} value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} placeholder="E.g., Avoid gaps on Tuesday..." />
                    </Form.Group>
                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                        <Button variant="success" size="sm" onClick={() => onGenerate(scheduleId, aiCommand)} disabled={isGenerating}>
                            {isGenerating ? <Spinner size="sm" /> : <><FaSyncAlt className="me-1"/> AI Generate</>}
                        </Button>
                        <Button variant="warning" size="sm" onClick={() => onModify(scheduleId, aiCommand)} disabled={isGenerating}>
                            <FaEdit className="me-1"/> Modify
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => onSave(scheduleData, aiCommand)} disabled={isSaving}>
                            {isSaving ? <Spinner size="sm" /> : <><FaSave className="me-1"/> Save Version</>}
                        </Button>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

const ManageSchedules = () => {
    const [currentLevel, setCurrentLevel] = useState(3);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const levels = [3, 4, 5, 6, 7, 8];
    const [allCourses, setAllCourses] = useState([]);
    const [isGenerating, setIsGenerating] = useState(null);
    const [isSaving, setIsSaving] = useState(null);
    const [studentCount, setStudentCount] = useState(25);
    const [savedVersions, setSavedVersions] = useState([]);
    const [sendingId, setSendingId] = useState(null);
    const [userInfo, setUserInfo] = useState({ name: '', role: '', id: '', email: '' });
    const [onlineEditors, setOnlineEditors] = useState([]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserInfo({
            name: user.name || (user.email ? user.email.split('@')[0] : 'Scheduler'),
            role: user.role || '',
            id: user.id || user.user_id || user.userId || '',
            email: user.email || ''
        });
    }, []);

    useEffect(() => {
        const doc = new Y.Doc();
        const providerUrl = process.env.REACT_APP_COLLAB_ENDPOINT || 'wss://smartschedule1-b64l.onrender.com/collaboration';
        const roomName = `manage-schedules-${currentLevel}`;
        const provider = new WebsocketProvider(providerUrl, roomName, doc, { connect: true });
        const awareness = provider.awareness;
        const selfId = userInfo.id || userInfo.email || userInfo.name || 'scheduler';
        const selfName = userInfo.name || userInfo.email || 'Scheduler';

        awareness.setLocalState({ userId: selfId, name: selfName, role: userInfo.role || 'scheduler' });

        const updateOnlineEditors = () => {
            const states = Array.from(awareness.getStates().entries());
            const unique = [];
            const seen = new Set();
            states.forEach(([clientId, state]) => {
                if (!state || !state.userId) return;
                if (state.userId === selfId) return; // don't show current user
                if (seen.has(state.userId)) return;
                seen.add(state.userId);
                unique.push({ clientId, userId: state.userId, name: state.name || 'Guest' });
            });
            setOnlineEditors(unique);
        };

        updateOnlineEditors();
        awareness.on('change', updateOnlineEditors);

        return () => {
            awareness.off?.('change', updateOnlineEditors);
            provider.destroy();
            doc.destroy();
        };
    }, [currentLevel, userInfo]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const BASE_URL = 'https://smartschedule1-b64l.onrender.com'; 
            const [allCoursesData, allSectionsData, versionsData] = await Promise.all([
                fetchData(`${BASE_URL}/api/courses`),
                fetchData(`${BASE_URL}/api/sections`),
                fetchData(`${BASE_URL}/api/schedule-versions?level=${currentLevel}`)
            ]);
            setAllCourses(allCoursesData);
            setSavedVersions(versionsData);
            const activeVersion = versionsData.find(v => v.is_active);
            let sectionsToDisplay = [];
            if (activeVersion && activeVersion.sections) {
                sectionsToDisplay = typeof activeVersion.sections === 'string' ? JSON.parse(activeVersion.sections) : activeVersion.sections;
            } else {
                sectionsToDisplay = allSectionsData.filter((sec) => sec.level != null && parseInt(sec.level) === currentLevel);
            }
            const group1 = sectionsToDisplay.filter((sec) => sec.student_group === 1 || !sec.student_group);
            const group2 = sectionsToDisplay.filter((sec) => sec.student_group === 2);
            const finalSchedules = [{ id: 1, sections: group1 }];
            if (studentCount > 25) finalSchedules.push({ id: 2, sections: group2 });
            setSchedules(finalSchedules);
        } catch (err) {
            if (err.message === 'AUTHENTICATION_FAILED') navigate('/login');
            else setError('Failed to load data. Please refresh the page.');
        } finally { setLoading(false); }
    }, [currentLevel, navigate, studentCount]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleGenerateSchedule = async (scheduleId, command) => {
        setIsGenerating(scheduleId);
        setError(null);
        const currentSchedule = schedules.find(s => s.id === scheduleId);
        try {
            // 💡 التصحيح هنا: استخدام JSON.stringify() لتحويل الكائن إلى نص JSON صالح
            const response = await fetchData('https://smartschedule1-b64l.onrender.com/api/schedule/generate', {
                method: 'POST',
                body: JSON.stringify({
                    currentLevel,
                    currentSchedule,
                    user_command: command,
                    seCourses: allCourses.filter((course) =>
                        String(course.dept_code || '').toUpperCase() === 'SE' || course.is_elective
                    ),
                }),
            });
            setSchedules(prev => prev.map(sch => sch.id === scheduleId ? { ...sch, sections: response.schedule } : sch));
        } catch (err) { setError(err.message); } finally { setIsGenerating(null); }
    };

    const handleModifySchedule = async (scheduleId, comment) => {
        // Mock modify logic or same generate endpoint for simplicity
        handleGenerateSchedule(scheduleId, comment);
    };

    const handleSaveSingleVersion = async (scheduleToSave, comment) => {
        setIsSaving(scheduleToSave.id);
        try {
            const suggestedName = (comment && comment.trim()) ? comment.trim() : `Group ${scheduleToSave.id} - ${new Date().toLocaleDateString()}`;
            const versionName = window.prompt('Version Name:', suggestedName);
            if (!versionName) return setIsSaving(null);
            
            // 💡 التصحيح هنا: استخدام JSON.stringify()
            await fetchData('https://smartschedule1-b64l.onrender.com/api/schedule-versions', {
                method: 'POST',
                body: JSON.stringify({ level: currentLevel, student_count: studentCount, version_comment: versionName, sections: scheduleToSave.sections })
            });
            await fetchAllData();
            alert('Saved!');
        } catch (err) { setError(err.message); } finally { setIsSaving(null); }
    };

    const handleRenameVersion = async (version) => {
        const newName = window.prompt('New Name:', version.version_comment);
        if (!newName) return;
        try {
            // 💡 التصحيح هنا: استخدام JSON.stringify()
            await fetchData(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ version_comment: newName })
            });
            fetchAllData();
        } catch (err) { setError(err.message); }
    };

    const handleDeleteVersion = async (version) => {
        if (version.is_active) return alert('Cannot delete active version.');
        if (!window.confirm('Delete?')) return;
        try {
            await fetchData(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}`, { method: 'DELETE' });
            fetchAllData();
        } catch (err) { setError(err.message); }
    };

    const handleActivateVersion = async (versionId) => {
        try {
            // لا حاجة لـ JSON.stringify هنا إذا كان الـ body فارغًا أو يتم التعامل معه في الخادم
            await fetchData(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${versionId}/activate`, { method: 'PATCH' });
            fetchAllData();
        } catch (err) { setError(err.message); }
    };

    const handleSendToCommittee = async (version) => {
        setSendingId(version.id);
        try {
            // 💡 التصحيح هنا: استخدام JSON.stringify()
            await fetchData(`https://smartschedule1-b64l.onrender.com/api/schedule-versions/${version.id}/scheduler-approve`, {
                method: 'PATCH',
                body: JSON.stringify({ approved: true })
            });
            fetchAllData();
        } catch (err) { setError(err.message); } finally { setSendingId(null); }
    };

    const handleLogout = () => { localStorage.clear(); navigate('/login'); };
    const isActive = (path) => location.pathname === path ? 'active' : '';

    // --- Internal Navbar ---
    const InternalNavbar = () => (
        <Navbar expand="lg" variant="dark" className="shadow-lg p-3 mb-4 rounded" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'}}>
          <Container fluid>
            <Navbar.Brand className="fw-bold fs-4">🎓 KSU SmartSchedule</Navbar.Brand>
            <Navbar.Toggle aria-controls="navbar-nav" />
            <Navbar.Collapse id="navbar-nav">
              <Nav className="mx-auto">
                <Nav.Link onClick={() => navigate('/dashboard')} className={`text-white mx-2 ${isActive('/dashboard') && 'fw-bold'}`}><FaHome className="me-1"/> Home</Nav.Link>
                <Nav.Link onClick={() => navigate('/manageSchedules')} className={`text-white mx-2 fw-bold ${isActive('/manageSchedules') && 'text-warning'}`}><FaCalendarAlt className="me-1"/> Schedules</Nav.Link>
                <Nav.Link onClick={() => navigate('/managestudents')} className={`text-white mx-2 ${isActive('/managestudents') && 'fw-bold'}`}><FaUsers className="me-1"/> Students</Nav.Link>
                <Nav.Link onClick={() => navigate('/addElective')} className={`text-white mx-2 ${isActive('/addElective') && 'fw-bold'}`}><FaBook className="me-1"/> Courses</Nav.Link>
                <Nav.Link onClick={() => navigate('/managerules')} className={`text-white mx-2 ${isActive('/managerules') && 'fw-bold'}`}><FaBalanceScale className="me-1"/> Rules</Nav.Link>
                <Nav.Link onClick={() => navigate('/managenotifications')} className={`text-white mx-2 ${isActive('/managenotifications') && 'fw-bold'}`}><FaBell className="me-1"/> Comments</Nav.Link>
              </Nav>
              <div className="d-flex align-items-center mt-3 mt-lg-0">
                 <div className="text-white text-end me-3 lh-1 d-none d-lg-block">
                    <div className="fw-bold">{userInfo.name}</div>
                    <small className="text-white-50 text-uppercase">{userInfo.role}</small>
                 </div>
                 <Button variant="danger" size="sm" className="fw-bold px-3 rounded-pill" onClick={handleLogout}><FaSignOutAlt className="me-1"/> Logout</Button>
              </div>
            </Navbar.Collapse>
          </Container>
        </Navbar>
    );

    return (
        <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', paddingBottom: '2rem'}}>
            <Container fluid="lg" className="pt-3">
                <InternalNavbar />
                
                <Card className="border-0 shadow-lg" style={{borderRadius: '20px', background: 'rgba(255,255,255,0.95)'}}>
                    <Card.Header className="text-center text-white py-4" style={{background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px'}}>
                        <h1 className="fw-bold mb-1">Smart Schedule Management</h1>
                        <p className="mb-0 opacity-75">Generate, modify, and manage academic schedules using AI</p>
                    </Card.Header>
                    
                    <Card.Body className="p-4 p-lg-5">
                        {error && <Alert variant="danger">{error}</Alert>}
                        <div className="mb-3 d-flex align-items-center flex-wrap gap-2">
                            <span className="fw-bold text-primary mb-0">Online now:</span>
                            {onlineEditors.length === 0 ? (
                                <Badge bg="light" text="dark" className="border border-primary text-primary px-3 py-2 rounded-pill">Just you</Badge>
                            ) : (
                                onlineEditors.map((editor) => (
                                    <Badge key={editor.userId} bg="info" text="dark" className="px-3 py-2 rounded-pill shadow-sm">
                                        {editor.name}
                                    </Badge>
                                ))
                            )}
                        </div>
                        
                        <Row>
                            <Col md={8}>
                                {loading ? <div className="text-center p-5"><Spinner animation="border"/></div> : schedules.map((schedule) => (
                                    <ScheduleTable
                                        key={schedule.id}
                                        scheduleData={schedule}
                                        level={currentLevel}
                                        allCourses={allCourses}
                                        onGenerate={handleGenerateSchedule}
                                        onModify={handleModifySchedule}
                                        isGenerating={isGenerating === schedule.id}
                                        onSave={handleSaveSingleVersion}
                                        isSaving={isSaving === schedule.id}
                                    />
                                ))}
                                {!loading && schedules.length === 0 && <Alert variant="info">No active schedules to display for this level.</Alert>}
                            </Col>
                            
                            <Col md={4}>
                                <Card className="mb-4 border-0 shadow-sm bg-light">
                                    <Card.Header className="bg-white border-bottom fw-bold"><FaFilter className="me-2 text-primary"/> Controls</Card.Header>
                                    <Card.Body>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold small">Filter by Level</Form.Label>
                                            <div className="d-flex flex-wrap gap-2">
                                                {levels.map((level) => (
                                                    <Button size="sm" key={level} variant={currentLevel === level ? 'primary' : 'outline-primary'} onClick={() => setCurrentLevel(level)}>
                                                        Lvl {level}
                                                    </Button>
                                                ))}
                                            </div>
                                        </Form.Group>
                                        <Form.Group>
                                            <Form.Label className="fw-bold small">Student Count</Form.Label>
                                            <Form.Control type="number" size="sm" value={studentCount} onChange={(e) => setStudentCount(parseInt(e.target.value, 10) || 0)} />
                                        </Form.Group>
                                    </Card.Body>
                                </Card>

                                <Card className="border-0 shadow-sm bg-light">
                                    <Card.Header className="bg-white border-bottom fw-bold"><FaSave className="me-2 text-success"/> Saved Versions</Card.Header>
                                    <Card.Body style={{maxHeight: '400px', overflowY: 'auto'}}>
                                        {savedVersions.length > 0 ? (
                                            <ListGroup variant="flush">
                                                {savedVersions.map(version => (
                                                    <ListGroup.Item key={version.id} className="bg-transparent border-bottom">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                            <div>
                                                                <div className="fw-bold small">{version.version_comment}</div>
                                                                <div className="text-muted" style={{fontSize:'0.7rem'}}>{new Date(version.created_at).toLocaleDateString()}</div>
                                                            </div>
                                                            {version.is_active && <Badge bg="success" pill>Active</Badge>}
                                                        </div>
                                                        <div className="d-flex gap-1 justify-content-end">
                                                            {!version.is_active && <Button variant="outline-success" size="sm" style={{fontSize:'0.7rem'}} onClick={() => handleActivateVersion(version.id)}>Activate</Button>}
                                                            <Button variant="outline-secondary" size="sm" style={{fontSize:'0.7rem'}} onClick={() => handleRenameVersion(version)}><FaEdit/></Button>
                                                            <Button variant="outline-danger" size="sm" style={{fontSize:'0.7rem'}} onClick={() => handleDeleteVersion(version)} disabled={version.is_active}><FaTrash/></Button>
                                                        </div>
                                                        {version.committee_comment && <Alert variant="warning" className="mt-2 mb-0 p-1 small">{version.committee_comment}</Alert>}
                                                        <Button variant="outline-dark" size="sm" className="w-100 mt-2" style={{fontSize:'0.7rem'}} disabled={sendingId === version.id} onClick={() => handleSendToCommittee(version)}>
                                                            {sendingId === version.id ? <Spinner size="sm"/> : 'Send to Committee'}
                                                        </Button>
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        ) : <p className="text-center text-muted small mb-0">No saved versions.</p>}
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

export default ManageSchedules;
