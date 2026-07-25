# V8 Maglev Optimizer Security Audit Findings

## Finding 1: RecordBoundsCheckRefinement Applies Wrong Semantics for Non-UnsignedLessThan Conditions

**Severity**: High (latent, currently unreachable from JS)
**Location**: `src/maglev/maglev-graph-optimizer.cc:462-485`

### Bug Description

`RecordBoundsCheckRefinement()` (line 462) is called unconditionally at line 883 for ALL `CheckInt32Condition` types via `VisitCheckInt32Condition()` (line 860), but implements semantics correct ONLY for `kUnsignedLessThan`:

```cpp
void RecordBoundsCheckRefinement(ValueNode* lhs, ValueNode* rhs) {
    std::optional<int> max;
    if (auto cst = TryGetInt32Constant(rhs)) {
      max = cst.value();
    } else if (auto range = GetRange(rhs)) {
      if (range->min() < 0) return;  // bail for negative ranges
      max = range->max();
    } else {
      return;
    }
    if (*max == 0) return;
    Range refined(0, *max - 1);         // <-- Always [0, max-1]
    SetRangeRefinement(lhs, refined);
}
```

**What's wrong for each condition type:**

| Condition | Correct Refinement | Actual Refinement | Bug |
|-----------|-------------------|-------------------|-----|
| `kUnsignedLessThan` (x < y) | `[0, y.max - 1]` | `[0, y.max - 1]` | Correct |
| `kEqual` (x == y) | `[y.min, y.max]` | `[0, y.max - 1]` | Off-by-one at max, wrong min |
| `kNotEqual` (x != y) | No refinement | `[0, y.max - 1]` | Completely wrong |
| `kUnsignedLessThanEqual` (x <= y) | `[0, y.max]` | `[0, y.max - 1]` | Off-by-one at max |
| `kLessThan` (x < y) | `[INT32_MIN, y.max - 1]` | `[0, y.max - 1]` | Wrong min |
| `kGreaterThanEqual` (x >= y) | `[y.min, INT32_MAX]` | `[0, y.max - 1]` | Completely wrong |

### Exploitation Path

The most promising trigger is integer division by constant (Montgomery optimization):

1. `x / N` (where N is constant) emits `CheckInt32Condition(x, mult, kEqual, kNotInt32)`
2. `RecordBoundsCheckRefinement(x, mult)` incorrectly refines x to `[0, mult.max - 1]`
3. Subsequent branch `if (x < mult.max)` or bounds check `x < arr.length` sees the refined range
4. If the branch/check is folded, `x = mult.max` (which passes the kEqual check) takes the wrong path

**Example with division by 10, x in [0, 127]:**
- `result = floor(x/10)` range: `[0, 12]`
- `mult = result * 10` range: `[0, 120]`
- Refinement: x -> `[0, 119]` (should be `[0, 120]`)
- `if (x < 120)` folded as always-true
- x = 120 takes wrong branch or bypasses bounds check

### Why It's Currently Unreachable

`Int32MultiplyOverflownBits` (the Montgomery magic multiply node) has NO range handler in `maglev-range-analysis.h`. It falls through to the default handler which assigns `Range::Int32()` = `[INT32_MIN, INT32_MAX]`. This cascades:
- `mult` ends up with `Range::All()` (from `Range::Mul` overflowing)
- `RecordBoundsCheckRefinement` bails at `range->min() < 0`

### When It Becomes Exploitable

The bug transitions from latent to exploitable if:
1. V8 adds range tracking for `Int32MultiplyOverflownBits`
2. V8 adds another `CheckInt32Condition(kEqual)` call site with precise RHS ranges
3. A different optimization pass produces tighter ranges for the multiplication chain

### Call Sites Affected

```
maglev-reducer-inl.h:3232  - kEqual (Montgomery division remainder check)
maglev-graph-builder.cc:10198 - kEqual (Array.sort length change check)
maglev-graph-builder.cc:8557  - kNotEqual (generator re-entry check)
maglev-graph-builder.cc:2009  - kUnsignedLessThanEqual (string concat length)
maglev-graph-builder.cc:8497  - kUnsignedLessThanEqual (Array.includes/indexOf)
maglev-reducer-inl.h:3181  - kGreaterThanEqual (x * 0 minus zero check)
```

---

## Finding 2: kNotEqual with Negative Constant Creates Impossible Range

