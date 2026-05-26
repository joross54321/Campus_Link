<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

CampusLink: Comprehensive User Manual & Simulation Guide

Welcome to the CampusLink academic portal. This manual serves as both a user guide and a simulation reference for administrative, faculty, and student workflows.



1. Official Demo Credentials

Use these specific accounts to verify system logic. Note: Ensure you have run the Foundation Seed in your Admin Dashboard to ensure these accounts are initialized in your Firestore database.

ID                Password      Role
---------------------------------------------
2026-0001-A       Admin1        Registrar
2026-1001-A       Sator1        Professor
2026-1002-A       Reyes1        Professor
2026-1003-A       Turing        Professor
2026-1004-A       Curie1        Professor
2023-4364-A       Simon1        Student
2026-2004-A       Tan111        Student
2026-3001-A       Reyes1        Student
2026-2005-A       Villanueva    Student
2026-2006-A       Cruz11        Student
2026-2001-A       Devera        Student
2026-2002-A       Santos        Student
2026-4001-A       Gomez1        Student
2026-2003-A       Lopez1        Student

---

2. Dashboard Guides

A. Student Dashboard
- Status Indicators: Displays ENROLLED or NOT ENROLLED. This status is the primary trigger for the Enrollment Wizard logic.
- Study Load Wizard:
  - Empty State: Shown when NOT ENROLLED.
  - Course Catalog: Subjects are filtered by yearLevel and program. Locked icons indicate missing prerequisites or duplicate enrollment.
- Academic History: Aggregates all Posted grades from previous terms to calculate GWA and prerequisite eligibility.

B. Faculty Dashboard
- My Sections: A view of all sections assigned to the specific faculty member. Clicking a section opens the Class Roster.
- Grade Submission: Allows faculty to input numerical grades.
- Submission Workflow: Grades enter the grades collection with a pending status. They are not visible to students until the Registrar validates them.

C. Registrar (Admin) Dashboard
- Approvals Tab: The control center for enrollment. Shows pending enrollments and pending_drop requests.
- Grades Tab: Where faculty submissions are validated. Approving a grade changes its status to posted, which updates the student record.
- Users Tab: Used for Provision Identity (creating new user accounts in the users collection).
- System Tab: Contains the Semester Transition Matrix and Foundation Data Reset for wiping/reseeding the database.

---

3. Enrollment Workflow & Simulation Logic

The Student Journey
1. Dashboard Access: Log in to view status.
2. Prerequisite Check: Before the enrollment wizard opens, the system verifies academic history. If blocked, ensure previous grades are posted.
3. Subject Selection: Use the Enrollment Wizard. Courses are dynamically filtered.
4. Submission: Click Confirm & Submit to trigger a registrar request.

Simulation Troubleshooting
If you encounter a block during simulation, follow this sequence:
1. Seed: Go to the Admin Dashboard (System tab) and run Foundation Seed.
2. Mock History: Manually add passed subjects to the grades collection for that student (Status: posted, Semester: 1) in Firestore.
3. Enroll: Log in as one of the students listed above and start the wizard.

Important: If you see Already Enrolled errors, verify that no enrollments documents exist for the current semester for that student in your Firestore database.CampusLink: Comprehensive User Manual & Simulation Guide

Welcome to the CampusLink academic portal. This manual serves as both a user guide and a simulation reference for administrative, faculty, and student workflows.

---

1. Official Demo Credentials

Use these specific accounts to verify system logic. Note: Ensure you have run the Foundation Seed in your Admin Dashboard to ensure these accounts are initialized in your Firestore database.

ID                Password      Role
---------------------------------------------
2026-0001-A       Admin1        Registrar
2026-1001-A       Sator1        Professor
2026-1002-A       Reyes1        Professor
2026-1003-A       Turing        Professor
2026-1004-A       Curie1        Professor
2023-4364-A       Simon1        Student
2026-2004-A       Tan111        Student
2026-3001-A       Reyes1        Student
2026-2005-A       Villanueva    Student
2026-2006-A       Cruz11        Student
2026-2001-A       Devera        Student
2026-2002-A       Santos        Student
2026-4001-A       Gomez1        Student
2026-2003-A       Lopez1        Student

---

2. Dashboard Guides

A. Student Dashboard
- Status Indicators: Displays ENROLLED or NOT ENROLLED. This status is the primary trigger for the Enrollment Wizard logic.
- Study Load Wizard:
  - Empty State: Shown when NOT ENROLLED.
  - Course Catalog: Subjects are filtered by yearLevel and program. Locked icons indicate missing prerequisites or duplicate enrollment.
- Academic History: Aggregates all Posted grades from previous terms to calculate GWA and prerequisite eligibility.

B. Faculty Dashboard
- My Sections: A view of all sections assigned to the specific faculty member. Clicking a section opens the Class Roster.
- Grade Submission: Allows faculty to input numerical grades.
- Submission Workflow: Grades enter the grades collection with a pending status. They are not visible to students until the Registrar validates them.

C. Registrar (Admin) Dashboard
- Approvals Tab: The control center for enrollment. Shows pending enrollments and pending_drop requests.
- Grades Tab: Where faculty submissions are validated. Approving a grade changes its status to posted, which updates the student record.
- Users Tab: Used for Provision Identity (creating new user accounts in the users collection).
- System Tab: Contains the Semester Transition Matrix and Foundation Data Reset for wiping/reseeding the database.

---

3. Enrollment Workflow & Simulation Logic

The Student Journey
1. Dashboard Access: Log in to view status.
2. Prerequisite Check: Before the enrollment wizard opens, the system verifies academic history. If blocked, ensure previous grades are posted.
3. Subject Selection: Use the Enrollment Wizard. Courses are dynamically filtered.
4. Submission: Click Confirm & Submit to trigger a registrar request.

Simulation Troubleshooting
If you encounter a block during simulation, follow this sequence:
1. Seed: Go to the Admin Dashboard (System tab) and run Foundation Seed.
2. Mock History: Manually add passed subjects to the grades collection for that student (Status: posted, Semester: 1) in Firestore.
3. Enroll: Log in as one of the students listed above and start the wizard.

Important: If you see Already Enrolled errors, verify that no enrollments documents exist for the current semester for that student in your Firestore database.