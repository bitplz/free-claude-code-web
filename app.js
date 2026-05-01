// ══════════════════════════════════════════════════
//  LocalAI — app.js  v2  (downloads + ask-options)
// ══════════════════════════════════════════════════

// ── System instruction appended to every request ──
const ASK_SYSTEM = `
When you want to ask the user a multiple-choice question or need them to pick from a set of options, use this exact block format:

:::ask
Your question here?
- Option A
- Option B
- Option C
- Option D
:::

Rules:
- Use :::ask blocks ONLY when you genuinely need the user to choose between discrete options.
- Each option must be on its own line starting with "- ".
- 2 to 5 options maximum.
- After the user selects an option, continue the conversation normally.
- Do NOT use :::ask for rhetorical questions or when a text reply is appropriate.
`.trim();

// ── Ext → filename map ────────────────────────────
const EXT_MAP = {
  js:'script.js', javascript:'script.js', ts:'script.ts', typescript:'script.ts',
  jsx:'component.jsx', tsx:'component.tsx',
  dart:'main.dart', py:'script.py', python:'script.py',
  html:'index.html', css:'styles.css', scss:'styles.scss',
  json:'data.json', yaml:'config.yaml', yml:'config.yml',
  sh:'script.sh', bash:'script.sh', bat:'script.bat', ps1:'script.ps1',
  sql:'query.sql', md:'readme.md', markdown:'readme.md',
  xml:'data.xml', csv:'data.csv', toml:'config.toml',
  c:'main.c', cpp:'main.cpp', h:'header.h',
  java:'Main.java', kotlin:'Main.kt', swift:'Main.swift',
  go:'main.go', rs:'main.rs', rust:'main.rs', rb:'script.rb',
  php:'script.php', r:'script.r',
};

// ── State ─────────────────────────────────────────
const S = {
  chats: {},
  activeChatId: null,
  currentModel: 'claude-3-5-sonnet-20241022',
  currentModelLabel: 'Sonnet 3.5',
  proxyUrl: 'http://localhost:8082',
  authToken: 'freecc',
  systemPrompt: '',
  maxTokens: 8192,
  customModels: [],
  pendingFiles: [],
  isGenerating: false,
  abortCtrl: null,
};

// ── Boot ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadChats();
  checkProxy();
  setInterval(checkProxy, 18000);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.model-wrap'))
      document.getElementById('model-drop').classList.add('hidden');
  });
});

// ══════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════
function loadSettings() {
  const s = JSON.parse(localStorage.getItem('lai-settings') || '{}');
  S.proxyUrl          = s.proxyUrl     || 'http://localhost:8082';
  S.authToken         = s.authToken    || 'freecc';
  S.systemPrompt      = s.systemPrompt || '';
  S.maxTokens         = s.maxTokens    || 8192;
  S.currentModel      = s.model        || 'claude-3-5-sonnet-20241022';
  S.currentModelLabel = s.modelLabel   || 'Sonnet 3.5';
  S.customModels      = s.customModels || [];
  setModelDisplay(S.currentModelLabel, S.currentModel);
}

function persistSettings() {
  localStorage.setItem('lai-settings', JSON.stringify({
    proxyUrl: S.proxyUrl, authToken: S.authToken,
    systemPrompt: S.systemPrompt, maxTokens: S.maxTokens,
    model: S.currentModel, modelLabel: S.currentModelLabel,
    customModels: S.customModels,
  }));
}

function openSettings() {
  document.getElementById('proxy-url').value     = S.proxyUrl;
  document.getElementById('auth-token').value    = S.authToken;
  document.getElementById('system-prompt').value = S.systemPrompt;
  document.getElementById('max-tokens').value    = S.maxTokens;
  document.getElementById('setup-modal').classList.add('hidden');
  document.getElementById('settings-modal').classList.remove('hidden');
  switchTab('general');
  renderCustomModelsList();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  S.proxyUrl     = (document.getElementById('proxy-url').value || '').replace(/\/+$/, '') || 'http://localhost:8082';
  S.authToken    = document.getElementById('auth-token').value || 'freecc';
  S.systemPrompt = document.getElementById('system-prompt').value;
  S.maxTokens    = parseInt(document.getElementById('max-tokens').value) || 8192;
  persistSettings();
  closeSettings();
  checkProxy();
}

