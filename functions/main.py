from __future__ import annotations

import base64
import datetime as dt
import io
import os
import uuid
from typing import Any, Dict, List, Optional

import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn
from google import genai
import qrcode

from risk_model import predict_missed_vaccine_risk

if not firebase_admin._apps:
    firebase_admin.initialize_app()

DB = firestore.client()

SPECIAL_REVIEW_KEYWORDS = [
    "immunocompromised",
    "immune deficiency",
    "hiv",
    "cancer",
    "chemotherapy",
    "transplant",
    "long-term steroid",
    "severe allergy",
    "anaphylaxis",
    "convulsion",
    "neurological",
    "premature",
    "low birth weight",
]

DEMO_EPI_SCHEDULE = [
    {"name": "BCG", "days_after_birth": 0},
    {"name": "OPV-0", "days_after_birth": 0},
    {"name": "Pentavalent-1", "days_after_birth": 42},
    {"name": "PCV-1", "days_after_birth": 42},
    {"name": "OPV-1", "days_after_birth": 42},
    {"name": "Pentavalent-2", "days_after_birth": 70},
    {"name": "PCV-2", "days_after_birth": 70},
    {"name": "OPV-2", "days_after_birth": 70},
    {"name": "Pentavalent-3", "days_after_birth": 98},
    {"name": "PCV-3", "days_after_birth": 98},
    {"name": "OPV-3", "days_after_birth": 98},
    {"name": "MR-1", "days_after_birth": 270},
]


def _require_string(data: Dict[str, Any], key: str) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise https_fn.HttpsError("invalid-argument", f"{key} is required.")
    return value


def _parse_date(date_text: str) -> dt.date:
    try:
        return dt.date.fromisoformat(date_text)
    except ValueError as exc:
        raise https_fn.HttpsError("invalid-argument", f"Invalid date: {date_text}") from exc


def _date_today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def _make_child_id() -> str:
    return "CH-" + uuid.uuid4().hex[:8].upper()


