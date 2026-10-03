from typing import List, Optional
from sqlalchemy import String, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class ArticleFamily(Base):
    __tablename__ = "article_families"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    products: Mapped[List["Product"]] = relationship("Product", back_populates="family")


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    contact_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ice: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    products: Mapped[List["Product"]] = relationship("Product", back_populates="supplier")


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    stock_level: Mapped[int] = mapped_column(Integer)
    reorder_threshold: Mapped[int] = mapped_column(Integer)
    family_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("article_families.id"), nullable=True)
    supplier_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("suppliers.id"), nullable=True)
    family: Mapped[Optional[ArticleFamily]] = relationship("ArticleFamily", back_populates="products")
    supplier: Mapped[Optional[Supplier]] = relationship("Supplier", back_populates="products")


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class Representative(Base):
    __tablename__ = "representatives"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class SalesData(Base):
    __tablename__ = "sales_data"
    month: Mapped[str] = mapped_column(String, primary_key=True)
    this_year: Mapped[int] = mapped_column(Integer)
    last_year: Mapped[int] = mapped_column(Integer)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    order_number: Mapped[str] = mapped_column(String, unique=True)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.id"))
    order_date: Mapped[str] = mapped_column(String)
    total_ht: Mapped[float] = mapped_column(Float)
    total_ttc: Mapped[float] = mapped_column(Float)
    payment_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    delivery_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    supplier_order_ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    representative_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    items: Mapped[list] = mapped_column(JSON, default=list)


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    receipt_number: Mapped[str] = mapped_column(String, unique=True)
    purchase_order_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.id"))
    receipt_date: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Brouillon")
    total_ht: Mapped[float] = mapped_column(Float)
    total_ttc: Mapped[float] = mapped_column(Float)
    payment_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    representative_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    items: Mapped[list] = mapped_column(JSON, default=list)


class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String, unique=True)
    purchase_order_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.id"))
    invoice_date: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Brouillon")
    total_ht: Mapped[float] = mapped_column(Float)
    total_ttc: Mapped[float] = mapped_column(Float)
    payment_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    purchase_receipt_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    representative_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    items: Mapped[list] = mapped_column(JSON, default=list)


class PurchaseCreditNote(Base):
    __tablename__ = "purchase_credit_notes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    credit_note_number: Mapped[str] = mapped_column(String, unique=True)
    purchase_invoice_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.id"))
    credit_note_date: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Brouillon")
    total_ht: Mapped[float] = mapped_column(Float)
    total_ttc: Mapped[float] = mapped_column(Float)
    payment_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    representative_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    items: Mapped[list] = mapped_column(JSON, default=list)

class Reglement(Base):
    __tablename__ = "reglements"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    reglement_number: Mapped[str] = mapped_column(String, unique=True)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.id"))
    date: Mapped[str] = mapped_column(String)
    amount: Mapped[float] = mapped_column(Float)
    payment_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="Actif")
    lines: Mapped[List["ReglementLine"]] = relationship("ReglementLine", back_populates="reglement", cascade="all, delete-orphan")

class ReglementLine(Base):
    __tablename__ = "reglement_lines"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    reglement_id: Mapped[str] = mapped_column(String, ForeignKey("reglements.id"))
    purchase_invoice_id: Mapped[str] = mapped_column(String, ForeignKey("purchase_invoices.id"))
    amount: Mapped[float] = mapped_column(Float)
    reglement: Mapped["Reglement"] = relationship("Reglement", back_populates="lines")
