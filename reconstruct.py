"""
Smart Python 3.12 bytecode-to-source reconstructor.
Uses importlib to load .pyc modules and inspect to extract structure.
Then uses bytecode analysis to fill in implementation details.
"""
import marshal, dis, types, struct, os, sys, io, importlib, importlib.util, inspect

BASE = r"C:\Users\User\Desktop\Smart_Postal\Ai detector Model\backend"

# Map of __pycache__ dirs to their parent package
PYC_FILES = []

def find_pyc_files():
    for root, dirs, files in os.walk(BASE):
        if 'venv' in root:
            continue
        for f in files:
            if f.endswith('.pyc'):
                PYC_FILES.append(os.path.join(root, f))
    PYC_FILES.sort()

def load_pyc(path):
    with open(path, 'rb') as f:
        f.read(4)  # magic
        f.read(4)  # flags
        f.read(8)  # timestamp + size
        code = marshal.load(f)
    return code

def reconstruct_from_code(code, indent=0):
    """Attempt to reconstruct Python source from a code object."""
    lines = []
    pfx = "    " * indent
    
    # Get bytecode instructions
    instructions = list(dis.get_instructions(code))
    
    i = 0
    while i < len(instructions):
        instr = instructions[i]
        
        # Track imports
        if instr.opname == 'IMPORT_NAME':
            mod_name = instr.argval
            # Check if next is IMPORT_FROM
            if i + 1 < len(instructions) and instructions[i+1].opname == 'IMPORT_FROM':
                names = []
                j = i + 1
                while j < len(instructions) and instructions[j].opname == 'IMPORT_FROM':
                    names.append(instructions[j].argval)
                    j += 1
                lines.append(f"{pfx}from {mod_name} import {', '.join(names)}")
                i = j
                continue
            else:
                lines.append(f"{pfx}import {mod_name}")
        
        # Track class definitions
        if instr.opname == 'LOAD_BUILD_CLASS':
            # Next should be LOAD_CONST with code object, then class name
            if i + 1 < len(instructions):
                code_instr = instructions[i+1]
                if hasattr(code_instr, 'argval') and isinstance(code_instr.argval, types.CodeType):
                    class_code = code_instr.argval
                    class_name = class_code.co_name
                    # Check for base classes
                    lines.append(f"\n{pfx}class {class_name}:")
                    class_lines = reconstruct_class(class_code, indent + 1)
                    lines.extend(class_lines)
        
        # Track function definitions at module level
        if instr.opname == 'MAKE_FUNCTION':
            # Look back for the code object
            if i - 1 >= 0 and isinstance(instructions[i-1].argval, types.CodeType):
                func_code = instructions[i-1].argval
                if func_code.co_name != '<module>' and not func_code.co_name.startswith('<'):
                    sig = get_function_sig(func_code)
                    lines.append(f"\n{pfx}def {sig}:")
                    func_lines = reconstruct_function_body(func_code, indent + 1)
                    lines.extend(func_lines)
        
        # Track assignments 
        if instr.opname == 'STORE_NAME' and indent == 0:
            # Check if it's a simple assignment
            if i - 1 >= 0 and instructions[i-1].opname == 'CALL':
                pass  # Complex assignment, handled elsewhere
            elif i - 1 >= 0 and instructions[i-1].opname == 'LOAD_CONST':
                val = instructions[i-1].argval
                if not isinstance(val, types.CodeType) and instr.argval != '__doc__':
                    lines.append(f"{pfx}{instr.argval} = {repr(val)}")
        
        i += 1
    
    return lines

def reconstruct_class(code, indent=0):
    """Reconstruct class body from code object."""
    lines = []
    pfx = "    " * indent
    instructions = list(dis.get_instructions(code))
    
    # Extract docstring
    for instr in instructions:
        if instr.opname == 'STORE_NAME' and instr.argval == '__doc__':
            idx = instructions.index(instr)
            if idx > 0 and instructions[idx-1].opname == 'LOAD_CONST':
                doc = instructions[idx-1].argval
                if isinstance(doc, str) and doc != code.co_name:
                    lines.append(f'{pfx}"""{doc}"""')
            break
    
    # Extract class attributes
    i = 0
    while i < len(instructions):
        instr = instructions[i]
        
        # Detect attribute assignments
        if instr.opname == 'STORE_NAME' and instr.argval not in ('__module__', '__qualname__', '__doc__', '__annotations__'):
            name = instr.argval
            # Look back to find the value
            val = trace_value_back(instructions, i)
            if val is not None:
                # Check for type annotation
                ann_type = find_annotation_type(instructions, i, name)
                if ann_type:
                    lines.append(f"{pfx}{name}: {ann_type} = {val}")
                else:
                    lines.append(f"{pfx}{name} = {val}")
        
        # Detect methods
        if instr.opname in ('LOAD_CONST',) and isinstance(instr.argval, types.CodeType):
            func_code = instr.argval
            if i + 1 < len(instructions) and instructions[i+1].opname == 'MAKE_FUNCTION':
                sig = get_function_sig(func_code)
                # Check for decorators
                decorator = check_decorator(instructions, i)
                if decorator:
                    lines.append(f"\n{pfx}@{decorator}")
                lines.append(f"{pfx}def {sig}:")
                func_lines = reconstruct_function_body(func_code, indent + 1)
                lines.extend(func_lines)
        
        i += 1
    
    if not lines:
        lines.append(f"{pfx}pass")
    
    return lines

