// Firebase Web SDK Loader with client LocalStorage Mock Driver fallback
// Allows standard CRUD and real-time listeners offline or when credentials are not yet saved.

export const STORAGE_KEYS = {
  USERS: 'au_lms_users',
  COURSES: 'au_lms_courses',
  SUBMISSIONS: 'au_lms_submissions',
  ATTENDANCE: 'au_lms_attendance',
  ACTIVE_USER: 'au_lms_active_user',
  FIREBASE_CONFIG: 'au_lms_firebase_config'
};

export function getSavedFirebaseConfig() {
  const cfg = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
  return cfg ? JSON.parse(cfg) : null;
}

export function saveFirebaseConfig(cfg) {
  localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(cfg));
}

// Mock database service
class MockDatabaseService {
  constructor() {
    this._listeners = {};
    this._seed();
  }

  _seed() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
        { uid: 'lecturer1', email: 'lecturer@au.edu', name: 'Dr. Ariel Usman', role: 'lecturer' },
        { uid: 'student1', email: 'student@au.edu', name: 'Ariel Rifky', role: 'student' }
      ]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.COURSES)) {
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    }
  }

  _getData(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  _setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    if (this._listeners[key]) {
      this._listeners[key].forEach(cb => cb(data));
    }
  }

  // --- Auth API ---
  async getCurrentUser() {
    const user = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    return user ? JSON.parse(user) : null;
  }

  async signIn(email, password) {
    const users = this._getData(STORAGE_KEYS.USERS);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('User not found. Try lecturer@au.edu or student@au.edu');
    
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
    return user;
  }

  async signUp(email, password, name, role) {
    const users = this._getData(STORAGE_KEYS.USERS);
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email already registered.');
    }
    const newUser = { uid: 'u_' + Math.random().toString(36).substr(2, 9), email, name, role };
    users.push(newUser);
    this._setData(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(newUser));
    return newUser;
  }

  async signOut() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    return true;
  }

  // --- Courses API ---
  async saveCourse(courseId, courseData) {
    const courses = this._getData(STORAGE_KEYS.COURSES);
    const index = courses.findIndex(c => c.courseId === courseId);
    if (index > -1) {
      courses[index] = { ...courses[index], ...courseData };
    } else {
      courses.push({ courseId, ...courseData, createdAt: new Date().toISOString() });
    }
    this._setData(STORAGE_KEYS.COURSES, courses);
    return courseData;
  }

  async getCourse(courseId) {
    const courses = this._getData(STORAGE_KEYS.COURSES);
    return courses.find(c => c.courseId === courseId) || null;
  }

  async getAllCourses() {
    return this._getData(STORAGE_KEYS.COURSES);
  }

  // --- Submissions API ---
  async saveSubmission(submissionId, submissionData) {
    const subs = this._getData(STORAGE_KEYS.SUBMISSIONS);
    const index = subs.findIndex(s => s.submissionId === submissionId);
    const data = { submissionId, ...submissionData, submittedAt: new Date().toISOString() };
    if (index > -1) {
      subs[index] = data;
    } else {
      subs.push(data);
    }
    this._setData(STORAGE_KEYS.SUBMISSIONS, subs);
    return data;
  }

  async getSubmissionsByCourse(courseId) {
    const subs = this._getData(STORAGE_KEYS.SUBMISSIONS);
    return subs.filter(s => s.courseId === courseId);
  }

  // --- Attendance API (Real-time Mocking) ---
  async saveAttendance(attendanceId, attendanceData) {
    const atts = this._getData(STORAGE_KEYS.ATTENDANCE);
    const index = atts.findIndex(a => a.attendanceId === attendanceId);
    const data = { attendanceId, ...attendanceData };
    if (index > -1) {
      atts[index] = data;
    } else {
      atts.push(data);
    }
    this._setData(STORAGE_KEYS.ATTENDANCE, atts);
    return data;
  }

  async getAttendance(attendanceId) {
    const atts = this._getData(STORAGE_KEYS.ATTENDANCE);
    return atts.find(a => a.attendanceId === attendanceId) || null;
  }

  async getActiveAttendance(courseId) {
    const atts = this._getData(STORAGE_KEYS.ATTENDANCE);
    const now = new Date().getTime();
    return atts.find(a => a.courseId === courseId && a.active && new Date(a.endsAt).getTime() > now) || null;
  }

  subscribeToAttendance(courseId, callback) {
    const key = STORAGE_KEYS.ATTENDANCE;
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }

    const triggerCheck = () => {
      const active = this._getData(STORAGE_KEYS.ATTENDANCE)
        .find(a => a.courseId === courseId && a.active && new Date(a.endsAt).getTime() > new Date().getTime());
      callback(active || null);
    };

    triggerCheck();

    const cbWrapper = () => triggerCheck();
    this._listeners[key].push(cbWrapper);

    const interval = setInterval(triggerCheck, 2000);

    return () => {
      this._listeners[key] = this._listeners[key].filter(cb => cb !== cbWrapper);
      clearInterval(interval);
    };
  }
}

export const lmsService = new MockDatabaseService();
console.log('AU Learning Client Service initialized.');
