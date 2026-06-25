// js/dashboard.js
// Handles admin dashboard state, logs feed, and Chart.js animations

const AppDashboard = (() => {
  let weeklyTrendChart = null;
  let classDistChart = null;

  // Helper to check if dark mode is active
  const isDarkMode = () => document.documentElement.classList.contains('dark');

  // Chart configuration theme values
  const getThemeColors = () => {
    const dark = isDarkMode();
    return {
      text: dark ? '#a1a1aa' : '#71717a',
      grid: dark ? '#1e1e24' : '#e4e4e7',
      primary: dark ? '#3b82f6' : '#2563eb',
      success: '#10b981',
      warning: dark ? '#fbbf24' : '#f59e0b',
      danger: dark ? '#f87171' : '#ef4444',
      cardBg: dark ? '#0c0c0f' : '#ffffff'
    };
  };

  const updateKPICards = (stats) => {
    document.getElementById('kpiAttendanceRate').textContent = `${stats.rate}%`;
    document.getElementById('kpiTotalStudents').textContent = stats.total;
    document.getElementById('kpiPresentCount').textContent = stats.present;
    document.getElementById('kpiAbsentCount').textContent = stats.absent;
    document.getElementById('kpiLateCount').textContent = stats.late;

    // Attendance Trend Badge
    const rateBadge = document.getElementById('kpiAttendanceRateTrend');
    if (stats.rate >= 90) {
      rateBadge.textContent = '↑ High';
      rateBadge.className = 'trend-pill positive';
    } else if (stats.rate >= 75) {
      rateBadge.textContent = '→ Avg';
      rateBadge.className = 'trend-pill';
      rateBadge.style.backgroundColor = 'var(--border-color)';
      rateBadge.style.color = 'var(--text-muted)';
    } else {
      rateBadge.textContent = '↓ Low';
      rateBadge.className = 'trend-pill negative';
    }
  };

  const updateRecentLogs = () => {
    const today = new Date().toISOString().split('T')[0];
    // Get today's logs
    const logs = AppDB.getLogs({ date: today });
    const listEl = document.getElementById('recentLogsStreamList');
    
    if (!listEl) return;

    if (logs.length === 0) {
      listEl.innerHTML = `
        <div class="text-center" style="padding: 32px 0; color: var(--text-muted);">
          <p style="font-size: 0.9rem;">No attendance logged yet today.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = logs.slice(0, 7).map(log => {
      let statusClass = 'Present';
      let statusLabel = 'On Time';
      if (log.status === 'Late') {
        statusClass = 'Late';
        statusLabel = 'Late';
      } else if (log.status === 'Absent') {
        statusClass = 'Absent';
        statusLabel = 'Absent';
      }

      return `
        <div class="log-stream-item ${statusClass}">
          <div class="flex-column gap-xs">
            <span style="font-weight: 600; font-size: 0.9rem;">${log.studentName}</span>
            <span class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">${log.rollNo} • ${log.studentClass}</span>
          </div>
          <div class="flex-column gap-xs" style="text-align: right;">
            <span class="badge badge-${log.status.toLowerCase()}">${statusLabel}</span>
            <span class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">${log.time}</span>
          </div>
        </div>
      `;
    }).join('');
  };

  const initCharts = () => {
    const colors = getThemeColors();
    const weeklyData = AppDB.getWeeklyTrend();
    const classData = AppDB.getClassDistribution();

    // 1. Line Chart: Weekly Trends
    const ctxWeekly = document.getElementById('weeklyTrendChartCanvas').getContext('2d');
    
    if (weeklyTrendChart) weeklyTrendChart.destroy();

    weeklyTrendChart = new Chart(ctxWeekly, {
      type: 'line',
      data: {
        labels: weeklyData.map(d => d.day),
        datasets: [{
          label: 'Attendance %',
          data: weeklyData.map(d => d.rate),
          borderColor: colors.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: colors.primary,
          pointBorderColor: colors.cardBg,
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            fontFamily: 'Plus Jakarta Sans',
            padding: 10,
            cornerRadius: 8,
            backgroundColor: isDarkMode() ? '#0c0c0f' : '#ffffff',
            titleColor: isDarkMode() ? '#fafafa' : '#09090b',
            bodyColor: isDarkMode() ? '#fafafa' : '#09090b',
            borderColor: colors.grid,
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: (context) => `Attendance: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: colors.grid },
            ticks: { 
              color: colors.text, 
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (val) => `${val}%`
            }
          }
        }
      }
    });

    // 2. Doughnut Chart: Class Wise distribution
    const ctxClass = document.getElementById('classDistributionChartCanvas').getContext('2d');
    
    if (classDistChart) classDistChart.destroy();

    classDistChart = new Chart(ctxClass, {
      type: 'doughnut',
      data: {
        labels: classData.map(d => d.class),
        datasets: [{
          data: classData.map(d => d.rate),
          backgroundColor: [colors.primary, colors.success, colors.warning],
          borderWidth: isDarkMode() ? 3 : 2,
          borderColor: colors.cardBg,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { family: 'Plus Jakarta Sans', size: 12 },
              padding: 16,
              usePointStyle: true
            }
          },
          tooltip: {
            fontFamily: 'Plus Jakarta Sans',
            padding: 10,
            cornerRadius: 8,
            backgroundColor: isDarkMode() ? '#0c0c0f' : '#ffffff',
            titleColor: isDarkMode() ? '#fafafa' : '#09090b',
            bodyColor: isDarkMode() ? '#fafafa' : '#09090b',
            borderColor: colors.grid,
            borderWidth: 1,
            callbacks: {
              label: (context) => ` Attendance Rate: ${context.raw}%`
            }
          }
        },
        cutout: '70%'
      }
    });
  };

  return {
    initDashboard: () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const stats = AppDB.getStats(todayStr);
      
      updateKPICards(stats);
      updateRecentLogs();
      initCharts();
    },

    redrawCharts: () => {
      if (weeklyTrendChart && classDistChart) {
        initCharts();
      }
    }
  };
})();
