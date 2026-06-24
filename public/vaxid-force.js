
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const vaxidFirebaseApp = initializeApp(firebaseConfig, "vaxid-force-ui");
const vaxidDb = getFirestore(vaxidFirebaseApp);

const $force = (id) => document.getElementById(id);

function readyForce(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

function cloudflareSvg() {
  return `<svg viewBox="0 0 64 42" aria-label="Cloudflare logo" role="img">
    <path d="M45.8 36.5H18.3C10.4 36.5 4 30.7 4 23.5c0-6.7 5.5-12.2 12.6-13 3.1-5.2 9.1-8 15.2-6.3 5.2 1.4 9.1 5.8 9.8 11h3.8C53.5 15.2 60 20 60 25.8s-6.3 10.7-14.2 10.7Z"/>
  </svg>`;
}

function groqBadge() {
  return `<span class="vaxid-brand-badge" title="Powered by Groq">
    <span class="vaxid-groq-logo">G</span><span>Groq</span>
  </span>`;
}

function cloudflareBadge() {
  return `<span class="vaxid-brand-badge" title="Powered by Cloudflare">
    <span class="vaxid-cloud-logo">${cloudflareSvg()}</span><span>Cloudflare</span>
  </span>`;
}


function firebaseBadge() {
  return `<span class="vaxid-brand-badge" title="Built with Firebase">
    <span class="vaxid-firebase-logo" aria-label="Firebase logo">
      <svg viewBox="0 0 64 64" role="img">
        <path fill="#FFA000" d="M13 54 20 7c.2-1.4 2.1-1.8 2.9-.6L31 21l5.1-9.7c.7-1.3 2.6-1.1 3 .3L52 54H13Z"/>
        <path fill="#F57C00" d="M31 21 13 54l26-25-8-8Z"/>
        <path fill="#FFCA28" d="M52 54 39 12c-.4-1.4-2.3-1.6-3-.3L13 54h39Z"/>
      </svg>
    </span>
    <span>Firebase</span>
  </span>`;
}

function termuxBadge() {
  return `<span class="vaxid-brand-badge" title="Android SIM automation through Termux">
    <span class="vaxid-termux-logo" aria-label="Termux logo">
      <span class="vaxid-termux-prompt">&gt;_</span>
    </span>
    <span>Termux</span>
  </span>`;
}


function githubBadge() {
  return `<span class="vaxid-brand-badge" title="Version control with GitHub">
    <span class="vaxid-github-logo" aria-label="GitHub logo">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.41 7.86 10.94.58.1.79-.25.79-.56v-2.02c-3.2.7-3.88-1.37-3.88-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.52-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18A10.9 10.9 0 0 1 12 6.22c.98 0 1.96.13 2.88.39 2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.42-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1v3.06c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>
      </svg>
    </span>
    <span>GitHub</span>
  </span>`;
}

function addForceTopbar() {
  if (document.querySelector(".vaxid-force-topbar")) return;

  const bar = document.createElement("div");
  bar.className = "vaxid-force-topbar";
  bar.innerHTML = `
    <div class="vaxid-force-left">
      <span class="vaxid-force-label">Powered by</span>
      <div class="vaxid-force-powered">${groqBadge()}${cloudflareBadge()}${firebaseBadge()}${termuxBadge()}${githubBadge()}</div>
    </div>
    <div class="vaxid-force-right">
      <span class="vaxid-gov-badge" title="Government health workflow readiness">
        <span class="vaxid-gov-icon">⚕</span>
        <span>Government-ready: DGHS / MOHFW workflow</span>
      </span>
      <button id="vaxidResetBtn" class="vaxid-reset-btn" type="button">Reset / Refresh</button>
    </div>
  `;

  document.body.prepend(bar);
  $force("vaxidResetBtn")?.addEventListener("click", hardResetForce);
}

async function hardResetForce() {
  const btn = $force("vaxidResetBtn");
  if (btn) btn.textContent = "Refreshing...";

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {}

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {}

  try {
    sessionStorage.removeItem("vaxidForceAccepted");
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}

function showEntryGate() {
  if (document.getElementById("vaxidForceGate")) return;

  const gate = document.createElement("div");
  gate.id = "vaxidForceGate";
  gate.className = "vaxid-force-gate";
  gate.innerHTML = `
    <div class="vaxid-force-gate-card">
      <div class="vaxid-force-gate-head">
        <div>
          <h2>VaxID Bangladesh</h2>
          <p>One child. One secure record. A healthier Bangladesh.</p>
        </div>
        <div class="vaxid-force-powered">${groqBadge()}${cloudflareBadge()}${firebaseBadge()}${termuxBadge()}${githubBadge()}</div>
      </div>

      <div class="vaxid-robot-box">
        <label class="vaxid-force-check">
          <input id="vaxidRobotCheck" type="checkbox" />
          <span>I am not a robot</span>
        </label>
      </div>

      <div class="vaxid-terms-box">
        <h3>Terms, Privacy & Data Protection Pledge</h3>
        <p>
          VaxID will not sell, rent, trade, or share collected child, guardian, vaccination, patient, or medical data with unauthorized third parties.
          Data is used only for child registration, vaccination tracking, patient records, AI review, vaccination alerts, and authorized healthcare workflow support.
        </p>
        <p>
          If VaxID violates this data protection pledge, users and guardians keep their full legal rights, including the right to take legal action under applicable law.
        </p>
        <p>
          VaxID is a healthcare support tool. It does not diagnose, prescribe, decide vaccine dose, or replace doctors. Final medical decisions must be made by authorized medical staff.
        </p>

        <label class="vaxid-force-check">
          <input id="vaxidTermsCheck" type="checkbox" disabled />
          <span>I accept the VaxID Terms, Privacy & Data Protection Pledge</span>
        </label>
      </div>

      <button id="vaxidEnterBtn" type="button" disabled>Enter VaxID</button>
    </div>
  `;

  document.body.appendChild(gate);

  const robot = $force("vaxidRobotCheck");
  const terms = $force("vaxidTermsCheck");
  const enter = $force("vaxidEnterBtn");

  robot.addEventListener("change", () => {
    terms.disabled = !robot.checked;
    if (!robot.checked) terms.checked = false;
    enter.disabled = !(robot.checked && terms.checked);
  });

  terms.addEventListener("change", () => {
    enter.disabled = !(robot.checked && terms.checked);
  });

  enter.addEventListener("click", () => {
    gate.remove();
    try { sessionStorage.setItem("vaxidForceAccepted", "yes"); } catch {}
    ensureBirthCertificateNumber(true);
  });
}

function randomDigits(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

function makeRandomBirthCertificateNo() {
  const year = new Date().getFullYear();
  return `${year}${randomDigits(13)}`; // Bangladesh-style 17 digit number: YYYY + 13 random digits
}

async function birthNoExists(birthNo) {
  const q = query(collection(vaxidDb, "children"), where("birth_certificate_no", "==", birthNo));
  const snap = await getDocs(q);
  return !snap.empty;
}

async function getUniqueRandomBirthNo() {
  for (let i = 0; i < 12; i++) {
    const birthNo = makeRandomBirthCertificateNo();
    if (!(await birthNoExists(birthNo))) return birthNo;
  }
  return `${new Date().getFullYear()}${randomDigits(13)}`;
}

async function ensureBirthCertificateNumber(forceNew = false) {
  const input = $force("birthCertificateNo");
  if (!input) return;

  input.removeAttribute("placeholder");
  input.readOnly = true;

  const current = input.value.trim();
  if (!forceNew && current && current !== "Generating...") return;

  input.value = "Generating...";
  try {
    input.value = await getUniqueRandomBirthNo();
  } catch (error) {
    console.warn("Could not verify unique birth certificate number. Using offline random number.", error);
    input.value = makeRandomBirthCertificateNo();
  }
}

function profileUrl(childId) {
  return `${window.location.origin}/profile.html?id=${encodeURIComponent(childId)}`;
}

function certificateUrl(childId) {
  return `${window.location.origin}/birth-certificate.html?id=${encodeURIComponent(childId)}`;
}

function qrUrl(childId) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(profileUrl(childId))}`;
}

function getActiveChildId() {
  const fields = ["vaxChildId", "healthChildId", "aiChildId", "reminderChildId", "profileChildId"];
  for (const id of fields) {
    const value = $force(id)?.value?.trim();
    if (value) return value;
  }
  const url = new URL(window.location.href);
  return url.searchParams.get("id") || "";
}

function addPrintActions() {
  const childId = getActiveChildId();
  if (!childId) return;

  const targets = [
    document.getElementById("registerResult"),
    document.getElementById("profileResult"),
    document.getElementById("profileOutput")
  ].filter(Boolean);

  for (const target of targets) {
    const card = target.querySelector(".qr-card, .profile-card, .notice");
    if (!card || card.querySelector(".vaxid-print-actions")) continue;

    const actions = document.createElement("div");
    actions.className = "vaxid-print-actions";
    actions.innerHTML = `
      <a class="primary" href="${certificateUrl(childId)}" target="_blank" rel="noopener">Print Birth Certificate</a>
      <a href="${profileUrl(childId)}" target="_blank" rel="noopener">Open Child Profile</a>
    `;
    card.appendChild(actions);
  }

  // Make all visible QR images point to the scan profile page.
  document.querySelectorAll("img.qr, img.scan-qr").forEach((img) => {
    img.src = qrUrl(childId);
  });
}

function removeSensitiveDisplay() {
  // Remove chips that expose internal IDs or AI model names.
  document.querySelectorAll(".chip, .status-pill, span").forEach((node) => {
    const text = (node.textContent || "").trim().toLowerCase();
    if (
      text.startsWith("model:") ||
      text.startsWith("child id:") ||
      text.startsWith("record id:") ||
      text.startsWith("id:")
    ) {
      node.remove();
    }
  });

  // Remove key-value display rows for internal IDs and model names.
  document.querySelectorAll(".kv").forEach((kv) => {
    const children = Array.from(kv.children);
    for (let i = 0; i < children.length - 1; i += 2) {
      const key = (children[i].textContent || "").trim().toLowerCase();
      if (
        key === "id" ||
        key === "child id" ||
        key === "record id" ||
        key.endsWith("_id") ||
        key === "model" ||
        key === "model used" ||
        key === "qr payload" ||
        key === "qr png url" ||
        key === "profile url"
      ) {
        children[i].remove();
        children[i + 1]?.remove();
      }
    }
  });

  // Remove table columns for internal IDs/model fields.
  document.querySelectorAll("table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th"));
    const removeIndexes = [];
    headers.forEach((th, index) => {
      const key = (th.textContent || "").trim().toLowerCase();
      if (
        key === "id" ||
        key === "child_id" ||
        key === "record_id" ||
        key.endsWith("_id") ||
        key === "model" ||
        key === "model_used" ||
        key === "qr_payload" ||
        key === "qr_png_url" ||
        key === "profile_url"
      ) {
        removeIndexes.push(index);
      }
    });

    if (!removeIndexes.length) return;

    table.querySelectorAll("tr").forEach((row) => {
      const cells = Array.from(row.children);
      removeIndexes.slice().reverse().forEach((i) => cells[i]?.remove());
    });
  });

  addPrintActions();
}

window.addEventListener("vaxidGenerateBirthNo", () => ensureBirthCertificateNumber(true));

readyForce(() => {
  addForceTopbar();
  showEntryGate();
  ensureBirthCertificateNumber(true);

  setTimeout(() => ensureBirthCertificateNumber(false), 500);
  setTimeout(() => ensureBirthCertificateNumber(false), 1500);

  removeSensitiveDisplay();

  const observer = new MutationObserver(() => removeSensitiveDisplay());
  observer.observe(document.body, { childList: true, subtree: true });
});
