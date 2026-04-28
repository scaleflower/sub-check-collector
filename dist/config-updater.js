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
exports.ConfigUpdater = void 0;
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
/**
 * YAML 配置文件更新器
 * 职责: 将收集到的订阅链接更新到 config.yaml 的 sub-urls 部分
 */
class ConfigUpdater {
    constructor(configPath = './config.yaml') {
        // 默认 URL，始终放在第一行，永不覆盖
        this.DEFAULT_URL = 'https://misub.907737.xyz/allnodes';
        this.configPath = configPath;
    }
    /**
     * 更新 config.yaml 中的 sub-urls
     * @param links 订阅链接列表
     */
    async updateSubUrls(links) {
        try {
            console.log('\n📝 开始更新 config.yaml...');
            // 1. 读取现有配置文件
            const fileContent = await fs.readFile(this.configPath, 'utf-8');
            // 2. 解析 YAML (保留注释)
            const config = yaml.load(fileContent);
            if (!config) {
                throw new Error('配置文件解析失败');
            }
            // 3. 提取所有有效的订阅链接 URL
            const newUrls = this.extractValidUrls(links);
            // 4. 获取现有的 sub-urls
            const existingUrls = new Set(config['sub-urls'] || []);
            // 5. 合并链接(去重)
            const mergedUrls = this.mergeUrls(existingUrls, newUrls);
            // 6. 更新配置
            config['sub-urls'] = Array.from(mergedUrls);
            // 7. 保留注释的方式写回文件
            await this.writeConfigWithComments(fileContent, mergedUrls);
            console.log(`✅ 配置文件已更新`);
            console.log(`   - 原有链接: ${existingUrls.size} 个`);
            console.log(`   - 新增链接: ${mergedUrls.size - existingUrls.size} 个`);
            console.log(`   - 总计链接: ${mergedUrls.size} 个\n`);
        }
        catch (error) {
            console.error('❌ 更新配置文件失败:', error);
            throw error;
        }
    }
    /**
     * 从订阅链接中提取有效的 URL
     */
    extractValidUrls(links) {
        const urls = new Set();
        for (const link of links) {
            const url = link.url;
            // 过滤规则: 只保留以下类型的链接
            if (url.includes('raw.githubusercontent.com') ||
                url.includes('gist.githubusercontent.com') ||
                url.includes('github.com') ||
                url.match(/\.(txt|yaml|yml|conf|json)$/i) ||
                url.includes('/sub') ||
                url.includes('subscription')) {
                urls.add(url);
            }
        }
        return urls;
    }
    /**
     * 合并新旧链接
     * 默认 URL 会被排除在合并逻辑外，由 writeConfigWithComments 单独处理
     */
    mergeUrls(existingUrls, newUrls) {
        const merged = new Set();
        // 添加现有链接（排除默认 URL，它会单独处理）
        for (const url of existingUrls) {
            if (url !== this.DEFAULT_URL) {
                merged.add(url);
            }
        }
        // 添加新链接（排除默认 URL）
        for (const url of newUrls) {
            if (url !== this.DEFAULT_URL) {
                merged.add(url);
            }
        }
        return merged;
    }
    /**
     * 保留注释的方式写回配置文件
     * 使用正则表达式替换 sub-urls 部分,保留注释
     */
    async writeConfigWithComments(originalContent, newUrls) {
        // 构建新的 sub-urls 部分
        // 1. 默认 URL 始终放在第一行
        // 2. 其他 URL 排序后追加
        // 3. URL 不带引号
        // 4. sub-urls: 后需要一个空行，然后是 URL 列表
        const sortedUrls = Array.from(newUrls).sort();
        const allUrls = [this.DEFAULT_URL, ...sortedUrls];
        const urlsLines = '\n' + allUrls
            .map((url) => `  - ${url}`)
            .join('\n');
        // 改进的正则表达式:
        // 1. 匹配 sub-urls: 前面的所有注释行 (# 开头的行)
        // 2. 匹配 sub-urls: 这一行
        // 3. 匹配所有以空格或tab开头的内容行(包括注释的示例链接)
        // 但只替换非注释的链接部分
        const lines = originalContent.split('\n');
        const newLines = [];
        let inSubUrls = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 检测 sub-urls: 这一行
            if (line.trim() === 'sub-urls:') {
                inSubUrls = true;
                newLines.push(line);
                continue;
            }
            // 如果在 sub-urls 部分
            if (inSubUrls) {
                // 检查是否到达下一个顶级配置项(不以空格/tab/# 开头的行)
                if (line.length > 0 && !line.match(/^[\s#]/)) {
                    // 遇到下一个配置项,退出 sub-urls 部分
                    inSubUrls = false;
                    // 在这里插入新的 URLs
                    newLines.push(urlsLines);
                    newLines.push(line);
                }
                else {
                    // 保留注释行和空行,忽略实际的URL行
                    if (line.trim().startsWith('#') || line.trim() === '') {
                        newLines.push(line);
                    }
                    // 忽略旧的URL行(以 - 开头)
                }
            }
            else {
                newLines.push(line);
            }
        }
        // 如果文件末尾就是 sub-urls 部分,添加 URLs
        if (inSubUrls) {
            newLines.push(urlsLines);
        }
        const updatedContent = newLines.join('\n');
        // 写回文件
        await fs.writeFile(this.configPath, updatedContent, 'utf-8');
    }
    /**
     * 备份配置文件
     */
    async backupConfig() {
        const backupPath = `${this.configPath}.backup.${Date.now()}`;
        await fs.copyFile(this.configPath, backupPath);
        console.log(`💾 配置文件已备份: ${backupPath}`);
        return backupPath;
    }
}
exports.ConfigUpdater = ConfigUpdater;
