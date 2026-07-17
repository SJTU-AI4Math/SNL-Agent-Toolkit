# Drafting (起稿)

## Stage 1: Independent Markdown Planning (独立文件计划)

1. Read entry json schema from *(TBD)*, all necessary fields of entries must be prepared. For `content` field, you only need to prepare for markdown version. SNL version will be refined during subsequent stages.
2. The markdown file should be written in a table, where all columns are aligned with the entry json schema, except for the `content` field, which should be written in markdown formatted natural language.

    **Example**

    *(TBD), write a table following the above instruction*

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

4. It is advised to assign the drafting task to subagents, as collecting detailed knowledge requires repetitive tooling.

## Stage 2: Entrification (条目化)

1. Read entry json schema from *(TBD)*, all prepared fields of entries should be relocated into `graph.json` file.
2. For `content` field, you only need to prepare for markdown version. SNL version will be refined during subsequent stages.