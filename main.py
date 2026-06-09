import sys
from pathlib import Path

import kse_grid

if __name__ == "__main__":
    if len(sys.argv) > 1:
        case_file = Path(sys.argv[1])
        if not case_file.exists():
            print(f"Error: file not found: {case_file}")
            sys.exit(1)
        print(f"Loading: {case_file.name}")
        kse_grid.KSEGrid.from_matpower_case(case_file).serve()
    else:
        kse_grid.KSEGrid.new_empty().serve()
