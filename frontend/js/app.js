/**
 * StudyBuddy AI — Main Application Script
 * Handles: chat logic, API calls, markdown rendering, UI state management
 */

/* ════════════════════════════════════════════════════════════════
   CONFIGURATION
   ════════════════════════════════════════════════════════════════ */
const CONFIG = {
  // Auto-detect environment:
  //   • localhost / 127.0.0.1 → hit local FastAPI server on port 8000
  //   • Netlify / any other host → use relative URLs (netlify.toml rewrites /chat & /health to serverless functions)
  API_BASE: (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) ? "http://localhost:8000" : "",
  MAX_HISTORY: 20,                     // Keep last N messages for context
  TYPING_DELAY_MS: 400,               // Fake delay so loader is visible briefly
  HEALTH_CHECK_INTERVAL: 30_000,      // ms between health-check polls
};

/* ════════════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════════════ */
const state = {
  messages: [],          // { role: "user"|"model", content: string, ts: number }
  language: "English",
  subject: "General",
  isLoading: false,
  sessionHistory: [],    // quick-access list for sidebar
  isApiOnline: false,
};

/* ════════════════════════════════════════════════════════════════
   DOM REFERENCES
   ════════════════════════════════════════════════════════════════ */
const dom = {
  sidebar:           document.getElementById("sidebar"),
  sidebarBackdrop:   document.getElementById("sidebarBackdrop"),
  menuToggle:        document.getElementById("menuToggle"),
  btnNewChat:        document.getElementById("btnNewChat"),
  subjectPills:      document.getElementById("subjectPills"),
  langToggle:        document.getElementById("langToggle"),
  historyList:       document.getElementById("historyList"),
  statusDot:         document.getElementById("statusDot"),
  statusText:        document.getElementById("statusText"),
  currentBadge:      document.getElementById("currentSubjectBadge"),
  clearChatBtn:      document.getElementById("clearChatBtn"),
  chatWindow:        document.getElementById("chatWindow"),
  emptyState:        document.getElementById("emptyState"),
  messages:          document.getElementById("messages"),
  suggestions:       document.getElementById("suggestions"),
  messageInput:      document.getElementById("messageInput"),
  sendBtn:           document.getElementById("sendBtn"),
  toastContainer:    document.getElementById("toastContainer"),
};

/* ════════════════════════════════════════════════════════════════
   MARKED.JS CONFIGURATION (Markdown renderer)
   ════════════════════════════════════════════════════════════════ */
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: (code, lang) => {
    if (window.hljs && lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch {}
    }
    return window.hljs ? hljs.highlightAuto(code).value : code;
  },
});

/* ════════════════════════════════════════════════════════════════
   API LAYER
   ════════════════════════════════════════════════════════════════ */
async function checkHealth() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setApiStatus(data.ai_ready ? "online" : "offline", data.ai_ready
      ? "AI Ready ✓"
      : "API key not set");
    state.isApiOnline = data.ai_ready;
  } catch {
    setApiStatus("offline", "Backend offline");
    state.isApiOnline = false;
  }
}

async function sendMessageToAPI(userMessage) {
  // Build history payload (exclude the message we just sent)
  const historyForAPI = state.messages.slice(-CONFIG.MAX_HISTORY).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const payload = {
    message: userMessage,
    history: historyForAPI,
    language: state.language,
    subject: state.subject,
  };

  const res = await fetch(`${CONFIG.API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Server error ${res.status}`);
  }

  return await res.json();   // { reply, timestamp }
}

/* ════════════════════════════════════════════════════════════════
   UI — API STATUS
   ════════════════════════════════════════════════════════════════ */
function setApiStatus(type, text) {
  dom.statusDot.className = `status-dot status-dot--${type}`;
  dom.statusText.textContent = text;
}

/* ════════════════════════════════════════════════════════════════
   UI — TOAST NOTIFICATIONS
   ════════════════════════════════════════════════════════════════ */
const TOAST_ICONS = {
  error:   "ph-x-circle",
  success: "ph-check-circle",
  warn:    "ph-warning",
  info:    "ph-info",
};

function showToast(message, type = "info", duration = 4000) {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="ph-fill ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i><span>${message}</span>`;
  dom.toastContainer.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(10px)";
    el.style.transition = "all 0.4s ease";
    setTimeout(() => el.remove(), 400);
  }, duration);
}

/* ════════════════════════════════════════════════════════════════
   UI — EMPTY STATE
   ════════════════════════════════════════════════════════════════ */
function updateEmptyState() {
  const hasMessages = state.messages.length > 0;
  dom.emptyState.classList.toggle("hidden", hasMessages);
  dom.messages.classList.toggle("hidden", !hasMessages);
}

