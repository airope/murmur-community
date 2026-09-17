import { SELECTORS } from './selectors'

export const SESSION_CHECK_SCRIPT = `
(function() {
  var loginEl = document.querySelector('${SELECTORS.loginPage}');
  if (loginEl) return false;
  var chatInput = document.querySelector('${SELECTORS.chatInput}');
  var sidebar = document.querySelector('${SELECTORS.sidebar}');
  return !!(chatInput || sidebar);
})()
`
