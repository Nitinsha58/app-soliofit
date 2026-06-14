"""VS-27.2 — one-time, idempotent legacy reconciliation (ADR-0009).

The MVP shipped under the old flexible rules: many live orders have no installments, some
are partially scheduled. This command brings existing **billed, non-deleted** orders onto the
strict invariant `total_amount == Σ(installments)` — without ever touching paid history — and
surfaces anything that needs a human decision.

Dry run by default (prints a report, writes nothing). `--apply` performs the writes, each
order inside its own transaction. Idempotent: a second `--apply` reports "0 to change".

    python manage.py backfill_installments                 # dry run
    python manage.py backfill_installments --apply          # apply
    python manage.py backfill_installments --boutique <id>  # limit to one boutique
    python manage.py backfill_installments --output rep.txt # also write the report to a file
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.orders.models import Order
from apps.payments.models import Installment

TWO_PLACES = Decimal('0.01')
MIGRATION_REMARK = 'Auto-balanced during VS-27 migration'

# Classification order matters: Σ(paid) > total is checked FIRST — such an order violates the
# invariant total >= Σ(paid) and can never be auto-balanced (you cannot subtract paid money).
CASES = ('paid_exceeds', 'unscheduled', 'partial', 'balanced', 'over_scheduled')


def _q(value):
    """Quantize money to 2dp for exact (paisa-level) equality, matching the server checks."""
    return Decimal(value).quantize(TWO_PLACES)


class Command(BaseCommand):
    help = "Reconcile legacy orders to the strict bill == Σ(installments) invariant (VS-27.2)."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Perform the writes (default: dry run, writes nothing).')
        parser.add_argument('--boutique', default=None,
                            help='Limit the run to a single boutique id.')
        parser.add_argument('--output', default=None,
                            help='Also write the full report to this file path.')

    def handle(self, *args, **opts):
        apply = opts['apply']
        boutique_id = opts['boutique']
        output_path = opts['output']

        qs = Order.objects.filter(deleted_at__isnull=True, total_amount__gt=0)
        if boutique_id:
            qs = qs.filter(boutique_id=boutique_id)
        qs = qs.order_by('boutique_id', 'order_number')

        counts = {k: 0 for k in CASES}
        change_lines = []   # orders the command will / did fix
        manual_lines = []   # orders that need a human decision (never auto-fixed)

        for order in qs:
            rows = list(order.installments.all())  # paid + unpaid
            total = _q(order.total_amount)
            paid = _q(sum((r.amount for r in rows if r.paid_date), Decimal('0')))
            sched_all = _q(sum((r.amount for r in rows), Decimal('0')))
            # Identify the order unambiguously: order_number is unique only per boutique.
            ref = f'boutique={order.boutique_id} order_id={order.id} #{order.order_number}'

            # 1) Paid exceeds bill — highest priority, never auto-fixed.
            if paid > total:
                counts['paid_exceeds'] += 1
                manual_lines.append(f'  [paid exceeds bill] {ref} — paid ₹{paid} vs bill ₹{total}')
                continue

            # 2) Unscheduled — seed the default installment (= bill, due on the delivery date).
            if not rows:
                counts['unscheduled'] += 1
                change_lines.append(
                    f'  [unscheduled] {ref} — create default ₹{total} due {order.delivery_date}')
                if apply:
                    with transaction.atomic():
                        Installment.objects.create(
                            order=order, amount=total, due_date=order.delivery_date,
                            remarks=MIGRATION_REMARK)
                continue

            # 3) Balanced — nothing to do.
            if sched_all == total:
                counts['balanced'] += 1
                continue

            # 4) Partial — add one balancing unpaid row (paid rows are respected via Σ(all)).
            if sched_all < total:
                counts['partial'] += 1
                balance = _q(total - sched_all)
                change_lines.append(
                    f'  [partial] {ref} — Σ ₹{sched_all} of ₹{total} → add ₹{balance} '
                    f'due {order.delivery_date}')
                if apply:
                    with transaction.atomic():
                        Installment.objects.create(
                            order=order, amount=balance, due_date=order.delivery_date,
                            remarks=MIGRATION_REMARK)
                continue

            # 5) Over-scheduled (sched_all > total, paid <= total) — never auto-fixed, because
            #    removing rows could touch paid ones. Human decides.
            counts['over_scheduled'] += 1
            manual_lines.append(
                f'  [over-scheduled] {ref} — Σ ₹{sched_all} > bill ₹{total} (paid ₹{paid})')

        scanned = sum(counts.values())
        to_change = counts['unscheduled'] + counts['partial']
        manual = counts['paid_exceeds'] + counts['over_scheduled']

        lines = []
        lines.append(f'VS-27.2 backfill — {"APPLY" if apply else "DRY RUN"}')
        scope = f' (boutique {boutique_id})' if boutique_id else ''
        lines.append(f'Scanned {scanned} billed, non-deleted orders{scope}')
        lines.append('')
        lines.append('Counts:')
        for k in CASES:
            lines.append(f'  {k}: {counts[k]}')
        lines.append('')
        lines.append(f'Orders to change: {to_change}')
        lines.extend(change_lines)
        lines.append('')
        lines.append(f'Manual review required: {manual}')
        lines.extend(manual_lines)
        if not apply and to_change:
            lines.append('')
            lines.append('Dry run — no changes written. Re-run with --apply to apply.')

        report = '\n'.join(lines)
        self.stdout.write(report)
        if output_path:
            with open(output_path, 'w') as fh:
                fh.write(report + '\n')
            self.stdout.write(f'\nReport written to {output_path}')
