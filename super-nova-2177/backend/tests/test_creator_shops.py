"""Exercise tenant isolation, payment confirmation, and shared last-copy inventory."""
import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from routers.shop import create_shop_router
from shop_models import Order, ShopBase
from shop_stripe import StripeGateway


class TestGateway:
    __test__ = False
    configured = True

    def __init__(self):
        self.sessions = {}
        self.refunded = False

    def new_account(self, owner, key):
        return f"acct_{owner}"

    def onboarding(self, account, site):
        return site + "/settings/shop"

    def account_ready(self, account):
        return True

    def create_session(self, order, params):
        key = "cs_test_" + order.id.replace("-", "")
        data = dict(id=key, url="https://checkout.stripe.com/" + key, client_reference_id=order.id,
                    mode="payment", status="open", payment_status="unpaid", metadata=params["metadata"],
                    amount_subtotal=params["line_items"][0]["price_data"]["unit_amount"], currency="usd",
                    payment_intent="pi_" + key, params=params)
        return self.sessions.setdefault((order.processor_account, key), data)

    def session(self, account, session_id):
        return self.sessions[account, session_id]

    def find_session(self, order):
        return next((s for (a, _), s in self.sessions.items()
                     if a == order.processor_account and s["client_reference_id"] == order.id), None)

    def download_allowed(self, order):
        return not self.refunded

    def event(self, body, signature, platform=False):
        return json.loads(body)


def auth(uid):
    return {"Authorization": f"Bearer {uid}"}


@pytest.fixture
def storefront(tmp_path, monkeypatch):
    monkeypatch.setenv("SUPERNOVA_SHOP_OWNER_ID", "1")
    monkeypatch.setenv("SHOP_MARKETPLACE_TAX_OWNER", "seller")
    monkeypatch.delenv("SHOP_REDWOOD_PICKUP_LABEL", raising=False)
    engine = create_engine("sqlite:///" + str(tmp_path / "shop.sqlite"))
    ShopBase.metadata.create_all(engine)

    def database():
        with Session(engine) as db:
            yield db

    def authenticated(header, db):
        if header not in ("Bearer 1", "Bearer 2"):
            raise HTTPException(401)
        return SimpleNamespace(id=int(header[-1]), username="Creator " + header[-1])

    gateway = TestGateway()
    app = FastAPI()
    app.include_router(create_shop_router(database, authenticated, gateway))
    c = TestClient(app, base_url="http://shop.test/commerce")
    yield c, gateway, engine
    engine.dispose()


def start(c, seller):
    h = auth(seller)
    data = dict(name="SuperNova" if seller == 1 else "Artist shop", contact="studio@example.com",
                terms="Ships in one week. Email for returns.", enabled=True)
    assert c.put("me", headers=h, json=data).is_success
    assert c.post("me/connect", headers=h).is_success
    assert c.get("me", headers=h).json()["ready"]
    return data


def draft(c, seller=1, digital=False, **changes):
    values = dict(code="SF-GUGU-001", artist="Gugu studio", title="At the window", story="Artist's story",
                  medium="download" if digital else "magnet", kind="digital" if digital else "physical",
                  image="https://example.com/cover.webp", alt="Pigeon against a skyline", tax_code="txcd_99999999",
                  price=1200, edition=1)
    return c.post("me/pieces", headers=auth(seller), json={**values, **changes})


def visibility(c, pid, seller=1, published=True):
    return c.put(f"me/pieces/{pid}/visibility", headers=auth(seller), json={"published": published})


def buy(c, pid, key=None, delivery="ship"):
    return c.post(f"pieces/{pid}/checkout", json={"attempt": key or str(uuid4()), "delivery": delivery})


def event(c, session, account, kind, platform=False):
    return c.post("stripe/platform-events" if platform else "stripe/events",
                  json={"type": "checkout.session." + kind, "account": account, "data": {"object": session}})


