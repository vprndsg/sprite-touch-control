// Sprite controller — 60% smaller + transparent background + smoother motion
// (c) 2025 User. MIT license.

(function () {
  const canvas = document.getElementById('canvas');
  // Enable alpha channel so transparency works
  const ctx = canvas.getContext('2d', { alpha: true });

  /**
   * Resize the canvas to match the window dimensions. This ensures the grid
   * covers the entire viewport and the sprite remains centered initially.
   */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  /**
   * Convert an image to have a transparent background by making near-white
   * pixels fully transparent. Many sprite frames provided by the user have
   * white backgrounds; this function performs a simple chroma key to turn
   * those backgrounds into transparency. The threshold can be adjusted to
   * accommodate different shades of white.
   *
   * @param {HTMLImageElement} img The original loaded image
   * @param {number} threshold Sum of RGB values above which a pixel is
   *   considered white enough to be made transparent. Default 730 (≈243*3).
   * @returns {HTMLCanvasElement} A canvas containing the processed frame
   */
  function makeTransparent(img, threshold = 730) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    // Draw original image onto offscreen canvas
    offCtx.drawImage(img, 0, 0);
    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    // Iterate through every pixel (4 components per pixel)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // If the pixel is close to white, set alpha to 0 (transparent)
      if (r + g + b >= threshold) {
        data[i + 3] = 0;
      }
    }
    offCtx.putImageData(imageData, 0, 0);
    return offscreen;
  }

  // Object to hold processed images by orientation
  const images = { front: [], back: [], side: [] };
  // File names for each animation set
  const framePaths = {
    front: ['images/front1.jpeg', 'images/front2.jpeg', 'images/front3.jpeg'],
    back:  ['images/back1.jpeg',  'images/back2.jpeg',  'images/back3.jpeg'],
    side:  ['images/side1.jpeg',  'images/side2.jpeg'],
  };

  // Load all frames and apply transparency. Once all frames are loaded
  // and processed, the animation loop will begin.
  let loadedCount = 0;
  const totalFrames = framePaths.front.length + framePaths.back.length + framePaths.side.length;
  function onFrameLoaded() {
    loadedCount++;
    if (loadedCount === totalFrames) {
      requestAnimationFrame(draw);
    }
  }
  for (const key in framePaths) {
    framePaths[key].forEach((src) => {
      const img = new Image();
      img.onload = () => {
        images[key].push(makeTransparent(img));
        onFrameLoaded();
      };
      img.src = src;
    });
  }

  // Sprite state variables
  // Initial position at center of the canvas
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  // Target position that the sprite moves toward when the user taps
  let targetX = x;
  let targetY = y;
  // Which direction the sprite is currently facing
  let facing = 'front';
  // Current animation frame index and timing
  let frameIndex = 0;
  let lastFrameTime = 0;
  const frameInterval = 250; // milliseconds per frame
  // Speed of movement in pixels per frame
  const speed = 5;
  // Whether a pointer (touch or mouse) is currently held down
  let pointerActive = false;

  /**
   * Given horizontal and vertical deltas, determine the appropriate facing.
   * The sprite should face left or right when horizontal movement dominates,
   * otherwise it faces front or back based on vertical movement.
   *
   * @param {number} dx Horizontal difference
   * @param {number} dy Vertical difference
   * @returns {string} One of 'left', 'right', 'front', 'back'
   */
  function determineFacing(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'front' : 'back';
  }

  /**
   * Update target coordinates and initial facing when a pointer event occurs.
   * This sets where the sprite should move and updates orientation.
   *
   * @param {PointerEvent} e The pointer event
   */
  function setTarget(e) {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    const dx = targetX - x;
    const dy = targetY - y;
    facing = determineFacing(dx, dy);
  }

  // Pointer event listeners
  canvas.addEventListener('pointerdown', (e) => {
    pointerActive = true;
    setTarget(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerActive) {
      setTarget(e);
    }
  });
  canvas.addEventListener('pointerup', () => {
    pointerActive = false;
  });
  canvas.addEventListener('pointercancel', () => {
    pointerActive = false;
  });

  /**
   * Move the sprite incrementally toward its target position. If the sprite
   * is close enough to the target, snap directly to the target. The facing
   * is updated continuously while moving.
   */
  function updatePosition() {
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      facing = determineFacing(dx, dy);
    }
    if (distance > speed) {
      const ratio = speed / distance;
      x += dx * ratio;
      y += dy * ratio;
    } else {
      x = targetX;
      y = targetY;
    }
  }

  /**
   * Draw a simple rectangular grid on the canvas. Each cell is 80 pixels.
   * The background is white and grid lines are light grey to stay subtle.
   */
  function drawGrid() {
    const cellSize = 80;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let gx = 0.5; gx <= canvas.width; gx += cellSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0.5; gy <= canvas.height; gy += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Main animation loop. Updates position, advances animation frames,
   * draws the background grid and the sprite with appropriate scaling
   * and orientation. Use requestAnimationFrame for smooth rendering.
   *
   * @param {DOMHighResTimeStamp} time Current timestamp
   */
  function draw(time) {
    updatePosition();
    // Advance animation frame if enough time has passed
    if (time - lastFrameTime > frameInterval) {
      frameIndex++;
      lastFrameTime = time;
    }
    // Select the correct image frame based on facing
    let img;
    if (facing === 'right' || facing === 'left') {
      const frames = images.side;
      img = frames[frameIndex % frames.length];
    } else if (facing === 'front') {
      const frames = images.front;
      img = frames[frameIndex % frames.length];
    } else {
      const frames = images.back;
      img = frames[frameIndex % frames.length];
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    // Always disable image smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false;
    // Scale the sprite down to 40% (60% smaller)
    const scale = 0.4;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.save();
    if (facing === 'left') {
      // Flip horizontally for left-facing orientation
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