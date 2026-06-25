// js/app.js
// Orchestrates view-routing, global events, theme toggle, and registers component listeners

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Initialize DB and Seed data
  AppDB.initialize();

  // Initialize Lucide icons
  lucide.createIcons();

  // 2. Global State Variables
  let currentView = 'dashboard';

  // 3. Time Ticker in Header
  const updateClock = () => {
    const timeIndicator = document.getElementById('currentTimeIndicator');
    if (timeIndicator) {
      const now = new Date();
      timeIndicator.textContent = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      });
    }
  };
  setInterval(updateClock, 1000);
  updateClock();

  // 4. Theme Toggle Logic
  const themeToggleBtn = document.getElementById('themeToggleButton');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  
  const applyTheme = (theme) => {
    const htmlEl = document.documentElement;
    if (theme === 'dark') {
      htmlEl.classList.add('dark');
      themeToggleIcon.setAttribute('data-lucide', 'sun');
    } else {
      htmlEl.classList.remove('dark');
      themeToggleIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons(); // Re-render icon
    
    // Save to local storage
    localStorage.setItem('aura_theme', theme);
    
    // Redraw charts with new grid colors if dashboard is active
    if (typeof AppDashboard !== 'undefined') {
      AppDashboard.redrawCharts();
    }
  };

  // Load saved theme
  const savedTheme = localStorage.getItem('aura_theme') || 'light';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });

  // 5. Sidebar View Router
  const viewTitles = {
    dashboard: { title: 'Overview Dashboard', subtitle: 'Real-time attendance logs & analytics metrics' },
    terminal: { title: 'Attendance Terminal', subtitle: 'Biometric face scanner device' },
    register: { title: 'Register Face Profile', subtitle: 'Link student details and scan biometric descriptors' },
    student: { title: 'Student Portal', subtitle: 'Personal attendance records audit & calendar heatmap' },
    reports: { title: 'Attendance Reports & Logs', subtitle: 'Search, filter, and audit attendance logs' }
  };

  const switchView = (targetView) => {
    if (targetView === currentView) return;

    // Safety: Shut down any running cameras before shifting views
    AppCamera.stopCamera();
    resetScannerUI();
    resetRegistrationUI();
    
    // Student Portal safety logout
    if (currentView === 'student') {
      AppStudent.handleLogout();
    }

    // Hide old view, show new view
    document.getElementById(`view${capitalizeFirst(currentView)}`).classList.remove('active');
    document.getElementById(`view${capitalizeFirst(targetView)}`).classList.add('active');

    // Update Sidebar highlight
    document.querySelector(`.sidebar-menu li[data-view="${currentView}"]`).classList.remove('active');
    document.querySelector(`.sidebar-menu li[data-view="${targetView}"]`).classList.add('active');

    // Update header Title & Subtitle
    document.getElementById('pageTitle').textContent = viewTitles[targetView].title;
    document.getElementById('pageSubtitle').textContent = viewTitles[targetView].subtitle;

    currentView = targetView;

    // Initialize module-specific behaviors on enter
    if (targetView === 'dashboard') {
      AppDashboard.initDashboard();
    } else if (targetView === 'terminal') {
      initTerminalView();
    } else if (targetView === 'reports') {
      AppReports.initReports();
    }
  };

  // Bind sidebar click handlers
  document.querySelectorAll('.sidebar-menu li').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // Helper capitalization
  function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // 6. View Initializer: Dashboard view loads by default
  AppDashboard.initDashboard();


  // =========================================================
  // VIEW HOOK: TERMINAL VIEW LISTENERS & EVENT LOGIC
  // =========================================================
  const btnStartTerminal = document.getElementById('btnStartTerminal');
  const btnStopTerminal = document.getElementById('btnStopTerminal');
  const btnTriggerScan = document.getElementById('btnTriggerScan');
  const simulationSelect = document.getElementById('simulationTestTarget');
  
  const populateSimulationDropdown = () => {
    const students = AppDB.getStudents();
    
    // Keep first two static options (random, unknown) and rebuild student options
    simulationSelect.innerHTML = `
      <option value="random">Auto-detect Random Enrolled Student</option>
      <option value="unknown">Simulate Unregistered Face (Access Denied)</option>
    ` + students.map(s => `
      <option value="${s.rollNo}">${s.name} (${s.rollNo})</option>
    `).join('');
  };

  const initTerminalView = () => {
    populateSimulationDropdown();
    resetScannerUI();
  };

  const resetScannerUI = () => {
    btnStartTerminal.style.display = 'inline-flex';
    btnStopTerminal.style.display = 'none';
    btnTriggerScan.disabled = true;
    document.getElementById('cameraOffOverlay').style.display = 'flex';
    document.getElementById('scannerResultPanel').style.display = 'none';
    document.getElementById('hudScanLine').style.display = 'none';
  };

  btnStartTerminal.addEventListener('click', async () => {
    const video = document.getElementById('terminalVideo');
    const canvas = document.getElementById('terminalHUDCanvas');
    
    document.getElementById('cameraOffOverlay').style.display = 'none';
    btnStartTerminal.disabled = true;
    
    const res = await AppCamera.initCamera(video, canvas);
    
    btnStartTerminal.disabled = false;
    
    if (res.success) {
      btnStartTerminal.style.display = 'none';
      btnStopTerminal.style.display = 'inline-flex';
      btnTriggerScan.disabled = false;
      document.getElementById('hudScanLine').style.display = 'block';
    } else {
      document.getElementById('cameraOffOverlay').style.display = 'flex';
      alert("Unable to open camera feed. Check permissions.");
    }
  });

  btnStopTerminal.addEventListener('click', () => {
    AppCamera.stopCamera();
    resetScannerUI();
  });

  btnTriggerScan.addEventListener('click', () => {
    const testTarget = simulationSelect.value;
    btnTriggerScan.disabled = true;
    simulationSelect.disabled = true;
    document.getElementById('scannerResultPanel').style.display = 'none';

    AppCamera.startScanning(testTarget, (result) => {
      // Re-enable controls
      btnTriggerScan.disabled = false;
      simulationSelect.disabled = false;

      const resultPanel = document.getElementById('scannerResultPanel');
      if (result.success) {
        resultPanel.style.display = 'flex';
        resultPanel.style.borderColor = 'var(--success-border)';
        
        document.getElementById('scannerResultName').textContent = result.student.name;
        document.getElementById('scannerResultRollNo').textContent = result.student.rollNo;
        document.getElementById('scannerResultTime').textContent = result.time;
        
        const statusEl = document.getElementById('scannerResultStatus');
        statusEl.className = 'badge badge-present';
        statusEl.textContent = 'Present';

        const photoEl = document.getElementById('scannerResultPhoto');
        if (result.student.facePhoto) {
          photoEl.innerHTML = `<img src="${result.student.facePhoto}" alt="profile" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
          photoEl.innerHTML = result.student.name.charAt(0);
        }
      } else {
        resultPanel.style.display = 'flex';
        resultPanel.style.borderColor = 'var(--danger-border)';
        
        document.getElementById('scannerResultName').textContent = 'Access Denied';
        document.getElementById('scannerResultRollNo').textContent = 'Face verification failed';
        document.getElementById('scannerResultTime').textContent = '--:--:--';
        
        const statusEl = document.getElementById('scannerResultStatus');
        statusEl.className = 'badge badge-absent';
        statusEl.textContent = 'Unregistered';

        document.getElementById('scannerResultPhoto').innerHTML = '<i data-lucide="shield-alert" style="color:var(--danger)"></i>';
        lucide.createIcons();
      }
    });
  });


  // =========================================================
  // VIEW HOOK: REGISTER VIEW LISTENERS & EVENT LOGIC
  // =========================================================
  const btnStartRegCam = document.getElementById('btnStartRegisterCamera');
  const btnCapturePhoto = document.getElementById('btnCapturePhoto');
  const regForm = document.getElementById('studentRegistrationForm');
  const btnSubmitRegistration = document.getElementById('btnSubmitRegistration');
  
  const resetRegistrationUI = () => {
    btnStartRegCam.style.display = 'inline-flex';
    btnCapturePhoto.style.display = 'none';
    btnCapturePhoto.disabled = true;
    document.getElementById('registerCameraOffOverlay').style.display = 'flex';
    document.getElementById('capturedFacePreview').style.display = 'none';
    document.getElementById('capturedFaceImg').src = '';
    document.getElementById('regFaceData').value = '';
    btnSubmitRegistration.disabled = true;
    regForm.reset();
  };

  btnStartRegCam.addEventListener('click', async () => {
    const video = document.getElementById('registerVideo');
    const canvas = document.getElementById('registerHUDCanvas');
    
    document.getElementById('registerCameraOffOverlay').style.display = 'none';
    btnStartRegCam.disabled = true;

    const res = await AppCamera.initCamera(video, canvas);

    btnStartRegCam.disabled = false;

    if (res.success) {
      btnStartRegCam.style.display = 'none';
      btnCapturePhoto.style.display = 'inline-flex';
      btnCapturePhoto.disabled = false;
    } else {
      document.getElementById('registerCameraOffOverlay').style.display = 'flex';
      alert("Could not access camera.");
    }
  });

  btnCapturePhoto.addEventListener('click', () => {
    const photoData = AppCamera.capturePhoto();
    
    if (photoData) {
      document.getElementById('regFaceData').value = photoData;
      document.getElementById('capturedFaceImg').src = photoData;
      document.getElementById('capturedFacePreview').style.display = 'flex';
      btnSubmitRegistration.disabled = false;
      
      // Stop camera now that photo is taken
      AppCamera.stopCamera();
      btnStartRegCam.style.display = 'inline-flex';
      btnCapturePhoto.style.display = 'none';
      document.getElementById('registerCameraOffOverlay').style.display = 'flex';
    }
  });

  regForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('regName').value;
    const rollNo = document.getElementById('regRollNo').value;
    const className = document.getElementById('regClass').value;
    const facePhoto = document.getElementById('regFaceData').value;

    if (!facePhoto) {
      alert("Please capture a biometric photo map before completing registration.");
      return;
    }

    const res = AppDB.registerStudent(name, rollNo, className, facePhoto);

    if (res.success) {
      // Show Success Modal
      document.getElementById('registrationSuccessModal').classList.add('active');
      
      // Reset Page
      resetRegistrationUI();
      
      // Sync dropdowns
      populateSimulationDropdown();
    } else {
      alert(`Registration failed: ${res.message}`);
    }
  });


  // =========================================================
  // VIEW HOOK: STUDENT PORTAL VIEW LISTENERS & EVENT LOGIC
  // =========================================================
  const inputStudentLogin = document.getElementById('studentLoginRollNo');
  const btnStudentLoginSubmit = document.getElementById('btnStudentLoginSubmit');
  const btnStudentLoginFace = document.getElementById('btnStudentLoginFace');
  const btnStudentLogout = document.getElementById('btnStudentLogout');

  btnStudentLoginSubmit.addEventListener('click', () => {
    const rollNo = inputStudentLogin.value.trim();
    if (rollNo) {
      AppStudent.handleLogin(rollNo);
    }
  });

  inputStudentLogin.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const rollNo = inputStudentLogin.value.trim();
      if (rollNo) {
        AppStudent.handleLogin(rollNo);
      }
    }
  });

  btnStudentLoginFace.addEventListener('click', () => {
    AppStudent.handleFaceLogin();
  });

  btnStudentLogout.addEventListener('click', () => {
    AppStudent.handleLogout();
    inputStudentLogin.value = '';
  });


  // =========================================================
  // VIEW HOOK: REPORTS & AUDIT TABLE LISTENERS
  // =========================================================
  document.getElementById('filterSearch').addEventListener('input', (e) => {
    AppReports.handleFilterChange('search', e.target.value);
  });
  
  document.getElementById('filterClass').addEventListener('change', (e) => {
    AppReports.handleFilterChange('class', e.target.value);
  });

  document.getElementById('filterStatus').addEventListener('change', (e) => {
    AppReports.handleFilterChange('status', e.target.value);
  });

  document.getElementById('filterDate').addEventListener('change', (e) => {
    AppReports.handleFilterChange('date', e.target.value);
  });

  document.getElementById('btnExportCSV').addEventListener('click', () => {
    AppReports.exportCSV();
  });

  // Table pagination links
  document.getElementById('reportFirstPage').addEventListener('click', () => AppReports.changePage('first'));
  document.getElementById('reportPrevPage').addEventListener('click', () => AppReports.changePage('prev'));
  document.getElementById('reportNextPage').addEventListener('click', () => AppReports.changePage('next'));
  document.getElementById('reportLastPage').addEventListener('click', () => AppReports.changePage('last'));
  
});
