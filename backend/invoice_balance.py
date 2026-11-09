from sqlalchemy.orm import Session

from .models import PurchaseAdvance


def net_advance(db: Session, invoice_id: str) -> float:
    rows = db.query(PurchaseAdvance).filter(PurchaseAdvance.purchase_invoice_id == invoice_id).all()
    return round(sum((row.total_ttc or 0) for row in rows), 2)


def advance_totals(db: Session) -> dict:
    totals: dict = {}
    for row in db.query(PurchaseAdvance).all():
        totals[row.purchase_invoice_id] = round(totals.get(row.purchase_invoice_id, 0) + (row.total_ttc or 0), 2)
    return totals


def status_for_balance(total_ttc: float, amount_paid: float, advance_total: float) -> str:
    covered = round((amount_paid or 0) + (advance_total or 0), 2)
    if covered <= 0:
        return "Non payée"
    if covered >= round(total_ttc or 0, 2):
        return "Payée"
    return "Partiellement payée"