def test_shared_last_copy_and_permanent_archive(storefront):
    c, g, _ = storefront
    start(c, 1)
    assert draft(c, edition=2).status_code == 422
    p = draft(c).json()["id"]
    assert draft(c).status_code == 409
    assert c.get("pieces/" + p).status_code == 404
    assert visibility(c, p).is_success
    assert c.get("official").json()["pieces"][0]["id"] == p
    keys = [str(uuid4()), str(uuid4())]
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda key: buy(c, p, key), keys))
    assert sorted(r.status_code for r in results) == [200, 409]
    key = keys[next(ix for ix, r in enumerate(results) if r.status_code == 200)]
    assert buy(c, p, key).is_success
    assert len(g.sessions) == 1
    session = next(iter(g.sessions.values()))
    assert session["params"]["shipping_address_collection"] == {"allowed_countries": ["US"]}
    assert buy(c, p, delivery="pickup").status_code == 422
    session.update(status="complete", payment_status="paid")
    event(c, session, "acct_2", "completed")
    assert c.get("pieces/" + p).json()["sold"] == 0
    event(c, session, "acct_1", "completed")
    event(c, session, "acct_1", "completed")
    event(c, {**session, "status": "expired"}, "acct_1", "expired")
    archived = c.get("pieces/" + p).json()
    assert archived["sold"] == 1 and archived["remaining"] == 0 and not archived["available"]
    assert c.get("me/orders", headers=auth(2)).json() == []
    assert c.get(f"me/orders/{key}/delivery", headers=auth(2)).status_code == 404
    assert c.put(f"me/orders/{key}/fulfilled", headers=auth(1)).is_success
    assert visibility(c, p, published=False).is_success
    assert c.get("pieces/" + p).json()["story"] == "Artist's story"


def test_stripe_expiry_and_lost_webhook_release_once(storefront):
    c, g, engine = storefront
    start(c, 1)
    p = draft(c).json()["id"]
    visibility(c, p)
    key = str(uuid4())
    buy(c, p, key)
    session = next(iter(g.sessions.values()))
    session["status"] = "expired"
    with Session(engine) as db:
        o = db.get(Order, key)
        o.session_id = None   # Disconnect after Stripe created the session.
        o.expires = int(time.time()) - 100
        db.commit()
    assert c.get("pieces/" + p).json()["remaining"] == 1
    event(c, session, "acct_1", "expired")
    assert c.get("pieces/" + p).json()["remaining"] == 1
    assert buy(c, p, key).status_code == 410
    assert buy(c, p).is_success


def test_seller_files_and_verified_buyer_delivery(storefront):
    c, g, _ = storefront
    start(c, 2)
    p = draft(c, 2, digital=True).json()["id"]
    assert c.get("me").status_code == 401
    assert visibility(c, p, 1).status_code == 404
    assert visibility(c, p, 2).status_code == 409
    route = f"me/pieces/{p}/file"
    file = {"file": ("art.pdf", b"test-only-file", "application/pdf")}
    assert c.put(route, headers=auth(1), files=file).status_code == 404
    assert c.put(route, headers=auth(2), files=file).is_success
    assert visibility(c, p, 2).is_success
    assert c.put(route, headers=auth(2), files=file).status_code == 409
    key = str(uuid4())
    assert buy(c, p, key, "digital").is_success
    s = next(iter(g.sessions.values()))
    url = f"orders/{key}/download"
    assert c.get(url).status_code == 404
    assert c.get(url, headers=auth(s["id"])).status_code == 409
    s.update(status="complete", payment_status="paid", amount_subtotal=1)
    assert c.get(url, headers=auth(s["id"])).status_code == 409
    s["amount_subtotal"] = 1200
    download = c.get(url, headers=auth(s["id"]))
    assert download.content == b"test-only-file"
    assert "no-store" in download.headers["cache-control"]
    assert c.get("pieces/" + p).json()["remaining"] is None
    assert "filename" not in c.get("pieces/" + p).json()
    g.refunded = True
    assert c.get(url, headers=auth(s["id"])).status_code == 403


