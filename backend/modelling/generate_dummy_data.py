import pandas as pd
import numpy as np
import datetime as dt
import os

def generate_dummy_data(output_dir='backend/data'):
    """
    Generates dummy datasets to test the RetailMind customer analytics and CLTV models.
    Creates:
    1. dummy_clean_transactions.csv (Raw transactional data)
    2. dummy_rfm_customers.csv (Pre-computed RFM profiles for quick scoring)
    """
    os.makedirs(output_dir, exist_ok=True)
    print(f"Generating dummy data in directory: {output_dir}")
    
    # Set random seed for reproducibility
    np.random.seed(42)
    
    # ----------------------------------------------------
    # 1. GENERATE DUMMY RFM CUSTOMER DATA
    # ----------------------------------------------------
    # We will generate 100 synthetic customers representing various personas:
    # - Champions/High Value: Low Recency, High Frequency, High Monetary
    # - At Risk: High Recency, High Frequency, High Monetary
    # - New Customers: Low Recency, Low Frequency, Low/Modest Monetary
    # - Hibernating: High Recency, Low Frequency, Low Monetary
    # - Normal/Average: Mid values
    
    n_customers = 100
    customer_ids = np.arange(20001, 20001 + n_customers, dtype=float)
    
    # Personas distribution: 15% Champions, 20% At Risk, 15% New, 30% Hibernating, 20% Normal
    personas = ['Champion'] * 15 + ['At Risk'] * 20 + ['New'] * 15 + ['Hibernating'] * 30 + ['Normal'] * 20
    np.random.shuffle(personas)
    
    recencies = []
    frequencies = []
    monetaries = []
    countries = []
    
    countries_list = ['United Kingdom', 'Germany', 'France', 'EIRE', 'Spain', 'Netherlands', 'Australia']
    
    for p in personas:
        country = np.random.choice(countries_list, p=[0.7, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05])
        countries.append(country)
        
        if p == 'Champion':
            recencies.append(int(np.random.randint(1, 15)))
            frequencies.append(int(np.random.randint(12, 50)))
            monetaries.append(float(np.random.uniform(5000, 80000)))
        elif p == 'At Risk':
            recencies.append(int(np.random.randint(150, 450)))
            frequencies.append(int(np.random.randint(8, 25)))
            monetaries.append(float(np.random.uniform(3000, 15000)))
        elif p == 'New':
            recencies.append(int(np.random.randint(1, 10)))
            frequencies.append(int(np.random.randint(1, 3)))
            monetaries.append(float(np.random.uniform(100, 600)))
        elif p == 'Hibernating':
            recencies.append(int(np.random.randint(250, 650)))
            frequencies.append(int(np.random.randint(1, 3)))
            monetaries.append(float(np.random.uniform(30, 400)))
        else: # Normal
            recencies.append(int(np.random.randint(30, 120)))
            frequencies.append(int(np.random.randint(3, 8)))
            monetaries.append(float(np.random.uniform(400, 2000)))
            
    df_rfm = pd.DataFrame({
        'Customer ID': customer_ids,
        'Recency': recencies,
        'Frequency': frequencies,
        'Monetary': monetaries,
        'Country': countries
    })
    
    # Save RFM dummy file
    rfm_path = os.path.join(output_dir, 'dummy_rfm_customers.csv')
    df_rfm.to_csv(rfm_path, index=False)
    print(f" -> Saved {n_customers} customer profiles to: {rfm_path}")
    
    # ----------------------------------------------------
    # 2. GENERATE DUMMY TRANSACTIONAL DATA
    # ----------------------------------------------------
    # We will generate synthetic transaction history for 30 customers
    # over a 2-year period to test the full pipeline.
    
    print("Generating synthetic transactions...")
    tx_customers = customer_ids[:30]
    dates = []
    invoices = []
    stock_codes = []
    descriptions = []
    quantities = []
    prices = []
    total_prices = []
    cust_ids = []
    tx_countries = []
    
    base_date = dt.datetime(2024, 1, 1) # Start date
    invoice_seq = 500000
    
    # Typical stock items
    items = [
        ('85123A', 'WHITE HANGING HEART T-LIGHT HOLDER', 2.55),
        ('22423', 'REGENCY CAKESTAND 3 TIER', 12.75),
        ('84879', 'ASSORTED COLOUR BIRD ORNAMENT', 1.69),
        ('47566', 'PARTY BUNTING', 4.95),
        ('20725', 'LUNCH BAG RED RETROSPOT', 1.65),
        ('POST', 'POSTAGE', 18.00),
        ('22960', 'JAM MAKING SET WITH JARS', 2.55),
        ('22197', 'POPCORN HOLDER', 0.85),
        ('85099B', 'JUMBO BAG RED RETROSPOT', 1.79)
    ]
    
    for i, c_id in enumerate(tx_customers):
        p = personas[i]
        c_country = countries[i]
        
        # Decide number of distinct orders
        if p == 'Champion':
            n_orders = np.random.randint(10, 20)
        elif p == 'At Risk':
            n_orders = np.random.randint(6, 12)
        elif p == 'New':
            n_orders = 1
        elif p == 'Hibernating':
            n_orders = np.random.choice([1, 2])
        else:
            n_orders = np.random.randint(3, 7)
            
        # Distribute orders over time
        for order_idx in range(n_orders):
            invoice_seq += 1
            invoice_num = str(invoice_seq)
            
            # Determine order date based on persona recency
            if p == 'Champion' or p == 'New':
                # Recent dates (up to 15 days ago from observation end 2025-12-31)
                days_offset = np.random.randint(1, 15)
            elif p == 'At Risk':
                # Active in past, inactive for 180-360 days
                days_offset = np.random.randint(180, 360)
            elif p == 'Hibernating':
                # Active 300-600 days ago
                days_offset = np.random.randint(300, 600)
            else:
                # Normal mid-range
                days_offset = np.random.randint(30, 120)
                
            # Distribute earlier orders for repeat buyers
            order_date = base_date + dt.timedelta(days=(730 - days_offset - np.random.randint(0, 300) * (order_idx > 0)))
            
            # Number of items per order
            n_items = np.random.randint(1, 6)
            for _ in range(n_items):
                item = items[np.random.choice(len(items))]
                qty = int(np.random.choice([1, 2, 5, 10, 24, 48]))
                price = item[2]
                total_price = round(qty * price, 2)
                
                dates.append(order_date.strftime('%Y-%m-%d %H:%M:%S'))
                invoices.append(invoice_num)
                stock_codes.append(item[0])
                descriptions.append(item[1])
                quantities.append(qty)
                prices.append(price)
                total_prices.append(total_price)
                cust_ids.append(c_id)
                tx_countries.append(c_country)
                
    df_tx = pd.DataFrame({
        'Invoice': invoices,
        'StockCode': stock_codes,
        'Description': descriptions,
        'Quantity': quantities,
        'InvoiceDate': dates,
        'Price': prices,
        'Customer ID': cust_ids,
        'Country': tx_countries,
        'TotalPrice': total_prices
    })
    
    # Save transactional dummy file
    tx_path = os.path.join(output_dir, 'dummy_clean_transactions.csv')
    df_tx.to_csv(tx_path, index=False)
    print(f" -> Saved {len(df_tx)} transactional records to: {tx_path}")
    print("Dummy data generation successfully completed!")

if __name__ == '__main__':
    generate_dummy_data()
