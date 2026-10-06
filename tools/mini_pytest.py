"""
Minimal offline pytest-compatible test runner.
=================================================
This sandbox has no network access, so `pip install pytest` is not
possible. This script provides a small compatible subset of pytest
(raises/approx/skip/fixture/monkeypatch, class- and function-based
test discovery) so the existing test suite and the new Phase 6.1
tests can actually be executed and reported on honestly, rather than
being left unverified.

This is NOT a reimplementation of pytest's internals in general —
only the subset of its API actually used across tests/ in this
repository (checked by grepping the suite before writing this).

Usage:
    python3 tools/mini_pytest.py [path_or_dir ...]

Fixes applied (preserving all original behaviour):
  1. unittest.TestCase setUp()/tearDown() are now called (was setup_method only).
  2. @pytest.mark.parametrize now expands test cases properly.
  3. Test file's own directory is added to sys.path so local helpers
     (e.g. reasoning82/helpers.py) can be imported with a plain name.
  4. Relative-import packages (tests/reasoning/) are registered as a
     package so `from .conftest import ...` resolves correctly.
  5. conftest.py files in the test file's directory are loaded and
     their @pytest.fixture functions are available for injection.
"""
from __future__ import annotations

import importlib.util
import inspect
import math
import os
import sys
import traceback
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Fake `pytest` module — installed into sys.modules before test modules
# import it, so `import pytest` in test files resolves to this shim.
# ---------------------------------------------------------------------------

class Skipped(Exception):
    pass


class _Raises:
    def __init__(self, expected, match=None):
        self.expected = expected
        self.match = match
        self.value = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            raise AssertionError(f"DID NOT RAISE {self.expected!r}")
        if not issubclass(exc_type, self.expected if isinstance(self.expected, tuple) else (self.expected,)):
            return False
        if self.match is not None:
            import re
            if not re.search(self.match, str(exc_val)):
                raise AssertionError(f"regex pattern {self.match!r} did not match {exc_val!r}")
        self.value = exc_val
        return True


class _Approx:
    def __init__(self, value, rel=1e-6, abs=1e-12):
        self.value = value
        self.rel = rel
        self.abs = abs

    def __eq__(self, other):
        try:
            if self.value is None or other is None:
                return self.value == other
            return math.isclose(other, self.value, rel_tol=self.rel, abs_tol=self.abs)
        except TypeError:
            return NotImplemented

    def __repr__(self):
        return f"approx({self.value!r})"


class _Mark:
    def parametrize(self, argnames, argvalues):
        def deco(fn):
            fn.__mini_pytest_params__ = (argnames, argvalues)
            return fn
        return deco

    def skip(self, *a, **kw):
        def deco(fn):
            fn.__mini_pytest_skip__ = True
            return fn
        if a and callable(a[0]) and not kw:
            return deco(a[0])
        return deco


def _skip(reason=""):
    raise Skipped(reason)


def _fixture(*fargs, **fkwargs):
    def deco(fn):
        fn.__is_fixture__ = True
        return fn
    if fargs and callable(fargs[0]) and not fkwargs:
        return deco(fargs[0])
    return deco


_pytest_shim = types.ModuleType("pytest")
_pytest_shim.raises = _Raises
_pytest_shim.approx = _Approx
_pytest_shim.skip = _skip
_pytest_shim.fixture = _fixture
_pytest_shim.mark = _Mark()
_pytest_shim.Skipped = Skipped


class _MonkeyPatch:
    """Small subset of pytest's built-in monkeypatch fixture."""

    def __init__(self):
        self._undo = []

    def setattr(self, target, name, value=None, raising=True):
        if value is None and isinstance(name, str) and "." in name:
            pass
        if isinstance(target, str):
            modname, attr = target.rsplit(".", 1)
            obj = importlib.import_module(modname)
        else:
            obj = target
            attr = name
        had = hasattr(obj, attr)
        old = getattr(obj, attr, None)
        self._undo.append((obj, attr, had, old))
        setattr(obj, attr, value)

    def setenv(self, name, value):
        had = name in os.environ
        old = os.environ.get(name)
        self._undo.append((os.environ, name, had, old))
        os.environ[name] = value

    def delenv(self, name, raising=False):
        had = name in os.environ
        old = os.environ.get(name)
        if had:
            self._undo.append((os.environ, name, had, old))
            del os.environ[name]

    def undo(self):
        for obj, attr, had, old in reversed(self._undo):
            if isinstance(obj, dict) or obj is os.environ:
                if had:
                    obj[attr] = old
                elif attr in obj:
                    del obj[attr]
            else:
                if had:
                    setattr(obj, attr, old)
                else:
                    try:
                        delattr(obj, attr)
                    except AttributeError:
                        pass


