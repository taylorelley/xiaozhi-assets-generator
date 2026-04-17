// Custom Error type to simplify error messaging
// ES6 version

class AppError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AppError'

    // Preserve stack trace (only available in V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

export default AppError
