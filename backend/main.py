from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import (
    article_families,
    suppliers,
    products,
    clients,
    representatives,
    sales_data,
    purchase_orders,
    purchase_receipts,
    purchase_invoices,
    purchase_credit_notes,
    reglements,
)

# Auto-create all tables in SQLite
Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockPilot API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9002", "http://127.0.0.1:9002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(article_families.router, prefix="/article_families", tags=["Article Families"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
app.include_router(products.router, prefix="/products", tags=["Products"])
app.include_router(clients.router, prefix="/clients", tags=["Clients"])
app.include_router(representatives.router, prefix="/representatives", tags=["Representatives"])
app.include_router(sales_data.router, prefix="/sales_data", tags=["Sales Data"])
app.include_router(purchase_orders.router, prefix="/purchase_orders", tags=["Purchase Orders"])
app.include_router(purchase_receipts.router, prefix="/purchase_receipts", tags=["Purchase Receipts"])
app.include_router(purchase_invoices.router, prefix="/purchase_invoices", tags=["Purchase Invoices"])
app.include_router(purchase_credit_notes.router, prefix="/purchase_credit_notes", tags=["Purchase Credit Notes"])
app.include_router(reglements.router, prefix="/reglements", tags=["Reglements"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}

