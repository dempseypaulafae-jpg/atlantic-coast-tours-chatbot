"use strict";

/*
  Replace this placeholder after the Cloudflare Worker is deployed.
  Example: https://atlantic-coast-tours-api.your-name.workers.dev
*/
const CONFIG = Object.freeze({
  API_BASE_URL: "https://atlantic-coast-tours-api.dempsey-paulafae.workers.dev",
  CHAT_PATH: "/chat",
  REQUEST_TIMEOUT_MS: 30000
});

const elements = {
  chatForm: document.querySelector("#chatForm"),
  chatLog: document.querySelector("#chatLog"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  clearChatButton: document.querySelector("#clearChatButton"),
  messageTemplate: document.querySelector("#messageTemplate"),
  serviceStatus: document.querySelector("#serviceStatus"),
  sourcesPanel: document.querySelector("#sourcesPanel"),
  sourcesContent: document.querySelector("#sourcesContent"),
  sourceCount: document.querySelector("#sourceCount"),
  suggestionButtons: document.querySelectorAll("[data-question]")
};

const state = {
  conversationId: createId("conversation"),
  history: [],
  sources: [],
  busy: false
};

function createId(prefix = "request") {
  const randomPart = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return `${prefix}-${Date.now()}-${randomPart}`;
}

function endpointIsConfigured() {
  return (
    CONFIG.API_BASE_URL.startsWith("https://") &&
    !CONFIG.API_BASE_URL.includes("YOUR-CLOUDFLARE-WORKER")
  );
}

function setStatus(mode, text) {
  elements.serviceStatus.classList.remove("is-busy", "is-error");

  if (mode === "busy") {
    elements.serviceStatus.classList.add("is-busy");
  }

  if (mode === "error") {
    elements.serviceStatus.classList.add("is-error");
  }

  elements.serviceStatus.querySelector("span:last-child").textContent = text;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.sendButton.disabled = isBusy;
  elements.messageInput.disabled = isBusy;
  setStatus(isBusy ? "busy" : "ready", isBusy ? "Thinking…" : "Assistant ready");
}

function addMessage(role, text, options = {}) {
  const clone = elements.messageTemplate.content.cloneNode(true);
  const wrapper = clone.querySelector(".message");
  const avatar = clone.querySelector(".avatar");
  const content = clone.querySelector(".message-content");

  wrapper.classList.add(role === "user" ? "message-user" : "message-assistant");

  if (options.error) {
    wrapper.classList.add("message-error");
  }

  avatar.textContent = role === "user" ? "Y" : "A";
  content.textContent = text;

  elements.chatLog.appendChild(clone);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function addTypingIndicator() {
  const clone = elements.messageTemplate.content.cloneNode(true);
  const wrapper = clone.querySelector(".message");
  const avatar = clone.querySelector(".avatar");
  const content = clone.querySelector(".message-content");

  wrapper.classList.add("message-assistant");
  wrapper.dataset.typing = "true";
  avatar.textContent = "A";
  content.innerHTML = `
    <span class="typing" aria-label="Assistant is typing">
      <span></span><span></span><span></span>
    </span>
  `;

  elements.chatLog.appendChild(clone);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function removeTypingIndicator() {
  elements.chatLog.querySelector("[data-typing='true']")?.remove();
}

function normaliseSources(rawSources, fallbackRequestId) {
  if (!Array.isArray(rawSources)) {
    return [];
  }

  return rawSources
    .filter((source) => source && typeof source === "object")
    .map((source) => ({
      name: String(source.name || "Live source"),
      type: String(source.type || "external"),
      retrievedAt: source.retrievedAt || new Date().toISOString(),
      requestId: String(source.requestId || fallbackRequestId || "Not supplied")
    }));
}

function renderSources(sources) {
  state.sources = sources;
  elements.sourceCount.textContent = String(sources.length);

  if (sources.length === 0) {
    elements.sourcesContent.innerHTML = `
      <p class="empty-state">
        No live source details were returned for this answer.
      </p>
    `;
    return;
  }

  elements.sourcesContent.replaceChildren();

  for (const source of sources) {
    const item = document.createElement("article");
    item.className = "source-item";

    const name = document.createElement("strong");
    name.textContent = source.name;

    const type = document.createElement("span");
    type.className = "source-type";
    type.textContent = source.type;

    const meta = document.createElement("div");
    meta.className = "source-meta";

    const retrieved = formatDateTime(source.retrievedAt);
    meta.textContent = `Retrieved: ${retrieved} · Request ID: ${source.requestId}`;

    item.append(name, type, meta);
    elements.sourcesContent.appendChild(item);
  }
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);
}

function autoResizeInput() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
}

async function sendQuestion(question) {
  const cleanQuestion = question.trim();

  if (!cleanQuestion || state.busy) {
    return;
  }

  addMessage("user", cleanQuestion);
  state.history.push({ role: "user", content: cleanQuestion });
  elements.messageInput.value = "";
  autoResizeInput();
  setBusy(true);
  addTypingIndicator();

  const requestId = createId("act");

  try {
    if (!endpointIsConfigured()) {
      throw new Error(
        "The secure chatbot backend has not been connected yet. Replace the API_BASE_URL placeholder in app.js after the Cloudflare Worker is deployed."
      );
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      CONFIG.REQUEST_TIMEOUT_MS
    );

    const response = await fetch(
      `${CONFIG.API_BASE_URL.replace(/\/$/, "")}${CONFIG.CHAT_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId
        },
        body: JSON.stringify({
          message: cleanQuestion,
          conversationId: state.conversationId,
          requestId,
          history: state.history.slice(-10)
        }),
        signal: controller.signal
      }
    );

    window.clearTimeout(timeoutId);

    let payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error("The backend returned an unreadable response.");
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed with status ${response.status}.`);
    }

    const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";

    if (!reply) {
      throw new Error("The backend did not return an assistant reply.");
    }

    removeTypingIndicator();
    addMessage("assistant", reply);
    state.history.push({ role: "assistant", content: reply });

    const sources = normaliseSources(payload.sources, payload.requestId || requestId);
    renderSources(sources);

    if (sources.length > 0) {
      elements.sourcesPanel.open = true;
    }

    setStatus("ready", "Assistant ready");
  } catch (error) {
    removeTypingIndicator();

    const message =
      error.name === "AbortError"
        ? "The request took too long. Please try again."
        : error.message || "Something went wrong. Please try again.";

    addMessage("assistant", message, { error: true });
    setStatus("error", "Connection issue");
  } finally {
    setBusy(false);
    elements.messageInput.focus();
  }
}

function clearConversation() {
  state.conversationId = createId("conversation");
  state.history = [];
  state.sources = [];

  elements.chatLog.innerHTML = `
    <div class="message message-assistant">
      <div class="avatar" aria-hidden="true">A</div>
      <div class="message-content">
        <p>
          Conversation cleared. Ask me about a tour, price, availability or destination weather.
        </p>
      </div>
    </div>
  `;

  renderSources([]);
  elements.sourcesPanel.open = false;
  setStatus("ready", "Assistant ready");
  elements.messageInput.focus();
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQuestion(elements.messageInput.value);
});

elements.messageInput.addEventListener("input", autoResizeInput);

elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});

elements.clearChatButton.addEventListener("click", clearConversation);

for (const button of elements.suggestionButtons) {
  button.addEventListener("click", () => {
    sendQuestion(button.dataset.question || "");
  });
}

renderSources([]);
autoResizeInput();
