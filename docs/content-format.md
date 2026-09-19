# Content format

The complete rules for writing study content. `npm run check` enforces them and prints every problem as `file:line: message`.

## Files and books

- Every `.md` file under `content/` (any subfolder) is a content file. Images sit next to the Markdown.
- Files are read in path order (plain string sort of the relative path, so `B` sorts before `a`). Name them `01-caching.md`, `02-queues.md`.
- A book is every file with the same `book:` title: one file or many. Books are listed by title. Its id is the title lowercased, accents removed, each run of other characters turned into `-`, dashes trimmed (`System Design` becomes `system-design`). Two different titles with the same id are an error.
- Progress is stored under book id, section id and concept id. **Renaming a book title, a section id or a concept id loses that progress.** Titles of chapters and sections can change freely.

## Front matter (required)

```
---
book: System Design
chapter: Caching
---
```

- Line 1 is `---`, then `key: value` lines (blank lines ignored), then `---`. Values are literal text: no quotes, no YAML features.
- `book` is required. `chapter` is optional; with it, the file starts inside that chapter. An unknown or repeated key, an empty value, or a value with no letter or digit (a-z, 0-9) is an error.

## Structure

Lines at column 0, outside code fences, define structure.

- `# Title` starts a chapter. A file may hold several. A chapter needs at least one section, and a title with a letter or digit.
- `## Title {#id}` starts a section in the chapter above it. The `{#id}` ends the line. A section before any chapter is an error. A file needs at least one section.
- Chapter titles are unique within a book, even across files, and titles with the same slug count as equal. Put all of a chapter's sections under one heading. Chapter order is order of first appearance, files in path order.
- Only blank lines may sit between the front matter (or a `# Chapter` line) and the first `##` section.
- Section ids and concept ids match `[a-z0-9]+(-[a-z0-9]+)*`. Each must be unique within the whole book, across chapters and files.
- A section is content, then questions. Content runs from the heading to the first `??` line and must not be empty. A section needs at least one concept.
- Headings inside content are `###` or deeper. No content line may start with `# `, `## `, `??` or `?+`, even inside `$$` math; put such text in a code fence.

## Code fences

- A fence opens with 3+ backticks or 3+ tildes (up to 3 spaces of indent) and closes with a line holding only the same character, at least as many times. A backtick fence's info string cannot contain a backtick. To show a fence inside code, open with a longer one.
- Inside a fence nothing is structure: `#`, `##`, `??`, `?+`, `*`, `-`, `=`, `>` lines are plain code.
- An unclosed fence is an error at its opening line.
- The language after the opening must be one the highlighter knows (`python`, `ts`, `sql`, `bash`, `json`, ... in lowercase, or `text`); an unknown one is an error at the fence's line. Omit it for plain text.

## Questions

The question block runs from the first `??` to the end of the section. It may hold only the lines below and blank lines. Each marker starts at column 0 and is followed by a space. Anything else is an error; prose goes above the first `??`.

- `?? <concept-id> [settings] <prompt>` starts a concept and its first variant. The prompt is the rest of the line: non-empty, one line.
- `?+ [settings] <prompt>` adds a variant to the concept above it in the same section. Variants may mix types.
- A fenced code block on the line directly after `??` or `?+` (no blank line) belongs to its prompt. One per prompt, and nowhere else in the question block.
- `* text` is a correct option and `- text` a wrong one: one non-empty line each.
- `= a | b` lists accepted short answers: split on `|`, trimmed, empties dropped. Several `=` lines are allowed.
- `> text` is the explanation. Consecutive `>` lines join with newlines and render as block Markdown; a lone `>` is a paragraph break. A second block is an error.
- Within a variant the `*`, `-`, `=` lines may come in any order. Every variant needs a prompt and a non-empty explanation.

**Settings.** A `[` right after the concept id (`??`) or after `?+` always starts settings, so a prompt cannot begin with `[`. Tokens are separated by spaces or commas. `multi`, `tf`, `short` set the type (at most one; none means multiple choice). `n=2` to `n=9` sets how many options show (multiple choice and `multi` only; default 4). An unknown token is an error.

