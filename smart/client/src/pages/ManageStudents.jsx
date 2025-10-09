import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { FaArrowRight, FaUserGraduate, FaSave, FaUndo, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { studentAPI } from '../services/api'; // ✅ استيراد دوال إدارة الطلاب

// ------------------------------------------------------------------
// المكون الرئيسي
// ------------------------------------------------------------------
const ManageStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        studentId: '', // الرقم الجامعي
        studentName: '',
        currentLevel: ''
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const levels = [3, 4, 5, 6, 7, 8];

    const showMessage = (text, type) => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // ------------------------------------------------------------------
    // جلب الطلاب من الـ API (GET)
    // ------------------------------------------------------------------
    const fetchAllStudents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await studentAPI.getAll();
            setStudents(response.data || []);
        } catch (err) {
            console.error('Error fetching students:', err.response || err);

            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                setError('فشل المصادقة. يرجى تسجيل الدخول مجدداً بصلاحيات إدارية.');
                showMessage('فشل المصادقة. قد تحتاج لإعادة تسجيل الدخول.', 'danger');
            } else {
                setError('فشل تحميل بيانات الطلاب. يرجى التأكد من تشغيل الخادم.');
                showMessage(`خطأ: ${err.message}`, 'danger');
            }
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStudents();
        document.body.style.direction = 'rtl';
        return () => {
            document.body.style.direction = 'ltr';
        };
    }, [fetchAllStudents]);

    // ------------------------------------------------------------------
    // إضافة طالب جديد (POST)
    // ------------------------------------------------------------------
    const handleSubmit = async (e) => {
        e.preventDefault();

        const { studentId, studentName, currentLevel } = formData;

        if (!studentId || !studentName || !currentLevel) {
            showMessage('يرجى تعبئة جميع الحقول', 'danger');
            return;
        }

        try {
            const newStudentData = {
                studentId: studentId,
                studentName: studentName,
                level: parseInt(currentLevel),
                email: `${studentId}@student.ksu.edu.sa`,
                password: 'ksu_default_pwd',
                // ✅ التعديل المطلوب: تعيين القيمة الافتراضية إلى TRUE
                is_ir: true,
            };

            const response = await studentAPI.create(newStudentData);

            fetchAllStudents();

            setFormData({
                studentId: '',
                studentName: '',
                currentLevel: ''
            });

            showMessage(`تم إضافة الطالب ${studentName} بنجاح!`, 'success');

        } catch (err) {
            console.error('Submit error:', err.response || err);
            const errMsg = err.response?.data?.error || err.message || 'فشل إضافة الطالب.';
            showMessage(errMsg, 'danger');
        }
    };

    // ------------------------------------------------------------------
    // حذف طالب (DELETE)
    // ------------------------------------------------------------------
    const deleteStudent = async (studentId) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الطالب؟')) {
            try {
                await studentAPI.delete(studentId);
                fetchAllStudents();
                showMessage('تم حذف الطالب بنجاح', 'info');
            } catch (err) {
                console.error('Delete error:', err);
                const errMsg = err.response?.data?.error || err.message || 'فشل حذف الطالب.';
                showMessage(errMsg, 'danger');
            }
        }
    };

    // ------------------------------------------------------------------
    // حفظ التغييرات (PUT)
    // ------------------------------------------------------------------
    const saveStudentChanges = async (studentId, newLevel) => {
        const studentToUpdate = students.find(s => s.student_id === studentId);
        if (!studentToUpdate) return;

        try {
            const updateData = { level: parseInt(newLevel) };
            await studentAPI.update(studentId, updateData);
            fetchAllStudents();
            showMessage(`تم حفظ تغييرات الطالب ${studentToUpdate.name} بنجاح!`, 'success');
        } catch (err) {
            console.error('Save changes error:', err);
            const errMsg = err.response?.data?.error || err.message || 'فشل حفظ التغييرات.';
            showMessage(errMsg, 'danger');
        }
    };

    const resetStudent = (studentId) => {
        showMessage('تم إعادة تعيين بيانات الطالب (وهمي)', 'info');
    };

    return (
        <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Container fluid="lg" className="py-4">
                <Card className="shadow-lg border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                    <Card.Header className="text-white text-center py-4" style={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}>
                        <Button
                            onClick={() => navigate('/dashboard')}
                            className="mb-3 bg-white bg-opacity-20 border-2 border-white border-opacity-30"
                            style={{ borderRadius: '8px' }}
                        >
                            <FaArrowRight className="me-2" /> العودة للرئيسية
                        </Button>
                        <h1 className="mb-2" style={{ fontSize: '2rem' }}>إدارة الطلاب بالمستويات</h1>
                        <p className="mb-0" style={{ opacity: 0.9, fontSize: '1.1rem' }}>
                            أدخل بيانات الطالب وحدد المستوى الحالي
                        </p>
                    </Card.Header>

                    <Card.Body className="p-4">
                        <Card className="mb-4 shadow-sm" style={{ borderRadius: '12px' }}>
                            <Card.Body className="p-4">
                                <h3 className="mb-4 d-flex align-items-center">
                                    <FaUserGraduate className="me-2 text-primary" style={{ fontSize: '1.5rem' }} />
                                    إضافة طالب جديد
                                </h3>

                                {(error || message.text) && (
                                    <Alert variant={error ? 'danger' : message.type} className="text-center fw-bold">
                                        {error || message.text}
                                    </Alert>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold">الرقم الجامعي</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="studentId"
                                                    placeholder="441000123"
                                                    value={formData.studentId}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold">اسم الطالب</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="studentName"
                                                    placeholder="أدخل اسم الطالب الكامل"
                                                    value={formData.studentName}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="fw-bold">المستوى الحالي</Form.Label>
                                                <Form.Select
                                                    name="currentLevel"
                                                    value={formData.currentLevel}
                                                    onChange={handleInputChange}
                                                    required
                                                >
                                                    <option value="" disabled>اختر المستوى الحالي</option>
                                                    {levels.map(level => (
                                                        <option key={level} value={level}>المستوى {level}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Button
                                        type="submit"
                                        className="w-100 fw-bold"
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            border: 'none',
                                            padding: '1rem 2rem',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }}
                                        disabled={loading}
                                    >
                                        إضافة الطالب وتحديد المستوى
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>

                        {/* قسم عرض الطلاب المضافين */}
                        {loading ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                                <p className="mt-2">جاري تحميل قائمة الطلاب...</p>
                            </div>
                        ) : students.length > 0 ? (
                            <Card className="shadow-sm" style={{ borderRadius: '12px' }}>
                                <Card.Body className="p-4">
                                    <h3 className="mb-4 d-flex align-items-center">
                                        <span className="me-2">📋</span>
                                        الطلاب المضافين
                                    </h3>

                                    <Row xs={1} md={2} className="g-4">
                                        {students.map(student => (
                                            <Col key={student.student_id}>
                                                <Card
                                                    className="h-100 shadow-sm border-2"
                                                    style={{ borderRadius: '12px', transition: 'all 0.3s ease', minHeight: '250px' }}
                                                >
                                                    <Card.Body className="p-4">
                                                        <div className="mb-3 pb-3 border-bottom">
                                                            <div className="mb-2">
                                                                <Badge bg="primary" className="fs-6">
                                                                    الرقم الجامعي: {student.student_id}
                                                                </Badge>
                                                                {/* عرض حالة IR_ST */}
                                                                {student.is_ir && (
                                                                    <Badge bg="info" className="fs-6 me-2">
                                                                        IR_ST
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="fs-5 fw-bold text-dark">
                                                                الاسم: {student.name}
                                                            </div>
                                                        </div>

                                                        <div
                                                            className="mb-3 p-3 rounded"
                                                            style={{
                                                                background: 'rgba(102, 126, 234, 0.05)',
                                                                borderRight: '4px solid #667eea'
                                                            }}
                                                        >
                                                            <div className="d-flex justify-content-between mb-2">
                                                                <span className="fw-bold text-secondary">المستوى الحالي:</span>
                                                                <span className="fw-bold text-dark">المستوى {student.level}</span>
                                                            </div>
                                                        </div>

                                                        <div className="d-flex gap-2 pt-3 border-top">
                                                            <Button
                                                                variant="success"
                                                                size="sm"
                                                                className="flex-fill fw-bold"
                                                                onClick={() => saveStudentChanges(student.student_id, student.level)}
                                                                style={{ borderRadius: '8px' }}
                                                            >
                                                                <FaSave className="me-1" /> حفظ
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                className="flex-fill fw-bold"
                                                                onClick={() => resetStudent(student.student_id)}
                                                                style={{ borderRadius: '8px' }}
                                                            >
                                                                <FaUndo className="me-1" /> إعادة
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                className="flex-fill fw-bold"
                                                                onClick={() => deleteStudent(student.student_id)}
                                                                style={{ borderRadius: '8px' }}
                                                            >
                                                                <FaTrash className="me-1" /> حذف
                                                            </Button>
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                </Card.Body>
                            </Card>
                        ) : (
                            <div className="text-center text-gray-600 p-6 bg-gray-50 border-dashed border-2 border-gray-300 rounded-lg">
                                <p>لا يوجد طلاب حالياً في القائمة.</p>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
};

export default ManageStudents;