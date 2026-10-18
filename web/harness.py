import ast
import builtins
import io
import json
import keyword
import sys
import traceback
from contextlib import redirect_stdout

FILE = '<решение>'
PRELUDE = 'from typing import *\nimport collections, heapq, math, itertools, functools, bisect, string\n'


def namespace():
    names = {'__name__': '__main__'}
    exec(PRELUDE, names)
    return names


def names():
    return json.dumps(sorted(name for name in namespace() if not name.startswith('_')))


# The editor completes these names without jedi.
def words():
    return json.dumps(sorted(name for name in {*keyword.kwlist, *keyword.softkwlist, *dir(builtins), *namespace()} if not name.startswith('_')))


# The worker loads the jedi package before the first call. The keywords are left out, because jedi gives only keywords after a number with a dot, such as `0.`. https://jedi.readthedocs.io/en/latest/docs/api.html#jedi.Script.complete
def complete(code, line, column):
    limit = sys.getrecursionlimit()
    import jedi
    # jedi.api sets the recursion limit to 3000 at import. The tests run with the limit that was before.
    sys.setrecursionlimit(limit)
    return json.dumps([item.name for item in jedi.Script(PRELUDE + code).complete(line + PRELUDE.count('\n'), column) if not item.name.startswith('_') and item.type != 'keyword'])


def check(code):
    try:
        compile(code, FILE, 'exec')
    except SyntaxError as error:
        return json.dumps([{'line': error.lineno or 1, 'column': error.offset or 1, 'code': None, 'message': error.msg}])
    return '[]'


def failure(error):
    frames = [frame.lineno for frame in traceback.extract_tb(error.__traceback__) if frame.filename == FILE]
    line = error.lineno if isinstance(error, SyntaxError) and error.filename == FILE else frames[-1] if frames else None
    return {'message': traceback.format_exception_only(error)[-1].strip(), 'line': line}


def run(code, spec, test):
    spec, test = json.loads(spec), json.loads(test)
    stdio, expected, printed, value, error = spec['mode'] == 'stdio', test['expected'], io.StringIO(), None, None
    # Codeforces solutions often read sys.stdin.buffer.
    sys.stdin = io.TextIOWrapper(io.BytesIO((test['input'] if stdio else '').encode()), encoding='utf-8')
    try:
        with redirect_stdout(printed):
            names = namespace()
            exec(compile(code, FILE, 'exec'), names)
            if not stdio:
                args = ast.literal_eval(test['input'])
                result = getattr(names['Solution'](), spec['method'])(*args)
                check = spec.get('check', 'return')
                # A slice with None or with a length outside the list can still equal the expected prefix.
                if check == 'prefix' and not (type(result) is int and 0 <= result <= len(args[0])):
                    raise ValueError(f'метод должен вернуть длину от 0 до {len(args[0])}, а вернул {result!r}')
                value = args[0] if check == 'arg0' else args[0][:result] if check == 'prefix' else result
    except SystemExit:
        pass
    except BaseException as exception:
        error = failure(exception)
    if stdio:
        output, printed = printed.getvalue(), ''
    else:
        output, printed = '' if error else repr(value), printed.getvalue()
        try:
            if expected is not None and error is None:
                ast.literal_eval(expected)
        except Exception as exception:
            error = failure(exception)
    return json.dumps({'output': output, 'stdout': printed, 'error': error})
