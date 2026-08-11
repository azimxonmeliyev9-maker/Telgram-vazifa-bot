/* ==========================================================================
   VAZIFA & HARAJATLAR APP - APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 1. STATE & LOCALSTORAGE MANAGEMENT
    // ----------------------------------------------------------------------
    const STORAGE_KEYS = {
        PASSWORD: 'vazifa_password',
        IS_LOGGED: 'vazifa_is_logged',
        EXPENSES: 'vazifa_expenses',
        TASKS: 'vazifa_tasks',
        BUDGET: 'vazifa_budget'
    };

    // Initial state setup
    let appState = {
        password: localStorage.getItem(STORAGE_KEYS.PASSWORD) || '123',
        isLoggedIn: sessionStorage.getItem(STORAGE_KEYS.IS_LOGGED) === 'true',
        expenses: JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES)) || getInitialExpenses(),
        tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || getInitialTasks(),
        budget: parseFloat(localStorage.getItem(STORAGE_KEYS.BUDGET)) || 5000000,
        activeTab: 'dashboard',
        taskFilter: 'all'
    };

    let categoryChart = null;

    // Default Seed Data
    function getInitialExpenses() {
        return [
            { id: '1', title: "Supermarket xaridlari", amount: 350000, category: 'Oziq-ovqat', date: getTodayStr(), paymentMethod: 'Karta', createdAt: Date.now() },
            { id: '2', title: "Taksi va Metropoliten", amount: 45000, category: 'Transport', date: getTodayStr(), paymentMethod: 'Click/Payme', createdAt: Date.now() },
            { id: '3', title: "Elektr energiyasi to'lovi", amount: 180000, category: 'Kommunal', date: getTodayStr(), paymentMethod: 'Click/Payme', createdAt: Date.now() }
        ];
    }

    function getInitialTasks() {
        return [
            { id: 't1', title: "Loyiha hisobotini tayyorlash", priority: 'high', category: 'Ish', date: getTodayStr(), completed: false, createdAt: Date.now() },
            { id: 't2', title: "Ingliz tili darslarini takrorlash", priority: 'medium', category: "O'qish", date: getTodayStr(), completed: true, createdAt: Date.now() },
            { id: 't3', title: "Sport zalida mashg'ulot o'tkazish", priority: 'medium', category: 'Sport', date: getTodayStr(), completed: false, createdAt: Date.now() }
        ];
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(appState.expenses));
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(appState.tasks));
        localStorage.setItem(STORAGE_KEYS.BUDGET, appState.budget.toString());
        localStorage.setItem(STORAGE_KEYS.PASSWORD, appState.password);
    }

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    // ----------------------------------------------------------------------
    // 2. DOM ELEMENTS SELECTION
    // ----------------------------------------------------------------------
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const loginForm = document.getElementById('login-form');
    const loginPassInput = document.getElementById('login-pass');
    const loginError = document.getElementById('login-error');
    const togglePassBtn = document.getElementById('toggle-pass-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Navigation & Tabs
    const navItems = document.querySelectorAll('.nav-item');
    const tabPages = document.querySelectorAll('.tab-page');
    const pageTitle = document.getElementById('page-title');
    const currentDateDisplay = document.getElementById('current-date-display');

    // Dashboard Elements
    const dashTotalExpense = document.getElementById('dash-total-expense');
    const dashExpenseCount = document.getElementById('dash-expense-count');
    const dashBudgetDisplay = document.getElementById('dash-budget-display');
    const dashBudgetProgress = document.getElementById('dash-budget-progress');
    const dashBudgetRemaining = document.getElementById('dash-budget-remaining');
    const dashTaskRatio = document.getElementById('dash-task-ratio');
    const dashTaskProgress = document.getElementById('dash-task-progress');
    const dashTaskPercent = document.getElementById('dash-task-percent');
    const dashTodayTasks = document.getElementById('dash-today-tasks');
    const dashPendingTasks = document.getElementById('dash-pending-tasks');
    const dashRecentTasksList = document.getElementById('dash-recent-tasks-list');

    // Expense Elements
    const expensesTableBody = document.getElementById('expenses-table-body');
    const expensesEmptyState = document.getElementById('expenses-empty-state');
    const expenseSearch = document.getElementById('expense-search');
    const expenseFilterCategory = document.getElementById('expense-filter-category');

    // Task Elements
    const tasksList = document.getElementById('tasks-list');
    const tasksEmptyState = document.getElementById('tasks-empty-state');
    const taskTabBtns = document.querySelectorAll('.task-tab-btn');
    const bannerProgressNum = document.getElementById('banner-progress-num');

    // Settings Elements
    const changePassForm = document.getElementById('change-pass-form');
    const changeBudgetForm = document.getElementById('change-budget-form');
    const budgetLimitInput = document.getElementById('budget-limit-input');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    const resetAllBtn = document.getElementById('reset-all-btn');

    // Modals
    const expenseModal = document.getElementById('expense-modal');
    const taskModal = document.getElementById('task-modal');
    const openExpenseModalBtn = document.getElementById('open-expense-modal');
    const openTaskModalBtn = document.getElementById('open-task-modal');
    const quickAddExpenseBtn = document.getElementById('quick-add-expense-btn');
    const quickAddTaskBtn = document.getElementById('quick-add-task-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');
    const expenseForm = document.getElementById('expense-form');
    const taskForm = document.getElementById('task-form');

    // ----------------------------------------------------------------------
    // 3. AUTHENTICATION LOGIC & TELEGRAM WEB APP
    // ----------------------------------------------------------------------
    function initTelegramWebApp() {
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();

                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const tgUser = tg.initDataUnsafe.user;
                    const nameDisplay = document.getElementById('user-display-name');
                    if (nameDisplay) {
                        nameDisplay.textContent = tgUser.first_name || tgUser.username || 'Telegram User';
                    }
                    const loginUserInput = document.getElementById('login-user');
                    if (loginUserInput) {
                        loginUserInput.value = tgUser.username || tgUser.first_name || 'admin';
                    }
                }
            } catch (err) {
                console.log("Telegram WebApp init error:", err);
            }
        }
    }

    function initAuth() {
        initTelegramWebApp();
        if (appState.isLoggedIn) {
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            renderAll();
        } else {
            loginScreen.classList.remove('hidden');
            appScreen.classList.add('hidden');
        }
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputPass = loginPassInput.value.trim();

        if (inputPass === appState.password) {
            appState.isLoggedIn = true;
            sessionStorage.setItem(STORAGE_KEYS.IS_LOGGED, 'true');
            loginError.classList.add('hidden');
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            showToast("Tizimga muvaffaqiyatli kirdingiz!", 'success');
            renderAll();
        } else {
            loginError.classList.remove('hidden');
            loginPassInput.value = '';
            loginPassInput.focus();
        }
    });

    if (togglePassBtn) {
        togglePassBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentType = loginPassInput.getAttribute('type');
            if (currentType === 'password') {
                loginPassInput.setAttribute('type', 'text');
                togglePassBtn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
            } else {
                loginPassInput.setAttribute('type', 'password');
                togglePassBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            appState.isLoggedIn = false;
            sessionStorage.removeItem(STORAGE_KEYS.IS_LOGGED);
            loginScreen.classList.remove('hidden');
            appScreen.classList.add('hidden');
            showToast("Tizimdan chiqildi", 'info');
        });
    }

    // ----------------------------------------------------------------------
    // 4. NAVIGATION & TABS
    // ----------------------------------------------------------------------
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.dataset.tab;
            navItems.forEach(n => n.classList.remove('active'));
            tabPages.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const targetPage = document.getElementById(`tab-${targetTab}`);
            if (targetPage) targetPage.classList.add('active');
            appState.activeTab = targetTab;

            // Page title update
            const titles = {
                dashboard: 'Boshqaruv Paneli',
                expenses: 'Harajatlar Boshqaruvi',
                tasks: 'Kundalik Vazifalar',
                settings: 'Sozlamalar va Zaxira'
            };
            if (pageTitle) pageTitle.textContent = titles[targetTab] || 'Boshqaruv';

            if (targetTab === 'dashboard') {
                renderCharts();
            }
        });
    });

    function updateDateDisplay() {
        if (!currentDateDisplay) return;
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        currentDateDisplay.textContent = now.toLocaleDateString('uz-UZ', options);
    }

    // ----------------------------------------------------------------------
    // 5. RENDER FUNCTIONS
    // ----------------------------------------------------------------------
    function renderAll() {
        updateDateDisplay();
        renderDashboardMetrics();
        renderExpensesTable();
        renderTasksList();
        renderCharts();
        if (budgetLimitInput) budgetLimitInput.value = appState.budget;
    }

    // DASHBOARD METRICS
    function renderDashboardMetrics() {
        if (!dashTotalExpense) return;
        
        // Expense calculations
        const totalExp = appState.expenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        dashTotalExpense.textContent = formatCurrency(totalExp);
        dashExpenseCount.textContent = `${appState.expenses.length} ta bitim`;

        // Budget calculations
        dashBudgetDisplay.textContent = formatCurrency(appState.budget);
        const budgetPercent = Math.min(Math.round((totalExp / appState.budget) * 100), 100);
        dashBudgetProgress.style.width = `${budgetPercent}%`;
        const remainingBudget = appState.budget - totalExp;
        dashBudgetRemaining.textContent = remainingBudget >= 0 
            ? `Qolgan: ${formatCurrency(remainingBudget)}` 
            : `Limit oshdi: ${formatCurrency(Math.abs(remainingBudget))}`;

        if (budgetPercent > 90) {
            dashBudgetProgress.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else {
            dashBudgetProgress.style.background = 'linear-gradient(90deg, var(--accent-cyan), var(--primary))';
        }

        // Task calculations
        const totalTasks = appState.tasks.length;
        const completedTasks = appState.tasks.filter(t => t.completed).length;
        const pendingTasks = totalTasks - completedTasks;
        const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        dashTaskRatio.textContent = `${completedTasks} / ${totalTasks}`;
        dashTaskProgress.style.width = `${taskPercent}%`;
        dashTaskPercent.textContent = `${taskPercent}% bajarildi`;

        const todayStr = getTodayStr();
        const todayTasksCount = appState.tasks.filter(t => t.date === todayStr).length;
        dashTodayTasks.textContent = `${todayTasksCount} ta`;
        dashPendingTasks.textContent = `Kutilayotgan: ${pendingTasks} ta`;

        if (bannerProgressNum) bannerProgressNum.textContent = `${taskPercent}%`;

        // Recent tasks preview
        if (dashRecentTasksList) {
            dashRecentTasksList.innerHTML = '';
            const recentTasks = appState.tasks.slice(-4).reverse();
            if (recentTasks.length === 0) {
                dashRecentTasksList.innerHTML = '<li class="dash-item"><span style="color:var(--text-muted)">Vazifalar mavjud emas</span></li>';
            } else {
                recentTasks.forEach(task => {
                    const li = document.createElement('li');
                    li.className = 'dash-item';
                    li.innerHTML = `
                        <span><i class="${task.completed ? 'fa-solid fa-circle-check text-success' : 'fa-regular fa-circle'}"></i> ${escapeHtml(task.title)}</span>
                        <span class="priority-badge badge-${task.priority}">${task.priority}</span>
                    `;
                    dashRecentTasksList.appendChild(li);
                });
            }
        }
    }

    // EXPENSES TABLE
    function renderExpensesTable() {
        if (!expensesTableBody) return;
        const searchTerm = expenseSearch ? expenseSearch.value.toLowerCase().trim() : '';
        const categoryFilter = expenseFilterCategory ? expenseFilterCategory.value : 'all';

        const filtered = appState.expenses.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm);
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        expensesTableBody.innerHTML = '';

        if (filtered.length === 0) {
            if (expensesEmptyState) expensesEmptyState.classList.remove('hidden');
        } else {
            if (expensesEmptyState) expensesEmptyState.classList.add('hidden');
            filtered.forEach(exp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(exp.title)}</strong></td>
                    <td><span class="category-tag">${exp.category}</span></td>
                    <td>${exp.date}</td>
                    <td>${exp.paymentMethod || 'Naqd'}</td>
                    <td class="amount-text">-${formatCurrency(exp.amount)}</td>
                    <td>
                        <button class="btn-icon danger-icon delete-expense-btn" data-id="${exp.id}" title="O'chirish">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                expensesTableBody.appendChild(tr);
            });
        }

        // Attach delete listeners
        document.querySelectorAll('.delete-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteExpense(id);
            });
        });
    }

    // TASKS LIST
    function renderTasksList() {
        if (!tasksList) return;
        const filter = appState.taskFilter;
        const filteredTasks = appState.tasks.filter(t => {
            if (filter === 'pending') return !t.completed;
            if (filter === 'completed') return t.completed;
            return true;
        });

        tasksList.innerHTML = '';

        if (filteredTasks.length === 0) {
            if (tasksEmptyState) tasksEmptyState.classList.remove('hidden');
        } else {
            if (tasksEmptyState) tasksEmptyState.classList.add('hidden');
            filteredTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = `task-card glass-panel priority-${task.priority} ${task.completed ? 'completed' : ''}`;
                card.innerHTML = `
                    <div class="task-top">
                        <div class="custom-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}">
                            ${task.completed ? '<i class="fa-solid fa-check"></i>' : ''}
                        </div>
                        <div style="flex:1">
                            <div class="task-title">${escapeHtml(task.title)}</div>
                            <div class="task-meta">
                                <span><i class="fa-regular fa-folder"></i> ${task.category}</span>
                                <span><i class="fa-regular fa-calendar"></i> ${task.date}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="priority-badge badge-${task.priority}">${task.priority === 'high' ? '🔴 Yuqori' : task.priority === 'medium' ? "🟡 O'rta" : '🟢 Past'}</span>
                        <button class="btn-icon danger-icon delete-task-btn" data-id="${task.id}" title="O'chirish">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
                tasksList.appendChild(card);
            });
        }

        // Checkbox click handlers
        document.querySelectorAll('.custom-checkbox').forEach(cb => {
            cb.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                toggleTask(id);
            });
        });

        // Delete task handlers
        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteTask(id);
            });
        });
    }

    // CHART.JS RENDER
    function renderCharts() {
        const ctx = document.getElementById('expenseCategoryChart');
        if (!ctx || typeof Chart === 'undefined') return;

        // Group expenses by category
        const categoryTotals = {};
        appState.expenses.forEach(exp => {
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
        });

        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);

        if (categoryChart) {
            categoryChart.destroy();
        }

        if (labels.length === 0) {
            labels.push("Ma'lumot yo'q");
            data.push(1);
        }

        try {
            categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'
                        ],
                        borderWidth: 2,
                        borderColor: '#090d16'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                        }
                    }
                }
            });
        } catch (err) {
            console.error("Chart error:", err);
        }
    }

    // ----------------------------------------------------------------------
    // 6. ACTIONS & EVENT HANDLERS
    // ----------------------------------------------------------------------

    // ADD EXPENSE
    if (expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newExpense = {
                id: Date.now().toString(),
                title: document.getElementById('exp-title').value.trim(),
                amount: parseFloat(document.getElementById('exp-amount').value),
                category: document.getElementById('exp-category').value,
                date: document.getElementById('exp-date').value || getTodayStr(),
                paymentMethod: document.getElementById('exp-payment').value,
                createdAt: Date.now()
            };

            appState.expenses.unshift(newExpense);
            saveState();
            renderAll();
            closeModals();
            expenseForm.reset();
            showToast("Yangi harajat qo'shildi!", 'success');
        });
    }

    function deleteExpense(id) {
        appState.expenses = appState.expenses.filter(e => e.id !== id);
        saveState();
        renderAll();
        showToast("Harajat o'chirildi", 'info');
    }

    // ADD TASK
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newTask = {
                id: Date.now().toString(),
                title: document.getElementById('task-title').value.trim(),
                priority: document.getElementById('task-priority').value,
                category: document.getElementById('task-category').value,
                date: document.getElementById('task-date').value || getTodayStr(),
                completed: false,
                createdAt: Date.now()
            };

            appState.tasks.unshift(newTask);
            saveState();
            renderAll();
            closeModals();
            taskForm.reset();
            showToast("Yangi vazifa qo'shildi!", 'success');
        });
    }

    function toggleTask(id) {
        const task = appState.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            if (task.completed && typeof confetti === 'function') {
                confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
            }
            saveState();
            renderAll();
        }
    }

    function deleteTask(id) {
        appState.tasks = appState.tasks.filter(t => t.id !== id);
        saveState();
        renderAll();
        showToast("Vazifa o'chirildi", 'info');
    }

    // TASK FILTER TAB BUTTONS
    taskTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            taskTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appState.taskFilter = btn.dataset.filter;
            renderTasksList();
        });
    });

    // SEARCH & CATEGORY FILTER FOR EXPENSES
    if (expenseSearch) expenseSearch.addEventListener('input', renderExpensesTable);
    if (expenseFilterCategory) expenseFilterCategory.addEventListener('change', renderExpensesTable);

    // SETTINGS FORMS
    if (changePassForm) {
        changePassForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const curr = document.getElementById('curr-pass-input').value;
            const newPass = document.getElementById('new-pass-input').value;

            if (curr !== appState.password) {
                showToast("Hozirgi parol noto'g'ri!", 'error');
                return;
            }

            appState.password = newPass;
            saveState();
            changePassForm.reset();
            showToast("Parol muvaffaqiyatli o'zgartirildi!", 'success');
        });
    }

    if (changeBudgetForm) {
        changeBudgetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newBudget = parseFloat(budgetLimitInput.value);
            if (newBudget > 0) {
                appState.budget = newBudget;
                saveState();
                renderAll();
                showToast("Oylik budjet saqlandi!", 'success');
            }
        });
    }

    // BACKUP & EXPORT/IMPORT
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `vazifa_harajat_backup_${getTodayStr()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast("Ma'lumotlar yuklab olindi!", 'success');
        });
    }

    if (importFileInput) {
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (importedData.expenses && importedData.tasks) {
                        appState.expenses = importedData.expenses;
                        appState.tasks = importedData.tasks;
                        if (importedData.budget) appState.budget = importedData.budget;
                        saveState();
                        renderAll();
                        showToast("Ma'lumotlar muvaffaqiyatli tiklandi!", 'success');
                    } else {
                        showToast("Fayl formati noto'g'ri!", 'error');
                    }
                } catch (err) {
                    showToast("Faylni o'qishda xatolik!", 'error');
                }
            };
            reader.readAsText(file);
        });
    }

    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            if (confirm("Haqiqatdan ham barcha harajatlar va vazifalarni o'chirmoqchimisiz?")) {
                appState.expenses = [];
                appState.tasks = [];
                saveState();
                renderAll();
                showToast("Barcha ma'lumotlar tozalandi!", 'info');
            }
        });
    }

    // ----------------------------------------------------------------------
    // 7. MODAL CONTROLS & UTILS
    // ----------------------------------------------------------------------
    if (openExpenseModalBtn) openExpenseModalBtn.addEventListener('click', () => expenseModal.classList.remove('hidden'));
    if (quickAddExpenseBtn) quickAddExpenseBtn.addEventListener('click', () => expenseModal.classList.remove('hidden'));

    if (openTaskModalBtn) openTaskModalBtn.addEventListener('click', () => taskModal.classList.remove('hidden'));
    if (quickAddTaskBtn) quickAddTaskBtn.addEventListener('click', () => taskModal.classList.remove('hidden'));

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    function closeModals() {
        if (expenseModal) expenseModal.classList.add('hidden');
        if (taskModal) taskModal.classList.add('hidden');
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            info: 'fa-circle-info'
        };
        toast.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-bell'}"></i> <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Default dates for modals
    const expDate = document.getElementById('exp-date');
    const taskDate = document.getElementById('task-date');
    if (expDate) expDate.value = getTodayStr();
    if (taskDate) taskDate.value = getTodayStr();

    // Start App
    initAuth();
});
