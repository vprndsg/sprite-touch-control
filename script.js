// Sprite controller — 60% smaller + transparent background + smoother motion
// (c) 2025 User. MIT license.

(function () {
  const canvas = document.getElementById('canvas');
  // Enable alpha channel so transparency works
  const ctx = canvas.getContext('2d', { alpha: true });

  // --- Game world constants ---
  // Size of each grid cell in pixels. In the side‑scrolling version the
  // world is a long horizontal strip composed of square cells. The
  // character moves along the X axis while remaining on a single row.
  const cellSize = 80;

  // World dimensions measured in cells. The map is WORLD_COLS cells wide
  // and WORLD_ROWS cells tall. Increasing WORLD_COLS makes the world
  // scroll horizontally; WORLD_ROWS controls vertical padding such as floor
  // thickness and sky. The bottom row is kept empty to allow for
  // off‑screen rendering, while the second‑to‑last row contains the
  // floor the character walks on. Bump these values up to create a
  // larger level that can scroll both horizontally and vertically. In
  // the side‑scrolling view we choose a relatively long world and a
  // tall sky so the environment fills the entire viewport on large
  // mobile screens.
  const WORLD_COLS = 60;
  const WORLD_ROWS = 12;

  // Compute the ground Y coordinate: one row up from the bottom, plus half
  // a cell. This is declared early so it is available to functions defined
  // later (e.g. setTarget, clampToWorld). All sprite Y coordinates are
  // clamped to this value so the character remains on the ground.
  const groundY = (WORLD_ROWS - 2) * cellSize + cellSize / 2;

  // Preload side‑scroller room assets. These PNGs represent the floor and
  // wall in profile. They are scaled down when drawn. We load the side
  // specific files rather than the original top‑down textures.
  const floorImg = new Image();
  floorImg.src = 'images/floor_side.png';
  const wallImg = new Image();
  wallImg.src = 'images/wall_side.png';

  // Camera offsets. These values represent the upper‑left corner of the
  // viewport in world coordinates and are updated each frame to follow
  // the sprite. They are global so that the setTarget function can
  // convert pointer positions into world coordinates.
  let camX = 0;
  let camY = 0;

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
  // Initial world position is placed near the centre of the first navigable row.
  let x = (WORLD_COLS / 2) * cellSize;
  let y = groundY;
  // Target position that the sprite moves toward when the user taps.
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
   * Clamp a proposed world coordinate to remain inside the world bounds.
   * The sprite's X position is restricted to a range [cellSize, worldWidth - cellSize],
   * leaving a one‑cell margin at each end. The Y coordinate is clamped to
   * its initial floor row so the character never leaves the ground.
   *
   * @param {number} tx Proposed X coordinate in world space
   * @param {number} ty Proposed Y coordinate in world space
   * @returns {{x: number, y: number}} Clamped world coordinates
   */
  function clampToWorld(tx, ty) {
    const worldWidth = WORLD_COLS * cellSize;
    const minX = cellSize;
    const maxX = worldWidth - cellSize;
    const clampedX = Math.min(Math.max(tx, minX), maxX);
    // Keep Y fixed at the ground row centre. We compute this once when
    // initialising the sprite and return it here to avoid accidental drift.
    return { x: clampedX, y: groundY };
  }

  /**
   * Convert a pointer event's screen coordinate into world coordinates and
   * update the sprite's target. For the side‑scrolling view we only care
   * about horizontal movement, so we ignore the Y component of the pointer
   * and clamp the X coordinate within the world bounds. The facing is set
   * based on the horizontal difference.
   *
   * @param {PointerEvent} e The pointer event
   */
  function setTarget(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    // Convert screenX to world coordinate by adding the current camera offset.
    const worldX = camX + screenX;
    // Clamp horizontal position inside world and fix vertical position on ground.
    const clamped = clampToWorld(worldX, groundY);
    targetX = clamped.x;
    targetY = clamped.y;
    const dx = targetX - x;
    facing = dx >= 0 ? 'right' : 'left';
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
   * Move the sprite incrementally toward its target X coordinate. In the
   * side‑scrolling world only horizontal movement is allowed, so we ignore
   * differences in Y. The facing is set based on the direction of travel.
   */
  function updatePosition() {
    const dx = targetX - x;
    const absDx = Math.abs(dx);
    if (absDx > 0) {
      facing = dx >= 0 ? 'right' : 'left';
    }
    if (absDx > speed) {
      const sign = dx / absDx;
      x += sign * speed;
    } else {
      x = targetX;
    }
    // Clamp to world bounds and fix Y.
    const clamped = clampToWorld(x, y);
    x = clamped.x;
    y = clamped.y;
  }

  /**
   * Draw a simple rectangular grid on the canvas. Each cell is 80 pixels.
   * The background is white and grid lines are light grey to stay subtle.
   */
  /**
   * Draw the room: floors fill the interior while walls occupy the
   * outermost row and column of cells. The floor texture is tiled
   * across every interior cell. Wall segments are drawn with their
   * bottom aligned to the bottom of the wall cell to give a sense of
   * height. The images are scaled to the current cell size.
   */
  function drawRoom() {
    // Determine the range of columns and rows visible in the current viewport
    // based on the camera offset. We pad by one tile on each side to avoid
    // gaps when scrolling quickly.
    const worldWidth = WORLD_COLS * cellSize;
    const worldHeight = WORLD_ROWS * cellSize;
    const startCol = Math.max(0, Math.floor(camX / cellSize) - 1);
    const endCol = Math.min(WORLD_COLS - 1, Math.ceil((camX + canvas.width) / cellSize) + 1);
    const startRow = Math.max(0, Math.floor(camY / cellSize) - 1);
    const endRow = Math.min(WORLD_ROWS - 1, Math.ceil((camY + canvas.height) / cellSize) + 1);

    ctx.save();
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const worldX = col * cellSize;
        const worldY = row * cellSize;
        const screenX = worldX - camX;
        const screenY = worldY - camY;
        const isFloorRow = row === WORLD_ROWS - 2;
        const isWall = col === 0 || col === WORLD_COLS - 1;
        if (isWall) {
          // Draw vertical walls on the far left and far right columns. Only draw
          // after the image has loaded to avoid division-by-zero errors when
          // computing the scale.
          if (wallImg.width > 0 && wallImg.height > 0) {
            const wallScale = cellSize / wallImg.width;
            const scaledHeight = wallImg.height * wallScale;
            ctx.drawImage(
              wallImg,
              0,
              0,
              wallImg.width,
              wallImg.height,
              screenX,
              worldY + cellSize - scaledHeight - camY,
              cellSize,
              scaledHeight
            );
          }
        } else if (isFloorRow) {
          // Draw the floor tile on the designated floor row across all columns.
          // Skip drawing until the texture has finished loading.
          if (floorImg.width > 0 && floorImg.height > 0) {
            ctx.drawImage(
              floorImg,
              0,
              0,
              floorImg.width,
              floorImg.height,
              screenX,
              screenY,
              cellSize,
              cellSize
            );
          }
        } else {
          // Empty space; no drawing necessary for air.
        }
      }
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
    // Update camera: centre on the sprite horizontally while clamping to world edges.
    const worldWidth = WORLD_COLS * cellSize;
    const worldHeight = WORLD_ROWS * cellSize;
    camX = x - canvas.width / 2;
    camY = y - canvas.height / 2;
    // Clamp camera to world bounds
    camX = Math.max(0, Math.min(camX, worldWidth - canvas.width));
    camY = Math.max(0, Math.min(camY, worldHeight - canvas.height));
    // Draw the visible portion of the world.
    drawRoom();
    // Always disable image smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false;
    // Scale the sprite down substantially so it appears small on mobile screens.
    // The original frames are 1024×1536 pixels, which is too large for a phone display.
    // A scale factor of 0.15 reduces each dimension to roughly 154×230 px (about 85% smaller),
    // which feels more appropriate for a controllable character in a grid.
    const scale = 0.15;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = x - camX;
    const drawY = y - camY;
    ctx.save();
    if (facing === 'left') {
      // Flip horizontally for left-facing orientation
      ctx.translate(drawX, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.drawImage(img, drawX - drawW / 2, drawY - drawH / 2, drawW, drawH);
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
})();