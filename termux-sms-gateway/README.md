# VaxID Termux SMS Gateway

This folder contains the Android Termux prototype used by VaxID Bangladesh to send vaccination reminder SMS automatically from a real SIM card.

## How it works

VaxID creates a reminder in Firestore.

The Android phone running Termux checks Firestore every few seconds.

If a reminder is pending, the phone sends the parent SMS using:

termux-sms-send

Then Firestore is updated to:

sent_by_android_sim

## Important

The Firebase API key is not stored in this GitHub repository.

On the Android phone, set it locally:

export FIREBASE_WEB_API_KEY="YOUR_FIREBASE_API_KEY"

Then run:

python vaxid_sms_sender.py

## Required Android apps

- Termux
- Termux:API

## Required Termux packages

pkg install python termux-api
pip install requests

## Prototype note

This is for demo and pilot testing. In production, VaxID should connect to a licensed SMS gateway for hospital-scale messaging.
