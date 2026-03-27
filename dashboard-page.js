import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  firebaseConfig,
  TOTAL_NUMBERS,
  COLLECTION_NAME
} from "./firebase-config.js";

import { buildDashboard, clearDashboard } from "./dashboard.js";

const dashTotal = document.getElementById("dashTotal");
const dashReserved = document.getElementById("dashReserved");
const dashAvailable = document.getElementById("dashAvailable");

const searchInput = document.getElementById("searchInput");
const orderFilter = document.getElementById("orderFilter");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const timeFrom = document.getElementById("timeFrom");
const timeTo = document.getElementById("timeTo");
const applyDateFilterBtn = document.getElementById("applyDateFilterBtn");
const clearDateFilterBtn = document.getElementById("clearDateFilterBtn");
const rankingList = document.getElementById("rankingList");
const dashboardMessage = document.getElementById("dashboardMessage");

let db = null;
let auth = null;
let participantsRef = null;
let participants = [];

let currentSearch = "";
let currentDateFrom = "";
let currentDateTo = "";
let currentTimeFrom = "";
let currentTimeTo = "";

function showMessage(text, type = "success") {
  dashboardMessage.textContent = text;
  dashboardMessage.className = `message ${type}`;

  setTimeout(() => {
    dashboardMessage.textContent = "";
    dashboardMessage.className = "message";
  }, 3000);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCreatedAtDate(item) {
  if (!item?.criadoEm) return null;

  if (typeof item.criadoEm.toDate === "function") {
    return item.criadoEm.toDate();
  }

  if (item.criadoEm.seconds) {
    return new Date(item.criadoEm.seconds * 1000);
  }

  return null;
}

function updateCounters() {
  const reserved = participants.length;
  const available = TOTAL_NUMBERS - reserved;

  dashTotal.textContent = TOTAL_NUMBERS;
  dashReserved.textContent = reserved;
  dashAvailable.textContent = available;
}

function buildStartDateTime() {
  if (!currentDateFrom) return null;
  return new Date(`${currentDateFrom}T${currentTimeFrom || "00:00"}`);
}

function buildEndDateTime() {
  if (!currentDateTo) return null;
  return new Date(`${currentDateTo}T${currentTimeTo || "23:59"}`);
}

function participantPassesDateFilter(item) {
  const createdAt = getCreatedAtDate(item);
  if (!createdAt) return true;

  const start = buildStartDateTime();
  const end = buildEndDateTime();

  if (start && createdAt < start) return false;
  if (end && createdAt > end) return false;

  return true;
}

function applyOrdering(data) {
  const ordered = [...data];
  const mode = orderFilter.value;

  if (mode === "numero_asc") {
    ordered.sort((a, b) => Number(a.numero) - Number(b.numero));
  }

  if (mode === "numero_desc") {
    ordered.sort((a, b) => Number(b.numero) - Number(a.numero));
  }

  if (mode === "data_asc") {
    ordered.sort((a, b) => {
      const da = getCreatedAtDate(a)?.getTime() || 0;
      const db = getCreatedAtDate(b)?.getTime() || 0;
      return da - db;
    });
  }

  if (mode === "data_desc") {
    ordered.sort((a, b) => {
      const da = getCreatedAtDate(a)?.getTime() || 0;
      const db = getCreatedAtDate(b)?.getTime() || 0;
      return db - da;
    });
  }

  return ordered;
}

function filteredParticipants() {
  let data = [...participants];

  const term = normalizeText(currentSearch);
  if (term) {
    data = data.filter((item) => {
      const nome = normalizeText(item.nome);
      const telefone = normalizeText(item.telefone);
      const numero = normalizeText(String(item.numero));
      const indicacao = normalizeText(item.indicacao);

      return (
        nome.includes(term) ||
        telefone.includes(term) ||
        numero.includes(term) ||
        indicacao.includes(term)
      );
    });
  }

  data = data.filter(participantPassesDateFilter);
  data = applyOrdering(data);

  return data;
}

function renderRankingList() {
  const data = filteredParticipants();
  const rankingMap = {};

  data.forEach((item) => {
    const seller = (item.indicacao || "Sem indicação").trim() || "Sem indicação";
    rankingMap[seller] = (rankingMap[seller] || 0) + 1;
  });

  const ranking = Object.entries(rankingMap)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  rankingList.innerHTML = "";

  if (!ranking.length) {
    rankingList.innerHTML = `<div class="empty-box">Nenhum dado para ranking.</div>`;
    return;
  }

  ranking.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "participant-card";

    card.innerHTML = `
      <div class="participant-content">
        <p><strong>#${index + 1}</strong></p>
        <p><strong>Vendedor / Indicação:</strong> ${item.nome}</p>
        <p><strong>Total vendido:</strong> <span class="number-pill">${item.total}</span></p>
      </div>
    `;

    rankingList.appendChild(card);
  });
}

function updateDashboardPage() {
  renderRankingList();
  buildDashboard(filteredParticipants());
}

function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  participantsRef = collection(db, COLLECTION_NAME);
}

function listenParticipants() {
  const q = query(participantsRef, orderBy("numero", "asc"));

  onSnapshot(
    q,
    (snapshot) => {
      participants = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      updateCounters();
      updateDashboardPage();
    },
    (error) => {
      console.error(error);
      showMessage("Erro ao carregar dashboard.", "error");
    }
  );
}

searchInput.addEventListener("input", (event) => {
  currentSearch = event.target.value;
  updateDashboardPage();
});

orderFilter.addEventListener("change", () => {
  updateDashboardPage();
});

applyDateFilterBtn.addEventListener("click", () => {
  currentDateFrom = dateFrom.value;
  currentDateTo = dateTo.value;
  currentTimeFrom = timeFrom.value;
  currentTimeTo = timeTo.value;
  updateDashboardPage();
});

clearDateFilterBtn.addEventListener("click", () => {
  currentDateFrom = "";
  currentDateTo = "";
  currentTimeFrom = "";
  currentTimeTo = "";

  dateFrom.value = "";
  dateTo.value = "";
  timeFrom.value = "";
  timeTo.value = "";

  updateDashboardPage();
});

function start() {
  initFirebase();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      clearDashboard();
      window.location.href = "admin.html";
      return;
    }

    listenParticipants();
  });
}

start();