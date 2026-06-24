import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  if (value?.toDate) value = value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function profileUrl(childId) {
  return `${window.location.origin}/profile.html?id=${encodeURIComponent(childId)}`;
}

function qrUrl(childId) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profileUrl(childId))}`;
}

function row(label, value) {
  return `<div class="cert-label">${escapeHtml(label)}</div><div class="cert-value">${escapeHtml(value || "")}</div>`;
}

async function loadCertificate(childId) {
  const output = $("certificateOutput");
  if (!childId) {
    output.innerHTML = `<div class="cert-inner"><h2>No child profile selected.</h2></div>`;
    return;
  }

  const snap = await getDoc(doc(db, "children", childId));
  if (!snap.exists()) {
    output.innerHTML = `<div class="cert-inner"><h2>Child profile not found.</h2></div>`;
    return;
  }

  const child = snap.data();

  output.innerHTML = `
    <div class="cert-inner">
      <div class="cert-gov">
        <div class="cert-seal">BD</div>
        <h1>Government of the People's Republic of Bangladesh</h1>
        <p>Birth Registration Style Record</p>
        <h2>Birth Registration Certificate</h2>
        <p>Generated through VaxID Bangladesh for hospital workflow demonstration</p>
      </div>

      <div class="cert-grid">
        ${row("Birth Registration Number", child.birth_certificate_no)}
        ${row("Name of Child", child.child_name)}
        ${row("Date of Birth", formatDate(child.dob))}
        ${row("Parent / Guardian", child.parent_name)}
        ${row("Guardian Phone", child.parent_phone)}
        ${row("Area / District", child.area)}
        ${row("Division / Region", child.region)}
        ${row("Preferred Vaccination Venue", child.preferred_clinic)}
        ${row("Registration Date", formatDate(child.created_at))}
        ${row("Vaccination Enrollment", child.opted_in_vaccination ? "Enrolled" : "Not enrolled")}
      </div>

      <div class="cert-note">
        Demo safety notice: This is a Bangladesh-style birth registration printout for the VaxID prototype. It is not an official Government of Bangladesh certificate and cannot be used as a legal identity document.
      </div>

      <div class="cert-footer">
        <div class="sign-line">Registrar / Authorized Officer</div>
        <div class="sign-line">Hospital / Clinic Authority</div>
        <img class="cert-qr" src="${escapeHtml(qrUrl(childId))}" alt="Profile QR" />
      </div>
    </div>
  `;
}

const url = new URL(window.location.href);
const childId = url.searchParams.get("id") || "";
$("printBtn").addEventListener("click", () => window.print());
$("profileBtn").addEventListener("click", () => {
  if (childId) window.open(profileUrl(childId), "_blank", "noopener");
});
loadCertificate(childId).catch((error) => {
  $("certificateOutput").innerHTML = `<div class="cert-inner"><h2>Error</h2><p>${escapeHtml(error.message)}</p></div>`;
});
