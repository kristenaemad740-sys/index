Create a complete, professional **RESPONSIVE WEB WEBSITE DESIGN** for a Christian family sports day.

IMPORTANT: Design this as a **WEB WEBSITE FIRST**, NOT as a mobile app.

The final design must be created for a real website that users access through a normal URL or QR code using their mobile browser. It must have a dedicated, professional **desktop web design**, while also being fully responsive on mobile and tablet.

Do not design only a mobile screen and then stretch it. Create intentional layouts for **Mobile, Tablet, Desktop, and Large Desktop** while keeping one consistent visual identity.

Use the provided church/family logo as the main visual identity reference.

---

# 1. BRAND & VISUAL STYLE

Create a modern sports tournament experience that feels:

* Sporty
* Youthful
* Energetic
* Premium
* Clean
* Competitive
* Fun
* Organized

Use colors inspired by the provided logo, especially:

* Deep navy / blue
* Gold
* Yellow
* Orange
* White

Use:

* Dynamic sports-inspired shapes
* Motion lines
* Subtle gradients
* Modern cards
* Rounded corners
* Clean shadows
* Subtle glow effects
* Professional sports graphics
* Tasteful micro-animations

Do not make it look like:

* Google Forms
* A traditional church website
* A generic business website
* A mobile application

The Christian identity should remain elegant and subtle through the logo and branding. Do not overload the interface with religious symbols.

Preserve the existing logo without redesigning it.

---

# 2. LANGUAGE

The entire website is Arabic.

Use full RTL layout.

All visible UI text must be Arabic.

Use modern, highly readable Arabic typography.

Examples:

"الرئيسية"

"سجّل الآن"

"الاسم"

"رقم الهاتف"

"النوع"

"ولد"

"بنت"

"تأكيد التسجيل"

"تم تسجيلك بنجاح!"

---

# 3. WEBSITE STRUCTURE

Design the complete website as a real web experience.

Create these main screens/states:

1. Home / Landing Page
2. Registration Page
3. Registration Confirmation State
4. Loading State
5. Successful Registration State
6. Existing Participant State
7. Error State
8. Registration Closed State

The website must feel like one connected experience.

---

# 4. HOME PAGE — DESKTOP FIRST

Create a professional desktop web landing page.

Do not simply enlarge the mobile design.

Desktop Hero should have a strong composition.

Suggested structure:

Right side:

* Logo
* Sports day title
* Short energetic slogan
* Registration CTA

Left side:

* Dynamic sports visual
* Abstract athletic shapes
* Motion-inspired graphics
* Team color elements

Keep the hero visually balanced.

Main CTA:

"سجّل الآن"

Add subtle sports-related visual elements without making the interface crowded.

---

# 5. RESPONSIVE BREAKPOINTS

Create intentional designs for:

### Mobile

320–767px

### Tablet

768–1023px

### Desktop

1024–1439px

### Large Desktop

1440px+

Mobile should be optimized for one-handed use.

Tablet should use the available space efficiently.

Desktop should feel like a real professional website.

Large desktop should use a centered maximum-width layout and avoid excessive empty space.

Do not simply stretch mobile elements.

---

# 6. REGISTRATION PAGE

Create a clean and modern registration page.

Title:

"سجّل في اليوم الرياضي"

Fields:

### الاسم

Text input.

### رقم الهاتف

Egyptian mobile phone input.

### النوع

Two clear options:

"ولد"

"بنت"

The participant does **NOT** choose a team.

The system automatically assigns the team after registration.

Do not show team statistics or internal balancing information.

---

# 7. FOUR TEAMS

There are exactly four teams:

🔴 الفريق الأحمر

🟢 الفريق الأخضر

🟡 الفريق الأصفر

⚫ الفريق الأسود

Create a strong visual identity for each team using its corresponding color.

Each team may have:

* Team color
* Team icon
* Team visual motif

Do NOT include team leaders anywhere.

Do NOT create leader names.

Do NOT display team member counts.

Do NOT display team capacity.

Do NOT display boys/girls statistics.

---

# 8. AUTOMATIC TEAM ASSIGNMENT

The participant does NOT select the team manually.

The system automatically assigns the team.

