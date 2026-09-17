import { SELECTORS } from './selectors'
import { TRANSCRIPTION_TIMEOUT_MS, TRANSCRIPTION_STABLE_MS, TRANSCRIPTION_POLL_MS } from '../shared/constants'

export const VOICE_STOP_SCRIPT = `
(function() {
  return new Promise(function(resolve) {
    // Click the submit dictation button (validates recording → triggers transcription)
    var submitBtn = document.querySelector('${SELECTORS.submitDictationButton}');
    if (submitBtn) {
      submitBtn.click();
    }

    var prevMsgCount = window.__murmurMsgCount || 0;
    var lastText = '';
    var stableTime = 0;
    var elapsed = 0;
    var pollInterval = ${TRANSCRIPTION_POLL_MS};
    var stableThreshold = ${TRANSCRIPTION_STABLE_MS};
    var timeout = ${TRANSCRIPTION_TIMEOUT_MS};

    function clearInput() {
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
    }

    var timer = setInterval(function() {
      elapsed += pollInterval;

      // Check input area for transcribed text
      var inputEl = document.querySelector('${SELECTORS.chatInput}');
      var currentText = '';
      if (inputEl) {
        currentText = (inputEl.textContent || inputEl.innerText || '').trim();
      }

      // If input is empty, check for NEW user messages only (after our dictation started)
      if (!currentText) {
        var allMsgs = document.querySelectorAll('[data-message-author-role="user"]');
        if (allMsgs.length > prevMsgCount) {
          var lastMsg = allMsgs[allMsgs.length - 1];
          if (lastMsg) {
            currentText = (lastMsg.textContent || lastMsg.innerText || '').trim();
          }
        }
      }

      if (currentText && currentText === lastText) {
        stableTime += pollInterval;
      } else {
        stableTime = 0;
        lastText = currentText;
      }

      if (stableTime >= stableThreshold && currentText) {
        clearInterval(timer);
        clearInput();
        resolve(currentText);
        return;
      }

      if (elapsed >= timeout) {
        clearInterval(timer);
        clearInput();
        resolve(currentText || null);
        return;
      }
    }, pollInterval);
  });
})()
`
