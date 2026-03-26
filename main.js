var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => InboxTrackerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/view.ts
var import_obsidian = require("obsidian");

// src/parser.ts
function parseFlexibleDate(raw) {
  const fullMatch = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (fullMatch) {
    return new Date(Number(fullMatch[1]), Number(fullMatch[2]) - 1, Number(fullMatch[3]));
  }
  const shortMatch = raw.match(/(\d{1,2})[-/](\d{1,2})/);
  if (shortMatch) {
    const now = new Date();
    const month = Number(shortMatch[1]) - 1;
    const day = Number(shortMatch[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, month, day);
    const diffDays = (candidate.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24);
    if (diffDays < -30) {
      year += 1;
    }
    return new Date(year, month, day);
  }
  return null;
}
function normalizeDeadline(input) {
  const d = parseFlexibleDate(input);
  if (!d)
    return input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseInboxFile(content, filePath) {
  var _a, _b;
  const lines = content.split("\n");
  let title = ((_a = filePath.split("/").pop()) == null ? void 0 : _a.replace(".md", "")) || "Untitled";
  let status = "\u672A\u77E5";
  let deadline = null;
  let deadlineDate = null;
  let description = "";
  const todos = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^# /.test(line) && title === ((_b = filePath.split("/").pop()) == null ? void 0 : _b.replace(".md", ""))) {
      title = line.replace(/^# /, "").trim();
    }
    const statusMatch = line.match(/\*\*状态\*\*[：:]\s*(.+)/);
    if (statusMatch) {
      status = statusMatch[1].trim();
    }
    const deadlineMatch = line.match(/\*\*截止日期\*\*[：:]\s*(.+)/);
    if (deadlineMatch) {
      const raw = deadlineMatch[1].trim();
      deadline = raw;
      deadlineDate = parseFlexibleDate(raw);
    }
    const todoMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)/);
    if (todoMatch) {
      todos.push({
        text: todoMatch[3].trim(),
        completed: todoMatch[2] !== " ",
        line: i
      });
    }
  }
  let daysRemaining = null;
  if (deadlineDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dl = new Date(deadlineDate);
    dl.setHours(0, 0, 0, 0);
    daysRemaining = Math.ceil((dl.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
  }
  return {
    filePath,
    title,
    status,
    deadline,
    deadlineDate,
    description,
    todos,
    daysRemaining
  };
}
function toggleTodoInContent(content, todoLine) {
  const lines = content.split("\n");
  const line = lines[todoLine];
  if (!line)
    return content;
  if (/\[\s\]/.test(line)) {
    lines[todoLine] = line.replace("[ ]", "[x]");
  } else if (/\[[xX]\]/.test(line)) {
    lines[todoLine] = line.replace(/\[[xX]\]/, "[ ]");
  }
  return lines.join("\n");
}
function generateTaskContent(title, deadline, description, todos, defaultStatus) {
  const status = defaultStatus || "\u5F85\u5904\u7406";
  const todoLines = todos && todos.length > 0 ? todos.map((t) => `- [ ] ${t}`).join("\n") : "- [ ] ";
  return `# ${title}

- **\u72B6\u6001**\uFF1A${status}
- **\u622A\u6B62\u65E5\u671F**\uFF1A${deadline}

## \u63CF\u8FF0

${description || "\uFF08\u5F85\u8865\u5145\uFF09"}

## \u5F85\u529E

${todoLines}
`;
}

// src/view.ts
var VIEW_TYPE_INBOX = "inbox-tracker-view";
var InboxView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.tasks = [];
    this.plugin = plugin;
  }
  get s() {
    return this.plugin.settings;
  }
  getViewType() {
    return VIEW_TYPE_INBOX;
  }
  getDisplayText() {
    return "Inbox Tracker";
  }
  getIcon() {
    return "inbox";
  }
  async onOpen() {
    await this.refresh();
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path.startsWith(this.s.inboxFolder))
          this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file.path.startsWith(this.s.inboxFolder))
          this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file.path.startsWith(this.s.inboxFolder))
          this.refresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file.path.startsWith(this.s.inboxFolder) || oldPath.startsWith(this.s.inboxFolder))
          this.refresh();
      })
    );
  }
  async refresh() {
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
      if (!a.deadlineDate && !b.deadlineDate)
        return 0;
      if (!a.deadlineDate)
        return 1;
      if (!b.deadlineDate)
        return -1;
      return a.deadlineDate.getTime() - b.deadlineDate.getTime();
    });
    this.render();
  }
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("inbox-tracker");
    const header = container.createDiv({ cls: "it-header" });
    const titleRow = header.createDiv({ cls: "it-header-row" });
    titleRow.createEl("span", { text: "\u{1F4E5} INBOX TRACKER", cls: "it-logo" });
    const addBtn = titleRow.createEl("button", { text: "+ \u65B0\u5EFA", cls: "it-btn-add" });
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
    stats.createEl("span", { text: `\u5168\u90E8 ${total}`, cls: "it-stat" });
    if (overdue > 0)
      stats.createEl("span", { text: `\u5DF2\u8FC7\u671F ${overdue}`, cls: "it-stat it-stat-overdue" });
    if (upcoming > 0)
      stats.createEl("span", { text: `\u5373\u5C06\u5230\u671F ${upcoming}`, cls: "it-stat it-stat-upcoming" });
    const list = container.createDiv({ cls: "it-list" });
    if (this.tasks.length === 0) {
      list.createDiv({ cls: "it-empty", text: "Inbox \u6E05\u7A7A\u4E86\uFF0C\u5E72\u5F97\u6F02\u4EAE \u{1F389}" });
      return;
    }
    for (const task of this.tasks) {
      this.renderTaskCard(list, task);
    }
  }
  renderTaskCard(parent, task) {
    const urgentDays = this.s.urgentDays;
    const urgencyClass = this.getUrgencyClass(task.daysRemaining, urgentDays);
    const card = parent.createDiv({ cls: `it-card ${urgencyClass}` });
    const cardHeader = card.createDiv({ cls: "it-card-header" });
    const titleEl = cardHeader.createEl("span", { text: task.title, cls: "it-card-title" });
    titleEl.addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof import_obsidian.TFile) {
        this.app.workspace.getLeaf(false).openFile(file);
      }
    });
    cardHeader.createEl("span", { text: task.status, cls: `it-badge it-badge-${this.statusToClass(task.status)}` });
    const archiveBtn = cardHeader.createEl("button", { text: "\u{1F4E6}", cls: "it-btn-archive", attr: { "aria-label": "\u5F52\u6863" } });
    archiveBtn.addEventListener("click", async () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (file instanceof import_obsidian.TFile) {
        const archiveDir = `${this.s.inboxFolder}/${this.s.archiveFolder}`;
        if (!this.app.vault.getAbstractFileByPath(archiveDir)) {
          await this.app.vault.createFolder(archiveDir);
        }
        await this.app.fileManager.renameFile(file, `${archiveDir}/${file.name}`);
      }
    });
    if (task.deadline) {
      const deadlineRow = card.createDiv({ cls: "it-card-deadline" });
      const icon = task.daysRemaining !== null && task.daysRemaining < 0 ? "\u26A0\uFE0F" : "\u23F0";
      deadlineRow.createEl("span", { text: `${icon} ${task.deadline}` });
      if (task.daysRemaining !== null) {
        const label = task.daysRemaining < 0 ? `\u5DF2\u8FC7\u671F ${Math.abs(task.daysRemaining)} \u5929` : task.daysRemaining === 0 ? "\u4ECA\u5929\u5230\u671F" : `\u5269\u4F59 ${task.daysRemaining} \u5929`;
        deadlineRow.createEl("span", { text: label, cls: `it-countdown ${urgencyClass}` });
      }
    }
    if (task.todos.length > 0) {
      const showCompleted = this.s.showCompletedTodos;
      const visibleTodos = showCompleted ? task.todos : task.todos.filter((t) => !t.completed);
      const done = task.todos.filter((t) => t.completed).length;
      const total = task.todos.length;
      const pct = Math.round(done / total * 100);
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
            if (file instanceof import_obsidian.TFile) {
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
  getUrgencyClass(days, urgentDays) {
    if (days === null)
      return "";
    if (days < 0)
      return "it-overdue";
    if (days <= urgentDays)
      return "it-urgent";
    return "it-normal";
  }
  statusToClass(status) {
    if (status.includes("\u5B8C\u6210") || status.includes("\u5DF2\u89E3\u51B3"))
      return "done";
    if (status.includes("\u8FDB\u884C") || status.includes("\u5904\u7406\u4E2D"))
      return "active";
    return "pending";
  }
};
var CreateTaskModal = class extends import_obsidian.Modal {
  constructor(app, settings, onSubmit) {
    super(app);
    this.title = "";
    this.deadline = "";
    this.description = "";
    this.todosRaw = "";
    this.settings = settings;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("it-modal");
    contentEl.createEl("h2", { text: "\u65B0\u5EFA\u5F85\u529E", cls: "it-modal-title" });
    new import_obsidian.Setting(contentEl).setName("\u6807\u9898").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u4EFB\u52A1\u6807\u9898").onChange((v) => this.title = v)
    );
    new import_obsidian.Setting(contentEl).setName("\u622A\u6B62\u65E5\u671F").addText(
      (text) => text.setPlaceholder("MM-DD \u6216 YYYY-MM-DD").onChange((v) => this.deadline = v)
    );
    new import_obsidian.Setting(contentEl).setName("\u63CF\u8FF0").addTextArea((area) => {
      area.setPlaceholder("\u7B80\u8981\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09").onChange((v) => this.description = v);
      area.inputEl.rows = 2;
    });
    new import_obsidian.Setting(contentEl).setName("\u5F85\u529E\u4E8B\u9879").addTextArea((area) => {
      area.setPlaceholder("\u6BCF\u884C\u4E00\u6761\uFF0C\u5982\uFF1A\n\u786E\u8BA4\u65E0\u4E1A\u52A1\u8FDE\u63A5\n\u901A\u77E5\u76F8\u5173\u65B9\n\u6267\u884C\u4E0B\u7EBF\u64CD\u4F5C").onChange((v) => this.todosRaw = v);
      area.inputEl.rows = 4;
    });
    const btnRow = contentEl.createDiv({ cls: "it-modal-actions" });
    const submitBtn = btnRow.createEl("button", { text: "\u521B\u5EFA", cls: "it-btn-submit" });
    submitBtn.addEventListener("click", async () => {
      if (!this.title.trim())
        return;
      if (!this.deadline.trim()) {
        this.deadline = new Date().toISOString().split("T")[0];
      } else {
        this.deadline = normalizeDeadline(this.deadline);
      }
      const todos = this.todosRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      await this.onSubmit(this.title, this.deadline, this.description, todos);
      this.close();
    });
    const cancelBtn = btnRow.createEl("button", { text: "\u53D6\u6D88", cls: "it-btn-cancel" });
    cancelBtn.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  inboxFolder: "00-Inbox",
  archiveFolder: "\u5DF2\u5F52\u6863",
  urgentDays: 3,
  defaultStatus: "\u5F85\u5904\u7406",
  showCompletedTodos: true
};
var InboxTrackerSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Inbox \u76EE\u5F55").setDesc("\u5B58\u653E\u5F85\u529E\u6587\u4EF6\u7684\u76EE\u5F55\u8DEF\u5F84\uFF08\u76F8\u5BF9\u4E8E Vault \u6839\u76EE\u5F55\uFF09").addText(
      (text) => text.setPlaceholder("00-Inbox").setValue(this.plugin.settings.inboxFolder).onChange(async (value) => {
        this.plugin.settings.inboxFolder = value.trim() || DEFAULT_SETTINGS.inboxFolder;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u5F52\u6863\u76EE\u5F55\u540D").setDesc("\u5F52\u6863\u4EFB\u52A1\u65F6\u7684\u5B50\u76EE\u5F55\u540D\u79F0\uFF0C\u4F4D\u4E8E Inbox \u76EE\u5F55\u4E0B").addText(
      (text) => text.setPlaceholder("\u5DF2\u5F52\u6863").setValue(this.plugin.settings.archiveFolder).onChange(async (value) => {
        this.plugin.settings.archiveFolder = value.trim() || DEFAULT_SETTINGS.archiveFolder;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u7D27\u6025\u5929\u6570\u9608\u503C").setDesc("\u622A\u6B62\u65E5\u671F\u5728\u591A\u5C11\u5929\u5185\u6807\u8BB0\u4E3A\u7D27\u6025\uFF08\u6A59\u8272\u63D0\u9192\uFF09").addSlider(
      (slider) => slider.setLimits(1, 14, 1).setValue(this.plugin.settings.urgentDays).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.urgentDays = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u9ED8\u8BA4\u72B6\u6001").setDesc("\u65B0\u5EFA\u4EFB\u52A1\u65F6\u7684\u9ED8\u8BA4\u72B6\u6001\u6587\u672C").addText(
      (text) => text.setPlaceholder("\u5F85\u5904\u7406").setValue(this.plugin.settings.defaultStatus).onChange(async (value) => {
        this.plugin.settings.defaultStatus = value.trim() || DEFAULT_SETTINGS.defaultStatus;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u663E\u793A\u5DF2\u5B8C\u6210\u5F85\u529E").setDesc("\u5728\u5361\u7247\u4E2D\u662F\u5426\u663E\u793A\u5DF2\u52FE\u9009\u7684\u5F85\u529E\u9879").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCompletedTodos).onChange(async (value) => {
        this.plugin.settings.showCompletedTodos = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/main.ts
var InboxTrackerPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_INBOX, (leaf) => new InboxView(leaf, this));
    this.addRibbonIcon("inbox", "Inbox Tracker", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-inbox-tracker",
      name: "Open Inbox Tracker",
      callback: () => this.activateView()
    });
    this.addSettingTab(new InboxTrackerSettingTab(this.app, this));
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_INBOX)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_INBOX, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(VIEW_TYPE_INBOX).forEach((leaf) => {
      if (leaf.view instanceof InboxView) {
        leaf.view.refresh();
      }
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_INBOX);
  }
};
