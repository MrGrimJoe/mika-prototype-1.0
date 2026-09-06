// ==UserScript==
// @name         Mika Task Submit
// @namespace    https://mika.app
// @version      1.0.0
// @description  Ctrl+Alt+M submits the active task's confirmation to Mika
// @match        *://*.figma.com/*
// @match        *://*.canva.com/*
// @match        *://docs.google.com/*
// @match        *://sheets.google.com/*
// @match        *://slides.google.com/*
// @match        *://drive.google.com/*
// @match        *://github.com/*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://mika.app/userscript/mika-submit.user.js
// @downloadURL  https://mika.app/userscript/mika-submit.user.js
// ==/UserScript==

(function () {
  'use strict';

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      let activeTaskId = null;
      try {
        if (typeof GM_getValue === 'function') {
          activeTaskId = GM_getValue('mika_active_task_id', null);
        }
      } catch (err) {}

      if (!activeTaskId) {
        activeTaskId = localStorage.getItem('mika_active_task_id');
      }

      if (!activeTaskId) {
        const manualId = prompt('No active Mika task selected. Enter Mika Task ID to submit (or open task in Mika and click "Set as Active Task"):');
        if (!manualId) return;
        activeTaskId = manualId.trim();
        try {
          if (typeof GM_setValue === 'function') {
            GM_setValue('mika_active_task_id', activeTaskId);
          }
        } catch (e) {}
      }

      let sessionToken = '';
      try {
        if (typeof GM_getValue === 'function') {
          sessionToken = GM_getValue('mika_session_token', '');
        }
      } catch (e) {}
      if (!sessionToken) {
        sessionToken = localStorage.getItem('mika_session_token') || 'demo-session-token';
      }

      const payload = {
        taskId: activeTaskId,
        sourceUrl: window.location.href,
        host: window.location.hostname,
        capturedAt: new Date().toISOString(),
      };

      const submitUrl = window.location.origin.includes('localhost') || window.location.origin.includes('run.app')
        ? `${window.location.origin}/api/v1/tasks/submit-shortcut`
        : '/api/v1/tasks/submit-shortcut';

      const doFetch = () => {
        return fetch(submitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        });
      };

      const showBanner = (text, isSuccess) => {
        const banner = document.createElement('div');
        banner.textContent = text;
        banner.style.cssText =
          'position:fixed;top:16px;right:16px;background:' + (isSuccess ? '#2F3B7A' : '#DC2626') + ';color:#fff;' +
          'padding:10px 18px;border-radius:8px;font:14px Inter,sans-serif;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;';
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 3500);
      };

      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: submitUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          data: JSON.stringify(payload),
          onload: (res) => {
            if (res.status === 200) {
              showBanner('Submitted to Mika ✓ (' + activeTaskId + ')', true);
            } else {
              showBanner('Mika submit failed — status ' + res.status, false);
            }
          },
          onerror: () => {
            doFetch().then(r => {
              if (r.ok) showBanner('Submitted to Mika ✓ (' + activeTaskId + ')', true);
              else showBanner('Mika submit failed — open app and submit manually.', false);
            }).catch(() => showBanner('Mika submit failed — check your connection.', false));
          }
        });
      } else {
        doFetch().then(r => {
          if (r.ok) showBanner('Submitted to Mika ✓ (' + activeTaskId + ')', true);
          else showBanner('Mika submit failed — open app and submit manually.', false);
        }).catch(() => showBanner('Mika submit failed — check your connection.', false));
      }
    }
  });
})();
