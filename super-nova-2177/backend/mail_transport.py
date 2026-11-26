"""Shared SMTP transport for transactional mail."""
import smtplib


def deliver_message(message, *, host, port, username, password, use_tls):
    transport = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
    with transport(host, port, timeout=12) as smtp:
        if port != 465 and use_tls:
            smtp.starttls()
        if username or password:
            smtp.login(username, password)
        smtp.send_message(message)