function switchTab(tab) {
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tab-general').classList.toggle('hidden', tab !== 'general');
  document.getElementById('tab-models').classList.toggle('hidden', tab !== 'models');
  // Auto-detect when models tab opens
  if (tab === 'models') detectProxyModels();
}

// ── Detect models from proxy /v1/models ───────────
async function detectProxyModels() {
  const label  = document.getElementById('detect-label');
  const btn    = document.getElementById('btn-detect');
  const box    = document.getElementById('detected-models');

  label.textContent = 'Detecting…';
  btn.disabled = true;
  box.classList.add('hidden');
  box.innerHTML = '';

  try {
    const res = await fetch(`${S.proxyUrl}/v1/models`, {
      headers: { 'x-api-key': S.authToken, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(5000),
    });

    let models = [];

    if (res.ok) {
      const data = await res.json();
      // Anthropic format: { data: [{id, ...}] }
      if (Array.isArray(data?.data)) {
        models = data.data.map(m => ({ id: m.id, name: friendlyName(m.id), desc: m.description || '' }));
      } else if (Array.isArray(data?.models)) {
        models = data.models.map(m => ({ id: m.id || m, name: friendlyName(m.id || m), desc: '' }));
      } else if (typeof data === 'object') {
        // Some proxies return { model: "..." } or flat object
        models = Object.entries(data)
          .filter(([k]) => k.toLowerCase().includes('model'))
          .map(([k, v]) => ({ id: String(v), name: friendlyName(String(v)), desc: k }));
      }
    }

    // Deduplicate against already-saved models
    const savedIds = new Set(S.customModels.map(m => m.id));
    const fresh = models.filter(m => m.id && !savedIds.has(m.id));

    if (!fresh.length && !models.length) {
      label.textContent = 'No models returned by proxy';
      renderEnvHint(box);
      box.classList.remove('hidden');
    } else if (!fresh.length) {
      label.textContent = `All ${models.length} detected model(s) already saved`;
      box.classList.add('hidden');
    } else {
      label.textContent = `${fresh.length} model(s) detected from proxy`;
      box.innerHTML = fresh.map(m => `
        <div class="detected-item">
          <div class="detected-item-body">
            <span class="detected-item-name">${esc(m.name)}</span>
            <span class="detected-item-id">${esc(m.id)}</span>
            ${m.desc ? `<span class="detected-item-desc">${esc(m.desc)}</span>` : ''}
          </div>
          <div class="detected-item-actions">
            <button class="btn-use-now" onclick="useModelNow('${esc(m.id)}','${esc(m.name)}')">
              Use Now
            </button>
            <button class="btn-save-model" onclick="saveDetectedModel('${esc(m.id)}','${esc(m.name)}','${esc(m.desc)}')">
              + Save
            </button>
          </div>
        </div>`).join('');
      box.classList.remove('hidden');
    }
  } catch (err) {
    label.textContent = 'Proxy unreachable — use manual entry below';
    renderEnvHint(box);
    box.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

function renderEnvHint(box) {
  box.innerHTML = `
    <div class="env-hint">
      <div class="env-hint-title">Set your model in <code>.env</code> then restart the proxy:</div>
      <div class="env-hint-code">MODEL="nvidia_nim/z-ai/glm4.7"
NVIDIA_NIM_API_KEY="nvapi-xxxx"
ANTHROPIC_AUTH_TOKEN="freecc"</div>
      <div class="env-hint-sub">Then click <b>Detect</b> again — models from your .env will appear here automatically.</div>
    </div>`;
}

function friendlyName(id) {
  if (!id) return 'Unknown';
  // e.g. "nvidia_nim/z-ai/glm4.7" → "GLM 4.7"
  //      "claude-3-5-sonnet-20241022" → "Claude Sonnet 3.5"
  const known = {
    'claude-3-haiku-20240307': 'Claude Haiku',
    'claude-3-5-haiku-20241022': 'Claude Haiku 3.5',
    'claude-3-5-sonnet-20241022': 'Claude Sonnet 3.5',
    'claude-3-opus-20240229': 'Claude Opus',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5',
    'claude-opus-4-5': 'Claude Opus 4.5',
  };
  if (known[id]) return known[id];
  // Extract last segment and prettify
  const parts = id.split('/');
  const last  = parts[parts.length - 1] || id;
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function saveDetectedModel(id, name, desc) {
  if (S.customModels.some(m => m.id === id)) return;
  S.customModels.push({ name, id, desc });
  persistSettings();
  renderCustomModelsList();
  renderCustomDropItems();
  // Re-run detect to update "already saved" state
  detectProxyModels();
}

function useModelNow(id, name) {
  saveDetectedModel(id, name, '');
  selectModel(id, name);
  closeSettings();
}

// ── Custom Models ─────────────────────────────────
function addCustomModel() {
  const name = document.getElementById('new-model-name').value.trim();
  const id   = document.getElementById('new-model-id').value.trim();
  const desc = document.getElementById('new-model-desc').value.trim();
  if (!name || !id) { alert('Display name and Model ID are required.'); return; }
  S.customModels.push({ name, id, desc });
  persistSettings();
  document.getElementById('new-model-name').value = '';
  document.getElementById('new-model-id').value   = '';
  document.getElementById('new-model-desc').value = '';
  renderCustomModelsList();
  renderCustomDropItems();
}

function deleteCustomModel(idx) {
  S.customModels.splice(idx, 1);
  persistSettings();
  renderCustomModelsList();
  renderCustomDropItems();
}

function renderCustomModelsList() {
  const el = document.getElementById('custom-models-list');
  if (!S.customModels.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:4px 0">No custom models yet.</div>';
    return;
  }
  el.innerHTML = S.customModels.map((m, i) => `
    <div class="custom-model-row-item">
      <div class="cm-body">
        <div class="cm-name">${esc(m.name)}${m.desc ? ` <span style="font-size:11px;font-weight:400;color:var(--text-3)">· ${esc(m.desc)}</span>` : ''}</div>
        <div class="cm-id">${esc(m.id)}</div>
      </div>
      <button class="cm-del" onclick="deleteCustomModel(${i})">Remove</button>
    </div>`).join('');
}

function renderCustomDropItems() {
  const section = document.getElementById('custom-drop-section');
  const el      = document.getElementById('custom-drop-items');
  if (!S.customModels.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  el.innerHTML = S.customModels.map(m => `
    <button class="custom-drop-item" onclick="selectModel('${esc(m.id)}','${esc(m.name)}','${esc(m.desc||'')}','${esc(m.id)}')">
      <div class="drop-item-icon drop-icon-custom">★</div>
      <div class="drop-item-body">
        <span class="drop-item-name">${esc(m.name)}</span>
        <span class="drop-item-id">${esc(m.id)}</span>
      </div>
    </button>`).join('');
}

// ══════════════════════════════════════════════════
//  PROXY CHECK
// ══════════════════════════════════════════════════
async function checkProxy() {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  dot.className = 'dot checking';
  label.textContent = 'Checking…';
  let alive = false;
  try {
    await fetch(`${S.proxyUrl}/v1/models`, {
      headers: { 'x-api-key': S.authToken, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(4000),
    });
    alive = true;
  } catch {
    try {
      await fetch(`${S.proxyUrl}/v1/models`, { mode: 'no-cors', signal: AbortSignal.timeout(4000) });
      alive = true;
    } catch { alive = false; }
  }
  if (alive) {
    dot.className = 'dot online';
    label.textContent = 'Proxy online';
    document.getElementById('setup-modal').classList.add('hidden');
  } else {
    dot.className = 'dot offline';
    label.textContent = 'Proxy offline';
    document.getElementById('setup-modal').classList.remove('hidden');
  }
}
function retryConnection() { checkProxy(); }

// ══════════════════════════════════════════════════
//  MODEL PICKER
// ══════════════════════════════════════════════════
function toggleModelDrop() {
  const dd = document.getElementById('model-drop');
  dd.classList.toggle('hidden');
  if (!dd.classList.contains('hidden')) renderCustomDropItems();
}

function selectModel(modelId, label) {
  S.currentModel      = modelId;
  S.currentModelLabel = label;
  setModelDisplay(label, modelId);
  persistSettings();
  document.getElementById('model-drop').classList.add('hidden');
  if (S.activeChatId && S.chats[S.activeChatId]) {
    S.chats[S.activeChatId].model      = modelId;
    S.chats[S.activeChatId].modelLabel = label;
    saveChats();
  }
}

function setModelDisplay(label) {
  document.getElementById('model-label-display').textContent = label;
  document.getElementById('footer-model').textContent = label;
  const wm = document.getElementById('welcome-model-name');
  if (wm) wm.textContent = label;
}

function quickAddModel() {
  const val = (document.getElementById('quick-model-id').value || '').trim();
  if (!val) return;
  selectModel(val, val);
  document.getElementById('quick-model-id').value = '';
}

// ══════════════════════════════════════════════════
//  FILE HANDLING
// ══════════════════════════════════════════════════
function triggerFileUpload() { document.getElementById('file-input').click(); }

async function handleFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const isImage = file.type.startsWith('image/');
    try {
      if (isImage) {
        const dataUrl = await readAs(file, 'dataURL');
        S.pendingFiles.push({ name: file.name, type: file.type, content: '', isImage: true, dataUrl });
      } else {
        const content = await readAs(file, 'text');
        S.pendingFiles.push({ name: file.name, type: file.type, content, isImage: false, dataUrl: '' });
      }
    } catch (e) { console.warn('File read error', e); }
  }
  document.getElementById('file-input').value = '';
  renderFilePreviews();
}

function readAs(file, mode) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    mode === 'dataURL' ? r.readAsDataURL(file) : r.readAsText(file);
  });
}

function renderFilePreviews() {
  const el = document.getElementById('file-previews');
  if (!S.pendingFiles.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = S.pendingFiles.map((f, i) => f.isImage
    ? `<div class="fp-chip"><img class="fp-img" src="${f.dataUrl}" alt="${esc(f.name)}"/><span class="fp-name">${esc(f.name)}</span><button class="fp-remove" onclick="removePendingFile(${i})">✕</button></div>`
    : `<div class="fp-chip"><span class="fp-icon">${fileIcon(f.name)}</span><span class="fp-name">${esc(f.name)}</span><button class="fp-remove" onclick="removePendingFile(${i})">✕</button></div>`
  ).join('');
}

function removePendingFile(i) { S.pendingFiles.splice(i, 1); renderFilePreviews(); }

function fileIcon(name) {
  const e = name.split('.').pop().toLowerCase();
  return ({pdf:'📄',txt:'📝',md:'📝',csv:'📊',json:'📦',js:'⚡',ts:'⚡',dart:'🎯',py:'🐍',html:'🌐',css:'🎨',sh:'⚙️',bat:'⚙️'})[e] || '📎';
}

function buildFileContext() {
  if (!S.pendingFiles.length) return '';
  let ctx = '\n\n---\n[Attached files]\n';
  for (const f of S.pendingFiles) {
    if (f.isImage) { ctx += `\n[Image: ${f.name}]\n`; continue; }
    const preview = f.content.slice(0, 8000);
    const trunc   = f.content.length > 8000 ? `\n... (truncated, ${f.content.length} chars total)` : '';
    ctx += `\n[File: ${f.name}]\n\`\`\`\n${preview}${trunc}\n\`\`\`\n`;
  }
  return ctx;
}

// ══════════════════════════════════════════════════
//  CHAT MANAGEMENT
// ══════════════════════════════════════════════════
function uid() { return 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

function loadChats() {
  S.chats = JSON.parse(localStorage.getItem('lai-chats') || '{}');
  renderChatList();
  const last = localStorage.getItem('lai-active');
  if (last && S.chats[last]) loadChat(last);
}

function saveChats() { localStorage.setItem('lai-chats', JSON.stringify(S.chats)); }

function newChat() {
  const id = uid();
  S.chats[id] = { title: 'New Chat', messages: [], model: S.currentModel, modelLabel: S.currentModelLabel, createdAt: Date.now() };
  S.activeChatId = id;
  S.pendingFiles = [];
  renderFilePreviews();
  localStorage.setItem('lai-active', id);
  saveChats(); renderChatList(); renderMessages();
  document.getElementById('user-input').focus();
}

function loadChat(id) {
  if (!S.chats[id]) return;
  S.activeChatId = id;
  localStorage.setItem('lai-active', id);
  const c = S.chats[id];
  if (c.model) { S.currentModel = c.model; S.currentModelLabel = c.modelLabel || c.model; }
  setModelDisplay(S.currentModelLabel);
  renderChatList(); renderMessages();
}

function deleteChat(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this chat?')) return;
  delete S.chats[id];
  if (S.activeChatId === id) { S.activeChatId = null; renderMessages(); }
  saveChats(); renderChatList();
}

function filterChats(q) { renderChatList(q); }

function renderChatList(filter = '') {
  const el = document.getElementById('chat-list');
  const items = Object.entries(S.chats)
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    .filter(([, c]) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));

  if (!items.length) { el.innerHTML = `<div style="text-align:center;padding:28px 12px;font-size:12px;color:var(--text-3)">No chats yet</div>`; return; }

  const now  = new Date(); now.setHours(0,0,0,0);
  const yest = new Date(now); yest.setDate(yest.getDate()-1);
  const week = new Date(now); week.setDate(week.getDate()-7);
  const groups = { Today:[], Yesterday:[], 'This Week':[], Older:[] };
  items.forEach(([id, c]) => {
    const d = new Date(c.createdAt||0); d.setHours(0,0,0,0);
    if (d >= now) groups.Today.push([id,c]);
    else if (d >= yest) groups.Yesterday.push([id,c]);
    else if (d >= week) groups['This Week'].push([id,c]);
    else groups.Older.push([id,c]);
  });

  let html = '';
  for (const [g, list] of Object.entries(groups)) {
    if (!list.length) continue;
    html += `<div class="cl-group-label">${g}</div>`;
    for (const [id, c] of list)
      html += `<div class="chat-item ${id===S.activeChatId?'active':''}" onclick="loadChat('${id}')">
        <span class="chat-title">${esc(c.title)}</span>
        <button class="chat-del" onclick="deleteChat('${id}',event)">✕</button>
      </div>`;
  }
  el.innerHTML = html;
}

// ══════════════════════════════════════════════════
//  RENDER MESSAGES
// ══════════════════════════════════════════════════
function renderMessages() {
  const el   = document.getElementById('msgs');
  const chat = S.activeChatId ? S.chats[S.activeChatId] : null;

  if (!chat || !chat.messages.length) {
    el.innerHTML = welcomeHTML();
    return;
  }
  el.innerHTML = chat.messages.map((m, i) => msgHTML(m, i)).join('');
  scrollBottom();
}

function welcomeHTML() {
  return `<div class="welcome" id="welcome">
    <div class="welcome-icon">
      <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="10" fill="url(#ww)"/>
        <path d="M18 8L22 16H28L23 21L25 29L18 24L11 29L13 21L8 16H14L18 8Z" fill="white" opacity="0.95"/>
        <defs><linearGradient id="ww" x1="0" y1="0" x2="36" y2="36"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
      </svg>
    </div>
    <h1 class="welcome-title">What can I help with?</h1>
    <p class="welcome-sub">Running on your local proxy · <span id="welcome-model-name">${esc(S.currentModelLabel)}</span></p>
    <div class="starter-row">
      <button class="starter" onclick="useStarter(this)"><div class="starter-icon">💡</div><strong>Explain a concept</strong><span>Break down a technical topic clearly</span></button>
      <button class="starter" onclick="useStarter(this)"><div class="starter-icon">🛠</div><strong>Write code</strong><span>Build a Flutter widget with BLoC</span></button>
      <button class="starter" onclick="useStarter(this)"><div class="starter-icon">🐛</div><strong>Debug an issue</strong><span>Fix null safety errors in Dart</span></button>
      <button class="starter" onclick="useStarter(this)"><div class="starter-icon">📄</div><strong>Summarize a doc</strong><span>Upload a file and get a summary</span></button>
    </div>
  </div>`;
}

function msgHTML(msg, idx) {
  if (msg.role === 'user') {
    const filesHtml = (msg.files && msg.files.length)
      ? `<div class="msg-files">${msg.files.map(f =>
          f.isImage
            ? `<div class="file-chip"><img class="fp-img" src="${f.dataUrl}" alt="${esc(f.name)}"/><span class="file-chip-name">${esc(f.name)}</span></div>`
            : `<div class="file-chip"><span class="file-chip-icon">${fileIcon(f.name)}</span><span class="file-chip-name">${esc(f.name)}</span></div>`
        ).join('')}</div>` : '';
    return `<div class="msg-row user" id="msg-${idx}">
      <div class="msg-av">R</div>
      <div class="msg-body">${filesHtml}<div class="msg-content">${esc(msg.display || msg.content)}</div></div>
    </div>`;
  }

  return `<div class="msg-row assistant" id="msg-${idx}">
    <div class="msg-av">✦</div>
    <div class="msg-body">
      <div class="msg-content">${renderMd(msg.content)}</div>
      <div class="msg-actions">
        <button class="msg-act" onclick="copyMsg(${idx})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
        </button>
        <button class="msg-act" onclick="regenMsg(${idx})">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.6"/></svg> Retry
        </button>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════
//  SEND & STREAM
// ══════════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById('user-input');
  const text  = input.value.trim();
  if ((!text && !S.pendingFiles.length) || S.isGenerating) return;
  if (!S.activeChatId) newChat();

  const files      = [...S.pendingFiles];
  const display    = text;
  const fullContent = text + buildFileContext();

  S.pendingFiles = []; renderFilePreviews();
  input.value = ''; autoResize(input);

  const chat = S.chats[S.activeChatId];
  chat.messages.push({ role: 'user', content: fullContent, display, files });

  if (chat.messages.filter(m => m.role === 'user').length === 1) {
    chat.title = display.slice(0, 52) + (display.length > 52 ? '…' : '') || (files.length ? `📎 ${files[0].name}` : 'New Chat');
    renderChatList();
  }
  saveChats(); renderMessages();
  await streamAssistant();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 220) + 'px';
}

function useStarter(btn) {
  const span = btn.querySelector('span');
  if (span) { document.getElementById('user-input').value = span.textContent; sendMessage(); }
}

// Called when user clicks an :::ask option button
function selectOption(optionText, msgIdx) {
  // Disable all option buttons in this message to prevent double-click
  const msgEl = document.getElementById(`msg-${msgIdx}`);
  if (msgEl) {
    msgEl.querySelectorAll('.ask-opt').forEach(b => {
      b.disabled = true;
      b.classList.add('selected-opt');
    });
    // Highlight the one they picked
    const all = msgEl.querySelectorAll('.ask-opt');
    all.forEach(b => { if (b.textContent.trim() === optionText) b.classList.add('picked'); });
  }
  document.getElementById('user-input').value = optionText;
  sendMessage();
}

// ── Stream ────────────────────────────────────────
async function streamAssistant() {
  const chat = S.chats[S.activeChatId];
  if (!chat) return;

  S.isGenerating = true;
  document.getElementById('send-btn').disabled = true;
  document.getElementById('stop-btn').classList.remove('hidden');
  S.abortCtrl = new AbortController();

  const msgIdx = chat.messages.length;
  chat.messages.push({ role: 'assistant', content: '' });
  renderMessages();

  const msgEl = document.getElementById(`msg-${msgIdx}`);
  const bubble = msgEl?.querySelector('.msg-content');
  if (bubble) bubble.classList.add('typing');

  try {
    const apiMsgs = chat.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

    // Build full system prompt: user's custom one + ASK_SYSTEM instructions
    const sysPrompt = [S.systemPrompt, ASK_SYSTEM].filter(Boolean).join('\n\n');

    const body = { model: S.currentModel, max_tokens: S.maxTokens, stream: true, messages: apiMsgs };
    if (sysPrompt) body.system = sysPrompt;

    const res = await fetch(`${S.proxyUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': S.authToken, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: S.abortCtrl.signal,
    });

    if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t.slice(0, 250)}`); }

    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let full = '', buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            full += evt.delta.text || '';
            if (bubble) { bubble.innerHTML = renderMd(full); bubble.classList.add('typing'); }
            scrollBottom();
          }
        } catch { /* skip malformed */ }
      }
    }

    chat.messages[msgIdx].content = full || '(no response)';
    if (bubble) { bubble.classList.remove('typing'); bubble.innerHTML = renderMd(chat.messages[msgIdx].content); }

    // Re-render full message row to add action buttons
    const finalEl = document.getElementById(`msg-${msgIdx}`);
    if (finalEl) {
      finalEl.querySelector('.msg-body').innerHTML = `
        <div class="msg-content">${renderMd(chat.messages[msgIdx].content, msgIdx)}</div>
        <div class="msg-actions">
          <button class="msg-act" onclick="copyMsg(${msgIdx})">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
          </button>
          <button class="msg-act" onclick="regenMsg(${msgIdx})">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.6"/></svg> Retry
          </button>
        </div>`;
    }

    saveChats(); scrollBottom();

  } catch (err) {
    if (err.name === 'AbortError') {
      if (bubble) bubble.classList.remove('typing');
      if (!chat.messages[msgIdx].content) { chat.messages.splice(msgIdx, 1); renderMessages(); }
    } else {
      chat.messages[msgIdx].content = `Error: ${err.message}`;
      if (bubble) {
        bubble.classList.remove('typing');
        bubble.innerHTML = `<div class="msg-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${esc(err.message)}<br><small style="color:var(--text-3)">Is the proxy running at ${esc(S.proxyUrl)}?</small></span>
        </div>`;
      }
      saveChats();
    }
  } finally {
    S.isGenerating = false;
    S.abortCtrl    = null;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('stop-btn').classList.add('hidden');
  }
}

function stopGeneration() { S.abortCtrl?.abort(); }

// ── Message Actions ───────────────────────────────
function copyMsg(idx) {
  const chat = S.chats[S.activeChatId];
  if (!chat?.messages[idx]) return;
  navigator.clipboard.writeText(chat.messages[idx].content).then(() => {
    const btn = document.querySelector(`#msg-${idx} .msg-act`);
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1800); }
  });
}

