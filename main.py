from pathlib import Path
import argparse

import kse_grid

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KSE Grid interactive dashboard")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("case_file", nargs="?", type=Path, default=None)
    group.add_argument("--new", action="store_true", help="Start with an empty grid")
    args = parser.parse_args()

    if args.new:
        kse_grid.KSEGrid.new_empty().serve()
    else:
        case_file = args.case_file or Path(__file__).resolve().parent / "data" / "Solina_Kozienice.m"
        kse_grid.KSEGrid.from_matpower_case(case_file).run_powerflow().serve()
