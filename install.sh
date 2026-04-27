#!/bin/bash
###############################################################################
# sub-check 一键安装脚本
# 整合 sub-check-collector (订阅收集) + subs-check (节点检测)
# 用法: sudo bash install.sh
#   或: sudo bash install.sh --github-proxy https://ghfast.top/
###############################################################################

set -e

# ======================== 配置 ========================
INSTALL_BASE="/opt/sub-check"
COLLECTOR_DIR="${INSTALL_BASE}/collector"
CHECKER_DIR="${INSTALL_BASE}/checker"
CONFIG_DIR="${INSTALL_BASE}/config"
SHARED_CONFIG="${CONFIG_DIR}/config.yaml"
LOG_DIR="${INSTALL_BASE}/logs"
OUTPUT_DIR="${INSTALL_BASE}/output"

COLLECTOR_REPO="scaleflower/sub-check-collector"
CHECKER_REPO="beck-8/subs-check"

COLLECTOR_SERVICE="sub-check-collector"
CHECKER_SERVICE="subs-check"

GITHUB_PROXY="${1:-}"
GITHUB_TOKEN=""

# ======================== 运行状态 ========================
HAS_SYSTEMD=1
IS_UPGRADE=0
DOWNLOADER=""

# ======================== 颜色输出 ========================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${BLUE}[INFO]${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; exit 1; }
step()  { printf "\n${CYAN}==> %s${NC}\n" "$1"; }

separator() {
    printf "${GREEN}%s${NC}\n" "$(printf '=%.0s' {1..55})"
}

# ======================== 前置检查 ========================
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        error "请使用 root 用户或 sudo 运行此脚本"
    fi
}

check_os() {
    local os_name="$(uname -s)"
    if [ "$os_name" != "Linux" ]; then
        error "此脚本仅支持 Linux 系统, 当前系统: $os_name"
    fi
}

check_systemd() {
    if ! command -v systemctl >/dev/null 2>&1; then
        HAS_SYSTEMD=0
        warn "未检测到 systemd, 将跳过服务配置, 安装完成后需手动运行"
    fi
}

check_existing() {
    if [ -d "$INSTALL_BASE" ]; then
        IS_UPGRADE=1
        info "检测到已有安装目录: $INSTALL_BASE"
    fi
}

check_download_tool() {
    if command -v git >/dev/null 2>&1; then
        HAS_GIT=1
    else
        HAS_GIT=0
    fi

    if command -v curl >/dev/null 2>&1; then
        DOWNLOADER="curl"
    elif command -v wget >/dev/null 2>&1; then
        DOWNLOADER="wget"
    else
        error "需要 curl 或 wget, 请先安装其中之一"
    fi
}

# ======================== 下载封装 ========================
fetch_url() {
    local url="$1"
    if [ "$DOWNLOADER" = "curl" ]; then
        curl -fsSL "$url"
    else
        wget -qO- "$url"
    fi
}

download_file() {
    local url="$1"
    local output="$2"
    if [ "$DOWNLOADER" = "curl" ]; then
        curl -fsSL -o "$output" "$url"
    else
        wget -qO "$output" "$url"
    fi
}

proxy_url() {
    local url="$1"
    if [ -n "$GITHUB_PROXY" ]; then
        echo "${GITHUB_PROXY}${url}"
    else
        echo "$url"
    fi
}

# ======================== 架构检测 ========================
detect_arch() {
    local arch="$(uname -m)"
    case "$arch" in
        x86_64|amd64)  ARCH="x86_64" ;;
        aarch64|arm64) ARCH="aarch64" ;;
        armv7*|armhf)  ARCH="armv7" ;;
        i386|i686)     ARCH="i386" ;;
        *)             error "不支持的架构: $arch" ;;
    esac
    ok "系统架构: $ARCH"
}

# ======================== 安装 Node.js ========================
install_nodejs() {
    if command -v node >/dev/null 2>&1; then
        ok "Node.js 已安装: $(node --version)"
        return 0
    fi

    info "正在安装 Node.js..."

    # 尝试通过包管理器安装
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y -qq nodejs npm >/dev/null 2>&1
    elif command -v yum >/dev/null 2>&1; then
        yum install -y -q nodejs npm >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y -q nodejs npm >/dev/null 2>&1
    else
        # 使用 NodeSource 安装脚本
        info "尝试使用 NodeSource 安装..."
        fetch_url https://deb.nodesource.com/setup_lts.x | bash - >/dev/null 2>&1 || true
        if command -v apt-get >/dev/null 2>&1; then
            apt-get install -y -qq nodejs >/dev/null 2>&1
        fi
    fi

    if command -v node >/dev/null 2>&1; then
        ok "Node.js 安装完成: $(node --version)"
    else
        error "Node.js 安装失败, 请手动安装 Node.js (>= 18) 后重试"
    fi
}