async function regenMsg(idx) {
  const chat = S.chats[S.activeChatId];
  if (!chat || S.isGenerating) return;
  chat.messages = chat.messages.slice(0, idx);
  saveChats(); renderMessages();
  await streamAssistant();
}

// ── Sidebar ───────────────────────────────────────
let sidebarOpen = true;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
}

// ── Helpers ───────────────────────────────────────
function scrollBottom() { const w = document.getElementById('msgs-wrap'); w.scrollTop = w.scrollHeight; }

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ══════════════════════════════════════════════════
//  DOWNLOAD  helpers
// ══════════════════════════════════════════════════
function downloadCode(btn) {
  const pre   = btn.closest('pre');
  const code  = pre?.querySelector('code');
  const lang  = (pre?.querySelector('.code-lang')?.textContent || 'txt').trim().toLowerCase();
  if (!code) return;

  const filename = EXT_MAP[lang] || `code.${lang || 'txt'}`;
  const blob     = new Blob([code.textContent], { type: 'text/plain;charset=utf-8' });
  const url      = URL.createObjectURL(blob);
  const a        = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Feedback
  btn.textContent = '✓ Saved';
  setTimeout(() => btn.textContent = '↓ Download', 2000);
}

function downloadRaw(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════
//  MARKDOWN RENDERER  (with :::ask + download)
// ══════════════════════════════════════════════════
function renderMd(raw, msgIdx) {
  if (!raw) return '';

  // ── :::ask blocks (before escaping so we can handle them raw) ──
  // Parse them out first, replace with a placeholder, then re-inject
  const askBlocks = [];
  const withoutAsk = raw.replace(/:::ask\s*\n([\s\S]*?):::/g, (_, body) => {
    const lines    = body.trim().split('\n');
    const question = lines[0] || 'Choose an option:';
    const opts     = lines.slice(1).filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim());
    askBlocks.push({ question, opts });
    return `%%ASK_BLOCK_${askBlocks.length - 1}%%`;
  });

  let t = esc(withoutAsk);

  // ── Fenced code blocks ──
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const label   = lang || 'text';
    const decoded = code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    return `<pre>
      <div class="code-header">
        <span class="code-lang">${esc(label)}</span>
        <div class="code-btns">
          <button class="code-copy" onclick="copyCode(this)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button class="code-dl" onclick="downloadCode(this)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      </div>
      <code>${esc(decoded)}</code>
    </pre>`;
  });

  // ── Inline code ──
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // ── Headings ──
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // ── Bold / italic ──
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  t = t.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g,         '<em>$1</em>');
  t = t.replace(/__(.+?)__/g,         '<strong>$1</strong>');
  t = t.replace(/_(.+?)_/g,           '<em>$1</em>');

  // ── Blockquote ──
  t = t.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // ── HR ──
  t = t.replace(/^[-*]{3,}$/gm, '<hr>');

  // ── Tables ──
  t = t.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const rows = block.trim().split('\n').filter(r => !/^\|[-:| ]+\|$/.test(r.trim()));
    if (!rows.length) return block;
    const [head, ...body] = rows;
    const th  = head.split('|').filter(Boolean).map(c => `<th>${c.trim()}</th>`).join('');
    const trs = body.map(r => '<tr>' + r.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>').join('');
    return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // ── Ordered list ──
  t = t.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // ── Unordered list ──
  t = t.replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // ── Links ──
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // ── Paragraphs ──
  t = t.replace(/\n\n+/g, '</p><p>');
  t = t.replace(/\n/g, '<br>');
  if (!t.startsWith('<')) t = '<p>' + t + '</p>';
  t = t.replace(/<\/p><p>/g, '</p><p>');

  // ── Re-inject :::ask blocks as interactive UI ──
  t = t.replace(/%%ASK_BLOCK_(\d+)%%/g, (_, i) => {
    const blk = askBlocks[parseInt(i)];
    if (!blk) return '';
    const optsHtml = blk.opts.map(o =>
      `<button class="ask-opt" onclick="selectOption(${JSON.stringify(o)}, ${msgIdx !== undefined ? msgIdx : -1})">${esc(o)}</button>`
    ).join('');
    return `<div class="ask-block">
      <div class="ask-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="ask-body">
        <div class="ask-question">${esc(blk.question)}</div>
        <div class="ask-options">${optsHtml}</div>
      </div>
    </div>`;
  });

  return t;
}

function copyCode(btn) {
  const code = btn.closest('pre')?.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1800);
  });
}
