//! Narrowing which exports of a `require("…")`ed module are used. The main
//! analyzer walk recognizes each call's immediate consumption inline (a bare
//! `require(...)` statement discards its result → `Evaluation`; see
//! `graph::visitor`); a `const x = require(...)` namespace binding is scanned
//! here ([`resolve_namespace_bindings`]), deny-by-default to `ExportUsage::All`.

use rustc_hash::{FxHashMap, FxHashSet};
use swc_core::{
    common::{BytePos, Mark},
    ecma::{
        ast::{
            CallExpr, Callee, ComputedPropName, Decl, ExportDecl, Expr, Id, Ident, Lit, MemberExpr,
            MemberProp, Pat, Program, VarDeclarator,
        },
        visit::{Visit, VisitWith, noop_visit_type},
    },
};
use turbo_rcstr::RcStr;
use turbo_tasks::FxIndexSet;
use turbopack_core::resolve::ExportUsage;

use crate::{
    analyzer::cjs_ast::is_global,
    utils::{extract_name_from_member_prop, unparen},
};

/// If `expr` is a `require("<string literal>")` call, returns it.
pub(crate) fn as_require_call(expr: &Expr, unresolved_mark: Mark) -> Option<&CallExpr> {
    let Expr::Call(call) = unparen(expr) else {
        return None;
    };
    let Callee::Expr(callee) = &call.callee else {
        return None;
    };
    let Expr::Ident(f) = &**callee else {
        return None;
    };
    if !is_global(f, "require", unresolved_mark) {
        return None;
    }
    let [arg] = &call.args[..] else {
        return None;
    };
    if arg.spread.is_some() || !matches!(unparen(&arg.expr), Expr::Lit(Lit::Str(_))) {
        return None;
    }
    Some(call)
}

/// For each `const x = require(...)` binding, scans every use of `x` and records
/// the resulting [`ExportUsage`] under the call's position in `resolved`.
pub(crate) fn resolve_namespace_bindings(
    program: &Program,
    bindings: &FxHashMap<Id, BytePos>,
    resolved: &mut FxHashMap<BytePos, ExportUsage>,
) {
    let mut visitor = NamespaceUsageVisitor {
        tracked: bindings.keys().cloned().collect(),
        usage: bindings
            .keys()
            .map(|id| (id.clone(), NamespaceUsage::Members(FxIndexSet::default())))
            .collect(),
    };
    program.visit_with(&mut visitor);

    for (id, span_lo) in bindings {
        let usage = match visitor.usage.remove(id) {
            // Bound but never read → only the target's evaluation matters.
            Some(NamespaceUsage::Members(names)) if names.is_empty() => ExportUsage::Evaluation,
            Some(NamespaceUsage::Members(names)) => {
                ExportUsage::PartialNamespaceObject(names.into_iter().collect())
            }
            Some(NamespaceUsage::Escaped) | None => ExportUsage::All,
        };
        resolved.insert(*span_lo, usage);
    }
}

/// How a namespace-valued binding (a `require()` result) is used module-wide.
#[derive(Debug)]
enum NamespaceUsage {
    /// Members read via static access (`ns.foo` / `ns["foo"]`), in source order.
    /// Empty means the binding is never used.
    Members(FxIndexSet<RcStr>),
    /// Used wholesale at least once (bare reference, reassignment, dynamic
    /// member, spread, …), so the whole namespace is observable.
    Escaped,
}

struct NamespaceUsageVisitor {
    tracked: FxHashSet<Id>,
    usage: FxHashMap<Id, NamespaceUsage>,
}

impl NamespaceUsageVisitor {
    fn escape(&mut self, id: &Id) {
        if let Some(usage) = self.usage.get_mut(id) {
            *usage = NamespaceUsage::Escaped;
        }
    }

    fn record_member(&mut self, id: &Id, name: RcStr) {
        if let Some(NamespaceUsage::Members(names)) = self.usage.get_mut(id) {
            names.insert(name);
        }
    }
}

impl Visit for NamespaceUsageVisitor {
    noop_visit_type!();

    // A tracked ident not consumed as a static member read (below) or skipped as
    // a declaration is a wholesale use.
    fn visit_ident(&mut self, n: &Ident) {
        let id = n.to_id();
        if self.tracked.contains(&id) {
            self.escape(&id);
        }
    }

    fn visit_member_expr(&mut self, n: &MemberExpr) {
        if let Expr::Ident(obj) = &*n.obj {
            let id = obj.to_id();
            if self.tracked.contains(&id) {
                match extract_name_from_member_prop(&n.prop) {
                    Some(names) => {
                        for name in names {
                            self.record_member(&id, name);
                        }
                    }
                    // `ns[dynamic]` / private member — not statically known, so
                    // the whole namespace is observable.
                    None => {
                        self.escape(&id);
                        if let MemberProp::Computed(ComputedPropName { expr, .. }) = &n.prop {
                            expr.visit_with(self);
                        }
                    }
                }
                // Consumed here; don't let `visit_ident` treat it as wholesale.
                return;
            }
        }
        n.visit_children_with(self);
    }

    fn visit_export_decl(&mut self, n: &ExportDecl) {
        // `export const x = require(...)`
        if let Decl::Var(var) = &n.decl {
            for d in &var.decls {
                if let Pat::Ident(binding) = &d.name {
                    self.escape(&binding.id.to_id());
                }
            }
        }
        n.visit_children_with(self);
    }

    fn visit_var_declarator(&mut self, n: &VarDeclarator) {
        // Don't treat a tracked binding's own declaration as a use.
        if let Pat::Ident(binding) = &n.name
            && self.tracked.contains(&binding.id.to_id())
        {
            if let Some(init) = &n.init {
                init.visit_with(self);
            }
            return;
        }
        n.visit_children_with(self);
    }
}
