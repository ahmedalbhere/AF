// script.js — إصدار مطور: حسابات لحظية + هيكل تمويل (عن السنة الأحدث) + مصادر/استخدامات
// تأكد أن index.html يحتوي على العناصر الافتراضية كما أرسلتها مسبقاً.

// --------------------------- مساعدة عامة ---------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toNum(v){ const n = parseFloat(v); return isFinite(n) ? n : 0; }

// --------------------------- القوائم - إضافة صفوف وحذف ---------------------------
function addRowAfterSection(sectionText, datasetCategory, tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    // find the section header tr that contains the arabic text
    const sectionHeaders = $$(`#${tableBodyId} .section-header`);
    let header = sectionHeaders.find(h => h.textContent.includes(sectionText));
    if (!header) header = tbody.querySelector("tr.section-header"); // fallback

    const newRow = document.createElement("tr");
    newRow.setAttribute("data-category", datasetCategory);
    newRow.innerHTML = `
        <td><input type="text" class="item-name" placeholder="اسم البند"></td>
        <td><input type="number" class="balance-input" data-year="year1" placeholder="0"></td>
        <td><input type="number" class="balance-input" data-year="year2" placeholder="0"></td>
        <td><button type="button" class="btn btn-danger btn-small remove-row">حذف</button></td>
    `;
    header.insertAdjacentElement("afterend", newRow);
    attachInputListenersToRow(newRow);
}

document.getElementById("add-current-asset").onclick = () => addRowAfterSection("الأصول المتداولة", "current-assets", "balance-body");
document.getElementById("add-fixed-asset").onclick = () => addRowAfterSection("الأصول الثابتة", "fixed-assets", "balance-body");
document.getElementById("add-liability").onclick = () => addRowAfterSection("الخصوم", "current-liabilities", "balance-body"); // generic
document.getElementById("add-income-item").onclick = () => addRowAfterSection("الإيرادات", "revenue", "income-body");
document.getElementById("add-expense-item").onclick = () => addRowAfterSection("المصروفات", "expenses", "income-body");

// حذف صف
document.addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-row")) {
        const tr = e.target.closest("tr");
        tr.remove();
        recalcAll();
    }
});

// --------------------------- تهيئة تلقائية لربط المستمعين ---------------------------
function attachInputListenersToRow(row) {
    // أي input داخل هذا الصف
    const inputs = $$("input", row);
    inputs.forEach(inp => {
        inp.addEventListener("input", () => recalcAll());
    });
}

function attachListenersToExistingRows() {
    // تهيئة لجميع الصفوف الحالية في الميزانية وقائمة الدخل
    $$("tr[data-category]").forEach(r => attachInputListenersToRow(r));
    // also specific inputs that might not be in rows
    $$("input").forEach(i => {
        if (!i._hasListener) {
            i.addEventListener("input", () => recalcAll());
            i._hasListener = true;
        }
    });
}
attachListenersToExistingRows();

// --------------------------- قراءة الجداول ---------------------------
function readBalanceRows(yearKey) {
    // return array of {category, name, value}
    const rows = $$(`#balance-body tr`);
    const result = [];
    rows.forEach(row => {
        if (row.classList.contains("section-header") || row.classList.contains("total-row") || row.classList.contains("calculated-row")) return;
        const cat = row.dataset.category || "";
        const name = row.querySelector(".item-name")?.value || "";
        const val = toNum(row.querySelector(`[data-year='${yearKey}']`)?.value);
        result.push({ category: cat, name, value: val, row });
    });
    return result;
}

function readIncomeRows(yearKey) {
    const rows = $$(`#income-body tr`);
    const result = [];
    rows.forEach(row => {
        if (row.classList.contains("section-header") || row.classList.contains("total-row") || row.classList.contains("calculated-row")) return;
        const cat = row.dataset.category || "";
        const name = row.querySelector(".item-name")?.value || "";
        const val = toNum(row.querySelector(`[data-year='${yearKey}']`)?.value);
        result.push({ category: cat, name, value: val, row });
    });
    return result;
}

