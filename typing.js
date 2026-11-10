"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "kidbyte_typing_progress_v1";
const SOUND_KEY = "kidbyteTypingSounds";

const LEVELS = {
    1: {
        name: "Home Row",
        description: "Start with simple home-row patterns.",
        patterns: [
            "asdf jkl;",
            "ff jj dd kk ss ll aa ;;",
            "asdf fdsa jkl; ;lkj",
            "fj fj dk dk sl sl a; a;",
            "sad dad ask all fall",
            "lad flask salad",
            "a sad lad asks dad",
            "all lads fall as dads ask",
            "j; f; d; k; s; l; a;",
            "asdf jkl; asdf jkl;"
        ]
    },

    2: {
        name: "Letter Practice",
        description: "Build confidence with common letters.",
        patterns: [
            "the and you are for",
            "red blue green yellow",
            "cat dog sun moon star",
            "make take like come",
            "we can learn new things",
            "little birds fly over trees",
            "happy kids make art",
            "read write learn create",
            "kind words make friends",
            "practice helps us improve"
        ]
    },

    3: {
        name: "Words",
        description: "Type useful words with steady rhythm.",
        patterns: [
            "computer keyboard monitor",
            "school pencil notebook",
            "garden flower butterfly",
            "planet rocket astronaut",
            "rainbow sunshine clouds",
            "picture story drawing",
            "music rhythm melody",
            "curiosity imagination discovery",
            "friendship kindness courage",
            "learning makes life exciting"
        ]
    },

    4: {
        name: "Sentences",
        description: "Practise sentences and capitalization.",
        patterns: [
            "I like to learn new things.",
            "The sun shines in the sky.",
            "My computer helps me create.",
            "We can write our own stories.",
            "Every day is a chance to learn.",
            "Small steps can lead to big ideas.",
            "I practise typing at my own pace.",
            "My friends and I enjoy creating.",
            "A curious mind asks good questions.",
            "Today I will learn something new."
        ]
    },

    5: {
        name: "Punctuation",
        description: "Practise punctuation and sentence flow.",
        patterns: [
            "Hello, friend! How are you?",
            "I can read, write, draw, and create.",
            "What a wonderful day!",
            "She said, \"Let's learn together.\"",
            "First, open the file; then save it.",
            "Wait... what happens next?",
            "Can you solve this puzzle?",
            "Yes, I can! Let's try again.",
            "Remember: practise makes progress.",
            "Wow! That is a great idea."
        ]
    },

    6: {
        name: "Numbers & Symbols",
        description: "Explore numbers and common symbols.",
        patterns: [
            "12345 67890",
            "2026 2027 2028",
            "2 + 3 = 5",
            "10 - 4 = 6",
            "5 * 6 = 30",
            "12 / 3 = 4",
            "price: $25.50",
            "score = 95%",
            "A1 B2 C3 D4",
            "100%, ready to learn!"
        ]
    },

    7: {
        name: "Speed Builder",
        description: "Build a steady rhythm without sacrificing accuracy.",
        patterns: [
            "fast fingers need calm minds",
            "steady practice builds typing skill",
            "focus on the next character",
            "smooth typing beats rushed typing",
            "accuracy comes before speed",
            "keep your hands relaxed",
            "look at the screen while typing",
            "short practice sessions build habits",
            "every correct key builds confidence",
            "find your rhythm and keep going"
        ]
    },

    8: {
        name: "Paragraphs",
        description: "Practise longer passages and complete thoughts.",
        patterns: [
            "Every computer has parts that work together. The keyboard sends instructions, and the screen shows the results.",
            "A garden grows when plants receive sunlight, water, and care. Learning also grows through practice and curiosity.",
            "A good story has characters, a setting, and events. Writers use words to help readers imagine new worlds.",
            "The internet connects computers around the world. We can use it to learn, share ideas, and discover useful information.",
            "Digital art lets people explore colours, shapes, and imagination. A simple drawing can become a wonderful creation."
        ]
    },

    9: {
        name: "Advanced",
        description: "Challenge yourself with longer words and varied punctuation.",
        patterns: [
            "Curiosity encourages exploration, experimentation, and discovery.",
            "Thoughtful preparation makes complicated projects easier to manage.",
            "Technology connects creativity with practical problem-solving.",
            "Independent learners ask questions, investigate ideas, and evaluate results.",
            "A well-organized workspace helps people concentrate on meaningful tasks."
        ]
    },

    10: {
        name: "Expert",
        description: "Combine punctuation, vocabulary, and sustained typing.",
        patterns: [
            "Technology is most useful when it helps people think, create, communicate, and solve meaningful problems.",
            "Developing a skill requires patience, consistent practice, thoughtful feedback, and a willingness to learn from mistakes.",
            "A creative project often begins with a simple question: what can I imagine, design, improve, or build today?",
            "Computers follow instructions precisely, but people provide the imagination, purpose, and judgment behind great ideas.",
            "The goal is not simply to type quickly; it is to communicate clearly, accurately, and confidently."
        ]
    }
};

