
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const newChatBtn = document.getElementById("newChatBtn");
const userInput = document.getElementById("userInput");
const chat = document.getElementById("chat");
const historyList = document.getElementById("historyList");

// PDF elements
const pdfInput = document.getElementById("pdfInput");
const uploadPdfBtn = document.getElementById("uploadPdfBtn");
const pdfInfo = document.getElementById("pdfInfo");
const pdfName = document.getElementById("pdfName");
const removePdfBtn = document.getElementById("removePdfBtn");
const uploadStatus = document.getElementById("uploadStatus");

// Chat data
let chats = JSON.parse(localStorage.getItem("imnaazChats") || "[]");
let activeChatId = null;

// PDF names for the current browser session
const pdfNamesByChat = new Map();

function saveChats() {
    localStorage.setItem("imnaazChats", JSON.stringify(chats));
}

function getActiveChat() {
    return chats.find(c => c.id === activeChatId);
}

// Update PDF information
function renderPdfInfo() {
    const current = getActiveChat();

    const name = current
        ? pdfNamesByChat.get(current.id)
        : null;

    if (name) {
        pdfName.textContent = "📄 " + name;
        pdfInfo.hidden = false;
    } else {
        pdfInfo.hidden = true;
    }
}

// Remove PDF from backend
async function clearPdfFromServer(chatId) {
    try {
        await fetch("/clear-pdf", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId
            })
        });
    } catch (error) {
        console.error("PDF removal error:", error);
    }
}

// Copy code function
async function copyCode(code, button) {
    try {
        await navigator.clipboard.writeText(code);
    } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
            button.textContent = "Copy Failed";
            return;
        }
    }

    button.textContent = "Copied!";

    setTimeout(() => {
        button.textContent = "Copy Code";
    }, 2000);
}

// Inline Markdown formatting
function renderInlineMarkdown(text, parent) {
    const pattern = /(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        parent.appendChild(
            document.createTextNode(text.slice(lastIndex, match.index))
        );

        const token = match[0];
        let element;

        if (token.startsWith("**")) {
            element = document.createElement("strong");
            element.textContent = token.slice(2, -2);
        } else if (token.startsWith("`")) {
            element = document.createElement("code");
            element.textContent = token.slice(1, -1);
        } else {
            element = document.createElement("em");
            element.textContent = token.slice(1, -1);
        }

        parent.appendChild(element);
        lastIndex = pattern.lastIndex;
    }

    parent.appendChild(
        document.createTextNode(text.slice(lastIndex))
    );
}

// Safe Markdown renderer
function renderMarkdown(text, container) {
    const lines = text.split("\n");
    let list = null;
    let codeBlock = null;

    lines.forEach(line => {

        if (line.trim().startsWith("```")) {
            if (codeBlock) {
                container.appendChild(codeBlock.wrapper);
                codeBlock = null;
            } else {
                list = null;

                const wrapper = document.createElement("div");
                wrapper.className = "code-block-wrapper";

                const copyBtn = document.createElement("button");
                copyBtn.className = "copy-code-btn";
                copyBtn.textContent = "Copy Code";

                const pre = document.createElement("pre");
                pre.className = "markdown-code";

                const code = document.createElement("code");

                pre.appendChild(code);
                wrapper.appendChild(copyBtn);
                wrapper.appendChild(pre);

                codeBlock = {
                    wrapper: wrapper,
                    code: code,
                    copyBtn: copyBtn
                };

                copyBtn.addEventListener("click", () => {
                    copyCode(code.textContent, copyBtn);
                });
            }

            return;
        }

        if (codeBlock) {
            codeBlock.code.textContent += line + "\n";
            return;
        }

        if (!line.trim()) {
            list = null;
            return;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);

        if (heading) {
            list = null;

            const h = document.createElement(
                "h" + heading[1].length
            );

            renderInlineMarkdown(heading[2], h);
            container.appendChild(h);
            return;
        }

        const bullet = line.match(/^\s*[-*]\s+(.+)$/);

        if (bullet) {
            if (!list || list.tagName !== "UL") {
                list = document.createElement("ul");
                container.appendChild(list);
            }

            const li = document.createElement("li");
            renderInlineMarkdown(bullet[1], li);
            list.appendChild(li);
            return;
        }

        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

        if (numbered) {
            if (!list || list.tagName !== "OL") {
                list = document.createElement("ol");
                container.appendChild(list);
            }

            const li = document.createElement("li");
            renderInlineMarkdown(numbered[1], li);
            list.appendChild(li);
            return;
        }

        list = null;

        const p = document.createElement("p");
        renderInlineMarkdown(line, p);
        container.appendChild(p);
    });

    if (codeBlock) {
        container.appendChild(codeBlock.wrapper);
    }
}

// Create new chat
function newChat() {
    const newConversation = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: []
    };

    chats.unshift(newConversation);
    activeChatId = newConversation.id;

    saveChats();
    renderChat();
    renderHistory();
    renderPdfInfo();

    uploadStatus.textContent = "";
}

