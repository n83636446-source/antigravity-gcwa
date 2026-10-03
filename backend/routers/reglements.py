from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Reglement, PurchaseInvoice
from ..schemas import ReglementCreate, ReglementRead, ReglementUpdate
from ..crud import get_all, get_by_id, update

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

@router.put("/{id}", response_model=ReglementRead)
def update_reglement(id: str, data: ReglementUpdate, db: Session = Depends(get_db)):
    db_obj = get_by_id(db, Reglement, id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Reglement not found")
    return update(db, db_obj, data.model_dump(exclude_unset=True))


@router.post("/submit", response_model=ReglementRead)
def submit_reglement(data: ReglementCreate, db: Session = Depends(get_db)):
    invoice = get_by_id(db, PurchaseInvoice, data.purchase_invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    remaining = round((invoice.total_ttc or 0) - (invoice.amount_paid or 0), 2)
    if round(data.amount, 2) <= 0 or round(data.amount, 2) > remaining:
        raise HTTPException(status_code=400, detail="Le montant du règlement dépasse le solde dû.")

    if db.query(Reglement).filter(Reglement.reglement_number == data.reglement_number).first():
        raise HTTPException(status_code=400, detail=f'Le numéro "{data.reglement_number}" est déjà utilisé.')

    try:
        reglement = Reglement(**data.model_dump())
        db.add(reglement)

        new_amount_paid = round((invoice.amount_paid or 0) + data.amount, 2)
        invoice.amount_paid = new_amount_paid
        invoice.status = "Payée" if new_amount_paid >= round(invoice.total_ttc or 0, 2) else "Partiellement payée"

        db.commit()
        db.refresh(reglement)
        return reglement
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{id}/void", response_model=ReglementRead)
def void_reglement(id: str, db: Session = Depends(get_db)):
    reglement = get_by_id(db, Reglement, id)
    if not reglement:
        raise HTTPException(status_code=404, detail="Reglement not found")
    if reglement.status == "Annulé":
        raise HTTPException(status_code=400, detail="Ce règlement est déjà annulé.")

    try:
        invoice = get_by_id(db, PurchaseInvoice, reglement.purchase_invoice_id)
        if invoice:
            new_amount_paid = round((invoice.amount_paid or 0) - reglement.amount, 2)
            invoice.amount_paid = new_amount_paid
            invoice.status = "Partiellement payée" if new_amount_paid > 0 else "Non payée"

        reglement.status = "Annulé"
        db.commit()
        db.refresh(reglement)
        return reglement
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# TEMPORARY (testing phase): allows full deletion of règlements. Revisit with regulations/audit-trail before production.
@router.delete("/{id}")
def delete_reglement(id: str, db: Session = Depends(get_db)):
    reglement = get_by_id(db, Reglement, id)
    if not reglement:
        raise HTTPException(status_code=404, detail="Reglement not found")

    try:
        if reglement.status == "Actif":
            invoice = get_by_id(db, PurchaseInvoice, reglement.purchase_invoice_id)
            if invoice:
                new_amount_paid = round((invoice.amount_paid or 0) - reglement.amount, 2)
                invoice.amount_paid = new_amount_paid
                invoice.status = "Partiellement payée" if new_amount_paid > 0 else "Non payée"
        
        db.delete(reglement)
        db.commit()
        return {"deleted": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