def _make_qr_png_data_url(child_id: str) -> str:
    qr_payload = f"VAXID:{child_id}"
    image = qrcode.make(qr_payload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _to_plain_dict(snapshot: firestore.DocumentSnapshot) -> Dict[str, Any]:
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return data


def _get_child(child_id: str) -> Dict[str, Any]:
    snapshot = DB.collection("children").document(child_id).get()
    if not snapshot.exists:
        raise https_fn.HttpsError("not-found", f"Child not found: {child_id}")
    return _to_plain_dict(snapshot)


def _query_by_child(collection_name: str, child_id: str) -> List[Dict[str, Any]]:
    snapshots = (
        DB.collection(collection_name)
        .where("child_id", "==", child_id)
        .stream()
    )
    return [_to_plain_dict(s) for s in snapshots]


def _status_for_due_date(due_date_text: str, completed_date: Optional[str]) -> str:
    if completed_date:
        return "completed"
    due_date = _parse_date(due_date_text)
    today = _date_today()
    if due_date < today:
        return "missed"
    if (due_date - today).days <= 7:
        return "due_soon"
    return "due"


def _create_vaccination_schedule(child_id: str, dob_text: str) -> None:
    dob = _parse_date(dob_text)
    batch = DB.batch()

    for item in DEMO_EPI_SCHEDULE:
        due_date = dob + dt.timedelta(days=item["days_after_birth"])
        status = _status_for_due_date(due_date.isoformat(), None)
        doc_ref = DB.collection("vaccination_records").document()
        batch.set(doc_ref, {
            "child_id": child_id,
            "vaccine_name": item["name"],
            "due_date": due_date.isoformat(),
            "completed_date": None,
            "status": status,
            "source": "auto_schedule",
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })

    batch.commit()


def _find_special_review_flags(health_records: List[Dict[str, Any]]) -> List[str]:
    flags: List[str] = []
    for record in health_records:
        searchable = " ".join([
            str(record.get("diagnosis", "")),
            str(record.get("doctor_notes", "")),
            str(record.get("medicine", "")),
        ]).lower()
        for keyword in SPECIAL_REVIEW_KEYWORDS:
            if keyword in searchable and keyword not in flags:
                flags.append(keyword)
    return flags


def _extract_risk_features(vaccinations: List[Dict[str, Any]], health_records: List[Dict[str, Any]], review_flags: List[str]) -> Dict[str, Any]:
    previous_missed = sum(1 for row in vaccinations if row.get("status") == "missed")
    completed_late = 0
    for row in vaccinations:
        due = row.get("due_date")
        completed = row.get("completed_date")
        if due and completed:
            try:
                if _parse_date(completed) > _parse_date(due):
                    completed_late = 1
                    break
            except Exception:
                pass

    return {
        "previous_missed": previous_missed,
        "distance_km": 5,  # Demo value. Replace with map/clinic distance later.
        "late_before": completed_late,
        "parent_response_missing": 0,  # Demo value. Replace with SMS delivery/response data later.
        "health_record_count": len(health_records),
        "review_required": 1 if review_flags else 0,
    }


def _safe_gemini_text(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return (
            "Gemini API key is not configured yet. Demo fallback: child records were checked, "
            "ML risk was calculated, and any vaccine/dose changes must be reviewed by a doctor."
        )

    client = genai.Client(api_key=api_key)
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
    interaction = client.interactions.create(model=model_name, input=prompt)
    return interaction.output_text


def _next_actionable_vaccine(vaccinations: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    active = [
        v for v in vaccinations
        if v.get("status") in {"due", "due_soon", "missed", "review_required"}
    ]
    active.sort(key=lambda item: item.get("due_date", "9999-12-31"))
    return active[0] if active else None


@https_fn.on_call()
def register_child(req: https_fn.CallableRequest) -> Dict[str, Any]:
    data = req.data or {}

    child_name = _require_string(data, "child_name")
    birth_certificate_no = _require_string(data, "birth_certificate_no")
    dob = _require_string(data, "dob")
    parent_name = _require_string(data, "parent_name")
    parent_phone = _require_string(data, "parent_phone")
    preferred_clinic = _require_string(data, "preferred_clinic")
    area = _require_string(data, "area")
    opted_in = bool(data.get("opted_in_vaccination", True))

    _parse_date(dob)

    existing = list(
        DB.collection("children")
        .where("birth_certificate_no", "==", birth_certificate_no)
        .limit(1)
        .stream()
    )
    if existing:
        raise https_fn.HttpsError("already-exists", "This birth certificate number is already registered.")

    child_id = _make_child_id()
    qr_payload = f"VAXID:{child_id}"
    qr_png_data_url = _make_qr_png_data_url(child_id)

    clinic_ref = DB.collection("clinics").document()
    child_ref = DB.collection("children").document(child_id)

    batch = DB.batch()
    batch.set(clinic_ref, {
        "clinic_name": preferred_clinic,
        "area": area,
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    batch.set(child_ref, {
        "child_id": child_id,
        "child_name": child_name,
        "birth_certificate_no": birth_certificate_no,
        "dob": dob,
        "parent_name": parent_name,
        "parent_phone": parent_phone,
        "preferred_clinic_id": clinic_ref.id,
        "preferred_clinic": preferred_clinic,
        "area": area,
        "opted_in_vaccination": opted_in,
        "health_record_consent": True,
        "status": "alive",
        "date_of_death": None,
        "qr_payload": qr_payload,
        "qr_png_data_url": qr_png_data_url,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    batch.commit()

    if opted_in:
        _create_vaccination_schedule(child_id, dob)

    return {
        "ok": True,
        "child_id": child_id,
        "qr_payload": qr_payload,
        "qr_png_data_url": qr_png_data_url,
        "vaccination_schedule_created": opted_in,
    }


@https_fn.on_call()
def ai_child_review(req: https_fn.CallableRequest) -> Dict[str, Any]:
    data = req.data or {}
    child_id = _require_string(data, "child_id")

    child = _get_child(child_id)
    vaccinations = _query_by_child("vaccination_records", child_id)
    health_records = _query_by_child("health_records", child_id)

    review_flags = _find_special_review_flags(health_records)
    risk_features = _extract_risk_features(vaccinations, health_records, review_flags)
    ml_risk = predict_missed_vaccine_risk(risk_features)
    next_vaccine = _next_actionable_vaccine(vaccinations)

    if review_flags and next_vaccine:
        DB.collection("clinical_reviews").add({
            "child_id": child_id,
            "type": "vaccine_or_dose_review",
            "status": "doctor_review_required",
            "reason_keywords": review_flags,
            "related_vaccine": next_vaccine.get("vaccine_name"),
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        # Marking only as review_required, not changing dose/type automatically.
        if next_vaccine.get("id"):
            DB.collection("vaccination_records").document(next_vaccine["id"]).set({
                "status": "review_required",
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)

    prompt = f"""
You are VaxID Bangladesh, a safe vaccination tracking assistant.
You are not a doctor. Do not prescribe vaccines, double doses, or diagnosis.
Use the child records only to create a safe parent/clinic message.
If hospital records suggest special vaccine type or extra dose review, say that a doctor must approve it.
Write in simple English with a short Bangla-friendly style.

Child record:
{child}

Vaccination records:
{vaccinations}

Hospital/diagnosis records:
{health_records}

Special review flags found by rule engine:
{review_flags}

ML missed-vaccine risk result:
{ml_risk}

Next actionable vaccine:
{next_vaccine}

Return:
1. Parent message
2. Clinic message
3. Status summary
4. Safety note
""".strip()

    ai_text = _safe_gemini_text(prompt)

    message_ref = DB.collection("ai_messages").document()
    message_ref.set({
        "child_id": child_id,
        "message_type": "ai_child_review",
        "ai_text": ai_text,
        "ml_risk": ml_risk,
        "review_flags": review_flags,
        "next_vaccine": next_vaccine,
        "created_at": firestore.SERVER_TIMESTAMP,
    })

    return {
        "ok": True,
        "child_id": child_id,
        "ml_risk": ml_risk,
        "review_flags": review_flags,
        "doctor_review_required": bool(review_flags),
        "next_vaccine": next_vaccine,
        "ai_message": ai_text,
        "saved_message_id": message_ref.id,
    }


@https_fn.on_call()
def generate_reminder(req: https_fn.CallableRequest) -> Dict[str, Any]:
    data = req.data or {}
    child_id = _require_string(data, "child_id")

    child = _get_child(child_id)
    vaccinations = _query_by_child("vaccination_records", child_id)
    next_vaccine = _next_actionable_vaccine(vaccinations)

    if not child.get("opted_in_vaccination", False):
        message = "Parent has opted out of vaccination reminders. No reminder generated."
        status = "opted_out"
    elif not next_vaccine:
        message = "No due or missed vaccine found for this child."
        status = "no_action_needed"
    else:
        status = next_vaccine.get("status", "due")
        vaccine_name = next_vaccine.get("vaccine_name", "the next vaccine")
        due_date = next_vaccine.get("due_date", "the scheduled date")
        clinic_name = child.get("preferred_clinic", "your selected clinic")
        child_name = child.get("child_name", "your child")
        message = (
            f"Dear parent, {child_name}'s {vaccine_name} is {status}. "
            f"Due date: {due_date}. Please visit {clinic_name}. "
            "If the child has a serious illness/allergy history, ask the doctor before vaccination."
        )

    reminder_ref = DB.collection("reminders").document()
    reminder_ref.set({
        "child_id": child_id,
        "reminder_type": "SMS_TEXT_DEMO",
        "message": message,
        "status": status,
        "sent": False,
        "created_at": firestore.SERVER_TIMESTAMP,
    })

    return {
        "ok": True,
        "child_id": child_id,
        "reminder_id": reminder_ref.id,
        "status": status,
        "message": message,
    }
