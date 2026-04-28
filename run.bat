@echo off
REM Launcher script for sub-check-collector
REM This file must be saved as ANSI/GBK encoding

chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ================================================
echo    Sub-Check-Collector Launcher
echo ================================================
echo.

set MODE=%1
if "%MODE%"=="" set MODE=schedule

if "%MODE%"=="help" goto :show_help
if "%MODE%"=="--help" goto :show_help
if "%MODE%"=="-h" goto :show_help

echo [INFO] Mode: %MODE%
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)
echo [INFO] Node.js version:
node --version

REM Check dependencies
if not exist "node_modules" (
    echo [WARN] Dependencies not found, installing...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [INFO] Dependencies already installed
)

REM Check .env file
if not exist ".env" (
    echo [WARN] .env file not found
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env >nul
        echo [OK] .env file created. Please edit it and run again.
        echo.
        echo [WARN] Please edit .env file, especially GITHUB_TOKEN
        pause
        exit /b 0
    ) else (
        echo [ERROR] .env.example file not found
        pause
        exit /b 1
    )
) else (
    echo [INFO] Config file: .env
)
echo.

REM Build project
echo [INFO] Building project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build completed
echo.

REM Create directories
if not exist "output" mkdir output
if not exist "logs" mkdir logs
echo [INFO] Output dir: ./output
echo [INFO] Log dir: ./logs
echo.

REM Start application
echo [OK] Starting application...
echo.

if "%MODE%"=="once" goto :run_once
if "%MODE%"=="run" goto :run_once
if "%MODE%"=="schedule" goto :run_schedule
if "%MODE%"=="now" goto :run_now

echo [ERROR] Unknown parameter: %MODE%
goto :show_help

:run_once
call npm run once
goto :end

:run_schedule
call npm start
goto :end

:run_now
call npm start -- --run-now
goto :end

:show_help
echo Usage:
echo   run.bat              - Start scheduled task
echo   run.bat once         - Run once immediately
echo   run.bat schedule     - Start scheduled task
echo   run.bat now          - Start scheduled task and run once
echo   run.bat help         - Show this help
echo.
exit /b 0

:end
pause
