import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base, SessionLocal
from sqlalchemy import inspect
from backend.models import ArticleFamily, Supplier, Product, Client, Representative, SalesData, PurchaseOrder, PurchaseReceipt, PurchaseInvoice, PurchaseCreditNote, Reglement

def main():
    if not os.environ.get('FORCE_RESEED'):
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        db = SessionLocal()
        try:
            for model in [PurchaseOrder, PurchaseReceipt, PurchaseInvoice, PurchaseCreditNote, Reglement]:
                table_name = model.__tablename__
                if table_name in existing_tables and db.query(model).first():
                    print(f'Refusing to run: table "{table_name}" already contains data.')
                    print('This script drops and recreates ALL tables, which would permanently delete it.')
                    print('If you are certain you want to proceed anyway, re-run with FORCE_RESEED=1.')
                    sys.exit(1)
        finally:
            db.close()

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    article_families = [
        ArticleFamily(id='fam-1', code='FAM001', name='Electronique'),
        ArticleFamily(id='fam-2', code='FAM002', name='Mobilier de bureau'),
        ArticleFamily(id='fam-3', code='FAM003', name='Fournitures'),
    ]

    suppliers = [
        Supplier(id='sup-1', code='FOU001', name='Tech Distribution SARL',
                 contact_name='Ahmed Mansouri', contact_email='contact@techdist.ma',
                 contact_phone='0522445566', street='123 Boulevard Zerktouni',
                 city='Casablanca', country='Maroc', ice='001234567890123'),
        Supplier(id='sup-2', code='FOU002', name='Office Pro Maroc',
                 contact_name='Sanaa Bennani', contact_email='s.bennani@officepro.ma',
                 contact_phone='0537778899', street='45 Avenue de France',
                 city='Rabat', country='Maroc', ice='009876543210987'),
    ]

    products = [
        Product(id='prod-1', code='ART001', name='Ordinateur Portable Pro 15',
                description='PC haute performance pour professionnels, 16Go RAM, 512Go SSD.',
                price=12500.0, stock_level=15, reorder_threshold=5, family_id='fam-1'),
        Product(id='prod-2', code='ART002', name='Chaise Ergonomique Elite',
                description='Chaise de bureau reglable avec support lombaire.',
                price=2800.0, stock_level=8, reorder_threshold=12, family_id='fam-2'),
        Product(id='prod-3', code='ART003', name='Ecran 27 4K UHD',
                description='Moniteur haute resolution pour graphisme et bureautique.',
                price=4500.0, stock_level=20, reorder_threshold=10, family_id='fam-1'),
        Product(id='prod-4', code='ART004', name='Souris Sans Fil Logitech',
                description='Souris optique silencieuse avec recepteur USB.',
                price=250.0, stock_level=45, reorder_threshold=15, family_id='fam-1'),
        Product(id='prod-5', code='ART005', name='Bureau en Bois Massif',
                description='Bureau directionnel 180x90cm avec tiroirs.',
                price=5400.0, stock_level=2, reorder_threshold=3, family_id='fam-2'),
    ]

    clients = [
        Client(id='cli-1', name='Banque du Maghreb', email='achats@bdm.ma',
               phone='0522112233', address='Place des Nations Unies, Casablanca'),
        Client(id='cli-2', name='Startup Flow SAS', email='hello@flow.ma',
               phone='0661998877', address='Technopark, Bureau 402, Casablanca'),
        Client(id='cli-3', name='Cabinet Medical Benjelloun',
               email='contact@cabinetbenjelloun.ma', phone='0537001122',
               address='Avenue Mohammed V, Rabat'),
    ]

    representatives = [
        Representative(id='rep-1', name='Youssef El Amrani', email='y.elamrani@stockpilot.ma'),
        Representative(id='rep-2', name='Laila Kadiri', email='l.kadiri@stockpilot.ma'),
    ]

    sales_data = [
        SalesData(month='Jan', this_year=4000, last_year=2400),
        SalesData(month='Fev', this_year=3000, last_year=1398),
        SalesData(month='Mar', this_year=5000, last_year=4800),
        SalesData(month='Avr', this_year=4780, last_year=3908),
        SalesData(month='Mai', this_year=5890, last_year=4800),
        SalesData(month='Juin', this_year=4390, last_year=3800),
        SalesData(month='Juil', this_year=5490, last_year=4300),
    ]

    db = SessionLocal()
    try:
        for items in [article_families, suppliers, products, clients, representatives, sales_data]:
            for item in items:
                db.add(item)
        db.commit()
        print('Database populated successfully with SQLAlchemy.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
