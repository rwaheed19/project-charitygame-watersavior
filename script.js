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

  // If Hard, spawn Trash Thieves
  if (currentDifficulty === "hard") {
    activeThiefSpawnInterval = setInterval(() => {
      if (isPaused) return;
      // 50% chance to spawn a Thief every 7 seconds if trash exists
      if (Math.random() < 0.6) {
        spawnTrashThief();
      }
    }, 7000);
  }
}

// Trigger random environmental event hurdles
function triggerEnvironmentalHurdle() {
  const hurdles = ["lightning", "earthquake", "tornado", "smoke"];
  const selected = hurdles[Math.floor(Math.random() * hurdles.length)];
  
  activeHurdle = selected;
  hurdleDurationLeft = 5; // Event lasts 5 seconds as specified

  const banner = document.getElementById("hurdleBanner");
  const bannerText = document.getElementById("hurdleBannerText");
  const arena = document.getElementById("riverArena");

  if (banner) {
    banner.classList.remove("hidden");
    banner.classList.add("flex");
  }

  appendMilestoneSignal(`Environmental alert: A temporary ${selected.toUpperCase()} hurdle has hit the river!`);

  switch (selected) {
    case "lightning":
      playSound("shock");
      isElectrocuted = true;
      document.getElementById("lightningOverlay")?.classList.remove("hidden");
      document.getElementById("lightningOverlay")?.classList.add("flex");
      document.getElementById("gameFeedback").textContent = "🌩️ Electrocuted! Hand controls locked for 5s!";
      if (bannerText) bannerText.textContent = "🌩️ HURDLE ACTIVE: LIGHTNING STORM (5s)";
      break;

    case "earthquake":
      playSound("earthquake");
      arena.classList.add("earthquake-active");
      document.getElementById("gameFeedback").textContent = "🫨 Earthquake Tremor! Stay steady as river shakes!";
      if (bannerText) bannerText.textContent = "🫨 HURDLE ACTIVE: EARTHQUAKE TREMOR (5s)";
      break;

    case "tornado":
      playSound("tornado");
      arena.classList.add("tornado-active");
      document.getElementById("gameFeedback").textContent = "🌪️ Tornado Gale! Trash elements are spinning in the air!";
      if (bannerText) bannerText.textContent = "🌪️ HURDLE ACTIVE: TORNADO GALE (5s)";
      break;

    case "smoke":
      playSound("smoke");
      const smokeOverlay = document.getElementById("smokeOverlay");
      if (smokeOverlay) {
        smokeOverlay.classList.remove("hidden");
        smokeOverlay.classList.add("flex");
        // Trigger smooth fade in
        setTimeout(() => {
          smokeOverlay.style.opacity = "0.96";
        }, 50);
      }
      document.getElementById("gameFeedback").textContent = "💨 Factory Smoke Blinding! Find the hidden trash!";
      if (bannerText) bannerText.textContent = "💨 HURDLE ACTIVE: FACTORY SMOKE (5s)";
      break;
  }
}

// Reset overlays & visual elements for environmental hurdles
function clearAllActiveHurdles() {
  activeHurdle = null;
  isElectrocuted = false;
  hurdleDurationLeft = 0;

  document.getElementById("hurdleBanner")?.classList.add("hidden");
  document.getElementById("lightningOverlay")?.classList.add("hidden");
  
  const smokeOverlay = document.getElementById("smokeOverlay");
  if (smokeOverlay) {
    smokeOverlay.style.opacity = "0";
    setTimeout(() => {
      smokeOverlay.classList.add("hidden");
    }, 500);
  }

  const arena = document.getElementById("riverArena");
  if (arena) {
    arena.classList.remove("earthquake-active");
    arena.classList.remove("tornado-active");
  }
}

