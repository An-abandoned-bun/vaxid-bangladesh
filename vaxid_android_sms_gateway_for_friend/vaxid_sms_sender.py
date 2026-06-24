"""VaxID Android SIM SMS Gateway.
Runs in Termux and sends VaxID vaccination reminders using a real Android SIM.
Do not commit real API keys. Set FIREBASE_WEB_API_KEY locally in Termux.
"""
import os, time, re, subprocess, requests
from datetime import datetime, timezone

PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', 'vaxid-32db2')
API_KEY = os.getenv('FIREBASE_WEB_API_KEY', 'PASTE_FIREBASE_WEB_API_KEY_HERE')
POLL_SECONDS = int(os.getenv('POLL_SECONDS', '10'))
MAX_SMS_PER_RUN = int(os.getenv('MAX_SMS_PER_RUN', '3'))
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents'


def normalize_bd_phone(phone):
    digits = ''.join(ch for ch in str(phone or '') if ch.isdigit())
    if digits.startswith('00880'): digits = digits[2:]
    if digits.startswith('880'): return '+' + digits
    if digits.startswith('0'): return '+88' + digits
    if len(digits) == 10 and digits.startswith('1'): return '+880' + digits
    return '+' + digits


def value_to_py(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'booleanValue' in v: return bool(v['booleanValue'])
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    return v


def doc_to_dict(doc):
    return {k: value_to_py(v) for k, v in doc.get('fields', {}).items()}


def extract_parent_sms_only(message):
    text = str(message or '').replace('\\n', '\n').replace('\r', ' ').strip()
    text = re.sub(r'\s+', ' ', text)

    # Take section 5 only if Groq returned numbered output.
    match = re.search(r'(?:^|\s)5\.\s*(?:Parent SMS/message|Parent SMS|SMS/message|Parent message)?\s*:?\s*(.*?)(?=\s*6\.|\Z)', text, re.S | re.I)
    sms = match.group(1).strip() if match else text.strip()

    quoted = re.search(r'["“](.+?)["”]', sms, re.S)
    if quoted:
        sms = quoted.group(1).strip()

    sms = re.sub(r'^\s*5\.\s*', '', sms, flags=re.I)
    sms = re.sub(r'^\s*(Parent SMS/message|Parent SMS|SMS/message|Parent message)\s*:?\s*', '', sms, flags=re.I)
    sms = re.split(r'\s+6\.\s*|\s+Clinic action\s*:?', sms, maxsplit=1, flags=re.I)[0]
    sms = sms.strip().strip('-').strip().strip('"\'“”')
    sms = re.sub(r'\s+', ' ', sms).strip()
    return sms[:317].rstrip() + '...' if len(sms) > 320 else sms


def get_child(child_id):
    r = requests.get(f'{BASE}/children/{child_id}?key={API_KEY}', timeout=20)
    if r.status_code != 200:
        print('Could not load child:', child_id, r.text)
        return None
    return doc_to_dict(r.json())


def get_pending_reminders():
    body = {
        'structuredQuery': {
            'from': [{'collectionId': 'reminders'}],
            'where': {
                'fieldFilter': {
                    'field': {'fieldPath': 'status'},
                    'op': 'EQUAL',
                    'value': {'stringValue': 'generated_by_groq'}
                }
            },
            'limit': MAX_SMS_PER_RUN
        }
    }
    r = requests.post(f'{BASE}:runQuery?key={API_KEY}', json=body, timeout=20)
    r.raise_for_status()
    reminders = []
    for item in r.json():
        doc = item.get('document')
        if doc:
            reminders.append({'id': doc['name'].split('/')[-1], 'data': doc_to_dict(doc)})
    return reminders


def update_reminder_status(reminder_id, status, note=''):
    url = (f'{BASE}/reminders/{reminder_id}?key={API_KEY}'
           '&updateMask.fieldPaths=status&updateMask.fieldPaths=sent_at&updateMask.fieldPaths=gateway_note')
    body = {'fields': {
        'status': {'stringValue': status},
        'sent_at': {'stringValue': datetime.now(timezone.utc).isoformat()},
        'gateway_note': {'stringValue': note}
    }}
    r = requests.patch(url, json=body, timeout=20)
    if r.status_code not in (200, 201): print('Failed to update reminder:', r.text)


def send_sms(phone, message):
    phone = normalize_bd_phone(phone)
    print('Sending SMS to:', phone)
    print('Message:', message)
    subprocess.run(['termux-sms-send', '-n', phone, message], check=True)


def main():
    print('VaxID Android SIM SMS Gateway started')
    print('Project:', PROJECT_ID)
    if API_KEY == 'PASTE_FIREBASE_WEB_API_KEY_HERE' or not API_KEY:
        print('ERROR: Set your Firebase API key first:')
        print('export FIREBASE_WEB_API_KEY="YOUR_FIREBASE_API_KEY"')
        return
    while True:
        try:
            reminders = get_pending_reminders()
            if not reminders:
                print('No pending SMS.')
                time.sleep(POLL_SECONDS)
                continue
            for reminder in reminders:
                rid, data = reminder['id'], reminder['data']
                child_id = data.get('child_id')
                message = extract_parent_sms_only(data.get('message'))
                if not child_id or not message:
                    update_reminder_status(rid, 'failed_missing_child_or_message'); continue
                child = get_child(child_id)
                if not child:
                    update_reminder_status(rid, 'failed_child_not_found'); continue
                phone = child.get('parent_phone')
                if not phone:
                    update_reminder_status(rid, 'failed_no_parent_phone'); continue
                try:
                    send_sms(phone, message)
                    update_reminder_status(rid, 'sent_by_android_sim', f'Sent to {normalize_bd_phone(phone)}')
                    print('SMS sent successfully for', child_id)
                except Exception as e:
                    print('SMS failed:', e)
                    update_reminder_status(rid, 'failed_sms_send', str(e))
        except Exception as e:
            print('Gateway error:', e)
        time.sleep(POLL_SECONDS)

if __name__ == '__main__':
    main()
