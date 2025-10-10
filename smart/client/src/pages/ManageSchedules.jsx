import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, Table, Form, ListGroup, Badge } from 'react-bootstrap';
import { FaArrowRight, FaFilter, FaCalendarAlt, FaSyncAlt, FaSave, FaCheckCircle, FaEdit } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
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

// ======================== Schedule Table ========================
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
                    <td key={slot} colSpan={duration}
                        className={`border p-2 text-center font-semibold ${section.is_ai_generated ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>
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
                if (!isOverlapped) {
                    cells.push(<td key={slot} className="border p-2 text-center text-gray-400 bg-gray-50">-</td>);
                }
                i++;
            }
        }
        return (
            <tr key={day}>
                <th className="border p-2 bg-gray-200 text-center w-1/12">{day}</th>
                {cells}
            </tr>
        );
    });

    return (
        <Card className="shadow-lg mb-4">
            <Card.Header className="bg-indigo-500 text-purple-300 text-center py-3">
                <h4 className="mb-0">Schedule Group {scheduleId} - Level {level}</h4>
            </Card.Header>
            <Card.Body className="p-4">
                <Table responsive bordered className="min-w-full bg-white">
                    <thead>
                        <tr className="bg-blue-900 text-white">
                            <th className="p-2">Day</th>
                            {timeSlots.map((slot) => <th key={slot} className="p-2 text-sm">{slot}</th>)}
                        </tr>
                    </thead>
                    <tbody>{generateTimeTable()}</tbody>
                </Table>
                <div className="mt-4 border-t pt-4">
                    <Form.Group className="mb-3">
                        <Form.Label className="font-semibold">AI Command / Comment</Form.Label>
                        <Form.Control
                            as="textarea" rows={2}
                            value={aiCommand} onChange={(e) => setAiCommand(e.target.value)}
                            placeholder="Example: Move all lectures to the morning."
                        />
                    </Form.Group>

                    <div className="text-center d-flex justify-content-center gap-3 flex-wrap">
                        <Button onClick={() => onGenerate(scheduleId, aiCommand)} className="bg-green-600 border-0" disabled={isGenerating}>
                            {isGenerating ? <><Spinner size="sm" /> Generating...</> : <><FaSyncAlt className="me-2" /> Generate with AI</>}
                        </Button>

                        <Button onClick={() => onModify(scheduleId, aiCommand)} className="bg-warning border-0 text-dark" disabled={isGenerating}>
                            {isGenerating ? <><Spinner size="sm" /> Modifying...</> : <><FaEdit className="me-2" /> Modify (Comment)</>}
                        </Button>

                        <Button onClick={() => onSave(scheduleData, aiCommand)} className="bg-blue-600 border-0" disabled={isSaving}>
                            {isSaving ? <><Spinner size="sm" /> Saving...</> : <><FaSave className="me-2" /> Save this Version</>}
                        </Button>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

// ======================== Main Component ========================
const ManageSchedules = () => {
    const [currentLevel, setCurrentLevel] = useState(3);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const levels = [3, 4, 5, 6, 7, 8];
    const [allCourses, setAllCourses] = useState([]);
    const [isGenerating, setIsGenerating] = useState(null);
    const [isSaving, setIsSaving] = useState(null);
    const [studentCount, setStudentCount] = useState(25);
    const [savedVersions, setSavedVersions] = useState([]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [allCoursesData, allSectionsData, versionsData] = await Promise.all([
                fetchData('http://localhost:5000/api/courses'),
                fetchData('http://localhost:5000/api/sections'),
                fetchData(`http://localhost:5000/api/schedule-versions?level=${currentLevel}`)
            ]);
            setAllCourses(allCoursesData);
            setSavedVersions(versionsData);

            const activeVersion = versionsData.find(v => v.is_active);
            let sectionsToDisplay = [];

            if (activeVersion && activeVersion.sections) {
                sectionsToDisplay = typeof activeVersion.sections === 'string'
                    ? JSON.parse(activeVersion.sections)
                    : activeVersion.sections;
            } else {
                sectionsToDisplay = allSectionsData.filter((sec) => sec.level != null && parseInt(sec.level) === currentLevel);
            }

            const group1 = sectionsToDisplay.filter((sec) => sec.student_group === 1 || !sec.student_group);
            const group2 = sectionsToDisplay.filter((sec) => sec.student_group === 2);

            const finalSchedules = [{ id: 1, sections: group1 }];
            if (studentCount > 25) {
                finalSchedules.push({ id: 2, sections: group2 });
            }
            setSchedules(finalSchedules);

        } catch (err) {
            console.error(err);
            if (err.message === 'AUTHENTICATION_FAILED') navigate('/login');
            else setError('Failed to load data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    }, [currentLevel, navigate, studentCount]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleGenerateSchedule = async (scheduleId, command) => {
        setIsGenerating(scheduleId);
        setError(null);
        const currentSchedule = schedules.find(s => s.id === scheduleId);
        if (!currentSchedule) {
            setError("Cannot find the schedule to modify.");
            setIsGenerating(null);
            return;
        }
        try {
            const response = await fetchData('http://localhost:5000/api/schedule/generate', {
                method: 'POST',
                body: JSON.stringify({
                    currentLevel,
                    currentSchedule,
                    user_command: command
                }),
            });
            setSchedules(prev => prev.map(sch => sch.id === scheduleId ? { ...sch, sections: response.schedule } : sch));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleModifySchedule = async (scheduleId, comment) => {
        setIsGenerating(scheduleId);
        setError(null);
        const currentSchedule = schedules.find(s => s.id === scheduleId);
        if (!currentSchedule) {
            setError("Cannot find the schedule to modify.");
            setIsGenerating(null);
            return;
        }
        try {
            const response = await fetchData('http://localhost:5000/api/schedule/modify', {
                method: 'POST',
                body: JSON.stringify({
                    currentLevel,
                    currentSchedule,
                    userComment: comment || "Please refine this schedule slightly.",
                    rules: []
                }),
            });
            setSchedules(prev => prev.map(sch => sch.id === scheduleId ? { ...sch, sections: response.schedule } : sch));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleSaveSingleVersion = async (scheduleToSave, comment) => {
        setIsSaving(scheduleToSave.id);
        setError(null);
        try {
            await fetchData('http://localhost:5000/api/schedule-versions', {
                method: 'POST',
                body: JSON.stringify({
                    level: currentLevel,
                    student_count: studentCount,
                    version_comment: comment || `Saved version for Group ${scheduleToSave.id} on ${new Date().toLocaleDateString()}`,
                    sections: scheduleToSave.sections
                })
            });
            fetchAllData();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(null);
        }
    };

    const handleActivateVersion = async (versionId) => {
        try {
            await fetchData(`http://localhost:5000/api/schedule-versions/${versionId}/activate`, { method: 'PATCH' });
            fetchAllData();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-light">
            <Container fluid="lg" className="py-4">
                <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-dark text-white rounded">
                    <h1 className="h3 mb-0">Smart Schedule Management</h1>
                    <Button variant="outline-light" onClick={() => navigate('/dashboard')}><FaArrowRight className="me-2" /> Back</Button>
                </div>
                {error && <Alert variant="danger">{error}</Alert>}
                <Row>
                    <Col md={8}>
                        <Card className="mb-4">
                            <Card.Header><h5 className="mb-0"><FaCalendarAlt className="me-2" /> Schedules for Level {currentLevel}</h5></Card.Header>
                            <Card.Body>
                                {loading ? <div className="text-center p-5"><Spinner /></div> : schedules.map((schedule) => (
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
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={4}>
                        <Card className="mb-4">
                            <Card.Header><h5 className="mb-0"><FaFilter className="me-2" /> Controls</h5></Card.Header>
                            <Card.Body>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Filter by Level</Form.Label>
                                    <div className="d-flex flex-wrap gap-2">
                                        {levels.map((level) => (
                                            <Button key={level} variant={currentLevel === level ? 'primary' : 'outline-primary'} onClick={() => setCurrentLevel(level)}>
                                                Level {level}
                                            </Button>
                                        ))}
                                    </div>
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label className="fw-bold">Student Count</Form.Label>
                                    <Form.Control type="number" value={studentCount} onChange={(e) => setStudentCount(parseInt(e.target.value, 10) || 0)} />
                                    <Form.Text>If count > 25, Group 2 may be shown.</Form.Text>
                                </Form.Group>
                            </Card.Body>
                        </Card>
                        <Card>
                            <Card.Header><h5 className="mb-0"><FaSave className="me-2" /> Saved Versions</h5></Card.Header>
                            <Card.Body>
                                {loading ? <div className="text-center"><Spinner size="sm" /></div> : savedVersions.length > 0 ? (
                                    <ListGroup variant="flush">
                                        {savedVersions.map(version => (
                                            <ListGroup.Item key={version.id} className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <p className="fw-bold mb-1">{version.version_comment || "No comment"}</p>
                                                    <small className="text-muted">
                                                        {new Date(version.created_at).toLocaleString()}
                                                    </small>
                                                </div>
                                                {version.is_active ? (
                                                    <Badge bg="success"><FaCheckCircle className="me-1" /> Active</Badge>
                                                ) : (
                                                    <Button variant="outline-success" size="sm" onClick={() => handleActivateVersion(version.id)}>Activate</Button>
                                                )}
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                ) : (
                                    <p className="text-muted text-center mb-0">No saved versions for this level.</p>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default ManageSchedules;
