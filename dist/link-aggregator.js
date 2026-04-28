"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkAggregator = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * 链接聚合器
 * 职责: 去重、排序、持久化订阅链接
 */
class LinkAggregator {
    constructor() {
        this.links = new Map();
    }
    /**
     * 添加链接(自动去重)
     */
    addLinks(newLinks) {
        for (const link of newLinks) {
            // 使用 URL 作为唯一标识进行去重
            if (!this.links.has(link.url)) {
                this.links.set(link.url, link);
            }
            else {
                // 如果链接已存在,更新发现时间
                const existing = this.links.get(link.url);
                existing.foundAt = link.foundAt;
            }
        }
    }
    /**
     * 获取所有链接(按类型分组)
     */
    getGroupedLinks() {
        const grouped = {};
        for (const link of this.links.values()) {
            const type = link.type || '其他';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(link);
        }
        // 每个组内按发现时间倒序
        for (const type in grouped) {
            grouped[type].sort((a, b) => b.foundAt.getTime() - a.foundAt.getTime());
        }
        return grouped;
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const byType = {};
        for (const link of this.links.values()) {
            const type = link.type || '其他';
            byType[type] = (byType[type] || 0) + 1;
        }
        return {
            total: this.links.size,
            byType,
        };
    }
    /**
     * 获取所有链接
     */
    getAllLinks() {
        return Array.from(this.links.values());
    }
    /**
     * 保存到文件
     */
    async saveToFile(filePath) {
        const grouped = this.getGroupedLinks();
        const stats = this.getStats();
        // 生成 Markdown 格式输出
        let content = '# V2Ray/Clash 订阅链接汇总\n\n';
        content += `> 最后更新: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `> 总计: ${stats.total} 个链接\n\n`;
        content += '## 📊 统计\n\n';
        for (const [type, count] of Object.entries(stats.byType)) {
            content += `- ${type}: ${count} 个\n`;
        }
        content += '\n---\n\n';
        // 按类型输出
        for (const [type, links] of Object.entries(grouped)) {
            content += `## ${type}\n\n`;
            for (const link of links) {
                content += `### ${link.source}\n\n`;
                if (link.description) {
                    content += `**说明:** ${link.description}\n\n`;
                }
                content += `**链接:** ${link.url}\n\n`;
                content += `*发现时间: ${link.foundAt.toLocaleString('zh-CN')}*\n\n`;
                content += '---\n\n';
            }
        }
        // 附录: 纯链接列表(方便复制)
        content += '## 📎 纯链接列表\n\n';
        content += '```\n';
        for (const link of this.links.values()) {
            content += link.url + '\n';
        }
        content += '```\n';
        // 确保目录存在
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        // 写入文件
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`💾 已保存到: ${filePath}`);
    }
    /**
     * 从文件加载(用于增量更新)
     */
    async loadFromFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // 简单解析: 提取所有 URL
            const urlPattern = /https?:\/\/[^\s<>"]+/g;
            const matches = content.matchAll(urlPattern);
            for (const match of matches) {
                const url = match[0];
                if (!this.links.has(url)) {
                    this.links.set(url, {
                        url,
                        source: '历史记录',
                        foundAt: new Date(),
                    });
                }
            }
            console.log(`📂 从文件加载了 ${this.links.size} 个链接`);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📂 输出文件不存在,将创建新文件');
            }
            else {
                console.error('❌ 加载文件失败:', error);
            }
        }
    }
    /**
     * 清空所有链接
     */
    clear() {
        this.links.clear();
    }
}
exports.LinkAggregator = LinkAggregator;
