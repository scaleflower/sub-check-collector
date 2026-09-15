import axios from 'axios';
import * as crypto from 'crypto';

export interface DingTalkMessage {
  title: string;
  text: string;
  webhook: string;
  secret?: string;
}

export function buildSignedWebhook(webhook: string, secret?: string): string {
  if (!secret) return webhook;

  const timestamp = Date.now();
  const sign = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}\n${secret}`)
    .digest('base64');

  const separator = webhook.includes('?') ? '&' : '?';
  return `${webhook}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
}

export async function sendDingTalkMarkdown(message: DingTalkMessage): Promise<void> {
  const response = await axios.post(
    buildSignedWebhook(message.webhook, message.secret),
    {
      msgtype: 'markdown',
      markdown: {
        title: message.title,
        text: message.text,
      },
    },
    {
      timeout: 10_000,
      // DingTalk is reached directly; the GOST proxy is only for GitHub traffic.
      proxy: false,
    }
  );

  const result = response.data as { errcode?: number; errmsg?: string };
  if (!result || result.errcode !== 0) {
    throw new Error(`DingTalk rejected notification: ${result?.errmsg || 'unknown error'}`);
  }
}

export function buildCollectorMessage(input: {
  repositoryCount: number;
  candidateCount: number;
  validCount: number;
  durationSeconds: number;
}): { title: string; text: string } {
  return {
    title: 'Collector 数据源采集完成',
    text: [
      '### Collector 数据源采集完成',
      '',
      `- 拉取仓库：${input.repositoryCount}`,
      `- 候选数据源：${input.candidateCount}`,
      `- 有效数据源：${input.validCount}`,
      `- 耗时：${input.durationSeconds.toFixed(1)} 秒`,
    ].join('\n'),
  };
}

export function buildSubsCheckMessage(successCount: number): { title: string; text: string } {
  return {
    title: 'Subs Check 节点校验完成',
    text: [
      '### Subs Check 节点校验完成',
      '',
      `- 可用节点：${successCount}`,
      `- 完成时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n'),
  };
}
