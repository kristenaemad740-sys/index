# 🏆 موقع اليوم الرياضي — أسرة الكاروز

موقع رسمي لإدارة وتسجيل المشاركين في اليوم الرياضي لأسرة الكاروز بكنيسة العذراء مريم بالبداري.
يتميز الموقع بتصميم عصري ومتجاوب بالكامل، مع نظام توزيع تلقائي ذكي على 4 فرق مع مراعاة أولوية الأصدقاء وتوزيع التوازن بالتبادل (Round-Robin).

---

## 🚀 التقنيات المستخدمة (Tech Stack)

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4
- **Backend Database:** Google Sheets + Google Apps Script Web App API
- **Fonts:** Cairo (Google Fonts - RTL support)

---

## 📁 هيكل المشروع (Project Structure)

```text
├── Code.gs                   # Google Apps Script Backend API
├── participants.xlsx          # Excel Template لقاعدة بيانات Google Sheets
├── index.html                # Vite Entry HTML (RTL & Cairo Font)
├── package.json              # المشروع والمكتبات
├── vite.config.ts            # إعدادات Vite
├── .env.example              # نموذج متغيرات البيئة (بدون بيانات حساسة)
├── .gitignore                # استبعاد الملفات المؤقتة والـ .env
└── src/
    ├── assets/               # الصور والشعارات (logo.jpg)
    ├── components/           # عناصر الواجهة (Header, Footer)
    ├── pages/                # الصفحات (Home, Register)
    ├── services/             # خدمات الربط (api.ts)
    ├── types/                # الأنواع والتعريفات (index.ts)
    ├── App.tsx               # المكون الرئيسي للتطبيق
    ├── main.tsx              # نقطة البداية
    └── index.css             # التصميم العام والـ Animations
```

---

## 🔧 التثبيت والتشغيل المحلي (Installation & Development)

1. **تثبيت المكتبات:**
   ```bash
   npm install
   ```

2. **تشغيل خادم التطوير:**
   ```bash
   npm run dev
   ```

3. **بناء النسخة الإنتاجية (Production Build):**
   ```bash
   npm run build
   ```

---

## 🔑 متغيرات البيئة (Environment Variables)

قم بإنشاء ملف `.env` في المجلد الرئيسي مبنيًا على `.env.example`:

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

---

## 📊 إعداد Google Sheets + Google Apps Script

### 1. إعداد جدول البيانات (Google Sheet)
1. قم بإنشاء Google Sheet جديد أو رفع ملف `participants.xlsx`.
2. تأكد من أن اسم الـ Tab هو: `Participants`.
3. الترويسة (Headers) في الصف الأول يجب أن تكون كالتالي:
   `id` | `name` | `phone` | `gender` | `wantsFriends` | `friendsCount` | `friendNames` | `team` | `registrationTime`

### 2. إعداد الـ Backend (Code.gs)
1. من داخل Google Sheet، اختر **Extensions (الإضافات) ➔ Apps Script**.
2. انسخ محتوى ملف [`Code.gs`](./Code.gs) وضعه في محرر Apps Script.
3. اضغط **Deploy (نشر) ➔ New deployment (نشر جديد)**.
4. اختر **Web App** وضبط الصلاحيات:
   - **Execute as:** Me (حسابك)
   - **Who has access:** Anyone (أي شخص)
5. اضغط **Deploy** وانسخ رابط الـ Web App وضعه في متغير `VITE_GOOGLE_SCRIPT_URL`.

---

## 🛡️ الأمان والخصوصية (Security & Privacy)

- لا يتم تضمين أي مفاتيح أو بيانات حساسة داخل ملفات الكود المرفوعة على GitHub.
- ملف `.env` مستبعد تمامًا من نظام التتبع عبر `.gitignore`.
- الملف المرفوق `.env.example` يحتوي فقط على المسميات بدون قيم حقيقية.
