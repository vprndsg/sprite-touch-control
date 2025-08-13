// Sprite controller script
// (c) 2025 User. MIT license.

(function () {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Resize canvas to fill the window
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Preload images grouped by orientation
  const images = {
    front: [],
    back: [],
    side: [],
  };

  const framePaths = {
    front: ['images/front1.jpeg', 'images/front2.jpeg', 'images/front3.jpeg'],
    back: ['images/back1.jpeg', 'images/back2.jpeg', 'images/back3.jpeg'],
    // Use two frames for side walking; additional side_idle could be used if desired
    side: ['images/side1.jpeg', 'images/side2.jpeg'],
  };

  // Load all images synchronously
  let loadedCount = 0;
  const totalToLoad = framePaths.front.length + framePaths.back.length + framePaths.side.length;
  function handleLoad() {
    loadedCount++;
    if (loadedCount === totalToLoad) {
      requestAnimationFrame(draw);
    }
  }
  for (const key in framePaths) {
    framePaths[key].forEach((path) => {
      const img = new Image();
      img.src = path;
      img.onload = handleLoad;
      images[key].push(img);
    });
  }

  // Sprite state
  // Current position of the sprite on the canvas
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  // The target coordinates that the sprite should move toward
  let targetX = x;
  let targetY = y;
  // Orientation: 'front', 'back', 'left' or 'right'
  let facing = 'front';
  // Animation frame index and timing
  let frameIdx = 0;
  let lastFrameTime = 0;
  const frameDuration = 250; // milliseconds per frame
  // Speed controls how many pixels the sprite moves per frame toward its target
  const speed = 5;
  // Flag to indicate if a pointer is currently active
  let pointerActive = false;

  /**
   * Determine orientation based on movement vector. The sprite should face
   * left/right if horizontal displacement dominates or front/back when
   * vertical displacement dominates.
   * @param {number} dx - horizontal difference
   * @param {number} dy - vertical difference
   * @returns {string} 'left', 'right', 'front' or 'back'
   */
  function determineFacing(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'front' : 'back';
  }

  /**
   * Update the target position based on pointer coordinates. The sprite
   * orientation is updated immediately to reflect where it needs to head.
   * @param {PointerEvent} e
   */
  function setTargetFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    const dx = targetX - x;
    const dy = targetY - y;
    facing = determineFacing(dx, dy);
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointerActive = true;
    setTargetFromEvent(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerActive) {
      setTargetFromEvent(e);
    }
  });
  canvas.addEventListener('pointerup', () => {
    pointerActive = false;
  });
  canvas.addEventListener('pointercancel', () => {
    pointerActive = false;
  });

  /**
   * Move the sprite toward its target coordinates. The sprite will move
   * incrementally based on the configured speed. If the sprite is close
   * enough to the target, it snaps directly to the target. Orientation
   * updates every frame based on the remaining distance.
   */
  function updatePosition() {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      // update facing while moving
      facing = determineFacing(dx, dy);
    }
    if (dist > speed) {
      // Move a small step toward the target
      const ratio = speed / dist;
      x += dx * ratio;
      y += dy * ratio;
    } else {
      // Close enough; snap to the exact position
      x = targetX;
      y = targetY;
    }
  }

  /**
   * Draw a simple grid background on the canvas to provide a "world" for
   * the sprite to walk in. The grid is drawn light grey so it doesn't
   * overpower the character art. You can adjust cellSize for larger or
   * smaller tiles.
   */
  function drawGrid() {
    const cellSize = 80;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= canvas.width; gx += cellSize) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy <= canvas.height; gy += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(canvas.width, gy + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Main draw loop
  function draw(time) {
    // Update sprite position toward its target
    updatePosition();
    // Advance animation frame based on elapsed time
    if (time - lastFrameTime > frameDuration) {
      frameIdx++;
      lastFrameTime = time;
    }
    // Choose the appropriate frame based on orientation
    let img;
    if (facing === 'right' || facing === 'left') {
      const sideFrames = images.side;
      img = sideFrames[frameIdx % sideFrames.length];
    } else if (facing === 'front') {
      img = images.front[frameIdx % images.front.length];
    } else {
      img = images.back[frameIdx % images.back.length];
    }
    // Clear canvas and draw background grid
    // Drawing the grid first ensures the sprite appears on top
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    // Draw the sprite scaled down to 40% of its original size
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const scale = 0.4;
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;
    ctx.save();
    if (facing === 'left') {
      // Flip horizontally for left-facing
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
})();
