import { ItemView, WorkspaceLeaf, TFile, Modal, App, Setting } from "obsidian";
import { InboxTask } from "./types";
import { parseInboxFile, toggleTodoInContent, generateTaskContent, normalizeDeadline } from "./parser";
import type InboxTrackerPlugin from "./main";
import type { InboxTrackerSettings } from "./settings";

export const VIEW_TYPE_INBOX = "inbox-tracker-view";

export class InboxView extends ItemView {
  private tasks: InboxTask[] = [];
  private plugin: InboxTrackerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: InboxTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  private get s(): InboxTrackerSettings {
    return this.plugin.settings;
  }

  getViewType(): string {
    return VIEW_TYPE_INBOX;
  }

  getDisplayText(): string {
    return "Inbox Tracker";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.startsWith(this.s.inboxFolder)) this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file.path.startsWith(this.s.inboxFolder)) this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file.path.startsWith(this.s.inboxFolder)) this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file.path.startsWith(this.s.inboxFolder) || oldPath.startsWith(this.s.inboxFolder)) this.refresh();
      })
    );
  }

  async refresh(): Promise<void> {
    const inboxFolder = this.s.inboxFolder;
    const archiveFolder = `${inboxFolder}/${this.s.archiveFolder}`;
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(inboxFolder) && !f.path.startsWith(archiveFolder) && f.extension === "md" && f.name !== "README.md"
    );

    this.tasks = [];
    for (const file of files) {
      const content = await this.app.vault.read(file);
      this.tasks.push(parseInboxFile(content, file.path));
    }

    this.tasks.sort((a, b) => {
      if (!a.deadlineDate && !b.deadlineDate) return 0;
      if (!a.deadlineDate) return 1;
      if (!b.deadlineDate) return -1;
      return a.deadlineDate.getTime() - b.deadlineDate.getTime();
    });

    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("inbox-tracker");

    const header = container.createDiv({ cls: "it-header" });
    const titleRow = header.createDiv({ cls: "it-header-row" });
    titleRow.createEl("span", { text: "📥 INBOX TRACKER", cls: "it-logo" });

    const addBtn = titleRow.createEl("button", { text: "+ 新建", cls: "it-btn-add" });
    addBtn.addEventListener("click", () => {
      new CreateTaskModal(this.app, this.s, async (title, deadline, desc, todos) => {
        const fileName = title.replace(/[\\/:*?"<>|]/g, "_");
        const content = generateTaskContent(title, deadline, desc, todos, this.s.defaultStatus);
        const inboxFolder = this.s.inboxFolder;
        if (!this.app.vault.getAbstractFileByPath(inboxFolder)) {
          await this.app.vault.createFolder(inboxFolder);
        }
        await this.app.vault.create(`${inboxFolder}/${fileName}.md`, content);
      }).open();
    });

    const urgentDays = this.s.urgentDays;
    const total = this.tasks.length;
    const overdue = this.tasks.filter((t) => t.daysRemaining !== null && t.daysRemaining < 0).length;
    const upcoming = this.tasks.filter((t) => t.daysRemaining !== null && t.daysRemaining >= 0 && t.daysRemaining <= urgentDays).length;

    const stats = header.createDiv({ cls: "it-stats" });
    stats.createEl("span", { text: `全部 ${total}`, cls: "it-stat" });
    if (overdue > 0) stats.createEl("span", { text: `已过期 ${overdue}`, cls: "it-stat it-stat-overdue" });
    if (upcoming > 0) stats.createEl("span", { text: `即将到期 ${upcoming}`, cls: "it-stat it-stat-upcoming" });

    const list = container.createDiv({ cls: "it-list" });

    if (this.tasks.length === 0) {
      list.createDiv({ cls: "it-empty", text: "Inbox 清空了，干得漂亮 🎉" });
      return;
    }

    for (const task of this.tasks) {
      this.renderTaskCard(list, task);
    }
  }

  private renderTaskCard(parent: HTMLElement, task: InboxTask): void {
    const urgentDays = this.s.urgentDays;
    const urgencyClass = this.getUrgencyClass(task.daysRemaining, urgentDays);
    const card = parent.createDiv({ cls: `it-card ${urgencyClass}` });

    const cardHeader = card.createDiv({ cls: "it-card-header" });
    const titleEl = cardHeader.createEl("span", { text: task.title, cls: "it-card-title" });
    titleEl.addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof TFile) {
        this.app.workspace.getLeaf(false).openFile(file);
      }
    });

    cardHeader.createEl("span", { text: task.status, cls: `it-badge it-badge-${this.statusToClass(task.status)}` });

    const archiveBtn = cardHeader.createEl("button", { text: "📦", cls: "it-btn-archive", attr: { "aria-label": "归档" } });
    archiveBtn.addEventListener("click", async () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof TFile) {
        const archiveDir = `${this.s.inboxFolder}/${this.s.archiveFolder}`;
        if (!this.app.vault.getAbstractFileByPath(archiveDir)) {
          await this.app.vault.createFolder(archiveDir);
        }
        await this.app.fileManager.renameFile(file, `${archiveDir}/${file.name}`);
      }
    });

    if (task.deadline) {
      const deadlineRow = card.createDiv({ cls: "it-card-deadline" });
      const icon = task.daysRemaining !== null && task.daysRemaining < 0 ? "⚠️" : "⏰";
      deadlineRow.createEl("span", { text: `${icon} ${task.deadline}` });
      if (task.daysRemaining !== null) {
        const label = task.daysRemaining < 0
          ? `已过期 ${Math.abs(task.daysRemaining)} 天`
          : task.daysRemaining === 0
          ? "今天到期"
          : `剩余 ${task.daysRemaining} 天`;
        deadlineRow.createEl("span", { text: label, cls: `it-countdown ${urgencyClass}` });
      }
    }

    if (task.todos.length > 0) {
      const showCompleted = this.s.showCompletedTodos;
      const visibleTodos = showCompleted ? task.todos : task.todos.filter((t) => !t.completed);
      const done = task.todos.filter((t) => t.completed).length;
      const total = task.todos.length;
      const pct = Math.round((done / total) * 100);

      const progressRow = card.createDiv({ cls: "it-card-progress" });
      const bar = progressRow.createDiv({ cls: "it-progress-bar" });
      const fill = bar.createDiv({ cls: "it-progress-fill" });
      fill.style.width = `${pct}%`;
      progressRow.createEl("span", { text: `${done}/${total}`, cls: "it-progress-text" });

      if (visibleTodos.length > 0) {
        const todoList = card.createDiv({ cls: "it-todos" });
        for (const todo of visibleTodos) {
          const todoRow = todoList.createDiv({ cls: `it-todo-item ${todo.completed ? "it-todo-done" : ""}` });
          const checkbox = todoRow.createEl("input", { type: "checkbox" });
          checkbox.checked = todo.completed;
          checkbox.addEventListener("change", async () => {
            const file = this.app.vault.getAbstractFileByPath(task.filePath);
            if (file instanceof TFile) {
              const content = await this.app.vault.read(file);
              const newContent = toggleTodoInContent(content, todo.line);
              await this.app.vault.modify(file, newContent);
            }
          });
          todoRow.createEl("span", { text: todo.text, cls: "it-todo-text" });
        }
      }
    }
  }

  private getUrgencyClass(days: number | null, urgentDays: number): string {
    if (days === null) return "";
    if (days < 0) return "it-overdue";
    if (days <= urgentDays) return "it-urgent";
    return "it-normal";
  }

  private statusToClass(status: string): string {
    if (status.includes("完成") || status.includes("已解决")) return "done";
    if (status.includes("进行") || status.includes("处理中")) return "active";
    return "pending";
  }
}

