function setStatus(message, type = 'info') {
  const status = document.getElementById('dashboardMessage')

  if (!status) {
    return
  }

  status.hidden = !message
  status.className = `status-message ${type}`
  status.innerText = message || ''
}

function formatLabel(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function renderAttemptSummary(attempt) {
  const attemptStatusElement = document.getElementById('attemptStatus')
  const attemptWarningsElement = document.getElementById('attemptWarnings')
  const attemptSubmissionReasonElement = document.getElementById('attemptSubmissionReason')

  if (!attemptStatusElement || !attemptWarningsElement || !attemptSubmissionReasonElement) {
    return
  }

  const status = attempt?.status || 'not_started'
  const warningCount = Number(attempt?.violationCount || 0)
  const maxWarnings = Number(attempt?.maxWarnings || 15)
  const submissionReason = attempt?.submissionReason

  attemptStatusElement.innerText = formatLabel(status) || 'Not Started'
  attemptWarningsElement.innerText = `${warningCount} / ${maxWarnings}`
  attemptSubmissionReasonElement.innerText = submissionReason
    ? formatLabel(submissionReason)
    : 'Not submitted'
}

function updateStartButton(attempt) {
  const startButton = document.querySelector('.start-btn')

  if (!startButton) {
    return
  }

  const canResume = Boolean(attempt?.canResume || attempt?.status === 'in_progress')
  startButton.innerText = canResume ? 'Resume Exam' : 'Start Exam'
}

async function loadDashboard() {
  setStatus('Loading your exam details...', 'info')

  try {
    const response = await fetchWithSession(`${API_BASE_URL}/api/student`)

    if (!response) {
      return
    }

    const data = await response.json()

    if (!response.ok || !data.student) {
      setStatus('Could not load student details.', 'error')
      return
    }

    document.getElementById('studentName').innerText = data.student.name
    document.getElementById('studentEmail').innerText = data.student.email
    document.getElementById('examName').innerText = data.student.exam
    renderAttemptSummary(data.attempt)
    updateStartButton(data.attempt)

    if (data.attempt?.status === 'submitted') {
      setStatus('This exam attempt has already been submitted.', 'info')
      return
    }

    if (data.attempt?.status === 'in_progress') {
      setStatus('Your exam is already in progress. You can continue when ready.', 'info')
      return
    }

    setStatus('You are ready to start the exam.', 'info')
  } catch (error) {
    setStatus('Could not reach the backend. Make sure the server is running.', 'error')
  }
}

function startExam() {
  const violationModal = document.getElementById('violationModal')
  const agreementCheckbox = document.getElementById('violationAgreement')
  const confirmStartButton = document.getElementById('confirmStartButton')

  if (!violationModal || !agreementCheckbox || !confirmStartButton) {
    setStatus('Opening exam...', 'info')
    window.location = 'exam.html'
    return
  }

  agreementCheckbox.checked = false
  confirmStartButton.disabled = true
  violationModal.hidden = false
  setStatus('Please review the exam rules before starting.', 'info')
}

function closeViolationModal() {
  const violationModal = document.getElementById('violationModal')

  if (!violationModal) {
    return
  }

  violationModal.hidden = true
  setStatus('Exam start cancelled. Review the rules when you are ready.', 'info')
}

function confirmStartExam() {
  setStatus('Opening exam...', 'info')
  window.location = 'exam.html'
}

async function logout() {
  const logoutButton = document.getElementById('logoutButton')

  if (logoutButton) {
    logoutButton.disabled = true
  }

  try {
    const response = await fetchWithSession(`${API_BASE_URL}/api/logout`, {
      method: 'POST'
    })

    if (response) {
      await response.json().catch(() => null)
    }
  } finally {
    clearSession()
    redirectToLogin('You have been logged out.')
  }
}

window.addEventListener('load', () => {
  loadDashboard()

  const agreementCheckbox = document.getElementById('violationAgreement')
  const confirmStartButton = document.getElementById('confirmStartButton')

  if (agreementCheckbox && confirmStartButton) {
    agreementCheckbox.addEventListener('change', () => {
      confirmStartButton.disabled = !agreementCheckbox.checked
    })
  }
})
