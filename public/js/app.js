import { lmsService, STORAGE_KEYS } from './firebase-config.js';

class AppRouter {
  constructor() {
    this.state = {
      activeUser: null,
      authMode: 'login',
      authRole: 'lecturer',
      activeCourse: null,
      coursesList: [],
      submissions: [],
      activePoll: null,
      pollCountdown: 0,
      activeModalAssignment: null,
      selectedFile: null,
      selectedFileText: "",
      
      // Page specific states
      currentTab: 'curriculum', // curriculum | webrtc | grades
      currentDashTab: 'overview', // overview | editor | grading | broadcaster
      cpmkChart: null,
      scoresChart: null,
    };

    this.timerInterval = null;
    this.pollUnsubscribe = null;
    this.studentTimer = null;
    this.studentPollId = null;

    this.init();
  }

  async init() {
    await this.checkSession();
    
    // Page specific initializations
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path.endsWith('/')) {
      this.bindDropzone();
      this.loadIndexViews();
    } else if (path.endsWith('lms.html')) {
      this.loadLmsViews();
    } else if (path.endsWith('dashboard.html')) {
      this.loadDashboardViews();
    }
  }

  // --- Session Authentication Controls ---
  async checkSession() {
    const user = await lmsService.getCurrentUser();
    this.state.activeUser = user;
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastText || !toastIcon) return;

    toastText.textContent = message;
    toast.className = `toast-msg show toast-${type}`;

    if (type === 'success') {
      toastIcon.className = 'fa-solid fa-circle-check';
    } else if (type === 'error') {
      toastIcon.className = 'fa-solid fa-triangle-exclamation';
    } else {
      toastIcon.className = 'fa-solid fa-circle-info';
    }

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  setAuthRole(role) {
    this.state.authRole = role;
    const lecturerBtn = document.getElementById('role-lecturer-btn');
    const studentBtn = document.getElementById('role-student-btn');
    if (lecturerBtn && studentBtn) {
      lecturerBtn.classList.toggle('active', role === 'lecturer');
      studentBtn.classList.toggle('active', role === 'student');
    }
  }

  toggleAuthMode() {
    const title = document.querySelector('.auth-header h2') || document.querySelector('.auth-card h2');
    const nameGroup = document.getElementById('name-group');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleMsg = document.getElementById('auth-toggle-msg');
    const toggleLink = document.getElementById('auth-toggle-link');

    if (this.state.authMode === 'login') {
      this.state.authMode = 'register';
      if (title) title.textContent = 'Create AU Learning Account';
      if (nameGroup) nameGroup.style.display = 'block';
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleMsg) toggleMsg.textContent = 'Already have an account?';
      if (toggleLink) toggleLink.textContent = 'Sign In';
    } else {
      this.state.authMode = 'login';
      if (title) title.textContent = 'Welcome to AU Learning';
      if (nameGroup) nameGroup.style.display = 'none';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleMsg) toggleMsg.textContent = "Don't have an account?";
      if (toggleLink) toggleLink.textContent = 'Sign Up';
    }
  }

  async handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const nameNode = document.getElementById('auth-name');
    const name = nameNode ? nameNode.value : '';

    try {
      if (this.state.authMode === 'login') {
        const user = await lmsService.signIn(email, password);
        this.state.activeUser = user;
      } else {
        if (!name) {
          this.showToast('Please enter your full name', 'error');
          return;
        }
        const user = await lmsService.signUp(email, password, name, this.state.authRole);
        this.state.activeUser = user;
      }

      this.showToast(`Logged in as ${this.state.activeUser.name}`, 'success');
      
      // Refresh views based on path
      const path = window.location.pathname;
      if (path.endsWith('index.html') || path.endsWith('/')) {
        this.loadIndexViews();
      } else if (path.endsWith('lms.html')) {
        window.location.reload();
      } else if (path.endsWith('dashboard.html')) {
        window.location.reload();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleSignOut() {
    await lmsService.signOut();
    if (this.pollUnsubscribe) this.pollUnsubscribe();
    this.state.activeUser = null;
    this.state.activeCourse = null;
    
    // Redirect to home portal
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
      this.loadIndexViews();
    } else {
      window.location.href = 'index.html';
    }
  }

  // --- Portal Landing View Handler ---
  async loadIndexViews() {
    const authPanel = document.getElementById('auth-panel');
    const generatorPanel = document.getElementById('generator-panel');
    const studentPanel = document.getElementById('student-home-panel');

    if (!this.state.activeUser) {
      if (authPanel) authPanel.style.display = 'flex';
      if (generatorPanel) generatorPanel.style.display = 'none';
      if (studentPanel) studentPanel.style.display = 'none';
      return;
    }

    if (authPanel) authPanel.style.display = 'none';

    if (this.state.activeUser.role === 'lecturer') {
      if (generatorPanel) {
        generatorPanel.style.display = 'block';
        document.getElementById('generator-welcome-text').textContent = this.state.activeUser.name;
        document.getElementById('generator-user-avatar').textContent = this.state.activeUser.name.charAt(0).toUpperCase();
      }
      if (studentPanel) studentPanel.style.display = 'none';
    } else {
      if (generatorPanel) generatorPanel.style.display = 'none';
      if (studentPanel) {
        studentPanel.style.display = 'block';
        document.getElementById('student-welcome-text').textContent = this.state.activeUser.name;
        document.getElementById('student-user-avatar').textContent = this.state.activeUser.name.charAt(0).toUpperCase();
        this.renderStudentCoursesList();
      }
    }
  }

  renderStudentCoursesList() {
    const block = document.getElementById('enrolled-courses-block');
    const list = document.getElementById('enrolled-courses-list');
    
    if (!block || !list) return;

    const enrolledIds = JSON.parse(localStorage.getItem(`enrolled_${this.state.activeUser.uid}`) || '[]');
    const courses = JSON.parse(localStorage.getItem('au_lms_courses') || '[]');
    const enrolledCourses = courses.filter(c => enrolledIds.includes(c.courseId));

    if (enrolledCourses.length === 0) {
      block.style.display = 'none';
      return;
    }

    block.style.display = 'block';
    list.innerHTML = '';
    enrolledCourses.forEach(c => {
      const row = document.createElement('div');
      row.className = 'glass-panel';
      row.style.padding = '1rem';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = `
        <div>
          <h4 style="color: white; font-size: 0.95rem;">${c.courseName}</h4>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Code: ${c.courseId} | Lecturer: ${c.lecturerName || 'AI Specialist'}</span>
        </div>
        <button onclick="window.location.href='lms.html?id=${c.courseId}'" class="btn btn-teal" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Open LMS
        </button>
      `;
      list.appendChild(row);
    });
  }

  // --- Student Micro-Site LMS Handler ---
  async loadLmsViews() {
    // Check Student authentication
    if (!this.state.activeUser) {
      this.showToast('Please log in first to access the student classroom.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    // Load active course context from query param
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');

    if (!courseId) {
      this.showToast('Invalid micro-site URL: No Course ID parameter.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    const course = await lmsService.getCourse(courseId);
    if (!course) {
      this.showToast('Course code details not found in directory.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    this.state.activeCourse = course;

    // Set UI metadata
    document.getElementById('brand-course-title').textContent = course.courseName;
    document.getElementById('brand-course-id').textContent = `Course Code: ${course.courseId} | Specialist: ${course.lecturerName || 'Lecturer'}`;
    
    document.getElementById('student-name').textContent = this.state.activeUser.name;
    document.getElementById('student-avatar').textContent = this.state.activeUser.name.charAt(0).toUpperCase();

    // Pull student's submissions history on this course
    const subs = await lmsService.getSubmissionsByCourse(courseId);
    this.state.submissions = subs.filter(s => s.studentId === this.state.activeUser.uid);

    this.renderLmsCurriculum();
    this.setupStudentPollListener(courseId);
    this.renderLmsAttendanceRate();
  }

  renderLmsCurriculum() {
    const container = document.getElementById('lms-weeks-container');
    const cpmkList = document.getElementById('lms-cpmk-list');
    const c = this.state.activeCourse;

    if (!container) return;

    // Outcomes
    if (cpmkList) {
      cpmkList.innerHTML = (c.cpmk || []).map(g => `<li><i class="fa-solid fa-chevron-right" style="color: var(--accent-teal); font-size: 0.7rem; margin-right: 0.4rem;"></i> ${g}</li>`).join('');
    }

    if (!c.weeks || c.weeks.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 5rem;">No topics scheduled yet.</div>';
      return;
    }

    container.innerHTML = '';
    c.weeks.forEach(week => {
      const card = document.createElement('div');
      card.className = 'week-card glass-panel';

      const weekSubmissions = this.state.submissions.filter(s => s.weekNum === week.weekNum);

      card.innerHTML = `
        <div class="week-header" onclick="toggleWeekAccordion(${week.weekNum})">
          <div style="display: flex; align-items: center; flex: 1;">
            <span class="week-number">W${week.weekNum}</span>
            <span class="week-title">${week.topic}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="week-badge">${week.bloomTaxonomy || 'Analyze'}</span>
            <i class="fa-solid fa-chevron-down" style="color: var(--text-secondary);"></i>
          </div>
        </div>
        <div class="week-details" id="week-details-${week.weekNum}">
          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">
            <strong>Learning Scope:</strong> ${week.subtopic || 'Concept details'}
          </p>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            <strong>Pedagogical Mode:</strong> ${week.learningMethod || 'Lecture Discussion'}
          </div>
          
          <!-- Videos -->
          <div style="margin-top: 1rem;">
            <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.5rem;"><i class="fa-brands fa-youtube" style="color: red;"></i> Video Tutorials</h4>
            ${
              week.youtubeVideos && week.youtubeVideos.length > 0
                ? week.youtubeVideos.map(vid => `
                  <div class="youtube-item">
                    <div style="position:relative; width:110px; height:62px; background:#000; border-radius:4px; overflow:hidden; flex-shrink:0;">
                      <img class="youtube-thumbnail" src="${vid.thumbnail}" style="width:100%; height:100%; object-fit:cover;" alt="Thumbnail">
                      <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:1.1rem; text-shadow:0 0 5px rgba(0,0,0,0.8);"><i class="fa-solid fa-play"></i></div>
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                      <a href="https://www.youtube.com/watch?v=${vid.videoId}" target="_blank" style="color: var(--accent-teal); text-decoration: none; font-weight: 600; font-size: 0.85rem; line-height:1.3;">
                        ${vid.title}
                      </a>
                    </div>
                  </div>
                `).join('')
                : `<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No video matches available locally.</p>`
            }
          </div>

          <!-- Evaluation Assignments -->
          <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
            <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.75rem;"><i class="fa-solid fa-pen-nib" style="color: var(--accent-pink);"></i> Evaluation Task</h4>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;" id="lms-assignments-${week.weekNum}">
              <!-- Rendered via javascript -->
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);

      const taskContainer = card.querySelector(`#lms-assignments-${week.weekNum}`);
      if (!week.assignments || week.assignments.length === 0) {
        taskContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">No evaluations assigned.</p>';
      } else {
        week.assignments.forEach((assignment, aIndex) => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          div.style.background = 'rgba(255,255,255,0.02)';
          div.style.padding = '0.5rem 1rem';
          div.style.borderRadius = '6px';
          div.style.border = '1px solid rgba(255,255,255,0.03)';

          const sub = weekSubmissions.find(s => s.assignmentIndex === aIndex);

          let buttonText = 'Attempt Task';
          let btnClass = 'btn-teal';
          let statusText = `<span style="font-size: 0.75rem; color: var(--text-secondary);"><i class="fa-regular fa-clock"></i> Not submitted</span>`;

          if (sub) {
            buttonText = 'Review Graded Result';
            btnClass = 'btn-secondary';
            const score = sub.evaluation?.score !== undefined ? sub.evaluation.score : 'N/A';
            statusText = `<span style="font-size: 0.75rem; color: var(--color-success); font-weight: bold;"><i class="fa-solid fa-circle-check"></i> Score: ${score}</span>`;
          }

          div.innerHTML = `
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 0.85rem; font-weight: bold; color: white;">${assignment.prompt}</span>
              <span style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Type: ${assignment.type}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              ${statusText}
              <button onclick="openAssignmentModal(${week.weekNum}, ${aIndex})" class="btn ${btnClass}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                ${buttonText}
              </button>
            </div>
          `;
          taskContainer.appendChild(div);
        });
      }
    });
  }

  switchLMSTab(tabId) {
    this.state.currentTab = tabId;
    const navs = ['curriculum', 'webrtc', 'grades'];
    navs.forEach(t => {
      const el = document.getElementById(`nav-lms-${t}`);
      const sec = document.getElementById(`lms-tab-${t}`);
      if (el) el.classList.toggle('active', t === tabId);
      if (sec) sec.style.display = t === tabId ? 'block' : 'none';
    });

    if (tabId === 'webrtc') {
      this.loadJitsiMeetClass();
    } else if (tabId === 'grades') {
      this.renderLmsGradesTab();
    }
  }

  loadJitsiMeetClass() {
    const container = document.getElementById('jitsi-iframe-container');
    if (!container || container.querySelector('iframe')) return;

    const course = this.state.activeCourse;
    container.innerHTML = `
      <iframe src="https://meet.jit.si/AULearning_Classroom_${course.courseId}" 
              class="jitsi-iframe" 
              allow="camera; microphone; fullscreen; display-capture; autoplay">
      </iframe>
    `;
    this.showToast('Connected to Jitsi Meet Class server successfully.', 'info');
  }

  async renderLmsGradesTab() {
    const list = document.getElementById('lms-submissions-list');
    const inspector = document.getElementById('lms-grading-inspector');

    if (!list) return;

    if (this.state.submissions.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 5rem;">No homework submitted yet.</div>';
      return;
    }

    list.innerHTML = '';
    this.state.submissions.forEach(sub => {
      const div = document.createElement('div');
      div.style.padding = '0.75rem 1rem';
      div.style.background = 'rgba(255,255,255,0.02)';
      div.style.borderRadius = '8px';
      div.style.cursor = 'pointer';
      div.style.border = '1px solid var(--border-color)';
      div.style.transition = 'var(--transition-smooth)';
      div.style.marginBottom = '0.5rem';

      div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
      div.onmouseout = () => div.style.background = 'rgba(255,255,255,0.02)';
      div.onclick = () => this.renderGradingInspectorDetails(sub.submissionId, 'lms-grading-inspector');

      const score = sub.evaluation?.score !== undefined ? sub.evaluation.score : 'N/A';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span style="font-size: 0.85rem; font-weight: 600; color: white;">Week ${sub.weekNum} ${sub.type.toUpperCase()}</span>
          <span style="font-size: 0.8rem; color: var(--accent-teal); font-weight: bold;">Score: ${score}</span>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-secondary); text-align:right;">
          ${new Date(sub.submittedAt).toLocaleDateString()}
        </div>
      `;
      list.appendChild(div);
    });

    this.renderGradingInspectorDetails(this.state.submissions[0].submissionId, 'lms-grading-inspector');
  }

  // --- Lecturer Console Dashboard Handler ---
  async loadDashboardViews() {
    if (!this.state.activeUser || this.state.activeUser.role !== 'lecturer') {
      this.showToast('Access Denied. Lecturer privileges required.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    document.getElementById('lecturer-name').textContent = this.state.activeUser.name;
    document.getElementById('lecturer-avatar').textContent = this.state.activeUser.name.charAt(0).toUpperCase();

    // Populate Courses dropdown
    const allCourses = await lmsService.getAllCourses();
    this.state.coursesList = allCourses.filter(c => c.lecturerId === this.state.activeUser.uid);

    const select = document.getElementById('lecturer-course-selector');
    if (select) {
      select.innerHTML = '';
      if (this.state.coursesList.length === 0) {
        select.innerHTML = '<option value="">-- No Courses Created --</option>';
        this.showToast('Please generate a curriculum course first on the portal page.', 'info');
        return;
      }
      this.state.coursesList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.courseId;
        opt.textContent = `${c.courseId} - ${c.courseName}`;
        select.appendChild(opt);
      });

      // Select active course
      const activeId = this.state.coursesList[0].courseId;
      select.value = activeId;
      await this.handleCourseSelection(activeId);
    }
  }

  async handleCourseSelection(courseId) {
    if (!courseId) return;
    const course = await lmsService.getCourse(courseId);
    this.state.activeCourse = course;

    // Load submissions for this course
    const subs = await lmsService.getSubmissionsByCourse(courseId);
    this.state.submissions = subs;

    // Update stats, charts, and sub-views
    this.updateDashboardMetrics();
    this.drawChartJsGraphics();

    // If on broadcast tab, load active poll check
    if (this.state.currentDashTab === 'broadcaster') {
      this.loadLiveAttendanceSession();
    } else if (this.state.currentDashTab === 'editor') {
      this.renderNoCodeEditor();
    } else if (this.state.currentDashTab === 'grading') {
      this.renderLecturerGradingList();
    }
  }

  switchDashTab(tabId) {
    this.state.currentDashTab = tabId;
    const tabs = ['overview', 'editor', 'grading', 'broadcaster'];
    tabs.forEach(t => {
      const nav = document.getElementById(`nav-dash-${t}`);
      const panel = document.getElementById(`dash-tab-${t}`);
      if (nav) nav.classList.toggle('active', t === tabId);
      if (panel) panel.style.display = t === tabId ? 'block' : 'none';
    });

    if (tabId === 'broadcaster') {
      this.loadLiveAttendanceSession();
    } else if (tabId === 'editor') {
      this.renderNoCodeEditor();
    } else if (tabId === 'grading') {
      this.renderLecturerGradingList();
    }
  }

  updateDashboardMetrics() {
    const studentCountEl = document.getElementById('stat-students-count');
    const gradedCountEl = document.getElementById('stat-graded-count');
    const attendanceRateEl = document.getElementById('stat-att-rate');

    if (!studentCountEl) return;

    // Collect student metrics
    const studentIds = new Set(this.state.submissions.map(s => s.studentId));
    studentCountEl.textContent = studentIds.size || 0;
    gradedCountEl.textContent = this.state.submissions.length || 0;

    // Attendance calculation
    const allAtts = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]')
      .filter(a => a.courseId === this.state.activeCourse.courseId);
    
    let sumRate = 0;
    studentIds.forEach(sid => {
      let presentCount = 0;
      allAtts.forEach(a => {
        if (a.attendees && a.attendees[sid]) presentCount++;
      });
      sumRate += allAtts.length > 0 ? (presentCount / allAtts.length) * 100 : 100;
    });

    const averageRate = studentIds.size > 0 ? Math.round(sumRate / studentIds.size) : 100;
    attendanceRateEl.textContent = `${averageRate}%`;
  }

  // --- No-Code Visual Editor Renderer ---
  renderNoCodeEditor() {
    const c = this.state.activeCourse;
    const cpmkContainer = document.getElementById('editor-cpmk-inputs');
    const rubricContainer = document.getElementById('editor-rubric-inputs');
    const weeksContainer = document.getElementById('editor-weeks-list');

    if (!cpmkContainer || !weeksContainer) return;

    // CPMK Outcomes
    cpmkContainer.innerHTML = '';
    (c.cpmk || ["Syllabus learning objective target"]).forEach((goal, gIdx) => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.gap = '0.5rem';
      wrapper.innerHTML = `
        <input type="text" name="editor-cpmk-input" class="form-control" value="${goal}" required>
        <button type="button" onclick="this.parentNode.remove()" class="btn btn-secondary" style="padding: 0.4rem 0.8rem; color: var(--color-danger); border-color:rgba(239,68,68,0.2);"><i class="fa-solid fa-trash"></i></button>
      `;
      cpmkContainer.appendChild(wrapper);
    });

    // Rubrics
    rubricContainer.innerHTML = '';
    (c.essayRubrics || []).forEach((rub, rIdx) => {
      const div = document.createElement('div');
      div.style.display = 'grid';
      div.style.gridTemplateColumns = '1fr 1fr 60px';
      div.style.gap = '0.5rem';
      div.innerHTML = `
        <input type="text" name="editor-rubric-name" class="form-control" value="${rub.criteriaName}" placeholder="Criteria" required>
        <input type="text" name="editor-rubric-desc" class="form-control" value="${rub.description}" placeholder="Description">
        <input type="number" name="editor-rubric-max" class="form-control" value="${rub.maxScore}" placeholder="Max" min="1" required>
      `;
      rubricContainer.appendChild(div);
    });

    // 16 Weeks Accordion
    weeksContainer.innerHTML = '';
    c.weeks.forEach(week => {
      const item = document.createElement('div');
      item.className = 'glass-panel';
      item.style.padding = '1.25rem';
      item.style.marginBottom = '0.5rem';
      item.innerHTML = `
        <div style="font-weight: bold; font-size: 0.95rem; color: white; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;">
          <span class="week-number" style="font-size:0.75rem;">Week ${week.weekNum}</span>
          <input type="text" name="editor-week-topic-${week.weekNum}" class="form-control" value="${week.topic}" style="flex:1;" required>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label>Subtopic Outlines</label>
            <input type="text" name="editor-week-sub-${week.weekNum}" class="form-control" value="${week.subtopic}">
          </div>
          <div class="form-group">
            <label>Bloom Taxonomy Classification</label>
            <select name="editor-week-bloom-${week.weekNum}" class="form-control">
              <option value="C1-Remember" ${week.bloomTaxonomy === 'C1-Remember' || week.bloomTaxonomy === 'Remember' ? 'selected' : ''}>C1 - Remember</option>
              <option value="C2-Understand" ${week.bloomTaxonomy === 'C2-Understand' || week.bloomTaxonomy === 'Understand' ? 'selected' : ''}>C2 - Understand</option>
              <option value="C3-Apply" ${week.bloomTaxonomy === 'C3-Apply' || week.bloomTaxonomy === 'Apply' ? 'selected' : ''}>C3 - Apply</option>
              <option value="C4-Analyze" ${week.bloomTaxonomy === 'C4-Analyze' || week.bloomTaxonomy === 'Analyze' ? 'selected' : ''}>C4 - Analyze</option>
              <option value="C5-Evaluate" ${week.bloomTaxonomy === 'C5-Evaluate' || week.bloomTaxonomy === 'Evaluate' ? 'selected' : ''}>C5 - Evaluate</option>
              <option value="C6-Create" ${week.bloomTaxonomy === 'C6-Create' || week.bloomTaxonomy === 'Create' ? 'selected' : ''}>C6 - Create</option>
            </select>
          </div>
        </div>
      `;
      weeksContainer.appendChild(item);
    });
  }

  addEditorCPMKRow() {
    const cpmkContainer = document.getElementById('editor-cpmk-inputs');
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '0.5rem';
    wrapper.style.marginTop = '0.5rem';
    wrapper.innerHTML = `
      <input type="text" name="editor-cpmk-input" class="form-control" placeholder="Describe learning outcome" required>
      <button type="button" onclick="this.parentNode.remove()" class="btn btn-secondary" style="padding: 0.4rem 0.8rem; color: var(--color-danger); border-color:rgba(239,68,68,0.2);"><i class="fa-solid fa-trash"></i></button>
    `;
    cpmkContainer.appendChild(wrapper);
  }

  async saveCourseEdits() {
    const c = this.state.activeCourse;
    if (!c) return;

    // Collect CPMK inputs
    const cpmkNodes = document.querySelectorAll('input[name="editor-cpmk-input"]');
    const cpmk = Array.from(cpmkNodes).map(n => n.value.trim()).filter(val => val !== '');

    // Collect Rubric inputs
    const rubNames = document.querySelectorAll('input[name="editor-rubric-name"]');
    const rubDescs = document.querySelectorAll('input[name="editor-rubric-desc"]');
    const rubMaxs = document.querySelectorAll('input[name="editor-rubric-max"]');
    
    const rubrics = [];
    rubNames.forEach((n, idx) => {
      rubrics.push({
        criteriaName: n.value.trim(),
        description: rubDescs[idx].value.trim(),
        maxScore: Number(rubMaxs[idx].value) || 20
      });
    });

    // Update Weeks topics
    c.weeks.forEach(week => {
      const topicNode = document.querySelector(`input[name="editor-week-topic-${week.weekNum}"]`);
      const subNode = document.querySelector(`input[name="editor-week-sub-${week.weekNum}"]`);
      const bloomNode = document.querySelector(`select[name="editor-week-bloom-${week.weekNum}"]`);

      if (topicNode) week.topic = topicNode.value.trim();
      if (subNode) week.subtopic = subNode.value.trim();
      if (bloomNode) week.bloomTaxonomy = bloomNode.value;
    });

    c.cpmk = cpmk;
    c.essayRubrics = rubrics;

    await lmsService.saveCourse(c.courseId, c);
    this.showToast('Course updates successfully saved to Firestore!', 'success');
  }

  // --- Lecturer Grading Tab List ---
  renderLecturerGradingList() {
    const list = document.getElementById('dash-submissions-list');
    const inspector = document.getElementById('dash-grading-inspector');

    if (!list) return;

    if (this.state.submissions.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 5rem;">No student answers found.</div>';
      return;
    }

    list.innerHTML = '';
    this.state.submissions.forEach(sub => {
      const div = document.createElement('div');
      div.style.padding = '0.75rem 1rem';
      div.style.background = 'rgba(255,255,255,0.02)';
      div.style.borderRadius = '8px';
      div.style.cursor = 'pointer';
      div.style.border = '1px solid var(--border-color)';
      div.style.transition = 'var(--transition-smooth)';
      div.style.marginBottom = '0.5rem';

      div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
      div.onmouseout = () => div.style.background = 'rgba(255,255,255,0.02)';
      div.onclick = () => this.renderGradingInspectorDetails(sub.submissionId, 'dash-grading-inspector');

      const score = sub.evaluation?.score !== undefined ? sub.evaluation.score : 'N/A';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span style="font-size: 0.85rem; font-weight: 600; color: white;">${sub.studentName}</span>
          <span style="font-size: 0.8rem; color: var(--accent-teal); font-weight: bold;">Score: ${score}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary);">
          <span>Week ${sub.weekNum} - ${sub.type.toUpperCase()}</span>
          <span>${new Date(sub.submittedAt).toLocaleDateString()}</span>
        </div>
      `;
      list.appendChild(div);
    });

    this.renderGradingInspectorDetails(this.state.submissions[0].submissionId, 'dash-grading-inspector');
  }

  // --- Grader Inspector details helper ---
  renderGradingInspectorDetails(subId, inspectorId) {
    const inspector = document.getElementById(inspectorId);
    const sub = this.state.submissions.find(s => s.submissionId === subId);

    if (!inspector || !sub) return;

    const evalData = sub.evaluation || {};
    const criteriaGrades = evalData.criteriaGrades || [];
    const cpmkOutcomes = evalData.cpmkOutcomes || [];

    inspector.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="font-size: 1.15rem; color: white;">${sub.studentName}</h3>
          <p style="font-size: 0.75rem; color: var(--text-secondary);">Week ${sub.weekNum} Evaluation: ${sub.type.toUpperCase()}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-teal); font-family: var(--font-title);">${evalData.score || 0}</div>
          <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">AI Evaluation</span>
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.5rem;">Submitted Response:</h4>
        <div style="padding: 0.75rem; background: rgba(0,0,0,0.25); border-radius: 6px; font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line; line-height: 1.45; border: 1px solid var(--border-color);">
          ${typeof sub.answers === 'object' ? JSON.stringify(sub.answers, null, 2) : sub.answers}
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.5rem;"><i class="fa-solid fa-list-check" style="color: var(--accent-indigo);"></i> Criteria Assessment Breakdown</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${
            criteriaGrades.length > 0
              ? criteriaGrades.map(crit => `
                <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 0.65rem; border-radius: 6px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem; font-size:0.8rem;">
                    <span style="font-weight: bold; color: white;">${crit.criteriaName}</span>
                    <span style="color: var(--accent-teal); font-weight: bold;">${crit.score} / ${crit.maxScore}</span>
                  </div>
                  <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.35;">${crit.comment}</p>
                </div>
              `).join('')
              : '<p style="font-size: 0.75rem; color: var(--text-muted);">No criteria ratings.</p>'
          }
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i> Outcomes Attainment</h4>
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          ${
            cpmkOutcomes.length > 0
              ? cpmkOutcomes.map(out => `
                <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--text-secondary);">
                  <i class="fa-solid ${out.attained ? 'fa-square-check' : 'fa-square'}" style="color: ${out.attained ? 'var(--color-success)' : 'var(--text-muted)'}; font-size: 0.9rem;"></i>
                  <span>${out.outcome}</span>
                </div>
              `).join('')
              : '<p style="font-size: 0.75rem; color: var(--text-muted);">No goals logs verified.</p>'
          }
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 1rem;">
        <h4 style="font-size: 0.85rem; color: white; margin-bottom: 0.4rem;"><i class="fa-solid fa-comment-dots" style="color: var(--accent-pink);"></i> Tutor Suggestions</h4>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; font-style: italic;">
          "${evalData.feedback || 'Answer satisfies scope parameters.'}"
        </p>
      </div>
    `;
  }

  // --- Chart.js Visual Drawings ---
  drawChartJsGraphics() {
    const radarCtx = document.getElementById('cpmkRadarChart')?.getContext('2d');
    const barCtx = document.getElementById('scoresBarChart')?.getContext('2d');

    if (!radarCtx || !barCtx) return;

    // Destroy existing charts
    if (this.state.cpmkChart) this.state.cpmkChart.destroy();
    if (this.state.scoresChart) this.state.scoresChart.destroy();

    const course = this.state.activeCourse;
    const subs = this.state.submissions;

    // 1. Radar Chart data (CPMK Attainment)
    // Gather average attainment percents for each CPMK
    const labels = (course.cpmk || []).map((_, idx) => `CPMK ${idx + 1}`);
    const dataValues = (course.cpmk || []).map((cpmkVal) => {
      // Simulate attainment score based on submissions matching outcomes
      const relatedSubs = subs.filter(s => s.evaluation?.cpmkOutcomes?.some(out => out.attained));
      const matchPct = subs.length > 0 ? Math.round((relatedSubs.length / subs.length) * 100) : 75; // Default demo baseline
      return Math.min(100, Math.max(40, matchPct));
    });

    this.state.cpmkChart = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: labels.length > 0 ? labels : ['CPMK 1', 'CPMK 2', 'CPMK 3'],
        datasets: [{
          label: 'Attainment %',
          data: dataValues.length > 0 ? dataValues : [80, 65, 90],
          backgroundColor: 'rgba(20, 184, 166, 0.2)',
          borderColor: 'var(--accent-teal)',
          borderWidth: 2,
          pointBackgroundColor: '#fff'
        }]
      },
      options: {
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#9ca3af' },
            ticks: { display: false, max: 100, min: 0 }
          }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 2. Bar Chart data (Grade Distributions)
    const scoreBuckets = { '80-100': 0, '60-79': 0, '40-59': 0, '<40': 0 };
    subs.forEach(s => {
      const scr = s.evaluation?.score || 0;
      if (scr >= 80) scoreBuckets['80-100']++;
      else if (scr >= 60) scoreBuckets['60-79']++;
      else if (scr >= 40) scoreBuckets['40-59']++;
      else scoreBuckets['<40']++;
    });

    // Seed mock visual baseline if empty
    const distributionValues = subs.length > 0 
      ? Object.values(scoreBuckets)
      : [4, 2, 1, 0];

    this.state.scoresChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(scoreBuckets),
        datasets: [{
          label: 'Number of Submissions',
          data: distributionValues,
          backgroundColor: [
            'rgba(16, 185, 129, 0.65)', // Success
            'rgba(99, 102, 241, 0.65)', // Indigo
            'rgba(245, 158, 11, 0.65)', // Warning
            'rgba(239, 68, 68, 0.65)'   // Danger
          ],
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', stepSize: 1 } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // --- LENTERA Embed copying ---
  copyLMSIntegration() {
    if (!this.state.activeCourse) {
      this.showToast('Please select a course first', 'error');
      return;
    }
    const embedUrl = `${window.location.origin}/lms.html?id=${this.state.activeCourse.courseId}`;
    const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" allow="camera; microphone; fullscreen"></iframe>`;

    navigator.clipboard.writeText(iframeCode).then(() => {
      this.showToast('LENTERA / LMS Iframe Embed code copied to clipboard!', 'success');
    }).catch(err => {
      this.showToast('Failed to copy. URL: ' + embedUrl, 'error');
    });
  }

  // --- Local file dropzone bindings ---
  bindDropzone() {
    const dropzone = document.getElementById('dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-teal)';
        dropzone.style.background = 'rgba(20, 184, 166, 0.05)';
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'rgba(255,255,255,0.01)';
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) this.processUploadedFile(files[0]);
    });
  }

  handleFileSelected(event) {
    const file = event.target.files[0];
    if (file) this.processUploadedFile(file);
  }

  processUploadedFile(file) {
    this.state.selectedFile = file;
    const txtNode = document.getElementById('dropzone-text');
    if (txtNode) {
      txtNode.innerHTML = `<strong>Loaded:</strong> ${file.name}<br><span style="font-size:0.75rem; color:var(--text-secondary);">${(file.size / 1024 / 1024).toFixed(2)} MB</span>`;
    }

    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.state.selectedFileText = e.target.result;
      };
      reader.readAsText(file);
    } else {
      this.state.selectedFileText = `Loaded: ${file.name}. (Requires backend buffer parse API)`;
    }
    this.showToast('Syllabus document loaded successfully.', 'success');
  }

  // --- API Curriculum Generator ---
  async handleCurriculumGeneration(event) {
    event.preventDefault();
    const courseName = document.getElementById('course-name-input').value.trim();
    const courseId = document.getElementById('course-id-input').value.trim();
    const additionalPrompt = document.getElementById('additional-prompt-input').value.trim();
    const file = this.state.selectedFile;

    if (!file) {
      this.showToast('Syllabus document file is required.', 'error');
      return;
    }

    const loader = document.getElementById('generation-loader');
    const form = document.getElementById('create-course-form');
    const progress = document.getElementById('loader-progress-bar');
    const status = document.getElementById('loader-status-text');

    if (form) form.style.display = 'none';
    if (loader) loader.style.display = 'block';
    if (progress) progress.style.width = '10%';

    try {
      let rpsText = this.state.selectedFileText;
      let curriculum = null;

      // 1. Post to Express parser
      status.textContent = 'Extracting syllabus text buffers...';
      if (progress) progress.style.width = '35%';

      try {
        const formData = new FormData();
        formData.append('file', file);

        const parseRes = await fetch('/api/parse-rps', {
          method: 'POST',
          body: formData,
        });

        if (parseRes.ok) {
          const parseData = await parseRes.json();
          rpsText = parseData.text;
        }
      } catch (err) {
        console.warn('API parsing unavailable. Reading file client-side.');
      }

      // 2. Generate curriculum
      status.textContent = 'Orchestrating 16-Week syllabus structures with Gemini AI...';
      if (progress) progress.style.width = '65%';

      const keys = this.getCustomKeys();

      try {
        const genRes = await fetch('/api/generate-curriculum', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courseName,
            courseId,
            rpsText,
            additionalPrompt,
            apiKey: keys.geminiKey || '',
            ytApiKey: keys.ytKey || ''
          })
        });

        if (genRes.ok) {
          curriculum = await genRes.json();
        } else {
          const errData = await genRes.json();
          throw new Error(errData.error || 'Failed backend gen.');
        }
      } catch (genErr) {
        console.warn('API generator unavailable. Attempting direct browser AI request or mock compiler fallback...', genErr);

        if (keys.geminiKey) {
          this.showToast('Backend offline. Connecting directly to Gemini API from browser...', 'info');
          curriculum = await this.generateCurriculumClientSide(courseName, rpsText, additionalPrompt, keys.geminiKey);
        } else {
          this.showToast('No Gemini API Key found. Generating dynamic mock curriculum template locally...', 'info');
          curriculum = this.simulateCurriculumLocally(courseName, rpsText);
        }

        // Save locally to mock database
        const record = {
          ...curriculum,
          courseId,
          lecturerId: this.state.activeUser.uid,
          lecturerName: this.state.activeUser.name,
          createdAt: new Date().toISOString()
        };
        await lmsService.saveCourse(courseId, record);
      }

      if (progress) progress.style.width = '100%';
      this.showToast('Curriculum syllabus micro-site generated!', 'success');
      
      // Clear
      if (form) form.reset();
      this.state.selectedFile = null;

      // Redirect to newly generated classroom micro-site!
      setTimeout(() => {
        window.location.href = `lms.html?id=${courseId}`;
      }, 1500);

    } catch (error) {
      console.error(error);
      this.showToast(error.message, 'error');
      if (form) form.style.display = 'block';
      if (loader) loader.style.display = 'none';
    }
  }

  // Gemini direct browser caller fallback
  async generateCurriculumClientSide(courseName, rpsText, additionalPrompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const systemInstruction = `
      You are AU Learning AI. Build a structured 16-week syllabus matching this JSON schema EXACTLY:
      {
        "courseName": "Name",
        "cpl": ["Outcome 1"],
        "cpmk": ["Outcome 2"],
        "essayRubrics": [
          { "criteriaName": "Content Quality", "description": "depth", "maxScore": 50 },
          { "criteriaName": "Analysis Accuracy", "description": "accuracy", "maxScore": 50 }
        ],
        "weeks": [
          {
            "weekNum": 1,
            "topic": "Topic Name",
            "subtopic": "Subtopic details",
            "learningMethod": "Method",
            "bloomTaxonomy": "Choose: Remember, Understand, Apply, Analyze, Evaluate, Create",
            "youtubeSearchQuery": "Video search query",
            "assignments": [
              {
                "type": "essay",
                "prompt": "Essay prompt description."
              }
            ]
          }
        ]
      }
      Rules: Respond exactly with 16 weeks. Midterm is Week 8 (UTS) and Final is Week 16 (UAS), both containing UTS/UAS questions banks. Respond ONLY with raw JSON, no markdown fences.
    `;

    const body = {
      contents: [{ parts: [{ text: `Course: ${courseName}\nDirectives: ${additionalPrompt}\nSyllabus:\n${rpsText}` }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gemini browser call failed.');
    }

    const data = await res.json();
    return JSON.parse(data.candidates[0].content.parts[0].text.trim());
  }

  simulateCurriculumLocally(courseName, rpsText) {
    const weeks = [];
    const topics = [
      "Introduction & Fundamental Architecture Principles",
      "Historical Evolution & Design Patterns",
      "Client-Server Syncing Bridges",
      "Database Modeling: NoSQL Document Stores",
      "Document Parsing Pipelines & Buffer Streams",
      "Structured Outputs JSON API specifications",
      "Automated Question Generation",
      "UTS (Midterm Assessment Exam)",
      "Cognitive Modeling & AI Tool Chains",
      "Multi-peer WebRTC Video integrations",
      "Dynamic attendance broadcast polling",
      "Client UI designs: Bento layout grids",
      "Glassmorphism glass panels overlays",
      "Report generation: Excel & PDF compilers",
      "LMS integration embeds (LENTERA compatibility)",
      "UAS (Final Assessment Capstone Presentation)"
    ];

    for (let i = 1; i <= 16; i++) {
      const topic = topics[i - 1];
      const isExam = i === 8 || i === 16;
      weeks.push({
        weekNum: i,
        topic,
        subtopic: isExam ? "Assessment evaluation covers module lessons." : `Core concepts and labs relating to ${topic}.`,
        learningMethod: isExam ? "Proctored Exam" : "Lecture Discussion & Coding Lab",
        bloomTaxonomy: isExam ? "Evaluate" : i <= 4 ? "Understand" : i <= 10 ? "Apply" : "Analyze",
        youtubeSearchQuery: `${courseName} ${topic}`,
        assignments: [
          isExam ? {
            type: "essay",
            prompt: `Write a comprehensive system integration review document addressing weeks 1 to ${i-1} topics.`
          } : {
            type: "quiz",
            prompt: `Week ${i} Concept Check`,
            quizQuestions: [
              {
                question: `What is the primary constraint of ${topic}?`,
                options: ["Low memory storage", "High latency networking", "Scalable data bindings", "None of the above"],
                correctOptionIndex: 2
              }
            ]
          },
          {
            type: "essay",
            prompt: isExam ? `Submit your final implementation design files for ${courseName}.` : `Write a reflective study report addressing the tradeoffs of ${topic}.`
          }
        ]
      });
    }

    return {
      courseName,
      cpl: [
        "Articulate core definitions of edtech integrations",
        "Formulate scalable AI-grader evaluation rules",
        "Design unified classroom communication nodes"
      ],
      cpmk: [
        "Create modern glassmorphism bento grids",
        "Develop Firestore cloud-admin data syncing modules",
        "Integrate LLM structured responses using responseSchema"
      ],
      essayRubrics: [
        { criteriaName: "Technical Structure", description: "Correct configurations", maxScore: 50 },
        { criteriaName: "Conceptual Clarity", description: "Clear explanations", maxScore: 50 }
      ],
      weeks
    };
  }

  // --- Student Enrollment Join ---
  async enrollInCourse() {
    const codeNode = document.getElementById('join-course-id');
    const code = codeNode?.value.trim();

    if (!code) {
      this.showToast('Please enter a course code', 'error');
      return;
    }

    const course = await lmsService.getCourse(code);
    if (!course) {
      this.showToast('Course code details not found in directory.', 'error');
      return;
    }

    const enrolledIds = JSON.parse(localStorage.getItem(`enrolled_${this.state.activeUser.uid}`) || '[]');
    if (enrolledIds.includes(code)) {
      this.showToast('You are already enrolled in this course.', 'error');
      return;
    }

    enrolledIds.push(code);
    localStorage.setItem(`enrolled_${this.state.activeUser.uid}`, JSON.stringify(enrolledIds));

    codeNode.value = '';
    this.showToast(`Successfully enrolled in ${course.courseName}!`, 'success');
    this.loadIndexViews();
  }

  // --- Floating Attendance listeners ---
  setupStudentPollListener(courseId) {
    if (this.pollUnsubscribe) this.pollUnsubscribe();

    this.pollUnsubscribe = lmsService.subscribeToAttendance(courseId, (activePoll) => {
      const banner = document.getElementById('live-poll-banner');
      const questionEl = document.getElementById('student-poll-question');
      const timerEl = document.getElementById('student-poll-time');
      const barEl = document.getElementById('poll-timer-bar');

      if (!banner || !activePoll) {
        if (banner) banner.classList.remove('show');
        return;
      }

      if (activePoll.attendees && activePoll.attendees[this.state.activeUser.uid]) {
        banner.classList.remove('show');
        return;
      }

      const totalSecs = Math.round((new Date(activePoll.endsAt).getTime() - new Date(activePoll.createdAt).getTime()) / 1000);
      const remains = Math.max(0, Math.round((new Date(activePoll.endsAt).getTime() - new Date().getTime()) / 1000));

      if (remains <= 0) {
        banner.classList.remove('show');
        return;
      }

      questionEl.textContent = activePoll.sessionName;
      timerEl.textContent = `${remains}s`;
      banner.classList.add('show');

      if (barEl) {
        barEl.style.transition = 'none';
        barEl.style.width = `${(remains / totalSecs) * 100}%`;
        setTimeout(() => {
          barEl.style.transition = `width ${remains}s linear`;
          barEl.style.width = '0%';
        }, 50);
      }

      let studentRemains = remains;
      const tick = () => {
        studentRemains--;
        if (studentRemains <= 0) {
          banner.classList.remove('show');
          clearInterval(this.studentTimer);
        } else {
          timerEl.textContent = `${studentRemains}s`;
        }
      };

      if (this.studentTimer) clearInterval(this.studentTimer);
      this.studentTimer = setInterval(tick, 1000);

      this.state.studentPollId = activePoll.attendanceId;
    });
  }

  async submitStudentAttendance(present) {
    const banner = document.getElementById('live-poll-banner');
    if (banner) banner.classList.remove('show');
    if (this.studentTimer) clearInterval(this.studentTimer);

    const pollId = this.state.studentPollId;
    if (!pollId) return;

    try {
      const poll = await lmsService.getAttendance(pollId);
      if (!poll) return;

      if (!poll.attendees) poll.attendees = {};
      poll.attendees[this.state.activeUser.uid] = {
        studentName: this.state.activeUser.name,
        timestamp: new Date().toISOString()
      };

      await lmsService.saveAttendance(pollId, poll);
      this.showToast('Attendance successfully logged in database!', 'success');
      this.renderLmsAttendanceRate();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderLmsAttendanceRate() {
    const display = document.getElementById('lms-webrtc-attendance-pct');
    if (!display || !this.state.activeCourse) return;

    const allAtts = JSON.parse(localStorage.getItem('au_lms_attendance') || '[]')
      .filter(a => a.courseId === this.state.activeCourse.courseId);

    let verified = 0;
    allAtts.forEach(a => {
      if (a.attendees && a.attendees[this.state.activeUser.uid]) verified++;
    });

    const rate = allAtts.length > 0 ? Math.round((verified / allAtts.length) * 100) : 100;
    display.textContent = `${rate}%`;
  }

  // --- Homework submitting modals ---
  openAssignmentModal(weekNum, assignmentIndex) {
    const modal = document.getElementById('assignment-modal');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-assignment-description');
    const inputContainer = document.getElementById('modal-input-container');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (!modal) return;

    const week = this.state.activeCourse.weeks.find(w => w.weekNum === weekNum);
    const assignment = week.assignments[assignmentIndex];

    this.state.activeModalAssignment = { weekNum, assignmentIndex, assignment };

    title.textContent = `Week ${weekNum} Task: ${assignment.prompt}`;
    desc.textContent = `Submit your assessment response. Your essay answers are instantly verified by AI using Gemini.`;

    const sub = this.state.submissions.find(s => s.weekNum === weekNum && s.assignmentIndex === assignmentIndex);

    if (assignment.type === 'quiz') {
      let questionsHtml = '';
      const questions = assignment.quizQuestions || [];
      questions.forEach((q, qIdx) => {
        questionsHtml += `
          <div style="margin-bottom: 1.25rem; border:1px solid var(--border-color); padding: 1rem; border-radius:6px; background:rgba(0,0,0,0.15);">
            <p style="font-weight:600; color:white; font-size:0.9rem; margin-bottom:0.75rem;">Q${qIdx+1}: ${q.question}</p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${q.options.map((opt, oIdx) => {
                const checked = sub && Number(sub.answers[qIdx]) === oIdx ? 'checked' : '';
                const disabled = sub ? 'disabled' : '';
                return `
                  <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary); cursor:pointer;">
                    <input type="radio" name="quiz_q_${qIdx}" value="${oIdx}" ${checked} ${disabled}>
                    <span>${opt}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });
      inputContainer.innerHTML = questionsHtml;
    } else {
      const answerVal = sub ? sub.answers : '';
      const disabled = sub ? 'readonly' : '';
      inputContainer.innerHTML = `
        <div class="form-group">
          <label>Write Essay Answer</label>
          <textarea id="modal-essay-answer" class="form-control" style="height:180px; resize:vertical;" placeholder="Write response details..." ${disabled}>${answerVal}</textarea>
        </div>
      `;
    }

    submitBtn.style.display = sub ? 'none' : 'inline-flex';
    modal.classList.add('show');
  }

  closeAssignmentModal() {
    const modal = document.getElementById('assignment-modal');
    if (modal) modal.classList.remove('show');
    this.state.activeModalAssignment = null;
  }

  async submitAssignmentFromModal() {
    const context = this.state.activeModalAssignment;
    if (!context) return;

    const { weekNum, assignmentIndex, assignment } = context;
    const course = this.state.activeCourse;
    const isQuiz = assignment.type === 'quiz';
    let answers = null;

    if (isQuiz) {
      answers = [];
      const questions = assignment.quizQuestions || [];
      for (let i = 0; i < questions.length; i++) {
        const checked = document.querySelector(`input[name="quiz_q_${i}"]:checked`);
        if (!checked) {
          this.showToast('Please answer all questions', 'error');
          return;
        }
        answers.push(checked.value);
      }
    } else {
      const textVal = document.getElementById('modal-essay-answer').value.trim();
      if (!textVal) {
        this.showToast('Answer input is required', 'error');
        return;
      }
      answers = textVal;
    }

    const submitBtn = document.getElementById('modal-submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Evaluation grading...';

    try {
      let evaluation = {};

      if (isQuiz) {
        let correct = 0;
        const details = [];
        assignment.quizQuestions.forEach((q, idx) => {
          const isCorrect = Number(answers[idx]) === q.correctOptionIndex;
          if (isCorrect) correct++;
          details.push({
            criteriaName: `Q${idx+1}`,
            maxScore: 1,
            score: isCorrect ? 1 : 0,
            comment: isCorrect ? 'Correct.' : `Incorrect. Correct: ${q.options[q.correctOptionIndex]}`
          });
        });
        const score = Math.round((correct / assignment.quizQuestions.length) * 100);
        evaluation = {
          score,
          feedback: `Scored ${correct} correct answers out of ${assignment.quizQuestions.length}.`,
          criteriaGrades: details,
          cpmkOutcomes: [{ outcome: `Understanding Week ${weekNum} basics`, attained: score >= 60 }]
        };
      } else {
        // Post to backend grader
        const keys = this.getCustomKeys();
        
        try {
          const res = await fetch('/api/grade-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentName: this.state.activeUser.name,
              studentId: this.state.activeUser.uid,
              email: this.state.activeUser.email,
              courseId: course.courseId,
              courseName: course.courseName,
              weekNum,
              assignmentIndex,
              topic: course.weeks.find(w => w.weekNum === weekNum).topic,
              assignmentPrompt: assignment.prompt,
              studentAnswer: answers,
              rubrics: course.essayRubrics,
              apiKey: keys.geminiKey || ''
            })
          });

          if (res.ok) {
            const gradedSub = await res.json();
            evaluation = gradedSub.evaluation;
          } else {
            throw new Error('API Grader failed.');
          }
        } catch (err) {
          console.warn('API Grader offline. Processing client fallback evaluation.', err.message);
          if (keys.geminiKey) {
            evaluation = await this.gradeEssayClientSide(course.courseName, weekNum, course.weeks.find(w => w.weekNum === weekNum).topic, assignment.prompt, answers, course.essayRubrics, keys.geminiKey);
          } else {
            evaluation = this.simulateGradingLocally(assignment.prompt, answers, course.essayRubrics);
          }
        }
      }

      // Save submission client-side locally in mock DB if api offline
      const submissionId = 'sub_' + Math.random().toString(36).substr(2, 9);
      const submissionData = {
        courseId: course.courseId,
        studentId: this.state.activeUser.uid,
        studentName: this.state.activeUser.name,
        email: this.state.activeUser.email,
        weekNum,
        assignmentIndex,
        type: assignment.type,
        answers,
        evaluation
      };
      await lmsService.saveSubmission(submissionId, submissionData);

      this.showToast(`Submission graded successfully! Score: ${evaluation.score}`, 'success');
      this.closeAssignmentModal();

      // Refresh student sub lists
      const subs = await lmsService.getSubmissionsByCourse(course.courseId);
      this.state.submissions = subs.filter(s => s.studentId === this.state.activeUser.uid);
      this.renderLmsCurriculum();
    } catch (e) {
      console.error(e);
      this.showToast(e.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  async gradeEssayClientSide(courseName, weekNum, topic, prompt, answer, rubrics, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const systemInstruction = `
      You are professor AU Grader. Assess the essay against the rubrics.
      Respond EXACTLY in this JSON structure:
      {
        "score": 90,
        "feedback": "constructive feedback text",
        "criteriaGrades": [
          { "criteriaName": "Content", "maxScore": 50, "score": 45, "comment": "good" }
        ],
        "cpmkOutcomes": [
          { "outcome": "learning objective verified", "attained": true }
        ]
      }
      Rule: Total score must equal the sum of all individual criteria scores. No markdown, output only raw JSON.
    `;

    const userPrompt = `
      Course: ${courseName}
      Week: ${weekNum}
      Topic: ${topic}
      Prompt: ${prompt}
      Student Answer: ${answer}
      Rubrics: ${JSON.stringify(rubrics)}
    `;

    const body = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('Client-side AI grader query failed.');
    const d = await res.json();
    return JSON.parse(d.candidates[0].content.parts[0].text.trim());
  }

  simulateGradingLocally(prompt, answer, rubrics) {
    const wordCount = answer.split(/\s+/).length;
    let base = 65;
    if (wordCount > 130) base += 20;
    else if (wordCount > 50) base += 10;
    else base -= 20;

    const buzzwords = ["architecture", "scale", "system", "syncing", "webrtc", "gemini", "firestore", "parser", "curriculum"];
    let points = 0;
    buzzwords.forEach(w => {
      if (answer.toLowerCase().includes(w)) points += 2;
    });

    const pct = Math.min(100, Math.max(30, base + points));
    const grades = rubrics.map(r => ({
      criteriaName: r.criteriaName,
      maxScore: r.maxScore,
      score: Math.round((pct / 100) * r.maxScore),
      comment: `Coverage of concepts matches standard evaluation levels (local heuristic verification: ${pct}% attainment).`
    }));

    const totalScore = grades.reduce((acc, g) => acc + g.score, 0);

    return {
      score: totalScore,
      feedback: `Local heuristic grader: Submission contains ${wordCount} words. Attach an API key in configuration for detailed semantic grading profiles.`,
      criteriaGrades: grades,
      cpmkOutcomes: [{ outcome: "Demonstrated topic outline capabilities", attained: pct >= 60 }]
    };
  }

  // --- Real-time Attendance broadcasting (Lecturer) ---
  async handleStartPoll(event) {
    event.preventDefault();
    if (!this.state.activeCourse) return;

    const question = document.getElementById('poll-question').value;
    const duration = Number(document.getElementById('poll-duration').value);

    const now = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000).toISOString();
    const pollId = 'poll_' + Math.random().toString(36).substr(2, 9);

    const activePoll = {
      attendanceId: pollId,
      courseId: this.state.activeCourse.courseId,
      sessionName: question,
      active: true,
      endsAt,
      attendees: {},
      createdAt: now.toISOString()
    };

    await lmsService.saveAttendance(pollId, activePoll);
    this.state.activePoll = activePoll;

    document.getElementById('active-poll-details').style.display = 'block';
    document.getElementById('active-poll-name').textContent = question;

    this.startPollCountdown(duration);
    this.showToast('Micro-poll verification broadcasted successfully.', 'success');
    this.listenToAttendeesUpdates(pollId);
  }

  startPollCountdown(duration) {
    this.state.pollCountdown = duration;
    const display = document.getElementById('active-poll-timer');

    if (this.timerInterval) clearInterval(this.timerInterval);

    const tick = () => {
      if (this.state.pollCountdown <= 0) {
        clearInterval(this.timerInterval);
        this.stopActivePoll();
        return;
      }
      this.state.pollCountdown--;
      display.textContent = `00:${this.state.pollCountdown < 10 ? '0' : ''}${this.state.pollCountdown}`;
    };

    display.textContent = `00:${duration < 10 ? '0' : ''}${duration}`;
    this.timerInterval = setInterval(tick, 1000);
  }

  async stopActivePoll() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const details = document.getElementById('active-poll-details');
    if (details) details.style.display = 'none';

    if (this.state.activePoll) {
      const poll = await lmsService.getAttendance(this.state.activePoll.attendanceId);
      if (poll) {
        poll.active = false;
        await lmsService.saveAttendance(poll.attendanceId, poll);
      }
      this.state.activePoll = null;
    }
    this.showToast('Broadcast closed.', 'info');
  }

  listenToAttendeesUpdates(pollId) {
    const list = document.getElementById('live-attendees-list');
    const countEl = document.getElementById('attendee-count');

    const checkUpdates = async () => {
      const poll = await lmsService.getAttendance(pollId);
      if (!poll || !poll.attendees) return;

      const keys = Object.keys(poll.attendees);
      if (countEl) countEl.textContent = keys.length;

      if (keys.length === 0) {
        if (list) list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 5rem;">Awaiting confirmations...</div>';
      } else {
        if (list) {
          list.innerHTML = '';
          keys.forEach((uid) => {
            const row = document.createElement('div');
            row.style.padding = '0.5rem 1rem';
            row.style.background = 'rgba(20, 184, 166, 0.05)';
            row.style.border = '1px solid rgba(20, 184, 166, 0.2)';
            row.style.borderRadius = '6px';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.marginBottom = '0.5rem';
            row.innerHTML = `
              <span style="font-size: 0.85rem; font-weight: bold; color: white;">${poll.attendees[uid].studentName}</span>
              <span style="font-size: 0.7rem; color: var(--accent-teal);"><i class="fa-solid fa-check-double"></i> Verified</span>
            `;
            list.appendChild(row);
          });
        }
      }
    };

    checkUpdates();
    const updater = setInterval(() => {
      if (!this.state.activePoll) {
        clearInterval(updater);
        return;
      }
      checkUpdates();
    }, 1000);
  }

  async loadLiveAttendanceSession() {
    if (!this.state.activeCourse) return;
    const active = await lmsService.getActiveAttendance(this.state.activeCourse.courseId);
    if (active) {
      this.state.activePoll = active;
      const details = document.getElementById('active-poll-details');
      const name = document.getElementById('active-poll-name');
      if (details) details.style.display = 'block';
      if (name) name.textContent = active.sessionName;

      const remains = Math.max(0, Math.round((new Date(active.endsAt).getTime() - new Date().getTime()) / 1000));
      this.startPollCountdown(remains);
      this.listenToAttendeesUpdates(active.attendanceId);
    } else {
      const details = document.getElementById('active-poll-details');
      const list = document.getElementById('live-attendees-list');
      const countEl = document.getElementById('attendee-count');

      if (details) details.style.display = 'none';
      if (list) list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 5rem;">No attendance sessions active. Try launching a micro-poll.</div>';
      if (countEl) countEl.textContent = '0';
    }
  }

  // --- Excel & PDF Exports ---
  async exportReport(type) {
    if (!this.state.activeCourse) {
      this.showToast('Please select a course', 'error');
      return;
    }

    this.showToast(`Generating ${type.toUpperCase()} report...`, 'info');

    const course = this.state.activeCourse;
    const subs = await lmsService.getSubmissionsByCourse(course.courseId);

    const stdMap = {};

    subs.forEach(s => {
      if (!stdMap[s.studentId]) {
        stdMap[s.studentId] = {
          name: s.studentName,
          email: s.email,
          submissionsCount: 0,
          scoresSum: 0,
          attendanceCount: 0,
          attendanceRate: 100
        };
      }
      stdMap[s.studentId].submissionsCount++;
      stdMap[s.studentId].scoresSum += s.evaluation?.score || 0;
    });

    const allAtts = JSON.parse(localStorage.getItem('au_lms_attendance') || '[]')
      .filter(a => a.courseId === course.courseId);

    Object.keys(stdMap).forEach(sid => {
      const studentObj = stdMap[sid];
      let presences = 0;
      allAtts.forEach(a => {
        if (a.attendees && a.attendees[sid]) presences++;
      });
      studentObj.attendanceCount = presences;
      studentObj.attendanceRate = allAtts.length > 0 ? Math.round((presences / allAtts.length) * 100) : 100;
      studentObj.avgScore = studentObj.submissionsCount > 0 ? Math.round(studentObj.scoresSum / studentObj.submissionsCount) : 0;
    });

    const studentData = Object.values(stdMap);

    try {
      const res = await fetch('/api/export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: course.courseName,
          type,
          studentData,
          attendanceLogs: allAtts
        })
      });

      if (!res.ok) throw new Error('Compiler failed.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${course.courseName.replace(/\s+/g, '_')}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      this.showToast('Report downloaded successfully.', 'success');
    } catch (e) {
      console.warn('API export offline. Downloading CSV local copy.', e.message);

      let csv = 'data:text/csv;charset=utf-8,Name,Email,Submissions,Attendance count,Attendance Rate,Average Score\n';
      studentData.forEach(row => {
        csv += `"${row.name}","${row.email}",${row.submissionsCount},${row.attendanceCount},${row.attendanceRate}%,${row.avgScore}\n`;
      });
      const a = document.createElement('a');
      a.setAttribute('href', encodeURI(csv));
      a.setAttribute('download', `Report_${course.courseName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      this.showToast('Local CSV report copy generated successfully.', 'success');
    }
  }

  // Settings
  getCustomKeys() {
    return {
      geminiKey: localStorage.getItem('au_lms_gemini_key'),
      ytKey: localStorage.getItem('au_lms_yt_key')
    };
  }
}

// Global router instantiation
window.addEventListener('DOMContentLoaded', () => {
  window.appRouter = new AppRouter();
});
