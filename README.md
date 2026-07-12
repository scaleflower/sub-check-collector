# V2Ray/Clash 订阅链接自动收集器

自动从 GitHub 搜索并收集 V2Ray、Clash 等代理订阅链接的工具。

> **注意:** 本工具会自动更新 [Subs-Check](https://github.com/xream/sub-check) 的 `config.yaml` 文件。首次使用时:
> 1. 将 Subs-Check 的 `config.yaml` 文件拷贝到本工具目录下,或
> 2. 使用本工具提供的 `config.yaml.example` 复制为 `config.yaml`

## ✨ 特性

- 🔍 **智能搜索**: 根据关键字搜索 GitHub 仓库
- 📝 **自动解析**: 从 README 中提取订阅链接
- 🔄 **去重汇总**: 自动去重并分类整理链接
- ⏰ **定时执行**: 支持 cron 定时任务
- 📊 **统计分析**: 提供链接统计信息
- 💾 **增量更新**: 保留历史数据,持续更新
- 🎯 **自动更新 config.yaml**: 自动将收集到的链接更新到 config.yaml 的 sub-urls 部分
- ⭐ **智能排序**: 综合 star 数量(70%)和更新时间(30%)排序,优先选择高质量仓库
- 🎚️ **质量过滤**: 支持设置最低 star 数和最大更新天数,自动过滤低质量/过期仓库
- ✅ **链接验证**: 自动验证订阅链接有效性,过滤无法访问的链接
- 📝 **日志记录**: 记录程序运行的关键动作和结果,方便追踪和调试
- 🚀 **一键启动**: 跨平台启动脚本,自动处理环境检查和项目构建

## 🚀 快速开始

### 方式一: 使用启动脚本 (推荐)

启动脚本会**自动完成所有配置**,包括依赖安装、配置文件创建、项目构建等。

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh once      # 立即执行一次
```

**Windows:**
```cmd
start.bat once       # 立即执行一次
```

详细说明: [启动脚本说明.md](启动脚本说明.md)

### 方式二: 手动配置

#### 1. 安装依赖

```bash
npm install
```

#### 2. 配置文件

**复制 config.yaml 配置:**
```bash
cp config.yaml.example config.yaml
```

**复制环境变量配置:**

```bash
cp .env.example .env
```

**编辑 `.env` 文件:**

```env
# GitHub Token (可选但推荐)
GITHUB_TOKEN=your_github_token_here

# 搜索关键字
SEARCH_KEYWORDS=free,v2ray

# 定时规则 (每天凌晨 2 点)
SCHEDULE_INTERVAL=0 2 * * *

# 输出文件
OUTPUT_FILE=./output/subscriptions.md

# 最大搜索仓库数
MAX_REPOSITORIES=30

# config.yaml 文件路径 (自动更新subs-check配置文件的sub-urls)
CONFIG_YAML_PATH=./config.yaml

# 质量过滤 (可选)
MIN_STARS=0                  # 最低 star 数量
MAX_DAYS_SINCE_UPDATE=90     # 最大更新天数

# 链接验证 (可选)
VALIDATE_LINKS=false         # 是否验证链接有效性
LINK_VALIDATION_TIMEOUT=10000 # 验证超时时间(毫秒)

# 日志配置 (可选)
LOG_DIR=./logs               # 日志目录
ENABLE_FILE_LOG=true         # 是否启用文件日志
```

#### 3. 构建项目

```bash
npm run build
```

#### 4. 运行

```bash
# 立即执行一次
npm run once

# 启动定时任务
npm start

# 启动定时任务并立即执行一次
npm start -- --run-now
```

### 📝 查看日志

```bash
# 显示最新日志
./view-logs.sh

# 实时跟踪日志
./view-logs.sh tail

# 列出所有日志
./view-logs.sh list
```

## 📖 使用说明

### 获取 GitHub Token

1. 访问 [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 选择权限: `public_repo`
4. 生成并复制 Token

**为什么需要 Token?**
- 提高 API 速率限制 (未认证: 60次/小时 → 认证: 5000次/小时)
- 避免搜索被限制

### 自定义搜索关键字

在 `.env` 中修改 `SEARCH_KEYWORDS`:

```env
# 单个关键字
SEARCH_KEYWORDS=v2ray

# 多个关键字 (AND 逻辑)
SEARCH_KEYWORDS=free,v2ray,subscription
```

### 定时规则说明

使用标准 cron 表达式:

```bash
# 每天凌晨 2 点
0 2 * * *

# 每 6 小时
0 */6 * * *

# 每周日凌晨
0 0 * * 0

# 每天中午 12 点
0 12 * * *
```

## 📂 项目结构

```
.
├── src/
│   ├── types.ts              # 类型定义
│   ├── config.ts             # 配置加载
│   ├── github-searcher.ts    # GitHub 搜索模块
│   ├── readme-parser.ts      # README 解析模块
│   ├── link-aggregator.ts    # 链接聚合模块
│   ├── link-validator.ts     # 链接验证模块
│   ├── config-updater.ts     # config.yaml 更新模块
│   ├── collector.ts          # 收集器(主逻辑)
│   ├── scheduler.ts          # 任务调度器
│   └── index.ts              # 程序入口
├── output/
│   └── subscriptions.md      # 输出文件
├── .env                      # 环境变量配置
└── package.json
```

## 🏗️ 架构设计

### 模块职责

1. **GitHubSearcher** - GitHub API 交互
   - 搜索仓库
   - 获取 README 内容

2. **ReadmeParser** - 内容解析
   - 使用正则提取订阅链接
   - 推断链接类型 (V2Ray/Clash/SS)

3. **LinkAggregator** - 数据管理
   - 链接去重
   - 分类整理
   - 持久化存储

4. **LinkValidator** - 链接验证
   - HTTP 有效性检测
   - 超时控制
   - 错误分类

5. **ConfigUpdater** - 配置更新
   - 更新 config.yaml 的 sub-urls
   - 保留注释和格式
   - 自动备份

6. **SubscriptionCollector** - 流程协调
   - 编排各模块协作
   - 错误处理
   - 进度输出

7. **TaskScheduler** - 任务调度
   - 定时执行
   - 手动触发

### 设计原则

- ✅ **单一职责**: 每个类只负责一项功能
- ✅ **依赖注入**: 便于测试和扩展
- ✅ **接口抽象**: 类型安全,易于维护
- ✅ **错误处理**: 优雅降级,不中断流程

## 📊 输出格式

生成的 `subscriptions.md` 包含:

1. **统计信息**: 总链接数、分类统计
2. **分类展示**: 按类型 (V2Ray/Clash/SS) 分组
3. **详细信息**: 每个链接的来源、描述、发现时间
4. **纯链接列表**: 方便直接复制使用

示例:

```markdown
# V2Ray/Clash 订阅链接汇总

> 最后更新: 2025-01-15 02:00:00
> 总计: 15 个链接

## 📊 统计

- V2Ray: 8 个
- Clash: 5 个
- 其他: 2 个

## V2Ray

### hello-world-1989/cn-news

**说明:** V2Ray订阅链接

**链接:** https://raw.githubusercontent.com/...

*发现时间: 2025-01-15 02:00:00*

---
```

## ⚙️ 高级配置

### 修改搜索逻辑

编辑 [github-searcher.ts](src/github-searcher.ts:20):

```typescript
// 自定义搜索查询
const query = keywords.join(' ') + ' stars:>10';
```

### 自定义链接模式

编辑 [readme-parser.ts](src/readme-parser.ts:10):

```typescript
private readonly URL_PATTERNS = [
  /your-custom-pattern/gi,
  // ...
];
```

## 🔧 故障排查

### GitHub API 限制

**问题**: `API rate limit exceeded`

**解决**:
1. 配置 `GITHUB_TOKEN`
2. 减少 `MAX_REPOSITORIES`
3. 增加 `collector.ts` 中的延迟时间

### 搜索结果为空

**原因**:
- 关键字太具体
- 仓库更新时间较久

**解决**:
- 调整搜索关键字
- 修改搜索排序规则

### 链接提取不准确

**原因**: 正则表达式未覆盖某些模式

**解决**: 在 [readme-parser.ts](src/readme-parser.ts:10) 中添加新的 URL 模式

## 🎯 链接验证功能

### 配置方式

在 `.env` 中启用链接验证:

```env
# 启用链接验证
VALIDATE_LINKS=true

# 设置超时时间(毫秒)
LINK_VALIDATION_TIMEOUT=10000
```

### 验证过程

当启用链接验证时,程序会:

1. 在收集完所有链接后
2. 逐个验证每个链接是否可访问
3. 过滤掉无效链接
4. 仅将有效链接更新到 config.yaml

### 验证输出示例

```
🔐 链接验证已启用

🔍 开始验证 50 个链接...
   超时设置: 10 秒

[1/50] 验证: https://raw.githubusercontent.com/...
   ✅ 有效

[2/50] 验证: https://example.com/sub/v2ray...
   ⏱️  超时

[3/50] 验证: https://invalid.com/...
   🔍 域名无法解析

📊 验证完成:
   ✅ 有效链接: 35 个
   ❌ 无效链接: 15 个
   📈 有效率: 70.0%
```

### 使用建议

**首次运行** (不建议验证):
```env
VALIDATE_LINKS=false
```
收集尽可能多的链接,不进行验证。

**日常使用** (推荐验证):
```env
VALIDATE_LINKS=true
LINK_VALIDATION_TIMEOUT=10000
```
确保只保留有效链接。

**快速验证**:
```env
VALIDATE_LINKS=true
LINK_VALIDATION_TIMEOUT=5000
```
快速过滤无响应的链接。

## 📝 TODO

- [x] 添加链接有效性验证
- [ ] 支持更多订阅格式 (Quantumult X、Surge)
- [ ] Web 界面展示
- [ ] Docker 容器化部署
- [ ] 链接质量评分
- [ ] 邮件通知

## ⚖️ 免责声明

本工具仅用于学习和研究目的。使用者需遵守当地法律法规,开发者不对使用本工具产生的任何后果负责。

## 📄 License

MIT
