// script.js

// مصادر الـ API
const API_FRANK = "https://api.frankfurter.app";
const API_HOST = "https://api.exchangerate.host";

// عناصر DOM
const baseSelect = document.getElementById("base");
const baseLabel = document.getElementById("base-label");
const searchInput = document.getElementById("search");
const refreshBtn = document.getElementById("refresh");
const updatedEl = document.getElementById("updated");
const ratesBody = document.getElementById("rates-body");

// حالة
let symbols = {}; // {USD: "United States Dollar", EUR: "Euro", ...}
let rates = {};   // {EUR: 0.93, GBP: 0.78, ...}
let base = "USD";

// عناصر حالة واجهة (رسائل)
function clearTableBody() {
  ratesBody.innerHTML = "";
}
function showLoadingRow() {
  clearTableBody();
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 2;
  td.textContent = "جارِ جلب الأسعار...";
  ratesBody.appendChild(tr);
  tr.appendChild(td);
}
function showEmptyRow(message = "لا توجد نتائج") {
  clearTableBody();
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 2;
  td.textContent = message;
  ratesBody.appendChild(tr);
  tr.appendChild(td);
}

// تنسيقات
function formatNumber(n) {
  return Number(n).toLocaleString("ar-EG", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}
function setUpdated(ts) {
  const date = new Date(ts);
  updatedEl.textContent = !isNaN(date) ? date.toLocaleString("ar-EG") : ts;
}

// جلب الرموز — المحاولة الأولى Frankfurter، احتياطي Exchangerate.host
async function fetchSymbols() {
  try {
    const res = await fetch(`${API_FRANK}/currencies`);
    const data = await res.json(); // { USD: "United States Dollar", EUR: "Euro", ... }
    if (data && typeof data === "object") {
      symbols = data;
      return;
    }
    throw new Error("Frankfurter currencies response invalid");
  } catch (err) {
    console.warn("Frankfurter symbols failed, trying exchangerate.host", err);
    const res = await fetch(`${API_HOST}/symbols`);
    const data = await res.json();
    if (data && data.symbols) {
      // تحويل شكل البيانات من { USD: {description, code}, ... } إلى { USD: "description", ... }
      const normalized = {};
      for (const code of Object.keys(data.symbols)) {
        normalized[code] = data.symbols[code].description || code;
      }
      symbols = normalized;
      return;
    }
    throw new Error("Failed to fetch symbols from both sources");
  }
}

// ملء قائمة عملة الأساس
function populateBaseSelect() {
  baseSelect.innerHTML = "";
  const codes = Object.keys(symbols).sort();
  codes.forEach((code) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${code} — ${symbols[code]}`;
    baseSelect.appendChild(opt);
  });
  baseSelect.value = base;
  baseLabel.textContent = base;
}

// جلب الأسعار — المحاولة الأولى Frankfurter، احتياطي Exchangerate.host
async function fetchRates() {
  showLoadingRow();
  try {
    const res = await fetch(`${API_FRANK}/latest?from=${encodeURIComponent(base)}`);
    const data = await res.json(); // { amount, base, date, rates: {...} }
    if (data && data.rates) {
      rates = data.rates;
      setUpdated(data.date || Date.now());
      return;
    }
    throw new Error("Frankfurter latest response invalid");
  } catch (err) {
    console.warn("Frankfurter rates failed, trying exchangerate.host", err);
    const res = await fetch(`${API_HOST}/latest?base=${encodeURIComponent(base)}`);
    const data = await res.json(); // { base, date, rates: {...}, success? }
    if (data && data.rates) {
      rates = data.rates;
      setUpdated(data.date || Date.now());
      return;
    }
    console.error("Failed to fetch rates from both sources", err);
    rates = {};
    setUpdated(Date.now());
  }
}

// عرض الجدول
function renderTable() {
  const q = searchInput.value.trim().toUpperCase();
  clearTableBody();

  const entries = Object.entries(rates)
    .filter(([code]) => !q || code.toUpperCase().includes(q))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) {
    showEmptyRow(q ? "لا توجد عملة بهذا الرمز" : "لا توجد أسعار متاحة الآن");
    return;
  }

  for (const [code, value] of entries) {
    const tr = document.createElement("tr");
    const tdCode = document.createElement("td");
    const tdValue = document.createElement("td");

    const desc = symbols[code] || "";
    tdCode.textContent = desc ? `${code} — ${desc}` : code;
    tdValue.textContent = formatNumber(value);

    tr.appendChild(tdCode);
    tr.appendChild(tdValue);
    ratesBody.appendChild(tr);
  }
}

// دورة حياة
async function init() {
  try {
    await fetchSymbols();
    populateBaseSelect();
    await fetchRates();
    renderTable();
  } catch (e) {
    console.error(e);
    showEmptyRow("تعذّر تحميل البيانات. تحقق من الاتصال ثم أعد المحاولة.");
  }
}

// أحداث
baseSelect.addEventListener("change", async () => {
  base = baseSelect.value;
  baseLabel.textContent = base;
  await fetchRates();
  renderTable();
});

searchInput.addEventListener("input", () => {
  renderTable();
});

refreshBtn.addEventListener("click", async () => {
  await fetchRates();
  renderTable();
});

// ابدأ
init();
const amountInput = document.getElementById("amount");
const fromSelect = document.getElementById("from");
const toSelect = document.getElementById("to");
const convertBtn = document.getElementById("convert");
const resultBox = document.getElementById("result");

// ملء قوائم التحويل بنفس الرموز
function populateConverterSelects() {
  const codes = Object.keys(symbols).sort();
  for (const code of codes) {
    const optFrom = document.createElement("option");
    const optTo = document.createElement("option");
    optFrom.value = code;
    optTo.value = code;
    optFrom.textContent = `${code} — ${symbols[code]}`;
    optTo.textContent = `${code} — ${symbols[code]}`;
    fromSelect.appendChild(optFrom);
    toSelect.appendChild(optTo);
  }
  fromSelect.value = "USD";
  toSelect.value = "YER";
}

// تنفيذ التحويل
async function convertCurrency() {
  const amount = parseFloat(amountInput.value);
  const from = fromSelect.value;
  const to = toSelect.value;

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("أدخل مبلغًا صالحًا للتحويل.");
    return;
  }

  if (!from || !to) {
    alert("تأكد من اختيار العملتين.");
    return;
  }

  try {
    const res = await fetch(`${API_FRANK}/latest?amount=${amount}&from=${from}&to=${to}`);
    const data = await res.json();
    if (data && data.rates && data.rates[to]) {
      resultBox.textContent = `${formatNumber(amount)} ${from} = ${formatNumber(data.rates[to])} ${to}`;
    } else {
      resultBox.textContent = "تعذر إجراء التحويل.";
    }
  } catch (err) {
    console.error("فشل التحويل:", err);
    resultBox.textContent = "حدث خطأ أثناء التحويل.";
  }
}


// زر التحويل
convertBtn.addEventListener("click", convertCurrency);

// تحديث init لملء القوائم الجديدة
async function init() {
  await fetchSymbols();
  populateBaseSelect();
  populateConverterSelects(); // ← أضف هذا السطر
  await fetchRates();
  renderTable();
}
