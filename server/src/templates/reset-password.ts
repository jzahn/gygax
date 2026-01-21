import { wrapEmail } from './base.js'

export interface ResetPasswordData {
  name: string
  resetUrl: string
}

export function resetPasswordSubject(): string {
  return 'Reset Your Secret Word'
}

export function resetPasswordHtml(data: ResetPasswordData): string {
  return wrapEmail(`
    <p>Hail, ${data.name}!</p>

    <p>A request has been made to reset your secret word. If this was you, click below to choose a new one:</p>

    <div class="button-container">
      <a href="${data.resetUrl}" class="button">RESET SECRET WORD</a>
    </div>

    <p class="note">This seal expires in 1 hour.</p>

    <p class="note">If you did not request this, your account remains secure. No action is needed.</p>
  `)
}
