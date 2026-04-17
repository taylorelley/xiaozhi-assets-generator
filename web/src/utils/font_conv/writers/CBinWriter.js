// CBIN format writer - ES6 version
// Writes font data into the CBIN format

import AppError from '../AppError.js'
import CBinFont from './CBinFont.js'

export default function write_cbin(args, fontData) {
  if (!args.output) throw new AppError('Output is required for "cbin" writer')

  const font = new CBinFont(fontData, args)
  const result = font.toCBin()

  return {
    [args.output]: result
  }
}
