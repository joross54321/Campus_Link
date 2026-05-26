"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledSemesterTransition = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const date_fns_1 = require("date-fns");
const firestoreDatabaseId_1 = require("./firestoreDatabaseId");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(firestoreDatabaseId_1.FIRESTORE_DATABASE_ID);
function getNextSemester(semester, academicYear) {
    if (semester === '1')
        return { semester: '2', academicYear };
    if (semester === '2')
        return { semester: 'Summer', academicYear };
    const [start] = academicYear.split('-').map(Number);
    const nextStart = (start || 2025) + 1;
    return { semester: '1', academicYear: `${nextStart}-${nextStart + 1}` };
}
function defaultDatesForTerm(semester, academicYear) {
    const base = new Date();
    const semesterStartDate = base.toISOString();
    const semesterEndDate = (0, date_fns_1.addMonths)(base, semester === 'Summer' ? 2 : 4).toISOString();
    const enrollmentStartDate = (0, date_fns_1.addMonths)(base, -1).toISOString();
    const enrollmentEndDate = (0, date_fns_1.addWeeks)(base, 2).toISOString();
    const midtermDate = (0, date_fns_1.addWeeks)(base, 8).toISOString();
    const dropLock = new Date(midtermDate);
    dropLock.setDate(dropLock.getDate() - 7);
    return {
        semesterStartDate,
        semesterEndDate,
        enrollmentStartDate,
        enrollmentEndDate,
        midtermDate,
        dropLockDate: dropLock.toISOString().slice(0, 10),
        currentSemester: semester,
        currentAcademicYear: academicYear,
    };
}
async function maybeTransition() {
    const configRef = db.doc('system/config');
    const snap = await configRef.get();
    if (!snap.exists)
        return false;
    const data = snap.data();
    const end = data.semesterEndDate ? new Date(data.semesterEndDate) : null;
    const now = new Date();
    if (!end || now <= end)
        return false;
    return db.runTransaction(async (tx) => {
        var _a, _b;
        const fresh = await tx.get(configRef);
        if (!fresh.exists)
            return false;
        const current = fresh.data();
        const termEnd = current.semesterEndDate
            ? new Date(current.semesterEndDate)
            : null;
        if (!termEnd || now <= termEnd)
            return false;
        const next = getNextSemester(String((_a = current.currentSemester) !== null && _a !== void 0 ? _a : '1'), String((_b = current.currentAcademicYear) !== null && _b !== void 0 ? _b : '2025-2026'));
        const dates = defaultDatesForTerm(next.semester, next.academicYear);
        tx.set(configRef, Object.assign(Object.assign(Object.assign({}, current), dates), { enrollmentOpen: false, lastTransitionAt: now.toISOString(), transitionedBy: 'auto-scheduled' }), { merge: true });
        return true;
    });
}
/** Daily at 00:05 Asia/Manila — advances term when semesterEndDate has passed */
exports.scheduledSemesterTransition = (0, scheduler_1.onSchedule)({
    schedule: '5 0 * * *',
    timeZone: 'Asia/Manila',
}, async () => {
    const transitioned = await maybeTransition();
    console.log(transitioned
        ? 'Semester transition completed'
        : 'No transition needed');
});
//# sourceMappingURL=index.js.map