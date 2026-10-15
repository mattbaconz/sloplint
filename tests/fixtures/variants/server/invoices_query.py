# expect: SEC-003
# The constant column list is fine; the order column comes from the request, so the f-string is not.
INVOICE_COLUMNS = "id, customer_name, total_cents, due_date"


def list_invoices(cursor, user_id, order):
    cursor.execute(f"SELECT {INVOICE_COLUMNS} FROM invoices WHERE user_id = %s ORDER BY {order}", (user_id,))
    return cursor.fetchall()
