const STORAGE_KEY = "daylight-tasks-v1";
const THEME_KEY = "daylight-theme-v1";
const categories = ["Work", "Personal", "Study"];
const priorities = { high: 3, medium: 2, low: 1 };
const viewLabels = {
  all: ["All tasks", "Everything you want to get done."],
  today: ["Today", "What’s on your plate today."],
  upcoming: ["Upcoming", "A look at what’s coming up."],
  completed: ["Completed", "Look at everything you’ve accomplished."]
};

const elements = {
  form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"),
  notes: document.querySelector("#task-notes"),
  category: document.querySelector("#task-category"),
  priority: document.querySelector("#task-priority"),
  dueDate: document.querySelector("#task-date"),
  submitLabel: document.querySelector("#submit-label"),
  submitIcon: document.querySelector("#submit-icon"),
  cancelEdit: document.querySelector("#cancel-edit"),
  list: document.querySelector("#task-list"),
  empty: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyMessage: document.querySelector("#empty-message"),
  heading: document.querySelector("#tasks-heading"),
  headingCount: document.querySelector("#heading-count"),
  subtitle: document.querySelector("#section-subtitle"),
  search: document.querySelector("#task-search"),
  sort: document.querySelector("#task-sort"),
  clearCompleted: document.querySelector("#clear-completed"),
  summary: document.querySelector("#list-summary"),
  toast: document.querySelector("#toast"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeIcon: document.querySelector("#theme-icon")
};

let tasks = loadTasks();
let activeView = "all";
let activeCategory = null;
let editingId = null;
let toastTimer;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("Saved tasks are not a list.");
    return parsed.filter((task) =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      categories.includes(task.category) &&
      Object.hasOwn(priorities, task.priority) &&
      typeof task.completed === "boolean"
    );
  } catch (error) {
    window.addEventListener("DOMContentLoaded", () => {
      showToast("Saved tasks couldn’t be loaded. Your browser storage may be unavailable.");
    }, { once: true });
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Could not save tasks:", error);
    showToast("Changes couldn’t be saved. Check your browser storage settings.");
    return false;
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const today = localDateString();
  if (value === today) return "Today";
  if (value < today) return `Overdue · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  const isLight = theme === "light";
  elements.themeIcon.textContent = isLight ? "☾" : "☼";
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} theme`);
  document.querySelector('meta[name="theme-color"]').content = isLight ? "#f4f3f8" : "#10111b";
}

function getVisibleTasks() {
  const today = localDateString();
  const query = elements.search.value.trim().toLocaleLowerCase();
  let visible = tasks.filter((task) => {
    if (activeView === "today" && task.dueDate !== today) return false;
    if (activeView === "upcoming" && (!task.dueDate || task.dueDate <= today || task.completed)) return false;
    if (activeView === "completed" && !task.completed) return false;
    if (activeView !== "completed" && task.completed && activeView !== "all") return false;
    if (activeCategory && task.category !== activeCategory) return false;
    return !query || `${task.title} ${task.notes || ""} ${task.category}`.toLocaleLowerCase().includes(query);
  });

  const sort = elements.sort.value;
  visible = visible.slice().sort((a, b) => {
    if (sort === "alphabetical") return a.title.localeCompare(b.title);
    if (sort === "newest") return b.createdAt - a.createdAt;
    if (sort === "priority") return priorities[b.priority] - priorities[a.priority] || compareDates(a, b);
    if (sort === "date") return compareDates(a, b);
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return priorities[b.priority] - priorities[a.priority] || compareDates(a, b);
  });
  return visible;
}

