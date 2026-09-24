(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const script = document.currentScript ||
    [...document.querySelectorAll('script[data-slug]')].pop();

  const SLUG = script.getAttribute('data-slug');
  const API = (script.getAttribute('data-api') || 'https://wakalabot.co.tz').replace(/\/$/, '');
  const SIDE = script.getAttribute('data-position') === 'left' ? 'left' : 'right';

  if (!SLUG) {
    console.error('[WakalaBot] data-slug is required.');
    return;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let biz = null;
  let messages = [];
  let rendered = false;
  let identity = JSON.parse(localStorage.getItem('wk_identity') || 'null');

  // NEW FIX: Clear out old guest sessions from previous testing to prevent 422 errors
  if (identity && identity.phone && identity.phone.startsWith('guest-')) {
    identity = null;
    localStorage.removeItem('wk_identity');
  }

  let isOpen = false;
  let isLoading = false;
  let isAuthed = !!identity;

  // ── Helper: Basic Markdown to HTML ─────────────────────────────────────────
  function parseMarkdown(text) {
    if (!text) return '';
    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?:^|[^\\])_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/(?:^|[^\\])\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    #wkb-root *, #wkb-root *::before, #wkb-root *::after {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; padding: 0;
    }
    #wkb-root {
      position: fixed;
      ${SIDE === 'left' ? 'left: 20px' : 'right: 20px'};
      bottom: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: ${SIDE === 'left' ? 'flex-start' : 'flex-end'};
      gap: 12px;
    }
    #wkb-btn {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: #6366f1;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(99,102,241,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      outline: none;
    }
    #wkb-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(99,102,241,0.55); }
    #wkb-panel {
      width: 360px; height: 530px;
      max-height: calc(100vh - 100px);
      background: #0f172a;
      border-radius: 18px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55);
      display: flex; flex-direction: column;
      overflow: hidden;
      border: 1px solid #1e293b;
      transform-origin: bottom ${SIDE === 'left' ? 'left' : 'right'};
      transform: scale(0.85) translateY(16px);
      opacity: 0; pointer-events: none;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
    }
    #wkb-panel.wkb-open {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }
    #wkb-header {
      padding: 12px 14px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    #wkb-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(99,102,241,0.18);
      border: 1.5px solid rgba(99,102,241,0.35);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: #818cf8; font-size: 15px; flex-shrink: 0;
    }
    #wkb-hinfo { flex: 1; min-width: 0; }
    #wkb-bizname {
      color: #f1f5f9; font-size: 14px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #wkb-online {
      color: #34d399; font-size: 11px;
      display: flex; align-items: center; gap: 4px; margin-top: 2px;
    }
    #wkb-online::before {
      content: '';
      width: 6px; height: 6px;
      border-radius: 50%; background: #34d399;
      display: inline-block;
      animation: wkb-pulse 2s infinite;
    }
    @keyframes wkb-pulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.4; }
    }
    #wkb-closebtn {
      background: none; border: none; cursor: pointer;
      color: #64748b; padding: 6px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    #wkb-closebtn:hover { color: #f1f5f9; background: #334155; }
    #wkb-body {
      flex: 1; display: flex; flex-direction: column;
      overflow: hidden; min-height: 0;
    }
    #wkb-gate {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 24px; gap: 12px; text-align: center;
    }
    #wkb-gate-icon {
      width: 52px; height: 52px; border-radius: 50%;
      background: rgba(99,102,241,0.12);
      display: flex; align-items: center; justify-content: center;
    }
    #wkb-gate h3 { color: #f1f5f9; font-size: 16px; font-weight: 600; }
    #wkb-gate p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 4px; }
    .wkb-field {
      width: 100%;
      background: #1e293b; border: 1.5px solid #334155;
      border-radius: 14px; padding: 14px 16px;
      color: #f1f5f9; font-size: 14px; outline: none;
      transition: border-color 0.2s;
      margin-bottom: 12px;
    }
    .wkb-field:focus { border-color: #6366f1; }
    .wkb-field::placeholder { color: #475569; }
    #wkb-gate-btn {
      width: 100%; background: #6366f1; border: none;
      border-radius: 12px; padding: 12px 16px;
      color: white; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 0.2s; margin-top: 4px;
    }
    #wkb-gate-btn:hover { background: #4f46e5; }
    #wkb-messages {
      flex: 1; overflow-y: auto;
      padding: 20px 16px; display: flex;
      flex-direction: column; gap: 13px;
      min-height: 0;
    }
    #wkb-messages::-webkit-scrollbar { width: 3px; }
    #wkb-messages::-webkit-scrollbar-track { background: transparent; }
    #wkb-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    .wkb-row { display: flex; flex-direction: column; max-width: 82%; gap: 4px; }
    .wkb-row.wkb-u { align-self: flex-end; align-items: flex-end; }
    .wkb-row.wkb-b { align-self: flex-start; align-items: flex-start; }
    .wkb-bub {
      padding: 16px 20px; border-radius: 16px;
      font-size: 14px; line-height: 1.6; word-break: break-word;
    }
    .wkb-bub strong { font-weight: 700; color: inherit; }
    .wkb-bub em { font-style: italic; }
    .wkb-u .wkb-bub {
      background: #6366f1; color: white;
      border-bottom-right-radius: 4px;
    }
    .wkb-b .wkb-bub {
      background: #1e293b; color: #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    .wkb-img {
      border-radius: 12px; max-width: 100%;
      border: 1px solid #334155; display: block;
    }
    #wkb-typing {
      display: flex; gap: 4px;
      padding: 10px 14px;
      background: #1e293b;
      border-radius: 16px; border-bottom-left-radius: 4px;
      align-self: flex-start;
    }
    .wkb-dot {
      width: 7px; height: 7px;
      background: #64748b; border-radius: 50%;
      animation: wkb-bounce 1.2s infinite;
    }
    .wkb-dot:nth-child(2) { animation-delay: 0.2s; }
    .wkb-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes wkb-bounce {
      0%,60%,100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    #wkb-inputarea {
      padding: 20px 20px;
      border-top: 1px solid #1e293b;
      background: #1e293b;
      display: flex; gap: 8px; flex-shrink: 0;
    }
    #wkb-input {
      flex: 1;
      background: #0f172a; border: 1.5px solid #334155;
      border-radius: 12px; padding: 10px 13px;
      color: #f1f5f9; font-size: 13px;
      outline: none; resize: none;
      font-family: inherit; min-height: 40px; max-height: 80px;
      transition: border-color 0.2s;
    }
    #wkb-input:focus { border-color: #6366f1; }
    #wkb-input::placeholder { color: #94a3b8; }
    #wkb-sendbtn {
      width: 40px; height: 40px; flex-shrink: 0;
      background: #6366f1; border: none;
      border-radius: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s; outline: none;
    }
    #wkb-sendbtn:hover { background: #4f46e5; }
    #wkb-sendbtn:disabled { opacity: 0.4; cursor: not-allowed; }
    #wkb-wm {
      text-align: center; padding: 5px 0 8px;
      font-size: 11px; color: #94a3b8; flex-shrink: 0;
    }
    #wkb-wm a { color: #6366f1; text-decoration: none; }
    @media (max-width: 420px) {
      #wkb-panel { 
        width: calc(100vw - 24px); 
        height: 400px;
        max-height: calc(100vh - 80px);
        border-radius: 14px; 
      }
      #wkb-root { ${SIDE === 'left' ? 'left: 12px' : 'right: 12px'}; bottom: 12px; }
    }
    #wkb-disclaimer {
        text-align: center;
        font-size: 11px;
        color: #94a3b8;
        padding: 4px 0 6px;
        flex-shrink: 0;
      }
    #wkb-notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(245, 158, 11, 0.2);
      flex-shrink: 0;
      transition: background 0.3s;
    }
    #wkb-notice.wkb-notice-unread {
      background: rgba(245, 158, 11, 0.1);
      animation: wkb-noticepulse 2s infinite;
    }
    #wkb-notice.wkb-notice-read {
      background: rgba(245, 158, 11, 0.04);
    }
    @keyframes wkb-noticepulse {
      0%, 100% { background: rgba(245, 158, 11, 0.10); }
      50% { background: rgba(245, 158, 11, 0.20); }
    }
    #wkb-notice-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; color: red; }
    #wkb-notice-text {
      flex: 1;
      font-size: 11px;
      color: #fcd34d;
      line-height: 1.5;
      word-break: break-word;
    }
    #wkb-notice-gotit {
      flex-shrink: 0;
      font-size: 9px;
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 4px;
      padding: 2px 6px;
      background: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    #wkb-notice-gotit:hover { background: rgba(245, 158, 11, 0.15); }
  `;

  // ── Inject CSS ────────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.id = 'wkb-styles';
  document.head.appendChild(styleEl);
  styleEl.textContent = css;

  // ── Build skeleton DOM ────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'wkb-root';

  const panel = document.createElement('div');
  panel.id = 'wkb-panel';

  panel.innerHTML = `
    <div id="wkb-header">
      <div id="wkb-avatar">?</div>
      <div id="wkb-hinfo">
        <div id="wkb-bizname">Loading</div>
        <div id="wkb-online">AI Assistant Online</div>
      </div>
      <button id="wkb-closebtn" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="wkb-body"></div>
    <div id="wkb-wm">Powered by <a href="https://wakalabot.co.tz" target="_blank">Wakalabot</a></div>
  `;

  const btn = document.createElement('button');
  btn.id = 'wkb-btn';
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </svg>
  `;

  root.appendChild(panel);
  root.appendChild(btn);
  document.body.appendChild(root);

  // ── Wire close + toggle ───────────────────────────────────────────────────
  document.getElementById('wkb-closebtn').addEventListener('click', () => togglePanel(false));
  btn.addEventListener('click', () => togglePanel());

  function togglePanel(force) {
    isOpen = force !== undefined ? force : !isOpen;
    if (isOpen) {
      panel.classList.add('wkb-open');
      if (!rendered) {
        rendered = true;
        isAuthed ? renderChat() : renderGate();
      }
    } else {
      panel.classList.remove('wkb-open');
    }
  }

  // ── Load biz info ─────────────────────────────────────────────────────────
  fetch(`${API}/api/v1/chat/business/${SLUG}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      biz = data;
      const nameEl = document.getElementById('wkb-bizname');
      const avatarEl = document.getElementById('wkb-avatar');
      if (nameEl) nameEl.textContent = biz.biz_name;
      if (avatarEl) {
        if (biz.logo_url) {
          avatarEl.innerHTML = `<img src="${biz.logo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${biz.biz_name}" onerror="this.style.display='none'">`;
        } else {
          avatarEl.textContent = biz.biz_name.charAt(0).toUpperCase();
        }
      }
    })
    .catch(() => {});

  // ── Load notice ───────────────────────────────────────────────────────────
  let activeNotice = null;

  fetch(`${API}/api/v1/chat/notice/${SLUG}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.notice) return;
      activeNotice = data.notice;
    })
    .catch(() => {});

  // ── Gate (Asks for Name + Phone) ──────────────────────────────────────────
  function renderGate() {
    const body = document.getElementById('wkb-body');
    body.innerHTML = `
      <div id="wkb-gate">
        <div id="wkb-gate-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#818cf8">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
        <h3>Karibu Tunza Mazungumzo</h3>
        <p>Tafadhali weka taarifa zako hapa chini kuanza kuongea nasi.</p>
        <input id="wkb-name-input" class="wkb-field" type="text" placeholder="Jina lako (mfano. Juma, Sarah...)" maxlength="50"/>
        <input id="wkb-phone-field" class="wkb-field" type="tel" placeholder="Namba ya simu (mfano. 07123...)" maxlength="15"/>
        <button id="wkb-gate-btn">Anza Mazungumzo</button>
      </div>
    `;
    setTimeout(() => {
      const nameInp = document.getElementById('wkb-name-input');
      const phoneInp = document.getElementById('wkb-phone-field');
      const gbtn = document.getElementById('wkb-gate-btn');
      
      if (nameInp) nameInp.focus();
      if (phoneInp) {
        phoneInp.addEventListener('keydown', e => { if (e.key === 'Enter') handleGateSubmit(); });
      }
      if (gbtn) gbtn.addEventListener('click', handleGateSubmit);
    }, 50);
  }

  function handleGateSubmit() {
    const nameInp = document.getElementById('wkb-name-input');
    const phoneInp = document.getElementById('wkb-phone-field');
    const nameVal = (nameInp ? nameInp.value : '').trim();
    const phoneVal = (phoneInp ? phoneInp.value : '').trim();
    
    if (!nameVal || !phoneVal) return; 
    
    identity = {
      name: nameVal,
      phone: phoneVal,
    };
    localStorage.setItem('wk_identity', JSON.stringify(identity));
    isAuthed = true;
    renderChat();
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function renderChat() {
    const body = document.getElementById('wkb-body');

    const noticeKey = activeNotice ? `wkb_notice_${SLUG}_${activeNotice.slice(0, 20)}` : null;
    const noticeAlreadyRead = noticeKey ? !!localStorage.getItem(noticeKey) : true;
    const noticeHtml = activeNotice ? `
      <div id="wkb-notice" class="${noticeAlreadyRead ? 'wkb-notice-read' : 'wkb-notice-unread'}">
        <span id="wkb-notice-icon">${noticeAlreadyRead ? '\u{1F4E2}' : '\u{26A0}'}</span>
        <span id="wkb-notice-text">${activeNotice}</span>
        ${!noticeAlreadyRead ? `<button id="wkb-notice-gotit">Got it</button>` : ''}
      </div>
    ` : '';

    body.innerHTML = `
      ${noticeHtml}
      <div id="wkb-messages"></div>
      <div id="wkb-inputarea">
        <textarea id="wkb-input" placeholder="Andika ujumbe..." rows="1"></textarea>
        <button id="wkb-sendbtn" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div id="wkb-disclaimer">Wakalabot inaweza kukosea. Thibitisha taarifa muhimu.</div>
    `;

    if (activeNotice && !noticeAlreadyRead) {
      setTimeout(() => {
        const gotitBtn = document.getElementById('wkb-notice-gotit');
        const noticeEl = document.getElementById('wkb-notice');
        const iconEl = document.getElementById('wkb-notice-icon');
        if (gotitBtn && noticeEl && noticeKey) {
          gotitBtn.addEventListener('click', () => {
            localStorage.setItem(noticeKey, '1');
            noticeEl.className = 'wkb-notice-read';
            if (iconEl) iconEl.textContent = '\u{1F4E2}';
            gotitBtn.remove();
          });
        }
      }, 50);
    }

    loadHistory().then(() => {
      if (messages.length === 0 && biz) {
        messages.push({
          role: 'assistant',
          content: `Habari ${identity.name}! Karibu ${biz.biz_name}. Naweza kukusaidia nini leo?`,
          image_url: null,
        });
      }
      repaintMessages();
    });

    const inputEl = document.getElementById('wkb-input');
    const sendEl = document.getElementById('wkb-sendbtn');
    if (inputEl) {
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
      inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
      });
    }
    if (sendEl) sendEl.addEventListener('click', doSend);
  }

  async function loadHistory() {
    if (!identity || !SLUG) return;
    
    // NEW FIX: Do not fetch history if the user was just an anonymous guest
    if (identity.phone && identity.phone.startsWith('guest-')) {
      return; 
    }

    try {
      const res = await fetch(
        `${API}/api/v1/chat/history/${SLUG}?customer_phone=${encodeURIComponent(identity.phone)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        messages = data.messages.map(m => ({
          role: m.role,
          content: m.content,
          image_url: m.image_url || null,
        }));
      }
    } catch {}
  }

  function repaintMessages() {
    const area = document.getElementById('wkb-messages');
    if (!area) return;
    area.innerHTML = '';
      messages.forEach(msg => {
    if (msg.role === 'system') {
      const sysRow = document.createElement('div');
      sysRow.style.cssText = `
        align-self: center; max-width: 90%;
        background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25);
        border-radius: 12px; padding: 8px 14px; margin: 4px 0;
        font-size: 12px; color: #fcd34d; text-align: center;
      `;
      sysRow.textContent = `⚠️ ${msg.content}`;
      area.appendChild(sysRow);
      return;
    }

    const row = document.createElement('div');
    row.className = `wkb-row ${msg.role === 'user' ? 'wkb-u' : 'wkb-b'}`;

     

      if (msg.content) {
        const bub = document.createElement('div');
        bub.className = 'wkb-bub';
        bub.innerHTML = parseMarkdown(msg.content);
        row.appendChild(bub);
      }

       if (msg.image_url) {
        const img = document.createElement('img');
        img.src = msg.image_url;
        img.className = 'wkb-img';
        img.alt = 'Product';
        img.crossOrigin = 'anonymous';
        img.style.maxWidth = '220px';
        img.style.marginBottom = msg.content ? '6px' : '0';
        img.onerror = () => { img.style.display = 'none'; };
        row.appendChild(img);
      }

      area.appendChild(row);
    });

    if (isLoading) {
      const t = document.createElement('div');
      t.id = 'wkb-typing';
      t.innerHTML = '<div class="wkb-dot"></div><div class="wkb-dot"></div><div class="wkb-dot"></div>';
      area.appendChild(t);
    }
    area.scrollTop = area.scrollHeight;
  }

  async function doSend() {
    const inputEl = document.getElementById('wkb-input');
    const sendEl = document.getElementById('wkb-sendbtn');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text || isLoading || !biz) return;

    messages.push({ role: 'user', content: text, image_url: null });
    inputEl.value = '';
    inputEl.style.height = 'auto';
    isLoading = true;
    if (sendEl) sendEl.disabled = true;
    repaintMessages();

    try {
      const res = await fetch(`${API}/api/v1/chat/message/noauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          customer_phone: identity.phone,
          customer_name: identity.name,
          tenant_slug: SLUG,
        }),
      });
            if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        messages.push({
          role: res.status === 402 ? 'system' : 'assistant',
          content: err.detail || 'Samahani, kuna tatizo. Tafadhali jaribu tena.',
          image_url: null,
        });
      } else {
        const data = await res.json();
        messages.push({
          role: 'assistant',
          content: data.reply,
          image_url: data.image_url || null,
          tools_used: data.tools_used || [], 
        });
      }
    } catch {
      messages.push({
        role: 'assistant',
        content: 'Kuna tatizo la mtandao. Tafadhali jaribu tena.',
        image_url: null,
      });
    }
    isLoading = false;
    if (sendEl) sendEl.disabled = false;
    repaintMessages();
  }

})();