# ======================== 安装 Collector ========================
install_collector() {
    step "安装订阅收集器 (sub-check-collector)"

    if [ -d "$COLLECTOR_DIR" ] && [ "$IS_UPGRADE" -eq 1 ]; then
        info "更新 collector..."
        cd "$COLLECTOR_DIR"
        git pull -q 2>/dev/null || warn "git pull 失败, 使用现有代码"
    else
        info "克隆 collector 仓库..."
        local repo_url="https://github.com/${COLLECTOR_REPO}.git"
        git clone -q "$(proxy_url "$repo_url")" "$COLLECTOR_DIR" 2>/dev/null || \
            git clone -q "$repo_url" "$COLLECTOR_DIR" || \
            error "克隆 collector 仓库失败"
    fi

    cd "$COLLECTOR_DIR"

    # 安装依赖
    info "安装 Node.js 依赖..."
    npm install --production=false --silent 2>/dev/null || npm install || error "依赖安装失败"

    # 编译 TypeScript
    info "编译项目..."
    npm run build || error "编译失败"

    # 创建 .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
        else
            cat > .env <<'EOF'
# GitHub Personal Access Token
GITHUB_TOKEN=

# 搜索关键字
SEARCH_KEYWORDS=free,v2ray

# Cron 表达式
SCHEDULE_INTERVAL=0 2 * * *

# 输出文件
OUTPUT_FILE=./output/subscriptions.md

# 共享 config.yaml 路径
CONFIG_YAML_PATH=/opt/sub-check/config/config.yaml

# 搜索配置
MAX_REPOSITORIES=100
MIN_STARS=0
MAX_DAYS_SINCE_UPDATE=90

# 链接验证
VALIDATE_LINKS=true
LINK_VALIDATION_TIMEOUT=10000
LINK_VALIDATION_CONCURRENCY=10

# 日志
LOG_DIR=/opt/sub-check/logs/collector
ENABLE_FILE_LOG=true
EOF
        fi
    fi

    # 确保 CONFIG_YAML_PATH 指向共享配置
    if grep -q "^CONFIG_YAML_PATH=" .env; then
        sed -i "s|^CONFIG_YAML_PATH=.*|CONFIG_YAML_PATH=${SHARED_CONFIG}|" .env
    else
        echo "CONFIG_YAML_PATH=${SHARED_CONFIG}" >> .env
    fi

    ok "collector 安装完成"
}

