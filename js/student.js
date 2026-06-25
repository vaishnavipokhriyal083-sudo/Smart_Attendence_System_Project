// js/student.js
// Handles Student Portal view, lookups, and visual calendar rendering

const AppStudent = (() => {
  let loggedInStudent = null;

  const renderProfile = () => {
    if (!loggedInStudent) return;

    const history = AppDB.getStudentHistory(loggedInStudent.rollNo);
    const summary = history.summary;

    // Profile Details
    const profileImg = document.getElementById('studentProfileImage');
    if (loggedInStudent.facePhoto) {
      profileImg.innerHTML = `<img src="${loggedInStudent.facePhoto}" alt="${loggedInStudent.name}">`;
    } else {
      // First letter placeholder
      const initial = loggedInStudent.name.charAt(0);
      profileImg.innerHTML = initial;
    }

    document.getElementById('studentNameHeader').textContent = loggedInStudent.name;
    document.getElementById('studentClassHeader').textContent = loggedInStudent.class;
    document.getElementById('studentRollNoHeader').textContent = loggedInStudent.rollNo;

    // Stats
    document.getElementById('studentKpiRate').textContent = `${summary.rate}%`;
    document.getElementById('studentKpiPresent').textContent = summary.present;
    document.getElementById('studentKpiLate').textContent = summary.late;
    document.getElementById('studentKpiAbsent').textContent = summary.absent;

    // Status warning pill
    const standingPill = document.getElementById('studentKpiStanding');
    if (summary.rate >= 90) {
      standingPill.textContent = 'Excellent';
      standingPill.className = 'trend-pill positive';
    } else if (summary.rate >= 75) {
      standingPill.textContent = 'Good Standing';
      standingPill.className = 'trend-pill';
      standingPill.style.backgroundColor = 'var(--border-color)';
      standingPill.style.color = 'var(--text-primary)';
    } else {
      standingPill.textContent = 'Attendance Warning';
      standingPill.className = 'trend-pill negative';
    }

    renderCalendarHeatmap(history.logs);
    renderHistoryTable(history.logs);
  };

  const renderCalendarHeatmap = (logs) => {
    const gridEl = document.getElementById('studentCalendarGrid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    // Day Headers (Mon - Fri)
    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      header.textContent = day;
      gridEl.appendChild(header);
    });

    // We will render the last 15 calendar days (excluding weekends) in a grid
    const today = new Date();
    const daysToShow = [];
    let offset = 0;

    while (daysToShow.length < 15) {
      const d = new Date();
      d.setDate(today.getDate() - offset);
      const dayOfWeek = d.getDay();
      
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToShow.unshift({
          dateStr: d.toISOString().split('T')[0],
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          displayDate: d.getDate(),
          monthName: d.toLocaleDateString('en-US', { month: 'short' })
        });
      }
      offset++;
    }

    // Now render the day boxes
    daysToShow.forEach(day => {
      const dayLog = logs.find(l => l.date === day.dateStr);
      const dayBox = document.createElement('div');
      dayBox.className = 'calendar-day-box';
      dayBox.textContent = day.displayDate;

      let statusDesc = 'No Record';
      let checkInTime = '';

      if (dayLog) {
        if (dayLog.status === 'Present') {
          dayBox.classList.add('present');
          statusDesc = 'Present (On Time)';
          checkInTime = `Checked In: ${dayLog.time}`;
        } else if (dayLog.status === 'Late') {
          dayBox.classList.add('late');
          statusDesc = 'Present (Late Arrival)';
          checkInTime = `Checked In: ${dayLog.time}`;
        } else if (dayLog.status === 'Absent') {
          dayBox.classList.add('absent');
          statusDesc = 'Absent';
          checkInTime = 'No Check-In';
        }
      }

      // Add tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'day-tooltip';
      tooltip.innerHTML = `
        <div style="font-weight:700;">${day.monthName} ${day.displayDate}</div>
        <div style="font-size:0.75rem; margin-top:2px;">${statusDesc}</div>
        ${checkInTime ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${checkInTime}</div>` : ''}
      `;
      dayBox.appendChild(tooltip);
      gridEl.appendChild(dayBox);
    });
  };

  const renderHistoryTable = (logs) => {
    const listEl = document.getElementById('studentHistoryTableBody');
    if (!listEl) return;

    if (logs.length === 0) {
      listEl.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="padding: 24px; color: var(--text-muted);">
            No attendance history recorded.
          </td>
        </tr>
      `;
      return;
    }

    listEl.innerHTML = logs.map(log => {
      const statusBadge = `badge-${log.status.toLowerCase()}`;
      return `
        <tr>
          <td class="font-mono">${log.date}</td>
          <td class="font-mono">${log.time}</td>
          <td><span class="badge ${statusBadge}">${log.status}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">
            ${log.method} ${log.notes ? `(${log.notes})` : ''}
          </td>
        </tr>
      `;
    }).join('');
  };

  return {
    handleLogin: (rollNo) => {
      const errorMsg = document.getElementById('studentLoginError');
      if (errorMsg) errorMsg.style.display = 'none';

      const student = AppDB.getStudent(rollNo);
      if (student) {
        loggedInStudent = student;
        // Hide login, show portal details
        document.getElementById('studentPortalLoginCard').style.display = 'none';
        document.getElementById('studentPortalDetails').style.display = 'flex';
        renderProfile();
      } else {
        if (errorMsg) {
          errorMsg.textContent = 'Roll number not found in database. Try: CS-2026-001';
          errorMsg.style.display = 'block';
        }
      }
    },

    handleFaceLogin: () => {
      const video = document.getElementById('studentFaceLoginVideo');
      const canvas = document.getElementById('studentFaceLoginCanvas');
      const container = document.getElementById('studentFaceLoginCamContainer');
      const errorMsg = document.getElementById('studentLoginError');
      
      if (errorMsg) errorMsg.style.display = 'none';
      container.style.display = 'block';

      AppCamera.initCamera(video, canvas).then(res => {
        if (res.success) {
          // Scan a random student from the DB
          AppCamera.startScanning('random', (scanResult) => {
            if (scanResult.success) {
              loggedInStudent = scanResult.student;
              
              // Clean up camera
              AppCamera.stopCamera();
              container.style.display = 'none';

              // Open Portal details
              document.getElementById('studentPortalLoginCard').style.display = 'none';
              document.getElementById('studentPortalDetails').style.display = 'flex';
              renderProfile();
            } else {
              errorMsg.textContent = 'Face not recognized. Please type Roll Number.';
              errorMsg.style.display = 'block';
              AppCamera.stopCamera();
              container.style.display = 'none';
            }
          });
        } else {
          errorMsg.textContent = 'Webcam not accessible.';
          errorMsg.style.display = 'block';
          container.style.display = 'none';
        }
      });
    },

    handleLogout: () => {
      loggedInStudent = null;
      document.getElementById('studentPortalLoginCard').style.display = 'flex';
      document.getElementById('studentPortalDetails').style.display = 'none';
      const errorMsg = document.getElementById('studentLoginError');
      if (errorMsg) errorMsg.style.display = 'none';
      
      // Stop face login camera if active
      AppCamera.stopCamera();
      document.getElementById('studentFaceLoginCamContainer').style.display = 'none';
    }
  };
})();
