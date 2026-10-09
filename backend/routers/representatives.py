from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Representative
from ..schemas import RepresentativeCreate, RepresentativeUpdate, RepresentativeRead
from .. import crud
from ..reference_guards import ensure_representative_deletable

router = APIRouter()


@router.get("", response_model=List[RepresentativeRead])
def get_representatives(db: Session = Depends(get_db)):
    return crud.get_all(db, Representative)


@router.get("/{representative_id}", response_model=RepresentativeRead)
def get_representative(representative_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Representative, representative_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Représentant introuvable.")
    return db_obj


@router.post("", response_model=RepresentativeRead, status_code=status.HTTP_201_CREATED)
def create_representative(data: RepresentativeCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, Representative, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet identifiant existe déjà.")
    if data.code and db.query(Representative).filter(Representative.code == data.code).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le code "{data.code}" est déjà utilisé.')
    if db.query(Representative).filter(Representative.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet email est déjà utilisé.")
    return crud.create(db, Representative, data.model_dump())


@router.put("/{representative_id}", response_model=RepresentativeRead)
def update_representative(representative_id: str, data: RepresentativeUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Representative, representative_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Représentant introuvable.")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{representative_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_representative(representative_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Representative, representative_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Représentant introuvable.")
    ensure_representative_deletable(db, representative_id)
    crud.delete(db, db_obj)
 
