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
  let x = canvas.width / 2;
  let y = canvas.height / 2;
  let facing = 'front';
  let frameIdx = 0;
  let lastFrameTime = 0;
  const frameDuration = 250; // milliseconds per frame
  let pointerActive = false;

  // Determine orientation based on movement vector
  function determineFacing(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'front' : 'back';
  }

  // Handle pointer events
  function updatePosition(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = px - x;
    const dy = py - y;
    facing = determineFacing(dx, dy);
    x = px;
    y = py;
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointerActive = true;
    updatePosition(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerActive) {
      updatePosition(e);
    }
  });
  canvas.addEventListener('pointerup', () => {
    pointerActive = false;
  });
  canvas.addEventListener('pointercancel', () => {
    pointerActive = false;
  });

  // Draw loop
  function draw(time) {
    // advance animation frame
    if (time - lastFrameTime > frameDuration) {
      frameIdx++;
      lastFrameTime = time;
    }
    // Determine which frame list and index to use
    let img;
    if (facing === 'right' || facing === 'left') {
      const sideFrames = images.side;
      img = sideFrames[frameIdx % sideFrames.length];
    } else if (facing === 'front') {
      img = images.front[frameIdx % images.front.length];
    } else {
      img = images.back[frameIdx % images.back.length];
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    // Scale sprite down for a reasonable size relative to the viewport
    const scale = 0.4;
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;
    // For left facing, flip horizontally
    if (facing === 'left') {
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
