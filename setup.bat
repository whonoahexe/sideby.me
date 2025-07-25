@echo off
echo 🎬 Setting up Watch.With - Watch Party hell yeah!
echo ================================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js found: %NODE_VERSION%
echo ✅ npm found: %NPM_VERSION%

REM Install dependencies
echo.
echo 📦 Installing dependencies...
npm install

REM Copy environment file
if not exist .env.local (
    echo.
    echo 📝 Creating environment file...
    copy .env.example .env.local >nul
    echo ✅ Created .env.local from .env.example
) else (
    echo ✅ .env.local already exists
)

echo.
echo 🎉 Setup complete!
echo.
echo 🚀 To start the development server:
echo    npm run dev
echo.
echo 📋 Requirements checklist:
echo    ✅ Node.js 18+
echo    ✅ Dependencies installed
echo    ✅ Environment file created
echo    ⚠️  Redis server (optional for development)
echo.
echo 💡 For Redis setup (optional):
echo    - Windows: Use WSL and run: sudo apt-get install redis-server
echo    - Docker: docker run -d -p 6379:6379 redis:alpine
echo.
echo 🌐 The app will be available at http://localhost:3000
pause
