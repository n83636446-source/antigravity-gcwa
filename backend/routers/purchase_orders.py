from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PurchaseOrder
from ..schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[PurchaseOrderRead])
def get_purchase_orders(db: Session = Depends(get_db)):
    return crud.get_all(db, PurchaseOrder)


@router.get("/{order_id}", response_model=PurchaseOrderRead)
def get_purchase_order(order_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseOrder, order_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return db_obj


@router.post("", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
def create_purchase_order(data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, PurchaseOrder, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order ID already exists")
    if db.query(PurchaseOrder).filter(PurchaseOrder.order_number == data.order_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le numéro "{data.order_number}" est déjà utilisé.')
    return crud.create(db, PurchaseOrder, data.model_dump())


@router.put("/{order_id}", response_model=PurchaseOrderRead)
def update_purchase_order(order_id: str, data: PurchaseOrderUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseOrder, order_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(order_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, PurchaseOrder, order_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    crud.delete(db, db_obj)
 
