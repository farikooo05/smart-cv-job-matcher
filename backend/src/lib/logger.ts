type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'AUTH'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

const getTimestamp = () => {
  return new Date().toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export const logger = {
  info: (message: string, context?: any) => {
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.blue}${colors.bright}[INFO]${colors.reset} ${message}`, context || '')
  },
  warn: (message: string, context?: any) => {
    console.warn(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.yellow}${colors.bright}[WARN]${colors.reset} ${message}`, context || '')
  },
  error: (message: string, error?: any) => {
    console.error(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.red}${colors.bright}[ERROR]${colors.reset} ${message}`, error || '')
  },
  success: (message: string, context?: any) => {
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.green}${colors.bright}[SUCCESS]${colors.reset} ${message}`, context || '')
  },
  auth: (message: string, context?: any) => {
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.magenta}${colors.bright}[AUTH]${colors.reset} ${message}`, context || '')
  }
}
