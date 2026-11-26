"""Opt-in creator shops, guest checkout, and permanent edition pages."""
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import quote, urlsplit
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError

try:
    from ..shop_models import Order, Piece, Shop, new_id
    from ..shop_mail import send_receipt
    from ..shop_stripe import StripeGateway
except ImportError:
    from shop_models import Order, Piece, Shop, new_id
    from shop_mail import send_receipt
    from shop_stripe import StripeGateway


class ShopSettings(BaseModel):
    name: str = Field(min_length=1, max_length=90)
    contact: EmailStr
    terms: str = Field(min_length=1, max_length=1200)
    enabled: bool


class NewPiece(BaseModel):
    code: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,47}$")
    artist: str = Field(min_length=1, max_length=90)
    alt: str = Field(min_length=1, max_length=350)
    video: str = Field(default="", max_length=1600)
    medium: Literal["magnet", "art", "apparel", "other", "download"]
    tax_code: str = Field(pattern=r"^txcd_[0-9]{8}$")
    title: str = Field(min_length=1, max_length=120)
    story: str = Field(min_length=1, max_length=4000)
    image: str = Field(min_length=1, max_length=1600)
    kind: Literal["physical", "digital"]
    price: int = Field(ge=50, le=99999999)
    edition: int = Field(default=1, ge=1, le=10000)

    @field_validator("video")
    @classmethod
    def video_source(cls, value):
        if value and (urlsplit(value).scheme != "https" or not urlsplit(value).hostname):
            raise ValueError("Use an HTTPS link to the artist film.")
        return value

    @field_validator("image")
    @classmethod
    def image_source(cls, value):
        if value == "/shop-assets/gugu-sf.webp":
            return value
        url = urlsplit(value)
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Use a public HTTPS image URL.")
        return value


class Visibility(BaseModel):
    published: bool


class Checkout(BaseModel):
    attempt: UUID
    delivery: Literal["ship", "pickup", "digital"]


def official_id():
    value = os.getenv("SUPERNOVA_SHOP_OWNER_ID", "")
    return int(value) if value.isdecimal() else None


def site_url():
    return os.getenv("SHOP_SITE_URL", "https://www.2177.tech").rstrip("/")


def charge_type(owner_id):
    if owner_id == official_id() or os.getenv("SHOP_MARKETPLACE_TAX_OWNER") == "seller":
        return "direct"
    if os.getenv("SHOP_MARKETPLACE_TAX_OWNER") == "platform" and os.getenv("STRIPE_PLATFORM_WEBHOOK_SECRET"):
        return "destination"
    return None


def seller_permitted(owner_id):
    return charge_type(owner_id) is not None


def pickup_end():
    try:
        end = datetime.fromisoformat(os.getenv("SHOP_REDWOOD_PICKUP_END", "").replace("Z", "+00:00"))
        return int(end.timestamp()) if end.tzinfo else 0
    except (ValueError, OverflowError):
        return 0


def pickup(shop):
    if (shop.owner_id == official_id() and os.getenv("SHOP_REDWOOD_PICKUP_TAX_RATE")
            and pickup_end() - time.time() >= 31 * 60):
        return os.getenv("SHOP_REDWOOD_PICKUP_LABEL", "").strip()
    return ""


def shop_path(db, owner_id):
    shop = db.get(Shop, owner_id)
    return f"/shops/{owner_id}" if shop and shop.enabled else None


def public_shop(shop):
    return {"owner_id": shop.owner_id, "name": shop.name, "official": shop.owner_id == official_id(),
            "path": f"/shops/{shop.owner_id}", "contact": shop.contact, "terms": shop.terms}


def public_piece(piece):
    return {"id": piece.id, "title": piece.title, "story": piece.story, "image": piece.image,
            "kind": piece.kind, "price": piece.price, "artist": piece.artist, "alt": piece.alt,
            "medium": piece.medium, "code": piece.code, "video": piece.video, "edition": piece.edition,
            "remaining": piece.remaining, "sold": piece.sold, "published": piece.published, "released": piece.released}