def trace_value_back(instructions, store_idx):
    """Trace back from a STORE instruction to find the value being stored."""
    if store_idx < 1:
        return None
    
    prev = instructions[store_idx - 1]
    
    if prev.opname == 'LOAD_CONST':
        val = prev.argval
        if isinstance(val, types.CodeType):
            return None
        return repr(val)
    
    if prev.opname == 'CALL':
        # Complex call - try to reconstruct
        return "..."
    
    if prev.opname == 'BINARY_OP':
        return "..."
    
    if prev.opname == 'SET_UPDATE':
        # Look for frozen set
        if store_idx >= 2:
            prev2 = instructions[store_idx - 2]
            if prev2.opname == 'LOAD_CONST' and isinstance(prev2.argval, frozenset):
                return repr(set(prev2.argval))
        return "{...}"
    
    return None

def find_annotation_type(instructions, store_idx, name):
    """Find type annotation for an attribute."""
    # Look ahead for annotation store
    for j in range(store_idx + 1, min(store_idx + 10, len(instructions))):
        instr = instructions[j]
        if instr.opname == 'STORE_SUBSCR':
            # Check if storing into __annotations__
            if j >= 2:
                if instructions[j-1].opname == 'LOAD_CONST' and instructions[j-1].argval == name:
                    if instructions[j-2].opname in ('LOAD_NAME', 'LOAD_FAST'):
                        return None  # Complex type
                    # The type is somewhere before
                    for k in range(store_idx + 1, j):
                        if instructions[k].opname in ('LOAD_NAME', 'LOAD_GLOBAL') and instructions[k].argval in ('str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'Path'):
                            return instructions[k].argval
                        if instructions[k].opname == 'BINARY_SUBSCR':
                            # Generic type like set[str]
                            return None
            break
    return None

def check_decorator(instructions, func_load_idx):
    """Check if there's a decorator before a function definition."""
    # Look back for decorator patterns
    for j in range(func_load_idx - 1, max(0, func_load_idx - 10), -1):
        instr = instructions[j]
        if instr.opname == 'PUSH_NULL':
            continue
        if instr.opname in ('LOAD_NAME', 'LOAD_GLOBAL', 'LOAD_ATTR'):
            if instr.argval in ('staticmethod', 'classmethod', 'property', 'abstractmethod'):
                return instr.argval
        break
    return None

def get_function_sig(code):
    """Get function signature from code object."""
    name = code.co_name
    args = list(code.co_varnames[:code.co_argcount])
    
    # Handle keyword-only args
    kwonly = list(code.co_varnames[code.co_argcount:code.co_argcount + code.co_kwonlyargcount])
    
    # Build signature
    parts = []
    for a in args:
        parts.append(a)
    
    if kwonly:
        parts.append('*')
        parts.extend(kwonly)
    
    return f"{name}({', '.join(parts)})"

def reconstruct_function_body(code, indent=0):
    """Reconstruct function body from code object."""
    lines = []
    pfx = "    " * indent
    instructions = list(dis.get_instructions(code))
    
    # Extract docstring
    for i, instr in enumerate(instructions):
        if instr.opname == 'RESUME':
            continue
        if instr.opname == 'LOAD_CONST' and isinstance(instr.argval, str):
            if i + 1 < len(instructions) and instructions[i+1].opname in ('POP_TOP', 'RETURN_CONST'):
                lines.append(f'{pfx}"""{instr.argval}"""')
            elif i + 1 < len(instructions) and instructions[i+1].opname == 'STORE_FAST':
                pass  # Not a docstring
            else:
                lines.append(f'{pfx}"""{instr.argval}"""')
        break
    
    # Extract the full disassembly for reference
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        dis.dis(code)
    finally:
        sys.stdout = old
    
    lines.append(f"{pfx}# --- Bytecode disassembly ---")
    for line in buf.getvalue().strip().split('\n'):
        lines.append(f"{pfx}# {line}")
    
    # Extract nested functions/classes
    for c in code.co_consts:
        if isinstance(c, types.CodeType) and not c.co_name.startswith('<'):
            sig = get_function_sig(c)
            lines.append(f"\n{pfx}def {sig}:")
            lines.extend(reconstruct_function_body(c, indent + 1))
    
    return lines

def process_file(path):
    """Process a single .pyc file."""
    rel = os.path.relpath(path, BASE)
    basename = os.path.basename(path)
    pyname = basename.replace('.cpython-312.pyc', '.py')
    
    # Determine the original path
    parts = rel.replace('\\', '/').split('/')
    # Remove __pycache__ from path
    original_parts = [p for p in parts if p != '__pycache__']
    original_parts[-1] = pyname
    original_path = '/'.join(original_parts)
    
    print(f"\n{'='*80}")
    print(f"FILE: {original_path}")
    print(f"{'='*80}")
    
    try:
        code = load_pyc(path)
        print(f"# Original source file: {code.co_filename}")
        print(f"# Source size: from pyc metadata")
        print()
        
        # Reconstruct
        source_lines = reconstruct_from_code(code)
        for line in source_lines:
            print(line)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

def main():
    find_pyc_files()
    
    print("RECONSTRUCTED SOURCE CODE FROM .pyc FILES")
    print(f"Base directory: {BASE}")
    print(f"Found {len(PYC_FILES)} .pyc files (excluding venv)")
    
    for path in PYC_FILES:
        process_file(path)

if __name__ == '__main__':
    main()
