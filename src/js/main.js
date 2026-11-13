'use strict';

// ==========================================
// 포모도로 타이머
// 상태: idle(시작 전) → running ⇄ paused → done(00:00)
// ==========================================
const MIN_MINUTES = 1;
const MAX_MINUTES = 99;

const settings = {
  minutes: { pomodoro: 25, short: 5, long: 15 },
  font: 'kumbh',
  color: 'red',
};

const timer = {
  mode: 'pomodoro',
  status: 'idle',
  totalSeconds: settings.minutes.pomodoro * 60,
  remainingSeconds: settings.minutes.pomodoro * 60,
  endTime: 0,
  intervalId: null,
};

const ACTION_LABELS = {
  idle: 'start',
  running: 'pause',
  paused: 'start',
  done: 'restart',
};

const MODE_NAMES = {
  pomodoro: 'Pomodoro',
  short: 'Short break',
  long: 'Long break',
};

const body = document.body;
const modeButtons = document.querySelectorAll('.js-mode');
const statusText = document.querySelector('.js-timer-status');
const timeText = document.querySelector('.js-timer-time');
const actionButton = document.querySelector('.js-timer-action');
const progressBar = document.querySelector('.js-timer-bar');
const settingsDialog = document.querySelector('#settings');
const settingsForm = document.querySelector('.js-settings-form');
const openButton = document.querySelector('.js-settings-open');
const closeButton = document.querySelector('.js-settings-close');
const timeInputs = settingsForm.querySelectorAll('.js-time-input');
const timeError = settingsForm.querySelector('.js-time-error');

// ------------------------------------------
// 화면 갱신
// ------------------------------------------
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render() {
  timeText.textContent = formatTime(timer.remainingSeconds);
  actionButton.textContent = ACTION_LABELS[timer.status];

  // 남은 비율만큼 링을 그린다. 끝나면 Figma Completed 프레임처럼 링을 가득 채운다.
  const ratio =
    timer.status === 'done' ? 1 : timer.remainingSeconds / timer.totalSeconds;
  progressBar.style.setProperty('--progress', (ratio * 100).toFixed(3));
}

// ------------------------------------------
// 타이머 동작
// ------------------------------------------
function stopInterval() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
}

function tick() {
  // setInterval은 지연될 수 있으므로 종료 시각 기준으로 남은 시간을 계산한다
  const left = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
  timer.remainingSeconds = left;
  if (left === 0) {
    stopInterval();
    timer.status = 'done';
    // 화면을 보지 않는 사용자에게 완료를 알린다 (role="status")
    statusText.textContent = `${MODE_NAMES[timer.mode]} finished.`;
  }
  render();
}

function start() {
  statusText.textContent = '';
  timer.endTime = Date.now() + timer.remainingSeconds * 1000;
  timer.status = 'running';
  timer.intervalId = setInterval(tick, 250);
  render();
}

function pause() {
  stopInterval();
  timer.status = 'paused';
  render();
}

function reset() {
  stopInterval();
  timer.totalSeconds = settings.minutes[timer.mode] * 60;
  timer.remainingSeconds = timer.totalSeconds;
  timer.status = 'idle';
  statusText.textContent = '';
  render();
}

actionButton.addEventListener('click', () => {
  if (timer.status === 'running') {
    pause();
  } else if (timer.status === 'done') {
    reset();
    start();
  } else {
    start();
  }
});

// 모드 버튼: 누를 때만 전환한다 (Tab으로 지나가기만 해서는 타이머가 초기화되지 않음)
modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.mode === timer.mode) return;

    modeButtons.forEach((other) => {
      const isActive = other === button;
      other.classList.toggle('is-active', isActive);
      other.setAttribute('aria-pressed', String(isActive));
    });
    timer.mode = button.dataset.mode;
    reset();
  });
});

// ------------------------------------------
// 설정 대화상자
// ------------------------------------------
function clampMinutes(value, fallback) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, number));
}

// 1~99 사이 정수만 허용한다
function isValidMinutes(value) {
  if (!/^\d+$/.test(value.trim())) return false;
  const number = Number(value);
  return number >= MIN_MINUTES && number <= MAX_MINUTES;
}

function setFieldError(input, hasError) {
  input.closest('.c-time-field__control').classList.toggle('is-invalid', hasError);
  if (hasError) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'time-hint time-error');
  } else {
    input.removeAttribute('aria-invalid');
    input.setAttribute('aria-describedby', 'time-hint');
  }
}

function clearErrors() {
  timeInputs.forEach((input) => setFieldError(input, false));
  timeError.textContent = '';
}

// 잘못된 입력이 있으면 오류를 보이고 false를 돌려준다
function validateTimes() {
  const invalid = [...timeInputs].filter((input) => !isValidMinutes(input.value));
  timeInputs.forEach((input) => setFieldError(input, invalid.includes(input)));

  if (invalid.length === 0) {
    timeError.textContent = '';
    return true;
  }

  const names = invalid.map((input) => MODE_NAMES[input.name]).join(', ');
  timeError.textContent = `Enter a whole number from 1 to 99 for: ${names}.`;
  invalid[0].focus();
  return false;
}

// 저장된 설정값으로 폼을 되돌린다 (Apply 없이 닫았을 때 변경 취소)
function fillForm() {
  clearErrors();
  timeInputs.forEach((input) => {
    input.value = settings.minutes[input.name];
  });
  settingsForm.elements.font.value = settings.font;
  settingsForm.elements.color.value = settings.color;
}

function applyTheme() {
  // classList는 실시간 목록이라 순회 중에 지우면 항목을 건너뛴다. 복사본으로 순회한다.
  [...body.classList].forEach((name) => {
    if (name.startsWith('is-font-') || name.startsWith('is-color-')) {
      body.classList.remove(name);
    }
  });
  body.classList.add(`is-font-${settings.font}`, `is-color-${settings.color}`);
}

openButton.addEventListener('click', () => {
  fillForm();
  settingsDialog.showModal();
});

closeButton.addEventListener('click', () => {
  settingsDialog.close();
});

// 위·아래 화살표 버튼
settingsForm.addEventListener('click', (event) => {
  const stepButton = event.target.closest('.js-time-step');
  if (!stepButton) return;

  const input = stepButton
    .closest('.c-time-field')
    .querySelector('.js-time-input');
  const current = clampMinutes(input.value, settings.minutes[input.name]);
  input.value = clampMinutes(current + Number(stepButton.dataset.step), current);
});

// Apply (method="dialog" 제출 → 브라우저가 대화상자를 닫는다)
// 브라우저 기본 검증 말풍선 대신(novalidate) 지속되는 오류 문구를 보인다
settingsForm.addEventListener('submit', (event) => {
  if (!validateTimes()) {
    event.preventDefault(); // 대화상자를 닫지 않는다
    return;
  }

  timeInputs.forEach((input) => {
    settings.minutes[input.name] = Number(input.value);
  });
  settings.font = settingsForm.elements.font.value;
  settings.color = settingsForm.elements.color.value;

  applyTheme();
  reset();
});

// 닫힌 뒤 포커스를 설정 버튼으로 되돌린다 (Esc 포함)
settingsDialog.addEventListener('close', () => {
  openButton.focus();
});

applyTheme();
render();