// --------------------------- حساب المجاميع في الميزانية (لحظي) ---------------------------
function sumCategoryBalance(cat, yearKey) {
    const rows = $$(`#balance-body tr[data-category='${cat}']`);
    return rows.reduce((s, r) => s + toNum(r.querySelector(`[data-year='${yearKey}']`)?.value), 0);
}

function computeBalanceTotals(yearKey) {
    // استخدم الفئات المتوقعة: current-assets, fixed-assets, current-liabilities, long-liabilities, equity
    const currentAssets = sumCategoryBalance("current-assets", yearKey);
    const fixedAssets = sumCategoryBalance("fixed-assets", yearKey);
    const totalAssets = currentAssets + fixedAssets;

    const currentLiabilities = sumCategoryBalance("current-liabilities", yearKey);
    const longLiabilities = sumCategoryBalance("long-liabilities", yearKey);
    const totalLiabilities = currentLiabilities + longLiabilities;

    const equity = sumCategoryBalance("equity", yearKey);
    const totalLiabilitiesEquity = totalLiabilities + equity;

    return {
        currentAssets, fixedAssets, totalAssets,
        currentLiabilities, longLiabilities, totalLiabilities,
        equity, totalLiabilitiesEquity
    };
}

// --------------------------- حسابات قائمة الدخل (لحظي) ---------------------------
function computeIncomeTotals(yearKey) {
    // نفترض وجود فئات revenue, cogs, expenses, other
    const revenue = sumCategoryIncome("revenue", yearKey);
    const cogs = sumCategoryIncome("cogs", yearKey);
    const expenses = sumCategoryIncome("expenses", yearKey);
    const other = sumCategoryIncome("other", yearKey);
    const grossProfit = revenue - cogs;
    const operatingProfit = grossProfit - expenses;
    const netProfit = operatingProfit + other;

    return { revenue, cogs, expenses, other, grossProfit, operatingProfit, netProfit };
}

function sumCategoryIncome(cat, yearKey) {
    const rows = $$(`#income-body tr[data-category='${cat}']`);
    return rows.reduce((s, r) => s + toNum(r.querySelector(`[data-year='${yearKey}']`)?.value), 0);
}

// --------------------------- حساب المخزون (محاولة ذكية) ---------------------------
function detectInventory(yearKey) {
    // نجمع أي بند في الأصول المتداولة يحتوي على كلمة "مخزون" أو "المخزون"
    const rows = $$(`#balance-body tr[data-category='current-assets']`);
    let inv = 0;
    rows.forEach(r => {
        const name = (r.querySelector(".item-name")?.value || "").toLowerCase();
        if (name.includes("مخزون")) inv += toNum(r.querySelector(`[data-year='${yearKey}']`)?.value);
    });
    return inv;
}

// --------------------------- حساب النسب المالية و هيكل التمويل (من السنة الأحدث) ---------------------------
function computeRatiosForLatest() {
    const y2 = 'year2'; // حسب اختيارك: السنة الأحدث
    const b = computeBalanceTotals(y2);
    const inventory = detectInventory(y2);
    const currentRatio = b.currentLiabilities === 0 ? null : (b.currentAssets / b.currentLiabilities);
    const quickRatio = b.currentLiabilities === 0 ? null : ((b.currentAssets - inventory) / b.currentLiabilities);

    const totalDebt = b.totalLiabilities; // الخصوم الكلية
    const totalEquity = b.equity;
    const totalAssets = b.totalAssets;
    const debtToEquity = totalEquity === 0 ? null : (totalDebt / totalEquity);
    const debtToAssets = totalAssets === 0 ? null : (totalDebt / totalAssets);
    const equityRatio = totalAssets === 0 ? null : (totalEquity / totalAssets);

    return {
        currentRatio, quickRatio, inventory,
        debtToEquity, debtToAssets, equityRatio,
        totals: b
    };
}

