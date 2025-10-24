import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { FaArrowRight, FaFilter, FaCalendarAlt, FaSyncAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../App.css';

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

// ------------------------------------------------------------------
// ✅ Table component with merged cells according to lecture duration
// ------------------------------------------------------------------
const ScheduleTable = ({ scheduleNumber, level, sections, loading }) => {
    const scheduleMap = {};

    sections.forEach((sec) => {
        let dayKey;
        switch (sec.day_code) {
            case 'S':
                dayKey = 'Sunday';
                break;
            case 'M':
                dayKey = 'Monday';
                break;
            case 'T':
                dayKey = 'Tuesday';
                break;
            case 'W':
                dayKey = 'Wednesday';
                break;
            case 'H':
                dayKey = 'Thursday';
                break;
            default:
                dayKey = sec.day_code;
        }

        const start = sec.start_time ? sec.start_time.substring(0, 5) : null;
        const end = sec.end_time ? sec.end_time.substring(0, 5) : null;
        const courseName = sec.course_name || `Course ${sec.course_id}`;

        if (start && end) {
            scheduleMap[dayKey] = scheduleMap[dayKey] || [];
            scheduleMap[dayKey].push({
                timeStart: start,
                timeEnd: end,
                content: `${sec.dept_code || 'N/A'} ${courseName.split(' ')[0]} (${sec.section_type.substring(0, 1)})`,
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
                const [slotStart, slotEnd] = slot.split(' - ');
                const section = daySections.find((sec) => sec.timeStart === slotStart);

                if (section) {
                    const startHour = parseInt(section.timeStart.split(':')[0]);
                    const endHour = parseInt(section.timeEnd.split(':')[0]);
                    const duration = endHour - startHour;

                    cells.push(
                        <td
                            key={slot}
                            colSpan={duration}
                            className="border p-2 text-center bg-indigo-100 font-semibold text-indigo-800"
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
            <Card.Header className="bg-indigo-500 text-white text-center py-3">
                <h4 className="mb-0">
                    Schedule {scheduleNumber} - Level {level} (Courses: {sections.length})
                </h4>
            </Card.Header>
            <Card.Body className="overflow-x-auto p-4">
                {sections.length === 0 ? (
                    <div className="text-center text-gray-600 p-4 bg-gray-50 border-dashed border-2 border-gray-300 rounded-lg">
                        No sections available for this schedule yet.
                    </div>
                ) : (
                    generateTimeTable()
                )}

                <div className="text-center mt-4">
                    <Button
                        onClick={() => alert('AI will generate the schedule')}
                        className="bg-green-600 border-0"
                    >
                        <FaSyncAlt className="ml-2" /> Generate Schedule (AI)
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

// ----------------------------------------------------
// Main component: ManageSchedules
// ----------------------------------------------------
const ManageSchedules = () => {
    const [currentLevel, setCurrentLevel] = useState(3);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const levels = [3, 4, 5, 6, 7, 8];

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const allSections = await fetchData('http://localhost:5000/api/sections');
            const byLevel = allSections.filter((sec) => parseInt(sec.level) === currentLevel);
            const finalSections = byLevel.filter((sec) => sec.dept_code !== 'SE');

            const group1 = finalSections.filter((sec) => sec.student_group === 1);
            const group2 = finalSections.filter((sec) => sec.student_group === 2);

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
        fetchSchedules();
    }, [currentLevel, fetchSchedules]);

    return (
        <div
            className="min-h-screen"
            style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' }}
        >
            <Container fluid="lg" className="bg-white rounded-lg shadow-lg p-4">
                <div className="flex justify-between items-center mb-6 bg-blue-900 p-3 rounded-lg text-white">
                    <Button onClick={() => navigate('/dashboard')} className="bg-opacity-20 border-0">
                        <FaArrowRight className="ml-2" /> Back to Dashboard
                    </Button>
                    <h1 className="text-xl font-bold">Smart Schedule Management</h1>
                    <div></div>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Card className="mb-6 shadow">
                    <Card.Body>
                        <h3 className="text-xl font-bold mb-3 text-blue-800">
                            <FaFilter className="ml-2" /> Filter Levels
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {levels.map((level) => (
                                <Button
                                    key={level}
                                    className={`font-semibold ${currentLevel === level
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-indigo-600'
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
                            <FaCalendarAlt className="ml-2" /> Suggested Schedules
                        </h3>
                        <div className="bg-indigo-50 border-r-4 border-indigo-500 p-3 mb-4">
                            <span>📊 Level {currentLevel}</span>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {schedules.length > 0 ? (
                                schedules.map((schedule, index) => (
                                    <ScheduleTable
                                        key={index}
                                        scheduleNumber={schedule.id}
                                        level={currentLevel}
                                        sections={schedule.sections}
                                        loading={loading}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-gray-600 p-6 bg-gray-50 border-dashed border-2 border-gray-300 rounded-lg">
                                    {loading ? (
                                        <div>
                                            <Spinner animation="border" variant="primary" />
                                            <p>Loading...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p>No schedules currently available for this level.</p>
                                            <Button className="mt-3 bg-green-600 border-0">
                                                <FaSyncAlt className="ml-2" /> Generate New Schedules (AI)
                                            </Button>
                                        </>
                                    )}
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
