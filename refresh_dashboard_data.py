"""
Refresh all generated data used by the dashboard.

Retrains the model, rebuilds the database / forecast, then runs the inventory
and reorder simulation so the static frontend reads a consistent snapshot.
"""

import init_db
import run_inventory
import train_forecast_model


def main():
    train_forecast_model.main()
    print()
    init_db.main()
    print()
    run_inventory.run_simulation()


if __name__ == "__main__":
    main()
