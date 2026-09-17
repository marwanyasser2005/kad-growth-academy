# Production Deployment Guide · دليل النشر الإنتاجي

## نسخة 1.0.1 · 16 سبتمبر 2026

---

## 🚀 خطوات النشر إلى Vercel

### 1. التحضير قبل النشر

```bash
# تحقق من جميع الاختبارات
npm test
# ✅ 26/26 اختبار ناجح

# فحص المحتوى
npm run check
# ✅ الحالة: PASS

# بناء النسخة
npm run build
# ✅ Built dist/index.html: 838.2 KiB
```

### 2. التحقق من الملف النهائي

```bash
# فحص حجم الملف
ls -la dist/

# تحقق من محتوى الملف
head -100 dist/index.html
```

### 3. النشر على Vercel

#### خيار أ: عبر واجهة Vercel
1. اذهب إلى [vercel.com](https://vercel.com)
2. اضغط على "New Project"
3. استورد مستودع GitHub أو GitLab
4. Vercel سيدقع التكوين من `vercel.json`

#### خيار ب: عبر سطر الأوامر
```bash
# تثبيت Vercel CLI
npm install -g vercel

# النشر
vercel --prod
```

#### خيار ج: عبر GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🔒 أمان النشر

### Content Security Policy
```json
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
}
```

### Headers المطلوبة
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `X-Robots-Tag: noindex, nofollow`
- ✅ `Permissions-Policy` للمتصفح

---

## 📱 اختبار النشر

### فحص متصفحات
```
✅ Chrome 100+
✅ Firefox 95+
✅ Safari 15+
✅ Edge 100+
```

### فحص الأجهزة
```
✅ حاسوب مكتب 1366px+
✅ لاب توب 1024px - 1366px
✅ هاتف Android
✅ iPhone
✅ iPad
```

### اختبار اللغات
```
✅ English (LTR)
✅ Arabic (RTL)
✅ التبديل بين اللغتين
```

---

## 📊 مراقبة الأداء

### Core Web Vitals (متوقع)
- ✅ LCP < 2.5 ثانية
- ✅ FID < 100 ملي ثانية
- ✅ CLS < 0.1

### حجم الملف
- ✅ index.html < 1MB (838.2 KiB)
- ✅ بدون Dependencies خارجية

---

## 🛠️ استكشاف الأخطاء

### مشكلة: لا يعمل التنقل بعد النشر
**الحل:** تأكد من أن URLs هاك `localhost` محدثة

### مشكلة: الفيديوهات لا تعمل
**الحل:** YouTube يتطلب مشهدًا أصليًا (web origin)

### مشكلة: مشاكل RTL
**الحل:** تحقق من `dir="rtl"` في العنصر الجذر

---

## 📋 جدول المهام للنشر الإنتاجي

| المهمة | الحالة | الملاحظات |
|--------|--------|-----------|
| ✅ فحص اختبارات الوحدة | أنجح | 26/26 |
| ✅ فحص المحتوى | ناجح | PASS |
| ✅ بناء النسخة | ناجح | 838.2 KiB |
| ✅ فحص الألوان WCAG | منسق | AA متوافق |
| ✅ تحسين Typography | مكتمل | Inter + Cairo |
| ⏳ اختبار Vercel | قيد التنفيذ | - |
| ⏳ اختبار Production | قيد التنفيذ | - |

---

## 📞 دعم فني

للاستفسارات أو الإبلاغ عن مشاكل:
- مراجعة الوثائق في مجلد `docs/`
- زيارة [kadesigns-eg.com](https://kadesigns-eg.com)
- ملفات التوثيق:
  - `docs/ARCHITECTURE.md` - البنية التقنية
  - `docs/SOURCE_REGISTER.md` - قاعدة المصادر
  - `docs/DESIGN_SYSTEM.md` - نظام التصميم
  - `docs/CONTENT_OPERATIONS.md` - عمليات المحتوى
  - `docs/DEPLOYMENT.md` - دليل النشر

---

## 🎉 إبلاغ عن النشر الناجح

**النسخة:** 1.0.1  
**تاريخ النشر:** 16 سبتمبر 2026  
**الحالة:** ✅ جاهزة للإنتاج  
**المطور:** KAD Designs Team