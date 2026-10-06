"""
IndiDrive AI — Comprehensive Test Runner
=========================================
Runs the full test suite without requiring pytest to be installed.

Supports:
  - pytest.raises(ExcType) as context manager
  - pytest.mark.parametrize (skips param expansion; runs once)
  - pytest.skip()
  - pytest.SkipTest
  - setup_method / teardown_method per test
  - setUp / tearDown (unittest style)
  - pkgutil-based test discovery per package
  - setup_module / teardown_module
"""
from __future__ import annotations

import contextlib
import importlib
import os
import pkgutil
import sys
import traceback
import types
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Install pytest stub FIRST before any test module is imported
# ---------------------------------------------------------------------------

class _Raises:
    """Context manager implementing pytest.raises()."""
    def __init__(self, exc_types, match=None, **kw):
        if isinstance(exc_types, tuple):
            self.exc_types = exc_types
        else:
            self.exc_types = (exc_types,)
        self.match = match
        self.value = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            raise AssertionError(
                f"Expected one of {self.exc_types} but no exception was raised"
            )
        if issubclass(exc_type, self.exc_types):
            self.value = exc_val
            return True  # suppress exception
        return False  # re-raise unexpected exceptions


class SkipTest(Exception):
    pass


def _skip(msg=""):
    raise SkipTest(msg)


def _parametrize(argnames, argvalues, **kw):
    """
    Parametrize decorator — expands test into multiple parameterized versions.
    Attaches _pytest_params to the function so the runner can iterate.
    """
    def decorator(fn):
        # Store params; runner will expand them
        existing = getattr(fn, "_pytest_params", [])
        fn._pytest_params = existing + [(argnames, argvalues)]
        return fn
    return decorator


def _skip_decorator(*a, **kw):
    return lambda fn: fn


def _fixture(*a, **kw):
    """No-op fixture decorator — marks function as fixture provider."""
    def decorator(fn):
        fn._is_fixture = True
        return fn
    if len(a) == 1 and callable(a[0]):
        # called as @pytest.fixture without arguments
        a[0]._is_fixture = True
        return a[0]
    return decorator


# Build the stub
_pytest_stub = types.ModuleType("pytest")
_pytest_stub.raises = _Raises
_pytest_stub.skip = _skip
_pytest_stub.SkipTest = SkipTest
_pytest_stub.fixture = _fixture
class _Approx:
    """Approximate equality comparison (pytest.approx replacement)."""
    def __init__(self, expected, abs=None, rel=None, nan_ok=False):
        self.expected = expected
        self.abs_tol = abs if abs is not None else 1e-12
        self.rel_tol = rel if rel is not None else 1e-6
        self.nan_ok = nan_ok

    def __eq__(self, actual):
        import math
        try:
            # Handle sequences
            if hasattr(self.expected, '__iter__') and not isinstance(self.expected, (str, bytes)):
                pairs = list(zip(actual, self.expected))
                if len(pairs) != max(len(list(actual)), len(list(self.expected))):
                    return False
                return all(_Approx(e, abs=self.abs_tol, rel=self.rel_tol).__eq__(a) for a, e in pairs)
            if self.expected is None and actual is None:
                return True
            if self.expected is None or actual is None:
                return False
            e, a = float(self.expected), float(actual)
            if math.isnan(e) and math.isnan(a):
                return self.nan_ok
            tol = max(self.abs_tol, self.rel_tol * abs(e))
            return abs(a - e) <= tol
        except (TypeError, ValueError):
            return self.expected == actual

    def __repr__(self):
        return f"approx({self.expected!r})"

_pytest_stub.approx = _Approx
_mark = types.SimpleNamespace(
    parametrize=_parametrize,
    skip=_skip_decorator,
    filterwarnings=_skip_decorator,
    xfail=_skip_decorator,
    slow=_skip_decorator,
    usefixtures=_skip_decorator,
)
_pytest_stub.mark = _mark
sys.modules["pytest"] = _pytest_stub

# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

RESULTS: Dict[str, Tuple[int, int, int, List[str]]] = {}


def _run_test_method(cls_instance, method_name: str) -> Tuple[str, Optional[str]]:
    """Run one test method. Returns ('pass'|'skip'|'fail'|'error', detail)."""
    method = getattr(cls_instance, method_name)
    try:
        method()
        return "pass", None
    except SkipTest as e:
        return "skip", str(e)
    except AssertionError as e:
        return "fail", f"{e}"
    except Exception as e:
        return "error", f"{type(e).__name__}: {e}"


def _call_setup(setup_fn, method_fn):
    """Call setup_method(method) or setup_method() depending on signature."""
    import inspect
    try:
        sig = inspect.signature(setup_fn)
        params = [p for p in sig.parameters.values()
                  if p.default is inspect.Parameter.empty]
        # self is already bound; count remaining required params
        if len(params) >= 1:
            setup_fn(method_fn)
        else:
            setup_fn()
    except Exception as e:
        raise e


def run_module(mod_name: str, verbose: bool = False) -> Tuple[int, int, int, List[str]]:
    """Import and run all Test* classes and module-level test_* functions. Returns (p, f, s, errors)."""
    sys.modules.setdefault("pytest", _pytest_stub)

    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        return 0, 1, 0, [f"IMPORT_ERROR [{mod_name}]: {e}"]

    # Module-level setup
    setup_mod = getattr(mod, "setup_module", None)
    if setup_mod:
        try:
            setup_mod()
        except Exception as e:
            return 0, 1, 0, [f"SETUP_MODULE_ERROR [{mod_name}]: {e}"]

    p = f = s = 0
    errors: List[str] = []

    def _needs_fixture(fn) -> bool:
        """Return True if method requires fixture injection (skip these)."""
        import inspect
        try:
            sig = inspect.signature(fn)
            params = list(sig.parameters.values())
            remaining = [p for p in params if p.name != 'self'
                         and p.default is inspect.Parameter.empty
                         and p.kind not in (inspect.Parameter.VAR_POSITIONAL,
                                            inspect.Parameter.VAR_KEYWORD)]
            return len(remaining) > 0
        except Exception:
            return False

    def _resolve_fixtures(fn, mod, params_provided: set) -> Optional[dict]:
        """
        Try to resolve module-level fixture parameters for fn.
        Returns dict of {param_name: value} if all fixtures can be resolved,
        or None if any fixture is unresolvable (→ skip the test).
        """
        import inspect
        try:
            sig = inspect.signature(fn)
            fixture_args = {}
            for name, param in sig.parameters.items():
                if name == 'self':
                    continue
                if name in params_provided:
                    continue  # provided by parametrize
                if param.default is not inspect.Parameter.empty:
                    continue  # has default
                # Look for a fixture with this name in the module
                fixture_fn = getattr(mod, name, None)
                if fixture_fn is None or not getattr(fixture_fn, '_is_fixture', False):
                    return None  # unresolvable
                try:
                    fixture_args[name] = fixture_fn()
                except Exception:
                    return None
            return fixture_args
        except Exception:
            return None

    def _expand_parametrize(fn, params_list) -> List[Tuple[str, tuple]]:
        """
        Expand @pytest.mark.parametrize into (label, args) pairs.
        params_list: list of (argnames, argvalues) in reverse decoration order.
        Returns list of (test_id, args_tuple).
        """
        import itertools

        sets = []
        for argnames, argvalues in reversed(params_list):
            if isinstance(argnames, str):
                names = [n.strip() for n in argnames.split(",")]
            else:
                names = list(argnames)
            expanded = []
            for val in argvalues:
                if not isinstance(val, tuple) or len(names) == 1:
                    val = (val,)
                expanded.append(val)
            sets.append(expanded)

        combos = list(itertools.product(*sets))
        result = []
        for combo in combos:
            merged = sum(combo, ())
            label = "-".join(str(v)[:20] for v in merged)
            result.append((label, merged))
        return result

    # --- Run Test* classes ---
    for cls_name in sorted(dir(mod)):
        cls = getattr(mod, cls_name)
        if not (isinstance(cls, type) and cls_name.startswith("Test")):
            continue

        methods = sorted(
            m for m in dir(cls)
            if m.startswith("test") and callable(getattr(cls, m))
        )

        for method_name in methods:
            raw_method = getattr(cls, method_name)

            # Handle parametrized tests
            params_list = getattr(raw_method, "_pytest_params", None)
            if params_list:
                test_cases = _expand_parametrize(raw_method, params_list)
            elif _needs_fixture(raw_method):
                # Test requires fixture injection — skip (runner limitation)
                s += 1
                continue
            else:
                test_cases = [("", ())]

            for label, args in test_cases:
                inst = cls()
                setup_ok = True
                test_label = f"{method_name}[{label}]" if label else method_name

                # Call setup_method or setUp
                for setup_name in ("setup_method", "setUp"):
                    if setup_name in type(inst).__dict__:
                        setup = getattr(inst, setup_name)
                        try:
                            if setup_name == "setup_method":
                                _call_setup(setup, getattr(inst, method_name))
                            else:
                                setup()
                        except Exception as e:
                            f += 1
                            errors.append(
                                f"SETUP_ERROR {cls_name}.{test_label}: {type(e).__name__}: {e}"
                            )
                            setup_ok = False
                        break

                if not setup_ok:
                    continue

                method = getattr(inst, method_name)
                try:
                    method(*args)
                    p += 1
                    if verbose:
                        print(f"  PASS {cls_name}.{test_label}")
                except SkipTest:
                    s += 1
                except AssertionError as e:
                    f += 1
                    errors.append(f"FAIL {cls_name}.{test_label}: {e}")
                except Exception as e:
                    f += 1
                    errors.append(f"ERR  {cls_name}.{test_label}: {type(e).__name__}: {e}")

                # Call teardown
                for td_name in ("teardown_method", "tearDown"):
                    if td_name in type(inst).__dict__:
                        try:
                            getattr(inst, td_name)()
                        except Exception:
                            pass
                        break

    # --- Run module-level test_* functions ---
    for fn_name in sorted(dir(mod)):
        if not fn_name.startswith("test_"):
            continue
        fn = getattr(mod, fn_name)
        if not callable(fn) or isinstance(fn, type):
            continue

        params_list = getattr(fn, "_pytest_params", None)
        if params_list:
            test_cases = _expand_parametrize(fn, params_list)
            # Determine which param names come from parametrize
            import inspect
            param_names: set = set()
            for argnames, _ in params_list:
                if isinstance(argnames, str):
                    param_names.update(n.strip() for n in argnames.split(","))
                else:
                    param_names.update(argnames)
        else:
            test_cases = [("", ())]
            param_names = set()

        # Resolve any fixture arguments not provided by parametrize
        fixture_args = _resolve_fixtures(fn, mod, param_names)
        if fixture_args is None and _needs_fixture(fn):
            # Unresolvable fixtures — skip
            s += len(test_cases)
            continue

        for label, args in test_cases:
            test_label = f"{fn_name}[{label}]" if label else fn_name
            try:
                if fixture_args:
                    # Build a full kwargs dict mapping all param names to values
                    import inspect as _ins
                    sig = _ins.signature(fn)
                    all_names = [n for n in sig.parameters if n != 'self']
                    param_vals = dict(zip(sorted(param_names), args))
                    full_kwargs = {**fixture_args, **param_vals}
                    fn(**full_kwargs)
                else:
                    fn(*args)
                p += 1
                if verbose:
                    print(f"  PASS {test_label}")
            except SkipTest:
                s += 1
            except AssertionError as e:
                f += 1
                errors.append(f"FAIL {test_label}: {e}")
            except Exception as e:
                f += 1
                errors.append(f"ERR  {test_label}: {type(e).__name__}: {e}")

    # Module-level teardown
    td_mod = getattr(mod, "teardown_module", None)
    if td_mod:
        try:
            td_mod()
        except Exception:
            pass

    return p, f, s, errors


