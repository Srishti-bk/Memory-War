/**
 * ============================================================================
 * MEMORY WAR — Vanilla JavaScript Game Engine
 * A same-device party memory game for 2 to 6 players across 5 intense rounds.
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. SOUND SYNTHESIS (Zero external dependencies, Web Audio API)
  // --------------------------------------------------------------------------
  const Sound = {
    ctx: null,
    muted: false,

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    toggleMute() {
      this.muted = !this.muted;
      return !this.muted;
    },

    playTone(freq, type = 'sine', duration = 0.1, gainValue = 0.15) {
      if (this.muted) return;
      try {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        console.warn('Audio play error:', e);
      }
    },

    tick() {
      this.playTone(600, 'sine', 0.05, 0.08);
    },

    go() {
      this.playTone(880, 'triangle', 0.25, 0.2);
    },

    click() {
      this.playTone(440, 'sine', 0.04, 0.1);
    },

    correct() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      // Happy major arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'triangle', 0.18, 0.18);
        }, idx * 75);
      });
    },

    wrong() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      // Low buzz
      this.playTone(180, 'sawtooth', 0.25, 0.2);
      setTimeout(() => {
        this.playTone(140, 'sawtooth', 0.35, 0.2);
      }, 100);
    },

    fanfare() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const fanfareNotes = [523.25, 659.25, 783.99, 659.25, 1046.5];
      fanfareNotes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, 'triangle', 0.25, 0.22);
        }, idx * 120);
      });
    }
  };

  // --------------------------------------------------------------------------
  // 2. EMOJI POOL FOR RANDOMIZATION
  // --------------------------------------------------------------------------
  const EMOJI_POOL = [
    // Animals
    '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
    '🐸', '🐵', '🐔', '🐧', '🦆', '🦅', '🦉', '🦇', '🦋', '🐙', '🦄', '🐝',
    // Food & Fruits
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝',
    '🥑', '🌽', '🍕', '🍔', '🍟', '🌭', '🍩', '🍪', '🍰', '🍫', '🍿', '🍦',
    // Objects & Vehicles
    '🚗', '🚕', '🏎️', '🚀', '🛸', '✈️', '⛵', '🚲', '🚁', '🚂', '⚽', '🏀',
    '🎸', '🎮', '💎', '🔔', '👑', '🎁', '🎈', '🔑', '💡', '🏆', '🎯', '🎨',
    // Nature & Symbols
    '🌸', '🌻', '🌲', '🌴', '🌵', '🍄', '🌈', '⭐', '🌙', '☀️', '⚡', '🌊',
    '🔥', '❄️', '🍀', '✨', '🪐', '🔮', '🧸', '🚀', '🧭', '⛺', '🏝️', '🌋'
  ];

  const DEFAULT_AVATARS = ['🐱', '🐶', '🦊', '🐼', '🦁', '🐯'];
  const PLAYER_COLORS = [
    '#6366f1', // Indigo (P1)
    '#10b981', // Emerald (P2)
    '#f43f5e', // Rose (P3)
    '#f59e0b', // Amber (P4)
    '#a855f7', // Purple (P5)
    '#06b6d4'  // Cyan (P6)
  ];

  // Helper: Shuffle array in-place
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Helper: Pick N distinct random emojis
  function getRandomEmojis(count, exclude = []) {
    const available = EMOJI_POOL.filter(e => !exclude.includes(e));
    const shuffled = shuffleArray(available);
    return shuffled.slice(0, count);
  }

  // Helper: Assign funny performance titles based on score
  function getFunnyTitle(score, maxScore = 7) {
    const ratio = score / maxScore;
    if (ratio >= 0.8) {
      return { title: '🧠 Memory Master', desc: 'Unbelievable photographic memory!' };
    } else if (ratio >= 0.55) {
      return { title: '👀 Sharp Eyes', desc: 'Hawk-like observation skills!' };
    } else if (ratio >= 0.3) {
      return { title: '⚡ Quick Thinker', desc: 'Fast instincts with room to grow!' };
    } else {
      return { title: '😂 Lucky Guesser', desc: 'Playing for pure vibes and chaos!' };
    }
  }

  // --------------------------------------------------------------------------
  // 3. GAME STATE
  // --------------------------------------------------------------------------
  const GameState = {
    numPlayers: 3,
    players: [], // { id, name, avatar, color, totalScore, roundScores: [0,0,0,0,0] }
    currentRoundIndex: 0, // 0 = Round 1 ... 4 = Round 5
    currentPlayerIndex: 0,
    timerInterval: null,
    timerSecondsRemaining: 0,
    isTimerRunning: false,
    roundData: {}, // Holds data specific to the active round/turn
    r5QuestionIndex: 0, // 0, 1, 2 for Round 5 questions
    r5CorrectCountForTurn: 0
  };

  const ROUND_INFO = [
    { number: 1, name: 'Remember The Order', instruction: 'Memorize the exact order of the emojis!' },
    { number: 2, name: 'What Changed?', instruction: 'Memorize the items! One will change.' },
    { number: 3, name: 'Where Was It?', instruction: 'Memorize the position of each item in the grid!' },
    { number: 4, name: "What's Missing?", instruction: 'Memorize all items! One will disappear.' },
    { number: 5, name: 'Final Memory War', instruction: 'Grand Finale! Memorize the sequence for 3 test questions!' }
  ];

  // --------------------------------------------------------------------------
  // 4. DOM ELEMENTS CACHE
  // --------------------------------------------------------------------------
  const DOM = {
    // Header & Modals
    header: document.getElementById('game-header'),
    roundIndicator: document.getElementById('round-indicator'),
    playerPill: document.getElementById('current-player-pill'),
    playerAvatar: document.getElementById('player-badge-avatar'),
    playerName: document.getElementById('player-badge-name'),
    playerScore: document.getElementById('player-badge-score'),
    btnToggleScoreboard: document.getElementById('btn-toggle-scoreboard'),
    btnToggleSound: document.getElementById('btn-toggle-sound'),
    btnQuitGame: document.getElementById('btn-quit-game'),

    modalScoreboard: document.getElementById('modal-scoreboard'),
    miniScoreboardList: document.getElementById('mini-scoreboard-list'),
    btnCloseScoreboard: document.getElementById('btn-close-scoreboard'),
    btnDoneScoreboard: document.getElementById('btn-done-scoreboard'),

    modalQuit: document.getElementById('modal-quit'),
    btnConfirmQuit: document.getElementById('btn-confirm-quit'),
    btnCancelQuit: document.getElementById('btn-cancel-quit'),

    // Screens
    screenHome: document.getElementById('screen-home'),
    screenSetup: document.getElementById('screen-setup'),
    screenTransition: document.getElementById('screen-transition'),
    screenGame: document.getElementById('screen-game'),
    screenResults: document.getElementById('screen-results'),

    // Home
    btnStartGame: document.getElementById('btn-start-game'),

    // Setup
    playerCountButtons: document.getElementById('player-count-buttons'),
    playerNamesContainer: document.getElementById('player-names-container'),
    btnBackHome: document.getElementById('btn-back-home'),
    btnContinueSetup: document.getElementById('btn-continue-setup'),

    // Transition
    transAvatar: document.getElementById('trans-avatar'),
    transPlayerName: document.getElementById('trans-player-name'),
    transRoundName: document.getElementById('trans-round-name'),
    btnImReady: document.getElementById('btn-im-ready'),

    // Active Game
    gameRoundTitle: document.getElementById('game-round-title'),
    gameRoundInstruction: document.getElementById('game-round-instruction'),
    timerBox: document.getElementById('timer-box'),
    timerNumber: document.getElementById('timer-number'),
    timerBar: document.getElementById('timer-bar'),
    gameArena: document.getElementById('game-arena'),

    // Feedback Overlay
    roundFeedback: document.getElementById('round-feedback'),
    feedbackCard: document.getElementById('feedback-card'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackMessage: document.getElementById('feedback-message'),
    feedbackDetails: document.getElementById('feedback-details'),
    btnNextAction: document.getElementById('btn-next-action'),

    // Results
    winnerBox: document.getElementById('winner-announcement'),
    winnerName: document.getElementById('winner-name'),
    winnerPersonalityTag: document.getElementById('winner-personality-tag'),
    leaderboardList: document.getElementById('leaderboard-list'),
    btnToggleBreakdown: document.getElementById('btn-toggle-breakdown'),
    breakdownTableContainer: document.getElementById('breakdown-table-container'),
    breakdownTableBody: document.getElementById('breakdown-table-body'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnNewGame: document.getElementById('btn-new-game')
  };

  // --------------------------------------------------------------------------
  // 5. SCREEN MANAGEMENT
  // --------------------------------------------------------------------------
  function switchScreen(targetScreen) {
    [
      DOM.screenHome,
      DOM.screenSetup,
      DOM.screenTransition,
      DOM.screenGame,
      DOM.screenResults
    ].forEach(s => {
      if (s) {
        s.classList.add('hidden');
        s.classList.remove('active');
      }
    });

    if (targetScreen) {
      targetScreen.classList.remove('hidden');
      targetScreen.classList.add('active');
    }

    // Header visibility
    if (targetScreen === DOM.screenGame || targetScreen === DOM.screenTransition) {
      DOM.header.classList.remove('hidden');
    } else {
      DOM.header.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // 6. TIMER HELPER
  // --------------------------------------------------------------------------
  function startTimer(seconds, onTick, onComplete) {
    stopTimer();
    GameState.timerSecondsRemaining = seconds;
    GameState.isTimerRunning = true;

    DOM.timerBox.classList.remove('hidden');
    DOM.timerBox.classList.remove('urgent');
    DOM.timerNumber.textContent = seconds;
    DOM.timerBar.style.width = '100%';

    const totalSeconds = seconds;

    Sound.tick();
    if (onTick) onTick(seconds);

    GameState.timerInterval = setInterval(() => {
      GameState.timerSecondsRemaining--;
      const remaining = GameState.timerSecondsRemaining;

      if (remaining > 0) {
        DOM.timerNumber.textContent = remaining;
        const pct = (remaining / totalSeconds) * 100;
        DOM.timerBar.style.width = `${pct}%`;

        if (remaining <= 2) {
          DOM.timerBox.classList.add('urgent');
        }
        Sound.tick();
        if (onTick) onTick(remaining);
      } else {
        stopTimer();
        DOM.timerNumber.textContent = 'GO!';
        DOM.timerBar.style.width = '0%';
        Sound.go();
        setTimeout(() => {
          DOM.timerBox.classList.add('hidden');
          if (onComplete) onComplete();
        }, 500);
      }
    }, 1000);
  }

  function stopTimer() {
    if (GameState.timerInterval) {
      clearInterval(GameState.timerInterval);
      GameState.timerInterval = null;
    }
    GameState.isTimerRunning = false;
  }

  // --------------------------------------------------------------------------
  // 7. SETUP WORKFLOW
  // --------------------------------------------------------------------------
  function initSetupScreen() {
    renderPlayerCountButtons();
    renderPlayerInputs(GameState.numPlayers);
    switchScreen(DOM.screenSetup);
  }

  function renderPlayerCountButtons() {
    const buttons = DOM.playerCountButtons.querySelectorAll('.btn-count');
    buttons.forEach(btn => {
      const count = parseInt(btn.getAttribute('data-count'), 10);
      if (count === GameState.numPlayers) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.onclick = () => {
        Sound.click();
        GameState.numPlayers = count;
        renderPlayerCountButtons();
        renderPlayerInputs(count);
      };
    });
  }

  function renderPlayerInputs(count) {
    DOM.playerNamesContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'player-name-row';
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const avatar = DEFAULT_AVATARS[i % DEFAULT_AVATARS.length];

      row.innerHTML = `
        <span class="player-color-dot" style="background-color: ${color}"></span>
        <span class="player-avatar-select">${avatar}</span>
        <span class="player-input-label">Player ${i + 1}:</span>
        <input 
          type="text" 
          class="player-name-input" 
          id="input-player-${i}" 
          data-index="${i}" 
          placeholder="Player ${i + 1}" 
          value="Player ${i + 1}"
          maxlength="16"
        />
      `;
      DOM.playerNamesContainer.appendChild(row);
    }
  }

  function handleContinueSetup() {
    Sound.click();
    const players = [];
    for (let i = 0; i < GameState.numPlayers; i++) {
      const input = document.getElementById(`input-player-${i}`);
      let name = input ? input.value.trim() : '';
      if (!name) {
        name = `Player ${i + 1}`;
      }
      players.push({
        id: i + 1,
        name: name,
        avatar: DEFAULT_AVATARS[i % DEFAULT_AVATARS.length],
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        totalScore: 0,
        roundScores: [0, 0, 0, 0, 0]
      });
    }

    GameState.players = players;
    GameState.currentRoundIndex = 0;
    GameState.currentPlayerIndex = 0;

    startTurnTransition();
  }

  // --------------------------------------------------------------------------
  // 8. TURN TRANSITIONS & HEADER UPDATES
  // --------------------------------------------------------------------------
  function updateHeader() {
    const currentRound = ROUND_INFO[GameState.currentRoundIndex];
    const currentPlayer = GameState.players[GameState.currentPlayerIndex];

    if (!currentPlayer || !currentRound) return;

    DOM.roundIndicator.textContent = `Round ${currentRound.number} of 5`;
    DOM.playerName.textContent = currentPlayer.name;
    DOM.playerAvatar.textContent = currentPlayer.avatar;
    DOM.playerScore.textContent = `${currentPlayer.totalScore} pts`;

    DOM.playerPill.style.borderColor = currentPlayer.color;
    DOM.playerPill.style.boxShadow = `0 0 12px ${currentPlayer.color}55`;
  }

  function startTurnTransition() {
    stopTimer();
    hideFeedback();

    const currentRound = ROUND_INFO[GameState.currentRoundIndex];
    const currentPlayer = GameState.players[GameState.currentPlayerIndex];

    updateHeader();

    DOM.transAvatar.textContent = currentPlayer.avatar;
    DOM.transPlayerName.textContent = currentPlayer.name;
    DOM.transPlayerName.style.color = currentPlayer.color;
    DOM.transRoundName.textContent = `Round ${currentRound.number} of 5: ${currentRound.name}`;

    switchScreen(DOM.screenTransition);
  }

  function handleReadyClick() {
    Sound.click();
    switchScreen(DOM.screenGame);
    launchCurrentRound();
  }

  // --------------------------------------------------------------------------
  // 9. ACTIVE ROUND DISPATCHER
  // --------------------------------------------------------------------------
  function launchCurrentRound() {
    hideFeedback();
    updateHeader();

    const roundIndex = GameState.currentRoundIndex;
    const info = ROUND_INFO[roundIndex];

    DOM.gameRoundTitle.textContent = `Round ${info.number}: ${info.name}`;
    DOM.gameRoundInstruction.textContent = info.instruction;
    DOM.gameArena.innerHTML = '';

    switch (roundIndex) {
      case 0:
        runRound1();
        break;
      case 1:
        runRound2();
        break;
      case 2:
        runRound3();
        break;
      case 3:
        runRound4();
        break;
      case 4:
        runRound5();
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 10. ROUND 1 — REMEMBER THE ORDER
  // --------------------------------------------------------------------------
  function runRound1() {
    // 5 random emojis to memorize in exact order
    const sequence = getRandomEmojis(5);
    GameState.roundData = {
      sequence: sequence,
      playerSelections: []
    };

    // 1. Memorization View
    DOM.gameRoundInstruction.textContent = 'Memorize the exact order of the emojis!';
    DOM.gameArena.innerHTML = `
      <div class="display-sequence-box" id="r1-sequence">
        ${sequence.map((emoji, idx) => `
          <div class="emoji-card reveal-pop" style="animation-delay: ${idx * 0.08}s">${emoji}</div>
        `).join('')}
      </div>
    `;

    // 5 seconds timer
    startTimer(5, null, () => {
      renderRound1Question();
    });
  }

  function renderRound1Question() {
    const data = GameState.roundData;
    const targetLength = data.sequence.length;

    DOM.gameRoundInstruction.textContent = 'Recreate the emojis in the exact order!';
    
    // Distractors: +2 extra emojis
    const distractors = getRandomEmojis(2, data.sequence);
    const trayOptions = shuffleArray([...data.sequence, ...distractors]);

    data.trayOptions = trayOptions;
    data.playerSelections = [];

    DOM.gameArena.innerHTML = `
      <!-- Answer Slots -->
      <div class="r1-slots-container" id="r1-slots">
        ${data.sequence.map((_, i) => `
          <div class="r1-slot" id="r1-slot-${i}">
            <span class="r1-slot-number">${i + 1}</span>
            <span class="r1-slot-val"></span>
          </div>
        `).join('')}
      </div>

      <!-- Emoji Choice Tray -->
      <div class="r1-tray-heading">Click emojis in order to fill slots:</div>
      <div class="r1-choice-tray" id="r1-tray">
        ${trayOptions.map((emoji, i) => `
          <button class="btn-emoji-choice" id="r1-choice-${i}" data-emoji="${emoji}">
            ${emoji}
          </button>
        `).join('')}
      </div>

      <!-- Controls -->
      <div class="r1-control-bar">
        <button id="btn-r1-undo" class="btn btn-secondary">⌫ Undo</button>
        <button id="btn-r1-reset" class="btn btn-secondary">↺ Clear All</button>
        <button id="btn-r1-submit" class="btn btn-primary" disabled>SUBMIT ANSWER</button>
      </div>
    `;

    const choiceButtons = DOM.gameArena.querySelectorAll('.btn-emoji-choice');
    const undoBtn = document.getElementById('btn-r1-undo');
    const resetBtn = document.getElementById('btn-r1-reset');
    const submitBtn = document.getElementById('btn-r1-submit');

    function updateSlotsUI() {
      for (let i = 0; i < targetLength; i++) {
        const slotEl = document.getElementById(`r1-slot-${i}`);
        const valEl = slotEl.querySelector('.r1-slot-val');
        if (i < data.playerSelections.length) {
          slotEl.classList.add('filled');
          valEl.textContent = data.playerSelections[i];
        } else {
          slotEl.classList.remove('filled');
          valEl.textContent = '';
        }
      }
      submitBtn.disabled = data.playerSelections.length !== targetLength;
    }

    choiceButtons.forEach(btn => {
      btn.onclick = () => {
        if (data.playerSelections.length < targetLength) {
          Sound.click();
          const emoji = btn.getAttribute('data-emoji');
          data.playerSelections.push(emoji);
          btn.disabled = true;
          updateSlotsUI();
        }
      };
    });

    undoBtn.onclick = () => {
      Sound.click();
      if (data.playerSelections.length > 0) {
        const popped = data.playerSelections.pop();
        // Re-enable first matching disabled button
        const disabledMatch = Array.from(choiceButtons).find(b => b.getAttribute('data-emoji') === popped && b.disabled);
        if (disabledMatch) disabledMatch.disabled = false;
        updateSlotsUI();
      }
    };

    resetBtn.onclick = () => {
      Sound.click();
      data.playerSelections = [];
      choiceButtons.forEach(b => b.disabled = false);
      updateSlotsUI();
    };

    submitBtn.onclick = () => {
      if (data.playerSelections.length !== targetLength) return;
      Sound.click();
      // Compare sequence
      const isCorrect = data.playerSelections.every((em, idx) => em === data.sequence[idx]);
      const detailsHTML = `
        <p><strong>Target Order:</strong> ${data.sequence.join(' ')}</p>
        <p><strong>Your Order:</strong> ${data.playerSelections.join(' ')}</p>
      `;

      completeTurn(isCorrect, isCorrect ? '+1 Point! Perfect memory!' : 'Incorrect order. 0 points.', detailsHTML);
    };
  }

  // --------------------------------------------------------------------------
  // 11. ROUND 2 — WHAT CHANGED?
  // --------------------------------------------------------------------------
  function runRound2() {
    const originalScene = getRandomEmojis(5);
    // Pick one position to change
    const changeIndex = Math.floor(Math.random() * originalScene.length);
    const oldEmoji = originalScene[changeIndex];
    // Brand new emoji
    const [newEmoji] = getRandomEmojis(1, originalScene);

    const changedScene = [...originalScene];
    changedScene[changeIndex] = newEmoji;

    GameState.roundData = {
      originalScene,
      changedScene,
      changeIndex,
      oldEmoji,
      newEmoji
    };

    DOM.gameRoundInstruction.textContent = 'Memorize the 5 objects! Exactly one will change.';
    DOM.gameArena.innerHTML = `
      <div class="r2-comparison-box">
        <div class="scene-label">ORIGINAL SCENE</div>
        <div class="display-sequence-box">
          ${originalScene.map((emoji, idx) => `
            <div class="emoji-card reveal-pop" style="animation-delay: ${idx * 0.08}s">${emoji}</div>
          `).join('')}
        </div>
      </div>
    `;

    startTimer(5, null, () => {
      // Flash transition: "Changing..."
      DOM.gameArena.innerHTML = `
        <div style="font-size: 1.8rem; font-weight: 800; color: #a5b4fc; text-align: center; padding: 40px;">
          🌀 Changing something...
        </div>
      `;
      setTimeout(() => {
        renderRound2Question();
      }, 1000);
    });
  }

  function renderRound2Question() {
    const data = GameState.roundData;
    DOM.gameRoundInstruction.textContent = 'What changed? Click the new emoji that appeared!';

    // Create 4 choices: correct newEmoji + 3 random distractors
    const distractors = getRandomEmojis(3, [...data.originalScene, data.newEmoji]);
    const choices = shuffleArray([data.newEmoji, ...distractors]);

    DOM.gameArena.innerHTML = `
      <div class="r2-comparison-box">
        <div class="scene-label">CHANGED SCENE</div>
        <div class="display-sequence-box">
          ${data.changedScene.map((emoji) => `
            <div class="emoji-card">${emoji}</div>
          `).join('')}
        </div>

        <div style="font-size: 1.1rem; font-weight: 800; color: #ffffff; text-align: center;">
          Which new emoji was NOT in the original scene?
        </div>

        <div class="multiple-choice-grid">
          ${choices.map((choice, i) => `
            <button class="choice-card-btn" id="r2-choice-${i}" data-emoji="${choice}">
              <span class="choice-emoji">${choice}</span>
              <span>${choice} is new</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const choiceButtons = DOM.gameArena.querySelectorAll('.choice-card-btn');
    choiceButtons.forEach(btn => {
      btn.onclick = () => {
        choiceButtons.forEach(b => b.disabled = true);
        const selected = btn.getAttribute('data-emoji');
        const isCorrect = selected === data.newEmoji;

        if (isCorrect) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('wrong');
          // Highlight correct button
          choiceButtons.forEach(b => {
            if (b.getAttribute('data-emoji') === data.newEmoji) b.classList.add('correct');
          });
        }

        const detailsHTML = `
          <p>Original: ${data.originalScene.join(' ')}</p>
          <p>Changed: ${data.changedScene.join(' ')}</p>
          <p><strong>${data.newEmoji}</strong> replaced <strong>${data.oldEmoji}</strong> at position ${data.changeIndex + 1}!</p>
        `;

        setTimeout(() => {
          completeTurn(isCorrect, isCorrect ? '+1 Point! Sharp observation!' : `Wrong! ${data.newEmoji} was the new emoji.`, detailsHTML);
        }, 900);
      };
    });
  }

  // --------------------------------------------------------------------------
  // 12. ROUND 3 — WHERE WAS IT?
  // --------------------------------------------------------------------------
  function runRound3() {
    // 9 unique emojis in 3x3 grid
    const gridEmojis = getRandomEmojis(9);
    // Pick one target emoji to ask about
    const targetIndex = Math.floor(Math.random() * 9);
    const targetEmoji = gridEmojis[targetIndex];

    GameState.roundData = {
      gridEmojis,
      targetIndex,
      targetEmoji
    };

    DOM.gameRoundInstruction.textContent = 'Memorize where each emoji is located in the 3×3 grid!';
    DOM.gameArena.innerHTML = `
      <div class="r3-grid-container">
        ${gridEmojis.map((emoji, idx) => `
          <div class="grid-cell reveal-pop" style="animation-delay: ${idx * 0.05}s">${emoji}</div>
        `).join('')}
      </div>
    `;

    startTimer(5, null, () => {
      renderRound3Question();
    });
  }

  function renderRound3Question() {
    const data = GameState.roundData;
    DOM.gameRoundInstruction.textContent = `Where was ${data.targetEmoji}? Click the correct position on the grid!`;

    DOM.gameArena.innerHTML = `
      <div class="target-question-card">
        <span class="target-emoji-large">${data.targetEmoji}</span>
        <span class="target-question-text">Where was this emoji?</span>
      </div>

      <div class="r3-grid-container" id="r3-question-grid">
        ${[0,1,2,3,4,5,6,7,8].map(i => `
          <button class="grid-cell clickable" data-cell="${i}">?</button>
        `).join('')}
      </div>
    `;

    const cells = DOM.gameArena.querySelectorAll('.grid-cell.clickable');
    cells.forEach(cell => {
      cell.onclick = () => {
        cells.forEach(c => c.disabled = true);
        const clickedIndex = parseInt(cell.getAttribute('data-cell'), 10);
        const isCorrect = clickedIndex === data.targetIndex;

        // Reveal what was in all cells or target cell
        cells.forEach((c, idx) => {
          c.textContent = data.gridEmojis[idx];
          if (idx === data.targetIndex) {
            c.classList.add('target-reveal');
          }
        });

        if (isCorrect) {
          cell.classList.add('selected-correct');
        } else {
          cell.classList.add('selected-wrong');
        }

        const row = Math.floor(data.targetIndex / 3) + 1;
        const col = (data.targetIndex % 3) + 1;

        const detailsHTML = `
          <p>Target: <strong>${data.targetEmoji}</strong></p>
          <p>Location: Row ${row}, Column ${col}</p>
        `;

        setTimeout(() => {
          completeTurn(isCorrect, isCorrect ? '+1 Point! Spot-on spatial memory!' : `Wrong! ${data.targetEmoji} was at Row ${row}, Col ${col}.`, detailsHTML);
        }, 1100);
      };
    });
  }

  // --------------------------------------------------------------------------
  // 13. ROUND 4 — WHAT'S MISSING?
  // --------------------------------------------------------------------------
  function runRound4() {
    // 6 distinct emojis
    const originalSix = getRandomEmojis(6);
    // Pick one to remove
    const removeIndex = Math.floor(Math.random() * 6);
    const missingEmoji = originalSix[removeIndex];
    const remainingFive = originalSix.filter((_, idx) => idx !== removeIndex);

    GameState.roundData = {
      originalSix,
      missingEmoji,
      remainingFive
    };

    DOM.gameRoundInstruction.textContent = 'Memorize all 6 emojis! One is about to disappear.';
    DOM.gameArena.innerHTML = `
      <div class="r4-scene-wrapper">
        <div class="scene-label">ALL 6 EMOJIS</div>
        <div class="display-sequence-box">
          ${originalSix.map((emoji, idx) => `
            <div class="emoji-card reveal-pop" style="animation-delay: ${idx * 0.08}s">${emoji}</div>
          `).join('')}
        </div>
      </div>
    `;

    startTimer(5, null, () => {
      // Brief hide transition
      DOM.gameArena.innerHTML = `
        <div style="font-size: 1.8rem; font-weight: 800; color: #a5b4fc; text-align: center; padding: 40px;">
          💨 Poof! One emoji vanished...
        </div>
      `;
      setTimeout(() => {
        renderRound4Question();
      }, 1000);
    });
  }

  function renderRound4Question() {
    const data = GameState.roundData;
    DOM.gameRoundInstruction.textContent = "What's missing? Choose the emoji that was removed!";

    // 4 choices: missingEmoji + 3 distractors
    const distractors = getRandomEmojis(3, data.originalSix);
    const choices = shuffleArray([data.missingEmoji, ...distractors]);

    DOM.gameArena.innerHTML = `
      <div class="r4-scene-wrapper">
        <div class="scene-label">ONLY 5 REMAIN</div>
        <div class="display-sequence-box">
          ${data.remainingFive.map((emoji) => `
            <div class="emoji-card">${emoji}</div>
          `).join('')}
        </div>

        <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff; text-align: center; margin-bottom: 8px;">
          Which emoji is missing?
        </div>

        <div class="multiple-choice-grid">
          ${choices.map((choice, i) => `
            <button class="choice-card-btn" id="r4-choice-${i}" data-emoji="${choice}">
              <span class="choice-emoji">${choice}</span>
              <span>${choice}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const choiceButtons = DOM.gameArena.querySelectorAll('.choice-card-btn');
    choiceButtons.forEach(btn => {
      btn.onclick = () => {
        choiceButtons.forEach(b => b.disabled = true);
        const selected = btn.getAttribute('data-emoji');
        const isCorrect = selected === data.missingEmoji;

        if (isCorrect) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('wrong');
          choiceButtons.forEach(b => {
            if (b.getAttribute('data-emoji') === data.missingEmoji) b.classList.add('correct');
          });
        }

        const detailsHTML = `
          <p>Original: ${data.originalSix.join(' ')}</p>
          <p>Remaining: ${data.remainingFive.join(' ')}</p>
          <p>Missing: <strong>${data.missingEmoji}</strong></p>
        `;

        setTimeout(() => {
          completeTurn(isCorrect, isCorrect ? '+1 Point! Great retention!' : `Missed it! ${data.missingEmoji} was removed.`, detailsHTML);
        }, 900);
      };
    });
  }

  // --------------------------------------------------------------------------
  // 14. ROUND 5 — FINAL MEMORY WAR (3 Questions per player)
  // --------------------------------------------------------------------------
  function runRound5() {
    // 6 emojis sequence shown for 7 seconds
    const sequence = getRandomEmojis(6);
    GameState.roundData = {
      sequence: sequence,
      questions: generateRound5Questions(sequence)
    };
    GameState.r5QuestionIndex = 0;
    GameState.r5CorrectCountForTurn = 0;

    DOM.gameRoundInstruction.textContent = 'Grand Finale! Memorize this 6-emoji sequence for 7 seconds!';
    DOM.gameArena.innerHTML = `
      <div class="r5-wrapper">
        <div class="display-sequence-box">
          ${sequence.map((emoji, idx) => `
            <div class="emoji-card reveal-pop" style="animation-delay: ${idx * 0.07}s">${emoji}</div>
          `).join('')}
        </div>
        <p style="color: #cbd5e1; font-weight: 600;">You will face 3 memory questions on this exact sequence!</p>
      </div>
    `;

    // 7 seconds countdown timer
    startTimer(7, null, () => {
      renderRound5Question();
    });
  }

  function generateRound5Questions(sequence) {
    const qList = [];

    // Q1: Position Question (First or Last)
    if (Math.random() > 0.5) {
      qList.push({
        prompt: 'What was the FIRST emoji in the sequence?',
        correct: sequence[0],
        explanation: `The 1st emoji was ${sequence[0]}.`
      });
    } else {
      qList.push({
        prompt: 'What was the LAST (6th) emoji in the sequence?',
        correct: sequence[5],
        explanation: `The 6th emoji was ${sequence[5]}.`
      });
    }

    // Q2: Middle item question (2nd, 3rd, 4th, or 5th)
    const midIdx = Math.floor(Math.random() * 4) + 1; // index 1, 2, 3, or 4
    const ordinals = ['', '2nd', '3rd', '4th', '5th'];
    qList.push({
      prompt: `What was the ${ordinals[midIdx]} emoji in the sequence?`,
      correct: sequence[midIdx],
      explanation: `The ${ordinals[midIdx]} emoji was ${sequence[midIdx]}.`
    });

    // Q3: Before or After question
    const refIdx = Math.floor(Math.random() * 4) + 1; // 1, 2, 3, or 4
    if (Math.random() > 0.5 && refIdx < 5) {
      // After
      qList.push({
        prompt: `Which emoji came immediately AFTER ${sequence[refIdx]}?`,
        correct: sequence[refIdx + 1],
        explanation: `${sequence[refIdx + 1]} came immediately after ${sequence[refIdx]}.`
      });
    } else {
      // Before
      qList.push({
        prompt: `Which emoji came immediately BEFORE ${sequence[refIdx]}?`,
        correct: sequence[refIdx - 1],
        explanation: `${sequence[refIdx - 1]} came immediately before ${sequence[refIdx]}.`
      });
    }

    return qList;
  }

  function renderRound5Question() {
    const qIndex = GameState.r5QuestionIndex;
    const qObj = GameState.roundData.questions[qIndex];
    const sequence = GameState.roundData.sequence;

    DOM.gameRoundInstruction.textContent = `Question ${qIndex + 1} of 3: Answer correctly to earn +1 point!`;

    // 4 choices: correct + 3 other emojis from sequence or distractors
    const otherEmojis = sequence.filter(e => e !== qObj.correct);
    const shuffledOthers = shuffleArray(otherEmojis);
    const choices = shuffleArray([qObj.correct, ...shuffledOthers.slice(0, 3)]);

    DOM.gameArena.innerHTML = `
      <div class="r5-wrapper">
        <div class="r5-q-progress">Question ${qIndex + 1} of 3</div>
        <div class="r5-question-card">
          <div class="r5-q-text">${qObj.prompt}</div>
        </div>

        <div class="multiple-choice-grid">
          ${choices.map((choice, i) => `
            <button class="choice-card-btn" id="r5-choice-${i}" data-emoji="${choice}">
              <span class="choice-emoji">${choice}</span>
              <span>${choice}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const choiceButtons = DOM.gameArena.querySelectorAll('.choice-card-btn');
    choiceButtons.forEach(btn => {
      btn.onclick = () => {
        choiceButtons.forEach(b => b.disabled = true);
        const selected = btn.getAttribute('data-emoji');
        const isCorrect = selected === qObj.correct;

        if (isCorrect) {
          btn.classList.add('correct');
          Sound.correct();
          GameState.r5CorrectCountForTurn++;
          // Immediately give +1 to current player
          const currentPlayer = GameState.players[GameState.currentPlayerIndex];
          currentPlayer.totalScore++;
          currentPlayer.roundScores[4]++;
          updateHeader();
        } else {
          btn.classList.add('wrong');
          Sound.wrong();
          choiceButtons.forEach(b => {
            if (b.getAttribute('data-emoji') === qObj.correct) b.classList.add('correct');
          });
        }

        setTimeout(() => {
          GameState.r5QuestionIndex++;
          if (GameState.r5QuestionIndex < 3) {
            renderRound5Question();
          } else {
            // Completed all 3 questions!
            const earned = GameState.r5CorrectCountForTurn;
            const detailsHTML = `
              <p>Sequence was: ${sequence.join(' ')}</p>
              <p>You earned <strong>${earned} of 3 points</strong> in the Final Round!</p>
            `;
            showFeedback(
              earned > 0,
              `Round 5 Complete! (${earned}/3 pts)`,
              earned === 3 ? 'LEGENDARY! Flawless 3/3 score!' : `You got ${earned} correct answers!`,
              detailsHTML,
              () => advanceTurn()
            );
          }
        }, 800);
      };
    });
  }

  // --------------------------------------------------------------------------
  // 15. FEEDBACK OVERLAY & TURN PROGRESSION
  // --------------------------------------------------------------------------
  function showFeedback(isCorrect, title, message, detailsHTML, onNext) {
    if (isCorrect) {
      Sound.correct();
      DOM.feedbackCard.className = 'feedback-card correct-style';
      DOM.feedbackIcon.textContent = '🎉';
    } else {
      Sound.wrong();
      DOM.feedbackCard.className = 'feedback-card wrong-style';
      DOM.feedbackIcon.textContent = '❌';
    }

    DOM.feedbackTitle.textContent = title;
    DOM.feedbackMessage.textContent = message;
    DOM.feedbackDetails.innerHTML = detailsHTML || '';

    // Check if next action is next player or next round or results
    const isLastPlayerInRound = GameState.currentPlayerIndex === GameState.players.length - 1;
    const isLastRound = GameState.currentRoundIndex === ROUND_INFO.length - 1;

    if (isLastPlayerInRound && isLastRound) {
      DOM.btnNextAction.textContent = 'VIEW FINAL RESULTS 🏆';
    } else if (isLastPlayerInRound) {
      DOM.btnNextAction.textContent = 'START NEXT ROUND ➔';
    } else {
      DOM.btnNextAction.textContent = 'NEXT PLAYER ➔';
    }

    DOM.btnNextAction.onclick = () => {
      Sound.click();
      hideFeedback();
      if (onNext) onNext();
    };

    DOM.roundFeedback.classList.remove('hidden');
  }

  function hideFeedback() {
    DOM.roundFeedback.classList.add('hidden');
  }

  function completeTurn(isCorrect, message, detailsHTML) {
    const currentPlayer = GameState.players[GameState.currentPlayerIndex];
    if (isCorrect) {
      currentPlayer.totalScore++;
      currentPlayer.roundScores[GameState.currentRoundIndex]++;
    }

    updateHeader();

    showFeedback(
      isCorrect,
      isCorrect ? 'CORRECT! +1 POINT' : 'INCORRECT!',
      message,
      detailsHTML,
      () => advanceTurn()
    );
  }

  function advanceTurn() {
    // Advance to next player
    GameState.currentPlayerIndex++;

    if (GameState.currentPlayerIndex >= GameState.players.length) {
      // All players completed this round! Move to next round
      GameState.currentPlayerIndex = 0;
      GameState.currentRoundIndex++;

      if (GameState.currentRoundIndex >= ROUND_INFO.length) {
        // Game Over!
        showFinalResults();
        return;
      }
    }

    // Next player's turn
    startTurnTransition();
  }

  // --------------------------------------------------------------------------
  // 16. FINAL RESULTS & LEADERBOARD
  // --------------------------------------------------------------------------
  function showFinalResults() {
    stopTimer();
    Sound.fanfare();
    switchScreen(DOM.screenResults);

    // Sort players by totalScore descending
    const sorted = [...GameState.players].sort((a, b) => b.totalScore - a.totalScore);
    const topScore = sorted[0].totalScore;
    const winners = sorted.filter(p => p.totalScore === topScore);

    // Winner banner
    if (winners.length === 1) {
      DOM.winnerName.textContent = `${winners[0].name.toUpperCase()} WINS!`;
      DOM.winnerName.style.color = winners[0].color;
    } else {
      // Tie
      const names = winners.map(w => w.name).join(' & ');
      DOM.winnerName.textContent = `IT'S A TIE! ${names.toUpperCase()} WIN!`;
    }

    // Funny Title
    const { title, desc } = getFunnyTitle(topScore, 7);
    DOM.winnerPersonalityTag.textContent = `${title} — ${desc}`;

    // Render Leaderboard List
    DOM.leaderboardList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    sorted.forEach((player, rankIdx) => {
      const card = document.createElement('div');
      card.className = `rank-card rank-${Math.min(rankIdx + 1, 4)}`;
      const medal = medals[rankIdx] || `#${rankIdx + 1}`;
      const { title } = getFunnyTitle(player.totalScore, 7);

      card.innerHTML = `
        <div class="rank-left">
          <span class="rank-medal">${medal}</span>
          <div class="rank-player-details">
            <span class="rank-avatar">${player.avatar}</span>
            <div>
              <div class="rank-name" style="color: ${player.color}">${player.name}</div>
              <span class="rank-title-badge">${title}</span>
            </div>
          </div>
        </div>
        <div class="rank-score">${player.totalScore} pts</div>
      `;
      DOM.leaderboardList.appendChild(card);
    });

    // Render Round Breakdown Table
    DOM.breakdownTableBody.innerHTML = '';
    sorted.forEach(player => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span style="color:${player.color}">${player.avatar} ${player.name}</span></td>
        <td>${player.roundScores[0]}</td>
        <td>${player.roundScores[1]}</td>
        <td>${player.roundScores[2]}</td>
        <td>${player.roundScores[3]}</td>
        <td>${player.roundScores[4]}</td>
        <td><strong>${player.totalScore}</strong></td>
      `;
      DOM.breakdownTableBody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // 17. SCOREBOARD MODAL & QUIT MODAL
  // --------------------------------------------------------------------------
  function toggleScoreboardModal(open) {
    if (open) {
      Sound.click();
      DOM.miniScoreboardList.innerHTML = '';
      const sorted = [...GameState.players].sort((a, b) => b.totalScore - a.totalScore);
      sorted.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'mini-score-row';
        row.style.borderLeftColor = p.color;
        row.innerHTML = `
          <div class="mini-player-info">
            <span>#${i + 1}</span>
            <span>${p.avatar}</span>
            <span style="color: ${p.color}">${p.name}</span>
          </div>
          <div class="mini-score-pts">${p.totalScore} pts</div>
        `;
        DOM.miniScoreboardList.appendChild(row);
      });
      DOM.modalScoreboard.classList.remove('hidden');
    } else {
      DOM.modalScoreboard.classList.add('hidden');
    }
  }

  function resetGameData(keepPlayers = false) {
    stopTimer();
    hideFeedback();
    GameState.currentRoundIndex = 0;
    GameState.currentPlayerIndex = 0;

    if (keepPlayers) {
      GameState.players.forEach(p => {
        p.totalScore = 0;
        p.roundScores = [0, 0, 0, 0, 0];
      });
      startTurnTransition();
    } else {
      GameState.players = [];
      switchScreen(DOM.screenHome);
    }
  }

  // --------------------------------------------------------------------------
  // 18. EVENT LISTENERS
  // --------------------------------------------------------------------------
  function setupEvents() {
    // Sound Button
    DOM.btnToggleSound.onclick = () => {
      const isAudible = Sound.toggleMute();
      DOM.btnToggleSound.textContent = isAudible ? '🔊' : '🔇';
    };

    // Scoreboard Modal
    DOM.btnToggleScoreboard.onclick = () => toggleScoreboardModal(true);
    DOM.btnCloseScoreboard.onclick = () => toggleScoreboardModal(false);
    DOM.btnDoneScoreboard.onclick = () => toggleScoreboardModal(false);

    // Quit Modal
    DOM.btnQuitGame.onclick = () => {
      Sound.click();
      DOM.modalQuit.classList.remove('hidden');
    };
    DOM.btnCancelQuit.onclick = () => {
      DOM.modalQuit.classList.add('hidden');
    };
    DOM.btnConfirmQuit.onclick = () => {
      DOM.modalQuit.classList.add('hidden');
      resetGameData(false);
    };

    // Home -> Setup
    DOM.btnStartGame.onclick = () => {
      Sound.init();
      Sound.click();
      initSetupScreen();
    };

    // Setup Navigation
    DOM.btnBackHome.onclick = () => {
      Sound.click();
      switchScreen(DOM.screenHome);
    };
    DOM.btnContinueSetup.onclick = () => {
      handleContinueSetup();
    };

    // Transition -> Ready
    DOM.btnImReady.onclick = () => {
      handleReadyClick();
    };

    // Results Navigation
    DOM.btnToggleBreakdown.onclick = () => {
      const hidden = DOM.breakdownTableContainer.classList.contains('hidden');
      if (hidden) {
        DOM.breakdownTableContainer.classList.remove('hidden');
        DOM.btnToggleBreakdown.textContent = 'Hide Round Breakdown ▴';
      } else {
        DOM.breakdownTableContainer.classList.add('hidden');
        DOM.btnToggleBreakdown.textContent = 'Show Round Breakdown ▾';
      }
    };

    DOM.btnPlayAgain.onclick = () => {
      Sound.click();
      resetGameData(true);
    };

    DOM.btnNewGame.onclick = () => {
      Sound.click();
      resetGameData(false);
    };
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
  });
})();
