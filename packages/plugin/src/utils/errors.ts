import { STATUS_CODES } from 'http'

/**
 * Unwrap an Error to its lowest message
 */
export function unwrap(error: Error): string {
  if (!error) return 'unknown error'
  if (error.cause instanceof Error) return unwrap(error.cause)
  return error.message
}

/**
 * Create a stacktrace of an Error
 */
export function stack(error: Error): string {
  if (!error) return 'unknown error'

  let msg = ''
  if (error.cause instanceof Error) {
    msg = `${msg}\n\t${stack(error.cause)}`
  }

  return `${error.message}${msg}`
}

export class HTTPError extends Error {
  statusCode: number

  constructor(code: number, message: string, extras?: object) {
    super(message || STATUS_CODES[code])

    if (arguments.length >= 3 && extras) {
      Object.assign(this, extras)
    }

    this.name = this.toName(code)
    this.statusCode = code
  }

  private upperCamelCase(str: string) {
    // Using replace method with regEx
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, word => {
        return word.toUpperCase()
      })
      .replace(/\s+/g, '')
  }

  /**
   * Converts an HTTP status code to an Error `name`.
   * Ex:
   *   302 => "Found"
   *   404 => "NotFoundError"
   *   500 => "InternalServerError"
   */
  private toName(code: number) {
    return this.upperCamelCase(String(STATUS_CODES[code]).replace(/error$/i, ''))
  }
}
