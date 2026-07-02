/**
 * Water Savior - Main Game Logic (Upgraded Campus Edition)
 * Implemented using clean, medium-level JavaScript and the Web Audio API.
 * Contains state management, audio synthesis, complex environmental hurdles, and trash thieves.
 */

// Difficulty levels config
const DIFFICULTY_SETTINGS = {
  basic: {
    label: "Easy",
    targetTrash: 20,
    seconds: 60,
    spawnMs: 900,
    obstacleChance: 0.15,
  },
  medium: {
    label: "Medium",
    targetTrash: 30,
    seconds: 55,
    spawnMs: 780,
    obstacleChance: 0.22,
  },
  hard: {
    label: "Hard",
    targetTrash: 40,
    seconds: 45,
    spawnMs: 650,
    obstacleChance: 0.30,
  },
};

const MILESTONE_MESSAGES = [
  { percent: 25, message: "Quarter clean. The river is starting to breathe again." },
  { percent: 50, message: "Halfway there. Keep the clean water momentum going." },
  { percent: 75, message: "Major impact. The river is almost restored." },
  { percent: 100, message: "Goal reached! Clean water mission complete." },
];

const TRASH_ITEMS = [
  { icon: "🥤", label: "plastic cup" },
  { icon: "🧴", label: "plastic bottle" },
  { icon: "🥫", label: "soda can" },
  { icon: "🛍️", label: "plastic bag" },
  { icon: "📦", label: "cardboard box" },
];

const OBSTACLE_ITEMS = [
  { icon: "☠️", label: "hazardous toxic drum" },
  { icon: "☢️", label: "biohazard waste" },
  { icon: "🪨", label: "sharp river rock" },
];

// App State
let currentDifficulty = "basic";
let score = 0;
let timeLeft = 60;
let trashRemoved = 0;
let cleanStreak = 0;
let isPaused = false;
let soundEnabled = true;
let triggeredMilestones = [];
let gameTimerInterval = null;
let spawnTimerInterval = null;
let environmentalHurdleInterval = null;
let activeThiefSpawnInterval = null;

// Hurdle State
let activeHurdle = null; // 'lightning', 'earthquake', 'tornado', 'smoke'
let hurdleDurationLeft = 0;
let isElectrocuted = false;

// Web Audio API Synthesizer
let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContext = new AudioContextConstructor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playTone(frequency, duration, type, volume) {
  if (!soundEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  try {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
}

function playSound(soundName) {
  if (!soundEnabled) return;

  switch (soundName) {
    case "button":
      playTone(420, 0.08, "triangle", 0.04);
      break;
    case "collect":
      playTone(640, 0.08, "sine", 0.05);
      setTimeout(() => playTone(860, 0.08, "sine", 0.04), 55);
      break;
    case "obstacle":
      playTone(160, 0.2, "sawtooth", 0.04);
      break;
    case "milestone":
      playTone(720, 0.09, "triangle", 0.05);
      setTimeout(() => playTone(960, 0.12, "triangle", 0.045), 75);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((frequency, index) => {
        setTimeout(() => playTone(frequency, 0.15, "triangle", 0.045), index * 85);
      });
      break;
    case "shock":
      // Lightning crackle sound
      playTone(800, 0.1, "sawtooth", 0.05);
      setTimeout(() => playTone(120, 0.25, "sawtooth", 0.06), 60);
      break;
    case "earthquake":
      // Low rumble
      playTone(55, 0.4, "triangle", 0.08);
      setTimeout(() => playTone(45, 0.4, "sawtooth", 0.08), 150);
      break;
    case "tornado":
      // Whistle up and down sweep
      playTone(300, 0.2, "sine", 0.04);
      setTimeout(() => playTone(500, 0.2, "sine", 0.04), 100);
      setTimeout(() => playTone(400, 0.2, "sine", 0.03), 200);
      break;
    case "smoke":
      playTone(180, 0.3, "triangle", 0.04);
      break;
    case "thiefSpawn":
      playTone(440, 0.1, "sawtooth", 0.03);
      setTimeout(() => playTone(330, 0.15, "sawtooth", 0.03), 80);
      break;
    case "thiefZapped":
      playTone(880, 0.08, "sine", 0.04);
      setTimeout(() => playTone(1100, 0.1, "sine", 0.04), 60);
      break;
    case "steal":
      playTone(200, 0.25, "sawtooth", 0.05);
      break;
  }
}

// Navigation & Screen Switcher
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
  }
}