// Display messages
function renderChat() {
    chat.innerHTML = "";

    const current = getActiveChat();

    if (!current || current.messages.length === 0) {
        const welcome = document.createElement("p");
        welcome.className = "welcome";
        welcome.textContent = "Hello! How can I help you today?";
        chat.appendChild(welcome);
        return;
    }

    current.messages.forEach(message => {
        const bubble = document.createElement("div");

        bubble.className =
            message.role === "user"
                ? "user-message"
                : "ai-message";

        const label = document.createElement("span");
        label.className = "message-label";
        label.textContent =
            message.role === "user" ? "You" : "IMNAAZ AI";

        const content = document.createElement("div");
        content.className = "message-content";

        if (message.role === "assistant") {
            renderMarkdown(message.content, content);
        } else {
            const p = document.createElement("p");
            p.textContent = message.content;
            content.appendChild(p);
        }

        bubble.appendChild(label);
        bubble.appendChild(content);
        chat.appendChild(bubble);
    });

    chat.scrollTop = chat.scrollHeight;
}

// Display chat history
function renderHistory() {
    historyList.innerHTML = "";

    chats.forEach(item => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "5px";

        const openBtn = document.createElement("button");
        openBtn.textContent = item.title;
        openBtn.style.flex = "1";
        openBtn.style.minWidth = "0";
        openBtn.style.overflow = "hidden";
        openBtn.style.textOverflow = "ellipsis";

        if (item.id === activeChatId) {
            openBtn.style.border = "1px solid #00D878";
        }

        openBtn.addEventListener("click", () => {
            activeChatId = item.id;
            renderChat();
            renderHistory();
            renderPdfInfo();
            uploadStatus.textContent = "";
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "×";
        deleteBtn.style.padding = "8px 12px";

        deleteBtn.addEventListener("click", async () => {

            await clearPdfFromServer(item.id);
            pdfNamesByChat.delete(item.id);

            chats = chats.filter(c => c.id !== item.id);

            if (activeChatId === item.id) {
                activeChatId = chats.length > 0
                    ? chats[0].id
                    : null;
            }

            saveChats();
            renderChat();
            renderHistory();
            renderPdfInfo();
        });

        row.appendChild(openBtn);
        row.appendChild(deleteBtn);
        historyList.appendChild(row);
    });
}

// Upload PDF
async function uploadPDF() {
    const file = pdfInput.files[0];

    if (!file) return;

    if (!activeChatId) {
        newChat();
    }

    const current = getActiveChat();

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        uploadStatus.textContent = "Please select a PDF file.";
        pdfInput.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        uploadStatus.textContent = "Maximum PDF size is 10 MB.";
        pdfInput.value = "";
        return;
    }

    uploadPdfBtn.disabled = true;
    uploadStatus.textContent = "Uploading and reading PDF...";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chat_id", current.id);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "PDF upload failed.");
        }

        pdfNamesByChat.set(current.id, file.name);

        renderPdfInfo();

        uploadStatus.textContent =
            "PDF uploaded successfully! You can now ask questions.";

    } catch (error) {
        console.error("PDF Upload Error:", error);
        uploadStatus.textContent = error.message;

    } finally {
        uploadPdfBtn.disabled = false;
        pdfInput.value = "";
    }
}

// Remove PDF
async function removePDF() {
    const current = getActiveChat();

    if (!current) return;

    removePdfBtn.disabled = true;
    uploadStatus.textContent = "Removing PDF...";

    await clearPdfFromServer(current.id);

    pdfNamesByChat.delete(current.id);

    renderPdfInfo();

    uploadStatus.textContent = "PDF removed from this chat.";

    removePdfBtn.disabled = false;
}

// Send message
async function sendMessage() {
    const message = userInput.value.trim();

    if (!message || sendBtn.disabled) return;

    if (!activeChatId) {
        newChat();
    }

    const current = getActiveChat();
    const chatId = current.id;

    current.messages.push({
        role: "user",
        content: message
    });

    if (current.title === "New Chat") {
        current.title = message.slice(0, 25);
    }

    userInput.value = "";
    sendBtn.disabled = true;

    saveChats();
    renderChat();
    renderHistory();

    const loading = document.createElement("div");
    loading.className = "ai-message thinking";

    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = "IMNAAZ AI";

    const loadingText = document.createElement("p");
    loadingText.textContent = "Thinking...";

    loading.appendChild(label);
    loading.appendChild(loadingText);
    chat.appendChild(loading);

    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: current.messages,
                chat_id: chatId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.reply || "Something went wrong.");
        }

        current.messages.push({
            role: "assistant",
            content: data.reply
        });

        saveChats();

    } catch (error) {
        current.messages.pop();
        console.error(error);
        alert(error.message || "AI connection failed. Please try again.");

    } finally {
        sendBtn.disabled = false;
        renderChat();
        renderHistory();
        renderPdfInfo();
    }
}

// Clear current chat
async function clearChat() {
    const current = getActiveChat();

    if (!current) return;

    await clearPdfFromServer(current.id);
    pdfNamesByChat.delete(current.id);

    current.messages = [];
    current.title = "New Chat";

    saveChats();
    renderChat();
    renderHistory();
    renderPdfInfo();

    uploadStatus.textContent = "Chat cleared.";
}

// Button events
sendBtn.addEventListener("click", sendMessage);
clearBtn.addEventListener("click", clearChat);
newChatBtn.addEventListener("click", newChat);

uploadPdfBtn.addEventListener("click", () => {
    pdfInput.click();
});

pdfInput.addEventListener("change", uploadPDF);
removePdfBtn.addEventListener("click", removePDF);

userInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// Load saved chats
if (chats.length > 0) {
    activeChatId = chats[0].id;
}

renderChat();
renderHistory();
renderPdfInfo();
