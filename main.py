from pathlib import Path

import kse_grid

if __name__ == "__main__":
    case_file = Path(__file__).resolve().parent / "data" / "case3120sp.m"
    grid = kse_grid.KSEGrid.from_matpower_case(case_file).run_powerflow()
    grid.report()
    grid.serve_interactive()