// Home/Title Screen Setup
document.getElementById("startBtn")?.addEventListener("click", () => {
  playSound("button");
  showScreen("missionScreen");
});

// Mission Screen Setup
document.querySelectorAll("[data-level]").forEach(button => {
  button.addEventListener("click", (e) => {
    playSound("button");
    const level = e.currentTarget.getAttribute("data-level");
    startGame(level);
  });
});

document.getElementById("backToTitleBtn")?.addEventListener("click", () => {
  playSound("button");
  showScreen("titleScreen");
});

// Results Screen Setup
document.getElementById("homeResultsBtn")?.addEventListener("click", () => {
  playSound("button");
  clearConfetti();
  showScreen("titleScreen");
});

document.getElementById("playAgainBtn")?.addEventListener("click", () => {
  playSound("button");
  clearConfetti();
  startGame(currentDifficulty);
});

document.getElementById("nextLevelBtn")?.addEventListener("click", () => {
  playSound("button");
  clearConfetti();
  const nextDiff = currentDifficulty === "basic" ? "medium" : currentDifficulty === "medium" ? "hard" : "basic";
  startGame(nextDiff);
});

// Controls & Bottom Nav handlers inside Game
document.getElementById("gameHomeBtn")?.addEventListener("click", () => {
  playSound("button");
  stopAllGameIntervals();
  clearAllActiveHurdles();
  showScreen("titleScreen");
});

document.getElementById("gamePauseBtn")?.addEventListener("click", () => {
  playSound("button");
  togglePause();
});

document.getElementById("gameSoundBtn")?.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  playSound("button");
  const icon = document.getElementById("soundIcon");
  const text = document.getElementById("soundText");
  if (soundEnabled) {
    icon.innerHTML = "🔊";
    text.textContent = "Sound On";
  } else {
    icon.innerHTML = "🔇";
    text.textContent = "Sound Off";
  }
  // Reflect state for assistive technologies
  const soundBtn = document.getElementById("gameSoundBtn");
  if (soundBtn) {
    soundBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    soundBtn.setAttribute("aria-label", soundEnabled ? "Sound On" : "Sound Off");
  }
});

document.getElementById("gameResetBtn")?.addEventListener("click", () => {
  playSound("button");
  resetCurrentGame();
});

// Toggle Pause inside current active game
function togglePause() {
  isPaused = !isPaused;
  const pauseOverlay = document.getElementById("pauseOverlay");
  const pauseBtnText = document.getElementById("pauseBtnText");
  const pauseBtnIcon = document.getElementById("pauseBtnIcon");
  const feedbackEl = document.getElementById("gameFeedback");

  if (isPaused) {
    pauseOverlay.classList.remove("hidden");
    pauseOverlay.classList.add("flex");
    pauseBtnText.textContent = "Resume Mission";
    pauseBtnIcon.textContent = "▶️";
    feedbackEl.textContent = "Mission paused. Click Resume to continue.";
  } else {
    pauseOverlay.classList.add("hidden");
    pauseOverlay.classList.remove("flex");
    pauseBtnText.textContent = "Pause Mission";
    pauseBtnIcon.textContent = "⏸️";
    feedbackEl.textContent = "Mission resumed. Tap to clean!";
  }
  // Update ARIA state on the pause button for screen readers
  const pauseBtn = document.getElementById("gamePauseBtn");
  if (pauseBtn) {
    pauseBtn.setAttribute("aria-pressed", isPaused ? "true" : "false");
    pauseBtn.setAttribute("aria-label", isPaused ? "Resume Mission" : "Pause Mission");
  }
}

// Reset Game state completely
function resetCurrentGame() {
  stopAllGameIntervals();
  clearAllActiveHurdles();
  score = 0;
  timeLeft = DIFFICULTY_SETTINGS[currentDifficulty].seconds;
  trashRemoved = 0;
  cleanStreak = 0;
  isPaused = false;
  triggeredMilestones = [];

  // Hide pause overlay
  const pauseOverlay = document.getElementById("pauseOverlay");
  pauseOverlay.classList.add("hidden");
  pauseOverlay.classList.remove("flex");
  document.getElementById("pauseBtnText").textContent = "Pause Mission";
  document.getElementById("pauseBtnIcon").textContent = "⏸️";

  // Reset feedback
  document.getElementById("gameFeedback").textContent = "River status reset! Select trash items to clean.";

  // Clean play arena
  const river = document.getElementById("riverArena");
  if (river) {
    river.querySelectorAll(".spawned-item, .trash-thief, .floating-text-indicator").forEach(el => el.remove());
  }

  // Clear milestone signals log
  const signalList = document.getElementById("milestoneSignals");
  if (signalList) {
    signalList.innerHTML = `<div class="bg-white/5 rounded-lg p-3 text-[11px] leading-tight text-white/40 italic border-l-4 border-white/10">Signals will appear as cleanup progress improves.</div>`;
  }

  updateUI();
  startGameLoop();
}