BUILTIN_FIXTURES = {"monkeypatch": lambda: _MonkeyPatch()}

# ---------------------------------------------------------------------------
# conftest.py cache: path -> loaded module
# ---------------------------------------------------------------------------
_conftest_cache: dict = {}


def _load_conftest(test_dir: Path):
    """
    Load conftest.py from test_dir (if present) and return the module.
    Results are cached so we don't reload for every test file.
    """
    conftest_path = test_dir / "conftest.py"
    if not conftest_path.exists():
        return None
    key = str(conftest_path)
    if key in _conftest_cache:
        return _conftest_cache[key]

    sys.modules["pytest"] = _pytest_shim

    # Add the test directory to sys.path for local imports
    test_dir_str = str(test_dir)
    if test_dir_str not in sys.path:
        sys.path.insert(0, test_dir_str)

    modname = "mini_pytest_conftest__" + key.replace("/", "_").replace(".", "_")

    # Determine package info for relative imports
    pkg_parts = []
    cur = test_dir
    while (cur / "__init__.py").exists():
        pkg_parts.insert(0, cur.name)
        cur = cur.parent

    if pkg_parts:
        pkg_root_str = str(cur)
        if pkg_root_str not in sys.path:
            sys.path.insert(0, pkg_root_str)
        _register_package(cur, pkg_parts, pkg_root_str)
        dotname = ".".join(pkg_parts) + ".conftest"
    else:
        dotname = None

    try:
        if dotname and dotname not in sys.modules:
            spec = importlib.util.spec_from_file_location(
                dotname, conftest_path,
                submodule_search_locations=[]
            )
            mod = importlib.util.module_from_spec(spec)
            mod.__package__ = ".".join(dotname.split(".")[:-1])
            sys.modules[dotname] = mod
            sys.modules[modname] = mod
            spec.loader.exec_module(mod)
        else:
            spec = importlib.util.spec_from_file_location(modname, conftest_path)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[modname] = mod
            spec.loader.exec_module(mod)
    except Exception:
        _conftest_cache[key] = None
        return None

    _conftest_cache[key] = mod
    return mod


def _resolve_fixture(name, module, cache, conftest_mod=None):
    """
    Resolve a pytest fixture by name.
    Search order: cache → builtins → test module → conftest module.
    """
    if name in cache:
        return cache[name]
    if name in BUILTIN_FIXTURES:
        val = BUILTIN_FIXTURES[name]()
        cache[name] = val
        return val

    # Look in test module first, then conftest
    fn = getattr(module, name, None)
    if fn is None or not getattr(fn, "__is_fixture__", False):
        if conftest_mod is not None:
            fn = getattr(conftest_mod, name, None)
            if fn is None or not getattr(fn, "__is_fixture__", False):
                raise KeyError(name)
        else:
            raise KeyError(name)

    sig = inspect.signature(fn)
    kwargs = {p: _resolve_fixture(p, module, cache, conftest_mod) for p in sig.parameters}
    result = fn(**kwargs)
    if inspect.isgenerator(result):
        cache.setdefault("__gens__", []).append(result)
        val = next(result)
    else:
        val = result
    cache[name] = val
    return val


def _call_with_fixtures(fn, module, extra_kwargs=None, conftest_mod=None):
    """Call fn, resolving pytest fixtures and any extra parametrize kwargs."""
    sig = inspect.signature(fn)
    cache = {}
    kwargs = {}
    for pname in sig.parameters:
        if pname == "self":
            continue
        if extra_kwargs and pname in extra_kwargs:
            kwargs[pname] = extra_kwargs[pname]
        else:
            kwargs[pname] = _resolve_fixture(pname, module, cache, conftest_mod)
    try:
        fn(**kwargs)
    finally:
        for gen in cache.get("__gens__", []):
            try:
                next(gen)
            except StopIteration:
                pass