// Generate a random floating item inside the arena
function spawnItem() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const isObstacle = Math.random() < settings.obstacleChance;
  const source = isObstacle ? OBSTACLE_ITEMS : TRASH_ITEMS;
  const itemConfig = source[Math.floor(Math.random() * source.length)];

  const id = "item-" + Math.random().toString(36).substring(2, 9);
  const left = Math.random() * 80 + 10; // random coordinate percentage
  const top = Math.random() * 75 + 12;

  const itemEl = document.createElement("button");
  itemEl.id = id;
  // If Tornado is active, let's rotate individual elements as well
  const extraClasses = activeHurdle === "tornado" ? "tornado-active" : "";
  itemEl.className = `spawned-item absolute -translate-x-1/2 -translate-y-1/2 p-0 cursor-pointer transition-transform select-none focus:outline-none focus:ring-4 focus:ring-white z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl animate-fade-in ${extraClasses} ${
    isObstacle 
      ? "bg-red-500/20 hover:bg-red-500/40 border-4 border-red-500/40 focus:ring-red-300" 
      : "bg-white/40 hover:bg-white/60 border-4 border-white/60 focus:ring-cyan-300"
  }`;
  itemEl.style.left = `${left}%`;
  itemEl.style.top = `${top}%`;
  itemEl.setAttribute("type", "button");
  itemEl.setAttribute("aria-label", isObstacle ? `Avoid ${itemConfig.label}. Hazard debris.` : `Collect ${itemConfig.label}. Cleaner item.`);

  // Inner span for bouncy scale look
  const innerSpan = document.createElement("span");
  innerSpan.className = "transform hover:scale-110 active:scale-90 transition-transform duration-100 select-none pointer-events-none";
  innerSpan.textContent = itemConfig.icon;
  itemEl.appendChild(innerSpan);

  // Add click collection event handler
  itemEl.addEventListener("click", (e) => {
    handleCollectItem(id, isObstacle ? "bad" : "good", itemConfig.label, left, top);
  });

  document.getElementById("riverArena").appendChild(itemEl);

  // Auto clean/despawn item after 2.4s if not collected
  setTimeout(() => {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }
  }, 2400);
}

// Spawn Trash Thief Bad Agent (🤖 or 👾)
function spawnTrashThief() {
  const arena = document.getElementById("riverArena");
  if (!arena) return;

  // Gather active trash items
  const activeTrash = Array.from(arena.querySelectorAll(".spawned-item")).filter(el => {
    return !el.className.includes("border-red-500"); // Just cleanable items, not obstacles
  });

  if (activeTrash.length === 0) return; // No targets to hunt down

  // Pick closest or random active trash item
  const targetEl = activeTrash[Math.floor(Math.random() * activeTrash.length)];
  const targetId = targetEl.id;

  playSound("thiefSpawn");

  // Create a cute moving agent sprite
  const thiefId = "thief-" + Math.random().toString(36).substring(2, 9);
  const thiefEl = document.createElement("button");
  thiefEl.id = thiefId;
  thiefEl.className = "trash-thief absolute -translate-x-1/2 -translate-y-1/2 p-0 cursor-pointer transition-all duration-1000 ease-out z-20 w-14 h-14 bg-red-600 border-4 border-red-400 text-2xl flex items-center justify-center rounded-full shadow-2xl animate-bounce hover:scale-110";
  
  // Starting point (random border boundary)
  const startLeft = Math.random() < 0.5 ? 5 : 95;
  const startTop = Math.random() * 80 + 10;
  thiefEl.style.left = `${startLeft}%`;
  thiefEl.style.top = `${startTop}%`;
  thiefEl.innerHTML = "<span class='pointer-events-none'>🤖</span>";
  thiefEl.setAttribute("type", "button");
  thiefEl.setAttribute("aria-label", "Pollution Hunter / Trash Thief. Tap to zap!");

  // Tap/Click handler to "zap" the thief
  thiefEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isPaused || isElectrocuted) return;
    playSound("thiefZapped");
    thiefEl.remove();
    score += 15;
    document.getElementById("gameFeedback").textContent = "⚡ Thief zapped! Protected river bonus: +15!";
    spawnFloatingTextIndicator("+15 ⚡", "zap", parseFloat(thiefEl.style.left), parseFloat(thiefEl.style.top));
    updateUI();
  });

  arena.appendChild(thiefEl);

  // Smoothly move the thief towards the target trash element after a slight delay
  setTimeout(() => {
    const freshThief = document.getElementById(thiefId);
    const freshTarget = document.getElementById(targetId);
    if (freshThief && freshTarget) {
      // Guide thief position to target coordinates
      freshThief.style.left = freshTarget.style.left;
      freshThief.style.top = freshTarget.style.top;

      // After 1.2s arrival, consume/steal the item
      setTimeout(() => {
        const arrivalThief = document.getElementById(thiefId);
        const arrivalTarget = document.getElementById(targetId);
        if (arrivalThief && arrivalTarget) {
          playSound("steal");
          arrivalTarget.remove();
          arrivalThief.remove();
          
          score = Math.max(0, score - 10);
          document.getElementById("gameFeedback").textContent = "🤖 Pollution Hunter stole a trash item! -10 points!";
          spawnFloatingTextIndicator("-10 🤖", "bad", parseFloat(arrivalTarget.style.left), parseFloat(arrivalTarget.style.top));
          updateUI();
        }
      }, 1200);
    }
  }, 100);
}

