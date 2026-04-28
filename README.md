# sub-check-collector

订阅链接收集与代理节点检测一体化工具。

## 项目结构

```
sub-check-collector/
├── v1/          # V1.0 - Node.js 订阅链接收集器
│   ├── src/     # TypeScript 源码
│   └── ...
├── v2/          # V2.0 - Go 统一应用 (收集器 + 节点检测)
│   ├── app/     # 应用核心逻辑
│   ├── check/   # 节点检测引擎
│   ├── proxy/   # 代理获取
│   ├── config/  # 配置管理
│   └── ...
└── install.sh   # V1.0 统一安装脚本
```

## 版本说明

### V1.0 (Node.js)
独立运行的订阅链接收集器，从 GitHub 搜索订阅链接并清洗后输出给 subs-check。

详细文档见 [v1/README.md](v1/README.md)。

### V2.0 (Go)
将收集器功能用 Go 重写并内嵌到 subs-check 中，形成单一二进制文件，包含：
- GitHub 订阅链接搜索与清洗
- 代理节点检测（基于 mihomo 内核）
- Web 管理界面
- 定时任务调度

详细文档见 [v2/README.md](v2/README.md)。
