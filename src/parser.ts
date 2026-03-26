import { InboxTask, TodoItem } from "./types";

/** 灵活解析日期：支持 MM-DD、MM/DD、YYYY-MM-DD、YYYY/MM/DD
 *  省略年份时自动补当前年，如果算出来已过期超过 30 天则补下一年 */
export function parseFlexibleDate(raw: string): Date | null {
  // 完整日期 YYYY-MM-DD 或 YYYY/MM/DD
  const fullMatch = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (fullMatch) {
    return new Date(Number(fullMatch[1]), Number(fullMatch[2]) - 1, Number(fullMatch[3]));
  }
  // 省略年份 MM-DD 或 MM/DD
  const shortMatch = raw.match(/(\d{1,2})[-/](\d{1,2})/);
  if (shortMatch) {
    const now = new Date();
    const month = Number(shortMatch[1]) - 1;
    const day = Number(shortMatch[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, month, day);
    // 如果已过期超过 30 天，认为是明年的
    const diffDays = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < -30) {
      year += 1;
    }
    return new Date(year, month, day);
  }
  return null;
}

/** 规范化日期输入：省略年份时自动补全为 YYYY-MM-DD */
export function normalizeDeadline(input: string): string {
  const d = parseFlexibleDate(input);
  if (!d) return input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseInboxFile(content: string, filePath: string): InboxTask {
  const lines = content.split("\n");

  let title = filePath.split("/").pop()?.replace(".md", "") || "Untitled";
  let status = "未知";
  let deadline: string | null = null;
  let deadlineDate: Date | null = null;
  let description = "";
  const todos: TodoItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 标题：第一个 # 一级标题
    if (/^# /.test(line) && title === filePath.split("/").pop()?.replace(".md", "")) {
      title = line.replace(/^# /, "").trim();
    }

    // 状态
    const statusMatch = line.match(/\*\*状态\*\*[：:]\s*(.+)/);
    if (statusMatch) {
      status = statusMatch[1].trim();
    }

    // 截止日期
    const deadlineMatch = line.match(/\*\*截止日期\*\*[：:]\s*(.+)/);
    if (deadlineMatch) {
      const raw = deadlineMatch[1].trim();
      deadline = raw;
      deadlineDate = parseFlexibleDate(raw);
    }

    // 待办项
    const todoMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
    if (todoMatch) {
      todos.push({
        text: todoMatch[3].trim(),
        completed: todoMatch[2] !== " ",
        line: i,
      });
    }
  }

  // 计算剩余天数
  let daysRemaining: number | null = null;
  if (deadlineDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dl = new Date(deadlineDate);
    dl.setHours(0, 0, 0, 0);
    daysRemaining = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    filePath,
    title,
    status,
    deadline,
    deadlineDate,
    description,
    todos,
    daysRemaining,
  };
}

export function toggleTodoInContent(content: string, todoLine: number): string {
  const lines = content.split("\n");
  const line = lines[todoLine];
  if (!line) return content;

  if (/\[\s\]/.test(line)) {
    lines[todoLine] = line.replace("[ ]", "[x]");
  } else if (/\[[xX]\]/.test(line)) {
    lines[todoLine] = line.replace(/\[[xX]\]/, "[ ]");
  }

  return lines.join("\n");
}

export function generateTaskContent(title: string, deadline: string, description: string, todos?: string[], defaultStatus?: string): string {
  const status = defaultStatus || "待处理";
  const todoLines = todos && todos.length > 0
    ? todos.map((t) => `- [ ] ${t}`).join("\n")
    : "- [ ] ";

  return `# ${title}

- **状态**：${status}
- **截止日期**：${deadline}

## 描述

${description || "（待补充）"}

## 待办

${todoLines}
`;
}
