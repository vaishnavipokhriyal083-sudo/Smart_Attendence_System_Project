// js/db.js
// Handles local storage persistence and mock data generation

const AppDB = (() => {
  const DB_KEY_STUDENTS = 'smart_attendance_students';
  const DB_KEY_LOGS = 'smart_attendance_logs';

  const MOCK_CLASSES = ['Computer Science', 'Data Science', 'Cyber Security'];

  const MOCK_STUDENTS = [
    { rollNo: 'CS-2026-001', name: 'Alexander Wright', class: 'Computer Science', joinedDate: '2026-01-10', facePhoto: null },
    { rollNo: 'CS-2026-002', name: 'Sophia Martinez', class: 'Computer Science', joinedDate: '2026-01-12', facePhoto: null },
    { rollNo: 'CS-2026-003', name: 'Marcus Sterling', class: 'Computer Science', joinedDate: '2026-01-14', facePhoto: null },
    { rollNo: 'DS-2026-001', name: 'Emma Watson', class: 'Data Science', joinedDate: '2026-01-11', facePhoto: null },
    { rollNo: 'DS-2026-002', name: 'Liam Chen', class: 'Data Science', joinedDate: '2026-01-12', facePhoto: null },
    { rollNo: 'DS-2026-003', name: 'Olivia Rossi', class: 'Data Science', joinedDate: '2026-01-15', facePhoto: null },
    { rollNo: 'CY-2026-001', name: 'Ethan Hunt', class: 'Cyber Security', joinedDate: '2026-01-10', facePhoto: null },
    { rollNo: 'CY-2026-002', name: 'Sarah Connor', class: 'Cyber Security', joinedDate: '2026-01-11', facePhoto: null },
    { rollNo: 'CY-2026-003', name: 'David Lightman', class: 'Cyber Security', joinedDate: '2026-01-15', facePhoto: null },
    { rollNo: 'CY-2026-004', name: 'Clara Oswald', class: 'Cyber Security', joinedDate: '2026-01-16', facePhoto: null }
  ];

  // Helper to format dates
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper to generate seed logs for the last 14 days (excluding weekends)
  const generateSeedLogs = (students) => {
    const logs = [];
    const today = new Date();
    let logId = 1;

    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      
      // Skip weekends for school attendance
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = formatDate(d);

      students.forEach(student => {
        // Attendance probability: 82% Present, 10% Late, 8% Absent
        const rand = Math.random();
        let status = 'Present';
        let checkInTime = '08:45:00'; // Default class starts at 9:00

        if (rand > 0.92) {
          status = 'Absent';
          checkInTime = '--:--:--';
        } else if (rand > 0.82) {
          status = 'Late';
          // Late arrival between 09:05 and 09:40
          const min = Math.floor(Math.random() * 35) + 5;
          checkInTime = `09:${min.toString().padStart(2, '0')}:00`;
        } else {
          // On-time between 08:30 and 08:59
          const min = Math.floor(Math.random() * 30) + 30;
          checkInTime = `08:${min.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        }

        // Today is processed live, don't auto-fill for all students yet
        // Let's seed only 60% of students for "today" to make it look like class is in progress
        if (i === 0 && Math.random() > 0.6) {
          return;
        }

        logs.push({
          id: `LOG-${logId++}`,
          rollNo: student.rollNo,
          date: dateStr,
          time: checkInTime,
          status: status,
          method: status === 'Absent' ? 'N/A' : 'Face Scan',
          notes: ''
        });
      });
    }
    return logs;
  };

  const getStorage = (key, defaultVal) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  };

  const setStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  return {
    initialize: () => {
      if (!localStorage.getItem(DB_KEY_STUDENTS)) {
        setStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      }
      if (!localStorage.getItem(DB_KEY_LOGS)) {
        const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
        const logs = generateSeedLogs(students);
        setStorage(DB_KEY_LOGS, logs);
      }
    },

    getClasses: () => MOCK_CLASSES,

    getStudents: () => {
      return getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
    },

    getStudent: (rollNo) => {
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      return students.find(s => s.rollNo.toLowerCase() === rollNo.toLowerCase()) || null;
    },

    registerStudent: (name, rollNo, className, facePhoto) => {
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      
      // Check duplicate roll number
      if (students.some(s => s.rollNo.toLowerCase() === rollNo.toLowerCase())) {
        return { success: false, message: 'Roll number already exists.' };
      }

      const newStudent = {
        rollNo: rollNo,
        name: name,
        class: className,
        joinedDate: formatDate(new Date()),
        facePhoto: facePhoto // base64 representation of registered image
      };

      students.push(newStudent);
      setStorage(DB_KEY_STUDENTS, students);
      return { success: true, student: newStudent };
    },

    getLogs: (filters = {}) => {
      let logs = getStorage(DB_KEY_LOGS, []);
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      
      // Map student detail to each log
      let enrichedLogs = logs.map(log => {
        const student = students.find(s => s.rollNo === log.rollNo) || { name: 'Unknown Student', class: 'N/A' };
        return {
          ...log,
          studentName: student.name,
          studentClass: student.class
        };
      });

      // Apply Filters
      if (filters.date) {
        enrichedLogs = enrichedLogs.filter(l => l.date === filters.date);
      }
      if (filters.class && filters.class !== 'All') {
        enrichedLogs = enrichedLogs.filter(l => l.studentClass === filters.class);
      }
      if (filters.status && filters.status !== 'All') {
        enrichedLogs = enrichedLogs.filter(l => l.status === filters.status);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        enrichedLogs = enrichedLogs.filter(l => 
          l.studentName.toLowerCase().includes(query) || 
          l.rollNo.toLowerCase().includes(query)
        );
      }

      // Sort logs descending (newest first)
      return enrichedLogs.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time === '--:--:--' ? '00:00:00' : a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time === '--:--:--' ? '00:00:00' : b.time}`);
        return dateTimeB - dateTimeA;
      });
    },

    getStats: (dateStr) => {
      const targetDate = dateStr || formatDate(new Date());
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      const logs = getStorage(DB_KEY_LOGS, []);
      
      const dayLogs = logs.filter(l => l.date === targetDate);
      const totalStudents = students.length;
      
      let present = 0;
      let late = 0;
      let absent = 0;

      students.forEach(student => {
        const log = dayLogs.find(l => l.rollNo === student.rollNo);
        if (!log) {
          absent++; // Default if no log recorded yet today
        } else if (log.status === 'Present') {
          present++;
        } else if (log.status === 'Late') {
          late++;
        } else if (log.status === 'Absent') {
          absent++;
        }
      });

      const checkedIn = present + late;
      const attendanceRate = totalStudents > 0 ? Math.round((checkedIn / totalStudents) * 100) : 0;

      return {
        date: targetDate,
        total: totalStudents,
        present: present,
        late: late,
        absent: absent,
        rate: attendanceRate
      };
    },

    markAttendance: (rollNo, status = 'Present', method = 'Face Scan', notes = '') => {
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      const student = students.find(s => s.rollNo.toLowerCase() === rollNo.toLowerCase());
      
      if (!student) {
        return { success: false, message: 'Student roll number not found.' };
      }

      const logs = getStorage(DB_KEY_LOGS, []);
      const todayStr = formatDate(new Date());

      // Check if already checked in today
      const existingLogIndex = logs.findIndex(l => l.rollNo === student.rollNo && l.date === todayStr);

      const checkInTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      
      const logEntry = {
        rollNo: student.rollNo,
        date: todayStr,
        time: checkInTime,
        status: status,
        method: method,
        notes: notes
      };

      if (existingLogIndex !== -1) {
        // Update existing attendance
        logEntry.id = logs[existingLogIndex].id;
        logs[existingLogIndex] = logEntry;
      } else {
        // Create new log entry
        logEntry.id = `LOG-${Date.now()}`;
        logs.push(logEntry);
      }

      setStorage(DB_KEY_LOGS, logs);
      
      return {
        success: true,
        studentName: student.name,
        class: student.class,
        status: status,
        time: checkInTime
      };
    },

    updateAttendance: (logId, status, notes = '') => {
      const logs = getStorage(DB_KEY_LOGS, []);
      const index = logs.findIndex(l => l.id === logId);

      if (index === -1) {
        return { success: false, message: 'Log entry not found.' };
      }

      logs[index].status = status;
      logs[index].notes = notes;
      
      if (status === 'Absent') {
        logs[index].time = '--:--:--';
        logs[index].method = 'Manual';
      } else {
        // If it was absent before, set checked in time now
        if (logs[index].time === '--:--:--') {
          logs[index].time = new Date().toLocaleTimeString('en-US', { hour12: false });
          logs[index].method = 'Manual';
        }
      }

      setStorage(DB_KEY_LOGS, logs);
      return { success: true };
    },

    getStudentHistory: (rollNo) => {
      const logs = getStorage(DB_KEY_LOGS, []);
      const studentLogs = logs.filter(l => l.rollNo.toLowerCase() === rollNo.toLowerCase());
      
      // Calculate individual stats
      const totalDays = studentLogs.length;
      const presentDays = studentLogs.filter(l => l.status === 'Present').length;
      const lateDays = studentLogs.filter(l => l.status === 'Late').length;
      const absentDays = studentLogs.filter(l => l.status === 'Absent').length;
      const attendanceRate = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0;

      return {
        summary: {
          total: totalDays,
          present: presentDays,
          late: lateDays,
          absent: absentDays,
          rate: attendanceRate
        },
        logs: studentLogs.sort((a, b) => b.date.localeCompare(a.date))
      };
    },

    getWeeklyTrend: () => {
      const logs = getStorage(DB_KEY_LOGS, []);
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      const totalStudents = students.length;
      const today = new Date();
      
      // Last 7 week days
      const days = [];
      let i = 0;
      while (days.length < 5) { // 5 school days
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days.unshift(formatDate(d)); // Oldest first
        }
        i++;
      }

      return days.map(dateStr => {
        const dayLogs = logs.filter(l => l.date === dateStr);
        const presentOrLate = dayLogs.filter(l => l.status === 'Present' || l.status === 'Late').length;
        const rate = totalStudents > 0 ? Math.round((presentOrLate / totalStudents) * 100) : 0;
        
        // Find day name
        const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
        
        return {
          date: dateStr,
          day: dayName,
          rate: rate
        };
      });
    },

    getClassDistribution: () => {
      const students = getStorage(DB_KEY_STUDENTS, MOCK_STUDENTS);
      const logs = getStorage(DB_KEY_LOGS, []);
      const todayStr = formatDate(new Date());
      const dayLogs = logs.filter(l => l.date === todayStr);

      const distribution = {};
      MOCK_CLASSES.forEach(cls => {
        distribution[cls] = { total: 0, present: 0 };
      });

      students.forEach(student => {
        const cls = student.class;
        if (distribution[cls]) {
          distribution[cls].total++;
          const log = dayLogs.find(l => l.rollNo === student.rollNo);
          if (log && (log.status === 'Present' || log.status === 'Late')) {
            distribution[cls].present++;
          }
        }
      });

      return Object.keys(distribution).map(cls => ({
        class: cls,
        total: distribution[cls].total,
        present: distribution[cls].present,
        rate: distribution[cls].total > 0 ? Math.round((distribution[cls].present / distribution[cls].total) * 100) : 0
      }));
    }
  };
})();