/* ════════════════════════════════════════════════════════════════
   UI — MESSAGE RENDERING
   ════════════════════════════════════════════════════════════════ */
function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text) {
  // Sanitize basic XSS before rendering
  const clean = text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript:/gi, "");
  return marked.parse(clean);
}

function addCopyButtonsToCodeBlocks(container) {
  container.querySelectorAll("pre").forEach(pre => {
    if (pre.querySelector(".code-copy-btn")) return;  // Already added
    const btn = document.createElement("button");
    btn.className = "code-copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.innerText || pre.innerText;
      await navigator.clipboard.writeText(code).catch(() => {});
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

function createMessageElement(role, content, timestamp) {
  const isUser = role === "user";
  const row = document.createElement("div");
  row.className = `message-row message-row--${isUser ? "user" : "ai"}`;

  const avatar = document.createElement("div");
  avatar.className = `message-avatar message-avatar--${isUser ? "user" : "ai"}`;
  avatar.innerHTML = isUser
    ? `<i class="ph-fill ph-user"></i>`
    : `<i class="ph-fill ph-graduation-cap"></i>`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (isUser) {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = renderMarkdown(content);
    // Syntax highlight all code blocks
    if (window.hljs) {
      bubble.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
    }
    addCopyButtonsToCodeBlocks(bubble);
  }

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = isUser ? `You · ${formatTime(timestamp)}` : `StudyBuddy AI · ${formatTime(timestamp)}`;

  const contentWrapper = document.createElement("div");
  contentWrapper.style.maxWidth = "100%";
  contentWrapper.appendChild(bubble);
  contentWrapper.appendChild(meta);

  row.appendChild(avatar);
  row.appendChild(contentWrapper);

  return row;
}

function createLoadingElement() {
  const row = document.createElement("div");
  row.className = "message-row message-row--ai message-row--loading";
  row.id = "loadingRow";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar message-avatar--ai";
  avatar.innerHTML = `<i class="ph-fill ph-graduation-cap"></i>`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

function appendMessage(role, content, timestamp) {
  const el = createMessageElement(role, content, timestamp ?? Date.now() / 1000);
  dom.messages.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  dom.chatWindow.scrollTo({ top: dom.chatWindow.scrollHeight, behavior: "smooth" });
}

/* ════════════════════════════════════════════════════════════════
   UI — SIDEBAR HISTORY
   ════════════════════════════════════════════════════════════════ */
function addToHistory(firstMessage) {
  const truncated = firstMessage.length > 38
    ? firstMessage.slice(0, 36) + "…"
    : firstMessage;

  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `<i class="ph ph-chat-circle-text"></i><span>${truncated}</span>`;
  li.title = firstMessage;

  // Remove "no chats" placeholder on first real entry
  const placeholder = dom.historyList.querySelector(".history-empty");
  if (placeholder) placeholder.remove();

  dom.historyList.prepend(li);
}

/* ════════════════════════════════════════════════════════════════
   CORE — SEND MESSAGE FLOW
   ════════════════════════════════════════════════════════════════ */
async function handleSend() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isLoading) return;

  // Clear input
  dom.messageInput.value = "";
  dom.messageInput.style.height = "auto";
  dom.sendBtn.disabled = true;

  // Add to state
  const userTs = Date.now() / 1000;
  state.messages.push({ role: "user", content: text, ts: userTs });

  // Add to history sidebar on first message
  if (state.messages.filter(m => m.role === "user").length === 1) {
    addToHistory(text);
  }

  // Render user bubble
  updateEmptyState();
  appendMessage("user", text, userTs);

  // Show typing indicator
  const loader = createLoadingElement();
  dom.messages.appendChild(loader);
  scrollToBottom();

  state.isLoading = true;

  // Minimum display delay for the loader (UX)
  await new Promise(r => setTimeout(r, CONFIG.TYPING_DELAY_MS));

  try {
    const data = await sendMessageToAPI(text);

    // Remove loader
    loader.remove();

    // Add AI response to state & render
    state.messages.push({ role: "model", content: data.reply, ts: data.timestamp });
    appendMessage("model", data.reply, data.timestamp);

  } catch (err) {
    loader.remove();

    let friendlyError = "Something went wrong. Please try again.";

    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.name === "TimeoutError") {
      friendlyError = "⚠️ Cannot reach the server. Make sure the backend is running on port 8000.";
    } else if (err.message.toLowerCase().includes("api key")) {
      friendlyError = "🔑 API key is not configured. Please set GEMINI_API_KEY in backend/.env";
    } else if (err.message.includes("rate limit") || err.message.includes("429")) {
      friendlyError = "⏳ API rate limit reached. Please wait a moment and try again.";
    } else if (err.message.includes("not configured") || err.message.includes("503")) {
      friendlyError = "🛠️ AI service is not configured. Please add your Gemini API key to backend/.env";
    } else {
      friendlyError = `⚠️ Error: ${err.message}`;
    }

    // Show error as AI message
    const errTs = Date.now() / 1000;
    state.messages.push({ role: "model", content: friendlyError, ts: errTs });
    const errEl = appendMessage("model", friendlyError, errTs);
    errEl.querySelector(".message-bubble").style.borderColor = "var(--color-error)";
    errEl.querySelector(".message-bubble").style.color = "var(--color-error)";

    showToast(friendlyError.replace(/^[^\s]+ /, ""), "error");
  } finally {
    state.isLoading = false;
    dom.sendBtn.disabled = dom.messageInput.value.trim().length === 0;
    dom.messageInput.focus();
  }
}

/* ════════════════════════════════════════════════════════════════
   ACTIONS — CLEAR / NEW CHAT
   ════════════════════════════════════════════════════════════════ */
function clearChat() {
  if (state.messages.length === 0) return;
  state.messages = [];
  dom.messages.innerHTML = "";
  updateEmptyState();
  showToast("Chat cleared. Start a new conversation!", "info");
}

/* ════════════════════════════════════════════════════════════════
   EVENTS — SUBJECT PILLS
   ════════════════════════════════════════════════════════════════ */
dom.subjectPills.addEventListener("click", e => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  dom.subjectPills.querySelectorAll(".pill").forEach(p => p.classList.remove("pill--active"));
  pill.classList.add("pill--active");
  state.subject = pill.dataset.subject;
  dom.currentBadge.textContent = pill.dataset.subject;
  showToast(`Subject set to: ${state.subject}`, "info", 2000);
});