# ======================== 安装 Checker ========================
install_checker() {
    step "安装节点检测器 (subs-check)"

    mkdir -p "$CHECKER_DIR"

    local api_url="https://api.github.com/repos/${CHECKER_REPO}/releases/latest"
    local latest_version

    info "获取 subs-check 最新版本..."
    latest_version=$(fetch_url "$api_url" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')

    if [ -z "$latest_version" ]; then
        error "无法获取 subs-check 版本号"
    fi
    ok "最新版本: $latest_version"

    local file_name="subs-check_Linux_${ARCH}.tar.gz"
    local download_url="https://github.com/${CHECKER_REPO}/releases/download/${latest_version}/${file_name}"

    local tmp_dir=$(mktemp -d)
    trap 'rm -rf "$tmp_dir"' EXIT

    info "下载 ${file_name}..."
    download_file "$(proxy_url "$download_url")" "${tmp_dir}/${file_name}" || \
        download_file "$download_url" "${tmp_dir}/${file_name}" || \
        error "下载失败"

    tar -xzf "${tmp_dir}/${file_name}" -C "$tmp_dir"
    cp "${tmp_dir}/subs-check" "${CHECKER_DIR}/subs-check"
    chmod +x "${CHECKER_DIR}/subs-check"

    ok "subs-check 安装完成: ${CHECKER_DIR}/subs-check"
}

# ======================== 创建共享配置 ========================
setup_shared_config() {
    step "配置共享 config.yaml"

    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR/collector"
    mkdir -p "$OUTPUT_DIR"

    if [ -f "$SHARED_CONFIG" ]; then
        info "共享配置已存在, 保留现有配置"
        # 备份
        cp "$SHARED_CONFIG" "${SHARED_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"
        ok "已备份现有配置"
        return 0
    fi

    # 如果 collector 目录有 config.yaml, 复制过来作为基础
    if [ -f "${COLLECTOR_DIR}/config.yaml" ]; then
        cp "${COLLECTOR_DIR}/config.yaml" "$SHARED_CONFIG"
        ok "从 collector 复制现有 config.yaml"
    else
        # 生成默认配置
        cat > "$SHARED_CONFIG" <<'YAMLEOF'
# sub-check 共享配置文件
# 由 sub-check-collector 自动更新 sub-urls 部分
# subs-check 读取此文件进行节点检测

print-progress: true
concurrent: 50
media-concurrent: 20
speed-concurrent: 20
check-interval: 120
success-limit: 0
timeout: 5000
alive-test-url: http://gstatic.com/generate_204
speed-test-url: https://github.com/AaronFeng753/Waifu2x-Extension-GUI/releases/download/v2.21.12/Waifu2x-Extension-GUI-v2.21.12-Portable.7z
min-speed: 512
download-timeout: 10
download-mb: 20
total-speed-limit: 0

listen-port: ":8199"
rename-node: true
node-prefix: ""

media-check: false
media-check-timeout: 5
platforms:
  - iprisk
  - tiktok
  - youtube
  - netflix
  - disney
  - openai
  - gemini
  - claude
  - spotify

keep-days: 0
output-dir: "/opt/sub-check/output"
enable-web-ui: true
api-key: ""

save-method: local

sub-urls-retry: 3
sub-urls-concurrent: 20
sub-urls-get-ua: "clash.meta (https://github.com/beck-8/subs-check)"
github-proxy: ""
proxy: ""
success-rate: 0

dns:
  enable: false
  ipv6: false
  nameserver:
    - https://dns.alidns.com/dns-query
  proxy-server-nameserver:
    - https://dns.alidns.com/dns-query
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29

sub-urls:
  - https://misub.907737.xyz/allnodes
YAMLEOF
        ok "已生成默认配置"
    fi
}

# ======================== 配置交互 ========================
configure_github_token() {
    step "配置 GitHub Token"

    printf "${YELLOW}请输入 GitHub Personal Access Token (用于搜索订阅, 回车跳过): ${NC}"
    read -r token < /dev/tty

    if [ -n "$token" ]; then
        GITHUB_TOKEN="$token"
        cd "$COLLECTOR_DIR"
        if grep -q "^GITHUB_TOKEN=" .env; then
            sed -i "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=${token}|" .env
        else
            echo "GITHUB_TOKEN=${token}" >> .env
        fi
        ok "GitHub Token 已配置"
    else
        warn "未配置 GitHub Token, API 调用可能受限"
    fi
}

configure_schedule() {
    step "配置定时任务"

    printf "${YELLOW}collector 定时搜索间隔 (cron, 默认 0 2 * * *, 每天凌晨2点): ${NC}"
    read -r collector_cron < /dev/tty
    collector_cron="${collector_cron:-0 2 * * *}"

    cd "$COLLECTOR_DIR"
    if grep -q "^SCHEDULE_INTERVAL=" .env; then
        sed -i "s|^SCHEDULE_INTERVAL=.*|SCHEDULE_INTERVAL=${collector_cron}|" .env
    else
        echo "SCHEDULE_INTERVAL=${collector_cron}" >> .env
    fi
    ok "collector 定时: ${collector_cron}"

    printf "${YELLOW}subs-check 检测间隔 (分钟, 默认 120): ${NC}"
    read -r check_interval < /dev/tty
    check_interval="${check_interval:-120}"

    if command -v python3 >/dev/null 2>&1; then
        sed -i "s|^check-interval:.*|check-interval: ${check_interval}|" "$SHARED_CONFIG"
    else
        sed -i "s|^check-interval:.*|check-interval: ${check_interval}|" "$SHARED_CONFIG"
    fi
    ok "checker 间隔: ${check_interval} 分钟"
}

# ======================== Systemd 服务 ========================
setup_collector_service() {
    if [ "$HAS_SYSTEMD" -eq 0 ]; then
        return 0
    fi

    info "配置 collector systemd 服务..."

    cat > "/etc/systemd/system/${COLLECTOR_SERVICE}.service" <<EOF
[Unit]
Description=Sub-Check Collector - 订阅链接收集器
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${COLLECTOR_DIR}
ExecStart=$(command -v node) dist/index.js
Restart=always
RestartSec=30
LimitNOFILE=65535
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    ok "collector 服务配置完成"
}

setup_checker_service() {
    if [ "$HAS_SYSTEMD" -eq 0 ]; then
        return 0
    fi

    info "配置 checker systemd 服务..."

    cat > "/etc/systemd/system/${CHECKER_SERVICE}.service" <<EOF
[Unit]
Description=Subs-Check - 代理节点检测器
After=network-online.target
Wants=network-online.target
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
WorkingDirectory=${CHECKER_DIR}
ExecStart=${CHECKER_DIR}/subs-check -f ${SHARED_CONFIG}
Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
    ok "checker 服务配置完成"
}

enable_and_start_services() {
    if [ "$HAS_SYSTEMD" -eq 0 ]; then
        return 0
    fi

    systemctl daemon-reload

    # Collector
    printf "${YELLOW}是否设置 collector 开机自启动？[Y/n]: ${NC}"
    read -r answer < /dev/tty
    case "$answer" in
        [nN]|[nN][oO]) info "跳过 collector 开机自启动" ;;
        *) systemctl enable "$COLLECTOR_SERVICE"; ok "collector 已设置开机自启动" ;;
    esac

    printf "${YELLOW}是否立即启动 collector？[Y/n]: ${NC}"
    read -r answer < /dev/tty
    case "$answer" in
        [nN]|[nN][oO]) info "跳过启动 collector" ;;
        *)
            systemctl start "$COLLECTOR_SERVICE"
            ok "collector 已启动"
            ;;
    esac

    # Checker
    printf "${YELLOW}是否设置 subs-check 开机自启动？[Y/n]: ${NC}"
    read -r answer < /dev/tty
    case "$answer" in
        [nN]|[nN][oO]) info "跳过 subs-check 开机自启动" ;;
        *) systemctl enable "$CHECKER_SERVICE"; ok "subs-check 已设置开机自启动" ;;
    esac

    printf "${YELLOW}是否立即启动 subs-check？[Y/n]: ${NC}"
    read -r answer < /dev/tty
    case "$answer" in
        [nN]|[nN][oO]) info "跳过启动 subs-check" ;;
        *)
            systemctl start "$CHECKER_SERVICE"
            ok "subs-check 已启动"
            ;;
    esac
}

