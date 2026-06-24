#!/data/data/com.termux/files/usr/bin/bash
pkg update -y
pkg upgrade -y
pkg install python termux-api nano -y
pip install requests
echo "Now run: export FIREBASE_WEB_API_KEY=\"YOUR_KEY\""
echo "Then run: python vaxid_sms_sender.py"
