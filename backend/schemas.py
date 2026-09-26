from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field


# --- Article Family ---
class ArticleFamilyBase(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=2)

class ArticleFamilyCreate(ArticleFamilyBase):
    id: str

class ArticleFamilyUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1)
    name: Optional[str] = Field(default=None, min_length=2)

class ArticleFamilyRead(ArticleFamilyBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Supplier ---
class SupplierBase(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=2)
    contact_name: str = Field(min_length=2)
    contact_email: str = Field(pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    contact_phone: str = Field(min_length=10)
    street: str = Field(min_length=5)
    city: str = Field(min_length=2)
    country: str = Field(min_length=2)
    ice: str = Field(pattern=r'^[0-9]{15}$')

class SupplierCreate(SupplierBase):
    id: str

class SupplierUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1)
    name: Optional[str] = Field(default=None, min_length=2)
    contact_name: Optional[str] = Field(default=None, min_length=2)
    contact_email: Optional[str] = Field(default=None, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    contact_phone: Optional[str] = Field(default=None, min_length=10)
    street: Optional[str] = Field(default=None, min_length=5)
    city: Optional[str] = Field(default=None, min_length=2)
    country: Optional[str] = Field(default=None, min_length=2)
    ice: Optional[str] = Field(default=None, pattern=r'^[0-9]{15}$')

class SupplierRead(SupplierBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Product ---
class ProductBase(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=2)
    description: Optional[str] = None
    price: float = Field(ge=0)
    stock_level: int = Field(ge=0)
    reorder_threshold: int = Field(ge=0)
    family_id: Optional[str] = None
    supplier_id: Optional[str] = None

class ProductCreate(ProductBase):
    id: str

class ProductUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1)
    name: Optional[str] = Field(default=None, min_length=2)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    stock_level: Optional[int] = Field(default=None, ge=0)
    reorder_threshold: Optional[int] = Field(default=None, ge=0)
    family_id: Optional[str] = None
    supplier_id: Optional[str] = None

class ProductRead(ProductBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Client ---
class ClientBase(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    phone: str = Field(min_length=10)
    address: Optional[str] = None

class ClientCreate(ClientBase):
    id: str

class ClientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2)
    email: Optional[str] = Field(default=None, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    phone: Optional[str] = Field(default=None, min_length=10)
    address: Optional[str] = None

class ClientRead(ClientBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Representative ---
class RepresentativeBase(BaseModel):
    code: Optional[str] = None
    name: str = Field(min_length=2)
    email: str = Field(pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

class RepresentativeCreate(RepresentativeBase):
    id: str

class RepresentativeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2)
    email: Optional[str] = Field(default=None, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    code: Optional[str] = None

class RepresentativeRead(RepresentativeBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Sales Data ---
class SalesDataBase(BaseModel):
    month: str
    this_year: int
    last_year: int

class SalesDataCreate(SalesDataBase):
    pass

class SalesDataRead(SalesDataBase):
    model_config = ConfigDict(from_attributes=True)




# --- Purchase Order ---
class PurchaseOrderItem(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    tva_rate: float = Field(ge=0)

class PurchaseOrderBase(BaseModel):
    order_number: str
    supplier_id: str
    order_date: str
    total_ht: float
    total_ttc: float
    payment_mode: Optional[str] = None
    delivery_date: Optional[str] = None
    supplier_order_ref: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PurchaseOrderItem] = Field(min_length=1)

class PurchaseOrderCreate(PurchaseOrderBase):
    id: str

class PurchaseOrderUpdate(BaseModel):
    order_number: Optional[str] = None
    supplier_id: Optional[str] = None
    order_date: Optional[str] = None
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None
    payment_mode: Optional[str] = None
    delivery_date: Optional[str] = None
    supplier_order_ref: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseOrderItem]] = None

class PurchaseOrderRead(PurchaseOrderBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Purchase Receipt ---
class PurchaseReceiptItem(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    tva_rate: float = Field(ge=0)

class PurchaseReceiptBase(BaseModel):
    receipt_number: str
    purchase_order_id: Optional[str] = None
    supplier_id: str
    receipt_date: str
    status: str = "Brouillon"
    total_ht: float
    total_ttc: float
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PurchaseReceiptItem] = Field(min_length=1)

class PurchaseReceiptCreate(PurchaseReceiptBase):
    id: str

class PurchaseReceiptUpdate(BaseModel):
    receipt_number: Optional[str] = None
    purchase_order_id: Optional[str] = None
    supplier_id: Optional[str] = None
    receipt_date: Optional[str] = None
    status: Optional[str] = None
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseReceiptItem]] = None

class PurchaseReceiptRead(PurchaseReceiptBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Purchase Invoice ---
class PurchaseInvoiceItem(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    tva_rate: float = Field(ge=0)

class PurchaseInvoiceBase(BaseModel):
    invoice_number: str
    purchase_order_id: Optional[str] = None
    supplier_id: str
    invoice_date: str
    status: str = "Brouillon"
    total_ht: float
    total_ttc: float
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    purchase_receipt_id: Optional[str] = None
    amount_paid: Optional[float] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PurchaseInvoiceItem] = Field(min_length=1)

class PurchaseInvoiceCreate(PurchaseInvoiceBase):
    id: str

class PurchaseInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    purchase_order_id: Optional[str] = None
    supplier_id: Optional[str] = None
    invoice_date: Optional[str] = None
    status: Optional[str] = None
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    purchase_receipt_id: Optional[str] = None
    amount_paid: Optional[float] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseInvoiceItem]] = None

class PurchaseInvoiceRead(PurchaseInvoiceBase):
    id: str
    model_config = ConfigDict(from_attributes=True)


# --- Purchase Credit Note ---
class PurchaseCreditNoteItem(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    tva_rate: float = Field(ge=0)

class PurchaseCreditNoteBase(BaseModel):
    credit_note_number: str
    purchase_invoice_id: Optional[str] = None
    supplier_id: str
    credit_note_date: str
    status: str = "Brouillon"
    total_ht: float
    total_ttc: float
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PurchaseCreditNoteItem] = Field(min_length=1)

class PurchaseCreditNoteCreate(PurchaseCreditNoteBase):
    id: str

class PurchaseCreditNoteUpdate(BaseModel):
    credit_note_number: Optional[str] = None
    purchase_invoice_id: Optional[str] = None
    supplier_id: Optional[str] = None
    credit_note_date: Optional[str] = None
    total_ht: Optional[float] = None
    total_ttc: Optional[float] = None
    payment_mode: Optional[str] = None
    due_date: Optional[str] = None
    representative_id: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseCreditNoteItem]] = None

class PurchaseCreditNoteRead(PurchaseCreditNoteBase):
    id: str
    model_config = ConfigDict(from_attributes=True)
# --- Reglement ---
class ReglementBase(BaseModel):
    reglement_number: str
    purchase_invoice_id: str
    supplier_id: str
    date: str
    amount: float
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    status: str = "Actif"

class ReglementCreate(ReglementBase):
    id: str

class ReglementUpdate(BaseModel):
    reglement_number: Optional[str] = None
    purchase_invoice_id: Optional[str] = None
    supplier_id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

class ReglementRead(ReglementBase):
    id: str
    model_config = ConfigDict(from_attributes=True)