function compareDates(a, b) {
  if (!a.dueDate && !b.dueDate) return (b.createdAt || 0) - (a.createdAt || 0);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function makeTag(text, className) {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

function renderTask(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " is-completed" : ""}`;
  card.dataset.id = task.id;

  const check = document.createElement("button");
  check.className = "task-check";
  check.type = "button";
  check.dataset.action = "toggle";
  check.setAttribute("aria-label", task.completed ? `Mark ${task.title} as incomplete` : `Complete ${task.title}`);
  check.setAttribute("aria-pressed", String(task.completed));
  if (task.completed) check.textContent = "✓";

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;
  body.append(title);
  if (task.notes) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    body.append(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(makeTag(task.category, `task-tag tag-${task.category.toLowerCase()}`));
  meta.append(makeTag(`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`, `task-tag priority-${task.priority}`));
  if (task.dueDate) {
    const due = makeTag(formatDueDate(task.dueDate), `due-tag${task.dueDate < localDateString() && !task.completed ? " is-overdue" : ""}`);
    meta.append(due);
  }
  body.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.className = "task-action";
  edit.type = "button";
  edit.dataset.action = "edit";
  edit.setAttribute("aria-label", `Edit ${task.title}`);
  edit.title = "Edit task";
  edit.textContent = "✎";
  const remove = document.createElement("button");
  remove.className = "task-action delete";
  remove.type = "button";
  remove.dataset.action = "delete";
  remove.setAttribute("aria-label", `Delete ${task.title}`);
  remove.title = "Delete task";
  remove.textContent = "×";
  actions.append(edit, remove);
  card.append(check, body, actions);
  return card;
}

function render() {
  const today = localDateString();
  const completed = tasks.filter((task) => task.completed).length;
  const todayTasks = tasks.filter((task) => task.dueDate === today);
  const todayDone = todayTasks.filter((task) => task.completed).length;
  const todayOpen = todayTasks.filter((task) => !task.completed).length;
  document.querySelector("#all-count").textContent = String(tasks.filter((task) => !task.completed).length);
  document.querySelector("#today-count").textContent = String(todayOpen);
  document.querySelector("#upcoming-count").textContent = String(tasks.filter((task) => task.dueDate > today && !task.completed).length);
  document.querySelector("#completed-count").textContent = String(completed);
  document.querySelector("#category-work").textContent = String(tasks.filter((task) => task.category === "Work" && !task.completed).length);
  document.querySelector("#category-personal").textContent = String(tasks.filter((task) => task.category === "Personal" && !task.completed).length);
  document.querySelector("#category-study").textContent = String(tasks.filter((task) => task.category === "Study" && !task.completed).length);
  document.querySelector("#progress-done").textContent = String(todayDone);
  document.querySelector("#progress-total").textContent = String(todayTasks.length);
  document.querySelector("#progress-fill").style.width = `${todayTasks.length ? Math.round(todayDone / todayTasks.length * 100) : 0}%`;
  document.querySelector("#progress-caption").textContent = todayTasks.length
    ? todayOpen === 0 ? "You’ve cleared today. Lovely work!" : `${todayOpen} ${todayOpen === 1 ? "task" : "tasks"} left for today`
    : "A fresh start. You’ve got this!";

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView && !activeCategory);
  });
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === activeCategory);
  });

  const [label, description] = activeCategory ? [activeCategory, `Your ${activeCategory.toLowerCase()} tasks.`] : viewLabels[activeView];
  elements.heading.childNodes[0].textContent = `${label} `;
  elements.subtitle.textContent = description;
  const visible = getVisibleTasks();
  elements.headingCount.textContent = String(visible.length);
  elements.list.replaceChildren(...visible.map(renderTask));
  elements.list.hidden = visible.length === 0;
  elements.empty.hidden = visible.length !== 0;
  elements.emptyTitle.textContent = elements.search.value.trim()
    ? "No matching tasks."
    : activeView === "completed" ? "Nothing checked off just yet." : "A little room to breathe.";
  elements.emptyMessage.textContent = elements.search.value.trim()
    ? "Try a different search or clear the search box."
    : activeView === "completed" ? "Finish a task and it’ll show up here." : "Add your first task above and make it happen.";
  document.querySelector("#empty-add").hidden = activeView === "completed" || Boolean(elements.search.value.trim());
  elements.summary.textContent = tasks.length === 0
    ? "You’re doing great ✨"
    : `${tasks.length - completed} ${tasks.length - completed === 1 ? "task" : "tasks"} to go · ${completed} completed`;
  elements.clearCompleted.disabled = completed === 0;
}

function resetForm() {
  editingId = null;
  elements.form.reset();
  elements.category.value = "Personal";
  elements.priority.value = "medium";
  elements.submitLabel.textContent = "Add task";
  elements.submitIcon.textContent = "＋";
  elements.cancelEdit.hidden = true;
  elements.title.focus();
}

function beginEdit(task) {
  editingId = task.id;
  elements.title.value = task.title;
  elements.notes.value = task.notes || "";
  elements.category.value = task.category;
  elements.priority.value = task.priority;
  elements.dueDate.value = task.dueDate || "";
  elements.submitLabel.textContent = "Save changes";
  elements.submitIcon.textContent = "✓";
  elements.cancelEdit.hidden = false;
  elements.title.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.title.value.trim();
  if (!title) {
    elements.title.focus();
    return;
  }
  const values = {
    title,
    notes: elements.notes.value.trim(),
    category: elements.category.value,
    priority: elements.priority.value,
    dueDate: elements.dueDate.value
  };
  if (editingId) {
    tasks = tasks.map((task) => task.id === editingId ? { ...task, ...values } : task);
    showToast("Task updated.");
  } else {
    tasks.unshift({ id: crypto.randomUUID(), ...values, completed: false, createdAt: Date.now() });
    showToast("Task added. You’ve got this!");
  }
  saveTasks();
  resetForm();
  render();
});

elements.cancelEdit.addEventListener("click", resetForm);
document.querySelector("#empty-add").addEventListener("click", () => elements.title.focus());
elements.search.addEventListener("input", render);
elements.sort.addEventListener("change", render);
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    activeCategory = null;
    render();
  });
});
document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = activeCategory === button.dataset.category ? null : button.dataset.category;
    activeView = "all";
    render();
  });
});
elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-id]");
  const task = tasks.find((item) => item.id === card.dataset.id);
  if (!task) return;
  if (button.dataset.action === "toggle") {
    task.completed = !task.completed;
    saveTasks();
    render();
  } else if (button.dataset.action === "edit") {
    beginEdit(task);
  } else if (button.dataset.action === "delete") {
    tasks = tasks.filter((item) => item.id !== task.id);
    if (editingId === task.id) resetForm();
    saveTasks();
    render();
    showToast("Task deleted.");
  }
});
elements.clearCompleted.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  render();
  showToast("Completed tasks cleared.");
});
elements.themeToggle.addEventListener("click", () => {
  const theme = document.body.dataset.theme === "light" ? "dark" : "light";
  setTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Could not save theme preference:", error);
    showToast("Theme changed, but your preference couldn’t be saved.");
  }
});

document.querySelector("#today-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
});
const hour = new Date().getHours();
document.querySelector("#greeting").innerHTML = hour < 12
  ? "Good morning, <span>you’ve got this.</span>"
  : hour < 18 ? "Make today <span>a good one.</span>" : "Good evening, <span>you made it.</span>";
try {
  setTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
} catch (error) {
  console.error("Could not load theme preference:", error);
  setTheme("dark");
}
render();
