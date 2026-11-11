import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PurchaseAdvance, PurchaseInvoice, Reglement
from ..schemas import PurchaseAdvanceEnter, PurchaseAdvanceCancel, PurchaseAdvanceRead
from ..crud import get_all, get_by_id
from ..invoice_balance import net_advance, status_for_balance

logger = logging.getLogger(__name__)
router = APIRouter()


def _ensure_new_numbers(db: Session, advance_id: str, advance_number: str, reglement_id: str, reglement_number: str) -> None:
    if get_by_id(db, PurchaseAdvance, advance_id) or get_by_id(db, Reglement, reglement_id):
        raise HTTPException(status_code=400, detail="Cet identifiant existe déjà.")
    if db.query(PurchaseAdvance).filter(PurchaseAdvance.advance_number == advance_number).first():
        raise HTTPException(status_code=400, detail=f'Le numéro "{advance_number}" est déjà utilisé.')
    if db.query(Reglement).filter(Reglement.reglement_number == reglement_number).first():
        raise HTTPException(status_code=400, detail=f'Le numéro "{reglement_number}" est déjà utilisé.')
    if advance_number == reglement_number or advance_id == reglement_id:
        raise HTTPException(status_code=400, detail="Les numéros de l'acompte et du règlement doivent être différents.")


def _net_advance(db: Session, invoice_id: str) -> float:
    rows = db.query(PurchaseAdvance).filter(PurchaseAdvance.purchase_invoice_id == invoice_id).all()
    return round(sum((row.total_ttc or 0) for row in rows), 2)


@router.get("/", response_model=List[PurchaseAdvanceRead])
def read_advances(db: Session = Depends(get_db)):
    return get_all(db, PurchaseAdvance)


