const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PREVIEW_SIZE = 28;

const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const COLORS = {
  I: '#38d9ff',
  O: '#ffd43b',
  T: '#c77dff',
  S: '#69db7c',
  Z: '#ff6b6b',
  J: '#4dabf7',
  L: '#ffa94d',
};

const boardCanvas = document.getElementById('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const statusTextEl = document.getElementById('status-text');

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const gameOverlay = document.getElementById('game-overlay');
const menuStartBtn = document.getElementById('menu-start-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const menuHomeBtn = document.getElementById('menu-home-btn');
const homeMenu = document.getElementById('home-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const menuHighScoreEl = document.getElementById('menu-high-score');
const finalScoreEl = document.getElementById('final-score');
const storageStatusEl = document.getElementById('storage-status');

let board = [];
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let score = 0;
let highScore = 0;
let lines = 0;
let level = 1;
let isRunning = false;
let isPaused = false;
let isGameOver = false;
let canHold = true;
let dropTimer = null;
let highScoreSaveQueue = Promise.resolve();

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomType() {
  const types = Object.keys(PIECES);
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type) {
  const matrix = cloneMatrix(PIECES[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -1,
    color: COLORS[type],
  };
}

function collision(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      const newX = offsetX + x;
      const newY = offsetY + y;

      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }

      if (newY >= 0 && board[newY][newX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;

      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = Math.floor(lines / 10) + 1;
    recordHighScore();
    updateHud();
    restartDropTimer();
  }

  return cleared;
}

function spawnPiece() {
  if (!nextPiece) {
    nextPiece = createPiece(randomType());
  }

  currentPiece = nextPiece;
  currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
  currentPiece.y = -1;
  nextPiece = createPiece(randomType());
  canHold = true;

  if (collision(currentPiece.matrix, currentPiece.x, currentPiece.y)) {
    finishGame();
  }

  drawNextPreview();
}

function drawCell(context, x, y, color, size = BLOCK_SIZE) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);

  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function drawMatrix(context, matrix, offsetX, offsetY, color, size = BLOCK_SIZE, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const drawX = offsetX + x;
      const drawY = offsetY + y;

      if (drawY >= 0) {
        drawCell(context, drawX, drawY, color || COLORS[currentPiece.type], size);
      }
    });
  });

  context.restore();
}

function drawGhostPiece() {
  if (!currentPiece) {
    return;
  }

  let ghostY = currentPiece.y;
  while (!collision(currentPiece.matrix, currentPiece.x, ghostY + 1)) {
    ghostY += 1;
  }

  drawMatrix(boardCtx, currentPiece.matrix, currentPiece.x, ghostY, 'rgba(255,255,255,0.25)', BLOCK_SIZE, 0.45);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.fillStyle = '#07111d';
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) {
        drawCell(boardCtx, x, y, COLORS[cell]);
      } else {
        boardCtx.strokeStyle = 'rgba(255,255,255,0.05)';
        boardCtx.strokeRect(x * BLOCK_SIZE + 0.5, y * BLOCK_SIZE + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      }
    }
  }

  if (currentPiece) {
    drawGhostPiece();
    drawMatrix(boardCtx, currentPiece.matrix, currentPiece.x, currentPiece.y, currentPiece.color, BLOCK_SIZE);
  }
}

function drawPreview(context, canvas, type) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#07111d';
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!type) {
    return;
  }

  const matrix = PIECES[type];
  const size = PREVIEW_SIZE;
  const offsetX = Math.floor((canvas.width - matrix[0].length * size) / 2);
  const offsetY = Math.floor((canvas.height - matrix.length * size) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      context.fillStyle = COLORS[type];
      context.fillRect(offsetX + x * size, offsetY + y * size, size, size);
      context.strokeStyle = 'rgba(255,255,255,0.18)';
      context.strokeRect(offsetX + x * size + 0.5, offsetY + y * size + 0.5, size - 1, size - 1);
    });
  });
}

function drawNextPreview() {
  drawPreview(nextCtx, nextCanvas, nextPiece?.type || null);
}

function drawHoldPreview() {
  drawPreview(holdCtx, holdCanvas, holdPiece?.type || null);
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  menuHighScoreEl.textContent = String(highScore);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function setStorageStatus(message) {
  storageStatusEl.textContent = message;
}

async function loadHighScore() {
  try {
    const response = await fetch('/api/highscore');
    if (!response.ok) {
      throw new Error(`Highscore konnte nicht geladen werden (${response.status}).`);
    }

    const data = await response.json();
    if (!Number.isSafeInteger(data.score) || data.score < 0) {
      throw new Error('Die Highscore-Datei enthält einen ungültigen Wert.');
    }

    highScore = Math.max(highScore, data.score);
    updateHud();
    setStorageStatus('Highscore wird in highscore.json gespeichert.');
  } catch (error) {
    setStorageStatus('Highscore-Datei nicht erreichbar. Starte server.py.');
    console.error(error);
  }
}

function recordHighScore() {
  if (score <= highScore) {
    return;
  }

  highScore = score;
  updateHud();
  highScoreSaveQueue = highScoreSaveQueue
    .then(async () => {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: highScore }),
      });
      if (!response.ok) {
        throw new Error(`Highscore konnte nicht gespeichert werden (${response.status}).`);
      }

      const data = await response.json();
      highScore = Math.max(highScore, data.score);
      updateHud();
      setStorageStatus('Highscore in highscore.json gespeichert.');
    })
    .catch((error) => {
      setStorageStatus('Highscore konnte nicht in die Datei geschrieben werden.');
      console.error(error);
    });
}