def settle(db, order, session, account):
    """Only a bound provider session can release inventory or fulfill this order."""
    meta = session.get("metadata") or {}
    if (account != order.processor_account or session.get("client_reference_id") != order.id
            or meta.get("piece") != order.piece_id or meta.get("order") != order.id
            or session.get("mode") != "payment" or (order.session_id and order.session_id != session["id"])):
        return False
    piece = db.get(Piece, order.piece_id)
    if session.get("status") == "expired":
        state = "expired"
    elif (session.get("status") == "complete" and session.get("payment_status") == "paid"
          and session.get("currency") == "usd" and session.get("amount_subtotal") == piece.price):
        state = "paid"
    else:
        return False
    changed = db.execute(update(Order).where(Order.id == order.id, Order.status == "reserved")
                         .values(status=state, session_id=session["id"], intent=session.get("payment_intent"),
                                 payment_state="paid" if state == "paid" else "unpaid"))
    if changed.rowcount and state == "paid":
        db.execute(update(Piece).where(Piece.id == piece.id).values(sold=Piece.sold + 1))
    elif changed.rowcount and piece.edition is not None:
        db.execute(update(Piece).where(Piece.id == piece.id).values(remaining=Piece.remaining + 1))
    db.commit()
    return True


def provider(call, *args):
    try:
        return call(*args)
    except stripe.StripeError:
        raise HTTPException(503, "Stripe could not complete this request. Please try again.") from None


def recover_expired(db, gateway, piece):
    now = int(time.time())
    stale = db.scalars(select(Order).where(Order.piece_id == piece.id, Order.status == "reserved",
                                           Order.expires < now - 60).limit(20)).all()
    for order in stale:
        session = (provider(gateway.session, order.processor_account, order.session_id) if order.session_id
                   else provider(gateway.find_session, order))
        if session:
            settle(db, order, session, order.processor_account)
        elif not order.session_id:
            # Stripe confirms no session during its entire possible creation window.
            # The frozen expiry also makes any future attempt for this order invalid.
            changed = db.execute(update(Order).where(Order.id == order.id, Order.status == "reserved")
                                 .values(status="expired"))
            if changed.rowcount and piece.edition is not None:
                db.execute(update(Piece).where(Piece.id == piece.id).values(remaining=Piece.remaining + 1))
            db.commit()


def checkout_params(piece, order_id, delivery, label, expires):
    line = {"quantity": 1, "price_data": {"currency": "usd", "unit_amount": piece.price,
            "tax_behavior": "exclusive", "product_data": {"name": piece.title, "tax_code": piece.tax_code}}}
    meta = {"order": order_id, "piece": piece.id, "seller": str(piece.owner_id), "delivery": delivery}
    params = {"mode": "payment", "payment_method_types": ["card"], "client_reference_id": order_id,
              "line_items": [line], "metadata": meta, "payment_intent_data": {"metadata": meta},
              "expires_at": expires, "cancel_url": f"{site_url()}/pieces/{piece.id}",
              "success_url": f"{site_url()}/shop/receipt/{order_id}#session_id={{CHECKOUT_SESSION_ID}}"}
    if delivery == "pickup":
        line["tax_rates"] = [os.environ["SHOP_REDWOOD_PICKUP_TAX_RATE"]]
        params["custom_text"] = {"submit": {"message": label[:500]}}
    else:
        params["automatic_tax"] = {"enabled": True}
        if delivery == "ship":
            params["shipping_address_collection"] = {"allowed_countries": ["US"]}
        else:
            params["billing_address_collection"] = "required"
    return params


