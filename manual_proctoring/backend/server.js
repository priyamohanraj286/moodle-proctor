const crypto = require('crypto')
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = 5000
const SESSION_TTL_MS = 60 * 60 * 1000

app.use(cors())
app.use(express.json())

const student = {
  id: 'ST101',
  name: 'Asif',
  email: 'user',
  exam: 'IoT Final Exam'
}

const demoUser = {
  email: 'user',
  password: 'password'
}

const sessions = new Map()

function generateToken() {
  return crypto.randomBytes(24).toString('hex')
}

function getPublicStudentProfile() {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    exam: student.exam
  }
}

function createSession() {
  const token = generateToken()
  const expiresAt = Date.now() + SESSION_TTL_MS

  sessions.set(token, {
    studentId: student.id,
    expiresAt
  })

  return {
    token,
    expiresAt
  }
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.slice('Bearer '.length).trim()
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req)

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    })
  }

  const session = sessions.get(token)

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Invalid session'
    })
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token)

    return res.status(401).json({
      success: false,
      message: 'Session expired'
    })
  }

  req.token = token
  req.session = session
  req.student = getPublicStudentProfile()
  next()
}

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim()
  const password = String(req.body.password || '')

  if (email !== demoUser.email || password !== demoUser.password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    })
  }

  const session = createSession()

  return res.json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    student: getPublicStudentProfile()
  })
})

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.token)

  return res.json({
    success: true,
    message: 'Logged out successfully'
  })
})

app.get('/api/session', requireAuth, (req, res) => {
  return res.json({
    success: true,
    expiresAt: req.session.expiresAt,
    student: req.student
  })
})

app.get('/api/student', (req, res) => {
  return res.json(req.student)
})

app.use('/files', requireAuth, express.static(path.join(__dirname, 'files')))

app.get('/exam', requireAuth, (req, res) => {
  return res.json({
    timer: 10,
    questionPaper: 'question-paper.pdf'
  })
})

app.get('/api/questions', requireAuth, (req, res) => {
  return res.json([
    {
      id: 1,
      question: 'What does IoT stand for?',
      options: [
        'Internet of Things',
        'Input Output Technology',
        'Internet Tool',
        'None'
      ]
    },
    {
      id: 2,
      question: 'Which protocol is used in IoT?',
      options: ['MQTT', 'HTTP', 'CoAP', 'All of the above']
    }
  ])
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
