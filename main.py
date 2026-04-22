from pathlib import Path
import sys

import kse_grid

if __name__ == "__main__":
    case_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "data" / "case3120sp.m"
    kse_grid.KSEGrid.from_matpower_case(case_file).run_powerflow().serve_interactive()
