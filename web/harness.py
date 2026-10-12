import ast
import io
import json
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


def check(code):
    try:
        compile(code, FILE, 'exec')
    except SyntaxError as error:
        return json.dumps([{'line': error.lineno or 1, 'column': error.offset or 1, 'code': None, 'message': error.msg}])
    return '[]'


# LeetCode accepts a tuple where it expects a list.
def plain(value):
    return [plain(item) for item in value] if isinstance(value, (list, tuple)) else value


def same(value, expected, order):
    value, expected = plain(value), plain(expected)
    if order == 'any':
        return sorted(value) == sorted(expected)
    if order == 'any-nested':
        return sorted(sorted(item) for item in value) == sorted(sorted(item) for item in expected)
    return value == expected


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
                value = args[0] if check == 'arg0' else args[0][:result] if check == 'prefix' else result
    except SystemExit:
        pass
    except BaseException as exception:
        error = failure(exception)
    if stdio:
        output, printed = printed.getvalue(), ''
        ok = None if expected is None else error is None and output.split() == expected.split()
    else:
        output, printed = '' if error else repr(value), printed.getvalue()
        try:
            ok = None if expected is None else error is None and same(value, ast.literal_eval(expected), spec.get('order', 'exact'))
        except Exception as exception:
            ok, error = False, failure(exception)
    return json.dumps({'ok': ok, 'output': output, 'stdout': printed, 'error': error})
