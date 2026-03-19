# GoodHours — Required Fixes

Apply the following updates to the GoodHours app.

---

## 1. Organization Requests

- When an organization request is **approved or rejected**, remove it immediately from the **Pending Organization Requests** list.
- Change the **description field** from a single-line input to a **multi-line paragraph field** and render it as paragraph text.

---

## 2. School Dashboard Buttons

Fix the following buttons so they open pages with filtered student lists:

- **View On-Track Students**
- **View Off-Track Students**
- **Student Roster**

Requirements:
- **Student Roster** → list of all students in the school.
- **On-Track / Off-Track** → filtered lists based on hour progress.
- Keep a **student roster preview table on the dashboard**.
- On each **cohort management page**, add:
  - **View On-Track Students (Cohort Only)**
  - **View Off-Track Students (Cohort Only)**

---

## 3. Community Partners CSV Upload

Add a **CSV upload function** in the Community Partners section.

CSV columns (in this order):


organization_name
contact_name
contact_email
phone
website
address
city
state
zip
description
approved


Behavior:
- Each row creates a partner record.
- Skip rows missing required fields.
- Return an **import summary (success + errors)**.

---

## 4. Cohort Analytics

Add statistics to each **cohort management page**:

- Total students
- Students on track
- Students off track
- Mean hours completed
- Median hours completed
- Max hours
- Min hours
- Total verified hours
- % on track
- % off track
- Pending hour verifications

---

## 5. Remove Classrooms

Remove the **Classrooms feature** entirely.

Replace the **classroom list on the dashboard** with a **cohort list** showing:
- Cohort name
- Total students
- On-track students
- Off-track students
- Average hours
- Link to **Manage Cohort**