// 创建任务的模态框
class CreateTaskModal extends Modal {
  private onSubmit: (title: string, deadline: string, description: string, todos: string[]) => Promise<void>;
  private settings: InboxTrackerSettings;
  private title = "";
  private deadline = "";
  private description = "";
  private todosRaw = "";

  constructor(app: App, settings: InboxTrackerSettings, onSubmit: (title: string, deadline: string, description: string, todos: string[]) => Promise<void>) {
    super(app);
    this.settings = settings;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("it-modal");
    contentEl.createEl("h2", { text: "新建待办", cls: "it-modal-title" });

    new Setting(contentEl).setName("标题").addText((text) =>
      text.setPlaceholder("输入任务标题").onChange((v) => (this.title = v))
    );

    new Setting(contentEl).setName("截止日期").addText((text) =>
      text.setPlaceholder("MM-DD 或 YYYY-MM-DD").onChange((v) => (this.deadline = v))
    );

    new Setting(contentEl).setName("描述").addTextArea((area) => {
      area.setPlaceholder("简要描述（可选）").onChange((v) => (this.description = v));
      area.inputEl.rows = 2;
    });

    new Setting(contentEl).setName("待办事项").addTextArea((area) => {
      area.setPlaceholder("每行一条，如：\n确认无业务连接\n通知相关方\n执行下线操作").onChange((v) => (this.todosRaw = v));
      area.inputEl.rows = 4;
    });

    const btnRow = contentEl.createDiv({ cls: "it-modal-actions" });
    const submitBtn = btnRow.createEl("button", { text: "创建", cls: "it-btn-submit" });
    submitBtn.addEventListener("click", async () => {
      if (!this.title.trim()) return;
      if (!this.deadline.trim()) {
        this.deadline = new Date().toISOString().split("T")[0];
      } else {
        this.deadline = normalizeDeadline(this.deadline);
      }
      const todos = this.todosRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      await this.onSubmit(this.title, this.deadline, this.description, todos);
      this.close();
    });

    const cancelBtn = btnRow.createEl("button", { text: "取消", cls: "it-btn-cancel" });
    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
