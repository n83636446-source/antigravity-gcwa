from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ArticleFamily
from ..schemas import ArticleFamilyCreate, ArticleFamilyUpdate, ArticleFamilyRead
from .. import crud
from ..reference_guards import ensure_family_deletable

router = APIRouter()


@router.get("", response_model=List[ArticleFamilyRead])
def get_article_families(db: Session = Depends(get_db)):
    return crud.get_all(db, ArticleFamily)


@router.get("/{family_id}", response_model=ArticleFamilyRead)
def get_article_family(family_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, ArticleFamily, family_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Famille d'articles introuvable.")
    return db_obj


@router.post("", response_model=ArticleFamilyRead, status_code=status.HTTP_201_CREATED)
def create_article_family(data: ArticleFamilyCreate, db: Session = Depends(get_db)):
    existing = crud.get_by_id(db, ArticleFamily, data.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cet identifiant existe déjà.")
    if db.query(ArticleFamily).filter(ArticleFamily.code == data.code).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Le code "{data.code}" est déjà utilisé.')
    return crud.create(db, ArticleFamily, data.model_dump())


@router.put("/{family_id}", response_model=ArticleFamilyRead)
def update_article_family(family_id: str, data: ArticleFamilyUpdate, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, ArticleFamily, family_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Famille d'articles introuvable.")
    return crud.update(db, db_obj, data.model_dump(exclude_unset=True))


@router.delete("/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article_family(family_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_by_id(db, ArticleFamily, family_id)
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Famille d'articles introuvable.")
    ensure_family_deletable(db, family_id)
    crud.delete(db, db_obj)
 
