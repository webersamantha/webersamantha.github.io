const chatStatus = document.getElementById("chat-status");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatClear = document.getElementById("chat-clear");

if (!chatStatus || !chatMessages || !chatForm || !chatInput || !chatClear) {
  // Chat UI not present on this page.
} else {
  const meta = document.querySelector('meta[name="chat-api-url"]');
  const CHAT_API_URL = meta?.content?.trim() || "";
  const isConfigured =
    CHAT_API_URL.length > 0 && !CHAT_API_URL.includes("YOUR-BACKEND-URL");

  const history = [];

  const appendMessage = (role, text, citations = []) => {
    const wrapper = document.createElement("article");
    wrapper.className = `chat-message ${role}`;

    const body = document.createElement("p");
    body.textContent = text;
    wrapper.appendChild(body);

    if (role === "assistant" && citations.length > 0) {
      const refs = document.createElement("div");
      refs.className = "chat-citations";

      citations.forEach((citation, index) => {
        if (!citation || !citation.file_name) {
          return;
        }

        const link = document.createElement("a");
        const encodedFile = encodeURIComponent(citation.file_name);
        const pageSuffix = Number.isInteger(citation.page)
          ? `#page=${citation.page}`
          : "";

        link.href = `publications/${encodedFile}${pageSuffix}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const shortTitle = citation.title || citation.file_name;
        const maxTitleLength = 42;
        const compactTitle =
          shortTitle.length > maxTitleLength
            ? `${shortTitle.slice(0, maxTitleLength).trim()}...`
            : shortTitle;

        const labelParts = [`[${index + 1}]`, compactTitle];
        if (Number.isInteger(citation.page)) {
          labelParts.push(`p.${citation.page}`);
        }

        link.textContent = labelParts.join(" ");
        refs.appendChild(link);
      });

      if (refs.childElementCount > 0) {
        wrapper.appendChild(refs);
      }
    }

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const resetConversation = () => {
    history.length = 0;
    chatMessages.innerHTML = "";
    appendMessage(
      "assistant",
      "Hi. Ask me anything about Samantha's publications and I will answer with citations."
    );
  };

  resetConversation();

  if (isConfigured) {
    chatStatus.textContent = "Chatbot is connected.";
  } else {
    chatStatus.textContent =
      "Chatbot is currently offline. Add your backend URL in the chat-api-url meta tag.";
  }

  chatInput.addEventListener("keydown", (event) => {
    const isPlainEnter =
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;

    if (!isPlainEnter || event.isComposing) {
      return;
    }

    event.preventDefault();
    if (typeof chatForm.requestSubmit === "function") {
      chatForm.requestSubmit();
    } else {
      chatForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = chatInput.value.trim();
    if (!message) {
      return;
    }

    appendMessage("user", message);
    history.push({ role: "user", content: message });
    chatInput.value = "";

    if (!isConfigured) {
      appendMessage(
        "assistant",
        "I can't answer yet because the backend API URL is not configured."
      );
      return;
    }

    const submitButton = chatForm.querySelector("button[type='submit']");
    if (submitButton) {
      submitButton.disabled = true;
    }

    chatStatus.textContent = "Thinking...";

    try {
      const response = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: history.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const answer = payload.answer || "I could not produce an answer.";
      const citations = Array.isArray(payload.citations) ? payload.citations : [];

      appendMessage("assistant", answer, citations);
      history.push({ role: "assistant", content: answer });
      chatStatus.textContent = "Chatbot is connected.";
    } catch (error) {
      appendMessage(
        "assistant",
        "The chatbot had a connection issue. Please try again in a moment."
      );
      chatStatus.textContent = "Connection issue.";
      console.error(error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  chatClear.addEventListener("click", () => {
    resetConversation();
    chatStatus.textContent = isConfigured
      ? "Chatbot is connected."
      : "Chatbot is currently offline. Add your backend URL in the chat-api-url meta tag.";
  });
}
