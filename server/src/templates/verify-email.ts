import { wrapEmail } from './base.js'

export interface VerifyEmailData {
  name: string
  verifyUrl: string
}

export function verifyEmailSubject(): string {
  return 'Verify Your Guild Membership'
}

export function verifyEmailHtml(data: VerifyEmailData): string {
  return wrapEmail(`
    <p>Hail, ${data.name}!</p>

    <p>Your request to join the guild has been received. To complete your registration, you must verify your scrying address.</p>

    <div class="button-container">
      <a href="${data.verifyUrl}" class="button">VERIFY MY ADDRESS</a>
    </div>

    <p class="note">This seal expires in 24 hours.</p>

    <p class="note">If you did not request this, you may safely disregard this missive.</p>
  `)
}
