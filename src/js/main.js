// 엄격 모드: 선언하지 않은 변수 사용 등 실수하기 쉬운 코드를 오류로 알려준다.
'use strict';

// ==========================================
// 포모도로 타이머
// 상태: idle(시작 전) → running ⇄ paused → done(00:00)
// ==========================================
const MIN_MINUTES = 1;
const MAX_MINUTES = 99;

// 사용자가 Apply로 확정한 설정. 메모리에만 보관하므로 새로고침하면 기본값으로 돌아간다.
// const 객체도 내부 속성은 바꿀 수 있다. 객체 자체를 다른 값으로 재할당할 수 없다는 뜻이다.
const settings = {
  minutes: { pomodoro: 25, short: 5, long: 15 },
  font: 'kumbh',
  color: 'red',
};

// 설정과 별개로, 지금 실행 중인 타이머의 상태를 보관한다.
// totalSeconds는 진행률의 기준, remainingSeconds는 화면에 표시할 남은 초다.
// endTime은 종료 예정 시각(ms), intervalId는 반복 실행을 취소할 때 사용할 식별자다.
const timer = {
  mode: 'pomodoro',
  status: 'idle',
  totalSeconds: settings.minutes.pomodoro * 60,
  remainingSeconds: settings.minutes.pomodoro * 60,
  endTime: 0,
  intervalId: null,
};

// 상태 이름을 키로 사용하면 조건문을 반복하지 않고 버튼 문구를 찾을 수 있다.
const ACTION_LABELS = {
  idle: 'start',
  running: 'pause',
  paused: 'start',
  done: 'restart',
};

// 코드에서 쓰는 짧은 모드 이름을 사용자에게 보여줄 이름으로 바꾼다.
const MODE_NAMES = {
  pomodoro: 'Pomodoro',
  short: 'Short break',
  long: 'Long break',
};

// HTML의 js-* 클래스는 JavaScript에서 요소를 찾는 연결점이다.
// querySelector는 첫 요소 하나, querySelectorAll은 해당하는 모든 요소의 목록을 가져온다.
// HTML에서 이 파일을 defer로 불러오므로 HTML 요소가 만들어진 뒤에 실행된다.
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
  // 나눗셈의 소수 부분을 버리면 분, 60으로 나눈 나머지(%)는 초가 된다.
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  // 숫자를 문자열로 바꾸고 두 자리보다 짧으면 앞에 0을 채운다. 예: 65 → "01:05".
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 상태를 읽어 화면만 갱신한다. 시간 계산과 화면 표시를 분리해 여러 동작에서 재사용한다.
function render() {
  timeText.textContent = formatTime(timer.remainingSeconds);
  actionButton.textContent = ACTION_LABELS[timer.status];

  // 남은 비율만큼 링을 그린다. 끝나면 Figma Completed 프레임처럼 링을 가득 채운다.
  const ratio =
    timer.status === 'done' ? 1 : timer.remainingSeconds / timer.totalSeconds;
  // 삼항 연산자(조건 ? 참일 때 값 : 거짓일 때 값)로 완료 상태를 구분한다.
  // 0~1 비율을 0~100으로 바꾼다. toFixed(3)은 소수점 세 자리 문자열을 만든다.
  // SVG의 pathLength="100"과 CSS의 stroke-dasharray가 이 CSS 변수를 사용한다.
  progressBar.style.setProperty('--progress', (ratio * 100).toFixed(3));
}

// ------------------------------------------
// 타이머 동작
// ------------------------------------------
function stopInterval() {
  clearInterval(timer.intervalId);
  // 반복 실행이 없다는 상태도 기록한다. 화면의 남은 시간을 초기화하는 함수는 아니다.
  timer.intervalId = null;
}

function tick() {
  // setInterval은 지연될 수 있으므로 종료 시각 기준으로 남은 시간을 계산한다
  // Date.now()는 현재 시각을 밀리초로 돌려준다. 1000으로 나누면 초가 된다.
  // round는 가장 가까운 정수로 반올림하고, max(0, ...)는 음수 표시를 막는다.
  // 반올림 때문에 종료 예정 시각까지 0.5초 미만이 남아도 0초로 계산할 수 있다.
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
  // 이전 완료 알림을 지우고, 남은 초를 기준으로 종료 시각을 새로 정한다.
  statusText.textContent = '';
  timer.endTime = Date.now() + timer.remainingSeconds * 1000;
  timer.status = 'running';
  // tick()을 지금 호출하는 대신 함수 tick을 전달해 약 250ms마다 실행하도록 등록한다.
  // 이 주기는 화면 확인 간격이다. 매번 250ms를 빼는 방식으로 시간을 계산하지 않는다.
  timer.intervalId = setInterval(tick, 250);
  render();
}

function pause() {
  // 마지막 tick에서 계산한 남은 초는 그대로 두고 반복 실행만 멈춘다.
  stopInterval();
  timer.status = 'paused';
  render();
}

function reset() {
  stopInterval();
  // 대괄호로 현재 모드에 해당하는 설정을 읽고, 분을 초로 변환한다.
  timer.totalSeconds = settings.minutes[timer.mode] * 60;
  timer.remainingSeconds = timer.totalSeconds;
  timer.status = 'idle';
  statusText.textContent = '';
  render();
}

