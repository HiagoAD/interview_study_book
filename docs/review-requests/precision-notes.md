# Review request: precision notes

- **Kind:** accuracy
- **Priority:** low
- **Touches:** prose only

Each item is right in spirit and imprecise in a way a careful interviewer could press on.
None is urgent; they are listed together so one editing pass can take them.

8. `12-mobile-production.md:22`: on a tile-based GPU, blending reads tile memory, which is
   on chip and cheap. The cost of transparency is the second half of the sentence: every
   layer is shaded, because hidden-surface removal cannot discard it.
9. `13-liveops-and-releases.md:27`: “one calendar date spans 26 hours across the world”.
   The local midnights that end a date are spread over 26 hours, from UTC+14 to UTC−12;
   the date itself exists somewhere for 50. The sentence's consequence is right.
10. `13-liveops-and-releases.md:38`: some zones change their clocks at midnight, so on a
    transition day local midnight itself is skipped or repeated. That is the case that
    breaks the section's own example, “ends at local midnight”, and it deserves a clause
    beside 02:30.
14. `14-collaboration.md:213`: “has a common name, situation, task, action, result” never
    says the name. It is STAR, and interviewers use the word.