# ======================== 首次运行 collector ========================
run_collector_once() {
    step "首次运行 collector (收集订阅链接)"

    printf "${YELLOW}是否立即运行一次 collector 以收集订阅链接？[Y/n]: ${NC}"
    read -r answer < /dev/tty
    case "$answer" in
        [nN]|[nN][oO]) return 0 ;;
    esac

    cd "$COLLECTOR_DIR"
    node dist/index.js once 2>&1 || warn "首次运行出现错误, 可稍后手动运行"
}

# ======================== 输出信息 ========================
print_summary() {
    printf "\n"
    separator
    printf "${GREEN}  sub-check 安装完成！${NC}\n"
    separator
    printf "\n"

    printf "  ${CYAN}安装目录:${NC}\n"
    printf "    基础目录:    %s\n" "$INSTALL_BASE"
    printf "    收集器:      %s\n" "$COLLECTOR_DIR"
    printf "    检测器:      %s\n" "$CHECKER_DIR"
    printf "    共享配置:    %s\n" "$SHARED_CONFIG"
    printf "    输出目录:    %s\n" "$OUTPUT_DIR"
    printf "    日志目录:    %s\n" "$LOG_DIR"
    printf "\n"

    printf "  ${CYAN}工作流程:${NC}\n"
    printf "    1. collector 定时从 GitHub 搜索订阅链接\n"
    printf "    2. collector 将链接写入共享 config.yaml 的 sub-urls\n"
    printf "    3. subs-check 定时读取 config.yaml 进行节点检测\n"
    printf "\n"

    if [ "$HAS_SYSTEMD" -eq 1 ]; then
        printf "  ${CYAN}服务管理:${NC}\n"
        printf "    collector:\n"
        printf "      启动:  systemctl start %s\n" "$COLLECTOR_SERVICE"
        printf "      停止:  systemctl stop %s\n" "$COLLECTOR_SERVICE"
        printf "      状态:  systemctl status %s\n" "$COLLECTOR_SERVICE"
        printf "      日志:  journalctl -u %s -f\n" "$COLLECTOR_SERVICE"
        printf "\n"
        printf "    subs-check:\n"
        printf "      启动:  systemctl start %s\n" "$CHECKER_SERVICE"
        printf "      停止:  systemctl stop %s\n" "$CHECKER_SERVICE"
        printf "      状态:  systemctl status %s\n" "$CHECKER_SERVICE"
        printf "      日志:  journalctl -u %s -f\n" "$CHECKER_SERVICE"
        printf "\n"
        printf "  ${CYAN}Web 管理界面:${NC}\n"
        printf "    http://127.0.0.1:8199/admin\n"
        printf "\n"
        printf "  ${CYAN}卸载方法:${NC}\n"
        printf "    systemctl stop %s %s\n" "$COLLECTOR_SERVICE" "$CHECKER_SERVICE"
        printf "    systemctl disable %s %s\n" "$COLLECTOR_SERVICE" "$CHECKER_SERVICE"
        printf "    rm -f /etc/systemd/system/%s.service\n" "$COLLECTOR_SERVICE"
        printf "    rm -f /etc/systemd/system/%s.service\n" "$CHECKER_SERVICE"
        printf "    rm -rf %s\n" "$INSTALL_BASE"
        printf "    systemctl daemon-reload\n"
    else
        printf "  ${YELLOW}手动运行:${NC}\n"
        printf "    collector:\n"
        printf "      cd %s && node dist/index.js\n" "$COLLECTOR_DIR"
        printf "    subs-check:\n"
        printf "      cd %s && ./subs-check -f %s\n" "$CHECKER_DIR" "$SHARED_CONFIG"
        printf "\n"
        printf "  后台运行:\n"
        printf "    cd %s && nohup node dist/index.js > collector.log 2>&1 &\n" "$COLLECTOR_DIR"
        printf "    cd %s && nohup ./subs-check -f %s > checker.log 2>&1 &\n" "$CHECKER_DIR" "$SHARED_CONFIG"
        printf "\n"
        printf "  卸载:\n"
        printf "    rm -rf %s\n" "$INSTALL_BASE"
    fi

    printf "\n"
    printf "${YELLOW}  修改配置后:${NC}\n"
    if [ "$HAS_SYSTEMD" -eq 1 ]; then
        printf "    collector: 修改 %s/.env 后执行 systemctl restart %s\n" "$COLLECTOR_DIR" "$COLLECTOR_SERVICE"
        printf "    checker:   修改 %s 后执行 systemctl restart %s\n" "$SHARED_CONFIG" "$CHECKER_SERVICE"
    else
        printf "    重启对应进程即可生效\n"
    fi
    printf "\n"
}

