import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

# Credentials provided by user for verification session
url = "https://pcmlhgjphgquobcdpjpd.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbWxoZ2pwaGdxdW9iY2RwanBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDQxMTcsImV4cCI6MjA4MDY4MDExN30.JjgqpDyx58Y3pHgVwBe1T-EsDOkF3-iNC6WM13Vv7hE"

print(f"Debug: URL set manually.")
supabase: Client = create_client(url, key)

async def verify_waste_logic():
    print("--- Starting Waste Logic Verification ---")
    
    # 1. Setup: Get a valid Product and its Tenant
    print("1. Fetching test data (Product first)...")
    # Instead of random tenant, get a product that exists
    products = supabase.table("menu").select("id, name, price, tenant_id").limit(1).execute()
    
    if not products.data:
        print("❌ No products found visible to Anon Key.")
        print("   (Check RLS: 'Public Read' policy on 'menu' might be missing or restricted)")
        return
        
    product = products.data[0]
    tenant_id = product['tenant_id']
    
    print(f"   Found Product: {product['name']} ({product['id']})")
    print(f"   Linked Tenant: {tenant_id}")

    # 2. Create Order (Pending)
    print("\n2. Creating Test Order...")
    order_res = supabase.table("pos_orders").insert({
        "tenant_id": tenant_id,
        "total_amount": product['price'],
        "status": "pending",
        "customer_name": "Waste Test Bot"
    }).execute()
    order_id = order_res.data[0]['id']
    print(f"   Order Created: {order_id}")

    # Insert Order Item
    supabase.table("pos_order_items").insert({
        "tenant_id": tenant_id,
        "pos_order_id": order_id,
        "product_id": product['id'],
        "name": product['name'],
        "quantity": 1,
        "price": product['price'],
        "status": "pending"
    }).execute()

    # 3. Simulate Payment (Pending -> Paid)
    print("\n3. Simulating Payment (Status -> paid)...")
    # This should trigger stock deduction via 'atomic_stock_deduction'
    supabase.table("pos_orders").update({"status": "paid"}).eq("id", order_id).execute()
    print("   Order status updated to 'paid'. Stock should be deducted.")

    # 4. Simulate Cancellation (Paid -> Cancelled)
    print("\n4. Simulating Cancellation (Status -> cancelled)...")
    # This should trigger the 'waste' logic
    supabase.table("pos_orders").update({"status": "cancelled"}).eq("id", order_id).execute()
    print("   Order status updated to 'cancelled'. Checking for 'waste' record...")

    # 5. Verify Waste Record
    print("\n5. Verifying Inventory Transaction...")
    waste_record = supabase.table("inventory_transactions")\
        .select("*")\
        .eq("reference_id", order_id)\
        .eq("transaction_type", "waste")\
        .execute()

    if waste_record.data:
        print("✅ SUCCESS: Waste transaction found!")
        print(waste_record.data[0])
    else:
        print("❌ FAILURE: No waste transaction found.")
        
        # Check if maybe 'sale' transaction exists
        sale_record = supabase.table("inventory_transactions")\
            .select("*")\
            .eq("reference_id", order_id)\
            .eq("transaction_type", "sale")\
            .execute()
        if sale_record.data:
             print("   (However, 'sale' transaction exists, so stock deduction worked.)")
        else:
             print("   (Neither 'sale' nor 'waste' transactions found. Trigger might be broken.)")

    # Cleanup (Optional)
    # supabase.table("pos_orders").delete().eq("id", order_id).execute()

if __name__ == "__main__":
    asyncio.run(verify_waste_logic())
