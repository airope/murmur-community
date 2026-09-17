import { SELECTORS } from './selectors'

export const VOICE_START_SCRIPT = `
(function() {
  return new Promise(function(resolve) {
    // Clear the input area before starting a new dictation
    var inputEl = document.querySelector('${SELECTORS.chatInput}');
    if (inputEl) {
      if (inputEl.tagName === 'TEXTAREA') {
        inputEl.value = '';
      } else {
        inputEl.textContent = '';
        inputEl.innerHTML = '<p><br></p>';
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Remember current user message count to only read new ones later
    window.__murmurMsgCount = document.querySelectorAll('[data-message-author-role="user"]').length;

    var attempts = 0;
    var maxAttempts = 10;
    var interval = 500;

    function tryClick() {
      attempts++;
      var btn = document.querySelector('${SELECTORS.voiceButton}');
      if (btn) {
        btn.click();
        resolve(true);
        return;
      }
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      setTimeout(tryClick, interval);
    }

    tryClick();
  });
})()
`