def _expand_parametrize(fn):
    """
    Return a list of (label_suffix, kwargs_dict) pairs for parametrized tests.
    If the test has no parametrize mark, returns [(None, {})].
    """
    params = getattr(fn, "__mini_pytest_params__", None)
    if params is None:
        return [(None, {})]

    argnames_raw, argvalues = params
    if isinstance(argnames_raw, str):
        argnames = [n.strip() for n in argnames_raw.split(",")]
    else:
        argnames = list(argnames_raw)

    cases = []
    for val in argvalues:
        if len(argnames) == 1:
            kw = {argnames[0]: val}
            label = f"[{val!r}]"
        else:
            kw = dict(zip(argnames, val))
            label = f"[{'-'.join(repr(v) for v in val)}]"
        cases.append((label, kw))
    return cases


def _is_unittest_case(cls):
    """Return True if cls inherits from unittest.TestCase."""
    try:
        import unittest
        return issubclass(cls, unittest.TestCase)
    except Exception:
        return False


def _register_package(root: Path, pkg_parts: list, root_str: str):
    """
    Ensure every level of the package hierarchy is in sys.modules
    so that relative imports resolve correctly.
    """
    for i in range(len(pkg_parts)):
        dotname = ".".join(pkg_parts[:i + 1])
        if dotname in sys.modules:
            continue
        pkg_path = root / Path(*pkg_parts[:i + 1])
        init = pkg_path / "__init__.py"
        if not init.exists():
            break
        spec = importlib.util.spec_from_file_location(
            dotname, init,
            submodule_search_locations=[str(pkg_path)]
        )
        pkg_mod = importlib.util.module_from_spec(spec)
        pkg_mod.__package__ = dotname
        pkg_mod.__path__ = [str(pkg_path)]
        sys.modules[dotname] = pkg_mod
        try:
            spec.loader.exec_module(pkg_mod)
        except Exception:
            pass