# ======================== 主流程 ========================
main() {
    printf "\n"
    separator
    printf "${GREEN}  sub-check 一键安装脚本${NC}\n"
    printf "${GREEN}  订阅收集 + 节点检测 一体化部署${NC}\n"
    separator
    printf "\n"

    # 解析参数
    while [ $# -gt 0 ]; do
        case "$1" in
            --github-proxy=*|--proxy=*)
                GITHUB_PROXY="${1#*=}"
                ;;
            --github-proxy|--proxy)
                GITHUB_PROXY="$2"
                shift
                ;;
            --help|-h)
                echo "用法: sudo bash install.sh [选项]"
                echo ""
                echo "选项:"
                echo "  --github-proxy URL   设置 GitHub 代理 (如 https://ghfast.top/)"
                echo "  --help               显示帮助信息"
                exit 0
                ;;
            *)
                # 兼容旧用法: bash install.sh https://ghfast.top/
                if [[ "$1" == http* ]]; then
                    GITHUB_PROXY="$1"
                else
                    warn "未知参数: $1"
                fi
                ;;
        esac
        shift
    done

    if [ -n "$GITHUB_PROXY" ]; then
        info "使用 GitHub 代理: $GITHUB_PROXY"
    fi

    # 前置检查
    step "环境检查"
    check_root
    check_os
    check_systemd
    check_existing
    check_download_tool
    detect_arch

    # 安装 Node.js
    step "检查 Node.js"
    install_nodejs

    # 创建目录结构
    mkdir -p "$INSTALL_BASE"
    mkdir -p "$LOG_DIR/collector"
    mkdir -p "$OUTPUT_DIR"

    # 安装 collector
    install_collector

    # 安装 checker
    install_checker

    # 创建共享配置
    setup_shared_config

    # 交互式配置
    configure_github_token
    configure_schedule

    # 配置 systemd 服务
    if [ "$HAS_SYSTEMD" -eq 1 ]; then
        step "配置系统服务"
        setup_collector_service
        setup_checker_service
        enable_and_start_services
    fi

    # 首次运行
    run_collector_once

    # 输出总结
    print_summary
}

main "$@"
