import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PurchaseInvoice, Reglement, PurchaseCreditNote, ReglementLine, Product, PurchaseReceipt
from ..schemas import PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceRead
from .. import crud

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[PurchaseInvoiceRead])
def get_purchase_invoices(db: Session = Depends(get_db)):
    return crud.get_all(db, PurchaseInvoice)


@router.get("/{invoice_id}", response_model=PurchaseInvoiceRead)
def get_purchase_invoice(invoice_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseInvoice, invoice_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")
    return db_obj


@router.post("", response_model=PurchaseInvoiceRead, status_code=status.HTTP_201_CREATED)
def create_purchase_invoice(data: PurchaseInvoiceCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, PurchaseInvoice, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet identifiant existe déjà.")
    if db.query(PurchaseInvoice).filter(PurchaseInvoice.invoice_number == data.invoice_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le numéro "{data.invoice_number}" est déjà utilisé.')
    if data.purchase_receipt_id:
        source_receipt = crud.get_by_id(db, PurchaseReceipt, data.purchase_receipt_id)
        if not source_receipt:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bon de réception source introuvable.")
        if source_receipt.status != "Validé":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vous ne pouvez créer une facture qu'à partir d'un bon de réception validé.")
        if db.query(PurchaseInvoice).filter(PurchaseInvoice.purchase_receipt_id == data.purchase_receipt_id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Une facture existe déjà pour ce bon de réception.")
    return crud.create(db, PurchaseInvoice, data.model_dump())


@router.put("/{invoice_id}", response_model=PurchaseInvoiceRead)
def update_purchase_invoice(invoice_id: str, data: PurchaseInvoiceUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseInvoice, invoice_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")
    payload = data.model_dump(exclude_unset=True)
    if db_obj.status != "Brouillon":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une facture validée ne peut pas être modifiée. Annulez d'abord sa validation.",
        )
    if "status" in payload and payload["status"] != db_obj.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le statut ne peut être modifié que par la validation ou l'annulation de validation.",
        )
    return crud.update(db, db_obj, payload)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_invoice(invoice_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseInvoice, invoice_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")
    linked_reglement = db.query(ReglementLine).filter(ReglementLine.purchase_invoice_id == invoice_id).first()
    if linked_reglement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette facture a des règlements associés et ne peut pas être supprimée.",
        )
    linked_credit_note = db.query(PurchaseCreditNote).filter(PurchaseCreditNote.purchase_invoice_id == invoice_id).first()
    if linked_credit_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette facture a un avoir associé et ne peut pas être supprimée.",
        )
    if db_obj.status != "Brouillon":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une facture validée ne peut pas être supprimée. Annulez d'abord sa validation.",
        )
    crud.delete(db, db_obj)


@router.post("/{invoice_id}/validate", response_model=PurchaseInvoiceRead)
def validate_purchase_invoice(invoice_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseInvoice, invoice_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")
    if db_obj.status != "Brouillon":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seule une facture en brouillon peut être validée.",
        )
    try:
        if not db_obj.purchase_receipt_id:
            for item in (db_obj.items or []):
                product = crud.get_by_id(db, Product, item.get("product_id"))
                if product:
                    product.stock_level = (product.stock_level or 0) + item.get("quantity", 0)
        db_obj.status = "Non payée"
        db.commit()
        db.refresh(db_obj)
        return db_obj
    except Exception:
        db.rollback()
        logger.exception("validate_purchase_invoice failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")


@router.post("/{invoice_id}/cancel-validation", response_model=PurchaseInvoiceRead)
def cancel_purchase_invoice_validation(invoice_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseInvoice, invoice_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facture introuvable.")
    if db_obj.status not in ("Non payée", "En retard"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seule une facture non payée peut voir sa validation annulée.",
        )

    linked_credit_note = db.query(PurchaseCreditNote).filter(
        PurchaseCreditNote.purchase_invoice_id == invoice_id
    ).first()
    if linked_credit_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un avoir existe déjà pour cette facture. Impossible d'annuler la validation.",
        )

    linked_reglement = db.query(ReglementLine).join(Reglement, ReglementLine.reglement_id == Reglement.id).filter(
        ReglementLine.purchase_invoice_id == invoice_id,
        Reglement.status == "Actif",
    ).first()
    if linked_reglement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette facture a des règlements actifs. Annulez-les d'abord avant d'annuler la validation.",
        )

    try:
        if not db_obj.purchase_receipt_id:
            needed = {}
            for item in (db_obj.items or []):
                pid = item.get("product_id")
                needed[pid] = needed.get(pid, 0) + item.get("quantity", 0)
            affected = []
            insufficient = []
            for pid, qty in needed.items():
                product = crud.get_by_id(db, Product, pid)
                if product:
                    affected.append((product, qty))
                    if (product.stock_level or 0) < qty:
                        insufficient.append(f'"{product.name}"')
            if insufficient:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock insuffisant pour {', '.join(insufficient)}.")
            for product, qty in affected:
                product.stock_level = (product.stock_level or 0) - qty
        db_obj.status = "Brouillon"
        db.commit()
        db.refresh(db_obj)
        return db_obj
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("cancel_purchase_invoice_validation failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")
