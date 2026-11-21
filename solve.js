// Fast drop-in for csv-reader 1.0.0 (make.fun's reference program for
// csv-reader-speed-01): run(input) returns exactly csv-reader 1.0.0's answer
// {columns, rows, errors} for every input {text, header}.
//
// The reference reads one character at a time and builds every field a
// character at a time. This reader does the same reading, but in bulk:
//   - a record whose line holds no quote and no stray CR is split at once
//     with String.split(',');
//   - an unquoted field is one slice between the next comma and the record's
//     next line break (found once per record with indexOf, then cached);
//   - a quoted field is slices between the next quotes found with indexOf,
//     and a line break inside quotes is normalised only when the segment
//     actually holds one.
// Every error the reference records (stray_cr, unterminated_quote,
// quote_junk, short_row, long_row) is recorded here in the same order, with
// the same {code, line, row}.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next. Dependency-free ES module, no imports at all.

/** How a field ended: at a comma, at a line break, or at the end of the text. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The next LF at or after the current field start (-1: unknown, Infinity: none ahead).
  // An unquoted field cannot pass it, so it is found once per record and
  // cached; a quoted field may span it, so it is forgotten after one.
  let nextLf = -1;

  // True while the unquoted fields being read are on a line already checked
  // to hold no stray CR, so readUnquoted may skip its own check for one.
  // A quoted field may end on a later line, so it clears this.
  let skipCR = false;

  // The field just read: its value, how it ended, and how many characters
  // were kept by the unquoted read (`added`: the junk's length, for
  // quote_junk). Kept in locals instead of a fresh object per field.
  let fValue = '';
  let fEnded = 0;
  let fAdded = 0;

  // A segment of a quoted field with each CRLF or lone CR read as LF; the
  // line count moves with it. Segments without a line break come back as-is.
  function normSeg(seg) {
    if (seg.indexOf('\r') === -1 && seg.indexOf('\n') === -1) return seg;
    let out = '';
    let s = 0;
    for (let i = 0; i < seg.length; i++) {
      const ch = seg.charCodeAt(i);
      if (ch === 13) {
        out += seg.slice(s, i) + '\n';
        line += 1;
        if (seg.charCodeAt(i + 1) === 10) i += 1;
        s = i + 1;
      } else if (ch === 10) {
        out += seg.slice(s, i) + '\n';
        line += 1;
        s = i + 1;
      }
    }
    return out + seg.slice(s);
  }

  // Reads unquoted characters from pos up to the next comma or line break: a
  // CR not followed by LF is dropped (stray_cr). `init` is the value so far
  // ('' for a plain field, the quoted value for quote junk, '"' for the
  // re-read after an unterminated quote). Sets fValue, fEnded and fAdded.
  function readUnquoted(init) {
    if (nextLf < 0) {
      const i = text.indexOf('\n', pos);
      nextLf = i === -1 ? Infinity : i;
    }
    const comma = text.indexOf(',', pos);
    let end;
    let kind;
    if (comma !== -1 && comma < nextLf) {
      end = comma;
      kind = COMMA;
    } else if (nextLf !== Infinity) {
      end = nextLf;
      kind = LINE_BREAK;
    } else {
      end = n;
      kind = END;
    }
    let seg = text.slice(pos, end);
    let added = seg.length;
    if (kind === LINE_BREAK && seg.charCodeAt(seg.length - 1) === 13) {
      // The CR is the CRLF that ends the record.
      seg = seg.slice(0, -1);
      added = seg.length;
    }
    if (!skipCR) {
      const cr = seg.indexOf('\r');
      if (cr !== -1) {
        // Stray CRs: dropped, one error each.
        let count = 0;
        for (let i = cr; i !== -1; i = seg.indexOf('\r', i + 1)) count += 1;
        for (let i = 0; i < count; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        seg = seg.replace(/\r/g, '');
        added = seg.length;
      }
    }
    if (kind === COMMA) pos = end + 1;
    else if (kind === LINE_BREAK) {
      pos = end + 1;
      line += 1;
    } else {
      pos = n;
    }
    fValue = init === '' ? seg : init + seg;
    fEnded = kind;
    fAdded = added;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue, fEnded
  // and fAdded (0 unless it ends in quote junk, whose length fAdded holds).
  // A quoted field may end on a later line, so the line's stray-CR check is
  // forgotten from here on.
  function readQuoted() {
    skipCR = false;
    const open = pos;
    const openLine = line;
    let value = '';
    let start = pos + 1;
    for (;;) {
      const q = text.indexOf('"', start);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        nextLf = -1;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += normSeg(text.slice(start, q)) + '"';
        start = q + 2;
        continue;
      }
      value += normSeg(text.slice(start, q));
      pos = q + 1;
      break;
    }
    nextLf = -1;
    if (pos >= n) {
      fValue = value;
      fEnded = END;
      fAdded = 0;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA;
      fAdded = 0;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    nextLf = -1;

    let fields;
    // A record whose line holds no quote and no stray CR: split it at once.
    const lf = text.indexOf('\n', pos);
    const lineEnd = lf === -1 ? n : lf;
    let seg = text.slice(pos, lineEnd);
    if (lf !== -1 && seg.charCodeAt(seg.length - 1) === 13) seg = seg.slice(0, -1);
    const lineHasCR = seg.indexOf('\r') !== -1;
    if (seg.indexOf('"') === -1 && !lineHasCR) {
      fields = seg.split(',');
      if (lf !== -1) {
        pos = lf + 1;
        line += 1;
      } else {
        pos = n;
      }
    } else {
      // This line holds no stray CR: its unquoted fields may skip their own
      // check for one (a quoted field clears this, it may end on a later line).
      skipCR = !lineHasCR;
      fields = [];
      let quoted = false;
      do {
        if (text.charCodeAt(pos) === 34) {
          quoted = true;
          readQuoted();
        } else {
          quoted = false;
          // Inline readUnquoted(''): the common field, no call.
          if (nextLf < 0) {
            const i = text.indexOf('\n', pos);
            nextLf = i === -1 ? Infinity : i;
          }
          const comma = text.indexOf(',', pos);
          let end;
          let kind;
          if (comma !== -1 && comma < nextLf) {
            end = comma;
            kind = COMMA;
          } else if (nextLf !== Infinity) {
            end = nextLf;
            kind = LINE_BREAK;
          } else {
            end = n;
            kind = END;
          }
          let seg = text.slice(pos, end);
          if (kind === LINE_BREAK && seg.charCodeAt(seg.length - 1) === 13) seg = seg.slice(0, -1);
          if (!skipCR) {
            const cr = seg.indexOf('\r');
            if (cr !== -1) {
              let count = 0;
              for (let i = cr; i !== -1; i = seg.indexOf('\r', i + 1)) count += 1;
              for (let i = 0; i < count; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
              seg = seg.replace(/\r/g, '');
            }
          }
          if (kind === COMMA) pos = end + 1;
          else if (kind === LINE_BREAK) {
            pos = end + 1;
            line += 1;
          } else {
            pos = n;
          }
          fValue = seg;
          fEnded = kind;
        }
        fields.push(fValue);
      } while (fEnded === COMMA);

      // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
      if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