Use a deterministic Round-Robin algorithm separately for boys and girls.

Team order:

1. الفريق الأحمر
2. الفريق الأخضر
3. الفريق الأصفر
4. الفريق الأسود

## GIRLS

1st girl → الفريق الأحمر

2nd girl → الفريق الأخضر

3rd girl → الفريق الأصفر

4th girl → الفريق الأسود

5th girl → الفريق الأحمر

6th girl → الفريق الأخضر

7th girl → الفريق الأصفر

8th girl → الفريق الأسود

Continue repeating.

## BOYS

Use a completely independent sequence:

1st boy → الفريق الأحمر

2nd boy → الفريق الأخضر

3rd boy → الفريق الأصفر

4th boy → الفريق الأسود

5th boy → الفريق الأحمر

6th boy → الفريق الأخضر

7th boy → الفريق الأصفر

8th boy → الفريق الأسود

Continue repeating.

IMPORTANT:

The boys' counter and girls' counter are completely independent.

Do NOT use one global counter.

Do NOT use random team assignment.

Do NOT use Math.random().

The final team assignment is determined by the backend/API and saved permanently.

---

# 9. CONFIRMATION SCREEN

Before final registration, show a clean confirmation card.

Display:

"تأكيد التسجيل"

Then:

"الاسم: [الاسم]"

"النوع: [ولد/بنت]"

Do NOT show the assigned team yet.

Button:

"تأكيد التسجيل"

---

# 10. SUCCESS SCREEN

After registration succeeds, create a visually impressive success state.

Display:

"تم تسجيلك بنجاح!"

Then:

"اسمك: [الاسم]"

"فريقك: [اسم الفريق]"

The assigned team's color should become the main accent of this screen.

For example:

🔴 الفريق الأحمر

Add a subtle celebration animation.

Do not use excessive confetti.

---

# 11. WHATSAPP GROUP

After displaying the assigned team, show:

"سيتم إضافتك إلى مجموعة الواتساب الخاصة بفريقك."

Then include a WhatsApp section for the **large/general WhatsApp group for the sports day**.

Display a prominent button:

"انضم إلى مجموعة الواتساب"

Use a recognizable WhatsApp icon.

The button will later use one general WhatsApp group invite URL.

Use an editable placeholder:

WHATSAPP_GROUP_URL

Do not hardcode the actual link into the design.

The WhatsApp section should be visually secondary to the team result.

Do not automatically open WhatsApp.

The user can choose to click the button.

The same WhatsApp button should also appear when an existing participant retrieves their registration.

---

# 12. EXISTING PARTICIPANT

If the phone number is already registered, the participant must not register again.

Create an existing-registration state.

Display:

"أهلاً بك، [الاسم]"

"أنت مسجل بالفعل"

"فريقك: [اسم الفريق]"

Then:

"سيتم إضافتك إلى مجموعة الواتساب الخاصة بفريقك."

Button:

"انضم إلى مجموعة الواتساب"

Do not assign a new team.

Do not change the existing team.

---

# 13. DUPLICATE REGISTRATION

Duplicate registration is based **ONLY on the phone number**.

One phone number = one registration.

Do NOT use:

* IP address
* Device ID
* Cookies
* Browser fingerprinting

as registration restrictions.

Normalize Egyptian phone numbers before duplicate checking.

If the same number is entered again:

* Do not create another record.
* Do not assign another team.
* Retrieve the existing participant.
* Display the saved team.

Design the UI for this state clearly.

---

# 14. GOOGLE SHEETS DATA

The backend will store registrations in Google Sheets through Google Apps Script.

Data:

* ID
* الاسم
* رقم الهاتف
* النوع
* الفريق
* وقت التسجيل

Do NOT store team leader information.

Do NOT store IP.

Do NOT store Device ID.

Do NOT store browser fingerprint.

The Google Sheet must never be publicly exposed.

---

# 15. BACKEND/API

The final web application will use Google Apps Script as the API layer.

Use:

VITE_GOOGLE_SCRIPT_URL

as the API endpoint configuration.

The backend flow:

1. Receive registration.
2. Validate information.
3. Normalize phone number.
4. Check existing phone.
5. If existing, return saved registration.
6. If new, determine gender.
7. Count previous registrations for that gender.
8. Assign next team using Round-Robin.
9. Save registration.
10. Return assigned team.
11. Display success screen.