// Trigger collect scoring and milestones
function handleCollectItem(itemId, itemType, itemLabel, left, top) {
  if (isPaused) return;

  // If electrocuted by lightning storm, ignore clicks
  if (isElectrocuted) {
    playSound("obstacle");
    return;
  }

  const itemEl = document.getElementById(itemId);
  if (!itemEl) return;
  itemEl.remove();

  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  let scoreChange = 0;
  let floatingText = "";

  if (itemType === "bad") {
    // Collect/Collide obstacle debris
    playSound("obstacle");
    cleanStreak = 0;
    scoreChange = -15;
    floatingText = "-15";
    score = Math.max(0, score - 15);
    document.getElementById("gameFeedback").textContent = `Obstacle hit (${itemLabel})! 15 points lost.`;
  } else {
    // Collected clean water item successfully
    playSound("collect");
    trashRemoved++;
    cleanStreak++;

    const isStreakBonus = cleanStreak > 0 && cleanStreak % 5 === 0;
    scoreChange = isStreakBonus ? 20 : 10;
    floatingText = isStreakBonus ? "+20 🔥" : "+10";
    score += scoreChange;
    document.getElementById("gameFeedback").textContent = isStreakBonus ? "Clean streak! 20 bonus points!" : `Removed ${itemLabel}.`;

    // Process river restoration milestones
    const healthPercent = Math.min(100, Math.round((trashRemoved / settings.targetTrash) * 100));
    MILESTONE_MESSAGES.forEach((m) => {
      if (healthPercent >= m.percent && !triggeredMilestones.includes(m.message)) {
        triggeredMilestones.push(m.message);
        playSound("milestone");
        document.getElementById("gameFeedback").textContent = m.message;
        appendMilestoneSignal(m.message);
      }
    });

    // Check instant completion condition
    if (trashRemoved >= settings.targetTrash) {
      stopAllGameIntervals();
      clearAllActiveHurdles();
      setTimeout(() => {
        handleGameOver(true);
      }, 500);
      return;
    }
  }

  // Spawn visual floating numeric feedback in the arena
  spawnFloatingTextIndicator(floatingText, itemType, left, top);
  updateUI();
}

// Append live milestone signals in the sidebar log
function appendMilestoneSignal(message) {
  const signalList = document.getElementById("milestoneSignals");
  if (signalList) {
    // Clean initial fallback line if first message
    if (triggeredMilestones.length === 1) {
      signalList.innerHTML = "";
    }
    const signalItem = document.createElement("div");
    signalItem.className = "bg-white/5 rounded-lg p-3 text-[11px] leading-tight text-[#ffc907] italic border-l-4 border-[#ffc907] shadow-sm animate-fade-in";
    signalItem.textContent = `"${message}"`;
    signalList.appendChild(signalItem);
    signalList.scrollTop = signalList.scrollHeight;
  }
}

