from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Supplier
from ..schemas import SupplierCreate, SupplierUpdate, SupplierRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[SupplierRead])
def get_suppliers(db: Session = Depends(get_db)):
    return crud.get_all(db, Supplier)


@router.get("/{supplier_id}", response_model=SupplierRead)
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Supplier, supplier_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return db_obj


@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, Supplier, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier ID already exists")
    if db.query(Supplier).filter(Supplier.code == data.code).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le code "{data.code}" est déjà utilisé.')
    if db.query(Supplier).filter(Supplier.ice == data.ice).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet ICE est déjà utilisé par un autre fournisseur.")
    if db.query(Supplier).filter(Supplier.contact_phone == data.contact_phone).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce numéro de téléphone est déjà utilisé.")
    if db.query(Supplier).filter(Supplier.contact_email == data.contact_email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet email est déjà utilisé.")
    return crud.create(db, Supplier, data.model_dump())


@router.put("/{supplier_id}", response_model=SupplierRead)
def update_supplier(supplier_id: str, data: SupplierUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Supplier, supplier_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Supplier, supplier_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    crud.delete(db, db_obj)
 
