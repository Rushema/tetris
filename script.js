const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
context.scale(20, 20);

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
let dropCounter = 0;
let dropInterval = 1000;
let originalDropInterval = 1000;
let lastTime = 0;
let score = 0;
let highscore = parseInt(localStorage.getItem("tetrisHigh")) || 0;
highscoreEl.textContent = "Highscore: " + highscore;
let isGameRunning = false;
let isPaused = false;
let softDropActive = false;
let clearingRows = []; // array of { y, timeLeft }

const arena = createMatrix(12, 20);
const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
};

const colors = [null, "#FF0D72", "#0DC2FF", "#0DFF72", "#F538FF", "#FF8E0D", "#FFE138", "#3877FF"];

function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case "T":
      return [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ];
    case "O":
      return [
        [2, 2],
        [2, 2],
      ];
    case "L":
      return [
        [0, 3, 0],
        [0, 3, 0],
        [0, 3, 3],
      ];
    case "J":
      return [
        [0, 4, 0],
        [0, 4, 0],
        [4, 4, 0],
      ];
    case "I":
      return [
        [0, 0, 0, 0],
        [5, 5, 5, 5],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    case "S":
      return [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
      ];
    case "Z":
      return [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
      ];
  }
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = colors[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);

  // Efek kedipan baris yang akan dihapus
  clearingRows.forEach((row) => {
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.fillRect(0, row.y, arena[0].length, 1);
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function playerReset() {
  const pieces = "TJLOSZI";
  player.matrix = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
  if (collide(arena, player)) {
    isGameRunning = false;
    document.getElementById("bgm").pause();
    document.getElementById("gameOverMessage").style.display = "block";
    document.getElementById("startBtn").disabled = false;
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    playSound("drop");
  }
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach((row) => row.reverse());
  else matrix.reverse();
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
  playSound("rotate");
}

function updateScore(points) {
  score += points;
  scoreEl.textContent = "Score: " + score;
  if (score > highscore) {
    highscore = score;
    localStorage.setItem("tetrisHigh", highscore);
    highscoreEl.textContent = "Highscore: " + highscore;
  }
}

function animateRowClear(y) {
  clearingRows.push({ y, timeLeft: 300 }); // 300ms animasi
}

function arenaSweep() {
  let lines = 0;
  outer: for (let y = arena.length - 1; y >= 0; y--) {
    for (let x = 0; x < arena[y].length; x++) {
      if (arena[y][x] === 0) continue outer;
    }

    animateRowClear(y);
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y++;
    lines++;
    playSound("line-clear");
  }

  if (lines > 0) {
    updateScore(lines * 100);
  }
}

function playSound(type) {
  const sounds = {
    rotate: document.getElementById("rotate-sound"),
    "line-clear": document.getElementById("line-clear-sound"),
    drop: document.getElementById("drop-sound"),
  };
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play();
  }
}

function update(time = 0) {
  if (!isGameRunning || isPaused) return;
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
  clearingRows = clearingRows.filter((row) => {
    row.timeLeft -= deltaTime;
    return row.timeLeft > 0;
  });
}

document.getElementById("startBtn").addEventListener("click", () => {
  score = 0;
  scoreEl.textContent = "Score: 0";
  highscoreEl.textContent = "Highscore: " + highscore;
  isGameRunning = true;
  isPaused = false;
  dropInterval = originalDropInterval;
  document.getElementById("gameOverMessage").style.display = "none";
  document.getElementById("startBtn").disabled = true;
  document.getElementById("pauseBtn").textContent = "Pause";
  arena.forEach((row) => row.fill(0));
  document.getElementById("bgm").currentTime = 0;
  document.getElementById("bgm").play();
  playerReset();
  update();
});

document.getElementById("pauseBtn").addEventListener("click", () => {
  if (!isGameRunning) return;
  isPaused = !isPaused;
  document.getElementById("pauseBtn").textContent = isPaused ? "Resume" : "Pause";
  if (isPaused) {
    document.getElementById("bgm").pause();
  } else {
    document.getElementById("bgm").play();
    update();
  }
});

function startSoftDrop() {
  if (!isGameRunning || isPaused) return;
  dropInterval = 50;
  softDropActive = true;
}

function stopSoftDrop() {
  dropInterval = originalDropInterval;
  softDropActive = false;
}

function playerHardDrop() {
  if (!isGameRunning || isPaused) return;
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--; // mundur 1 langkah karena sudah nabrak
  merge(arena, player);
  playerReset();
  arenaSweep();
  playSound("drop");
  draw(); // gambar ulang langsung
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") playerMove(-1);
  else if (event.key === "ArrowRight") playerMove(1);
  else if (event.key === "ArrowDown") startSoftDrop();
  else if (event.key === "q") playerRotate(-1);
  else if (event.key === "e") playerRotate(1);
  else if (event.code === "Space") playerHardDrop();
});