const state = {
  level: 1,
  lesson: 1,
  text: "",
  startedAt: null,
  timerId: null,
  finished: false,
  audioContext: null,
  soundEnabled: true,
  lastInputValue: ""
};

function loadProgress() {
  const fallback = { bestWpm: 0, bestAccuracy: 0, completed: {}, records: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return fallback;
    return {
      bestWpm: Number(saved.bestWpm) || 0,
      bestAccuracy: Number(saved.bestAccuracy) || 0,
      completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
      records: saved.records && typeof saved.records === "object" ? saved.records : {}
    };
  } catch {
    return fallback;
  }
}

let progress = loadProgress();

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    showToast("Progress could not be saved in this browser.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function lessonKey(level, lesson) {
  return `${level}-${lesson}`;
}

function getLessonText(level, lesson) {
  const patterns = LEVELS[level].patterns;
  const pattern = patterns[(lesson - 1) % patterns.length];

  if (lesson <= 10) return pattern;

  if (level === 1) {
    const homeRows = ["asdf jkl; ", "fj dk sl a; ", "sad dad ask all ", "fall flask salad "];
    const base = homeRows[(lesson - 1) % homeRows.length];
    const repetitions = Math.min(2 + Math.floor((lesson - 1) / 20), 8);
    return base.repeat(repetitions).trim();
  }

  if (level === 2 || level === 3) {
    const extra = patterns[(lesson * 7) % patterns.length];
    const repetitions = 1 + Math.floor((lesson - 1) / 25);
    return (pattern + " " + extra + " ").repeat(Math.min(repetitions, 4)).trim();
  }

  if (level >= 8) {
    const extra = patterns[(lesson * 3) % patterns.length];
    return pattern + " " + extra;
  }

  const extra = patterns[(lesson * 7) % patterns.length];
  const repetitions = 1 + Math.floor((lesson - 1) / 20);
  return (pattern + " ").repeat(Math.min(repetitions, 5)).trim() + " " + extra;
}

function calculateMetrics() {
  const typed = $("typingInput").value;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === state.text[i]) correct++;
  }

  const elapsedSeconds = state.startedAt
    ? Math.max(1, (Date.now() - state.startedAt) / 1000)
    : 0;
  const elapsedMinutes = elapsedSeconds / 60;
  const wpm = elapsedMinutes > 0 ? Math.round((correct / 5) / elapsedMinutes) : 0;
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100;
  const progressPercent = state.text.length
    ? Math.min(100, (typed.length / state.text.length) * 100)
    : 0;

  return { typed, correct, elapsedSeconds, wpm, accuracy, progressPercent };
}

function updateMetrics() {
  const m = calculateMetrics();
  $("currentWpm").textContent = m.wpm;
  $("currentAccuracy").textContent = `${m.accuracy}%`;
  $("correctChars").textContent = m.correct;
  $("timer").textContent = formatTime(m.elapsedSeconds);
  $("progressBar").style.width = `${m.progressPercent}%`;
  $("progressText").textContent = `${Math.round(m.progressPercent)}% complete`;
  $("progressTrack").setAttribute("aria-valuenow", String(Math.round(m.progressPercent)));
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function renderPrompt() {
  const typed = $("typingInput").value;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < state.text.length; i++) {
    const span = document.createElement("span");
    span.textContent = state.text[i];
    if (i < typed.length) {
      span.className = typed[i] === state.text[i] ? "correct" : "incorrect";
    } else if (i === typed.length && !state.finished) {
      span.className = "current";
    }
    fragment.appendChild(span);
  }

  $("textDisplay").replaceChildren(fragment);
  updateMetrics();
}

