# VaxID Android SIM SMS Gateway

This is the Android/Termux SMS automation module for **VaxID Bangladesh**.

It lets a real Android phone send vaccination reminder SMS from its SIM card for the VaxID prototype.

## How it works

```text
VaxID website creates reminder in Firestore
↓
Termux script checks Firestore
↓
Android phone sends SMS using termux-sms-send
↓
Firestore reminder status becomes sent_by_android_sim
```

## Tech stack

- Python
- Termux
- Termux:API
- Firebase Firestore REST API
- Android SIM SMS

## Install on Android

Install:

- Termux
- Termux:API

Then run:

```bash
pkg update -y
pkg upgrade -y
pkg install python termux-api nano -y
pip install requests
```

Give SMS permission:

```text
Android Settings → Apps → Termux:API → Permissions → SMS → Allow
```

Test:

```bash
termux-sms-send -n +88017XXXXXXXX "VaxID test SMS"
```

## Configure

Never put real API keys in GitHub.

On the phone, run:

```bash
export FIREBASE_WEB_API_KEY="YOUR_FIREBASE_WEB_API_KEY"
export FIREBASE_PROJECT_ID="vaxid-32db2"
```

## Run

```bash
python vaxid_sms_sender.py
```

## Firestore requirement

The script looks for reminders where:

```text
status = generated_by_groq
```

After sending:

```text
status = sent_by_android_sim
```

## Safety

This is for prototype/demo use. For production, VaxID should use a licensed SMS gateway.
