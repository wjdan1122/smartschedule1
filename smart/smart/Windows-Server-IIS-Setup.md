<<<<<<< HEAD
# دليل إعداد Windows Server IIS لنظام SMART Schedule

## متطلبات النظام

- Windows Server 2016 أو أحدث (أو Windows 10/11 مع IIS)
- IIS مثبت ومفعل
- Node.js مثبت على الخادم

## خطوات التثبيت والإعداد

### الخطوة 1: تثبيت IIS

1. افتح Server Manager
2. اختر "Add roles and features"
3. اختر "Web Server (IIS)" من الأدوار المتاحة
4. أكمل معالج التثبيت

### الخطوة 2: تثبيت Node.js على Windows Server

1. حمل أحدث إصدار من Node.js من الموقع الرسمي
2. شغل ملف التثبيت كمسؤول
3. أكمل التثبيت بالإعدادات الافتراضية

### الخطوة 3: إعداد الموقع في IIS

1. افتح Internet Information Services (IIS) Manager
2. في اللوحة اليسرى، انقر بزر الماوس الأيمن على "Sites"
3. اختر "Add Website"
4. أدخل المعلومات التالية:
   - **Site name**: SMART Schedule
   - **Application pool**: DefaultAppPool (أو أنشئ جديد)
   - **Physical path**: `C:\inetpub\wwwroot\smart` (انسخ ملفات المشروع هنا)
   - **Binding**: HTTP, Port 80, IP address: All Unassigned
   - **Host name**: (اتركه فارغاً للاختبار المحلي)

### الخطوة 4: نسخ ملفات المشروع

انسخ محتويات مجلد `smart` إلى `C:\inetpub\wwwroot\smart`

### الخطوة 5: إعداد الخادم الخلفي

1. أنشئ مجلد للخادم الخلفي:
   ```bash
   mkdir C:\inetpub\wwwroot\smart\server
   ```

2. انسخ محتويات مجلد `server` إلى `C:\inetpub\wwwroot\smart\server`

3. تثبيت التبعيات:
   ```bash
   cd C:\inetpub\wwwroot\smart\server
   npm install
   ```

4. إعداد متغيرات البيئة في ملف `.env`:
   ```
   BASEROW_TOKEN=your-actual-baserow-token-here
   JWT_SECRET=your-secure-jwt-secret-here
   ```

5. تشغيل الخادم الخلفي:
   ```bash
   npm start
   ```

### الخطوة 6: إعداد Windows Service للخادم الخلفي (اختياري)

لضمان استمرار عمل الخادم الخلفي، قم بإنشاء Windows Service:

1. قم بتثبيت NSSM (Non-Sucking Service Manager):
   ```
   # حمل NSSM من https://nssm.cc/
   nssm install SmartScheduleBackend "C:\Program Files\nodejs\node.exe" "C:\inetpub\wwwroot\smart\server\server.js"
   ```

2. قم بتكوين الخدمة:
   - Start: Automatic
   - Log on as: Local System

### الخطوة 7: إعدادات الأمان (اختياري)

1. **تفعيل HTTPS**:
   - احصل على شهادة SSL
   - في IIS، اذهب إلى الموقع وانقر "Bindings"
   - أضف binding جديد مع HTTPS وport 443

2. **إعدادات Firewall**:
   - افتح Windows Firewall with Advanced Security
   - أضف قاعدة جديدة لـ Inbound للمنفذ 80 (و443 إذا كان HTTPS)

### الخطوة 8: الاختبار

1. افتح متصفح واذهب إلى `http://localhost`
2. تأكد من ظهور صفحة SMART Schedule
3. اختبر الوظائف المختلفة

## استكشاف الأخطاء الشائعة

### مشكلة: الصفحة لا تفتح
- تأكد من أن IIS يعمل
- فحص Windows Event Viewer للأخطاء
- تأكد من صحة المسار الفعلي في IIS

### مشكلة: الخادم الخلفي لا يعمل
- فحص Console/Terminal للأخطاء
- تأكد من تثبيت التبعيات بـ `npm install`
- فحص متغيرات البيئة في `.env`

### مشكلة: خطأ في الاتصال بقاعدة البيانات
- تأكد من صحة Baserow Token
- فحص الاتصال بالإنترنت
- تأكد من إعداد جداول Baserow بالشكل الصحيح

### مشكلة: أخطاء في الواجهة الأمامية
- افتح Developer Tools في المتصفح
- فحص Console للأخطاء JavaScript
- فحص Network tab للطلبات الفاشلة

## الصيانة والمراقبة

### مراقبة الأداء
- استخدم IIS logs لمراقبة الطلبات
- استخدم Windows Performance Monitor لمراقبة استخدام الموارد
- مراقبة سجلات الخادم الخلفي

### النسخ الاحتياطي
- قم بعمل نسخ احتياطية دورية لقاعدة البيانات
- احتفظ بنسخة من ملف `.env` في مكان آمن
- وثق أي تغييرات في التكوين

## ملاحظات مهمة

- **الأمان**: غير كلمات المرور الافتراضية واستخدم كلمات مرور قوية
- **الأداء**: راقب استخدام الموارد خاصة إذا كان هناك العديد من المستخدمين
- **التحديثات**: راقب تحديثات Node.js وNPM وحدثها دورياً
- **الدعم**: احتفظ بنسخة من هذا الدليل للمراجعة المستقبلية

## الدعم الفني

إذا واجهت أي مشاكل:
1. فحص السجلات في Windows Event Viewer
2. فحص Console في الخادم الخلفي
3. فحص Network logs في IIS
4. الرجوع لهذا الدليل للتأكد من اتباع جميع الخطوات بشكل صحيح
=======
# دليل إعداد Windows Server IIS لنظام SMART Schedule

