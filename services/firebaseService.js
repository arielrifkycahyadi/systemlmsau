import admin from 'firebase-admin';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if credentials are set in environment
const hasFirebaseEnv =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

let db = null;
let useLocalMock = true;

// Define local JSON storage paths
const LOCAL_DB_DIR = path.resolve(process.cwd(), 'db');
const FILE_PATHS = {
  courses: path.join(LOCAL_DB_DIR, 'courses.json'),
  submissions: path.join(LOCAL_DB_DIR, 'submissions.json'),
  attendance: path.join(LOCAL_DB_DIR, 'attendance.json')
};

// Initialize Admin SDK or Fallback
if (hasFirebaseEnv) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      });
    }
    db = admin.firestore();
    useLocalMock = false;
    console.log('Firebase Admin SDK initialized successfully with Cloud Firestore.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK. Falling back to local file DB.', err);
  }
} else {
  console.log('No Firebase credentials found. Running in Local File DB Mock mode.');
}

// Helper to ensure local database files exist
async function ensureLocalDb() {
  try {
    await fs.mkdir(LOCAL_DB_DIR, { recursive: true });
    for (const [key, filePath] of Object.entries(FILE_PATHS)) {
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, '[]', 'utf8');
      }
    }
  } catch (err) {
    // If process.cwd() is read-only (like under Vercel), fall back to /tmp directory
    const tmpDir = path.join('/tmp', 'db');
    console.warn(`Local directory ${LOCAL_DB_DIR} read-only or inaccessible. Redirecting file database to ${tmpDir}`);
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      FILE_PATHS.courses = path.join(tmpDir, 'courses.json');
      FILE_PATHS.submissions = path.join(tmpDir, 'submissions.json');
      FILE_PATHS.attendance = path.join(tmpDir, 'attendance.json');
      
      for (const [key, filePath] of Object.entries(FILE_PATHS)) {
        try {
          await fs.access(filePath);
        } catch {
          await fs.writeFile(filePath, '[]', 'utf8');
        }
      }
    } catch (tmpErr) {
      console.error('Fatal: Failed to establish local file DB fallback in /tmp.', tmpErr);
    }
  }
}

// Helpers to read/write JSON databases
async function readLocalData(collection) {
  await ensureLocalDb();
  const filePath = FILE_PATHS[collection];
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content || '[]');
}

async function writeLocalData(collection, data) {
  await ensureLocalDb();
  const filePath = FILE_PATHS[collection];
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- Service Exports ---
export const firebaseService = {
  isMock: () => useLocalMock,

  // --- Courses Operations ---
  async saveCourseData(courseId, data) {
    if (!useLocalMock && db) {
      await db.collection('courses').doc(courseId).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return data;
    } else {
      const courses = await readLocalData('courses');
      const idx = courses.findIndex(c => c.courseId === courseId);
      const record = { ...data, courseId, updatedAt: new Date().toISOString() };
      if (idx > -1) {
        courses[idx] = { ...courses[idx], ...record };
      } else {
        courses.push(record);
      }
      await writeLocalData('courses', courses);
      return record;
    }
  },

  async getCourseById(courseId) {
    if (!useLocalMock && db) {
      const snap = await db.collection('courses').doc(courseId).get();
      return snap.exists ? snap.data() : null;
    } else {
      const courses = await readLocalData('courses');
      return courses.find(c => c.courseId === courseId) || null;
    }
  },

  async getAllCourses() {
    if (!useLocalMock && db) {
      const snap = await db.collection('courses').get();
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      return await readLocalData('courses');
    }
  },

  // --- Submissions Operations ---
  async saveSubmission(submissionId, data) {
    const record = {
      submissionId,
      ...data,
      submittedAt: new Date().toISOString()
    };
    if (!useLocalMock && db) {
      await db.collection('submissions').doc(submissionId).set(record);
      return record;
    } else {
      const subs = await readLocalData('submissions');
      subs.push(record);
      await writeLocalData('submissions', subs);
      return record;
    }
  },

  async getSubmissionsByCourse(courseId) {
    if (!useLocalMock && db) {
      const snap = await db.collection('submissions').where('courseId', '==', courseId).get();
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      const subs = await readLocalData('submissions');
      return subs.filter(s => s.courseId === courseId);
    }
  },

  // --- Attendance Operations ---
  async saveAttendanceLog(attendanceId, data) {
    if (!useLocalMock && db) {
      await db.collection('attendance').doc(attendanceId).set(data);
      return data;
    } else {
      const logs = await readLocalData('attendance');
      const idx = logs.findIndex(l => l.attendanceId === attendanceId);
      if (idx > -1) {
        logs[idx] = data;
      } else {
        logs.push(data);
      }
      await writeLocalData('attendance', logs);
      return data;
    }
  },

  async getAttendanceByCourse(courseId) {
    if (!useLocalMock && db) {
      const snap = await db.collection('attendance').where('courseId', '==', courseId).get();
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      return list;
    } else {
      const logs = await readLocalData('attendance');
      return logs.filter(l => l.courseId === courseId);
    }
  }
};