// Spawn absolute coordinates score pop indicators (+10 / -15)
function spawnFloatingTextIndicator(text, type, left, top) {
  const textId = "float-" + Math.random().toString(36).substring(2, 9);
  const textEl = document.createElement("span");
  textEl.id = textId;
  textEl.className = `floating-text-indicator absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-black text-white pointer-events-none z-35 shadow-lg select-none transition-all duration-700 ease-out opacity-100 scale-100 ${
    type === "bad" ? "bg-red-500 border border-red-400" : type === "zap" ? "bg-amber-500 border border-amber-400" : "bg-emerald-600 border border-emerald-500"
  }`;
  textEl.style.left = `${left}%`;
  textEl.style.top = `${top}%`;
  textEl.textContent = text;

  document.getElementById("riverArena").appendChild(textEl);

  // Push upwards animation
  setTimeout(() => {
    textEl.style.transform = "translate(-50%, -100px) scale(1.1)";
    textEl.style.opacity = "0";
  }, 20);

  // Clean element
  setTimeout(() => {
    textEl.remove();
  }, 750);
}

// Timer rendering
function updateTimerDisplay() {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  document.getElementById("gameTimer").textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Dynamic updates for indicators, health bars, background colors, and active achievements
function updateUI() {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  
  // Score indicator
  document.getElementById("gameScore").textContent = score;

  // Objective targets tracker
  document.getElementById("objectiveTargetText").textContent = `Collect ${settings.targetTrash} items (${trashRemoved}/${settings.targetTrash})`;

  // River health state progress bar calculation
  const healthPercent = Math.min(100, Math.round((trashRemoved / settings.targetTrash) * 100));
  const healthBar = document.getElementById("riverHealthBar");
  const healthPercentText = document.getElementById("riverHealthPercentText");
  const healthStatusText = document.getElementById("riverHealthStatusText");
  
  healthBar.style.width = `${healthPercent}%`;
  healthPercentText.textContent = `${healthPercent}%`;

  // Change backgrounds & status labels based on current river cleanliness
  const arena = document.getElementById("riverArena");
  if (healthPercent >= 75) {
    healthStatusText.textContent = "The water is pure and clear!";
    arena.style.backgroundColor = "#1f7ca4"; // Clean blue
  } else {
    healthStatusText.textContent = "The water is starting to clear up!";
    arena.style.backgroundColor = "#253f4c"; // Initial dark murky blue
  }

  // Achievements dynamic lock indicator updates
  const cleanStreakUnlock = cleanStreak >= 5;
  const streakBadge = document.getElementById("badgeStreak");
  const streakStatus = document.getElementById("badgeStreakStatus");
  if (cleanStreakUnlock) {
    streakBadge.className = "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
    streakStatus.textContent = "ACTIVE";
  } else {
    streakBadge.className = "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] bg-white/5 border-white/5 text-white/30";
    streakStatus.textContent = "LOCKED";
  }

  const fastRestoreUnlock = timeLeft >= 30 && trashRemoved >= 10;
  const fastBadge = document.getElementById("badgeFast");
  const fastStatus = document.getElementById("badgeFastStatus");
  if (fastRestoreUnlock) {
    fastBadge.className = "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
    fastStatus.textContent = "ACTIVE";
  } else {
    fastBadge.className = "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] bg-white/5 border-white/5 text-white/30";
    fastStatus.textContent = "LOCKED";
  }

  updateTimerDisplay();
}

// Win/Lose resolution screen builder
function handleGameOver(forcedWin = false) {
  const settings = DIFFICULTY_SETTINGS[currentDifficulty];
  const winState = forcedWin || (trashRemoved >= settings.targetTrash);

  // Play audio sound matching end state
  if (winState) {
    playSound("win");
    startConfetti();
  } else {
    playSound("obstacle");
  }

  // Toggle dynamic win message and visual titles
  const resultsEmoji = document.getElementById("resultsEmoji");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsDesc = document.getElementById("resultsDesc");
  const rewardCard = document.getElementById("rewardCard");

  if (winState) {
    resultsEmoji.textContent = "🏆";
    resultsTitle.textContent = "Mission Complete!";
    resultsTitle.className = "text-2xl font-extrabold uppercase font-display tracking-tight text-[#ffc907]";
    resultsDesc.textContent = "Amazing work! The river has been restored, returning pure drinking water to local species.";
    rewardCard.className = "p-4 rounded-xl text-center mb-6 border bg-[#ffc907] border-white/10 text-[#0a1558] select-none";
    rewardCard.innerHTML = `<strong class="block text-xs uppercase tracking-widest font-black">🔥 Campus Reward Unlocked!</strong>
                            <span class="block text-xs font-black mt-1.5 uppercase tracking-wide">Cafe Drink Code: CLEAN</span>`;
    
    // Show Next Level button if basic or medium
    if (currentDifficulty !== "hard") {
      document.getElementById("nextLevelBtn").classList.remove("hidden");
    } else {
      document.getElementById("nextLevelBtn").classList.add("hidden");
    }
  } else {
    resultsEmoji.textContent = "😔";
    resultsTitle.textContent = "Mission Failed";
    resultsTitle.className = "text-2xl font-extrabold uppercase font-display tracking-tight text-white";
    resultsDesc.textContent = "The pollution overcame the river. Do not give up - try again to clean it up!";
    rewardCard.className = "p-4 rounded-xl text-center mb-6 border bg-white/5 border-white/5 text-white/40 select-none";
    rewardCard.innerHTML = `<strong class="block text-xs uppercase tracking-widest font-black">🔒 Reward Locked</strong>
                            <span class="block text-xs font-black mt-1.5 uppercase tracking-wide">Clean the target trash to unlock rewards</span>`;
    document.getElementById("nextLevelBtn").classList.add("hidden");
  }

  // Populate dynamic cards stats grids
  document.getElementById("resultsScore").textContent = score;
  document.getElementById("resultsRemoved").textContent = trashRemoved;
  document.getElementById("resultsHealth").textContent = `${Math.min(100, Math.round((trashRemoved / settings.targetTrash) * 100))}%`;

  showScreen("resultsScreen");
}

// Confetti elements generator
function startConfetti() {
  const container = document.getElementById("confettiContainer");
  if (!container) return;
  container.innerHTML = "";

  const colors = ["#ffc907", "#2e9df7", "#172a88", "#12b7e8", "#ffffff"];

  for (let i = 0; i < 42; i++) {
    const particle = document.createElement("div");
    particle.className = "confetti-particle";
    
    const delay = Math.random() * 0.4;
    const duration = 1.2 + Math.random() * 0.6;
    const left = Math.random() * 100;
    const color = colors[i % colors.length];

    particle.style.left = `${left}%`;
    particle.style.backgroundColor = color;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;

    container.appendChild(particle);
  }
}

function clearConfetti() {
  const container = document.getElementById("confettiContainer");
  if (container) {
    container.innerHTML = "";
  }
}

// Initialize accessibility attributes on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const pauseBtn = document.getElementById("gamePauseBtn");
  if (pauseBtn) {
    pauseBtn.setAttribute("aria-pressed", "false");
    pauseBtn.setAttribute("aria-label", "Pause Mission");
  }

  const soundBtn = document.getElementById("gameSoundBtn");
  if (soundBtn) {
    soundBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    soundBtn.setAttribute("aria-label", soundEnabled ? "Sound On" : "Sound Off");
  }

  // Ensure river arena is focusable and has a region role for screen readers
  const arena = document.getElementById("riverArena");
  if (arena) {
    arena.setAttribute("role", "region");
    arena.setAttribute("tabindex", "0");
  }
});
