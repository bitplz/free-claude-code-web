#!/bin/bash

echo "====================================="
echo "Free Claude Code - macOS/Linux Setup"
echo "====================================="

# Install uv
echo "Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Load uv into PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Update uv
echo "Updating uv..."
uv self update

# Install Python 3.14
echo "Installing Python 3.14..."
uv python install 3.14

# Clone repo
echo "Cloning repository..."
git clone https://github.com/Alishahryar1/free-claude-code.git
cd free-claude-code

# Create .env
echo "Creating .env file..."
cp .env.example .env

echo "====================================="
echo "Setup Complete!"
echo "====================================="
echo ""
echo "👉 NEXT STEP (IMPORTANT):"
echo "1. Open .env file"
echo "2. Add your API key"
echo ""

read -p "Press Enter to start server..."

# Start server
echo "Starting proxy server..."
uv run uvicorn server:app --host 0.0.0.0 --port 8082