import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeProfileUrl(childId) {
  return `${window.location.origin}/profile.html?id=${encodeURIComponent(childId)}`;
}

function makeQrUrl(childId) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(makeProfileUrl(childId))}`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value?.toDate) return value.toDate().toISOString().replace("T", " ").slice(0, 19);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeAiText(text) {
  return String(text || "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

function extractNumberedSections(text, wantedNumbers) {
  const clean = normalizeAiText(text);
  if (!clean) return "";

  const lines = clean.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s*(.*)$/);
    if (match) {
      if (current) sections.push(current);
      current = { number: Number(match[1]), content: [line.trim()] };
    } else if (current) {
      current.content.push(line);
    }
  }

  if (current) sections.push(current);

  const selected = sections
    .filter((section) => wantedNumbers.includes(section.number))
    .map((section) => section.content.join("\n").trim())
    .filter(Boolean);

  return selected.length ? selected.join("\n\n") : clean;
}

function cleanReminderMessage(message) {
  const text = normalizeAiText(message);
  const parentAndClinic = extractNumberedSections(text, [5, 6]);
  return parentAndClinic || text;
}

async function getRecords(collectionName, childId) {
  const q = query(collection(db, collectionName), where("child_id", "==", childId));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getPatientRecords(childId) {
  const modern = await getRecords("patient_records", childId);
  const old = await getRecords("health_records", childId);
  const map = new Map();
  [...modern, ...old].forEach((row) => map.set(row.id, row));
  return [...map.values()];
}

function getDueSummary(vaccinations) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let missed = 0;
  let dueSoon = 0;

  vaccinations.forEach((record) => {
    const status = String(record.status || "").toLowerCase();
    if (status.includes("missed")) missed += 1;
    const dueDate = record.due_date ? new Date(record.due_date) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) return;
    dueDate.setHours(0, 0, 0, 0);
    const days = Math.round((dueDate - today) / 86400000);
    if (status !== "completed" && days < 0) missed += 1;
    else if (status !== "completed" && days <= 14) dueSoon += 1;
  });

  return { missed, dueSoon };
}

function calculateRisk(vaccinations, patientRecords) {
  const due = getDueSummary(vaccinations);
  const medicalText = patientRecords
    .map((row) => `${row.diagnosis || ""} ${row.doctor_notes || ""} ${row.medicine || ""}`)
    .join(" ")
    .toLowerCase();

  const reviewWords = [
    "allergy", "anaphylaxis", "immunocompromised", "immunosuppression", "chemotherapy",
    "radiotherapy", "radiation therapy", "cancer", "malignancy", "tumor", "transplant",
    "seizure", "convulsion", "steroid", "serious"
  ];

  const needsReview = reviewWords.some((word) => medicalText.includes(word));
  const riskScore = due.missed * 30 + due.dueSoon * 12 + (needsReview ? 35 : 0);
  const riskLevel = riskScore >= 60 ? "High" : riskScore >= 25 ? "Medium" : "Low";
  return { ...due, riskScore, riskLevel, needsReview };
}

function rowsToTable(title, rows, options = {}) {
  if (!rows.length) return `<h2 class="section-title">${escapeHtml(title)}</h2><div class="empty-card">No records found.</div>`;

  const hidden = new Set(options.hidden || ["child_id"]);
  const preferred = options.preferred || [];
  const allKeys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !hidden.has(key));
  const keys = [...preferred.filter((key) => allKeys.includes(key)), ...allKeys.filter((key) => !preferred.includes(key))];

  return `
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <div class="table-scroll">
      <table class="profile-table">
        <thead>
          <tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${keys.map((key) => `<td>${escapeHtml(formatValue(row[key]))}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function normalizeReminderRows(rows) {
  return rows.map((row) => ({
    ...row,
    message: cleanReminderMessage(row.message || row.text || "")
  }));
}

async function loadProfile(childId) {
  const status = $("profileStatus");
  const output = $("profileOutput");

  if (!childId) {
    status.textContent = "Enter Child ID";
    output.innerHTML = `<div class="empty-card">No Child ID found in the QR link.</div>`;
    return;
  }

  status.textContent = "Loading profile...";
  output.innerHTML = "";

  const childSnap = await getDoc(doc(db, "children", childId));

  if (!childSnap.exists()) {
    status.textContent = "Not found";
    status.className = "status-pill offline";
    output.innerHTML = `<div class="empty-card">No child profile found for <strong>${escapeHtml(childId)}</strong>.</div>`;
    return;
  }

  const child = childSnap.data();
  const vaccinations = await getRecords("vaccination_records", childId);
  const patientRecords = await getPatientRecords(childId);
  const reminders = normalizeReminderRows(await getRecords("reminders", childId));
  const aiMessages = await getRecords("ai_messages", childId);

  const due = getDueSummary(vaccinations);
  const risk = calculateRisk(vaccinations, patientRecords);

  status.textContent = "Profile loaded";
  status.className = "status-pill";

  output.innerHTML = `
    <section class="profile-card">
      <h2 class="result-title">Child profile overview</h2>
      <div class="result-meta">
        <span class="chip ${risk.riskLevel === "High" ? "danger" : risk.riskLevel === "Medium" ? "warn" : ""}">Risk: ${escapeHtml(risk.riskLevel)} (${risk.riskScore})</span>
        <span class="chip ${due.missed ? "danger" : due.dueSoon ? "warn" : ""}">Missed: ${due.missed} | Due/due soon: ${due.dueSoon}</span>
        <span class="chip ${risk.needsReview ? "warn" : ""}">Doctor review: ${risk.needsReview ? "Required" : "Not required"}</span>
      </div>

      <div class="profile-main">
        <img class="scan-qr" src="${escapeHtml(makeQrUrl(childId))}" alt="VaxID QR code" />
        <div class="profile-kv">
          <div>Child name</div><div>${escapeHtml(child.child_name)}</div>
          <div>Birth certificate</div><div>${escapeHtml(child.birth_certificate_no)}</div>
          <div>Parent/guardian</div><div>${escapeHtml(child.parent_name || "")}</div>
          <div>Phone</div><div>${escapeHtml(child.parent_phone || "")}</div>
          <div>Region</div><div>${escapeHtml(child.region || "")}</div>
          <div>Preferred venue</div><div>${escapeHtml(child.preferred_clinic || "")}</div>
        </div>
      </div>
    </section>

    ${rowsToTable("Vaccination Records", vaccinations, {
      preferred: ["vaccine_name", "status", "due_date", "completed_date", "updated_at", "source", "entered_offline_capable", "id", "record_id", "child_id", "qr_payload", "qr_png_url", "profile_url"]
    })}

    ${rowsToTable("Patient Records", patientRecords, {
      preferred: ["visit_date", "hospital_name", "diagnosis", "medicine", "doctor_notes", "updated_at", "source", "entered_offline_capable", "id", "record_id", "child_id", "qr_payload", "qr_png_url", "profile_url"]
    })}

    ${rowsToTable("Reminder Records", reminders, {
      preferred: ["message", "status", "gateway_note", "sent_at", "created_at", "reminder_type", "id", "record_id", "child_id", "qr_payload", "qr_png_url", "profile_url"]
    })}

    ${rowsToTable("AI Review Records", aiMessages, {
      preferred: ["message", "risk_level", "doctor_review_required", "created_at", "id", "record_id", "child_id", "qr_payload", "qr_png_url", "profile_url"]
    })}
  `;
}

const url = new URL(window.location.href);
const initialChildId = url.searchParams.get("id") || "";
$("childIdInput").value = initialChildId;
$("loadProfileBtn").addEventListener("click", () => {
  const childId = $("childIdInput").value.trim();
  const nextUrl = `${window.location.origin}/profile.html?id=${encodeURIComponent(childId)}`;
  history.replaceState(null, "", nextUrl);
  loadProfile(childId).catch((error) => {
    $("profileStatus").textContent = "Error";
    $("profileStatus").className = "status-pill offline";
    $("profileOutput").innerHTML = `<div class="empty-card"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
  });
});

loadProfile(initialChildId).catch((error) => {
  $("profileStatus").textContent = "Error";
  $("profileStatus").className = "status-pill offline";
  $("profileOutput").innerHTML = `<div class="empty-card"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
});