def run_package(pkg_name: str, verbose: bool = False) -> Tuple[int, int, int, List[str]]:
    """Run all test_* modules in a package."""
    sys.modules.setdefault("pytest", _pytest_stub)

    try:
        pkg = importlib.import_module(pkg_name)
    except Exception as e:
        return 0, 1, 0, [f"PKG_IMPORT_ERROR [{pkg_name}]: {e}"]

    pkg_path = getattr(pkg, "__path__", [])
    mods = sorted(
        f"{pkg_name}.{info.name}"
        for info in pkgutil.iter_modules(pkg_path)
        if info.name.startswith("test_")
    )

    p = f = s = 0
    errors: List[str] = []
    for mod_name in mods:
        mp, mf, ms, merrs = run_module(mod_name, verbose=verbose)
        p += mp; f += mf; s += ms
        errors.extend(merrs)

    return p, f, s, errors


def run_all(packages: List[str], verbose: bool = False) -> None:
    """Run all packages and print a summary."""
    grand_p = grand_f = grand_s = 0
    all_errors: List[str] = []

    for pkg in packages:
        p, f, s, errs = run_package(pkg, verbose=verbose)
        grand_p += p; grand_f += f; grand_s += s
        all_errors.extend(errs)
        status = "✅" if f == 0 else "❌"
        print(f"{status} {pkg}: {p} passed, {f} failed, {s} skipped")

    print()
    if all_errors:
        print("── FAILURES / ERRORS ──")
        for e in all_errors:
            print(f"  {e}")
        print()

    overall = "✅ ALL PASSED" if grand_f == 0 else f"❌ {grand_f} FAILED"
    print(f"{overall} — {grand_p} passed, {grand_f} failed, {grand_s} skipped")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Add project root to sys.path
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)

    verbose = "--verbose" in sys.argv or "-v" in sys.argv

    PHASE_12_PACKAGES = [
        "tests.experience126",
        "tests.experience125",
        "tests.experience124",
        "tests.experience123",
        "tests.experience122",
        "tests.experience121",
    ]

    INTEGRATION_PACKAGES = [
        "tests.integration105",
    ]

    ALL_PACKAGES = [
        "tests.experience126_integration",
        "tests.experience126",
        "tests.experience125",
        "tests.experience124",
        "tests.experience123",
        "tests.experience122",
        "tests.experience121",
        "tests.reasoning82",
        "tests.reasoning84",
        "tests.reasoning",
        "tests.integration105",
        "tests.control103",
        "tests.control104",
        "tests.failsafe",
        "tests.indian_road_context",
        "tests.lane_structure",
        "tests.memory",
        "tests.planning",
        "tests.planning92",
        "tests.planning93",
        "tests.planning94",
        "tests.planning95",
        "tests.planning96",
        "tests.prediction_4d",
        "tests.road_anomaly",
        "tests.road_understanding",
        "tests.road_understanding_state",
        "tests.safety",
        "tests.safety_supervisor",
        "tests.safety_validation",
        "tests.tracking102",
        "tests.vehicle",
        "tests.world_model",
    ]

    target = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "phase12"

    if target == "phase12":
        run_all(PHASE_12_PACKAGES, verbose=verbose)
    elif target == "integration":
        run_all(INTEGRATION_PACKAGES, verbose=verbose)
    elif target == "all":
        run_all(ALL_PACKAGES, verbose=verbose)
    else:
        # Run a specific package
        run_all([target], verbose=verbose)
