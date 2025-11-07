@echo off
REM V2Ray/Clash 订阅链接收集器 - Windows 启动脚本
chcp 65001 >nul

echo ═══════════════════════════════════════════════════
echo    V2Ray/Clash 订阅链接自动收集器
echo ═══════════════════════════════════════════════════
echo.

REM 解析参数
set MODE=%1
if "%MODE%"=="" set MODE=schedule

if "%MODE%"=="help" goto :show_help
if "%MODE%"=="--help" goto :show_help
if "%MODE%"=="-h" goto :show_help

echo [信息] 模式: %MODE%
echo.

REM 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Node.js,请先安装 Node.js
    exit /b 1
)
echo [信息] Node.js 版本:
node --version

REM 检查依赖
if not exist "node_modules" (
    echo [警告] 未找到依赖,正在安装...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] 依赖安装失败
        exit /b 1
    )
    echo [成功] 依赖安装完成
) else (
    echo [信息] 依赖已安装
)

REM 检查 .env 文件
if not exist ".env" (
    echo [警告] 未找到 .env 文件
    if exist ".env.example" (
        echo [信息] 正在从 .env.example 创建 .env 文件...
        copy .env.example .env >nul
        echo [成功] .env 文件已创建,请编辑配置后重新运行
        echo.
        echo [警告] 请编辑 .env 文件配置参数,特别是 GITHUB_TOKEN
        pause
        exit /b 0
    ) else (
        echo [错误] 未找到 .env.example 文件
        exit /b 1
    )
) else (
    echo [信息] 配置文件: .env
)
echo.

REM 构建项目
echo [信息] 正在构建项目...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 构建失败
    exit /b 1
)
echo [成功] 构建完成
echo.

REM 创建必要的目录
if not exist "output" mkdir output
if not exist "logs" mkdir logs
echo [信息] 输出目录: ./output
echo [信息] 日志目录: ./logs
echo.

REM 启动应用
echo [成功] 正在启动应用...
echo.

if "%MODE%"=="once" goto :run_once
if "%MODE%"=="run" goto :run_once
if "%MODE%"=="schedule" goto :run_schedule
if "%MODE%"=="now" goto :run_now

echo [错误] 未知参数: %MODE%
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
echo 使用方法:
echo   start.bat              - 启动定时任务
echo   start.bat once         - 立即执行一次
echo   start.bat schedule     - 启动定时任务
echo   start.bat now          - 启动定时任务并立即执行一次
echo   start.bat help         - 显示帮助信息
echo.
exit /b 0

:end
pause
