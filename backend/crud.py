from typing import Type, TypeVar, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from .database import Base

ModelType = TypeVar("ModelType", bound=Base)


def get_all(db: Session, model: Type[ModelType]) -> List[ModelType]:
    return list(db.scalars(select(model)).all())


def get_by_id(db: Session, model: Type[ModelType], id_val: Any) -> Optional[ModelType]:
    return db.get(model, id_val)


def create(db: Session, model: Type[ModelType], obj_in: dict) -> ModelType:
    db_obj = model(**obj_in)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update(db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
    for field, value in obj_in.items():
        if value is not None:
            setattr(db_obj, field, value)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete(db: Session, db_obj: ModelType) -> None:
    db.delete(db_obj)
    db.commit()