def _load_module(path: Path):
    """
    Load a test file as a module with full package/relative-import support.
    """
    sys.modules["pytest"] = _pytest_shim

    test_dir = path.parent
    test_dir_str = str(test_dir)

    # FIX 1 — local helper discovery (e.g. reasoning82/helpers.py)
    if test_dir_str not in sys.path:
        sys.path.insert(0, test_dir_str)

    # FIX 2 — relative-import support
    pkg_parts = []
    cur = test_dir
    while (cur / "__init__.py").exists():
        pkg_parts.insert(0, cur.name)
        cur = cur.parent

    if pkg_parts:
        pkg_root_str = str(cur)
        if pkg_root_str not in sys.path:
            sys.path.insert(0, pkg_root_str)
        _register_package(cur, pkg_parts, pkg_root_str)
        pkg_dotname = ".".join(pkg_parts)
        mod_dotname = pkg_dotname + "." + path.stem
    else:
        mod_dotname = None

    modname = "mini_pytest_target__" + str(path).replace("/", "_").replace(".", "_")

    if mod_dotname and mod_dotname not in sys.modules:
        spec = importlib.util.spec_from_file_location(
            mod_dotname, path,
            submodule_search_locations=[]
        )
        mod = importlib.util.module_from_spec(spec)
        mod.__package__ = ".".join(mod_dotname.split(".")[:-1])
        sys.modules[mod_dotname] = mod
        sys.modules[modname] = mod
        spec.loader.exec_module(mod)
    else:
        spec = importlib.util.spec_from_file_location(modname, path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[modname] = mod
        spec.loader.exec_module(mod)

    return mod


def run_file(path: Path, results: dict):
    try:
        mod = _load_module(path)
    except Exception:
        results["errors"].append((str(path), "COLLECTION_ERROR", traceback.format_exc()))
        return

    # FIX 5 — load conftest.py from the same directory for fixture injection
    conftest_mod = _load_conftest(path.parent)

    for name, obj in list(vars(mod).items()):
        if name.startswith("test_") and inspect.isfunction(obj):
            _run_function(f"{path}::{name}", obj, mod, results, conftest_mod)
        elif name.startswith("Test") and inspect.isclass(obj):
            _run_class(path, name, obj, mod, results, conftest_mod)


def _run_function(label_base, fn, mod, results, conftest_mod=None):
    """Run a module-level test function, expanding parametrize if present."""
    if getattr(fn, "__mini_pytest_skip__", False):
        results["skipped"].append(label_base)
        return
    for suffix, extra_kw in _expand_parametrize(fn):
        label = label_base + (suffix or "")
        _run_one(label, fn, mod, results, extra_kw, conftest_mod)


def _run_class(path, cls_name, cls, mod, results, conftest_mod=None):
    """Run all test_* methods in a test class, with setUp/tearDown support."""
    try:
        instance = cls()
    except Exception:
        results["errors"].append((f"{path}::{cls_name}", "CLASS_INIT_ERROR", traceback.format_exc()))
        return

    is_ut = _is_unittest_case(cls)

    if is_ut and hasattr(cls, "setUpClass"):
        try:
            cls.setUpClass()
        except Exception:
            results["errors"].append((f"{path}::{cls_name}", "SETUP_CLASS_ERROR", traceback.format_exc()))
            return

    for mname, mobj in inspect.getmembers(instance, predicate=inspect.ismethod):
        if not mname.startswith("test_"):
            continue

        if getattr(mobj, "__mini_pytest_skip__", False):
            results["skipped"].append(f"{path}::{cls_name}::{mname}")
            continue

        for suffix, extra_kw in _expand_parametrize(mobj):
            label = f"{path}::{cls_name}::{mname}" + (suffix or "")

            # per-test setup — support both styles
            try:
                if is_ut and hasattr(instance, "setUp"):
                    instance.setUp()
                elif hasattr(instance, "setup_method"):
                    instance.setup_method()
            except Exception:
                results["failed"].append((label, traceback.format_exc()))
                continue

            _run_one(label, mobj, mod, results, extra_kw, conftest_mod)

            # per-test teardown
            try:
                if is_ut and hasattr(instance, "tearDown"):
                    instance.tearDown()
                elif hasattr(instance, "teardown_method"):
                    instance.teardown_method()
            except Exception:
                pass

    if is_ut and hasattr(cls, "tearDownClass"):
        try:
            cls.tearDownClass()
        except Exception:
            pass


def _run_one(label, fn, mod, results, extra_kwargs=None, conftest_mod=None):
    if getattr(fn, "__mini_pytest_skip__", False):
        results["skipped"].append(label)
        return
    try:
        _call_with_fixtures(fn, mod, extra_kwargs, conftest_mod)
        results["passed"].append(label)
    except Skipped:
        results["skipped"].append(label)
    except Exception:
        results["failed"].append((label, traceback.format_exc()))


def discover(paths):
    files = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            files.extend(sorted(p.rglob("test_*.py")))
        elif p.is_file():
            files.append(p)
    return files


def main():
    args = sys.argv[1:] or ["tests"]
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT))
    files = discover(args)
    results = {"passed": [], "failed": [], "skipped": [], "errors": []}
    for f in files:
        run_file(f, results)

    total = len(results["passed"]) + len(results["failed"])
    print(f"\n{'=' * 70}")
    print(f"collected from {len(files)} file(s)")
    print(f"PASSED: {len(results['passed'])}  FAILED: {len(results['failed'])}  "
          f"SKIPPED: {len(results['skipped'])}  COLLECTION ERRORS: {len(results['errors'])}")
    if results["failed"]:
        print("\n--- FAILURES ---")
        for label, tb in results["failed"]:
            print(f"\nFAIL: {label}")
            print(tb.strip().splitlines()[-1])
    if results["errors"]:
        print("\n--- COLLECTION ERRORS ---")
        for label, kind, tb in results["errors"]:
            print(f"\n{kind}: {label}")
            print(tb.strip().splitlines()[-1])
    print(f"{'=' * 70}\n")
    return 0 if (not results["failed"] and not results["errors"]) else 1


if __name__ == "__main__":
    sys.exit(main())