// --------------------------- مصادر و استخدامات بين السنتين ---------------------------
function computeSourcesUses() {
    const y1 = 'year1', y2 = 'year2';
    // سنقيس التغير في مجموعات: إجمالي الأصول، الأصول المتداولة، الأصول الثابتة، إجمالي الخصوم، حقوق الملكية
    const assetsY1 = computeBalanceTotals(y1).totalAssets;
    const assetsY2 = computeBalanceTotals(y2).totalAssets;
    const currentY1 = computeBalanceTotals(y1).currentAssets;
    const currentY2 = computeBalanceTotals(y2).currentAssets;
    const fixedY1 = computeBalanceTotals(y1).fixedAssets;
    const fixedY2 = computeBalanceTotals(y2).fixedAssets;

    const totalLiabY1 = computeBalanceTotals(y1).totalLiabilities;
    const totalLiabY2 = computeBalanceTotals(y2).totalLiabilities;
    const equityY1 = computeBalanceTotals(y1).equity;
    const equityY2 = computeBalanceTotals(y2).equity;

    const diffs = [
        { name: "إجمالي الأصول", diff: assetsY2 - assetsY1, type: "asset" },
        { name: "الأصول المتداولة", diff: currentY2 - currentY1, type: "asset" },
        { name: "الأصول الثابتة", diff: fixedY2 - fixedY1, type: "asset" },
        { name: "إجمالي الخصوم", diff: totalLiabY2 - totalLiabY1, type: "liability" },
        { name: "حقوق الملكية", diff: equityY2 - equityY1, type: "equity" }
    ];

    // تفسير: زيادة الأصل => استخدام، نقص الأصل => مصدر
    // زيادة الخصوم => مصدر، نقصان الخصوم => استخدام
    // زيادة حقوق الملكية => مصدر
    const interpreted = diffs.map(d => {
        let role = "";
        if (d.type === "asset") {
            role = d.diff > 0 ? "استخدام" : (d.diff < 0 ? "مصدر" : "ثبات");
        } else if (d.type === "liability") {
            role = d.diff > 0 ? "مصدر" : (d.diff < 0 ? "استخدام" : "ثبات");
        } else if (d.type === "equity") {
            role = d.diff > 0 ? "مصدر" : (d.diff < 0 ? "استخدام" : "ثبات");
        }
        return { ...d, role };
    });

    return interpreted;
}

// --------------------------- عرض النتائج في الواجهة ---------------------------
function displayBalanceTotals() {
    // نعرض إجمالي الأصول وإجمالي الخصوم + حقوق الملكية لكل سنة
    const ta1 = computeBalanceTotals('year1').totalAssets;
    const ta2 = computeBalanceTotals('year2').totalAssets;
    const tle1 = computeBalanceTotals('year1').totalLiabilitiesEquity;
    const tle2 = computeBalanceTotals('year2').totalLiabilitiesEquity;

    $("#total-assets-year1").textContent = formatNumber(ta1);
    $("#total-assets-year2").textContent = formatNumber(ta2);
    $("#total-liabilities-equity-year1").textContent = formatNumber(tle1);
    $("#total-liabilities-equity-year2").textContent = formatNumber(tle2);
}

function formatNumber(n){
    if (n === null || n === undefined) return "-";
    return Number(n).toLocaleString('ar-EG');
}

function clearResultsContainer() {
    $("#results-container").innerHTML = "";
}

function displayProfitCards(incomeTotals) {
    const container = $("#results-container");
    // رتب: مجمل الربح، الربح التشغيلي، صافي الربح، الإيرادات، تكلفة المبيعات
    const grid = document.createElement("div");
    grid.className = "results-grid";
    const items = [
        { name: "إجمالي الإيرادات (السنة الأحدث)", value: formatNumber(incomeTotals.revenue) },
        { name: "تكلفة البضاعة المباعة (السنة الأحدث)", value: formatNumber(incomeTotals.cogs) },
        { name: "مجمل الربح", value: formatNumber(incomeTotals.grossProfit) },
        { name: "المصروفات التشغيلية", value: formatNumber(incomeTotals.expenses) },
        { name: "الربح التشغيلي", value: formatNumber(incomeTotals.operatingProfit) },
        { name: "الإيرادات/المصروفات الأخرى", value: formatNumber(incomeTotals.other) },
        { name: "صافي الربح", value: formatNumber(incomeTotals.netProfit) }
    ];
    items.forEach(it => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `<h3>${it.name}</h3><div class="result-value">${it.value}</div>`;
        grid.appendChild(card);
    });
    container.appendChild(grid);
}

