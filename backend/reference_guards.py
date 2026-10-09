from fastapi import HTTPException
from sqlalchemy.orm import Session
from .models import (
    PurchaseOrder,
    PurchaseReceipt,
    PurchaseInvoice,
    PurchaseCreditNote,
    Reglement,
    Product
)

def _join_labels_fr(labels: list[str]) -> str:
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    return ", ".join(labels[:-1]) + " et " + labels[-1]

def ensure_supplier_deletable(db: Session, supplier_id: str) -> None:
    labels = []
    if db.query(PurchaseOrder.id).filter(PurchaseOrder.supplier_id == supplier_id).first():
        labels.append("des bons de commande")
    if db.query(PurchaseReceipt.id).filter(PurchaseReceipt.supplier_id == supplier_id).first():
        labels.append("des bons de réception")
    if db.query(PurchaseInvoice.id).filter(PurchaseInvoice.supplier_id == supplier_id).first():
        labels.append("des factures")
    if db.query(PurchaseCreditNote.id).filter(PurchaseCreditNote.supplier_id == supplier_id).first():
        labels.append("des avoirs")
    if db.query(Reglement.id).filter(Reglement.supplier_id == supplier_id).first():
        labels.append("des règlements")
    if db.query(Product.id).filter(Product.supplier_id == supplier_id).first():
        labels.append("des articles")
        
    if labels:
        raise HTTPException(
            status_code=400,
            detail=f"Ce fournisseur est utilisé par {_join_labels_fr(labels)} et ne peut pas être supprimé."
        )

def ensure_product_deletable(db: Session, product_id: str) -> None:
    labels = []
    
    def check_items(model_class) -> bool:
        rows = db.query(model_class.items).all()
        for row in rows:
            items = row[0] if row[0] is not None else []
            for item in items:
                if isinstance(item, dict) and item.get("product_id") == product_id:
                    return True
        return False

    if check_items(PurchaseOrder):
        labels.append("des bons de commande")
    if check_items(PurchaseReceipt):
        labels.append("des bons de réception")
    if check_items(PurchaseInvoice):
        labels.append("des factures")
    if check_items(PurchaseCreditNote):
        labels.append("des avoirs")
        
    if labels:
        raise HTTPException(
            status_code=400,
            detail=f"Cet article figure dans {_join_labels_fr(labels)} et ne peut pas être supprimé."
        )

def ensure_family_deletable(db: Session, family_id: str) -> None:
    if db.query(Product.id).filter(Product.family_id == family_id).first():
        raise HTTPException(
            status_code=400,
            detail="Cette famille est utilisée par des articles et ne peut pas être supprimée."
        )

def ensure_representative_deletable(db: Session, representative_id: str) -> None:
    labels = []
    if db.query(PurchaseOrder.id).filter(PurchaseOrder.representative_id == representative_id).first():
        labels.append("des bons de commande")
    if db.query(PurchaseReceipt.id).filter(PurchaseReceipt.representative_id == representative_id).first():
        labels.append("des bons de réception")
    if db.query(PurchaseInvoice.id).filter(PurchaseInvoice.representative_id == representative_id).first():
        labels.append("des factures")
    if db.query(PurchaseCreditNote.id).filter(PurchaseCreditNote.representative_id == representative_id).first():
        labels.append("des avoirs")
        
    if labels:
        raise HTTPException(
            status_code=400,
            detail=f"Ce représentant est utilisé par {_join_labels_fr(labels)} et ne peut pas être supprimé."
        )