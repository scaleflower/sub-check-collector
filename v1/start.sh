#!/bin/bash

###############################################################################
# V2Ray/Clash 订阅链接收集器 - 启动脚本
###############################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印标题
print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}   V2Ray/Clash 订阅链接自动收集器${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# 打印信息
info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

# 打印成功
success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

# 打印警告
warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

# 打印错误
error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查 Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        error "未找到 Node.js,请先安装 Node.js"
        exit 1
    fi
    info "Node.js 版本: $(node --version)"
}

# 检查依赖
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        warning "未找到依赖,正在安装..."
        npm install
        if [ $? -ne 0 ]; then
            error "依赖安装失败"
            exit 1
        fi
        success "依赖安装完成"
    else
        info "依赖已安装"
    fi
}

# 检查 .env 文件
check_env() {
    if [ ! -f ".env" ]; then
        warning "未找到 .env 文件"
        if [ -f ".env.example" ]; then
            info "正在从 .env.example 创建 .env 文件..."
            cp .env.example .env
            success ".env 文件已创建,请编辑配置后重新运行"
            echo ""
            warning "请编辑 .env 文件配置参数,特别是 GITHUB_TOKEN"
            exit 0
        else
            error "未找到 .env.example 文件"
            exit 1
        fi
    else
        info "配置文件: .env"
    fi
}

# 构建项目
build_project() {
    info "正在构建项目..."
    npm run build
    if [ $? -ne 0 ]; then
        error "构建失败"
        exit 1
    fi
    success "构建完成"
}

# 创建必要的目录
create_directories() {
    mkdir -p output
    mkdir -p logs
    info "输出目录: ./output"
    info "日志目录: ./logs"
}

# 显示使用帮助
show_help() {
    echo "使用方法:"
    echo "  ./start.sh                - 启动定时任务"
    echo "  ./start.sh once           - 立即执行一次"
    echo "  ./start.sh schedule       - 启动定时任务"
    echo "  ./start.sh now            - 启动定时任务并立即执行一次"
    echo "  ./start.sh help           - 显示帮助信息"
    echo ""
}

# 主函数
main() {
    print_header

    # 解析参数
    MODE="${1:-schedule}"

    case "$MODE" in
        help|--help|-h)
            show_help
            exit 0
            ;;
        once|run)
            info "模式: 立即执行一次"
            ;;
        schedule)
            info "模式: 定时任务"
            ;;
        now)
            info "模式: 定时任务 + 立即执行"
            ;;
        *)
            error "未知参数: $MODE"
            show_help
            exit 1
            ;;
    esac

    echo ""

    # 检查环境
    check_node
    check_dependencies
    check_env
    echo ""

    # 构建项目
    build_project
    echo ""

    # 创建目录
    create_directories
    echo ""

    # 启动应用
    success "正在启动应用..."
    echo ""

    case "$MODE" in
        once|run)
            npm run once
            ;;
        schedule)
            npm start
            ;;
        now)
            npm start -- --run-now
            ;;
    esac
}

# 运行主函数
main "$@"