| Type | Write | Needs | Not allowed |
|---|---|---|---|
| multiple choice | no setting | 1+ `*` and 1+ `-` | `=` |
| multiple select | `[multi]` | 1+ `*` | `=` |
| true/false | `[tf]` | exactly one `*`, text `true` or `false` in any case | `-`, `=` |
| short answer | `[short]` | 1+ accepted answer | `*`, `-` |

How they play, so write accordingly:

- Multiple choice shows one random `*` plus up to `n-1` random `-`, shuffled. Give more options than `n` so repeats differ. Each `*` must be right and each `-` wrong beside any others, so no "all of the above" or "option A".
- `multi` shows every `*` plus wrong ones up to `n`; it is right only for exactly the correct set.
- Short answers ignore case and whitespace when compared; the reader can overrule a wrong verdict.
- Use multiple choice mostly. A concept is one idea; progress and review are tracked per concept, and variants are different questions on it. The explanation shows on a wrong answer and on request after a right one, so it must stand alone.

## Text

- Content, prompts, options and explanations are GitHub-flavoured Markdown: inline code, emphasis, tables, `$x$` math, `$$ ... $$` display math (one line or several). A literal dollar sign is `\$`. Invalid LaTeX is an error at the line where the formula starts, and so are `\href`, `\url`, `\includegraphics` and `\html...`. Raw HTML is an error: write Markdown, and show tags inside code.
- Accepted answers are plain text: no Markdown, no `\$`, no `|` inside an answer.
- Images: `![alt](images/name.png)`, a path relative to the `.md` file's folder, inside `content/`. Types: png, jpg/jpeg, gif, webp, svg. A missing file, an `http(s):` or other URL, or an absolute path is an error.

## Example

````markdown
---
book: System Design
chapter: Caching
---

## Cache eviction {#cache-eviction}

An LRU cache evicts the entry unread for longest, in $O(1)$ with a hash map plus a doubly linked list.

$$ hit\ rate = \frac{hits}{hits + misses} $$

```python
cache = LRUCache(capacity=100)
```

![LRU order](images/lru.svg)

?? lru-evict Which entry does an LRU cache evict first?
* The least recently used entry
* The entry that has gone longest without being read
- The most recently used entry
- The largest entry
- The oldest inserted entry
> LRU tracks access order and evicts the entry untouched for longest.

?+ Keys A, B and C are inserted in that order, then A is read. Which key does LRU evict next?
* B
- A
- C
> After A is read, B is the least recently used key.

?? lru-cost [tf] LRU lookups are $O(n)$.
* false
> A hash map gives $O(1)$ lookup and the list gives $O(1)$ eviction.

?? lru-reads [multi n=5] What can a cache hit change in an LRU cache?
* The entry's position in the recency order
- The cache capacity
- Which entries are stored on disk
> A hit only reorders recency.

?? fifo-name [short] Name the policy that evicts the oldest inserted entry.
= FIFO | first in first out
> FIFO ignores reads and evicts by insertion order.

# Consistency

## Quorums {#quorums}

With $N$ replicas, reads and writes overlap when $R + W > N$.

?? quorum-code What does this print?
```python
n, r, w = 5, 2, 3
print(r + w > n)
```
* False
- True
- 5
> $2 + 3 = 5$, which is not greater than 5.
````

## Common mistakes

- `## Cache eviction` or `{#Cache_Eviction}` becomes `## Cache eviction {#cache-eviction}`.
- Repeating `?? lru-evict` for a second question: use `?+`. Concept ids are unique per book.
- Prose, lists, tables or `###` headings after the first `??`: move them above it. Text and questions cannot interleave; start a new section instead.
- A multi-line prompt or option: one line only. Put the detail in the content or in a code block after the prompt.
- A blank line between a `??` line and its code fence: the fence must be the next line.
- A missing explanation, or two `>` blocks split by a blank line: one `>` block, with a lone `>` between paragraphs.
- `[tf]` with `- false` or with both `* true` and `* false`: exactly one `* true` or `* false`.
- `=` in a non-`[short]` variant, or `*` and `-` in a `[short]` one.
- A prompt beginning with `[`: start with a word, since `[` always opens settings.
- `$5` in prose: write `\$5`.
- A `# Title` line in content meant as a heading: it starts a chapter; use `###`.
- `<br>`, `<details>`, `<img src="https://...">` or any other raw HTML: an error; use Markdown and local images.
- The same chapter title in two files, or a section or concept id reused in another chapter: both must be unique in the book.
