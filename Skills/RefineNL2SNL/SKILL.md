# Refine NL $\to$ SNL (NL $\to$ SNL 精炼)

Given a natural language corpus, either a large document or a small chunk, this skill provides methodologies to refine it into well-structured SNL.

## Library-Level Refinement (库级精炼)

The ultimate goal of library-level refinement is to transform an ill-structured natural language corpus into a tree-structured entry hierarchy.

1. **Entrification (条目化)**

    You should first convert the natural language corpus into a tree of entries.

    An entry should be a complete sub-structure of the whole corpus. Entrification is basically entity ontology boundary detection. Sometimes it can be tricky to determine whether a chunk of text should be considered an entry or not.

    Since the tree structure can easily be displayed as a TUI-style table of contents (as displayed below), consult with the user before making a formal draft.

    ```text
        library name
        ├── [section] 1 ------- a section
        │   ├── [kind-A] 1.1 -- some entity
        │   └── [kind-B] 1.2 -- another entity
        ├── [section] 2 ------- another section
        │   └── [kind-A] 2.1 -- yet another entity
        ├── [section] 3 ------- yet another section
        ...
    ```

2. **Entry Categorization (条目分类)**

    Categorize all entries into different kinds, then examine whether available entry kind initialization presets already fit the demand. If not, first complete entry kind.

    Entry kind system should be treated as a primitive entity labeling and coloring support, NOT as a sound type system.

    *Examples*:

    * Almost all tree-structured documents are organized in a "chapter-section-subsection"-like hierarchy. In an SNL library, everything is an entry, so `Chapter`, `Section`, and `Subsection` should become entry kinds.
    * In mathematics, `Definition` and `Theorem` cover most formal mathematical knowledge. Sometimes `Remark` entries are used to provide additional information or context.
    * In Lean 4, every constant declaration fit into one of the 8 constructors of the `ConstantInfo` inductive type. We'd like to introduce `Structure`, `Type Class` and `Instance` for better organization, `Example` and `Lemma` in some cases, and `Notation`, `Macro`, `Command` and other kinds might be needed for meta-programming purposes.

3. **Markdown Drafting (Markdown 草稿)**

    Create all planned entries with only the title and the markdown content provided.

    It's advised to do entry-level refinement after library-level refinement is complete.

## Entry-Level Refinement

1. **Terminologization**

    Terminologization is the most important concept in SNL authoring. Refined terminology usage is the key difference between SNL and linear NL.

    The basic hypothesis of domain-specific terminologization is that: the specific domain has a well-founded knowledge ontology database, where abstract concepts and higher-order abstractions simplify the expression of the knowledge. So that theoretically people may leverage the terminology to express knowledge conveniently, it's just too tired to use terminology everywhere.

    Given an NL corpus, during the terminologization process, you should identify the frequently-used concepts in the domain, create term macros accordingly, link the macros to their sources, and substitute temporary syntax nodes with constant term macros already present in the database.

    An ideal refined SNL entry should have 1.00 SSI, which means all syntax nodes are considered well-founded and therefore should be easily readable.

2. **Currying**

    Since SNL term macros are designed to have a fixed arity $\geq 0$ or a dynamic arity and don't necessarily undergo Currying, terms are not always mono-arity functions as in Untyped $\lambda$-Calculus. This can lead to a variety of reasonable syntax trees for a single sentence:

    1. In sentence “Cats eat fish.”, we can either:

       1. Treat the SVO grammar structure as a 3-arity macro while considering “Cats”, “eat” and “fish” all being atomic concepts. This leads to a syntax tree like `SVO(Cats, eat, fish)`;
       2. Treat “Cats” and “fish” as atomic concepts, while considering “A eat B” as a 2-arity macro. This leads to a syntax tree like `eat(Cats, fish)`;
       3. Treat both VO grammar and SV grammar structure as 2-arity macros while considering “Cats”, “eat” and “fish” all being atomic concepts. This leads to a syntax tree like `SV(Cats, VO(eat, fish))`.

    This indicates that by Currying macros and making asbtractions, there can be multiple ways of deciding what the macro should be.

    The core idea is to choose the one that builds the most natural syntax tree:

    1. In sentence “Cats eat fish.”, the best syntax tree depends on the context:

       1. If the topic is to analyze grammar structure of English, then it's natural to consider SVO as the root macro, because abstracting subjects and objects offers us greater freedom of application in other contexts.
       2. If the topic is to analyze how food chains work in biology, then it's natural to consider “A eat B” as the root macro, because grammar structures don't matter here -- the concept of “eating” is the only thing matters, further decomposition merely complicates the syntax tree and does not contribute to language clarity.

