# Graph Report - apple-style-dashboard-redesign  (2026-11-12)

## Corpus Check
- 43 files · ~53,182 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .ico 1, .css 1)

## Summary
- 64 nodes · 62 edges · 6 communities (5 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5981d6aa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- devDependencies
- dependencies
- scripts
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 19 edges
2. `scripts` - 4 edges
3. `private` - 1 edges
4. `dev` - 1 edges
5. `build` - 1 edges
6. `preview` - 1 edges
7. `@supabase/supabase-js` - 1 edges
8. `@supabase/supabase-js` - 1 edges
9. `clsx` - 1 edges
10. `clsx` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (6 total, 1 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.10
Nodes (20): name, private, type, version, clsx, lucide-react, mysql2, react (+12 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 2 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript, vite (+2 more)

### Community 3 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, clsx, lucide-react, mysql2, react, react-dom, @supabase/supabase-js, tailwind-merge

### Community 4 - "scripts"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

## Knowledge Gaps
- **16 isolated node(s):** `@supabase/supabase-js`, `clsx`, `lucide-react`, `mysql2`, `react` (+11 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 58 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **What connects `@supabase/supabase-js`, `clsx`, `lucide-react` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `compilerOptions` connect `compilerOptions` to `tsconfig.json`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._