@router.get("/{id}", response_model=PurchaseAdvanceRead)
def read_advance(id: str, db: Session = Depends(get_db)):
    db_obj = get_by_id(db, PurchaseAdvance, id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Facture d'acompte introuvable.")
    return db_obj


@router.post("/enter", response_model=PurchaseAdvanceRead)
def enter_advance(data: PurchaseAdvanceEnter, db: Session = Depends(get_db)):
    _ensure_new_numbers(db, data.id, data.advance_number, data.reglement_id, data.reglement_number)

    invoice = get_by_id(db, PurchaseInvoice, data.purchase_invoice_id)
    if not invoice:
        raise HTTPException(status_code=400, detail="Facture introuvable.")

    amount = round(data.amount_ttc, 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Le montant de l'acompte doit être supérieur à zéro.")

    remaining = round((invoice.total_ttc or 0) - (invoice.amount_paid or 0) - _net_advance(db, invoice.id), 2)
    if amount > remaining:
        raise HTTPException(status_code=400, detail="Le montant de l'acompte dépasse le solde dû de la facture.")

    total_ht = round(amount / (1 + data.tva_rate / 100), 2)
    total_tva = round(amount - total_ht, 2)
    description = data.description or f"Acompte versé sur [Facture - {invoice.invoice_number}]"

    try:
        reglement = Reglement(
            id=data.reglement_id,
            reglement_number=data.reglement_number,
            supplier_id=invoice.supplier_id,
            date=data.advance_date,
            amount=amount,
            payment_mode=data.payment_mode,
            reference=data.reference,
            remarks=None,
            status="Actif",
        )
        db.add(reglement)
        db.flush()

        advance = PurchaseAdvance(
            id=data.id,
            advance_number=data.advance_number,
            supplier_id=invoice.supplier_id,
            purchase_invoice_id=invoice.id,
            cancels_advance_id=None,
            advance_date=data.advance_date,
            payment_mode=data.payment_mode,
            due_date=data.due_date,
            reference=data.reference,
            description=description,
            tva_rate=data.tva_rate,
            total_ht=total_ht,
            total_tva=total_tva,
            total_ttc=amount,
            status="Validé",
            reglement_id=reglement.id,
        )
        db.add(advance)
        db.flush()
        if invoice.status != "Brouillon":
            invoice.status = status_for_balance(invoice.total_ttc, invoice.amount_paid, net_advance(db, invoice.id))
        db.commit()
        db.refresh(advance)
        return advance
    except Exception:
        db.rollback()
        logger.exception("enter_advance failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")


@router.post("/{id}/cancel", response_model=PurchaseAdvanceRead)
def cancel_advance(id: str, data: PurchaseAdvanceCancel, db: Session = Depends(get_db)):
    original = get_by_id(db, PurchaseAdvance, id)
    if not original:
        raise HTTPException(status_code=404, detail="Facture d'acompte introuvable.")
    if original.cancels_advance_id:
        raise HTTPException(status_code=400, detail="Cette pièce est une annulation d'acompte et ne peut pas être annulée.")
    if db.query(PurchaseAdvance).filter(PurchaseAdvance.cancels_advance_id == original.id).first():
        raise HTTPException(status_code=400, detail="Cet acompte a déjà été annulé.")

    _ensure_new_numbers(db, data.id, data.advance_number, data.reglement_id, data.reglement_number)

    try:
        reglement = Reglement(
            id=data.reglement_id,
            reglement_number=data.reglement_number,
            supplier_id=original.supplier_id,
            date=data.advance_date,
            amount=round(-(original.total_ttc or 0), 2),
            payment_mode=data.payment_mode,
            reference=original.reference,
            remarks=None,
            status="Actif",
        )
        db.add(reglement)
        db.flush()

        twin = PurchaseAdvance(
            id=data.id,
            advance_number=data.advance_number,
            supplier_id=original.supplier_id,
            purchase_invoice_id=original.purchase_invoice_id,
            cancels_advance_id=original.id,
            advance_date=data.advance_date,
            payment_mode=data.payment_mode,
            due_date=data.due_date,
            reference=original.reference,
            description=original.description,
            tva_rate=original.tva_rate,
            total_ht=round(-(original.total_ht or 0), 2),
            total_tva=round(-(original.total_tva or 0), 2),
            total_ttc=round(-(original.total_ttc or 0), 2),
            status="Validé",
            reglement_id=reglement.id,
        )
        db.add(twin)
        db.flush()
        source_invoice = get_by_id(db, PurchaseInvoice, original.purchase_invoice_id)
        if source_invoice and source_invoice.status != "Brouillon":
            source_invoice.status = status_for_balance(source_invoice.total_ttc, source_invoice.amount_paid, net_advance(db, source_invoice.id))
        db.commit()
        db.refresh(twin)
        return twin
    except Exception:
        db.rollback()
        logger.exception("cancel_advance failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")


# TEMPORARY (testing only, to-do 9.11): Ciel does not allow deleting an acompte.
@router.delete("/{id}")
def delete_advance(id: str, db: Session = Depends(get_db)):
    advance = get_by_id(db, PurchaseAdvance, id)
    if not advance:
        raise HTTPException(status_code=404, detail="Facture d'acompte introuvable.")
    if advance.cancels_advance_id:
        raise HTTPException(
            status_code=400,
            detail="Cette pièce est une annulation d'acompte. Supprimez l'acompte d'origine pour la supprimer.",
        )

    try:
        to_delete = [advance] + db.query(PurchaseAdvance).filter(PurchaseAdvance.cancels_advance_id == advance.id).all()
        invoice_id = advance.purchase_invoice_id
        reglement_ids = [item.reglement_id for item in to_delete if item.reglement_id]
        for item in to_delete:
            db.delete(item)
        db.flush()
        for reglement_id in reglement_ids:
            reglement = get_by_id(db, Reglement, reglement_id)
            if reglement:
                db.delete(reglement)
        db.flush()
        invoice = get_by_id(db, PurchaseInvoice, invoice_id)
        if invoice and invoice.status != "Brouillon":
            invoice.status = status_for_balance(invoice.total_ttc, invoice.amount_paid, net_advance(db, invoice.id))
        db.commit()
        return {"deleted": True}
    except Exception:
        db.rollback()
        logger.exception("delete_advance failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")
