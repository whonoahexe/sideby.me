#!/bin/bash

echo "🎬 Setting up Watch.With - Watch Party hell yeah!"
echo "================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo "✅ npm found: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating environment file..."
    cp .env.example .env.local
    echo "✅ Created .env.local from .env.example"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "📋 Requirements checklist:"
echo "   ✅ Node.js 18+"
echo "   ✅ Dependencies installed"
echo "   ✅ Environment file created"
echo "   ⚠️  Redis server (optional for development)"
echo ""
echo "💡 For Redis setup (optional):"
echo "   - macOS: brew install redis && brew services start redis"
echo "   - Ubuntu: sudo apt-get install redis-server"
echo "   - Docker: docker run -d -p 6379:6379 redis:alpine"
echo ""
echo "🌐 The app will be available at http://localhost:3000"
