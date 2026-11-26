"""Shop records share the social API's database and immutable harmonizer IDs."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base, deferred

ShopBase = declarative_base()


def new_id():
    return str(uuid4())


class Shop(ShopBase):
    __tablename__ = "creator_shops"
    owner_id = Column(Integer, primary_key=True, autoincrement=False)
    name = Column(String(90), nullable=False)
    contact = Column(String(254), default="", nullable=False)
    terms = Column(Text, default="", nullable=False)
    enabled = Column(Boolean, default=False, nullable=False)
    account = Column(String(128), unique=True)
    connect_key = Column(String(36), default=new_id, nullable=False)
    ready = Column(Boolean, default=False, nullable=False)


class Piece(ShopBase):
    __tablename__ = "shop_pieces"
    __table_args__ = (UniqueConstraint("owner_id", "code", name="uq_shop_edition_code"),)
    code = Column(String(48), nullable=False)
    medium = Column(String(16), nullable=False)
    artist = Column(String(90), nullable=False)
    alt = Column(String(350), nullable=False)
    video = Column(Text)
    tax_code = Column(String(13), nullable=False)
    id = Column(String(36), primary_key=True, default=new_id)
    owner_id = Column(Integer, ForeignKey("creator_shops.owner_id"), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    story = Column(Text, nullable=False)
    image = Column(Text, nullable=False)
    kind = Column(String(10), nullable=False)
    price = Column(Integer, nullable=False)
    edition = Column(Integer)
    remaining = Column(Integer)
    sold = Column(Integer, nullable=False, default=0)
    published = Column(Boolean, nullable=False, default=False)
    pickup_enabled = Column(Boolean, default=False, nullable=False)
    released = Column(Boolean, nullable=False, default=False)
    filename = Column(String(160))
    content = deferred(Column(LargeBinary))
    created = Column(DateTime, nullable=False, default=datetime.utcnow)


class Order(ShopBase):
    __tablename__ = "shop_orders"
    id = Column(String(36), primary_key=True)
    piece_id = Column(String(36), ForeignKey("shop_pieces.id"), index=True, nullable=False)
    account = Column(String(128), nullable=False)
    charge_type = Column(String(12), nullable=False)
    delivery = Column(String(12), nullable=False)
    # Freeze the arguments so a retry of the same Stripe request stays identical.
    checkout_params = Column(Text, nullable=False)
    created = Column(Integer, nullable=False)
    expires = Column(Integer, nullable=False)
    status = Column(String(12), default="reserved", nullable=False)
    session_id = Column(String(160), unique=True)
    session_url = Column(Text)
    intent = Column(String(160), index=True)
    receipt_sent = Column(Boolean, nullable=False, default=False)
    mail_lease = Column(Integer, nullable=False, default=0)
    fulfilled = Column(Boolean, nullable=False, default=False)

    @property
    def processor_account(self):
        return self.account if self.charge_type == "direct" else None