3. **Mathematical notation, Contexts, Macros, and Counters**

    Mathematical authoring must preserve the notation the reader should actually see. Do not assume ASCII identifier names are prettified by a later renderer.

    * Write Greek letters as formula tokens: `$\alpha$`, `$\beta$`, `$\gamma$`, and so on. In SNL binder/source syntax, use forms such as `@$\alpha$` and `$\alpha$@Project.ctxt.family`; bare `alpha` renders as the Latin word `alpha`.
    * Prefer the project's conventional mathematical notation when it is known. For finite index sets, `[n]` may be clearer than `Fin(n)`; a field convention such as `$\mathbb{K}$` must be represented directly rather than left as bare `K`.
    * Give each mathematical operation its own Macro. For example, addition and scalar multiplication should be binary Macros such as `Add(x,y)` and `Smul(k,v)`. Do not encode an operator as another child and render it with operator-as-argument templates such as `#1 #0 #2`; SNL is not reproducing Lean's `SMul` plumbing.
    * Keep predicate Macros compact. Prefer forms such as `#0 线性相关` or `#0 在 #1 中线性相关` over restating carrier, field, length, and every ambient parameter already fixed by the Context.
    * Use a dynamic block Macro backed by `block_template_name: enumerate` as the root of a multiline Context Entry. Give it a newline separator. Context Entries contain only declarations shared by their consumers; bind one-off variables such as a represented vector locally in the Entry that uses them instead of repeating them through every Context consumer.
    * Prefer symbolic formulas over redundant text predicates. If zero-vector claims can be expressed as `v = \mathbf{0}_V`, define the symbolic zero Macro and use equality; do not also create a prose-only “is the zero vector” Macro.
    * Counter design is part of Library authoring, not optional polish. Define the Library Counter tree, assign every intended numbered graph occurrence a real `props.counterId`, and render the Library tree with numbers before delivery. A nonempty `counters.json` whose nodes never reference its Counters is unfinished.

    Completion criteria: representative Entry rendering shows the intended Greek, field, finite-index, operation, and compact-predicate notation; Context roots render as multiline enumerations; every Library `counterId` resolves and the numbered tree contains no unintentionally unnumbered occurrence.

4. **Counter Examples**

    Here are some bad examples that prevail when inexperienced AI Agents handle SNL authoring. Avoid these problems as possible:

    1. Syntax trees that are essentially strings are intolerable.

       Consider formula $1 + 1 = 2$. The obvious syntax tree should be something resembles:

       ```snl
       $#0 = #1$($#0 + #1$(1, 1), 2)
       ```

       Normally, it's clearly wrong to write a syntax tree like:

       ```snl
       %#0#1#2#3#4%(1, $+$, 1, $=$, 2)
       ```

       Writing SNL like this completely abandons readability provided by SNL, but may still have a very high SSI score, and unexperienced AI Agents tend to cheat like this.

    2. Fake high SSI by making everything a constant macro and attaching wrong sources.

       This makes macro management a nightmare, since force-structurizing unstructured NL means creating a massive amount of context-dependent terms that are only used once or twice.

    SSI score is a primitive measure about how well-based an SNL corpus is. It does not prevent cheating, and follows the Goodhart's Law -- once it becomes the target, it fails.

    Most of these scenarios derive from force-structurizing highly informal NL, where AI Agents tend to cheat high scores since it'd be very difficult to give a formal statement.

    The right thing to do is, when very difficult to decide the syntactical structure of a corpus, to treat it as a whole and accept an honest low SSI rather than making blind decompositions.
