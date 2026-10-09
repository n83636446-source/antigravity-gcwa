# StockPilot

A French-language business management app (gestion commerciale): inventory, suppliers, clients, representatives, and a full purchases workflow: BC (Bon de Commande) -> BR (Bon de Réception) -> FA (Facture d'Achat) -> AA (Avoir Achat), plus Règlements (payments).

## Stack

- Frontend: Next.js 15, React 18, Tailwind CSS, shadcn/ui (port 9002)
- Backend: FastAPI + SQLAlchemy (port 8001)
- Database: SQLite, file `stockpilot.db` in the project root (created automatically on first start, never committed)

## Starting the app (Windows)

Double-click `start.bat`. It opens two windows (backend, then frontend) and then the browser.

- Web app: http://localhost:9002
- API documentation: http://localhost:8001/docs
- Health check: http://localhost:8001/health

The backend runs from the bundled `python-embed/` folder (not stored in git).

## Configuration

Create a `.env` file in the project root (it is git-ignored, never commit it). It must contain:

    NEXT_PUBLIC_API_URL=http://localhost:8001

The stock-estimation feature on the dashboard also needs its Gemini API key in `.env`.

## Useful commands

- `npm run dev`: start the frontend only
- `npm run typecheck`: check the TypeScript code for errors (run it after code changes)

## Project layout

- `src/`: frontend (pages in `src/app`, components in `src/components`, API calls in `src/lib/api.ts`)
- `backend/`: API (routers in `backend/routers`, models in `models.py`, validation in `schemas.py`, delete rules in `reference_guards.py`)
- `start.bat`: starts everything

## Database notes

- Tables are created automatically, but existing tables are never altered and there is no migration tool. Before any change to a table's structure, back up `stockpilot.db` (and its `-wal` and `-shm` files) while the app is closed.
- `backend/populate.py` is a test-data script. It drops and recreates all tables. Never run it on real data.

## Rules the server enforces

- Stock never goes negative on purchases.
- Validated documents cannot be edited or deleted; cancel the validation first.
- A document cannot be transferred twice (one BR per BC, one FA per BR, one AA per FA).
- Suppliers, articles, families and representatives cannot be deleted while documents still use them.
- Payments (règlements) can cover several invoices, and an invoice can receive several payments. Payment deletion is temporary and for testing only.
