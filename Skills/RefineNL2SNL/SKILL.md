# Refine NL $\to$ SNL (NL $\to$ SNL 精炼)

Given a natural language corpus, either a large document or a small chunk, this skill provides methodologies to refine it into well-structured SNL.

> *Since SNL is originally designed to immitate formalization through type theory, it's advised to refer to formal libraries for inspiration.*

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

4. **Pointer Construction**

## Entry-Level Refinement

1. 

## I18N
  Complete translations for languages to I18N-supported data if the user demands.

  **Do I18N AFTER necessary SNL refinement is complete.**
  
  *Not very important, omitted for now.*