/* ════════════════════════════════════════════════════════════════
   EVENTS — LANGUAGE TOGGLE
   ════════════════════════════════════════════════════════════════ */
dom.langToggle.addEventListener("click", e => {
  const btn = e.target.closest(".lang-btn");
  if (!btn) return;
  dom.langToggle.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("lang-btn--active"));
  btn.classList.add("lang-btn--active");
  state.language = btn.dataset.lang;
  showToast(`Language: ${state.language}`, "info", 2000);
});

/* ════════════════════════════════════════════════════════════════
   EVENTS — SUGGESTIONS
   ════════════════════════════════════════════════════════════════ */
document.getElementById("suggestions").addEventListener("click", e => {
  const card = e.target.closest(".suggestion-card");
  if (!card) return;
  dom.messageInput.value = card.dataset.question;
  dom.messageInput.dispatchEvent(new Event("input"));
  handleSend();
});

/* ════════════════════════════════════════════════════════════════
   EVENTS — INPUT BOX
   ════════════════════════════════════════════════════════════════ */
dom.messageInput.addEventListener("input", () => {
  // Auto-grow textarea
  dom.messageInput.style.height = "auto";
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 160) + "px";
  // Toggle send button
  dom.sendBtn.disabled = dom.messageInput.value.trim().length === 0 || state.isLoading;
});

dom.messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!dom.sendBtn.disabled) handleSend();
  }
});

/* ════════════════════════════════════════════════════════════════
   EVENTS — BUTTONS
   ════════════════════════════════════════════════════════════════ */
dom.sendBtn.addEventListener("click", handleSend);
dom.clearChatBtn.addEventListener("click", clearChat);
dom.btnNewChat.addEventListener("click", () => {
  clearChat();
  closeSidebar();
});

/* ════════════════════════════════════════════════════════════════
   EVENTS — MOBILE SIDEBAR
   ════════════════════════════════════════════════════════════════ */
function openSidebar() {
  dom.sidebar.classList.add("sidebar--open");
  dom.sidebarBackdrop.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  dom.sidebar.classList.remove("sidebar--open");
  dom.sidebarBackdrop.classList.remove("visible");
  document.body.style.overflow = "";
}

dom.menuToggle.addEventListener("click", () => {
  dom.sidebar.classList.contains("sidebar--open") ? closeSidebar() : openSidebar();
});

dom.sidebarBackdrop.addEventListener("click", closeSidebar);

/* ════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════ */
(function init() {
  // Initial API health check
  setApiStatus("loading", "Connecting…");
  checkHealth();

  // Periodic health checks
  setInterval(checkHealth, CONFIG.HEALTH_CHECK_INTERVAL);

  // Initial UI state
  updateEmptyState();

  // Focus input
  setTimeout(() => dom.messageInput.focus(), 100);
})();
