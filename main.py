import sys
from pathlib import Path

# PyInstaller frozen binary: resources are unpacked to sys._MEIPASS
_BASE = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent

import kse_grid

if __name__ == "__main__":
    kse_grid.KSEGrid.new_empty().serve()
