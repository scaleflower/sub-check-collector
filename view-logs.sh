#!/bin/bash

###############################################################################
# 日志查看脚本
###############################################################################

# 颜色定义
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

LOG_DIR="./logs"

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   日志查看工具${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# 检查日志目录
if [ ! -d "$LOG_DIR" ]; then
    echo -e "${YELLOW}[警告]${NC} 日志目录不存在: $LOG_DIR"
    exit 1
fi

# 查找所有日志文件
LOG_FILES=($(ls -t "$LOG_DIR"/*.log 2>/dev/null))

if [ ${#LOG_FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}[警告]${NC} 未找到日志文件"
    exit 0
fi

# 默认显示最新的日志文件
LATEST_LOG="${LOG_FILES[0]}"

MODE="${1:-latest}"

case "$MODE" in
    latest|--latest|-l)
        echo -e "${GREEN}[信息]${NC} 显示最新日志: $(basename $LATEST_LOG)"
        echo ""
        cat "$LATEST_LOG"
        ;;
    tail|--tail|-t)
        echo -e "${GREEN}[信息]${NC} 实时跟踪日志: $(basename $LATEST_LOG)"
        echo -e "${YELLOW}[提示]${NC} 按 Ctrl+C 退出"
        echo ""
        tail -f "$LATEST_LOG"
        ;;
    list|--list)
        echo -e "${GREEN}[信息]${NC} 可用的日志文件:"
        echo ""
        for i in "${!LOG_FILES[@]}"; do
            FILE="${LOG_FILES[$i]}"
            SIZE=$(du -h "$FILE" | cut -f1)
            echo "  [$((i+1))] $(basename $FILE) ($SIZE)"
        done
        echo ""
        echo "使用方法: $0 <文件序号>"
        ;;
    help|--help|-h)
        echo "使用方法:"
        echo "  $0                    - 显示最新日志"
        echo "  $0 latest             - 显示最新日志"
        echo "  $0 tail               - 实时跟踪最新日志"
        echo "  $0 list               - 列出所有日志文件"
        echo "  $0 <文件序号>          - 显示指定的日志文件"
        echo "  $0 help               - 显示帮助信息"
        echo ""
        ;;
    [0-9]|[0-9][0-9])
        INDEX=$((MODE - 1))
        if [ $INDEX -lt 0 ] || [ $INDEX -ge ${#LOG_FILES[@]} ]; then
            echo -e "${YELLOW}[警告]${NC} 无效的文件序号: $MODE"
            exit 1
        fi
        LOG_FILE="${LOG_FILES[$INDEX]}"
        echo -e "${GREEN}[信息]${NC} 显示日志: $(basename $LOG_FILE)"
        echo ""
        cat "$LOG_FILE"
        ;;
    *)
        echo -e "${YELLOW}[警告]${NC} 未知参数: $MODE"
        echo "使用 '$0 help' 查看帮助"
        exit 1
        ;;
esac