def test_official_binding_and_pickup_share_stock(storefront, monkeypatch):
    c, g, _ = storefront
    start(c, 1)
    other = start(c, 2)
    c.put("me", headers=auth(2), json={**other, "name": "SuperNova"})
    assert not c.get("shops/2").json()["official"]
    assert c.get("official").json()["owner_id"] == 1
    monkeypatch.setenv("SHOP_REDWOOD_PICKUP_LABEL", "Hosted Redwood City event, 2–4 PM")
    monkeypatch.setenv("SHOP_REDWOOD_PICKUP_TAX_RATE", "txr_example")
    from datetime import datetime, timezone
    monkeypatch.setenv("SHOP_REDWOOD_PICKUP_END", datetime.fromtimestamp(time.time() + 7200, timezone.utc).isoformat())
    p = draft(c).json()["id"]
    visibility(c, p)
    assert buy(c, p, delivery="pickup").status_code == 422
    assert c.put(f"me/pieces/{p}/pickup?enabled=true", headers=auth(1)).is_success
    assert buy(c, p, delivery="pickup").is_success
    assert buy(c, p, delivery="ship").status_code == 409
    s = next(iter(g.sessions.values()))
    assert s["params"]["line_items"][0]["tax_rates"] == ["txr_example"]
    assert "shipping_address_collection" not in s["params"]


def test_platform_tax_route_and_pause(storefront, monkeypatch):
    c, g, _ = storefront
    s = start(c, 2)
    p = draft(c, 2).json()["id"]
    monkeypatch.delenv("SHOP_MARKETPLACE_TAX_OWNER")
    assert visibility(c, p, 2).status_code == 409
    monkeypatch.setenv("SHOP_MARKETPLACE_TAX_OWNER", "platform")
    monkeypatch.setenv("STRIPE_PLATFORM_WEBHOOK_SECRET", "whsec_example")
    assert visibility(c, p, 2).is_success
    key = str(uuid4())
    assert buy(c, p, key).is_success
    (scope, _), session = next(iter(g.sessions.items()))
    assert scope is None
    assert session["params"]["payment_intent_data"]["transfer_data"] == {"destination": "acct_2", "amount": 1200}
    session.update(status="complete", payment_status="paid")
    event(c, session, "acct_2", "completed")
    assert c.get("pieces/" + p).json()["sold"] == 0
    event(c, session, None, "completed", platform=True)
    assert c.get("pieces/" + p).json()["sold"] == 1
    c.put("me", headers=auth(2), json={**s, "enabled": False})
    assert c.get("shops/2").status_code == 404
    assert c.get("pieces/" + p).json()["open"] is False
    assert buy(c, p).status_code == 409


def test_signed_event_requires_matching_endpoint_secret(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "test-configuration")
    monkeypatch.setenv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_1")
    monkeypatch.setenv("STRIPE_PLATFORM_WEBHOOK_SECRET", "whsec_2")
    body = b'{"object":"event","id":"evt_test","type":"account.updated","data":{"object":{}}}'
    t = str(int(time.time()))
    sig = hmac.new(b"whsec_1", t.encode() + b"." + body, hashlib.sha256).hexdigest()
    signature = f"t={t},v1={sig}"
    assert StripeGateway().event(body, signature)["id"] == "evt_test"
    with pytest.raises(HTTPException):
        StripeGateway().event(body, signature, platform=True)


def test_receipt_delivery_retries_without_double_fulfillment(storefront, monkeypatch):
    import shop_mail
    c, g, _ = storefront
    start(c, 1)
    p = draft(c).json()["id"]
    visibility(c, p)
    buy(c, p)
    s = next(iter(g.sessions.values()))
    s.update(status="complete", payment_status="paid", customer_details={"email": "buyer@example.com"})
    monkeypatch.setenv("SHOP_RECEIPT_EMAILS", "1")
    monkeypatch.setenv("SMTP_HOST", "example.com")
    monkeypatch.setenv("SMTP_FROM", "orders@example.com")
    deliveries = []

    def deliver(message, **options):
        deliveries.append(message)
        if len(deliveries) == 1:
            raise OSError("test-only interruption")

    monkeypatch.setattr(shop_mail, "deliver_message", deliver)
    assert event(c, s, "acct_1", "completed").status_code == 503
    assert event(c, s, "acct_1", "completed").is_success
    assert event(c, s, "acct_1", "completed").is_success
    assert len(deliveries) == 2
    assert s["id"] in deliveries[-1].get_content()
    assert c.get("pieces/" + p).json()["sold"] == 1
