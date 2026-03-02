"""
Load .pyc modules from Ai detector Model backend and fully inspect them.
This gives us runtime access to all classes, functions, constants, etc.
"""
import sys, os, importlib, importlib.util, inspect, types, marshal, struct

BASE = r"C:\Users\User\Desktop\Smart_Postal\Ai detector Model\backend"

# We need to set up the packages first
sys.path.insert(0, BASE)

# Create fake __init__.py files so we can import sub-packages
PACKAGES = ['app', 'app.models', 'app.routers', 'app.services', 'app.utils']

# Map pyc files to module names
PYC_MAP = {
    'app/__pycache__/__init__.cpython-312.pyc': 'app',
    'app/__pycache__/config.cpython-312.pyc': 'app.config',
    'app/__pycache__/main.cpython-312.pyc': 'app.main',
    'app/models/__pycache__/__init__.cpython-312.pyc': 'app.models',
    'app/models/__pycache__/schemas.cpython-312.pyc': 'app.models.schemas',
    'app/routers/__pycache__/__init__.cpython-312.pyc': 'app.routers',
    'app/routers/__pycache__/voice.cpython-312.pyc': 'app.routers.voice',
    'app/routers/__pycache__/voice_auth.cpython-312.pyc': 'app.routers.voice_auth',
    'app/services/__pycache__/__init__.cpython-312.pyc': 'app.services',
    'app/services/__pycache__/ai_detector.cpython-312.pyc': 'app.services.ai_detector',
    'app/services/__pycache__/elevenlabs.cpython-312.pyc': 'app.services.elevenlabs',
    'app/services/__pycache__/ensemble.cpython-312.pyc': 'app.services.ensemble',
    'app/services/__pycache__/liveness.cpython-312.pyc': 'app.services.liveness',
    'app/services/__pycache__/prosodic_analyzer.cpython-312.pyc': 'app.services.prosodic_analyzer',
    'app/services/__pycache__/replay_guard.cpython-312.pyc': 'app.services.replay_guard',
    'app/services/__pycache__/speaker_verification.cpython-312.pyc': 'app.services.speaker_verification',
    'app/services/__pycache__/spectral_analyzer.cpython-312.pyc': 'app.services.spectral_analyzer',
    'app/services/__pycache__/voice_auth_store.cpython-312.pyc': 'app.services.voice_auth_store',
    'app/utils/__pycache__/__init__.cpython-312.pyc': 'app.utils',
    'app/utils/__pycache__/audio.cpython-312.pyc': 'app.utils.audio',
    'app/utils/__pycache__/file_manager.cpython-312.pyc': 'app.utils.file_manager',
}

def load_pyc_code(path):
    with open(path, 'rb') as f:
        f.read(4); f.read(4); f.read(8)
        return marshal.load(f)

def dump_code_object_full(code, indent=0):
    """Recursively dump ALL information from a code object."""
    pfx = "    " * indent
    import dis, io
    
    print(f"{pfx}# === Code: {code.co_name} (line {code.co_firstlineno}) ===")
    print(f"{pfx}# File: {code.co_filename}")
    print(f"{pfx}# Args: {code.co_varnames[:code.co_argcount]}")
    if code.co_kwonlyargcount:
        kw_start = code.co_argcount
        print(f"{pfx}# KW-only args: {code.co_varnames[kw_start:kw_start+code.co_kwonlyargcount]}")
    print(f"{pfx}# All locals: {code.co_varnames}")
    print(f"{pfx}# Names (globals/attrs): {code.co_names}")
    print(f"{pfx}# Free vars: {code.co_freevars}")
    print(f"{pfx}# Cell vars: {code.co_cellvars}")
    
    print(f"{pfx}# Constants:")
    for i, c in enumerate(code.co_consts):
        if isinstance(c, types.CodeType):
            print(f"{pfx}#   [{i}] <code '{c.co_name}' line {c.co_firstlineno}>")
        elif isinstance(c, frozenset):
            print(f"{pfx}#   [{i}] frozenset({set(c)})")
        elif isinstance(c, bytes):
            print(f"{pfx}#   [{i}] {repr(c)[:200]}")
        else:
            print(f"{pfx}#   [{i}] {repr(c)}")
    
    # Full bytecode
    buf = io.StringIO()
    old = sys.stdout; sys.stdout = buf
    try: dis.dis(code)
    finally: sys.stdout = old
    
    print(f"{pfx}# Bytecode:")
    for line in buf.getvalue().rstrip().split('\n'):
        print(f"{pfx}#   {line}")
    print()
    
    # Recurse
    for c in code.co_consts:
        if isinstance(c, types.CodeType):
            dump_code_object_full(c, indent + 1)

def main():
    print("=" * 80)
    print("COMPLETE .pyc ANALYSIS - Ai detector Model Backend")
    print("=" * 80)
    
    # Process each file
    for rel_path, mod_name in sorted(PYC_MAP.items()):
        full_path = os.path.join(BASE, rel_path.replace('/', os.sep))
        if not os.path.exists(full_path):
            print(f"\nSKIPPED (not found): {rel_path}")
            continue
        
        py_path = rel_path.replace('__pycache__/', '').replace('.cpython-312.pyc', '.py')
        
        print(f"\n{'#' * 80}")
        print(f"# FILE: {py_path}")
        print(f"# Module: {mod_name}")
        print(f"# PYC: {rel_path}")
        print(f"{'#' * 80}")
        
        try:
            code = load_pyc_code(full_path)
            print(f"# Embedded source path: {code.co_filename}")
            print()
            dump_code_object_full(code)
        except Exception as e:
            print(f"ERROR loading: {e}")
            import traceback; traceback.print_exc()

if __name__ == '__main__':
    main()