// Start Game Entry point
function startGame(level) {
  currentDifficulty = level;
  score = 0;
  timeLeft = DIFFICULTY_SETTINGS[level].seconds;
  trashRemoved = 0;
  cleanStreak = 0;
  isPaused = false;
  triggeredMilestones = [];

  // Clean play arena
  const river = document.getElementById("riverArena");
  if (river) {
    river.querySelectorAll(".spawned-item, .trash-thief, .floating-text-indicator").forEach(el => el.remove());
  }

  // Clear milestone signals log
  const signalList = document.getElementById("milestoneSignals");
  if (signalList) {
    signalList.innerHTML = `<div class="bg-white/5 rounded-lg p-3 text-[11px] leading-tight text-white/40 italic border-l-4 border-white/10">Signals will appear as cleanup progress improves.</div>`;
  }

  // Hide pause overlay
  const pauseOverlay = document.getElementById("pauseOverlay");
  pauseOverlay.classList.add("hidden");
  pauseOverlay.classList.remove("flex");
  document.getElementById("pauseBtnText").textContent = "Pause Mission";
  document.getElementById("pauseBtnIcon").textContent = "⏸️";

  // Clear overlays
  clearAllActiveHurdles();

  // Setup UI texts
  document.getElementById("gameFeedback").textContent = "Tap floating trash to clean the river!";
  document.getElementById("gameLevelLabel").textContent = `charity: water campus edition • ${DIFFICULTY_SETTINGS[level].label}`;
  
  // Set Objective Targets
  document.getElementById("objectiveTargetText").textContent = `Collect ${DIFFICULTY_SETTINGS[level].targetTrash} items (0/${DIFFICULTY_SETTINGS[level].targetTrash})`;
  document.getElementById("objectiveHazardText").textContent = `Avoid storm hazards (${Math.round(DIFFICULTY_SETTINGS[level].obstacleChance * 100)}% chance)`;
  document.getElementById("objectiveTimeText").textContent = `Complete within ${DIFFICULTY_SETTINGS[level].seconds}s limit`;

  showScreen("gameScreen");
  updateUI();

  stopAllGameIntervals();
  startGameLoop();
}

// Stopping all interval timers
function stopAllGameIntervals() {
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  if (spawnTimerInterval) clearInterval(spawnTimerInterval);
  if (environmentalHurdleInterval) clearInterval(environmentalHurdleInterval);
  if (activeThiefSpawnInterval) clearInterval(activeThiefSpawnInterval);
}

// Start core active game loops
function startGameLoop() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];

  // Core elapsed ticking timer
  gameTimerInterval = setInterval(() => {
    if (isPaused) return;

    if (timeLeft <= 1) {
      stopAllGameIntervals();
      clearAllActiveHurdles();
      handleGameOver();
      return;
    }

    timeLeft--;
    updateTimerDisplay();

    // Hurdle ticks
    if (activeHurdle) {
      hurdleDurationLeft--;
      const hurdleBanner = document.getElementById("hurdleBanner");
      const hurdleText = document.getElementById("hurdleBannerText");
      if (hurdleDurationLeft <= 0) {
        clearAllActiveHurdles();
      } else {
        if (hurdleText) {
          hurdleText.textContent = `⚠️ HURDLE ACTIVE: ${activeHurdle.toUpperCase()} (${hurdleDurationLeft}s)`;
        }
      }
    }
  }, 1000);

  // Spawner interval loop
  spawnTimerInterval = setInterval(() => {
    if (isPaused) return;
    spawnItem();
  }, settings.spawnMs);

  // If Medium or Hard, trigger environmental hurdles randomly
  if (currentDifficulty === "medium" || currentDifficulty === "hard") {
    environmentalHurdleInterval = setInterval(() => {
      if (isPaused || activeHurdle) return;
      // 35% chance to start a random hurdle every 8 seconds
      if (Math.random() < 0.4) {
        triggerEnvironmentalHurdle();
      }
    }, 8000);
  }