def create_shop_router(get_db, authenticate, gateway=None, profile_name_for=None):
    gateway = gateway or StripeGateway()
    router = APIRouter(prefix="/commerce", tags=["shops"])

    def description(db, shop):
        data = public_shop(shop)
        username = profile_name_for(db, shop.owner_id) if profile_name_for else None
        data["profile_path"] = "/users/" + quote(username, safe="") if username else None
        return data

    def owner(authorization: Optional[str] = Header(None), db=Depends(get_db)):
        return authenticate(authorization, db)

    def mine(db, user):
        shop = db.get(Shop, user.id)
        if shop is None:
            shop = Shop(owner_id=user.id, name=user.username)
            db.add(shop)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                shop = db.get(Shop, user.id)
                if shop is None:
                    raise
        return shop

    def owned_piece(db, user, piece_id):
        piece = db.get(Piece, str(piece_id))
        if not piece or piece.owner_id != user.id:
            raise HTTPException(404, "Piece not found.")
        return piece

    def view_shop(db, shop):
        if not shop or not shop.enabled:
            raise HTTPException(404, "Shop has not opened.")
        pieces = db.scalars(select(Piece).where(Piece.owner_id == shop.owner_id, Piece.released.is_(True))
                           .order_by(Piece.created.desc())).all()
        return {**description(db, shop), "pieces": [public_piece(p) for p in pieces]}

    @router.get("/official")
    def official(db=Depends(get_db)):
        owner_id = official_id()
        if owner_id is None:
            raise HTTPException(404, "The official collection has not opened.")
        return view_shop(db, db.get(Shop, owner_id))

    @router.get("/shops/{owner_id}")
    def storefront(owner_id: int, db=Depends(get_db)):
        return view_shop(db, db.get(Shop, owner_id))

    @router.get("/pieces/{piece_id}")
    def piece_page(piece_id: UUID, db=Depends(get_db)):
        piece = db.get(Piece, str(piece_id))
        if not piece or not piece.released:
            raise HTTPException(404, "Piece not found.")
        shop = db.get(Shop, piece.owner_id)
        if gateway.configured and piece.published and shop.enabled and piece.remaining == 0 and piece.sold < piece.edition:
            try:
                recover_expired(db, gateway, piece)
            except HTTPException as error:
                if error.status_code != 503:
                    raise
                # Keep the story available and preserve the hold during a provider outage.
                db.rollback()
        available = bool(shop.enabled and shop.ready and gateway.configured and seller_permitted(shop.owner_id)
                         and piece.published and (piece.remaining is None or piece.remaining > 0))
        return {**public_piece(piece), "shop": description(db, shop), "open": shop.enabled, "available": available,
                "pickup": pickup(shop) if available and piece.pickup_enabled and piece.kind == "physical" else ""}

    @router.get("/me")
    def settings(user=Depends(owner), db=Depends(get_db)):
        shop = mine(db, user)
        if shop.account and gateway.configured:
            try:
                shop.ready = gateway.account_ready(shop.account)
            except stripe.PermissionError:
                shop.ready = False
            except stripe.StripeError:
                pass  # Keep the last observed readiness while Stripe is unavailable.
            db.commit()
        pieces = db.scalars(select(Piece).where(Piece.owner_id == user.id).order_by(Piece.created.desc())).all()
        return {**description(db, shop), "enabled": shop.enabled, "connected": bool(shop.account), "ready": shop.ready,
                "can_connect": gateway.configured, "can_sell": seller_permitted(user.id),
                "pieces": [{**public_piece(p), "has_file": bool(p.filename), "tax_code": p.tax_code, "pickup_enabled": p.pickup_enabled} for p in pieces]}

    @router.put("/me")
    def save(settings: ShopSettings, user=Depends(owner), db=Depends(get_db)):
        shop = mine(db, user)
        name = settings.name.strip()
        if not name:
            raise HTTPException(422, "Enter a shop name.")
        if not settings.terms.strip():
            raise HTTPException(422, "Add fulfillment and returns terms.")
        shop.name, shop.enabled = name, settings.enabled
        shop.contact, shop.terms = str(settings.contact), settings.terms.strip()
        db.commit()
        return description(db, shop)

    @router.post("/me/connect")
    def connect(user=Depends(owner), db=Depends(get_db)):
        shop = mine(db, user)
        if not shop.account:
            shop.account = provider(gateway.new_account, user.id, shop.connect_key)
            db.commit()
        return {"url": provider(gateway.onboarding, shop.account, site_url())}

    def save_draft(db, user, data, piece=None):
        mine(db, user)
        stock = data.edition if data.kind == "physical" else None
        if (data.medium == "download") != (data.kind == "digital"):
            raise HTTPException(422, "Choose a medium that matches the delivery type.")
        if data.medium == "magnet" and user.id == official_id() and stock != 1:
            raise HTTPException(422, "Each official collectible magnet has one physical copy.")
        if not all(v.strip() for v in (data.title, data.story, data.artist, data.alt)):
            raise HTTPException(422, "Enter a title and an artist story.")
        fields = dict(title=data.title.strip(), story=data.story.strip(), image=data.image, kind=data.kind,
                      price=data.price, edition=stock, remaining=stock, code=data.code.upper(),
                      artist=data.artist.strip(), alt=data.alt.strip(), medium=data.medium,
                      video=data.video, tax_code=data.tax_code)
        try:
            if piece:
                if piece.kind != data.kind:
                    fields.update(filename=None, content=None)
                changed = db.execute(update(Piece).where(Piece.id == piece.id, Piece.released.is_(False)).values(**fields))
                if not changed.rowcount:
                    raise HTTPException(409, "Released editions keep their original details.")
            else:
                piece = Piece(owner_id=user.id, **fields)
                db.add(piece)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "This edition code has already been used in your shop.") from None
        return public_piece(piece)

    @router.post("/me/pieces", status_code=201)
    def draft(data: NewPiece, user=Depends(owner), db=Depends(get_db)):
        return save_draft(db, user, data)

    @router.put("/me/pieces/{piece_id}")
    def edit(piece_id: UUID, data: NewPiece, user=Depends(owner), db=Depends(get_db)):
        return save_draft(db, user, data, owned_piece(db, user, piece_id))

    @router.put("/me/pieces/{piece_id}/file")
    async def upload(piece_id: UUID, file: UploadFile = File(...), user=Depends(owner), db=Depends(get_db)):
        piece = owned_piece(db, user, piece_id)
        if piece.kind != "digital" or piece.released:
            raise HTTPException(409, "Attach a file to an unreleased digital edition.")
        content = await file.read(10 * 1024 * 1024 + 1)
        if not content or len(content) > 10 * 1024 * 1024:
            raise HTTPException(422, "Choose a nonempty file up to 10 MB.")
        name = Path(file.filename or "download").name[:160]
        changed = db.execute(update(Piece).where(Piece.id == piece.id, Piece.released.is_(False))
                             .values(filename=name or "download", content=content))
        if not changed.rowcount:
            raise HTTPException(409, "This edition is already released.")
        db.commit()
        return {"saved": True}

    @router.put("/me/pieces/{piece_id}/pickup")
    def pickup_inventory(piece_id: UUID, enabled: bool, user=Depends(owner), db=Depends(get_db)):
        piece = owned_piece(db, user, piece_id)
        if user.id != official_id() or piece.kind != "physical":
            raise HTTPException(409, "Event pickup is for the official physical collection.")
        piece.pickup_enabled = enabled
        db.commit()
        return {"pickup_enabled": enabled}

    @router.put("/me/pieces/{piece_id}/visibility")
    def publish(piece_id: UUID, visibility: Visibility, user=Depends(owner), db=Depends(get_db)):
        piece = owned_piece(db, user, piece_id)
        shop = db.get(Shop, user.id)
        if visibility.published:
            if not (shop.enabled and shop.ready and gateway.configured and seller_permitted(user.id)):
                raise HTTPException(409, "Enable the shop and finish payment setup before publishing.")
            published = db.execute(update(Piece).where(Piece.id == piece.id,
                                   or_(Piece.kind == "physical", Piece.filename.is_not(None)))
                                   .values(released=True, published=True))
            if not published.rowcount:
                raise HTTPException(409, "Attach the buyer's download before publishing.")
        else:
            piece.published = False
        db.commit()
        return public_piece(piece)

    @router.post("/pieces/{piece_id}/checkout")
    def checkout(piece_id: UUID, body: Checkout, db=Depends(get_db)):
        piece = db.get(Piece, str(piece_id))
        if not piece or not piece.published:
            raise HTTPException(404, "This piece is unavailable.")
        shop = db.get(Shop, piece.owner_id)
        if not (shop.enabled and shop.ready and gateway.configured and seller_permitted(shop.owner_id)):
            raise HTTPException(409, "This shop is not taking orders.")
        label = pickup(shop) if piece.pickup_enabled else ""
        methods = ["digital"] if piece.kind == "digital" else ["ship"] + (["pickup"] if label else [])
        if body.delivery not in methods:
            raise HTTPException(422, "Choose an available delivery option.")
        key = str(body.attempt)
        order = db.get(Order, key)
        if not order:
            if piece.edition is not None:
                recover_expired(db, gateway, piece)
            now = int(time.time())
            expires = min(now + 3600, pickup_end()) if body.delivery == "pickup" else now + 3600
            params = checkout_params(piece, key, body.delivery, label, expires)
            mode = charge_type(shop.owner_id)
            if mode == "destination":
                params["automatic_tax"]["liability"] = {"type": "self"}
                params["payment_intent_data"]["transfer_data"] = {"destination": shop.account, "amount": piece.price}
            # Claim the attempt before stock. A racing retry finds the same order.
            order = Order(id=key, piece_id=piece.id, account=shop.account, delivery=body.delivery, charge_type=mode,
                          checkout_params=json.dumps(params), created=now, expires=expires)
            db.add(order)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                order = db.get(Order, key)
                if not order:
                    raise
            else:
                if piece.edition is not None:
                    claim = db.execute(update(Piece).where(Piece.id == piece.id, Piece.remaining > 0,
                                                          Piece.published.is_(True)).values(remaining=Piece.remaining - 1))
                    if not claim.rowcount:
                        db.rollback()
                        raise HTTPException(409, "Another collector has reserved or purchased this edition.")
                db.commit()
        if order.piece_id != piece.id or order.delivery != body.delivery or order.account != shop.account:
            raise HTTPException(409, "Start a new checkout for this piece.")
        if order.status != "reserved" or order.expires <= time.time():
            raise HTTPException(410, "This checkout has ended. Start a new checkout.")
        if not order.session_url:
            try:
                session = gateway.create_session(order, json.loads(order.checkout_params))
            except stripe.InvalidRequestError:
                # An invalid parameter can also be returned when retrying late. Verify
                # whether the first request created a session before releasing stock.
                raise HTTPException(503, "Checkout setup needs attention. Please contact the seller.") from None
            except stripe.StripeError:
                raise HTTPException(503, "Checkout is connecting. Retry with the same browser.") from None
            order.session_id, order.session_url = session["id"], session["url"]
            db.commit()
        return {"url": order.session_url}

    def refresh_payment(db, order):
        state = provider(gateway.payment_state, order)
        if order.payment_state != state:
            order.payment_state = state
            db.commit()
        return state

    async def handle_event(request, db, platform):
        event = gateway.event(await request.body(), request.headers.get("stripe-signature", ""), platform)
        account, obj = event.get("account"), event["data"]["object"]
        if bool(account) == platform:
            return {"received": True}
        if event["type"] in ("checkout.session.completed", "checkout.session.expired"):
            key = (obj.get("metadata") or {}).get("order")
            order = db.get(Order, key) if key else None
            if order and settle(db, order, obj, account) and order.status == "paid" and obj.get("payment_status") == "paid":
                state = refresh_payment(db, order)
                if state == "processing":
                    raise HTTPException(503, "Waiting for the confirmed charge details.")
                if state in ("paid", "partially_refunded"):
                    send_receipt(db, order, obj, site_url())
        elif event["type"] in ("charge.refunded", "charge.dispute.created", "charge.dispute.closed"):
            intent = obj.get("payment_intent")
            if intent:
                order = db.scalar(select(Order).where(Order.intent == intent, Order.status == "paid"))
                if order and order.processor_account == account:
                    refresh_payment(db, order)
        elif account and event["type"] in ("account.updated", "account.application.deauthorized"):
            shop = db.scalar(select(Shop).where(Shop.account == account))
            if shop:
                # Retrieve current state so an older event cannot re-enable checkout.
                if event["type"] == "account.application.deauthorized":
                    shop.ready = False
                    shop.account = None
                    shop.connect_key = new_id()
                else:
                    shop.ready = provider(gateway.account_ready, account)
                db.commit()
        return {"received": True}

    @router.post("/stripe/events")
    async def connect_events(request: Request, db=Depends(get_db)):
        return await handle_event(request, db, False)

    @router.post("/stripe/platform-events")
    async def platform_events(request: Request, db=Depends(get_db)):
        return await handle_event(request, db, True)

    def receipt_order(db, order_id, auth):
        session_id = (auth or "").removeprefix("Bearer ")
        if not re.fullmatch(r"cs_[a-zA-Z0-9_]{6,150}", session_id):
            raise HTTPException(404, "Receipt not found.")
        order = db.get(Order, str(order_id))
        if not order or (order.session_id and order.session_id != session_id):
            raise HTTPException(404, "Receipt not found.")
        if order.status == "reserved":
            session = provider(gateway.session, order.processor_account, session_id)
            if not settle(db, order, session, order.processor_account):
                raise HTTPException(409, "Payment is not confirmed yet.")
        if order.status != "paid" or order.session_id != session_id:
            raise HTTPException(404, "Paid receipt not found.")
        return order

    @router.get("/orders/{order_id}/receipt")
    def receipt(order_id: UUID, response: Response, authorization: Optional[str] = Header(None), db=Depends(get_db)):
        order = receipt_order(db, order_id, authorization)
        response.headers["Cache-Control"] = "private, no-store"
        piece = db.get(Piece, order.piece_id)
        message = (json.loads(order.checkout_params).get("custom_text") or {}).get("submit", {}).get("message", "")
        return {"title": piece.title, "piece_id": piece.id, "delivery": order.delivery,
                "filename": piece.filename, "pickup": message, "payment_state": order.payment_state}

    @router.get("/orders/{order_id}/download")
    def download(order_id: UUID, authorization: Optional[str] = Header(None), db=Depends(get_db)):
        order = receipt_order(db, order_id, authorization)
        if order.delivery != "digital" or refresh_payment(db, order) not in ("paid", "partially_refunded"):
            raise HTTPException(403, "This download is unavailable.")
        piece = db.get(Piece, order.piece_id)
        return Response(piece.content, media_type="application/octet-stream", headers={
            "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "attachment; filename*=UTF-8''" + quote(piece.filename, safe="")})

    @router.get("/me/orders")
    def orders(user=Depends(owner), db=Depends(get_db)):
        rows = db.execute(select(Order, Piece.title).join(Piece, Order.piece_id == Piece.id)
                          .where(Piece.owner_id == user.id, Order.status == "paid")
                          .order_by(Order.created.desc())).all()
        return [{"id": o.id, "title": title, "delivery": o.delivery, "fulfilled": o.fulfilled,
                 "date": o.created, "intent": o.intent, "payment_state": o.payment_state} for o, title in rows]

    @router.get("/me/orders/{order_id}/delivery")
    def shipping(order_id: UUID, response: Response, user=Depends(owner), db=Depends(get_db)):
        order = db.get(Order, str(order_id))
        if not order or db.get(Piece, order.piece_id).owner_id != user.id or order.status != "paid":
            raise HTTPException(404, "Paid order not found.")
        session = provider(gateway.session, order.processor_account, order.session_id)
        details = session.get("customer_details") or {}
        shipping = (session.get("collected_information") or {}).get("shipping_details") or session.get("shipping_details") or {}
        response.headers["Cache-Control"] = "private, no-store"
        return {"email": details.get("email"), "name": shipping.get("name") or details.get("name"),
                "address": shipping.get("address") if order.delivery == "ship" else None}

    @router.put("/me/orders/{order_id}/fulfilled")
    def fulfill(order_id: UUID, user=Depends(owner), db=Depends(get_db)):
        order = db.get(Order, str(order_id))
        if not order or db.get(Piece, order.piece_id).owner_id != user.id or order.status != "paid":
            raise HTTPException(404, "Paid order not found.")
        if refresh_payment(db, order) not in ("paid", "partially_refunded"):
            raise HTTPException(409, "Check the payment status before fulfilling this order.")
        order.fulfilled = True
        db.commit()
        return {"fulfilled": True}

    return router
