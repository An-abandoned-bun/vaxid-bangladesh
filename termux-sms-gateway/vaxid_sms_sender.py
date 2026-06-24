import os
import time
import requests
import subprocess
from datetime import datetime, timezone

PROJECT_ID = "vaxid-32db2"

# Do not hardcode your Firebase API key in GitHub.
# On your phone, set it using:
# export FIREBASE_WEB_API_KEY="YOUR_FIREBASE_API_KEY"
API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "PASTE_FIREBASE_WEB_API_KEY_HERE")

POLL_SECONDS = 10
MAX_SMS_PER_RUN = 3

BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"


def normalize_bd_phone(phone):
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())

    if digits.startswith("00880"):
        digits = digits[2:]

    if digits.startswith("880"):
        return "+" + digits

    if digits.startswith("0"):
        return "+88" + digits

    if len(digits) == 10 and digits.startswith("1"):
        return "+880" + digits

    return "+" + digits


def firestore_value_to_python(value):
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    return value


def doc_to_dict(doc):
    fields = doc.get("fields", {})
    return {key: firestore_value_to_python(value) for key, value in fields.items()}


def extract_parent_sms_only(message):
    import re

    text = str(message or "").replace("\\n", "\n").replace("\r", " ").strip()
    text = re.sub(r"\s+", " ", text)

    quoted_after_5 = re.findall(
        r"(?:^|\s)5\.\s*[\"“](.+?)[\"”](?=\s*(?:6\.|$))",
        text,
        flags=re.I
    )

    if quoted_after_5:
        sms = quoted_after_5[-1].strip()
    else:
        match = re.search(
            r"(?:^|\s)5\.\s*(?:Parent SMS/message|Parent SMS|SMS/message|Parent message)?\s*:?\s*(.*?)(?=\s*6\.|\Z)",
            text,
            flags=re.S | re.I
        )

        if match:
            sms = match.group(1).strip()
            quoted = re.search(r"[\"“](.+?)[\"”]", sms, flags=re.S)
            if quoted:
                sms = quoted.group(1).strip()
        else:
            sms = text.strip()

    sms = re.sub(r"^\s*5\.\s*", "", sms, flags=re.I)
    sms = re.sub(r"^\s*(Parent SMS/message|Parent SMS|SMS/message|Parent message)\s*:?\s*", "", sms, flags=re.I)
    sms = re.split(r"\s+6\.\s*|\s+Clinic action\s*:?", sms, maxsplit=1, flags=re.I)[0]

    sms = sms.strip().strip("-").strip().strip("\"'“”")
    sms = re.sub(r"\s+", " ", sms).strip()

    if len(sms) > 320:
        sms = sms[:317].rstrip() + "..."

    return sms


def get_child(child_id):
    url = f"{BASE}/children/{child_id}?key={API_KEY}"
    response = requests.get(url, timeout=20)

    if response.status_code != 200:
        print("Could not load child:", child_id, response.text)
        return None

    return doc_to_dict(response.json())


def get_pending_reminders():
    url = f"{BASE}:runQuery?key={API_KEY}"

    body = {
        "structuredQuery": {
            "from": [{"collectionId": "reminders"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "status"},
                    "op": "EQUAL",
                    "value": {"stringValue": "generated_by_groq"}
                }
            },
            "limit": MAX_SMS_PER_RUN
        }
    }

    response = requests.post(url, json=body, timeout=20)
    response.raise_for_status()

    reminders = []

    for item in response.json():
        doc = item.get("document")
        if not doc:
            continue

        data = doc_to_dict(doc)
        doc_path = doc["name"]
        doc_id = doc_path.split("/")[-1]

        reminders.append({
            "id": doc_id,
            "path": doc_path,
            "data": data
        })

    return reminders


def update_reminder_status(reminder_id, status, note=""):
    url = (
        f"{BASE}/reminders/{reminder_id}"
        f"?key={API_KEY}"
        f"&updateMask.fieldPaths=status"
        f"&updateMask.fieldPaths=sent_at"
        f"&updateMask.fieldPaths=gateway_note"
    )

    body = {
        "fields": {
            "status": {"stringValue": status},
            "sent_at": {"stringValue": datetime.now(timezone.utc).isoformat()},
            "gateway_note": {"stringValue": note}
        }
    }

    response = requests.patch(url, json=body, timeout=20)

    if response.status_code not in [200, 201]:
        print("Failed to update reminder:", reminder_id, response.text)


def send_sms(phone, message):
    phone = normalize_bd_phone(phone)

    print("Sending SMS to:", phone)

    subprocess.run(
        ["termux-sms-send", "-n", phone, message],
        check=True
    )


def main():
    print("VaxID Android SIM SMS Gateway started.")
    print("Checking Firestore every", POLL_SECONDS, "seconds.")

    if API_KEY == "PASTE_FIREBASE_WEB_API_KEY_HERE":
        print("ERROR: FIREBASE_WEB_API_KEY is not set.")
        print("Run this in Termux first:")
        print('export FIREBASE_WEB_API_KEY="YOUR_FIREBASE_API_KEY"')
        return

    while True:
        try:
            reminders = get_pending_reminders()

            if not reminders:
                print("No pending SMS.")
                time.sleep(POLL_SECONDS)
                continue

            for reminder in reminders:
                reminder_id = reminder["id"]
                data = reminder["data"]

                child_id = data.get("child_id")
                message = extract_parent_sms_only(data.get("message"))

                if not child_id or not message:
                    update_reminder_status(reminder_id, "failed_missing_child_or_message")
                    continue

                child = get_child(child_id)

                if not child:
                    update_reminder_status(reminder_id, "failed_child_not_found")
                    continue

                phone = child.get("parent_phone")

                if not phone:
                    update_reminder_status(reminder_id, "failed_no_parent_phone")
                    continue

                try:
                    send_sms(phone, message)

                    update_reminder_status(
                        reminder_id,
                        "sent_by_android_sim",
                        f"Sent to {normalize_bd_phone(phone)}"
                    )

                    print("SMS sent successfully for", child_id)

                except Exception as sms_error:
                    print("SMS failed:", sms_error)

                    update_reminder_status(
                        reminder_id,
                        "failed_sms_send",
                        str(sms_error)
                    )

        except Exception as error:
            print("Gateway error:", error)

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