function setStatus(message) {
  statusTextEl.textContent = message;
}

function restartDropTimer() {
  if (dropTimer) {
    clearInterval(dropTimer);
  }

  const interval = Math.max(80, 700 - (level - 1) * 60);
  dropTimer = setInterval(() => {
    if (!isRunning || isPaused || isGameOver) {
      return;
    }

    moveDown();
  }, interval);
}

function resetGame() {
  if (dropTimer) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
  isRunning = false;
  board = makeBoard();
  score = 0;
  lines = 0;
  level = 1;
  isPaused = false;
  isGameOver = false;
  canHold = true;
  holdPiece = null;
  currentPiece = null;
  nextPiece = null;
  updateHud();
  setStatus('Bereit');
  drawBoard();
  drawNextPreview();
  drawHoldPreview();
}

function startGame() {
  resetGame();
  nextPiece = createPiece(randomType());
  spawnPiece();
  isRunning = true;
  isPaused = false;
  gameOverlay.hidden = true;
  setStatus('Spielen');
  restartDropTimer();
  drawBoard();
}

function pauseGame() {
  if (!isRunning || isGameOver) {
    return;
  }

  isPaused = !isPaused;
  setStatus(isPaused ? 'Pausiert' : 'Spielen');
}

function finishGame() {
  isRunning = false;
  isPaused = false;
  isGameOver = true;
  setStatus('Game Over');
  recordHighScore();
  finalScoreEl.textContent = String(score);
  homeMenu.hidden = true;
  gameOverMenu.hidden = false;
  gameOverlay.hidden = false;
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function rotatePiece() {
  if (!currentPiece || isPaused || !isRunning || isGameOver) {
    return;
  }

  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2];

  for (const offset of kicks) {
    if (!collision(rotated, currentPiece.x + offset, currentPiece.y)) {
      currentPiece.matrix = rotated;
      currentPiece.x += offset;
      drawBoard();
      return;
    }
  }
}

function movePiece(dx, dy) {
  if (!currentPiece || isPaused || !isRunning || isGameOver) {
    return false;
  }

  const newX = currentPiece.x + dx;
  const newY = currentPiece.y + dy;

  if (collision(currentPiece.matrix, newX, newY)) {
    return false;
  }

  currentPiece.x = newX;
  currentPiece.y = newY;
  drawBoard();
  return true;
}

function moveDown() {
  if (!movePiece(0, 1)) {
    mergePiece();
    const cleared = clearLines();
    if (cleared > 0) {
      score += 0;
    }
    spawnPiece();
    drawBoard();
    updateHud();
  }
}

function hardDrop() {
  if (!isRunning || isPaused || isGameOver || !currentPiece) {
    return;
  }

  let distance = 0;
  while (!collision(currentPiece.matrix, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y += 1;
    distance += 1;
  }

  score += distance * 2;
  updateHud();
  mergePiece();
  clearLines();
  spawnPiece();
  drawBoard();
  updateHud();
}

function holdCurrentPiece() {
  if (!currentPiece || !canHold || !isRunning || isPaused || isGameOver) {
    return;
  }

  const currentType = currentPiece.type;

  if (!holdPiece) {
    holdPiece = createPiece(currentType);
    spawnPiece();
  } else {
    const swappedType = holdPiece.type;
    holdPiece = createPiece(currentType);
    currentPiece = createPiece(swappedType);
    currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
    currentPiece.y = -1;

    if (collision(currentPiece.matrix, currentPiece.x, currentPiece.y)) {
      finishGame();
      return;
    }
  }

  canHold = false;
  drawHoldPreview();
  drawBoard();
}

function handleKeydown(event) {
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    hardDrop();
    return;
  }

  if (event.key === 'p' || event.key === 'P') {
    pauseGame();
    return;
  }

  if (event.key === 'c' || event.key === 'C') {
    holdCurrentPiece();
    return;
  }

  if (!currentPiece || !isRunning || isGameOver) {
    return;
  }

  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      event.preventDefault();
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      event.preventDefault();
      movePiece(1, 0);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      event.preventDefault();
      score += 1;
      recordHighScore();
      updateHud();
      moveDown();
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      event.preventDefault();
      rotatePiece();
      break;
    default:
      break;
  }
}

startBtn.addEventListener('click', () => {
  startGame();
});

menuStartBtn.addEventListener('click', startGame);
menuRestartBtn.addEventListener('click', startGame);
menuHomeBtn.addEventListener('click', () => {
  resetGame();
  homeMenu.hidden = false;
  gameOverMenu.hidden = true;
  gameOverlay.hidden = false;
  setStatus('Bereit');
});

pauseBtn.addEventListener('click', () => {
  pauseGame();
});

resetBtn.addEventListener('click', () => {
  resetGame();
  homeMenu.hidden = false;
  gameOverMenu.hidden = true;
  gameOverlay.hidden = false;
  setStatus('Bereit');
});

document.addEventListener('keydown', handleKeydown);

document.querySelector('#pause-btn').classList.add('button-secondary');
document.querySelector('#reset-btn').classList.add('button-danger');
updateHud();
resetGame();
homeMenu.hidden = false;
gameOverMenu.hidden = true;
gameOverlay.hidden = false;
setStatus('Bereit');
loadHighScore();
