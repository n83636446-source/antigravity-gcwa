from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SalesData
from ..schemas import SalesDataCreate, SalesDataRead
from .. import crud

router = APIRouter()


@router.get("", response_model=List[SalesDataRead])
def get_sales_data(db: Session = Depends(get_db)):
    return crud.get_all(db, SalesData)


@router.post("", response_model=SalesDataRead, status_code=status.HTTP_201_CREATED)
def create_sales_data(data: SalesDataCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, SalesData, data.month)
    if existing:
        return crud.update(db, existing, data.model_dump())
    return crud.create(db, SalesData, data.model_dump())
 
