"""
Reconstruct Python 3.12 source from .pyc bytecode files.
Uses dis + marshal to analyze bytecode and reconstruct readable source.
"""
import marshal, dis, types, struct, os, sys, io

BASE = r"C:\Users\User\Desktop\Smart_Postal\Ai detector Model\backend"

def load_pyc(path):
    with open(path, 'rb') as f:
        magic = f.read(4)
        flags = struct.unpack('<I', f.read(4))[0]
        f.read(8)  # timestamp + size or hash
        code = marshal.load(f)
    return code

def get_all_pyc_files():
    result = []
    for root, dirs, files in os.walk(BASE):
        if 'venv' in root:
            continue
        for f in files:
            if f.endswith('.pyc'):
                result.append(os.path.join(root, f))
    return result

def full_disassembly(code, indent=0):
    """Get full recursive disassembly as string."""
    buf = io.StringIO()
    prefix = "  " * indent
    
    buf.write(f"{prefix}{'='*60}\n")
    buf.write(f"{prefix}Code Object: {code.co_name}\n")
    buf.write(f"{prefix}File: {code.co_filename}\n")
    buf.write(f"{prefix}First line: {code.co_firstlineno}\n")
    buf.write(f"{prefix}Arg count: {code.co_argcount}\n")
    buf.write(f"{prefix}Pos-only args: {code.co_posonlyargcount}\n")
    buf.write(f"{prefix}KW-only args: {code.co_kwonlyargcount}\n")
    buf.write(f"{prefix}Locals: {code.co_varnames}\n")
    buf.write(f"{prefix}Free vars: {code.co_freevars}\n")
    buf.write(f"{prefix}Cell vars: {code.co_cellvars}\n")
    buf.write(f"{prefix}Names: {code.co_names}\n")
    buf.write(f"{prefix}Constants:\n")
    for i, c in enumerate(code.co_consts):
        if isinstance(c, types.CodeType):
            buf.write(f"{prefix}  [{i}] <code object '{c.co_name}' at line {c.co_firstlineno}>\n")
        else:
            buf.write(f"{prefix}  [{i}] {repr(c)[:300]}\n")
    buf.write(f"{prefix}\n{prefix}Bytecode:\n")
    
    # Capture dis output
    old_stdout = sys.stdout
    sys.stdout = cap = io.StringIO()
    try:
        dis.dis(code)
    finally:
        sys.stdout = old_stdout
    
    for line in cap.getvalue().split('\n'):
        buf.write(f"{prefix}  {line}\n")
    
    # Recurse into nested code objects
    for c in code.co_consts:
        if isinstance(c, types.CodeType):
            buf.write(full_disassembly(c, indent + 1))
    
    return buf.getvalue()

def main():
    pyc_files = get_all_pyc_files()
    pyc_files.sort()
    
    for path in pyc_files:
        # Get relative path
        rel = os.path.relpath(path, BASE)
        # Get original .py file name from the .pyc
        basename = os.path.basename(path)
        pyname = basename.replace('.cpython-312.pyc', '.py')
        
        print(f"\n{'#'*80}")
        print(f"# FILE: {rel}")
        print(f"# Original: {pyname}")
        print(f"{'#'*80}\n")
        
        try:
            code = load_pyc(path)
            print(f"# Embedded filename: {code.co_filename}")
            print(f"# First line number: {code.co_firstlineno}")
            print()
            print(full_disassembly(code))
        except Exception as e:
            print(f"ERROR: {e}")
        
        print()

if __name__ == '__main__':
    main()