function startTimer() {
  if (state.startedAt || state.finished) return;
  state.startedAt = Date.now();
  state.timerId = window.setInterval(updateMetrics, 250);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function setLesson(level, lesson, focusInput = true) {
  if (!LEVELS[level] || !Number.isInteger(lesson) || lesson < 1 || lesson > 100) {
    showToast("Choose a lesson number from 1 to 100.");
    return;
  }

  stopTimer();
  state.level = level;
  state.lesson = lesson;
  state.text = getLessonText(level, lesson);
  state.startedAt = null;
  state.finished = false;

  $("levelSelect").value = String(level);
  $("lessonNumber").value = String(lesson);
  $("currentLessonTitle").textContent = `Level ${level} · Lesson ${lesson}`;
  $("lessonDescription").textContent = LEVELS[level].description;
  $("levelBadge").textContent = `LEVEL ${level}`;

  $("typingInput").value = "";
  state.lastInputValue = "";
  $("typingInput").disabled = false;
  $("resultPanel").hidden = true;
  $("typingHint").textContent = "💡 Accuracy comes before speed. Take your time.";
  $("nextButton").disabled = false;

  renderPrompt();
  if (focusInput) $("typingInput").focus({ preventScroll: true });
}

function finishLesson() {
  if (state.finished) return;
  state.finished = true;
  stopTimer();

  const m = calculateMetrics();
  const key = lessonKey(state.level, state.lesson);
  const previous = progress.records[key] || {};

  progress.completed[key] = true;
  progress.bestWpm = Math.max(progress.bestWpm, m.wpm);
  progress.bestAccuracy = Math.max(progress.bestAccuracy, m.accuracy);
  progress.records[key] = {
    bestWpm: Math.max(previous.bestWpm || 0, m.wpm),
    bestAccuracy: Math.max(previous.bestAccuracy || 0, m.accuracy)
  };

  saveProgress();

  $("typingInput").disabled = true;
  $("resultPanel").hidden = false;
  $("resultWpm").textContent = `${m.wpm} WPM`;
  $("resultAccuracy").textContent = `${m.accuracy}%`;
  $("resultMessage").textContent = `${m.correct} correct characters · Level ${state.level}, lesson ${state.lesson}`;
  $("typingHint").textContent = "🎉 Lesson completed. You can retry or move to the next lesson.";

  playCompletionSound();
  showToast("Lesson complete! Your progress has been saved.");
}

function nextLesson() {
  let level = state.level;
  let lesson = state.lesson + 1;
  if (lesson > 100) {
    lesson = 1;
    level = level === 10 ? 1 : level + 1;
  }
  setLesson(level, lesson);
}

function handleTyping() {
  if (state.finished) return;
  const input = $("typingInput");
  if (input.value.length > state.text.length) {
    input.value = input.value.slice(0, state.text.length);
  }
  if (input.value.length > state.lastInputValue.length) {
    const added = input.value.length - state.lastInputValue.length;
    // One audible mechanical-style click per newly entered character.
    for (let i = 0; i < Math.min(added, 2); i++) playTypingSound();
  }
  state.lastInputValue = input.value;

  if (input.value.length > 0) startTimer();
  renderPrompt();

  if (input.value.length === state.text.length) finishLesson();
}

function playTone(frequency, duration = 0.055, volume = 0.16, wave = "triangle") {
  if (!state.soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!state.audioContext) state.audioContext = new AudioContextClass();
    if (state.audioContext.state === "suspended") state.audioContext.resume();

    const now = state.audioContext.currentTime;
    const oscillator = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    const filter = state.audioContext.createBiquadFilter();

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(180, frequency * 0.72), now + duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(state.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.005);
  } catch {
    // Audio is optional; typing must continue if sound is unavailable.
  }
}

function playTypingSound() {
  if (!state.soundEnabled) return;

  // A brief filtered-noise click is easier to hear than the old quiet sine beep.
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!state.audioContext) state.audioContext = new AudioContextClass();
    const context = state.audioContext;
    if (context.state === "suspended") context.resume();

    const duration = 0.032;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const fade = 1 - (i / length);
      samples[i] = (Math.random() * 2 - 1) * fade * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1850, context.currentTime);
    filter.Q.setValueAtTime(0.7, context.currentTime);
    gain.gain.setValueAtTime(0.22, context.currentTime);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
  } catch {
    // Audio is optional; typing continues if the browser blocks sound.
  }
}

function playCompletionSound() {
  if (!state.soundEnabled) return;
  [523, 659, 784].forEach((frequency, index) => {
    window.setTimeout(() => playTone(frequency, 0.16, 0.15, "sine"), index * 135);
  });
}

function initializeSound() {
  try {
    state.soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    state.soundEnabled = true;
  }
  $("typingSoundToggle").checked = state.soundEnabled;

  $("typingSoundToggle").addEventListener("change", event => {
    state.soundEnabled = event.target.checked;
    try {
      localStorage.setItem(SOUND_KEY, state.soundEnabled ? "on" : "off");
    } catch {}
    if (state.soundEnabled) playTone(740, 0.075, 0.17, "triangle");
  });
}

function bindEvents() {
  $("openLesson").addEventListener("click", () => {
    const level = Number($("levelSelect").value);
    const lesson = Number($("lessonNumber").value);
    setLesson(level, lesson);
  });

  $("lessonNumber").addEventListener("keydown", event => {
    if (event.key === "Enter") $("openLesson").click();
  });

  $("levelSelect").addEventListener("change", event => {
    // Selecting a level prepares lesson 1; Go confirms the lesson selection.
    $("lessonNumber").value = "1";
  });

  $("restartButton").addEventListener("click", () => setLesson(state.level, state.lesson));
  $("nextButton").addEventListener("click", nextLesson);
  $("resultNextButton").addEventListener("click", nextLesson);
  $("typingInput").addEventListener("input", handleTyping);

  $("typingInput").addEventListener("paste", event => {
    event.preventDefault();
    showToast("Try typing the text yourself. 💜");
  });

  $("typingInput").addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      showToast("Use the lesson controls to choose another lesson.");
    }
  });


  window.addEventListener("beforeunload", event => {
    if (state.startedAt && !state.finished && $("typingInput").value.length > 0) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

initializeSound();
bindEvents();
setLesson(1, 1, false);
