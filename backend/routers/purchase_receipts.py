from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PurchaseReceipt, Product, PurchaseInvoice
from ..schemas import PurchaseReceiptCreate, PurchaseReceiptUpdate, PurchaseReceiptRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[PurchaseReceiptRead])
def get_purchase_receipts(db: Session = Depends(get_db)):
    return crud.get_all(db, PurchaseReceipt)


@router.get("/{receipt_id}", response_model=PurchaseReceiptRead)
def get_purchase_receipt(receipt_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseReceipt, receipt_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase receipt not found")
    return db_obj


@router.post("", response_model=PurchaseReceiptRead, status_code=status.HTTP_201_CREATED)
def create_purchase_receipt(data: PurchaseReceiptCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, PurchaseReceipt, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase receipt ID already exists")
    if db.query(PurchaseReceipt).filter(PurchaseReceipt.receipt_number == data.receipt_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le numéro "{data.receipt_number}" est déjà utilisé.')
    return crud.create(db, PurchaseReceipt, data.model_dump())


@router.put("/{receipt_id}", response_model=PurchaseReceiptRead)
def update_purchase_receipt(receipt_id: str, data: PurchaseReceiptUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseReceipt, receipt_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase receipt not found")
    payload = data.model_dump(exclude_unset=True)
    if db_obj.status == "Validé":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce bon de réception est validé et ne peut pas être modifié. Annulez d'abord sa validation.",
        )
    if "status" in payload and payload["status"] != db_obj.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le statut ne peut être modifié que par la validation ou l'annulation de validation.",
        )
    return crud.update(db, db_obj, payload)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_receipt(receipt_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseReceipt, receipt_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase receipt not found")
    if db_obj.status == "Validé":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce bon de réception est validé et ne peut pas être supprimé. Annulez d'abord sa validation.",
        )
    crud.delete(db, db_obj)


@router.post("/{receipt_id}/validate", response_model=PurchaseReceiptRead)
def validate_purchase_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = crud.get_by_id(db, PurchaseReceipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase receipt not found")
    if receipt.status == "Validé":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce bon de réception est déjà validé.")

    try:
        for item in (receipt.items or []):
            product = crud.get_by_id(db, Product, item.get("product_id"))
            if product:
                product.stock_level = (product.stock_level or 0) + item.get("quantity", 0)

        receipt.status = "Validé"
        db.commit()
        db.refresh(receipt)
        return receipt
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{receipt_id}/cancel-validation", response_model=PurchaseReceiptRead)
def cancel_purchase_receipt_validation(receipt_id: str, db: Session = Depends(get_db)):
    receipt = crud.get_by_id(db, PurchaseReceipt, receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase receipt not found")
    if receipt.status != "Validé":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce bon de réception n'est pas validé.")

    already_invoiced = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.purchase_receipt_id == receipt_id
    ).first()
    if already_invoiced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce bon de réception a déjà été facturé et sa validation ne peut pas être annulée.",
        )

    try:
        for item in (receipt.items or []):
            product = crud.get_by_id(db, Product, item.get("product_id"))
            if product:
                qty = item.get("quantity", 0)
                if (product.stock_level or 0) < qty:
                    raise ValueError(f'Stock insuffisant pour "{product.name}"')
                product.stock_level = (product.stock_level or 0) - qty

        receipt.status = "Brouillon"
        db.commit()
        db.refresh(receipt)
        return receipt
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