function displayRatiosCards(ratioObj) {
    const container = $("#results-container");
    const grid = document.createElement("div");
    grid.className = "results-grid";
    const makeVal = v => (v === null ? "—" : (Math.round(v * 100) / 100));

    const items = [
        { name: "نسبة التداول (Current Ratio)", value: ratioObj.currentRatio === null ? "—" : ratioObj.currentRatio.toFixed(2) },
        { name: "النسبة السريعة (Quick Ratio)", value: ratioObj.quickRatio === null ? "—" : ratioObj.quickRatio.toFixed(2) },
        { name: "نسبة الديون إلى حقوق الملكية (Debt/Equity)", value: ratioObj.debtToEquity === null ? "—" : ratioObj.debtToEquity.toFixed(2) },
        { name: "نسبة الديون إلى الأصول (Debt/Assets)", value: ratioObj.debtToAssets === null ? "—" : (ratioObj.debtToAssets*100).toFixed(2) + " %" },
        { name: "نسبة حقوق الملكية من إجمالي التمويل (Equity Ratio)", value: ratioObj.equityRatio === null ? "—" : (ratioObj.equityRatio*100).toFixed(2) + " %" },
        { name: "المخزون (التقدير)", value: formatNumber(ratioObj.inventory) }
    ];

    items.forEach(it => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `<h3>${it.name}</h3><div class="result-value">${it.value}</div>`;
        grid.appendChild(card);
    });
    container.appendChild(grid);
}

function displaySourcesUsesTable(sourcesUses) {
    const container = $("#results-container");
    const table = document.createElement("table");
    table.className = "analysis-table";
    table.innerHTML = `
        <thead>
            <tr>
                <th>البند</th>
                <th>التغير (السنة2 - السنة1)</th>
                <th>تفسير</th>
            </tr>
        </thead>
        <tbody>
            ${sourcesUses.map(su => `
                <tr>
                    <td>${su.name}</td>
                    <td>${formatNumber(su.diff)}</td>
                    <td>${su.role}</td>
                </tr>
            `).join("")}
        </tbody>
    `;
    container.appendChild(table);
}

// --------------------------- إعادة الحساب الكاملة ---------------------------
function recalcAll() {
    // عرض المجاميع
    displayBalanceTotals();

    // حسابات قائمة الدخل للسنة الأحدث
    const incomeY2 = computeIncomeTotals('year2');
    // تحديث الحقول المحسوبة داخل الجدول (إذا موجودت عناصر مجمل الربح... الخ) — سنحدث الخانات المخصصة إن وُجدت
    $("#gross-profit-year1").textContent = formatNumber(computeIncomeTotals('year1').grossProfit);
    $("#gross-profit-year2").textContent = formatNumber(incomeY2.grossProfit);

    $("#operating-profit-year1").textContent = formatNumber(computeIncomeTotals('year1').operatingProfit);
    $("#operating-profit-year2").textContent = formatNumber(incomeY2.operatingProfit);

    $("#net-profit-year1").textContent = formatNumber(computeIncomeTotals('year1').netProfit);
    $("#net-profit-year2").textContent = formatNumber(incomeY2.netProfit);

    // نظف نتائج سابقة
    clearResultsContainer();

    // عرض البطاقات: أرباح وملخصات
    displayProfitCards(incomeY2);

    // عرض النسب (هيكل التمويل من السنة الأحدث)
    const ratios = computeRatiosForLatest();
    displayRatiosCards(ratios);

    // عرض مصادر واستخدامات (مقارنة بين السنتين)
    const su = computeSourcesUses();
    displaySourcesUsesTable(su);
}

// أول عملية حسابية عند تحميل الصفحة
recalcAll();