// 클릭할 때 실행할 함수를 등록한다. 같은 버튼도 현재 상태에 따라 다른 일을 한다.
// running이면 일시정지, done이면 처음부터 재시작, idle/paused이면 시작 또는 이어서 실행한다.
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
    // data-mode="short" 같은 HTML 속성을 dataset.mode로 읽는다.
    // 이미 선택한 모드라면 return으로 여기서 끝내 타이머를 유지한다.
    if (button.dataset.mode === timer.mode) return;

    modeButtons.forEach((other) => {
      const isActive = other === button;
      // toggle의 두 번째 값이 true이면 클래스를 추가하고 false이면 제거한다.
      // 클래스는 시각적 선택 표시, aria-pressed는 보조 기술에 전달할 선택 상태다.
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
  // 화살표 버튼용 보정 함수. parseInt는 앞부분의 정수를 읽는다(예: "2.5" → 2).
  // 숫자로 읽지 못하면 NaN이 되므로 대신 쓸 값(fallback)을 반환한다.
  // 제출 검증과 달리 값을 거부하지 않고 범위 안으로 조정하는 용도다.
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  // 먼저 최소 1까지 올리고, 그 결과가 99보다 크면 99로 낮춘다.
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, number));
}

// 1~99 사이 정수만 허용한다
function isValidMinutes(value) {
  // trim()은 양끝 공백을 없앤다. 정규식 ^\d+$는 처음부터 끝까지 숫자가 한 개 이상인지 검사한다.
  // 빈 값·소수점·음수·지수 표기 등을 거부한 뒤 숫자 범위를 확인한다.
  if (!/^\d+$/.test(value.trim())) return false;
  const number = Number(value);
  return number >= MIN_MINUTES && number <= MAX_MINUTES;
}

function setFieldError(input, hasError) {
  // closest는 자신부터 부모 방향으로 검색한다. 입력을 감싼 상자에 오류 스타일을 붙인다.
  // aria-describedby의 공백으로 구분한 ID들은 안내 문구와 오류 문구를 가리킨다.
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
  // 이전 오류 표시가 다음에 설정 창을 열었을 때 남지 않게 한다.
  timeInputs.forEach((input) => setFieldError(input, false));
  timeError.textContent = '';
}

// 잘못된 입력이 있으면 오류를 보이고 false를 돌려준다
function validateTimes() {
  // [...]로 요소 목록을 배열로 복사한다. filter는 조건이 참인 입력만 모은다.
  // !는 검증 결과를 뒤집으므로 invalid에는 잘못된 입력만 들어간다.
  const invalid = [...timeInputs].filter((input) => !isValidMinutes(input.value));
  // includes는 해당 입력이 오류 목록에 있는지 확인한다. 정상 입력의 기존 오류도 해제한다.
  timeInputs.forEach((input) => setFieldError(input, invalid.includes(input)));

  if (invalid.length === 0) {
    timeError.textContent = '';
    return true;
  }

  // map으로 입력 이름을 표시용 이름으로 바꾸고, join으로 쉼표가 있는 문장으로 합친다.
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
  // elements는 name으로 폼 항목을 찾는다. 같은 name의 라디오들은 value로 선택값을 읽고 쓴다.
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
  // 선택한 클래스에 연결된 CSS가 --font-app과 --color-accent를 변경한다.
  // c-app 같은 테마와 무관한 기존 클래스는 위 반복문에서 제거하지 않는다.
  body.classList.add(`is-font-${settings.font}`, `is-color-${settings.color}`);
}

openButton.addEventListener('click', () => {
  // 폼의 편집 중인 값과 확정된 settings는 별개다. 다시 열 때 미적용 변경을 되돌린다.
  // showModal은 다른 페이지 요소와의 상호작용을 막지만 실행 중인 타이머는 멈추지 않는다.
  fillForm();
  settingsDialog.showModal();
});

closeButton.addEventListener('click', () => {
  settingsDialog.close();
});

// 위·아래 화살표 버튼
// 버튼마다 이벤트를 등록하는 대신 폼 하나에서 처리한다. 자식의 클릭이 부모로 전달되는 방식을 이용한다.
settingsForm.addEventListener('click', (event) => {
  // 아이콘을 클릭해도 closest로 그 아이콘을 포함한 화살표 버튼을 찾는다.
  const stepButton = event.target.closest('.js-time-step');
  // 화살표가 아닌 폼의 다른 부분을 클릭했다면 처리하지 않는다.
  if (!stepButton) return;

  const input = stepButton
    .closest('.c-time-field')
    .querySelector('.js-time-input');
  // 같은 입력 묶음 안의 input만 찾아 다른 모드의 시간을 바꾸지 않도록 한다.
  const current = clampMinutes(input.value, settings.minutes[input.name]);
  // data-step은 문자열이므로 Number로 변환한다. 위 화살표는 +1, 아래는 -1이다.
  input.value = clampMinutes(current + Number(stepButton.dataset.step), current);
});

// Apply (method="dialog" 제출 → 브라우저가 대화상자를 닫는다)
// 브라우저 기본 검증 말풍선 대신(novalidate) 지속되는 오류 문구를 보인다
settingsForm.addEventListener('submit', (event) => {
  if (!validateTimes()) {
    event.preventDefault(); // 대화상자를 닫지 않는다
    return;
  }

  // 모든 시간 입력이 유효할 때만 폼의 임시 값을 실제 설정으로 복사한다.
  // input.value는 문자열이므로 계산에 쓸 시간은 숫자로 변환해 저장한다.
  timeInputs.forEach((input) => {
    settings.minutes[input.name] = Number(input.value);
  });
  settings.font = settingsForm.elements.font.value;
  settings.color = settingsForm.elements.color.value;

  applyTheme();
  // 설정 내용이 이전과 같더라도 Apply가 성공하면 현재 타이머를 시작 전 상태로 되돌린다.
  reset();
});

// 닫힌 뒤 포커스를 설정 버튼으로 되돌린다 (Esc 포함)
settingsDialog.addEventListener('close', () => {
  openButton.focus();
});

// 첫 로딩: 기본 테마와 25:00을 표시한다. 사용자 조작 전에는 타이머를 시작하지 않는다.
applyTheme();
render();
