"""The payment-provider boundary. Card data is collected by Stripe Checkout."""
import os

import stripe
from fastapi import HTTPException


class StripeGateway:
    @property
    def configured(self):
        return bool(os.getenv("STRIPE_SECRET_KEY") and os.getenv("STRIPE_CONNECT_WEBHOOK_SECRET"))

    def options(self, account=None):
        if not self.configured:
            raise HTTPException(503, "Checkout is awaiting Stripe configuration.")
        options = {"api_key": os.environ["STRIPE_SECRET_KEY"]}
        if account:
            options["stripe_account"] = account
        return options

    def new_account(self, owner_id, key):
        return stripe.Account.create(type="standard", metadata={"shop_owner": str(owner_id)},
                                     idempotency_key=f"shop-account-{owner_id}-{key}", **self.options()).id

    def onboarding(self, account, site):
        return stripe.AccountLink.create(account=account, type="account_onboarding",
                                         refresh_url=f"{site}/settings/shop?connect=refresh",
                                         return_url=f"{site}/settings/shop?connect=return",
                                         **self.options()).url

    def account_ready(self, account):
        account = stripe.Account.retrieve(account, **self.options())
        return bool(account.charges_enabled and account.payouts_enabled and account.details_submitted)

    def create_session(self, order, params):
        return stripe.checkout.Session.create(**params, idempotency_key=f"shop-order-{order.id}",
                                              **self.options(order.processor_account))

    def session(self, account, session_id):
        return stripe.checkout.Session.retrieve(session_id, **self.options(account))

    def find_session(self, order):
        # Recovery after a disconnect between Stripe accepting and us saving its ID.
        sessions = stripe.checkout.Session.list(created={"gte": order.created - 60, "lte": order.expires},
                                                limit=100, **self.options(order.processor_account))
        return next((s for s in sessions.auto_paging_iter() if s.client_reference_id == order.id), None)

    def download_allowed(self, order):
        intent = stripe.PaymentIntent.retrieve(order.intent, expand=["latest_charge"], **self.options(order.processor_account))
        charge = intent.latest_charge
        return intent.status == "succeeded" and charge and not charge.refunded and not charge.disputed

    def event(self, body, signature, platform=False):
        if not self.configured:
            raise HTTPException(503, "Stripe events are awaiting configuration.")
        secret = os.getenv("STRIPE_PLATFORM_WEBHOOK_SECRET" if platform else "STRIPE_CONNECT_WEBHOOK_SECRET")
        if not secret:
            raise HTTPException(503, "Webhook signing secret is missing.")
        try:
            return stripe.Webhook.construct_event(body, signature, secret)
        except (ValueError, stripe.SignatureVerificationError):
            raise HTTPException(400, "Invalid Stripe event signature.") from None
