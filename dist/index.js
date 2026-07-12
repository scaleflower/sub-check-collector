#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const scheduler_1 = require("./scheduler");
const logger_1 = require("./logger");
const web_server_1 = require("./web-server");
/**
 * 主入口
 */
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('   V2Ray/Clash 订阅链接自动收集器');
    console.log('═══════════════════════════════════════════════════\n');
    // 加载配置
    const config = (0, config_1.loadConfig)();
    // 初始化日志
    const logger = new logger_1.Logger(config.logDir, true, config.enableFileLog);
    await logger.init();
    console.log(`📝 日志目录: ${config.logDir}`);
    if (config.enableFileLog) {
        console.log(`📄 日志文件: ${logger.getLogFilePath()}\n`);
    }
    // 创建调度器
    const scheduler = new scheduler_1.TaskScheduler(config, logger);
    // 解析命令行参数
    const args = process.argv.slice(2);
    const command = args[0];
    if (command === 'web') {
        console.log('Web panel starting...');
        const server = (0, web_server_1.createServer)(parseInt(process.env.WEB_PORT || '8198'));
        console.log('Press Ctrl+C to exit\n');
        process.on('SIGINT', () => { console.log('\nExiting'); server.close(); process.exit(0); });
    }
    else if (command === 'once' || command === 'run') {
        // 立即执行一次
        await scheduler.runOnce();
        process.exit(0);
    }
    else if (command === 'schedule' || !command) {
        // 启动定时任务
        scheduler.start();
        // 可选: 启动时先执行一次
        if (args.includes('--run-now')) {
            await scheduler.runOnce();
        }
        // 保持进程运行
        console.log('💡 提示: 按 Ctrl+C 退出\n');
        // 优雅退出
        process.on('SIGINT', () => {
            console.log('\n\n👋 程序退出');
            scheduler.stop();
            process.exit(0);
        });
    }
    else {
        console.log('用法:');
        console.log('  npm start              - 启动定时任务');
        console.log('  npm start once         - 立即执行一次');
        console.log('  npm start schedule     - 启动定时任务');
        console.log('  npm run web           - 启动 Web 管理面板 (端口 8198)');
        console.log('  npm start -- --run-now - 启动定时任务并立即执行一次');
        console.log('  node dist/index.js web - 启动 Web 管理面板\n');
        process.exit(1);
    }
}
// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 未处理的错误:', error);
    process.exit(1);
});
// 启动
main().catch((error) => {
    console.error('❌ 程序启动失败:', error);
    process.exit(1);
});
