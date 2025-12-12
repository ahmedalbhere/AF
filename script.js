// ===============================
// فتح قائمة الموبايل
// ===============================
document.getElementById("mobile-menu-btn").onclick = () => {
    document.getElementById("nav-menu").classList.toggle("show");
};

// ===============================
// إضافة صفوف ديناميكية
// ===============================
function addRow(category, tableId) {
    const tbody = document.getElementById(tableId);
    const sectionHeader = [...tbody.querySelectorAll("tr")].find(tr =>
        tr.classList.contains("section-header") &&
        tr.textContent.includes(category)
    );

    const newRow = document.createElement("tr");
    newRow.innerHTML = `
        <td><input type="text" class="item-name" placeholder="اسم البند"></td>
        <td><input type="number" class="balance-input income-input" data-year="year1" placeholder="0"></td>
        <td><input type="number" class="balance-input income-input" data-year="year2" placeholder="0"></td>
        <td><button type="button" class="btn btn-danger btn-small remove-row">حذف</button></td>
    `;
    sectionHeader.insertAdjacentElement("afterend", newRow);
}

// أزرار الإضافة
document.getElementById("add-current-asset").onclick = () => addRow("الأصول المتداولة", "balance-body");
document.getElementById("add-fixed-asset").onclick = () => addRow("الأصول الثابتة", "balance-body");
document.getElementById("add-liability").onclick = () => addRow("الخصوم", "balance-body");
document.getElementById("add-income-item").onclick = () => addRow("الإيرادات", "income-body");
document.getElementById("add-expense-item").onclick = () => addRow("المصروفات", "income-body");

// حذف الصف
document.addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-row")) {
        e.target.closest("tr").remove();
    }
});

// ===============================
// قراءة البيانات من الجدول
// ===============================
function readTable(id) {
    const rows = [...document.querySelectorAll(`#${id} tbody tr`)];
    let items = [];

    rows.forEach(row => {
        if (!row.classList.contains("section-header") && !row.classList.contains("total-row") && !row.classList.contains("calculated-row")) {
            const name = row.querySelector(".item-name")?.value || "";
            const year1 = parseFloat(row.querySelector("[data-year='year1']")?.value) || 0;
            const year2 = parseFloat(row.querySelector("[data-year='year2']")?.value) || 0;

            if (name.trim() !== "") {
                items.push({ name, year1, year2 });
            }
        }
    });

    return items;
}

// ===============================
// حساب التحليل الرأسي
// ===============================
function verticalAnalysis(balance, income) {
    let totalAssetsY1 = 0, totalAssetsY2 = 0;
    balance.forEach(i => {
        totalAssetsY1 += i.year1;
        totalAssetsY2 += i.year2;
    });

    let results = income.map(item => ({
        name: item.name,
        y1: ((item.year1 / totalAssetsY1) * 100).toFixed(2) + " %",
        y2: ((item.year2 / totalAssetsY2) * 100).toFixed(2) + " %"
    }));

    return results;
}

// ===============================
// التحليل الأفقي
// ===============================
function horizontalAnalysis(data) {
    return data.map(item => ({
        name: item.name,
        change: item.year1 === 0 ? "—" : (((item.year2 - item.year1) / item.year1) * 100).toFixed(2) + " %"
    }));
}

// ===============================
// النسب المالية
// ===============================
function financialRatios(balance, income) {
    const find = (keyword) =>
        balance.find(i => i.name.includes(keyword))?.year2 || 0;

    const currentAssets = find("نقد") + find("المتداولة");
    const currentLiabilities = find("قصيرة") + find("المتداولة");

    const inventory = find("المخزون") || 0;

    return [
        {
            name: "نسبة التداول",
            value: (currentAssets / currentLiabilities).toFixed(2)
        },
        {
            name: "النسبة السريعة",
            value: ((currentAssets - inventory) / currentLiabilities).toFixed(2)
        }
    ];
}

// ===============================
// عرض النتائج
// ===============================
function displayResults(list) {
    const container = document.getElementById("results-container");
    container.innerHTML = "";

    list.forEach(item => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `
            <h3>${item.name}</h3>
            <div class="result-value">${item.value || item.change || item.y1}</div>
        `;
        container.appendChild(card);
    });

    document.getElementById("results").style.display = "block";
}

// ===============================
// عند الضغط على زر تحليل البيانات
// ===============================
document.getElementById("financial-data-form").onsubmit = (e) => {
    e.preventDefault();
    document.getElementById("analysis-controls").style.display = "block";
};

// ===============================
// اختيار نوع التحليل
// ===============================
document.querySelectorAll(".analysis-btn").forEach(btn => {
    btn.onclick = function () {
        document.querySelectorAll(".analysis-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");

        const balance = readTable("balance-sheet");
        const income = readTable("income-statement");

        if (this.dataset.analysis === "vertical") {
            const res = verticalAnalysis(balance, income);
            displayResults(res);
        }

        if (this.dataset.analysis === "horizontal") {
            const res = horizontalAnalysis(income);
            displayResults(res);
        }

        if (this.dataset.analysis === "ratios") {
            const res = financialRatios(balance, income);
            displayResults(res);
        }
    };
});