The team assignment must happen on the backend, not only in the frontend.

---

# 16. VALIDATION STATES

Design Arabic validation states.

Examples:

"من فضلك أدخل اسمك"

"من فضلك أدخل رقم الهاتف"

"رقم الهاتف غير صحيح"

"من فضلك اختر النوع"

Loading:

"جاري التحقق..."

"جاري التسجيل..."

Error:

"حدث خطأ أثناء التسجيل، حاول مرة أخرى."

"تعذر الاتصال بالخادم."

Registration closed:

"التسجيل مغلق حاليًا"

Create visual states for each.

---

# 17. NAVIGATION

Keep navigation simple.

Desktop navigation can include:

"الرئيسية"

"التسجيل"

Mobile navigation should be compact and easy to use.

Do not create unnecessary pages.

---

# 18. QR CODE EXPERIENCE

The website will be accessed primarily through a QR code.

Design the experience so that a user can:

Scan QR

→ Open website

→ Understand the event

→ Click "سجّل الآن"

→ Register

→ Automatically receive a team

→ See team result

→ See WhatsApp group option

No installation required.

---

# 19. MOBILE DESIGN

Mobile is important, but this is NOT a mobile app.

Design the mobile website as a responsive browser website.

Use:

* One-column layouts
* Large touch targets
* Comfortable inputs
* Clear hierarchy
* Fast interactions
* No horizontal scrolling

Keep the design polished at 390px width.

---

# 20. TABLET DESIGN

For tablets:

* Use wider containers.
* Use two-column layouts where appropriate.
* Give forms comfortable width.
* Maintain RTL.
* Preserve the same visual identity.

---

# 21. DESKTOP DESIGN

The desktop version must be intentionally designed.

Do not simply stretch mobile cards.

Use:

* Professional navigation
* Large hero section
* Balanced two-column sections
* Centered content
* Proper max-width
* Four-team visual system
* Comfortable registration form
* Better use of whitespace

The website should look like a real professional event website on desktop.

---

# 22. LARGE DESKTOP

For 1440px+:

Use a max-width around 1200–1400px.

Keep content centered.

Avoid oversized text and huge empty spaces.

Maintain visual balance.

---

# 23. COMPONENTS

Design reusable UI components:

* Header
* Hero
* CTA Button
* Registration Form
* Phone Input
* Gender Selector
* Confirmation Card
* Success Card
* Team Result Card
* WhatsApp Card
* Existing Participant Card
* Loading State
* Error State
* Footer

All components must work responsively.

---

# 24. ACCESSIBILITY

Use strong contrast.

Create clear:

* Default states
* Hover states
* Active states
* Selected states
* Disabled states
* Loading states
* Error states

Do not rely only on color to communicate status.

---

# 25. PERFORMANCE

Keep the design lightweight.

Avoid unnecessary visual effects.

Use optimized graphics.

Animations should be subtle and performant.

The website should load quickly on normal mobile networks.

---

# 26. NO ADMIN

There is no admin interface.

Do NOT design:

* Admin dashboard
* Admin login
* Admin panel
* Public participant list
* Public team statistics
* Public leaderboard

Organizers will access Google Sheets separately.

---

# 27. FINAL DESIGN REQUIREMENTS

The final Figma file must contain a complete **WEB DESIGN SYSTEM**, not only mobile screens.

Create:

* Mobile screens
* Tablet adaptations
* Desktop screens
* Large desktop adaptations
* Responsive components
* Hover states
* Selected states
* Loading states
* Error states
* Success states
* Existing-user states

The design must be ready to translate directly into React + TypeScript + Vite.

Most importantly:

**Design this as a real RESPONSIVE WEBSITE from the beginning.**

Do not create a mobile app UI.

Do not create only a mobile layout.

The participant must be able to open the website URL directly on a phone, tablet, laptop, or desktop and get an appropriate layout for that screen.

Preserve the existing logo and visual identity while creating a polished sports tournament website with automatic team assignment, phone-based duplicate prevention, Google Sheets integration, and a general WhatsApp group invitation.