// --------------------------- عند إرسال النموذج: عرض لوحة التحكم للتحليل ---------------------------
document.getElementById("financial-data-form").onsubmit = (e) => {
    e.preventDefault();
    document.getElementById("analysis-controls").style.display = "block";
    document.getElementById("results").style.display = "block";
    recalcAll();
};

// --------------------------- أزرار اختيار نوع التحليل (أضفت تصرف افتراضي) ---------------------------
document.querySelectorAll(".analysis-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".analysis-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        // إعادة حساب وإظهار النتائج (حسب الزر نعرض أيضًا تفاصيل إضافية إن لزم)
        recalcAll();
        // يمكن توسيع هنا لعرض جداول منفصلة للتحليل الرأسي أو الأفقي عند الطلب
        if (this.dataset.analysis === 'vertical') {
            // تحليل رأسي للقائمة (نسبة البنود من إجمالي الأرصد)
            displayVerticalAnalysis();
        } else if (this.dataset.analysis === 'horizontal') {
            displayHorizontalAnalysis();
        }
    });
});

// --------------------------- تحليل رأسي و أفقي (مبسّط) ---------------------------
function displayVerticalAnalysis() {
    // نفذ تحليل رأسي مبسط لقائمة الدخل (كل بند كنسبة من إجمالي الإيرادات)
    const revTotal = computeIncomeTotals('year2').revenue || 0;
    const incomeRows = readIncomeRows('year2');
    const container = $("#results-container");
    const table = document.createElement("table");
    table.className = "analysis-table";
    table.innerHTML = `
        <thead><tr><th>بند</th><th>القيمة</th><th>النسبة من الإيرادات</th></tr></thead>
        <tbody>
            ${incomeRows.map(r => {
                const pct = revTotal === 0 ? "—" : ((r.value / revTotal) * 100).toFixed(2) + " %";
                return `<tr><td>${r.name || '-'}</td><td>${formatNumber(r.value)}</td><td>${pct}</td></tr>`;
            }).join("")}
        </tbody>
    `;
    container.appendChild(table);
}

function displayHorizontalAnalysis() {
    // عرض التغير النسبي بين السنتين لكل بند في قائمة الدخل
    const incomeRows1 = readIncomeRows('year1');
    const incomeRows2 = readIncomeRows('year2');
    // بناء خريطة اسم->value للسنة1 (قد يكون الاسم مختلف، لذا نقارن بحسب ترتيب/الأسماء إن أمكن)
    const map1 = {};
    incomeRows1.forEach(r => { map1[r.name.trim()] = r.value; });

    const rows = incomeRows2.map(r2 => {
        const v1 = map1[r2.name.trim()] || 0;
        const pct = v1 === 0 ? "—" : (((r2.value - v1) / v1) * 100).toFixed(2) + " %";
        return { name: r2.name || '-', y1: v1, y2: r2.value, change: pct };
    });

    const container = $("#results-container");
    const table = document.createElement("table");
    table.className = "analysis-table";
    table.innerHTML = `
        <thead><tr><th>بند</th><th>السنة1</th><th>السنة2</th><th>التغير</th></tr></thead>
        <tbody>
            ${rows.map(r => `<tr><td>${r.name}</td><td>${formatNumber(r.y1)}</td><td>${formatNumber(r.y2)}</td><td>${r.change}</td></tr>`).join("")}
        </tbody>
    `;
    container.appendChild(table);
}

// --------------------------- تأكد من ربط مستمعين لأي صفوف جديدة تُضاف لاحقًا ---------------------------
const observer = new MutationObserver((mutations) => {
    for (let m of mutations) {
        m.addedNodes.forEach(n => {
            if (n.nodeType === 1 && n.matches && n.matches('tr')) {
                attachInputListenersToRow(n);
            }
        });
    }
});
observer.observe(document.getElementById("balance-body"), { childList: true, subtree: false });
observer.observe(document.getElementById("income-body"), { childList: true, subtree: false });

// --------------------------- زر القوائم الافتراضي للموبايل ---------------------------
document.getElementById("mobile-menu-btn").onclick = () => {
    document.getElementById("nav-menu").classList.toggle("show");
};
