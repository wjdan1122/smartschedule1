<<<<<<< HEAD
# ملف تكوين IIS لاستضافة الواجهة الأمامية والخلفية

## إعداد IIS للواجهة الأمامية (Frontend)

1. افتح إدارة IIS (Internet Information Services Manager)
2. أنشئ موقع جديد أو استخدم الموقع الافتراضي
3. حدد المسار الفعلي لمجلد `smart` (حيث توجد ملفات HTML)
4. اختر بروتوكول HTTP وحدد المنفذ (مثل 80)
5. ابدأ الموقع

## إعداد الخادم الخلفي (Backend)

الخادم الخلفي يعمل على Node.js وExpress ويجب تشغيله بشكل منفصل:

```bash
cd server
npm install
npm run dev  # للتطوير
# أو
npm start    # للإنتاج
```

## ربط الواجهة بالخادم الخلفي

تأكد من تحديث ملفات HTML لتستخدم عنوان الخادم الصحيح:

```javascript
// بدلاً من Baserow API المباشر
const API_BASE_URL = "https://api.baserow.io/api/database/rows/table/";

// استخدم الخادم الخلفي
const API_BASE_URL = "http://localhost:3000/api/";
```

## ملاحظات مهمة

- تأكد من أن الخادم الخلفي يعمل قبل الوصول للواجهة
- في بيئة الإنتاج، استخدم HTTPS للأمان
- قم بتكوين CORS في الخادم الخلفي للسماح بالطلبات من IIS
- استخدم نفس الجهاز أو شبكة محلية للاتصال بين IIS والخادم الخلفي

## حل مشكلة CORS

إذا واجهت مشكلة CORS، قم بتحديث إعدادات IIS:

1. اذهب إلى الموقع في IIS Manager
2. انقر على "HTTP Response Headers"
3. أضف العناوين التالية:
   - Access-Control-Allow-Origin: *
   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   - Access-Control-Allow-Headers: Content-Type, Authorization
=======
# ملف تكوين IIS لاستضافة الواجهة الأمامية والخلفية

## إعداد IIS للواجهة الأمامية (Frontend)

1. افتح إدارة IIS (Internet Information Services Manager)
2. أنشئ موقع جديد أو استخدم الموقع الافتراضي
3. حدد المسار الفعلي لمجلد `smart` (حيث توجد ملفات HTML)
4. اختر بروتوكول HTTP وحدد المنفذ (مثل 80)
5. ابدأ الموقع

## إعداد الخادم الخلفي (Backend)

الخادم الخلفي يعمل على Node.js وExpress ويجب تشغيله بشكل منفصل:

```bash
cd server
npm install
npm run dev  # للتطوير
# أو
npm start    # للإنتاج
```

## ربط الواجهة بالخادم الخلفي

تأكد من تحديث ملفات HTML لتستخدم عنوان الخادم الصحيح:

```javascript
// بدلاً من Baserow API المباشر
const API_BASE_URL = "https://api.baserow.io/api/database/rows/table/";

// استخدم الخادم الخلفي
const API_BASE_URL = "http://localhost:3000/api/";
```

## ملاحظات مهمة

- تأكد من أن الخادم الخلفي يعمل قبل الوصول للواجهة
- في بيئة الإنتاج، استخدم HTTPS للأمان
- قم بتكوين CORS في الخادم الخلفي للسماح بالطلبات من IIS
- استخدم نفس الجهاز أو شبكة محلية للاتصال بين IIS والخادم الخلفي

## حل مشكلة CORS

إذا واجهت مشكلة CORS، قم بتحديث إعدادات IIS:

1. اذهب إلى الموقع في IIS Manager
2. انقر على "HTTP Response Headers"
3. أضف العناوين التالية:
   - Access-Control-Allow-Origin: *
   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   - Access-Control-Allow-Headers: Content-Type, Authorization
>>>>>>> 8519f11f1ec86f41d204ce0b44087b279ac10488