## متطلبات النظام

- Windows Server 2016 أو أحدث (أو Windows 10/11 مع IIS)
- IIS مثبت ومفعل
- Node.js مثبت على الخادم

## خطوات التثبيت والإعداد

### الخطوة 1: تثبيت IIS

1. افتح Server Manager
2. اختر "Add roles and features"
3. اختر "Web Server (IIS)" من الأدوار المتاحة
4. أكمل معالج التثبيت

### الخطوة 2: تثبيت Node.js على Windows Server

1. حمل أحدث إصدار من Node.js من الموقع الرسمي
2. شغل ملف التثبيت كمسؤول
3. أكمل التثبيت بالإعدادات الافتراضية

### الخطوة 3: إعداد الموقع في IIS

1. افتح Internet Information Services (IIS) Manager
2. في اللوحة اليسرى، انقر بزر الماوس الأيمن على "Sites"
3. اختر "Add Website"
4. أدخل المعلومات التالية:
   - **Site name**: SMART Schedule
   - **Application pool**: DefaultAppPool (أو أنشئ جديد)
   - **Physical path**: `C:\inetpub\wwwroot\smart` (انسخ ملفات المشروع هنا)
   - **Binding**: HTTP, Port 80, IP address: All Unassigned
   - **Host name**: (اتركه فارغاً للاختبار المحلي)

### الخطوة 4: نسخ ملفات المشروع

انسخ محتويات مجلد `smart` إلى `C:\inetpub\wwwroot\smart`

### الخطوة 5: إعداد الخادم الخلفي

1. أنشئ مجلد للخادم الخلفي:
   ```bash
   mkdir C:\inetpub\wwwroot\smart\server
   ```

2. انسخ محتويات مجلد `server` إلى `C:\inetpub\wwwroot\smart\server`

3. تثبيت التبعيات:
   ```bash
   cd C:\inetpub\wwwroot\smart\server
   npm install
   ```

4. إعداد متغيرات البيئة في ملف `.env`:
   ```
   BASEROW_TOKEN=your-actual-baserow-token-here
   JWT_SECRET=your-secure-jwt-secret-here
   ```

5. تشغيل الخادم الخلفي:
   ```bash
   npm start
   ```

### الخطوة 6: إعداد Windows Service للخادم الخلفي (اختياري)

لضمان استمرار عمل الخادم الخلفي، قم بإنشاء Windows Service:

1. قم بتثبيت NSSM (Non-Sucking Service Manager):
   ```
   # حمل NSSM من https://nssm.cc/
   nssm install SmartScheduleBackend "C:\Program Files\nodejs\node.exe" "C:\inetpub\wwwroot\smart\server\server.js"
   ```

2. قم بتكوين الخدمة:
   - Start: Automatic
   - Log on as: Local System

### الخطوة 7: إعدادات الأمان (اختياري)

1. **تفعيل HTTPS**:
   - احصل على شهادة SSL
   - في IIS، اذهب إلى الموقع وانقر "Bindings"
   - أضف binding جديد مع HTTPS وport 443

2. **إعدادات Firewall**:
   - افتح Windows Firewall with Advanced Security
   - أضف قاعدة جديدة لـ Inbound للمنفذ 80 (و443 إذا كان HTTPS)

### الخطوة 8: الاختبار

1. افتح متصفح واذهب إلى `http://localhost`
2. تأكد من ظهور صفحة SMART Schedule
3. اختبر الوظائف المختلفة

## استكشاف الأخطاء الشائعة

### مشكلة: الصفحة لا تفتح
- تأكد من أن IIS يعمل
- فحص Windows Event Viewer للأخطاء
- تأكد من صحة المسار الفعلي في IIS

### مشكلة: الخادم الخلفي لا يعمل
- فحص Console/Terminal للأخطاء
- تأكد من تثبيت التبعيات بـ `npm install`
- فحص متغيرات البيئة في `.env`

### مشكلة: خطأ في الاتصال بقاعدة البيانات
- تأكد من صحة Baserow Token
- فحص الاتصال بالإنترنت
- تأكد من إعداد جداول Baserow بالشكل الصحيح

### مشكلة: أخطاء في الواجهة الأمامية
- افتح Developer Tools في المتصفح
- فحص Console للأخطاء JavaScript
- فحص Network tab للطلبات الفاشلة

## الصيانة والمراقبة

### مراقبة الأداء
- استخدم IIS logs لمراقبة الطلبات
- استخدم Windows Performance Monitor لمراقبة استخدام الموارد
- مراقبة سجلات الخادم الخلفي

### النسخ الاحتياطي
- قم بعمل نسخ احتياطية دورية لقاعدة البيانات
- احتفظ بنسخة من ملف `.env` في مكان آمن
- وثق أي تغييرات في التكوين

## ملاحظات مهمة

- **الأمان**: غير كلمات المرور الافتراضية واستخدم كلمات مرور قوية
- **الأداء**: راقب استخدام الموارد خاصة إذا كان هناك العديد من المستخدمين
- **التحديثات**: راقب تحديثات Node.js وNPM وحدثها دورياً
- **الدعم**: احتفظ بنسخة من هذا الدليل للمراجعة المستقبلية

## الدعم الفني

إذا واجهت أي مشاكل:
1. فحص السجلات في Windows Event Viewer
2. فحص Console في الخادم الخلفي
3. فحص Network logs في IIS
4. الرجوع لهذا الدليل للتأكد من اتباع جميع الخطوات بشكل صحيح
>>>>>>> 8519f11f1ec86f41d204ce0b44087b279ac10488
