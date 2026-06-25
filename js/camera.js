// js/camera.js
// Handles camera stream access and overlay HUD canvas rendering

const AppCamera = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let animationFrameId = null;
  let isScanning = false;
  
  // Scanning state
  let scanProgress = 0;
  let scanningStatus = 'Ready'; // 'Ready', 'Scanning', 'Analyzing', 'Success', 'Error'
  let matchedStudent = null;
  let trackingBox = { x: 120, y: 80, width: 240, height: 240, targetX: 120, targetY: 80 };
  let trackingSpeed = 0.1;

  // Sound effects using Audio Synthesis (no external assets needed!)
  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'scan') {
        // High pitched click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'success') {
        // Ascending chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'error') {
        // Flat low buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context not supported or blocked by policy", e);
    }
  };

  const drawHUD = () => {
    if (!ctx || !canvasEl) return;
    
    const w = canvasEl.width;
    const h = canvasEl.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // 1. Draw Corners (HUD Camera look)
    const padding = 20;
    const len = 30;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    
    // Top Left
    ctx.beginPath();
    ctx.moveTo(padding + len, padding); ctx.lineTo(padding, padding); ctx.lineTo(padding, padding + len);
    ctx.stroke();
    // Top Right
    ctx.beginPath();
    ctx.moveTo(w - padding - len, padding); ctx.lineTo(w - padding, padding); ctx.lineTo(w - padding, padding + len);
    ctx.stroke();
    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(padding + len, h - padding); ctx.lineTo(padding, h - padding); ctx.lineTo(padding, h - padding + len);
    ctx.stroke();
    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(w - padding - len, h - padding); ctx.lineTo(w - padding, h - padding); ctx.lineTo(w - padding, h - padding + len);
    ctx.stroke();

    // 2. Animate Bounding Box Tracking (jitter simulated)
    if (isScanning) {
      if (scanningStatus === 'Scanning' || scanningStatus === 'Analyzing') {
        // Move box targets slightly for dynamic movement
        if (Math.random() > 0.85) {
          trackingBox.targetX = 120 + (Math.random() * 40 - 20);
          trackingBox.targetY = 80 + (Math.random() * 30 - 15);
        }
      }
      
      // Interpolate coordinates
      trackingBox.x += (trackingBox.targetX - trackingBox.x) * trackingSpeed;
      trackingBox.y += (trackingBox.targetY - trackingBox.y) * trackingSpeed;
      
      const bx = trackingBox.x;
      const by = trackingBox.y;
      const bw = trackingBox.width;
      const bh = trackingBox.height;

      // Draw Face Frame Box
      if (scanningStatus === 'Success') {
        ctx.strokeStyle = 'var(--success)';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      } else if (scanningStatus === 'Error') {
        ctx.strokeStyle = 'var(--danger)';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
      } else if (scanningStatus === 'Analyzing') {
        ctx.strokeStyle = 'var(--warning)';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.03)';
      } else {
        ctx.strokeStyle = 'var(--primary)';
        ctx.fillStyle = 'rgba(37, 99, 235, 0.03)';
      }
      
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Draw standard double lines on box corners
      const corner = 25;
      // Top Left Corner
      ctx.moveTo(bx, by + corner); ctx.lineTo(bx, by); ctx.lineTo(bx + corner, by);
      // Top Right Corner
      ctx.moveTo(bx + bw - corner, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + corner);
      // Bottom Left Corner
      ctx.moveTo(bx, by + bh - corner); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + corner, by + bh);
      // Bottom Right Corner
      ctx.moveTo(bx + bw - corner, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - corner);
      ctx.stroke();
      ctx.fillRect(bx, by, bw, bh);

      // Draw Reticle Center
      ctx.strokeStyle = ctx.strokeStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx + bw/2, by + bh/2, 10, 0, Math.PI * 2);
      ctx.moveTo(bx + bw/2 - 20, by + bh/2); ctx.lineTo(bx + bw/2 + 20, by + bh/2);
      ctx.moveTo(bx + bw/2, by + bh/2 - 20); ctx.lineTo(bx + bw/2, by + bh/2 + 20);
      ctx.stroke();

      // 3. Draw Scanning Text Details
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      
      // Left side telemetry data
      ctx.fillText(`SYS.LOCK: ACTIVE`, bx, by - 30);
      ctx.fillText(`F_LIMIT: 60FPS`, bx, by - 15);
      
      // Right side telemetry
      ctx.textAlign = 'right';
      ctx.fillText(`X: ${Math.round(bx)} Y: ${Math.round(by)}`, bx + bw, by - 30);
      const conf = scanningStatus === 'Success' ? '98.8%' : (scanningStatus === 'Analyzing' ? `${Math.round(50 + Math.random()*45)}%` : '--%');
      ctx.fillText(`MATCH_CONF: ${conf}`, bx + bw, by - 15);
      ctx.textAlign = 'left';

      // 4. Progress bar if Analyzing
      if (scanningStatus === 'Analyzing') {
        const barH = 6;
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(bx, by + bh + 15, bw, barH);
        
        ctx.fillStyle = 'var(--warning)';
        ctx.fillRect(bx, by + bh + 15, bw * (scanProgress / 100), barH);

        ctx.fillStyle = 'var(--warning)';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(`ANALYZING FACIAL MAP: ${Math.round(scanProgress)}%`, bx, by + bh + 32);
      } else if (scanningStatus === 'Success' && matchedStudent) {
        ctx.fillStyle = 'var(--success)';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`MATCH FOUND: ${matchedStudent.name}`, bx, by + bh + 22);
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(`ID: ${matchedStudent.rollNo} (VERIFIED)`, bx, by + bh + 38);
      } else if (scanningStatus === 'Error') {
        ctx.fillStyle = 'var(--danger)';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`MATCH FAILED: UNREGISTERED FACE`, bx, by + bh + 22);
      } else if (scanningStatus === 'Scanning') {
        ctx.fillStyle = 'var(--primary)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(`HOLD STILL - ALIGNING TARGET`, bx, by + bh + 22);
      }
    } else {
      // Idle crosshair overlay
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w/2, h/2, 40, 0, Math.PI * 2);
      ctx.moveTo(w/2 - 60, h/2); ctx.lineTo(w/2 + 60, h/2);
      ctx.moveTo(w/2, h/2 - 60); ctx.lineTo(w/2, h/2 + 60);
      ctx.stroke();
    }
    
    // Loop
    animationFrameId = requestAnimationFrame(drawHUD);
  };

  return {
    initCamera: async (videoElement, canvasElement) => {
      videoEl = videoElement;
      canvasEl = canvasElement;
      ctx = canvasEl.getContext('2d');

      // Adjust canvas coordinates to fit CSS sizing
      canvasEl.width = videoEl.clientWidth || 640;
      canvasEl.height = videoEl.clientHeight || 480;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false
        });
        
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', true);
        videoEl.play();
        
        // Start Canvas HUD overlay loop
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        drawHUD();
        
        return { success: true };
      } catch (err) {
        console.error("Camera access error:", err);
        return { success: false, error: err.message };
      }
    },

    stopCamera: () => {
      isScanning = false;
      scanningStatus = 'Ready';
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (ctx && canvasEl) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
    },

    startScanning: (selectedRollNo, onMatchCallback) => {
      if (!stream || isScanning) return;
      
      isScanning = true;
      scanningStatus = 'Scanning';
      scanProgress = 0;
      matchedStudent = null;
      
      trackingBox.x = 120;
      trackingBox.y = 80;

      // Phase 1: Locking Onto Face
      setTimeout(() => {
        if (!isScanning) return;
        scanningStatus = 'Analyzing';
        playSound('scan');
        
        // Phase 2: Analyzing progress increment
        const interval = setInterval(() => {
          if (!isScanning) {
            clearInterval(interval);
            return;
          }
          
          scanProgress += 8;
          if (scanProgress >= 100) {
            clearInterval(interval);
            
            // Phase 3: Finalizing Match
            const students = AppDB.getStudents();
            
            if (selectedRollNo === 'random') {
              // Select a random student
              const idx = Math.floor(Math.random() * students.length);
              matchedStudent = students[idx];
            } else if (selectedRollNo === 'unknown') {
              matchedStudent = null;
            } else {
              // Look up specific student
              matchedStudent = AppDB.getStudent(selectedRollNo);
            }
            
            if (matchedStudent) {
              scanningStatus = 'Success';
              playSound('success');
              
              // Mark in local storage DB
              const result = AppDB.markAttendance(matchedStudent.rollNo, 'Present', 'Face Scan');
              
              // Return details
              if (onMatchCallback) {
                onMatchCallback({
                  success: true,
                  student: matchedStudent,
                  time: result.time
                });
              }
            } else {
              scanningStatus = 'Error';
              playSound('error');
              if (onMatchCallback) {
                onMatchCallback({ success: false, message: 'Face not recognized.' });
              }
            }
            
            // Go back to scanning after 3 seconds
            setTimeout(() => {
              if (isScanning) {
                isScanning = false;
                AppCamera.startScanning(selectedRollNo, onMatchCallback);
              }
            }, 3000);
          }
        }, 150);

      }, 1500);
    },

    stopScanning: () => {
      isScanning = false;
      scanningStatus = 'Ready';
      matchedStudent = null;
    },

    capturePhoto: () => {
      if (!videoEl || !stream) return null;
      
      // Trigger visually pleasing shutter flash on screen
      const shutter = document.getElementById('cameraShutterFlash');
      if (shutter) {
        shutter.classList.add('flash');
        setTimeout(() => shutter.classList.remove('flash'), 400);
      }
      
      // Draw frame to hidden canvas
      const hiddenCanvas = document.createElement('canvas');
      hiddenCanvas.width = 320;
      hiddenCanvas.height = 240;
      const tempCtx = hiddenCanvas.getContext('2d');
      
      // Mirror the capture to match the mirrored display
      tempCtx.translate(320, 0);
      tempCtx.scale(-1, 1);
      tempCtx.drawImage(videoEl, 0, 0, 320, 240);
      
      return hiddenCanvas.toDataURL('image/jpeg', 0.85);
    }
  };
})();
