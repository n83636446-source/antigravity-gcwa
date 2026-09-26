from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PurchaseCreditNote, Product
from ..schemas import PurchaseCreditNoteCreate, PurchaseCreditNoteUpdate, PurchaseCreditNoteRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[PurchaseCreditNoteRead])
def get_purchase_credit_notes(db: Session = Depends(get_db)):
    return crud.get_all(db, PurchaseCreditNote)


@router.get("/{credit_note_id}", response_model=PurchaseCreditNoteRead)
def get_purchase_credit_note(credit_note_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseCreditNote, credit_note_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    return db_obj


@router.post("", response_model=PurchaseCreditNoteRead, status_code=status.HTTP_201_CREATED)
def create_purchase_credit_note(data: PurchaseCreditNoteCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, PurchaseCreditNote, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credit note ID already exists")
    if db.query(PurchaseCreditNote).filter(PurchaseCreditNote.credit_note_number == data.credit_note_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le numéro "{data.credit_note_number}" est déjà utilisé.')
    return crud.create(db, PurchaseCreditNote, data.model_dump())


@router.put("/{credit_note_id}", response_model=PurchaseCreditNoteRead)
def update_purchase_credit_note(credit_note_id: str, data: PurchaseCreditNoteUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseCreditNote, credit_note_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{credit_note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_credit_note(credit_note_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseCreditNote, credit_note_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    if db_obj.status == "Validé":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet avoir est validé et ne peut pas être supprimé. Annulez d'abord sa validation.",
        )
    crud.delete(db, db_obj)


@router.post("/{credit_note_id}/validate", response_model=PurchaseCreditNoteRead)
def validate_purchase_credit_note(credit_note_id: str, db: Session = Depends(get_db)):
    credit_note = crud.get_by_id(db, PurchaseCreditNote, credit_note_id)
    if not credit_note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    if credit_note.status == "Validé":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet avoir est déjà validé.")

    try:
        for item in (credit_note.items or []):
            product = crud.get_by_id(db, Product, item.get("product_id"))
            if product:
                qty = item.get("quantity", 0)
                if (product.stock_level or 0) < qty:
                    raise ValueError(f'Stock insuffisant pour "{product.name}"')
                product.stock_level = (product.stock_level or 0) - qty

        credit_note.status = "Validé"
        db.commit()
        db.refresh(credit_note)
        return credit_note
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{credit_note_id}/cancel-validation", response_model=PurchaseCreditNoteRead)
def cancel_purchase_credit_note_validation(credit_note_id: str, db: Session = Depends(get_db)):
    credit_note = crud.get_by_id(db, PurchaseCreditNote, credit_note_id)
    if not credit_note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found")
    if credit_note.status != "Validé":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet avoir n'est pas validé.")

    try:
        for item in (credit_note.items or []):
            product = crud.get_by_id(db, Product, item.get("product_id"))
            if product:
                product.stock_level = (product.stock_level or 0) + item.get("quantity", 0)

        credit_note.status = "Brouillon"
        db.commit()
        db.refresh(credit_note)
        return credit_note
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
