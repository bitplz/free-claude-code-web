# 🚀 Free Claude Web — Local Chat Interface

A clean, Claude-like web UI that connects to your locally running **Free Claude Code proxy**.

Run powerful AI models (NVIDIA NIM, OpenRouter, DeepSeek, Ollama, etc.) directly from your browser — no paid Claude subscription required.

---

## 🔗 Credits & Base Project

This project is built on top of:

- https://github.com/Alishahryar1/free-claude-code  
- Video tutorial: https://www.youtube.com/watch?v=VwW-VcWdPSA  

Full credit goes to the original author for building the proxy system.

---

## ⚡ One-Click Setup (Recommended)

### 🪟 Windows
Double-click:
setup-free-claude-code-windows.bat

### 🍎 macOS / 🐧 Linux
Run:
chmod +x setup-free-claude-code-macOs.sh  
./setup-free-claude-code-macOs.sh  

---

## ⚠️ Required Manual Step

Edit `.env` file inside proxy:

NVIDIA_NIM_API_KEY="your-key"  
MODEL="nvidia_nim/z-ai/glm4.7"  
ANTHROPIC_AUTH_TOKEN="freecc"  

---

## 🧠 Start Web UI

Run: start.bat (for windows) / start.sh (for macOS)


---

## 🔌 How It Works

Web UI → Proxy (8082) → AI Provider

---

## 🛠 Troubleshooting

Proxy not running:
uv run uvicorn server:app --host 0.0.0.0 --port 8082  

---

## 🙌 Credits

https://github.com/Alishahryar1/free-claude-code  
https://www.youtube.com/watch?v=VwW-VcWdPSA

---

#### ⚠️ There may be few bugs and errors — feel free to open an issue or start a discussion.
