// Japanese text-to-speech where the browser has it. Any element with data-say="…" becomes a play button.
import { esc, icon } from './util.js';

export const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export function speak(text) {
  if (!canSpeak || !text) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/（　　）/g, '')); u.lang = 'ja-JP'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) { }
}
export const speakBtn = t => canSpeak && t ? `<button type="button" class="speak" data-say="${esc(t)}" aria-label="Nghe phát âm">${icon('speak')}</button>` : '';
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-say]'); if (b) { e.preventDefault(); speak(b.dataset.say); } });