**Severity**: Medium (code correctness issue, limited security impact)
**Location**: `src/maglev/maglev-graph-optimizer.cc:462-479`

### Description

When `RecordBoundsCheckRefinement` receives a negative constant RHS (e.g., `kGeneratorExecuting = -2`):

```
max = cst.value()  // -2
*max == 0? No
Range refined(0, *max - 1) = Range(0, -3)  // impossible range!
```

This creates a range with `min > max` (0 > -3), which `Range::is_empty()` returns true for.

For a subsequent `VisitCheckedInt32ToUint32` that checks `range->min() >= 0`:
- `Range::Empty()` via `Intersect`: min = `INT64_MAX` >= 0 -> **TRUE** (incorrect)
- `Range(0, -3)` directly: min = 0 >= 0 -> **TRUE** (incorrect)

Both forms cause `CheckedInt32ToUint32` to be replaced with `UnsafeInt32ToUint32`, which is a no-check bitcast. If the value is actually negative (valid for kNotEqual since x != -2 includes all negatives except -2), the bitcast produces a large unsigned value.

The generator continuation case (`kGeneratorExecuting = -2`) is the concrete trigger, but the continuation value is not typically used in uint32 contexts afterward.

---

## Finding 3: Missing Range Handler for Int32MultiplyOverflownBits

**Severity**: Low (precision issue, enables Finding 1 to remain latent)
**Location**: `src/maglev/maglev-range-analysis.h` (missing handler)
**Related**: `src/maglev/maglev-ir.h:3499-3509` (node definition)

### Description

`Int32MultiplyOverflownBits` computes the upper 32 bits of a 32x32->64 multiply. It has no range analysis handler, falling through to the default template which assigns `Range::Int32()`. This makes ALL Montgomery division quotient ranges imprecise.

This is not a vulnerability per se, but it's the primary reason Finding 1 remains latent. If range tracking were added for this node, Finding 1 would become immediately exploitable.

---

## Finding 4: Missing BranchIfUint32Compare Handler in Range Analysis

**Severity**: Low (precision issue, no direct security impact)
**Location**: `src/maglev/maglev-range-analysis.h` (missing handler)

### Description

`ProcessControlNodeFor(BranchIfInt32Compare*)` correctly refines ranges in successor blocks for signed comparisons. However, there is no corresponding handler for `BranchIfUint32Compare`. This means ranges are not refined after unsigned branches, leaving optimization opportunities on the table and potentially allowing less precise bounds check elimination.

---

## Finding 5: Inconsistent Smi Boundary Check

**Severity**: Low (functional, not security)
**Location**: `src/maglev/maglev-ir.cc:1793` vs Turboshaft counterpart

### Description

Maglev's `CheckUint32IsSmi` uses `kUnsignedGreaterThan` against `Smi::kMaxValue` (allows `value == Smi::kMaxValue`). This is correct since `Smi::kMaxValue` IS a valid Smi.

Some Turboshaft paths reportedly use strict `Uint32LessThan(value, Smi::kMaxValue)` which would reject `Smi::kMaxValue`. This is overly strict (causes unnecessary deoptimization) but not a security issue.

---

## Recommended Fixes

### For Finding 1 (Critical)

Add condition-type checking to `RecordBoundsCheckRefinement`:

```cpp
void RecordBoundsCheckRefinement(ValueNode* lhs, ValueNode* rhs,
                                  AssertCondition condition) {
    // Only apply bounds-check-style refinement for unsigned less-than
    if (condition != AssertCondition::kUnsignedLessThan) return;
    // ... existing logic ...
}
```

Or properly implement per-condition refinement:

```cpp
switch (condition) {
    case kUnsignedLessThan:     refined = Range(0, *max - 1); break;
    case kUnsignedLessThanEqual: refined = Range(0, *max); break;
    case kEqual:                 refined = Range(*min, *max); break;
    default: return;  // Don't refine for other conditions
}
```

### For Finding 3

Add a range handler for `Int32MultiplyOverflownBits` in `maglev-range-analysis.h`:

```cpp
void Process(Int32MultiplyOverflownBits* node, ...) {
    auto lhs_range = GetRange(node->left_input());
    auto rhs_range = GetRange(node->right_input());
    // Upper 32 bits of lhs * rhs (signed 64-bit product)
    // Compute precise range based on 64-bit product range shifted right by 32
    SetRange(node, computed_range);
}
```
