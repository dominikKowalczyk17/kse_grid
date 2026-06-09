# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — single-file PowerFlow executable for Windows and Linux."""

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Bundle the entire web UI (Vue components, vendor JS/CSS, fonts, styles)
        ('kse_grid/web', 'kse_grid/web'),
    ],
    hiddenimports=[
        # uvicorn internals (not auto-detected by PyInstaller)
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # pandapower converter modules
        'pandapower.converter',
        'pandapower.converter.matpower',
        'pandapower.converter.matpower.from_mpc',
        'pandapower.converter.matpower.to_mpc',
        # scipy sparse solvers used by pandapower
        'scipy.sparse',
        'scipy.sparse.linalg',
        'scipy.sparse.linalg._dsolve',
        'scipy.sparse.linalg._dsolve.linsolve',
        'scipy.linalg.blas',
        'scipy.linalg.lapack',
        # python-multipart for FastAPI file upload
        'multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'IPython',
        'jupyter',
        'notebook',
        'PyQt5',
        'PyQt6',
        'wx',
        'tkinter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PowerFlow',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    # Keep console so engineers see startup messages; set False for a clean GUI-only experience
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
