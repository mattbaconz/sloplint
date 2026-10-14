export function PaymentError({ reason }: { reason: string }) {
  return (
    <p role="alert">
      Your bank declined the card ({reason}). Try a different card, or ask the bank to allow the charge. Your order is saved.
    </p>
  );
}
