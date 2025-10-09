import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { FaArrowRight, FaFilter, FaCalendarAlt, FaSyncAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// ======================== إعداد الأيام والأوقات ========================
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const timeSlots = [
    '08:00 - 09:00',
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '12:00 - 13:00',
    '13:00 - 14:00',
    '14:00 - 15:00',
];

// ======================== دالة عامة لجلب البيانات ========================
const fetchData = async (url) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        throw new Error('AUTHENTICATION_FAILED');
    }

    if (!response.ok) {
        throw new Error('Failed to load data');
    }

    return response.json();
};

// ======================== مكوّن الجدول ========================
const ScheduleTable = ({ scheduleNumber, level, sections, loading, allCourses, onGenerate, isGenerating }) => {
    const scheduleMap = {};

    sections.forEach((sec) => {
        let dayKey;
        switch (sec.day_code) {
            case 'S':
            case 'Sun':
                dayKey = 'Sunday';
                break;
            case 'M':
            case 'Mon':
                dayKey = 'Monday';
                break;
            case 'T':
            case 'Tue':
                dayKey = 'Tuesday';
                break;
            case 'W':
            case 'Wed':
                dayKey = 'Wednesday';
                break;
            case 'H':
            case 'Thu':
                dayKey = 'Thursday';
                break;
            default:
                dayKey = sec.day_code;
        }

        const start = sec.start_time ? sec.start_time.substring(0, 5) : null;
        const end = sec.end_time ? sec.end_time.substring(0, 5) : null;

        if (start && end) {
            const courseInfo = allCourses.find((c) => c.course_id === sec.course_id);
            const dept = courseInfo ? courseInfo.dept_code : (sec.dept_code || 'N/A');
            const courseName = courseInfo ? courseInfo.name : `Course ${sec.course_id}`;

            scheduleMap[dayKey] = scheduleMap[dayKey] || [];
            scheduleMap[dayKey].push({
                timeStart: start,
                timeEnd: end,
                content: `${dept} ${courseName.split(' ')[0]} (${sec.section_type?.substring(0, 1) || ''})`,
                is_ai_generated: sec.is_ai_generated,
            });
        }
    });

    const generateTimeTable = () => {
        const rows = daysOfWeek.map((day) => {
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
                    const duration = endHour - startHour;

                    cells.push(
                        <td
                            key={slot}
                            colSpan={duration}
                            className={`border p-2 text-center font-semibold ${section.is_ai_generated ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'
                                }`}
                        >
                            {section.content}
                        </td>
                    );
                    i += duration;
                } else {
                    const overlap = daySections.some((sec) => {
                        const startH = parseInt(sec.timeStart.split(':')[0]);
                        const endH = parseInt(sec.timeEnd.split(':')[0]);
                        const slotH = parseInt(slotStart.split(':')[0]);
                        return slotH > startH && slotH < endH;
                    });

                    if (!overlap) {
                        cells.push(
                            <td key={slot} className="border p-2 text-center text-gray-400 bg-gray-50">
                                -
                            </td>
                        );
                    }
                    i++;
                }
            }

            return (
                <tr key={day} className="hover:bg-gray-100 transition duration-150">
                    <th className="border p-2 bg-gray-200 text-center w-1/12">{day}</th>
                    {cells}
                </tr>
            );
        });

        return (
            <Table responsive className="min-w-full bg-white shadow-md rounded-lg overflow-hidden border-collapse">
                <thead>
                    <tr className="bg-blue-900 text-white">
                        <th className="border p-2">Day</th>
                        {timeSlots.map((slot) => (
                            <th key={slot} className="border p-2 text-sm">
                                {slot}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </Table>
        );
    };

    if (loading) {
        return (
            <div className="text-center p-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Loading schedule data...</p>
            </div>
        );
    }

    return (
        <Card className="shadow-lg mb-4 border-indigo-400 border-2">
            <Card.Header className="bg-indigo-500 text-black text-center py-3">
                <h4 className="mb-0">
                    Schedule {scheduleNumber} - Level {level} (Courses: {sections.length})
                </h4>
            </Card.Header>
            <Card.Body className="overflow-x-auto p-4">
                {sections.length === 0 ? (
                    <div className="text-center text-purple-600 p-4 bg-gray-50 border-dashed border-2 border-gray-300 rounded-lg">
                        No sections available for this schedule yet.
                    </div>
                ) : (
                    generateTimeTable()
                )}

                <div className="text-center mt-4">
                    <Button
                        onClick={() => onGenerate(scheduleNumber)}
                        className="bg-green-600 border-0"
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                <span> Generating...</span>
                            </>
                        ) : (
                            <>
                                <FaSyncAlt className="me-2" /> Generate Schedule (AI)
                            </>
                        )}
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

// ======================== المكون الرئيسي ========================
const ManageSchedules = () => {
    const [currentLevel, setCurrentLevel] = useState(3);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const levels = [3, 4, 5, 6, 7, 8];
    const [rules, setRules] = useState([]);
    const [seCourses, setSeCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [isGenerating, setIsGenerating] = useState(null);

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const allSections = await fetchData('http://localhost:5000/api/sections');
            const byLevel = allSections.filter((sec) => parseInt(sec.level) === currentLevel);
            const group1 = byLevel.filter((sec) => sec.student_group === 1 || !sec.student_group);
            const group2 = byLevel.filter((sec) => sec.student_group === 2);

            setSchedules(
                [
                    { id: 1, sections: group1 },
                    { id: 2, sections: group2 },
                ].filter((sch) => sch.sections.length > 0)
            );
        } catch (err) {
            console.error(err);
            if (err.message === 'AUTHENTICATION_FAILED') navigate('/login');
            else setError('Failed to load schedules. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, [currentLevel, navigate]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [rulesData, seCoursesData, allCoursesData] = await Promise.all([
                    fetchData('http://localhost:5000/api/rules'),
                    fetchData(`http://localhost:5000/api/courses?level=${currentLevel}&department=SE`),
                    fetchData('http://localhost:5000/api/courses'),
                ]);

                setRules(rulesData.map((r) => r.text));
                setSeCourses(seCoursesData);
                setAllCourses(allCoursesData);
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
                setError('Failed to load required data. Please check the console.');
            }
        };

        fetchSchedules();
        fetchInitialData();
    }, [currentLevel, fetchSchedules]);

    const handleGenerateSchedule = async (scheduleId) => {
        setIsGenerating(scheduleId);
        setError(null);

        const currentSchedule = schedules.find(s => s.id === scheduleId);
        if (!currentSchedule) {
            setError("Could not find the selected schedule.");
            setIsGenerating(null);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/schedule/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({ currentLevel, currentSchedule, seCourses, rules }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate schedule from AI.');
            }

            const result = await response.json();
            const newSections = result.schedule;

            // ✅ حذف المواد القديمة الخاصة بـ SE فقط واستبدالها بالنتائج الجديدة
            setSchedules(prevSchedules =>
                prevSchedules.map(sch =>
                    sch.id === scheduleId
                        // نحذف مواد قسم SE القديمة ونضيف الجديدة بدلها
                        ? {
                            ...sch,
                            sections: [
                                ...sch.sections.filter(sec => sec.dept_code !== 'SE' && !sec.is_ai_generated),
                                ...newSections
                            ]
                        }
                        : sch
                )
            );
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsGenerating(null);
        }
    };


    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' }}>
            <Container fluid="lg" className="bg-purple-100 rounded-lg shadow-lg p-4 text-dark">
                <div className="flex justify-between items-center mb-6 bg-blue-900 p-3 rounded-lg text-white">
                    <Button onClick={() => navigate('/dashboard')} className="bg-opacity-20 border-0">
                        <FaArrowRight className="me-2" /> Back to Dashboard
                    </Button>
                    <h1 className="text-xl font-bold">Smart Schedule Management</h1>
                    <div></div>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Card className="mb-6 shadow">
                    <Card.Body>
                        <h3 className="text-xl font-bold mb-3 text-purple-800">
                            <FaFilter className="me-2" /> Filter Levels
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {levels.map((level) => (
                                <Button
                                    key={level}
                                    className={`font-semibold ${currentLevel === level ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-indigo-600'
                                        }`}
                                    onClick={() => setCurrentLevel(level)}
                                >
                                    Level {level}
                                </Button>
                            ))}
                        </div>
                    </Card.Body>
                </Card>

                <Card>
                    <Card.Body>
                        <h3 className="text-xl font-bold mb-3 text-blue-800">
                            <FaCalendarAlt className="me-2" /> Suggested Schedules
                        </h3>
                        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-3 mb-4">
                            <span>📊 Displaying schedules for Level {currentLevel}</span>
                        </div>

                        <div className="grid md:grid-cols-1 gap-6">
                            {loading ? (
                                <div className="text-center">
                                    <Spinner animation="border" variant="primary" />
                                    <p>Loading schedules...</p>
                                </div>
                            ) : schedules.length > 0 ? (
                                schedules.map((schedule) => (
                                    <ScheduleTable
                                        key={schedule.id}
                                        scheduleNumber={schedule.id}
                                        level={currentLevel}
                                        sections={schedule.sections}
                                        loading={loading}
                                        allCourses={allCourses}
                                        onGenerate={handleGenerateSchedule}
                                        isGenerating={isGenerating === schedule.id}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-gray-600 p-6 bg-gray-50 border-dashed border-2 border-gray-300 rounded-lg">
                                    No schedules currently available for this level.
                                </div>
                            )}
                        </div>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageSchedules;
