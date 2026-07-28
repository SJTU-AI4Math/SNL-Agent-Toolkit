# Drafting (起稿)

## Stage 1: Independent Markdown Planning (独立文件计划)

1. Read the Entry shape in [`../Basics/Json_Schema.md`](../Basics/Json_Schema.md). Every field an Entry will need must be decided here, except `content`, which is drafted in Markdown natural language. The SNL form is refined in later stages.

2. Write the blueprint as **one Markdown table** in `.SNL_Doc/Plans/Draft_<Name>.md`. Columns align with the Entry schema plus one structural column:

   | column | meaning |
   |---|---|
   | `counter` | the position of this row in the Library outline, written as a dotted ordinal (`1`, `1.2`, `1.2.3`). |
   | `id` | the future Entry id, `<domain>.<kind>.<slug>`. |
   | `kind` | an id from `config.json#entry_kinds`. |
   | `title` | the Entry title. |
   | `content` | Markdown natural-language draft of the Entry body. |

   **Use `counter`, not a `parent` column.** The dotted ordinal already encodes the whole tree: `1.2.3`'s parent is `1.2`. A separate `parent` column duplicates that information and lets the two disagree. The counter is also directly consumable by [`Construct_Library.md`](Construct_Library.md), which turns depth into `branch` edges and the ordinal into the counter tree.

   **Example**

   | counter | id | kind | title | content |
   |---|---|---|---|---|
   | 1 | analysis.sec.seq | section | Real Sequences | |
   | 1.1 | analysis.ctxt.seq | context | Ambient sequence | Declares `a : ℕ → ℝ`, `L : ℝ`, `ε : ℝ` with `0 < ε`. |
   | 1.2 | analysis.subsec.limit | subsection | Convergence | |
   | 1.2.1 | analysis.def.limit | definition | Limit of a sequence | `a` converges to `L` iff for every `ε > 0` there is `N : ℕ` such that `n ≥ N → \|a n − L\| < ε`. Uses `analysis.ctxt.seq`. |
   | 1.2.2 | analysis.thm.limitUnique | theorem | Uniqueness of the limit | If `a` converges to `L` and to `M`, then `L = M`. |
   | 1.2.2.1 | analysis.thm.limitUnique.proof | proof | Proof | Suppose `L ≠ M`; apply the definition with `ε := \|L − M\| / 2` and derive a contradiction. |

   Sibling order is row order. Reading order is the table read top to bottom.

3. The content of a formal entry should be informative specific, preferably free of intuitive descriptions. Use terminology instead of general words. Intuitive descriptions should be separated into remark entries.

    **Examples**

    What's terminology (GOOD):

    **M is a monad** is defined to contain the following operations:
    1. `pure (A : Type) : A -> M A`
    2. `map (A,B : Type) : M A -> (A -> M B) -> M B`
    3. `flatten / join (A : Type) : M (M A) : M A`

    *Someone ignorant of functional programming should gain immediate, specific and appliable knowledge after reading the above entry. `pure`, `map`, `flatten`, `(_ : _)`, `_ -> _` are all formal terms used in functional programming, so the above expression is informative.*

    What's intuitive description (BAD):

    Monad is a very, very important concept in functional programming, and is such a brilliant design in the history of computer science. Monads are used to manage functions with side effects, and we can convert instructional code into functional code by using monads...

    *Someone ignorant of functional programming still have little appliable knowledge about "What's a monad" after reading the above entry. "very, very important", "brilliant design", "manage" are all general words that can appear anywhere, they do not provide specific information about functional programming.*

    *Although intuitive descriptions cannot provide detailed knowledge about the concept, they are often necessary for thorough comprehension if combined with formal definitions. So we write them in remark entries after the formal entries.*

4. Declare shared binders in `context` Entries and name the owning context from every dependent row (`Uses analysis.ctxt.seq`). This makes the later cross-entry `x@<contextId>` postfixes mechanical instead of guesswork.

5. It is advised to assign the drafting task to subagents, as collecting detailed knowledge requires repetitive tooling.

### Splitting a draft across parallel subagents

When several subagents draft disjoint parts of one Library:

- Assign each subagent a disjoint **id slug space** up front, not just a topic. Two agents drafting "sequences" and "series" both reach for `ctxt.seq`.
- Assign each subagent a disjoint **top-level counter range** (agent A owns `1`–`2`, agent B owns `3`–`4`), so counters concatenate without renumbering.
- Tell each subagent which Entry ids **already exist** in `entries.json` and must be reused verbatim rather than recreated under a new name.
- After the parts return, run the consolidation checks in Stage 2 before merging. Cross-agent id collisions are the normal failure mode, not the exceptional one.

## Stage 2: Entrification (条目化)

1. Verify the merged blueprint before writing any JSON:
   - every `id` is unique across all draft files and does not collide with an existing `entries.json` id unless the row is a deliberate reuse;
   - every `kind` resolves in `config.json#entry_kinds`;
   - every `counter` has a parent counter present in the table (`1.2.3` requires `1.2`);
   - no counter is duplicated.
2. Create one record per row in `.SNL_Doc/entries.json` with identity and classification fixed, following [`Author_Entries.md`](Author_Entries.md).
3. For the `content` field, only the Markdown version is expected here. The SNL version is refined during subsequent stages.
