# KAD Designs Design System · نظام التصميم

## Design Philosophy · فلسفة التصميم

التصميم يعتمد على **البساطة المهنية** و**الوضوح البصري**، مع تركيز على:
- **الهدوء والانضباط** البصري
- **العمق الدقيق** من خلال ظلوخ محسوبة
- **التفاعل السلس** عبر حركات متناسقة
- **الدعم الكامل للثنائية اللغة** (العربية RTL والإنجليزية LTR)

---

## 🎨 Color System · نظام الألوان

### Primary Colors · الألوان الأساسية

| اللون | HEX | الاستخدام |
|-------|-----|------------|
| `--color-primary` | `#1a1a1a` | النص الأساسي، العناوين |
| `--color-primary-light` | `#393939` | حدود، تفاصيل ثانوية |
| `--color-primary-soft` | `#f5f5f4` | خلفيات بطاقات، مناطق النموذج |

### Accent Colors · ألوان التمييز

| اللون | HEX | الاستخدام |
|-------|-----|------------|
| `--color-accent` | `#d41f40` | أزرار CTA، أزرار حية |
| `--color-accent-dark` | `#9f0f2c` | تفاعل الزر عند التحويل |
| `--color-accent-soft` | `#fbecf0` | تمثيلات نجاح، تحذيرات خفيفة |
| `--color-accent-muted` | `#f4f4f2` | تمهيدات، عناوين فرعية |

### Status Colors · ألوان الحالة

| اللون | HEX | الاستخدام |
|-------|-----|------------|
| `--color-success` | `#2d6544` | إكمال، تقدم ناجح |
| `--color-success-soft` | `#eaf1ed` | خلفيات النجاح |

---

## 🔠 Typography · نظام الخطوط

### Font Families

```css
--font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-ar: 'Cairo', 'Tahoma', Arial, sans-serif;
--font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
```

### Typography Scale

| العنصر | الحجم | الارتفاع | الوزن |
|--------|-------|-----------|-------|
| h1 | 2.5rem (40px) | 1.15 | 600 |
| h2 | 1.75rem (28px) | 1.25 | 600 |
| h3 | 1.375rem (22px) | 1.3 | 600 |
| h4 | 1.125rem (18px) | 1.35 | 600 |
| p | 1rem (16px) | 1.7 | 400 |
| small | 0.875rem (14px) | 1.5 | 400 |

### Arabic Typography

تعتمد خطوط **Cairo** للعربية لضمان:
- توافق جيد مع الخطوط الإنجليزية
- دعم كامل للـ RTL
- توازن بصري ممتاز بين الحروف والكلمات

---

## 📐 Spacing & Layout · المسافات والتخطيط

### Spacing Tokens

```css
--gap-sm: 0.5rem;    /* 8px */
--gap-md: 1rem;      /* 16px */
--gap-lg: 1.5rem;    /* 24px */
--gap-xl: 2rem;      /* 32px */

--padding-sm: 0.5rem;   /* 8px */
--padding-md: 1rem;     /* 16px */
--padding-lg: 1.5rem;   /* 24px */
--padding-xl: 2rem;     /* 32px */
```

### Border Radius

```css
--radius-sm: 8px;
--radius: 12px;
--radius-full: 50%;
```

---

## 🧩 Components · مكونات الواجهة

### Cards

```css
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--padding-lg);
}
```

### Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.75rem 1.125rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.15s ease;
}

.btn-primary { background: var(--color-accent); color: white; }
.btn-outline { background: transparent; border: 1px solid var(--line); }
.btn-success { background: var(--color-success); color: white; }
```

### Progress Indicators

```css
.progress-track {
  height: 4px;
  background: #e9e9e6;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-track > span {
  background: var(--color-accent);
  height: 100%;
  transition: width 0.3s ease;
}
```

---

## ✨ Visual Hierarchy · هيكلية الرؤية البصرية

### Depth & Shadow System

| Level | Shadow | Use Case |
|-------|--------|----------|
| 1 | `0 2px 8px rgba(20,20,25,.05)` | Tooltips, dropdowns |
| 2 | `0 6px 24px rgba(20,20,25,.08)` | Cards, modals |
| 3 | `0 12px 48px rgba(20,20,25,.12)` |Hero sections |

---

## 📱 Responsive Design · التصميم المتجاوب

### Breakpoints

| شاشة | الحجم | الاعتبار |
|-------|-------|----------|
| Mobile | < 640px | هاتف |
| Tablet | 640px - 1024px | تابلت |
| Desktop | 1024px - 1440px | سطح مكتب |
| Large | > 1440px | شاشات كبيرة |

---

## ♿ Accessibility · الإتاحة

- **تباين الألوان**: جميع التباينات ≥ 4.5:1
- **حجم الخط الأدنى**: 14px (16px افتراضي)
- **وصف التصفح**: دعم كامل للـ Keyboard navigation
- **اللغات**: دعم كامل للـ RTL والـ LTR

---

## 🧭 Navigation · التنقل

### Sidebar Structure

```
مراحة التعلم:
├── الرئيسية
├── مسار القيادة
├── مكتبة التعلّم
├── مختبر التطبيق
└── أدوات القيادة

تطوري الشخصي:
├── الاختبار الذاتي
├── تقدمي
├── ملاحظاتي
├── الدروس المحفوظة
├── تحدي الأثر
└── الإنجازات
```

---

## 📘 Documentation · الوثائق

- [ARCHITECTURE.md](./ARCHITECTURE.md) - بنية التقنية
- [SOURCE_REGISTER.md](./SOURCE_REGISTER.md) - قاعدة بيانات المصادر
- [CONTENT_OPERATIONS.md](./CONTENT_OPERATIONS.md) - عمليات المحتوى
- [DEPLOYMENT.md](./DEPLOYMENT.md) - عمليات النشر
- [QA_REPORT.md](./QA_REPORT.md) - تقرير اختبار الجودة

---

## النسخة 1.0.0 · الإصدار 1.0.0
**تاريخ الإصدار:** 16 سبتمبر 2026  
**مطور:** فريق KAD Designs