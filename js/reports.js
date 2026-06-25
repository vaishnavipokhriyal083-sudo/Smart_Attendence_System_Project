// js/reports.js
// Handles table rendering, search, filters, pagination, CSV exports, and manual edits

const AppReports = (() => {
  let currentPage = 1;
  const pageSize = 8;
  let activeFilters = {
    search: '',
    class: 'All',
    status: 'All',
    date: ''
  };

  let selectedLog = null;

  const getFilteredLogs = () => {
    return AppDB.getLogs(activeFilters);
  };

  const renderTable = () => {
    const logs = getFilteredLogs();
    const tableBody = document.getElementById('reportsTableBody');
    const totalCountEl = document.getElementById('reportsTotalCount');
    
    if (!tableBody) return;

    totalCountEl.textContent = `${logs.length} record(s) found`;

    if (logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 48px; color: var(--text-muted);">
            No attendance records found matching filters.
          </td>
        </tr>
      `;
      updatePaginationControls(0);
      return;
    }

    const totalPages = Math.ceil(logs.length / pageSize);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, logs.length);
    const pageLogs = logs.slice(startIdx, endIdx);

    tableBody.innerHTML = pageLogs.map(log => {
      const statusBadge = `badge-${log.status.toLowerCase()}`;
      return `
        <tr onclick="AppReports.openEditModal('${log.id}')">
          <td class="font-mono" style="font-weight: 600;">${log.rollNo}</td>
          <td style="font-weight: 500;">${log.studentName}</td>
          <td>${log.studentClass}</td>
          <td class="font-mono">${log.date}</td>
          <td class="font-mono">${log.time}</td>
          <td><span class="badge ${statusBadge}">${log.status}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">
            ${log.method} ${log.notes ? `• <span style="font-style: italic;">"${log.notes}"</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    updatePaginationControls(totalPages);
  };

  const updatePaginationControls = (totalPages) => {
    const prevBtn = document.getElementById('reportPrevPage');
    const nextBtn = document.getElementById('reportNextPage');
    const firstBtn = document.getElementById('reportFirstPage');
    const lastBtn = document.getElementById('reportLastPage');
    const currentIndicator = document.getElementById('reportCurrentPageIndicator');

    if (!prevBtn) return;

    currentIndicator.textContent = totalPages === 0 ? 'Page 0 of 0' : `Page ${currentPage} of ${totalPages}`;

    firstBtn.disabled = currentPage === 1 || totalPages === 0;
    prevBtn.disabled = currentPage === 1 || totalPages === 0;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    lastBtn.disabled = currentPage === totalPages || totalPages === 0;
  };

  return {
    initReports: () => {
      // Set date picker input to today by default
      const dateInput = document.getElementById('filterDate');
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
        activeFilters.date = dateInput.value;
      }
      
      currentPage = 1;
      renderTable();
    },

    handleFilterChange: (type, value) => {
      activeFilters[type] = value;
      currentPage = 1;
      renderTable();
    },

    changePage: (direction) => {
      const logs = getFilteredLogs();
      const totalPages = Math.ceil(logs.length / pageSize);

      if (direction === 'first') currentPage = 1;
      else if (direction === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (direction === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else if (direction === 'last') currentPage = totalPages;

      renderTable();
    },

    openEditModal: (logId) => {
      const logs = AppDB.getLogs();
      selectedLog = logs.find(l => l.id === logId);

      if (!selectedLog) return;

      document.getElementById('editModalStudentName').textContent = selectedLog.studentName;
      document.getElementById('editModalRollNo').textContent = selectedLog.rollNo;
      document.getElementById('editModalDate').textContent = `${selectedLog.date} ${selectedLog.time}`;
      document.getElementById('editModalStatus').value = selectedLog.status;
      document.getElementById('editModalNotes').value = selectedLog.notes || '';

      document.getElementById('editAttendanceModal').classList.add('active');
    },

    closeEditModal: () => {
      document.getElementById('editAttendanceModal').classList.remove('active');
      selectedLog = null;
    },

    saveManualEdit: () => {
      if (!selectedLog) return;

      const status = document.getElementById('editModalStatus').value;
      const notes = document.getElementById('editModalNotes').value;

      const res = AppDB.updateAttendance(selectedLog.id, status, notes);

      if (res.success) {
        AppReports.closeEditModal();
        renderTable();
        // Refresh dashboard views just in case today's logs changed
        if (typeof AppDashboard !== 'undefined') {
          AppDashboard.initDashboard();
        }
      }
    },

    exportCSV: () => {
      const logs = getFilteredLogs();
      if (logs.length === 0) {
        alert("No records to export.");
        return;
      }

      // Build CSV file string
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `"Log ID","Roll Number","Name","Class","Date","Time","Status","Method","Notes"\n`;

      logs.forEach(log => {
        const row = [
          log.id,
          log.rollNo,
          log.studentName,
          log.studentClass,
          log.date,
          log.time,
          log.status,
          log.method,
          log.notes || ''
        ].map(val => `"${val.replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
      });

      // Download trigger
      const encodedUri = encodeURI(csvContent);
      const downloadLink = document.createElement("a");
      downloadLink.setAttribute("href", encodedUri);
      
      const filterDesc = `${activeFilters.class}_${activeFilters.status}`.replace(/\s+/g, '-');
      downloadLink.setAttribute("download", `Attendance_Report_${activeFilters.date || 'All'}_${filterDesc}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };
})();
