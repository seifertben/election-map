export interface PickupPanelProps {
  /** Whether party flips (projected party != incumbent party) are striped. */
  stripePickups: boolean;
  onStripeChange: (enabled: boolean) => void;
}

export function PickupPanel({
  stripePickups,
  onStripeChange,
}: PickupPanelProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">Pickups</h2>
      <label className="ratings__toggle">
        <input
          type="checkbox"
          checked={stripePickups}
          onChange={(event) => onStripeChange(event.target.checked)}
        />
        Stripe party pickups
      </label>
      <p className="ratings__note">
        Seats whose projected party differs from the incumbent are striped: the
        wider band is the projected shade, the narrower one a lighter tint.
      </p>
    </section>
  );
}
