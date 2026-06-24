# Architecture

```text
Firebase Hosting frontend
  └── creates reminder document
        └── Firestore reminders collection
              └── Android Termux gateway polls pending reminders
                    └── termux-sms-send sends SMS from SIM
                          └── Firestore status updated
```

## Reminder statuses

- generated_by_groq
- sent_by_android_sim
- failed_no_parent_phone
- failed_child_not_found
- failed_missing_child_or_message
- failed_sms_send
