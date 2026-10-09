import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from ..database import get_db
from ..models import Reglement, PurchaseInvoice, Supplier, ReglementLine
from ..schemas import ReglementCreate, ReglementRead
from ..crud import get_all, get_by_id

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[ReglementRead])
def read_reglements(db: Session = Depends(get_db)):
    return get_all(db, Reglement)

@router.get("/{id}", response_model=ReglementRead)
def read_reglement(id: str, db: Session = Depends(get_db)):
    db_obj = get_by_id(db, Reglement, id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Reglement not found")
    return db_obj

@router.post("/submit", response_model=ReglementRead)
def submit_reglement(data: ReglementCreate, db: Session = Depends(get_db)):
    if db.query(Reglement).filter(Reglement.reglement_number == data.reglement_number).first():
        raise HTTPException(status_code=400, detail=f'Le numéro "{data.reglement_number}" est déjà utilisé.')

    supplier = get_by_id(db, Supplier, data.supplier_id)
    if not supplier:
        raise HTTPException(status_code=400, detail="Fournisseur introuvable.")

    invoice_ids = [line.purchase_invoice_id for line in data.lines]
    if len(invoice_ids) != len(set(invoice_ids)):
        raise HTTPException(status_code=400, detail="Une même facture ne peut apparaître qu'une seule fois dans un règlement.")

    total_amount = 0.0
    invoices_to_update = []

    for line in data.lines:
        invoice = get_by_id(db, PurchaseInvoice, line.purchase_invoice_id)
        if not invoice:
            raise HTTPException(status_code=400, detail="Facture introuvable.")
        
        if invoice.supplier_id != data.supplier_id:
            raise HTTPException(status_code=400, detail=f"La facture {invoice.invoice_number} n'appartient pas à ce fournisseur.")
        
        if invoice.status == "Brouillon":
            raise HTTPException(status_code=400, detail=f"La facture {invoice.invoice_number} n'est pas validée.")

        amount = round(line.amount, 2)
        remaining = round((invoice.total_ttc or 0) - (invoice.amount_paid or 0), 2)
        
        if amount <= 0 or amount > remaining:
            raise HTTPException(status_code=400, detail=f"Le montant pour la facture {invoice.invoice_number} dépasse le solde dû.")
        
        total_amount += amount
        invoices_to_update.append((invoice, amount))

    total_amount = round(total_amount, 2)

    try:
        reglement = Reglement(
            id=data.id,
            reglement_number=data.reglement_number,
            supplier_id=data.supplier_id,
            date=data.date,
            amount=total_amount,
            payment_mode=data.payment_mode,
            reference=data.reference,
            remarks=data.remarks,
            status="Actif"
        )
        db.add(reglement)

        for line in data.lines:
            r_line = ReglementLine(
                id=f"rgl-line-{uuid.uuid4().hex[:12]}",
                reglement_id=reglement.id,
                purchase_invoice_id=line.purchase_invoice_id,
                amount=round(line.amount, 2)
            )
            db.add(r_line)

        for invoice, amount in invoices_to_update:
            new_amount_paid = round((invoice.amount_paid or 0) + amount, 2)
            invoice.amount_paid = new_amount_paid
            invoice.status = "Payée" if new_amount_paid >= round(invoice.total_ttc or 0, 2) else "Partiellement payée"

        db.commit()
        db.refresh(reglement)
        return reglement
    except Exception:
        db.rollback()
        logger.exception("submit_reglement failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")


@router.post("/{id}/void", response_model=ReglementRead)
def void_reglement(id: str, db: Session = Depends(get_db)):
    reglement = get_by_id(db, Reglement, id)
    if not reglement:
        raise HTTPException(status_code=404, detail="Reglement not found")
    if reglement.status == "Annulé":
        raise HTTPException(status_code=400, detail="Ce règlement est déjà annulé.")

    try:
        for line in reglement.lines:
            invoice = get_by_id(db, PurchaseInvoice, line.purchase_invoice_id)
            if invoice:
                new_amount_paid = round((invoice.amount_paid or 0) - line.amount, 2)
                invoice.amount_paid = new_amount_paid
                invoice.status = "Partiellement payée" if new_amount_paid > 0 else "Non payée"

        reglement.status = "Annulé"
        db.commit()
        db.refresh(reglement)
        return reglement
    except Exception:
        db.rollback()
        logger.exception("void_reglement failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")


# TEMPORARY (testing phase): allows full deletion of règlements. Revisit with regulations/audit-trail before production.
@router.delete("/{id}")
def delete_reglement(id: str, db: Session = Depends(get_db)):
    reglement = get_by_id(db, Reglement, id)
    if not reglement:
        raise HTTPException(status_code=404, detail="Reglement not found")

    try:
        if reglement.status == "Actif":
            for line in reglement.lines:
                invoice = get_by_id(db, PurchaseInvoice, line.purchase_invoice_id)
                if invoice:
                    new_amount_paid = round((invoice.amount_paid or 0) - line.amount, 2)
                    invoice.amount_paid = new_amount_paid
                    invoice.status = "Partiellement payée" if new_amount_paid > 0 else "Non payée"
        
        db.delete(reglement)
        db.commit()
        return {"deleted": True}
    except Exception:
        db.rollback()
        logger.exception("delete_reglement failed")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue. Veuillez réessayer.")
