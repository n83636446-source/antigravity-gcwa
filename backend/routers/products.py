from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductUpdate, ProductRead
from .. import crud
from ..reference_guards import ensure_product_deletable

router = APIRouter()


@router.get("", response_model=List[ProductRead])
def get_products(db: Session = Depends(get_db)):
    return crud.get_all(db, Product)


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Product, product_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable.")
    return db_obj


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, Product, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet identifiant existe déjà.")
    existing_code = db.query(Product).filter(Product.code == data.code).first()
    if existing_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le code "{data.code}" est déjà utilisé.')
    return crud.create(db, Product, data.model_dump())


@router.put("/{product_id}", response_model=ProductRead)
def update_product(product_id: str, data: ProductUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Product, product_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable.")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Product, product_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable.")
    ensure_product_deletable(db, product_id)
    crud.delete(db, db_obj)
 
