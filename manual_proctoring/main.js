const { app, BrowserWindow, ipcMain } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

let mainWindow
let monitoringInterval = null
const isDevelopmentMode = !app.isPackaged
let devBlockedAppMonitoringEnabled = !isDevelopmentMode

const BLOCKED_APPS_CONFIG_PATH = path.join(
  __dirname,
  'config',
  'blocked-network-apps.json'
)
const FALLBACK_BLOCKED_NETWORK_APPS = [
  'arc',
  'brave',
  'chrome',
  'discord',
  'element',
  'firefox',
  'iexplore',
  'lineapp',
  'msedge',
  'opera',
  'opera gx',
  'opera_gx',
  'pidgin',
  'qutebrowser',
  'signal',
  'skype',
  'slack',
  'teams',
  'teamsclassic',
  'telegram',
  'vivaldi',
  'wechat',
  'whatsapp',
  'whatsapp.root',
  'whatsappbeta',
  'whatsappbusiness',
  'zoom'
]

function loadBlockedNetworkApps () {
  try {
    const rawConfig = fs.readFileSync(BLOCKED_APPS_CONFIG_PATH, 'utf8')
    const parsedConfig = JSON.parse(rawConfig)

    if (!Array.isArray(parsedConfig)) {
      throw new Error('Blocked network apps config must be an array.')
    }

    const normalizedApps = parsedConfig
      .map(entry =>
        String(entry || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)

    if (normalizedApps.length === 0) {
      throw new Error('Blocked network apps config is empty.')
    }

    return normalizedApps
  } catch (error) {
    console.error(
      'Failed to load blocked network apps config, using fallback list:',
      error.message
    )
    return FALLBACK_BLOCKED_NETWORK_APPS
  }
}

function runProcessCommand (file, args = []) {
  return new Promise(resolve => {
    execFile(
      file,
      args,
      { windowsHide: true },
      (error, stdout = '', stderr = '') => {
        if (error) {
          resolve({
            ok: false,
            stdout: String(stdout || ''),
            stderr: String(stderr || ''),
            error
          })
          return
        }

        resolve({
          ok: true,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: null
        })
      }
    )
  })
}

function parseCsvLine (line) {
  const values = []
  let currentValue = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"'
        index += 1
        continue
      }

      insideQuotes = !insideQuotes
      continue
    }

    if (character === ',' && !insideQuotes) {
      values.push(currentValue)
      currentValue = ''
      continue
    }

    currentValue += character
  }

  values.push(currentValue)
  return values.map(value => value.trim())
}

function matchesBlockedPattern (processName, blockedPatterns) {
  const normalizedProcessName = String(processName || '')
    .toLowerCase()
    .replace(/\.exe$/i, '')

  return blockedPatterns.includes(normalizedProcessName)
}

async function getRunningProcesses () {
  const processResult = await runProcessCommand('powershell.exe', [
    '-NoProfile',
    '-Command',
    'Get-Process | Select-Object ProcessName,Id | ConvertTo-Json -Compress'
  ])

  if (!processResult.ok || !processResult.stdout.trim()) {
    return []
  }

  try {
    const parsedProcesses = JSON.parse(processResult.stdout)
    const processes = Array.isArray(parsedProcesses)
      ? parsedProcesses
      : [parsedProcesses]

    return processes
      .map(process => ({
        processName: String(process.ProcessName || ''),
        processId: String(process.Id || '')
      }))
      .filter(process => process.processName && process.processId)
  } catch (error) {
    console.error('Failed to parse running process list:', error.message)
    return []
  }
}

async function scanAndBlockNetworkApps () {
  if (isDevelopmentMode && !devBlockedAppMonitoringEnabled) {
    return
  }

  const blockedNetworkApps = loadBlockedNetworkApps()
  const runningProcesses = await getRunningProcesses()

  const detectedApps = new Set()
  for (const { processName, processId } of runningProcesses) {
    const normalizedProcessName = String(processName || '').toLowerCase()

    if (!matchesBlockedPattern(normalizedProcessName, blockedNetworkApps)) {
      continue
    }

    detectedApps.add(normalizedProcessName)
    await runProcessCommand('taskkill', ['/PID', processId, '/F'])
  }

  if (detectedApps.size > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('network-app-blocked', Array.from(detectedApps))
  }
}

function startExamMonitoring () {
  stopExamMonitoring()
  monitoringInterval = setInterval(scanAndBlockNetworkApps, 2000)
  scanAndBlockNetworkApps()
}

function stopExamMonitoring () {
  if (!monitoringInterval) {
    return
  }

  clearInterval(monitoringInterval)
  monitoringInterval = null
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// START FULLSCREEN WHEN EXAM STARTS
ipcMain.on('start-fullscreen', () => {
  mainWindow.setFullScreen(true)
  mainWindow.setKiosk(true)
})

ipcMain.on('exit-fullscreen', () => {
  if (!mainWindow) {
    return
  }

  stopExamMonitoring()
  mainWindow.setKiosk(false)
  mainWindow.setFullScreen(false)
})

ipcMain.on('start-exam-monitoring', () => {
  startExamMonitoring()
})

ipcMain.on('stop-exam-monitoring', () => {
  stopExamMonitoring()
})

ipcMain.handle('get-exam-dev-settings', () => ({
  isDevelopmentMode,
  blockedAppMonitoringEnabled: isDevelopmentMode
    ? devBlockedAppMonitoringEnabled
    : true
}))

ipcMain.handle('set-blocked-app-monitoring-enabled', (_, isEnabled) => {
  if (!isDevelopmentMode) {
    return {
      isDevelopmentMode,
      blockedAppMonitoringEnabled: true
    }
  }

  devBlockedAppMonitoringEnabled = Boolean(isEnabled)

  if (devBlockedAppMonitoringEnabled && monitoringInterval) {
    scanAndBlockNetworkApps()
  }

  return {
    isDevelopmentMode,
    blockedAppMonitoringEnabled: devBlockedAppMonitoringEnabled
  }
})

app.on('browser-window-created', (_, window) => {
  window.on('leave-full-screen', () => {
    window.webContents.send('fullscreen-exited')
  })
})

app.on('before-quit', () => {
  stopExamMonitoring()
})
