import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Row, Col, Button, Alert, Spinner, Form, ListGroup } from 'react-bootstrap';
import { FaArrowRight, FaPlusCircle, FaListAlt, FaTrash, FaBalanceScale } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import '../App.css';

// دالة لجلب البيانات من الخادم (نفس الدالة في ManageSchedules)
const fetchData = async (url, method = 'GET', body = null) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: body ? JSON.stringify(body) : null,
    });

    // منطق حماية المصادقة (يرجع 401 إذا فشل)
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

    // 1. جلب القواعد من الخادم
    const fetchRules = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            // المسار: app.get('/api/rules')
            const rulesData = await fetchData('http://localhost:5000/api/rules');
            setRules(rulesData);
        } catch (err) {
            console.error("Error fetching rules:", err);
            if (err.message === "AUTHENTICATION_FAILED") {
                navigate('/login');
                return;
            }
            setPageError("فشل تحميل القواعد. تأكد من تشغيل الخادم.");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    // 2. دالة إضافة قاعدة جديدة
    const handleAddRule = async (e) => {
        e.preventDefault();
        if (!newRuleText.trim()) return;

        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData('http://localhost:5000/api/rules', 'POST', { text: newRuleText });
            setMessage(`تمت إضافة القاعدة بنجاح: ${newRuleText}`);
            setNewRuleText('');
            fetchRules(); // تحديث القائمة
        } catch (err) {
            setPageError(err.message || 'فشل إضافة القاعدة.');
        } finally {
            setLoading(false);
        }
    };

    // 3. دالة حذف قاعدة
    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("هل أنت متأكد من حذف هذه القاعدة؟ سيؤثر هذا على جدولة الذكاء الاصطناعي.")) return;

        setLoading(true);
        setPageError(null);
        setMessage(null);
        try {
            await fetchData(`http://localhost:5000/api/rules/${ruleId}`, 'DELETE');
            setMessage("تم حذف القاعدة بنجاح.");
            fetchRules(); // تحديث القائمة
        } catch (err) {
            setPageError(err.message || 'فشل حذف القاعدة.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Container fluid="lg" className="bg-white p-4 rounded-lg shadow-lg">
                <div className="navbar bg-blue-900 mb-6 rounded-t-lg p-3 flex justify-between items-center">
                    <Button onClick={() => navigate('/dashboard')} className="back-button text-white flex items-center p-2 rounded-lg bg-opacity-20 hover:bg-opacity-30 border-0">
                        <FaArrowRight className="ml-2" /> العودة للرئيسية
                    </Button>
                    <h1 className="text-white text-2xl font-bold mb-0">إدارة القواعد والقيود</h1>
                    <div></div>
                </div>

                <h1 className="text-3xl text-center text-blue-900 font-extrabold mb-4">⚖️ قيود الجدولة الذكية (لـ Gemini)</h1>

                {message && <Alert variant="success" className="mt-3 text-center">{message}</Alert>}
                {pageError && <Alert variant="danger" className="mt-3 text-center">{pageError}</Alert>}

                {/* قسم إضافة قاعدة جديدة */}
                <Card className="shadow-lg mb-6 border-blue-400 border-2">
                    <Card.Header className="bg-blue-500 text-white py-3">
                        <h4 className="mb-0 flex items-center text-xl font-bold"><FaPlusCircle className="ml-2" /> إضافة قاعدة جديدة</h4>
                    </Card.Header>
                    <Card.Body>
                        <Form onSubmit={handleAddRule}>
                            <Row className="align-items-end">
                                <Col md={9}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>نص القاعدة (مثال: يجب أن تكون المحاضرات الأساسية قبل 12:00 ظهرًا)</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={newRuleText}
                                            onChange={(e) => setNewRuleText(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Button variant="success" type="submit" className="w-100" disabled={loading}>
                                        {loading ? <Spinner size="sm" animation="border" className="ml-2" /> : <FaPlusCircle className="ml-2" />} إضافة وحفظ
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card.Body>
                </Card>

                {/* قسم عرض القواعد الحالية */}
                <Card className="shadow-lg">
                    <Card.Header className="bg-gray-100 py-3">
                        <h4 className="mb-0 flex items-center text-blue-800 text-xl font-bold"><FaListAlt className="ml-2" /> القواعد النشطة ({rules.length})</h4>
                    </Card.Header>
                    <Card.Body>
                        {loading ? (
                            <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
                        ) : rules.length === 0 ? (
                            <Alert variant="info" className="text-center">لا توجد قواعد مدخلة حالياً لتوجيه الذكاء الاصطناعي.</Alert>
                        ) : (
                            <ListGroup as="ol" numbered className="text-right">
                                {rules.map(rule => (
                                    <ListGroup.Item key={rule.rule_id} className="d-flex justify-content-between align-items-center">
                                        <div className="ms-2 me-auto">
                                            <div className="font-semibold">{rule.text}</div>
                                        </div>
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteRule(rule.rule_id)} disabled={loading}>
                                            <FaTrash /> حذف
                                        </Button>
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

export default ManageRules;
