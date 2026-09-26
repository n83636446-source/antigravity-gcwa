from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Client
from ..schemas import ClientCreate, ClientUpdate, ClientRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[ClientRead])
def get_clients(db: Session = Depends(get_db)):
    return crud.get_all(db, Client)


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Client, client_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return db_obj


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, Client, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client ID already exists")
    return crud.create(db, Client, data.model_dump())


@router.put("/{client_id}", response_model=ClientRead)
def update_client(client_id: str, data: ClientUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Client, client_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, Client, client_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    crud.delete(db, db_obj)
 
