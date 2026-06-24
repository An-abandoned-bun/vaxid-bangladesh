#!/data/data/com.termux/files/usr/bin/bash
if [ -z "$FIREBASE_WEB_API_KEY" ]; then
  echo "Set FIREBASE_WEB_API_KEY first."
  exit 1
fi
python vaxid_sms_sender.py
