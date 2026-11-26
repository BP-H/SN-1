"""Transactional buyer receipts, delivered from verified Stripe events."""
import os
import time
from email.message import EmailMessage
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy import update

try:
    from .mail_transport import deliver_message
    from .shop_models import Order, Piece, Shop
except ImportError:
    from mail_transport import deliver_message
    from shop_models import Order, Piece, Shop


def send_receipt(db, order, session, site):
    if os.getenv("SHOP_RECEIPT_EMAILS") != "1" or order.receipt_sent:
        return
    recipient = (session.get("customer_details") or {}).get("email")
    if not recipient:
        return
    host, sender = os.getenv("SMTP_HOST"), os.getenv("SMTP_FROM") or os.getenv("MAIL_FROM")
    if not host or not sender:
        raise HTTPException(503, "Shop receipt email is awaiting configuration.")
    now = int(time.time())
    claimed = db.execute(update(Order).where(Order.id == order.id, Order.receipt_sent.is_(False),
                                             Order.mail_lease < now - 90).values(mail_lease=now))
    db.commit()
    if not claimed.rowcount:
        if not db.get(Order, order.id).receipt_sent:
            raise HTTPException(503, "Receipt delivery in progress.")
        return
    try:
        piece = db.get(Piece, order.piece_id)
        shop = db.get(Shop, piece.owner_id)
        message = EmailMessage()
        message["From"], message["To"] = sender, recipient
        message["Reply-To"] = shop.contact
        message["Subject"] = "Your order from " + " ".join(shop.name.splitlines())
        message["Message-ID"] = f"<shop-{order.id}@{urlsplit(site).hostname}>"
        message.set_content(f"Thank you for purchasing {piece.title} from {shop.name}.\n\n"
                            f"Your private receipt and delivery details:\n"
                            f"{site}/shop/receipt/{order.id}#session_id={order.session_id}\n\n"
                            f"The artist’s permanent story:\n{site}/pieces/{piece.id}\n\n"
                            f"Order questions: {shop.contact}")
        deliver_message(message, host=host, port=int(os.getenv("SMTP_PORT", "587")),
                        username=os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER"), password=os.getenv("SMTP_PASSWORD"),
                        use_tls=os.getenv("SMTP_TLS", "true").lower() not in ("0", "false", "off"))
    except (OSError, ValueError, RuntimeError):
        order.mail_lease = 0
        db.commit()
        raise HTTPException(503, "Receipt delivery will retry.") from None
    order.receipt_sent = True
    db.commit()
