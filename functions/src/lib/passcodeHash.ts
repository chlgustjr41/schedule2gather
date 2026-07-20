import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export interface PasscodeRecord {
  passcodeHash: string
  salt: string
}

export function hashPasscode(passcode: string, saltHex?: string): PasscodeRecord {
  const salt = saltHex ?? randomBytes(16).toString('hex')
  const hash = scryptSync(passcode, salt, 32).toString('hex')
  return { passcodeHash: hash, salt }
}

export function verifyPasscode(passcode: string, record: PasscodeRecord): boolean {
  const candidate = scryptSync(passcode, record.salt, 32)
  const stored = Buffer.from(record.passcodeHash, 'hex')
  return stored.length === candidate.length && timingSafeEqual(candidate, stored)
}
