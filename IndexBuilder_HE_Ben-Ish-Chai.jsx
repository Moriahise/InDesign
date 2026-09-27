/**
 * IndexBuilder_HE_Ben-Ish-Chai.jsx fuer Ben Ish Chai (InDesign 18.1).
 * Bekannte Einstellungsoberflaeche, Kandidatenextraktion und HTML/JSON-Export.
 * Nativer HE-Index: InDesign-GREP, Symbol-Sortierung, optional Alef-Bet.
 */
#target "indesign"
#targetengine "main"

(function () {
    "use strict";

    var VERSION = "1.2-Ben-Ish-Chai";

    // ---- Skript-Variante -------------------------------------------
    var SCRIPT_MODE  = "hebrew";  // dieses Skript: nur Hebräisch
    var OTHER_SCRIPT = "IndexBuilder_DE.jsx";
    var INDEX_NAME   = "IndexBuilder \u2013 Hebr\u00e4isch";
    var FILE_SUFFIX  = "he";

    // ---- UI-Farblogik: gleicher Ablauf = gleiche Farbe --------------
    // BLAU: Quelle/Wortliste/Grundlage · GRUEN: Analyse/Auswahl
    // MAGENTA: Export/Index schreiben · ORANGE: Entfernen/Abbruch/Bereinigung
    var UI_BLUE=[0.18,0.43,0.73,1];
    var UI_GREEN=[0.16,0.56,0.31,1];
    var UI_MAGENTA=[0.82,0.20,0.52,1];
    var UI_ORANGE=[0.86,0.49,0.10,1];
    var UI_TEXT_LIGHT=[1,1,1,1];
    var UI_TEXT_DARK=[0.12,0.12,0.12,1];
    var UI_DISABLED=[0.36,0.36,0.36,1];

    function uiTint(color){
        return [0.82+color[0]*0.18,0.82+color[1]*0.18,0.82+color[2]*0.18,1];
    }
    function styleWorkflowText(control,color,tip){
        if(tip) control.helpTip=tip;
        try{
            var g=control.graphics;
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,color,1);
            try{g.font=ScriptUI.newFont(g.font.name,"BOLD",g.font.size);}catch(_font){}
        }catch(_text){}
        return control;
    }
    function styleWorkflowPanel(control,color,tip){
        if(tip) control.helpTip=tip;
        try{
            var g=control.graphics;
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,color,1);
        }catch(_panel){}
        return control;
    }
    function styleWorkflowChoice(control,color,tip){
        if(tip) control.helpTip=tip;
        try{
            var g=control.graphics;
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,color,1);
        }catch(_choice){}
        return control;
    }
    function styleWorkflowField(control,color,tip){
        if(tip) control.helpTip=tip;
        try{
            var g=control.graphics;
            g.backgroundColor=g.newBrush(g.BrushType.SOLID_COLOR,uiTint(color));
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,UI_TEXT_DARK,1);
        }catch(_field){}
        return control;
    }
    function styleWorkflowButton(btn,color,tip){
        btn.__indexWorkflowColor=color;
        if(tip) btn.helpTip=tip;
        try{
            var gg=btn.graphics;
            gg.backgroundColor=gg.newBrush(gg.BrushType.SOLID_COLOR,color);
            gg.foregroundColor=gg.newPen(gg.PenType.SOLID_COLOR,UI_TEXT_LIGHT,1);
        }catch(_direct){}
        btn.onDraw=function(){
            try{
                var g=this.graphics;
                var w=(this.size&&this.size.width!==undefined)?this.size.width:this.size[0];
                var h=(this.size&&this.size.height!==undefined)?this.size.height:this.size[1];
                var c=this.enabled?this.__indexWorkflowColor:UI_DISABLED;
                var brush=g.newBrush(g.BrushType.SOLID_COLOR,c);
                var border=g.newPen(g.PenType.SOLID_COLOR,[0.12,0.12,0.12,1],1);
                var textPen=g.newPen(g.PenType.SOLID_COLOR,this.enabled?UI_TEXT_LIGHT:[0.72,0.72,0.72,1],1);
                g.rectPath(0,0,w,h);g.fillPath(brush);g.strokePath(border);
                var txt=String(this.text||"");
                var m=g.measureString(txt);
                g.drawString(txt,textPen,Math.max(4,(w-m[0])/2),Math.max(2,(h-m[1])/2));
            }catch(_draw){}
        };
        return btn;
    }

    /* ================================================================== *
     *  0. Kompatibilitäts-Helfer (ExtendScript ist ES3+)
     * ================================================================== */

    function assign(target /* , sources */) {
        for (var i = 1; i < arguments.length; i++) {
            var src = arguments[i];
            if (!src) continue;
            for (var k in src) if (src.hasOwnProperty(k)) target[k] = src[k];
        }
        return target;
    }
    function isArray(x) {
        return Object.prototype.toString.call(x) === "[object Array]";
    }
    function repeat(s, n) { var out = ""; for (var i = 0; i < n; i++) out += s; return out; }
    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }
    function startsWith(s, prefix) { return String(s).indexOf(prefix) === 0; }
    function padNum(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }

    /* ================================================================== *
     *  1. Logging – sichtbare Rückmeldung + Ringpuffer
     * ================================================================== */

    var LOG = { entries: [], errors: [] };
    function logInfo(msg)  { LOG.entries.push("INFO  " + msg); $.writeln("[IndexBuilder] " + msg); }
    function logWarn(msg)  { LOG.entries.push("WARN  " + msg); $.writeln("[IndexBuilder WARN] " + msg); }
    function logError(msg) { LOG.entries.push("ERROR " + msg); LOG.errors.push(msg); $.writeln("[IndexBuilder ERR] " + msg); }

    /* ================================================================== *
     *  2. Normalisierung
     *     Hebräisch: Niqqud (U+05B0..U+05BD, U+05BF, U+05C1, U+05C2,
     *                        U+05C4, U+05C5, U+05C7)
     *                Teamim (U+0591..U+05AF)
     *     Interpunktion: Maqaf U+05BE → "-", Geresh U+05F3 → "'",
     *                    Gershayim U+05F4 → '"', Sof Pasuq U+05C3 → "."
     *     Deutsch: NFC-Normalisierung häufigster zerlegter Umlaute
     * ================================================================== */

    var RE_NIQQUD = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
    var RE_TEAMIM = /[\u0591-\u05AF]/g;

    function stripNiqqud(s)      { return String(s).replace(RE_NIQQUD, ""); }
    function stripTeamim(s)      { return String(s).replace(RE_TEAMIM, ""); }
    function stripHebrewMarks(s) {
        var t = String(s);
        // Fast-Path: kein hebräischer Textabschnitt → nichts zu strippen
        if (!/[\u0591-\u05C7]/.test(t)) return t;
        return stripTeamim(stripNiqqud(t));
    }

    function unifyPunctuation(s) {
        var t = String(s);
        // Fast-Path: reine ASCII-Wörter enthalten keine der Sonderzeichen
        if (!/[\u00A0\u05BE\u05C3\u05F3\u05F4\u2013\u2014\u2018-\u201F]/.test(t)) return t;
        return t
            .replace(/\u05BE/g, "-")
            .replace(/\u05F3/g, "'")
            .replace(/\u05F4/g, '"')
            .replace(/\u05C3/g, ".")
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            .replace(/[\u2013\u2014]/g, "-")
            .replace(/\u00A0/g, " ");
    }

    // Mini-NFC für die häufigsten zerlegten Umlaute (a + Kombinierer → ä).
    // InDesign speichert Umlaute i.d.R. schon komponiert; diese Tabelle deckt
    // die Randfälle ab, wenn kombinierende Marks im Text landen.
    var NFC_MAP = {
        "a\u0308": "\u00E4", "o\u0308": "\u00F6", "u\u0308": "\u00FC",
        "A\u0308": "\u00C4", "O\u0308": "\u00D6", "U\u0308": "\u00DC",
        "e\u0301": "\u00E9", "e\u0300": "\u00E8", "e\u0302": "\u00EA",
        "a\u0301": "\u00E1", "a\u0300": "\u00E0", "i\u0301": "\u00ED"
    };
    function toNFC(s) {
        var t = String(s);
        // Fast-Path: keine Kombinationsmarks in Latein-Bereich (U+0300-U+036F)
        // und keine hebräischen Marks-Präfixe → keine Zerlegung möglich
        if (!/[\u0300-\u036F]/.test(t)) return t;
        for (var k in NFC_MAP) if (NFC_MAP.hasOwnProperty(k)) {
            t = t.split(k).join(NFC_MAP[k]);
        }
        return t;
    }

    function foldCase(s) {
        // ExtendScript-toLowerCase ist Turkish-sicher genug für unsere Sprachen
        return String(s).replace(/\u00DF/g, "ss").toLowerCase();
    }
    function foldGermanUmlauts(s) {
        return String(s)
            .replace(/\u00E4/g, "ae").replace(/\u00F6/g, "oe").replace(/\u00FC/g, "ue")
            .replace(/\u00C4/g, "Ae").replace(/\u00D6/g, "Oe").replace(/\u00DC/g, "Ue")
            .replace(/\u00DF/g, "ss");
    }

    var RE_HEBREW = /[\u05D0-\u05EA\uFB1D-\uFB4F]/;
    var RE_LATIN  = /[A-Za-z\u00C0-\u024F]/;

    /**
     * CS5/CS6-Kompatibilität: hebräische Textabschnitte byteweise spiegeln.
     * Vor World-Ready Composer wurde hebräischer Text in InDesign visuell
     * links-nach-rechts als LTR gespeichert; die Bytes stehen also rückwärts.
     * Diese Funktion kehrt jede zusammenhängende hebräische Zeichensequenz
     * (inkl. Niqqud, Teamim, Maqaf, Gershayim – U+0591 bis U+05F4) um.
     * Idempotent: zweimal anwenden = Original.
     * Lateinische Umgebung bleibt unangetastet.
     */
    function reverseHebrewRuns(text) {
        return String(text).replace(/[\u0591-\u05F4]+/g, function (run) {
            var out = "";
            for (var i = run.length - 1; i >= 0; i--) out += run.charAt(i);
            return out;
        });
    }

    function detectScript(s) {
        var str = String(s);
        var heb = RE_HEBREW.test(str);
        var lat = RE_LATIN.test(str);
        if (heb && lat) return "mixed";
        if (heb) return "hebrew";
        if (lat) return "latin";
        return "other";
    }

    function guessLanguage(text, defaultLatin) {
        var sc = detectScript(text);
        if (sc === "hebrew") return "he";
        if (sc === "latin" || sc === "mixed") {
            if (/[\u00E4\u00F6\u00FC\u00C4\u00D6\u00DC\u00DF]/.test(text)) return "de";
            return defaultLatin || "en";
        }
        return "";
    }

    /**
     * Vergleichsschlüssel: liefert String, mit dem sich Formen vergleichen lassen.
     * matchMode:      "exact" | "normalized" (Default) | "noNiqqud"
     * foldHistorical: Hirsch-Rechtschreibung → moderne Form
     *                 (th→t, ae↔ä/ä→ae, ue↔ü/ü→ue, oe↔ö/ö→oe, ß→ss)
     */
    function makeCompareKey(text, opts) {
        opts = opts || {};
        var s = toNFC(String(text));
        s = unifyPunctuation(s);
        if (opts.matchMode === "noNiqqud" || opts.ignoreNiqqud) s = stripHebrewMarks(s);
        if (opts.matchMode !== "exact" && !opts.caseSensitive) s = foldCase(s);
        if (opts.foldUmlauts || opts.foldHistorical) s = foldGermanUmlauts(s);
        if (opts.foldHistorical) {
            // th → t, aber nur bei lateinischen Buchstaben (nicht in URLs, IDs etc.)
            // Case sensitive schon vorher gefoldet, hier reicht Kleinschreibung.
            s = s.replace(/th/g, "t").replace(/Th/g, "T");
        }
        return s;
    }

    /* ================================================================== *
     *  3. Tokenisierung (RegEx-basiert, ohne \p{L})
     *     Wortzeichen: hebräische Buchstaben (auch mit Niqqud/Teamim inline),
     *                  lateinische Buchstaben inkl. Umlaute, Ziffern, Maqaf,
     *                  Bindestrich (hält Komposita zusammen).
     * ================================================================== */

    var WORD_CHAR = "A-Za-z0-9\u00C0-\u024F\u0591-\u05C7\u05D0-\u05EA\u05BE\\-";
    var RE_TOKEN = new RegExp("[" + WORD_CHAR + "]+", "g");

    function tokenize(text) {
        var tokens = [];
        var s = String(text);
        RE_TOKEN.lastIndex = 0;
        var m;
        while ((m = RE_TOKEN.exec(s)) !== null) {
            // Führenden/abschließenden Bindestrich abschneiden (kein Wortanfang)
            var t = m[0];
            var start = m.index;
            while (t.length > 1 && t.charAt(0) === "-") { t = t.substring(1); start++; }
            while (t.length > 1 && t.charAt(t.length - 1) === "-") { t = t.substring(0, t.length - 1); }
            if (t.length === 0) continue;
            tokens.push({ text: t, start: start, end: start + t.length });
            if (m.index === RE_TOKEN.lastIndex) RE_TOKEN.lastIndex++; // Endlosschutz
        }
        return tokens;
    }

    function isWordBoundary(text, pos) {
        if (pos <= 0 || pos >= text.length) return true;
        var c = text.charAt(pos);
        return !new RegExp("[" + WORD_CHAR + "]").test(c);
    }
    function isWholeWord(text, start, end) {
        return isWordBoundary(text, start - 0) && isWordBoundary(text, end);
    }
    // Achtung: isWordBoundary prüft ZEICHEN – für Grenzen brauchen wir das
    // Zeichen VOR start und AB end. Kleiner Fix:
    function isWholeWord(text, start, end) {
        function boundary(pos) {
            if (pos < 0 || pos >= text.length) return true;
            return !new RegExp("[" + WORD_CHAR + "]").test(text.charAt(pos));
        }
        return boundary(start - 1) && boundary(end);
    }

    /* ================================================================== *
     *  4. Wortlisten-Parser (JSON)
     *     Rückgabe: { entries: [...], errors: [...] }
     *     Ein Eintrag: { term, variants[], language, subentry, sortKey,
     *                    ignoreNiqqud, caseSensitive, enabled, crossRefs[] }
     * ================================================================== */

    function parseWordlistJson(content) {
        var raw;
        try { raw = eval("(" + content + ")"); }
        catch (e) { return { entries: [], errors: ["Ungültiges JSON: " + e.message] }; }
        if (!isArray(raw) && isArray(raw.entries)) raw = raw.entries;
        if (!isArray(raw)) return { entries: [], errors: ["Wortliste ist kein Array."] };

        var out = { entries: [], errors: [] };
        for (var i = 0; i < raw.length; i++) {
            var r = raw[i];
            if (!r || !r.term) {
                out.errors.push("Eintrag " + i + ": Feld 'term' fehlt.");
                continue;
            }
            out.entries.push(normalizeEntry({
                term: r.term, variants: r.variants, language: r.language,
                subentry: r.subentry, sortKey: r.sortKey, category: r.category,
                ignoreNiqqud: r.ignoreNiqqud, caseSensitive: r.caseSensitive,
                enabled: r.enabled, crossRefs: r.crossRefs
            }));
        }
        return out;
    }

    // Einzelnen Eintrag defaults-zuweisen
    function normalizeEntry(r) {
        return {
            term: String(r.term),
            variants: isArray(r.variants) ? r.variants.slice() : [],
            language: r.language || "",
            subentry: r.subentry || "",
            sortKey: r.sortKey || "",
            category: r.category || "",
            ignoreNiqqud: r.ignoreNiqqud !== false,
            caseSensitive: !!r.caseSensitive,
            enabled: r.enabled !== false,
            foldHistorical: !!r.foldHistorical,
            foldUmlauts: !!r.foldUmlauts,
            isRegex: !!r.isRegex,
            flags: r.flags || "",
            indexAs: r.indexAs || "",
            crossRefs: isArray(r.crossRefs) ? r.crossRefs.slice() : []
        };
    }

    // Kombiniert Eintrags-Optionen mit globalen Optionen (globale gewinnen bei true)
    function effectiveOpts(entry, globals) {
        globals = globals || {};
        return {
            matchMode: entry.matchMode,
            ignoreNiqqud: entry.ignoreNiqqud,
            caseSensitive: entry.caseSensitive,
            foldUmlauts: entry.foldUmlauts || globals.foldUmlauts,
            foldHistorical: entry.foldHistorical || globals.foldHistorical
        };
    }

    // "ja"/"nein"/"true"/"false"/"1"/"0"/"x"/"" → bool oder undefined
    function parseBool(s) {
        if (s == null) return undefined;
        var v = trim(String(s)).toLowerCase();
        if (v === "") return undefined;
        if (v === "1" || v === "true" || v === "ja" || v === "yes" || v === "x") return true;
        if (v === "0" || v === "false" || v === "nein" || v === "no") return false;
        return undefined;
    }

    function splitCsvLine(line, delim) {
        var out = []; var buf = ""; var inQuote = false;
        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);
            if (inQuote) {
                if (c === '"') {
                    if (i + 1 < line.length && line.charAt(i + 1) === '"') { buf += '"'; i++; }
                    else inQuote = false;
                } else buf += c;
            } else {
                if (c === '"') inQuote = true;
                else if (c === delim) { out.push(buf); buf = ""; }
                else buf += c;
            }
        }
        out.push(buf);
        return out;
    }

    function detectDelimiter(headerLine) {
        // Präferenz: ; (Excel-DE), , (Excel-EN/Sheets), \t
        var candidates = [";", ",", "\t"];
        var best = ";", bestCount = 0;
        for (var i = 0; i < candidates.length; i++) {
            var d = candidates[i];
            var parts = splitCsvLine(headerLine, d);
            if (parts.length > bestCount) { best = d; bestCount = parts.length; }
        }
        return best;
    }

    // CSV-Parser: erste Zeile = Header, muss mindestens 'term' enthalten
    // Bekannte Spalten (Kleinbuchstaben, egal in welcher Reihenfolge):
    //   term, variants, language, subentry, sortkey, category,
    //   ignoreniqqud, casesensitive, enabled, see, seealso
    // Varianten werden mit '|' getrennt.
    function parseWordlistCsv(content) {
        var text = String(content).replace(/\r\n?/g, "\n");
        var lines = [];
        var raw = text.split("\n");
        for (var i = 0; i < raw.length; i++) {
            var line = raw[i];
            var t = trim(line);
            if (t.length === 0) continue;
            if (t.charAt(0) === "#") continue;   // Kommentar-Zeile
            lines.push(line);
        }
        if (lines.length === 0) return { entries: [], errors: ["CSV ist leer."] };
        var delim = detectDelimiter(lines[0]);
        var header = splitCsvLine(lines[0], delim);
        var idx = {};
        for (var h = 0; h < header.length; h++) idx[trim(header[h]).toLowerCase()] = h;
        if (idx.term == null && idx["begriff"] == null) {
            return { entries: [], errors: [
                "CSV-Kopfzeile enthält keine Spalte 'term' (oder 'begriff')." ] };
        }
        var termCol = idx.term != null ? idx.term : idx["begriff"];

        function cell(row, name) {
            var i = idx[name];
            return (i != null && i < row.length) ? trim(row[i]) : "";
        }
        function crossRef(row, name, type) {
            var v = cell(row, name);
            if (!v) return [];
            var parts = v.split("|");
            var out = [];
            for (var p = 0; p < parts.length; p++) {
                var t = trim(parts[p]); if (t) out.push({ type: type, target: t });
            }
            return out;
        }

        var out = { entries: [], errors: [] };
        for (var r = 1; r < lines.length; r++) {
            var row = splitCsvLine(lines[r], delim);
            var term = trim((termCol < row.length ? row[termCol] : "") || "");
            if (!term) { out.errors.push("Zeile " + (r + 1) + ": leerer 'term'."); continue; }

            var variantsRaw = cell(row, "variants");
            var variants = [];
            if (variantsRaw) {
                var vs = variantsRaw.split("|");
                for (var v = 0; v < vs.length; v++) if (trim(vs[v])) variants.push(trim(vs[v]));
            }
            var xrefs = crossRef(row, "see", "see").concat(crossRef(row, "seealso", "seeAlso"));

            out.entries.push(normalizeEntry({
                term: term, variants: variants,
                language: cell(row, "language"),
                subentry: cell(row, "subentry"),
                sortKey: cell(row, "sortkey"),
                category: cell(row, "category"),
                ignoreNiqqud: parseBool(cell(row, "ignoreniqqud")),
                caseSensitive: parseBool(cell(row, "casesensitive")),
                enabled: parseBool(cell(row, "enabled")),
                isRegex: parseBool(cell(row, "isregex")),
                flags: cell(row, "flags"),
                indexAs: cell(row, "indexas"),
                crossRefs: xrefs
            }));
        }
        return out;
    }

    // Einfache TXT-Wortliste: eine Zeile pro Begriff, Kommentare mit #
    //   Format:   term = variant1 | variant2 | ...
    //   Oder:     term > untereintrag
    //   Oder nur: term
    function parseWordlistTxt(content) {
        var text = String(content).replace(/\r\n?/g, "\n");
        var lines = text.split("\n");
        var out = { entries: [], errors: [] };
        for (var i = 0; i < lines.length; i++) {
            var s = trim(lines[i]);
            if (!s || s.charAt(0) === "#") continue;
            var subentry = "";
            var gt = s.indexOf(">");
            if (gt >= 0) { subentry = trim(s.substring(gt + 1)); s = trim(s.substring(0, gt)); }
            var eq = s.indexOf("=");
            var term, variants = [];
            if (eq >= 0) {
                term = trim(s.substring(0, eq));
                var right = trim(s.substring(eq + 1));
                var parts = right.split("|");
                for (var p = 0; p < parts.length; p++) if (trim(parts[p])) variants.push(trim(parts[p]));
            } else {
                term = s;
            }
            if (!term) { out.errors.push("Zeile " + (i + 1) + ": leer."); continue; }
            out.entries.push(normalizeEntry({
                term: term, variants: variants, subentry: subentry
            }));
        }
        return out;
    }

    // Dispatcher – Format aus Dateiendung ableiten
    function parseWordlist(content, ext) {
        var e = (ext || "").toLowerCase();
        if (e === "json") return parseWordlistJson(content);
        if (e === "csv" || e === "tsv") return parseWordlistCsv(content);
        if (e === "txt")  return parseWordlistTxt(content);
        // Auto: mit '{' oder '[' anfangend → JSON
        var trimmed = trim(String(content));
        if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") return parseWordlistJson(content);
        // Header mit ; oder , oder \t und Wort "term"/"begriff" → CSV
        var firstLine = String(content).split(/\r?\n/)[0].toLowerCase();
        if (/term|begriff/.test(firstLine) && /[;,\t]/.test(firstLine)) return parseWordlistCsv(content);
        return parseWordlistTxt(content);
    }

    /* ================================================================== *
     *  5. Datei-I/O (ExtendScript File-API)
     * ================================================================== */

    function readTextFile(file, encoding) {
        file.encoding = encoding || "UTF-8";
        if (!file.open("r")) throw new Error("Datei nicht lesbar: " + file.fsName);
        var c;
        try { c = file.read(); } finally { file.close(); }
        // BOM entfernen
        if (c && c.charCodeAt(0) === 0xFEFF) c = c.substring(1);
        return c;
    }
    function writeTextFile(file, content, encoding) {
        file.encoding = encoding || "UTF-8";
        if (!file.open("w")) throw new Error("Datei nicht schreibbar: " + file.fsName);
        try { file.write(content); } finally { file.close(); }
    }

    function pickReadFile(prompt, filter) {
        var f = File.openDialog(prompt, filter, false);
        return f ? f : null;
    }
    function pickSaveFile(prompt, suggestedName, filter) {
        var f = File.saveDialog(prompt, filter);
        return f ? f : null;
    }

    /* ================================================================== *
     *  6. Dokument-Reader
     *     Baut ein plattes Corpus: Array von Absätzen, jeder mit
     *     { storyId, storySource, storyIndex, paraIndex, text,
     *       paragraphStyle, page }
     *     Fußnoten und Tabellen als eigene Pseudo-Stories.
     * ================================================================== */

    function readActiveDocument(options) {
        options = options || {};
        if (app.documents.length === 0) throw new Error("Kein Dokument geöffnet.");
        var doc = app.activeDocument;
        var corpus = { docName: doc.name, paragraphs: [], warnings: [],
                       reverseHebrew: !!options.reverseHebrew };
        var stories = doc.stories.everyItem().getElements();
        var storyIndex = 0;

        for (var s = 0; s < stories.length; s++) {
            var story = stories[s];
            try {
                readStoryInto(corpus, story, storyIndex++, "body", options);
                if (options.includeFootnotes !== false) {
                    var fns = story.footnotes.everyItem().getElements();
                    for (var f = 0; f < fns.length; f++) {
                        try { readFootnoteInto(corpus, fns[f], storyIndex++, s, options); }
                        catch (e) { corpus.warnings.push("Fußnote " + f + " Story " + s + ": " + e.message); }
                    }
                }
                if (options.includeTables !== false) {
                    var tables = story.tables.everyItem().getElements();
                    for (var t = 0; t < tables.length; t++) {
                        try { readTableInto(corpus, tables[t], storyIndex++, s, options); }
                        catch (e) { corpus.warnings.push("Tabelle " + t + " Story " + s + ": " + e.message); }
                    }
                }
            } catch (e) {
                corpus.warnings.push("Story " + s + " nicht gelesen: " + e.message);
            }
        }
        return corpus;
    }

    function readStoryInto(corpus, story, storyIndex, source, options) {
        var storyId = String(story.id);
        var paras   = story.paragraphs.everyItem().getElements();
        var texts   = story.paragraphs.everyItem().contents;
        var styles  = story.paragraphs.everyItem().appliedParagraphStyle;
        var progress = options && options.progress;
        var storyOffset = 0;
        var reverseHe = options && options.reverseHebrew;

        for (var p = 0; p < paras.length; p++) {
            var raw = (texts && texts[p] != null) ? String(texts[p]) : "";
            var text = raw.replace(/[\r\n]+$/, "");
            var rawLen = raw.length;

            if (text.length > 0) {
                // CS6-Kompatibilität: hebräische Runs spiegeln, damit Text intern
                // logisch geordnet ist. Länge und Zeichen-Positionen bleiben gleich.
                if (reverseHe) text = reverseHebrewRuns(text);

                var page = null;
                try {
                    var frames = paras[p].parentTextFrames;
                    if (frames && frames.length > 0 && frames[0].parentPage) {
                        page = frames[0].parentPage.name;
                    }
                } catch (e) { }

                var pStyle = "";
                try {
                    if (styles && styles[p]) {
                        pStyle = (typeof styles[p] === "string") ? styles[p] : styles[p].name;
                    }
                } catch (e) { }

                corpus.paragraphs.push({
                    storyId: storyId,
                    storySource: source,
                    storyIndex: storyIndex,
                    paraIndex: p,
                    text: text,
                    paragraphStyle: pStyle,
                    page: page,
                    storyOffset: storyOffset,
                    canWriteNative: source === "body"
                });
                if (progress && (p & 63) === 63) progress();
            }
            storyOffset += rawLen;
        }
    }

    function readFootnoteInto(corpus, footnote, storyIndex, parentIdx, options) {
        var reverseHe = options && options.reverseHebrew;
        var page = null;
        try {
            var anchor = footnote.storyOffset;
            if (anchor && anchor.parentTextFrames && anchor.parentTextFrames.length > 0) {
                var pg = anchor.parentTextFrames[0].parentPage;
                if (pg) page = pg.name;
            }
        } catch (e) { }
        var paras = footnote.paragraphs.everyItem().getElements();
        var texts = footnote.paragraphs.everyItem().contents;
        for (var p = 0; p < paras.length; p++) {
            var raw = (texts && texts[p] != null) ? String(texts[p]) : "";
            var text = raw.replace(/[\r\n]+$/, "");
            if (text.length === 0) continue;
            if (reverseHe) text = reverseHebrewRuns(text);
            corpus.paragraphs.push({
                storyId: "fn_" + storyIndex,
                storySource: "footnote",
                storyIndex: storyIndex,
                paraIndex: p,
                text: text,
                paragraphStyle: "",
                page: page
            });
        }
    }

    function readTableInto(corpus, table, storyIndex, parentIdx, options) {
        var reverseHe = options && options.reverseHebrew;
        var page = null;
        try {
            var anchor = table.storyOffset;
            if (anchor && anchor.parentTextFrames && anchor.parentTextFrames.length > 0) {
                var pg = anchor.parentTextFrames[0].parentPage;
                if (pg) page = pg.name;
            }
        } catch (e) { }
        var cells = table.cells.everyItem().getElements();
        for (var c = 0; c < cells.length; c++) {
            var raw = "";
            try { raw = String(cells[c].contents); } catch (e) { }
            var text = raw.replace(/[\r\n]+$/, "");
            if (trim(text).length === 0) continue;
            if (reverseHe) text = reverseHebrewRuns(text);
            corpus.paragraphs.push({
                storyId: "tb_" + storyIndex,
                storySource: "table",
                storyIndex: storyIndex,
                paraIndex: c,
                text: text,
                paragraphStyle: "",
                page: page
            });
        }
    }

    /* ================================================================== *
     *  7. Wortlisten-Matcher
     *     Vorgehen:
     *      - Für jeden Eintrag alle Vergleichsformen (term + variants) bauen,
     *        Compare-Keys je Form berechnen.
     *      - Pro Absatz Tokens holen, jedes Token gegen alle Single-Token-Einträge
     *        vergleichen; Phrasen per Fensterscan (bis 12 Tokens).
     *     Rückgabe: Trefferliste
     * ================================================================== */

    /**
     * Baut eine effiziente Lookup-Struktur: Einträge werden nach ihrer
     * Options-Signatur (matchMode, ignoreNiqqud, caseSensitive, foldUmlauts,
     * foldHistorical) gruppiert. Innerhalb jeder Gruppe gibt es einen
     * invertierten Index für Single-Token-Formen (Hash-Lookup O(1)) und einen
     * ebenfalls nach erstem Token indexierten Speicher für Phrasen.
     * Das bringt den Match-Aufwand von O(Absätze × Einträge) auf ~O(Absätze).
     */
    function buildLookup(entries, globals) {
        var groupsMap = {};
        var regex = [];

        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e.enabled) continue;

            if (e.isRegex) {
                var patterns = [e.term].concat(e.variants || []);
                var compiled = [];
                for (var pi = 0; pi < patterns.length; pi++) {
                    var pat = trim(patterns[pi]); if (!pat) continue;
                    var flags = e.flags || (e.caseSensitive ? "g" : "gi");
                    if (flags.indexOf("g") === -1) flags += "g";
                    try { compiled.push(new RegExp(pat, flags)); }
                    catch (re) { logWarn("Ungültiger RegEx: /" + pat + "/" + flags + " – " + re.message); }
                }
                if (compiled.length) regex.push({ entry: e, patterns: compiled });
                continue;
            }

            var opts = effectiveOpts(e, globals);
            var sigKey = (opts.matchMode || "normalized") + "|" +
                         (opts.ignoreNiqqud !== false ? "1" : "0") + "|" +
                         (opts.caseSensitive ? "1" : "0") + "|" +
                         (opts.foldUmlauts ? "1" : "0") + "|" +
                         (opts.foldHistorical ? "1" : "0");
            var group = groupsMap[sigKey];
            if (!group) {
                group = groupsMap[sigKey] = {
                    opts: opts,
                    single: {},   // key → [entry, entry, …]  (Hash-Lookup)
                    phraseByFirst: {}, // firstKey → [{ tokenKeys, entry, length }, …]
                    phraseCount: 0
                };
            }

            var forms = [e.term].concat(e.variants || []);
            for (var j = 0; j < forms.length; j++) {
                var f = trim(forms[j]); if (!f) continue;
                var tokens = tokenize(f);
                if (tokens.length === 0) continue;

                if (tokens.length === 1) {
                    var key = makeCompareKey(f, opts);
                    if (!key) continue;
                    if (!group.single[key]) group.single[key] = [];
                    // Duplikat vermeiden: nicht denselben Eintrag zweimal
                    // (falls sich Term und eine Variante nach Normalisierung gleichen)
                    var arr = group.single[key];
                    var dup = false;
                    for (var m = 0; m < arr.length; m++) if (arr[m] === e) { dup = true; break; }
                    if (!dup) arr.push(e);
                } else if (tokens.length <= 12) {
                    var tokenKeys = mapTokens(tokens, opts);
                    var first = tokenKeys[0];
                    if (!group.phraseByFirst[first]) group.phraseByFirst[first] = [];
                    group.phraseByFirst[first].push({
                        tokenKeys: tokenKeys,
                        entry: e,
                        length: tokens.length
                    });
                    group.phraseCount++;
                }
            }
        }

        var groups = [];
        var totalSingle = 0;
        for (var k in groupsMap) if (groupsMap.hasOwnProperty(k)) {
            var g = groupsMap[k];
            groups.push(g);
            for (var sk in g.single) if (g.single.hasOwnProperty(sk)) totalSingle++;
        }
        logInfo("Lookup: " + groups.length + " Signatur-Gruppen, " + totalSingle +
                " Single-Token-Formen, " + regex.length + " RegEx-Regeln.");
        return { groups: groups, regex: regex };
    }

    function mapTokens(tokens, opts) {
        var out = [];
        for (var i = 0; i < tokens.length; i++) out.push(makeCompareKey(tokens[i].text, opts));
        return out;
    }

    function findMatches(corpus, prepped, progress, formatFilter) {
        var matches = [];
        var skippedByFilter = 0;
        var groups = prepped.groups || [];
        var regex = prepped.regex || [];
        var groupsN = groups.length;

        for (var pi = 0; pi < corpus.paragraphs.length; pi++) {
            var cp = corpus.paragraphs[pi];
            if (formatFilter && cp.paragraphStyle && formatFilter[cp.paragraphStyle.toLowerCase()]) {
                skippedByFilter++;
                continue;
            }
            var text = cp.text;
            var toks = tokenize(text);
            var toksN = toks.length;

            if (toksN) {
                for (var gi = 0; gi < groupsN; gi++) {
                    var g = groups[gi];
                    var opts = g.opts;
                    // Compare-Keys für diesen Absatz EINMAL berechnen (pro Signatur)
                    var tokKeys = mapTokens(toks, opts);

                    // Single-Token: O(1) Hash-Lookup pro Token
                    var single = g.single;
                    for (var ti = 0; ti < toksN; ti++) {
                        var hits = single[tokKeys[ti]];
                        if (hits) {
                            var tok = toks[ti];
                            if (isWholeWord(text, tok.start, tok.end)) {
                                for (var hi = 0; hi < hits.length; hi++) {
                                    matches.push(makeMatch(cp, tok.start, tok.end, hits[hi], "wordlist"));
                                }
                            }
                        }
                    }

                    // Phrasen: nur Fenster verfolgen, deren erstes Token
                    // Anfangswort einer bekannten Phrase ist.
                    if (g.phraseCount > 0) {
                        var pbf = g.phraseByFirst;
                        for (var wi = 0; wi < toksN; wi++) {
                            var starts = pbf[tokKeys[wi]];
                            if (!starts) continue;
                            for (var sp = 0; sp < starts.length; sp++) {
                                var phrase = starts[sp];
                                var n = phrase.length;
                                if (wi + n > toksN) continue;
                                var ok = true;
                                var tks = phrase.tokenKeys;
                                for (var kk = 1; kk < n; kk++) {
                                    if (tokKeys[wi + kk] !== tks[kk]) { ok = false; break; }
                                }
                                if (ok) {
                                    matches.push(makeMatch(cp,
                                        toks[wi].start, toks[wi + n - 1].end, phrase.entry, "wordlist"));
                                }
                            }
                        }
                    }
                }
            }

            /* ---- RegEx-Match ---- */
            for (var ri = 0; ri < regex.length; ri++) {
                var rr = regex[ri];
                var rentry = rr.entry;
                for (var pi2 = 0; pi2 < rr.patterns.length; pi2++) {
                    var pat = rr.patterns[pi2];
                    pat.lastIndex = 0;
                    var mm; var guard = 0;
                    while ((mm = pat.exec(text)) !== null) {
                        if (guard++ > 5000) break;
                        var mStart = mm.index;
                        var mEnd = mm.index + mm[0].length;
                        if (mEnd === mStart) { pat.lastIndex++; continue; }
                        var effEntry = {
                            term: rentry.indexAs || mm[0],
                            subentry: rentry.indexAs ? mm[0] : (rentry.subentry || ""),
                            language: rentry.language,
                            sortKey: rentry.sortKey,
                            category: rentry.category,
                            crossRefs: rentry.crossRefs
                        };
                        matches.push(makeMatch(cp, mStart, mEnd, effEntry, "regex"));
                    }
                }
            }

            // Progress häufiger aufrufen: alle 16 Absätze (statt 64) – Fortschrittsbalken
            // bleibt reaktiv, damit der Nutzer sieht dass das Skript nicht hängt.
            if (progress && (pi & 15) === 15) progress(pi, corpus.paragraphs.length, matches.length);
        }
        matches._skippedByFilter = skippedByFilter;
        return matches;
    }

    function makeMatch(cp, start, end, entry, source) {
        var matched = cp.text.substring(start, end);
        var ctxBefore = cp.text.substring(Math.max(0, start - 30), start);
        var ctxAfter  = cp.text.substring(end, Math.min(cp.text.length, end + 30));
        var sc = detectScript(matched);
        var lang = entry.language || guessLanguage(matched, "de");
        return {
            term: entry.term,
            subentry: entry.subentry || "",
            language: lang,
            script: sc,
            matchedText: matched,
            contextBefore: ctxBefore,
            contextAfter: ctxAfter,
            storyId: cp.storyId,
            storySource: cp.storySource,
            paragraphIndex: cp.paraIndex,
            charStart: start,
            charEnd: end,
            storyCharStart: (cp.storyOffset || 0) + start,
            storyCharEnd:   (cp.storyOffset || 0) + end,
            canWriteNative: !!cp.canWriteNative,
            page: cp.page,
            paragraphStyle: cp.paragraphStyle,
            sortKey: entry.sortKey || "",
            category: entry.category || "",
            crossRefs: entry.crossRefs || [],
            sourceType: source
        };
    }

    /* ================================================================== *
     *  8. Merger – Treffer zu Occurrences zusammenführen
     * ================================================================== */

    function mergeMatches(matches) {
        var groups = {};
        var seenPositions = {};

        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            var posKey = m.storyId + ":" + m.paragraphIndex + ":" + m.charStart + ":" + m.charEnd;
            if (seenPositions[posKey]) continue;
            seenPositions[posKey] = true;

            var key = toNFC(m.term) + "\x00" + toNFC(m.subentry) + "\x00" + m.language;
            var g = groups[key];
            if (!g) {
                g = groups[key] = {
                    term: m.term, subentry: m.subentry, language: m.language,
                    script: m.script, sortKey: m.sortKey, category: m.category,
                    crossRefs: [], pages: [], pagesSeen: {}, count: 0,
                    firstMatchPerPage: {}  // page → match (für native Writer)
                };
                for (var x = 0; x < (m.crossRefs || []).length; x++) {
                    var xr = m.crossRefs[x];
                    if (xr && xr.target) g.crossRefs.push({ type: xr.type || "see", target: xr.target });
                }
            }
            g.count++;
            if (m.page != null) {
                if (!g.pagesSeen[m.page]) {
                    g.pagesSeen[m.page] = true;
                    g.pages.push(m.page);
                    g.firstMatchPerPage[m.page] = m;
                } else if (m.canWriteNative && g.firstMatchPerPage[m.page] &&
                           !g.firstMatchPerPage[m.page].canWriteNative) {
                    // Body-Referenz schlägt bereits gespeicherte Fußnoten-Ref
                    g.firstMatchPerPage[m.page] = m;
                }
            }
        }
        var out = [];
        for (var k in groups) if (groups.hasOwnProperty(k)) out.push(groups[k]);
        return out;
    }

    /* ================================================================== *
     *  9. Index-Generator: Sortierung + Seitenbereiche + Gruppen
     * ================================================================== */

    function pageToNum(p) {
        var n = parseInt(String(p), 10);
        return isNaN(n) ? null : n;
    }
    function sortPages(pages) {
        var num = [], txt = [];
        for (var i = 0; i < pages.length; i++) {
            var n = pageToNum(pages[i]);
            if (n === null) txt.push(String(pages[i])); else num.push(n);
        }
        num.sort(function (a, b) { return a - b; });
        txt.sort();
        var out = [];
        for (var j = 0; j < num.length; j++) out.push(String(num[j]));
        for (var j2 = 0; j2 < txt.length; j2++) out.push(txt[j2]);
        return out;
    }
    function formatPageRanges(pages, minRun, sep) {
        minRun = minRun || 3; sep = sep || ", ";
        if (!pages.length) return "";
        var sorted = sortPages(pages);
        var out = []; var i = 0;
        while (i < sorted.length) {
            var startN = pageToNum(sorted[i]);
            if (startN === null) { out.push(sorted[i]); i++; continue; }
            var j = i;
            while (j + 1 < sorted.length) {
                var nextN = pageToNum(sorted[j + 1]);
                if (nextN === null || nextN !== pageToNum(sorted[j]) + 1) break;
                j++;
            }
            var runLen = j - i + 1;
            if (runLen >= minRun) {
                out.push(sorted[i] + "\u2013" + sorted[j]);
                i = j + 1;
            } else {
                for (var k = i; k <= j; k++) out.push(sorted[k]);
                i = j + 1;
            }
        }
        return out.join(sep);
    }

    // Hebräischer Alef-Bet-Rank (ohne Endformen und Niqqud)
    function hebrewRank(ch) {
        var code = ch.charCodeAt(0);
        // Endformen auf Grundform mappen
        var FINAL_MAP = { 0x05DA: 0x05DB, 0x05DD: 0x05DE, 0x05DF: 0x05E0,
                          0x05E3: 0x05E4, 0x05E5: 0x05E6 };
        if (FINAL_MAP[code]) code = FINAL_MAP[code];
        if (code >= 0x05D0 && code <= 0x05EA) return code - 0x05D0 + 100;
        return 999;
    }

    function compareEntries(a, b) {
        var sa = a.sortKey || a.term;
        var sb = b.sortKey || b.term;
        var scA = detectScript(sa), scB = detectScript(sb);

        // Hebräisch immer in eigenen Block (nach Latein per Default)
        if (scA === "hebrew" && scB !== "hebrew") return 1;
        if (scB === "hebrew" && scA !== "hebrew") return -1;

        if (scA === "hebrew") {
            var na = stripHebrewMarks(sa), nb = stripHebrewMarks(sb);
            for (var i = 0; i < Math.min(na.length, nb.length); i++) {
                var ra = hebrewRank(na.charAt(i)), rb = hebrewRank(nb.charAt(i));
                if (ra !== rb) return ra - rb;
            }
            return na.length - nb.length;
        }
        // Latein: DIN 5007-1 (Ä = A, Ö = O, Ü = U, ß = ss), case-insensitiv
        var xa = foldGermanUmlauts(sa).toLowerCase();
        var xb = foldGermanUmlauts(sb).toLowerCase();
        if (xa < xb) return -1;
        if (xa > xb) return 1;
        return 0;
    }

    function groupHeading(term) {
        var s = term;
        var sc = detectScript(s);
        if (sc === "hebrew") return stripHebrewMarks(s.charAt(0));
        var c = foldGermanUmlauts(s).charAt(0).toUpperCase();
        if (/[0-9]/.test(c)) return "0\u20139";
        if (/[A-Z]/.test(c)) return c;
        return "#";
    }

    function generateIndex(occurrences, options) {
        options = options || {};
        var rangeMinRun = options.rangeMinRun || 3;
        var noPageLabel = options.noPageLabel || "o.\u00A0S.";
        var hebrewFirst = !!options.hebrewFirst;
        var labels = options.sectionLabels || {
            latin:  "Namen und Begriffe",
            hebrew: "Hebräische Wörter",
            other:  "Weitere"
        };

        // 1) Untereinträge in Haupteinträge einsortieren
        var mainMap = {};
        for (var i = 0; i < occurrences.length; i++) {
            var o = occurrences[i];
            var mkey = toNFC(o.term) + "\x00" + o.language;
            var main = mainMap[mkey];
            if (!main) {
                main = mainMap[mkey] = {
                    term: o.term, language: o.language, script: o.script,
                    sortKey: "", pages: [], pagesSeen: {},
                    crossRefs: [], subs: {},
                    firstMatchPerPage: {}
                };
            }
            if (o.sortKey && !main.sortKey) main.sortKey = o.sortKey;
            for (var x = 0; x < (o.crossRefs || []).length; x++) {
                var xr = o.crossRefs[x];
                var dup = false;
                for (var y = 0; y < main.crossRefs.length; y++) {
                    if (main.crossRefs[y].type === xr.type && main.crossRefs[y].target === xr.target) dup = true;
                }
                if (!dup) main.crossRefs.push({ type: xr.type || "see", target: xr.target });
            }

            var target = main;
            if (o.subentry) {
                var sub = main.subs[o.subentry];
                if (!sub) {
                    sub = main.subs[o.subentry] = {
                        term: o.subentry, language: o.language,
                        sortKey: "", pages: [], pagesSeen: {},
                        firstMatchPerPage: {}
                    };
                }
                target = sub;
            }
            for (var p = 0; p < o.pages.length; p++) {
                var pg = o.pages[p];
                if (!target.pagesSeen[pg]) {
                    target.pagesSeen[pg] = true;
                    target.pages.push(pg);
                    if (o.firstMatchPerPage && o.firstMatchPerPage[pg]) {
                        target.firstMatchPerPage[pg] = o.firstMatchPerPage[pg];
                    }
                }
                if (target !== main && !main.pagesSeen[pg]) {
                    main.pagesSeen[pg] = true; main.pages.push(pg);
                    if (o.firstMatchPerPage && o.firstMatchPerPage[pg]) {
                        main.firstMatchPerPage[pg] = o.firstMatchPerPage[pg];
                    }
                }
            }
        }

        // 2) Cross-Ref-Validierung
        var existingTerms = {};
        for (var mk in mainMap) if (mainMap.hasOwnProperty(mk)) existingTerms[mainMap[mk].term] = true;
        var warnings = [];

        // 3) In Array + Sortierung
        var entries = [];
        for (var mk2 in mainMap) if (mainMap.hasOwnProperty(mk2)) {
            var m = mainMap[mk2];
            var subs = [];
            for (var sk in m.subs) if (m.subs.hasOwnProperty(sk)) {
                var sb = m.subs[sk];
                subs.push({
                    term: sb.term, language: sb.language,
                    pages: formatPageRanges(sb.pages, rangeMinRun, ", ") || noPageLabel,
                    pageList: sortPages(sb.pages),
                    firstMatchPerPage: sb.firstMatchPerPage
                });
            }
            subs.sort(compareEntries);
            // Cross-Refs prüfen
            for (var ci = 0; ci < m.crossRefs.length; ci++) {
                var xr2 = m.crossRefs[ci];
                if (!existingTerms[xr2.target]) {
                    xr2.unresolved = true;
                    warnings.push("Querverweis-Ziel fehlt: '" + m.term + "' \u2192 '" + xr2.target + "'");
                }
            }
            entries.push({
                term: m.term, language: m.language, script: m.script,
                sortKey: m.sortKey,
                pages: m.pages.length ? formatPageRanges(m.pages, rangeMinRun, ", ") : noPageLabel,
                pageList: sortPages(m.pages),
                firstMatchPerPage: m.firstMatchPerPage,
                crossRefs: m.crossRefs,
                subentries: subs
            });
        }

        // 4) In Sektionen nach Skript trennen
        var buckets = { latin: [], hebrew: [], other: [] };
        for (var e = 0; e < entries.length; e++) {
            var sc = detectScript(entries[e].sortKey || entries[e].term);
            if (sc === "hebrew") buckets.hebrew.push(entries[e]);
            else if (sc === "latin" || sc === "mixed") buckets.latin.push(entries[e]);
            else buckets.other.push(entries[e]);
        }

        // SCRIPT_MODE: dieses Skript verarbeitet nur eine Schrift. Die
        // jeweils andere uebernimmt das Schwester-Skript (eigener Lauf).
        var filteredOut = 0;
        if (SCRIPT_MODE === "hebrew") {
            filteredOut = buckets.latin.length + buckets.other.length;
            buckets.latin = []; buckets.other = [];
        } else {
            filteredOut = buckets.hebrew.length;
            buckets.hebrew = [];
        }
        var keptCount = buckets.latin.length + buckets.hebrew.length + buckets.other.length;

        function buildSection(script, list, label) {
            if (!list.length) return null;
            list.sort(compareEntries);
            var groups = [];
            var current = null;
            for (var i = 0; i < list.length; i++) {
                var h = groupHeading(list[i].sortKey || list[i].term);
                if (!current || current.heading !== h) {
                    current = { heading: h, entries: [] };
                    groups.push(current);
                }
                current.entries.push(list[i]);
            }
            return { script: script, label: label, groups: groups, count: list.length };
        }

        var sections = [];
        var latSec = buildSection("latin",  buckets.latin,  labels.latin);
        var hebSec = buildSection("hebrew", buckets.hebrew, labels.hebrew);
        var othSec = buildSection("other",  buckets.other,  labels.other);
        if (hebrewFirst) {
            if (hebSec) sections.push(hebSec);
            if (latSec) sections.push(latSec);
        } else {
            if (latSec) sections.push(latSec);
            if (hebSec) sections.push(hebSec);
        }
        if (othSec) sections.push(othSec);

        var totalSubs = 0;
        for (var i2 = 0; i2 < entries.length; i2++) totalSubs += entries[i2].subentries.length;

        return {
            generatedAt: new Date().toString(),
            stats: {
                entries: keptCount,
                filteredOut: filteredOut,
                subentries: totalSubs,
                sections: sections.length,
                sectionCounts: (function () {
                    var c = {}; for (var i = 0; i < sections.length; i++) c[sections[i].script] = sections[i].count; return c;
                })()
            },
            sections: sections,
            warnings: warnings
        };
    }

    /* ================================================================== *
     * 10. Export – JSON + HTML
     * ================================================================== */

    function escHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function toJSON(indexModel, meta) {
        function ser(e) {
            return {
                term: e.term, language: e.language, sortKey: e.sortKey,
                pages: e.pages, crossRefs: e.crossRefs || [],
                subentries: (function () {
                    var a = []; for (var i = 0; i < e.subentries.length; i++) {
                        a.push({ term: e.subentries[i].term, pages: e.subentries[i].pages });
                    } return a;
                })()
            };
        }
        var out = {
            format: "IndexBuilderJSX/index", version: 2,
            meta: meta || {},
            generatedAt: indexModel.generatedAt,
            stats: indexModel.stats,
            warnings: indexModel.warnings,
            sections: (function () {
                var a = [];
                for (var i = 0; i < indexModel.sections.length; i++) {
                    var sec = indexModel.sections[i]; var gs = [];
                    for (var j = 0; j < sec.groups.length; j++) {
                        var g = sec.groups[j]; var es = [];
                        for (var k = 0; k < g.entries.length; k++) es.push(ser(g.entries[k]));
                        gs.push({ heading: g.heading, entries: es });
                    }
                    a.push({ script: sec.script, label: sec.label, count: sec.count, groups: gs });
                }
                return a;
            })()
        };
        return jsonStringify(out, 2);
    }

    // Minimaler JSON-Serialisierer (ExtendScript hat kein JSON.stringify)
    function jsonStringify(v, indent, level) {
        level = level || 0;
        var pad = indent ? repeat(" ", indent * (level + 1)) : "";
        var padOut = indent ? repeat(" ", indent * level) : "";
        var nl = indent ? "\n" : "";

        if (v === null || v === undefined) return "null";
        var t = typeof v;
        if (t === "number") return isFinite(v) ? String(v) : "null";
        if (t === "boolean") return v ? "true" : "false";
        if (t === "string") return jsonString(v);
        if (isArray(v)) {
            if (v.length === 0) return "[]";
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(pad + jsonStringify(v[i], indent, level + 1));
            return "[" + nl + a.join("," + nl) + nl + padOut + "]";
        }
        if (t === "object") {
            var keys = [];
            for (var k in v) if (v.hasOwnProperty(k)) keys.push(k);
            if (!keys.length) return "{}";
            var arr = [];
            for (var m = 0; m < keys.length; m++) {
                arr.push(pad + jsonString(keys[m]) + ": " + jsonStringify(v[keys[m]], indent, level + 1));
            }
            return "{" + nl + arr.join("," + nl) + nl + padOut + "}";
        }
        return "null";
    }
    function jsonString(s) {
        var esc = String(s)
            .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
            .replace(/[\u0000-\u001F]/g, function (c) {
                return "\\u" + padNum(c.charCodeAt(0).toString(16), 4);
            });
        return '"' + esc + '"';
    }

    var XREF = {
        de: { see: "siehe", seeAlso: "siehe auch" },
        en: { see: "see",   seeAlso: "see also" },
        he: { see: "\u05E8\u05D0\u05D4", seeAlso: "\u05E8\u05D0\u05D4 \u05D2\u05DD" }
    };
    function xrefLabel(type, lang) {
        var L = XREF[lang] || XREF.de;
        return L[type] || type;
    }

    function toHTML(indexModel, meta) {
        var title = (meta && meta.title) || "Stichwortverzeichnis";
        var lines = [];
        lines.push('<!DOCTYPE html>');
        lines.push('<html lang="de"><head><meta charset="utf-8">');
        lines.push('<title>' + escHtml(title) + '</title>');
        lines.push('<style>');
        lines.push('body{font-family:Georgia,"Times New Roman",serif;max-width:46em;margin:2em auto;padding:0 1em;line-height:1.5;color:#222}');
        lines.push('h1{font-size:1.5em;border-bottom:1px solid #999;padding-bottom:.3em;margin-bottom:.2em}');
        lines.push('.docname{color:#888;margin:0 0 2em}');
        lines.push('h2.section{font-size:1.2em;margin:2.4em 0 .4em;padding:.4em .6em;background:#f2efe8;border-left:4px solid #a99a70;color:#443b23;letter-spacing:.03em}');
        lines.push('h2.section .count{float:right;font-weight:400;color:#8a7d5b;font-size:.85em}');
        lines.push('section.he h2.section{border-left:none;border-right:4px solid #a99a70;text-align:right;direction:rtl}');
        lines.push('section.he h2.section .count{float:left}');
        lines.push('h3.letter{font-size:1em;margin:1.2em 0 .2em;color:#7a6c46;font-weight:700}');
        lines.push('section.he h3.letter{text-align:right;direction:rtl}');
        lines.push('.entry{display:flex;justify-content:space-between;gap:1em;padding:.15em 0;border-bottom:1px dotted #e5e0d3}');
        lines.push('.entry.sub{padding-left:1.6em;color:#555}');
        lines.push('section.he .entry.sub{padding-left:0;padding-right:1.6em}');
        lines.push('.term{unicode-bidi:plaintext;flex:1 1 auto}');
        lines.push('section.he{direction:rtl}');
        lines.push('section.he .entry{direction:rtl}');
        lines.push('section.he .term{text-align:right}');
        lines.push('.pages{color:#5a4c26;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr;unicode-bidi:isolate}');
        lines.push('.xref{font-style:italic;color:#888;margin:0 .5em}');
        lines.push('.foot{color:#aaa;font-size:.85em;margin-top:3em;border-top:1px solid #eee;padding-top:.6em}');
        lines.push('</style></head><body>');
        lines.push('<h1>' + escHtml(title) + '</h1>');
        if (meta && meta.documentName) {
            lines.push('<p class="docname">' + escHtml(meta.documentName) + '</p>');
        }

        for (var si = 0; si < indexModel.sections.length; si++) {
            var sec = indexModel.sections[si];
            var cls = sec.script === "hebrew" ? "he" : sec.script;
            var langAttr = sec.script === "hebrew" ? ' lang="he"' : '';
            lines.push('<section class="' + cls + '"' + langAttr + '>');
            lines.push('<h2 class="section">' + escHtml(sec.label) +
                '<span class="count">' + sec.count + ' Einträge</span></h2>');
            for (var gi = 0; gi < sec.groups.length; gi++) {
                var grp = sec.groups[gi];
                lines.push('<h3 class="letter">' + escHtml(grp.heading) + '</h3>');
                for (var ei = 0; ei < grp.entries.length; ei++) {
                    var entry = grp.entries[ei];
                    lines.push(entryHtml(entry, false));
                    for (var subi = 0; subi < entry.subentries.length; subi++) {
                        var sub = entry.subentries[subi];
                        sub.language = entry.language; // für xref-Label
                        lines.push(entryHtml(sub, true));
                    }
                }
            }
            lines.push('</section>');
        }

        lines.push('<p class="foot">Erzeugt: ' +
            escHtml(indexModel.generatedAt) + ' &middot; IndexBuilder ' + VERSION + '</p>');
        lines.push('</body></html>');
        return lines.join("\n");
    }
    function entryHtml(e, isSub) {
        var xr = "";
        var refs = e.crossRefs || [];
        for (var i = 0; i < refs.length; i++) {
            xr += '<span class="xref">' + escHtml(xrefLabel(refs[i].type, e.language)) +
                  ' \u2192 ' + escHtml(refs[i].target) + '</span>';
        }
        return '<div class="entry' + (isSub ? ' sub' : '') + '">' +
               '<span class="term">' + escHtml(e.term) + xr + '</span>' +
               '<span class="pages">' + escHtml(e.pages || "") + '</span></div>';
    }

    /* ================================================================== *
     * 11. Absatzformate ermitteln (nach Dokument-Lesen)
     * ================================================================== */

    function collectParagraphStyles(corpus) {
        var map = {};
        var counts = {};
        for (var i = 0; i < corpus.paragraphs.length; i++) {
            var s = corpus.paragraphs[i].paragraphStyle;
            if (!s) continue;
            if (!map[s]) { map[s] = true; counts[s] = 0; }
            counts[s]++;
        }
        var arr = [];
        for (var k in map) if (map.hasOwnProperty(k)) arr.push({ name: k, count: counts[k] });
        arr.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        return arr;
    }

    /* ================================================================== *
     * 11b. Wortlisten-Builder: Kandidaten aus Dokument extrahieren
     * ================================================================== */

    // Grund-Stoppwörter für die drei Sprachen
    var STOPWORDS_DE = (
        // Artikel
        "der die das den dem des ein eine einen einem einer eines " +
        "kein keine keinen keinem keiner keines keins " +
        // Verneinung + Modalpartikeln
        "nicht nichts nie niemals keinerlei nirgends nirgendwo " +
        "ja nein doch wohl vielleicht etwa gar sogar zwar bloß eigentlich überhaupt " +
        "eben halt mal einmal auch nur noch schon bereits erst ebenfalls ebenso " +
        // Persönliche Pronomen
        "ich mich mir mein meine meinen meinem meiner meines meins " +
        "du dich dir dein deine deinen deinem deiner deines deins " +
        "er ihn ihm sein seine seinen seinem seiner seines seins " +
        "sie ihr ihre ihren ihrem ihrer ihres ihrs " +
        "es " +
        "wir uns unser unsere unseren unserem unserer unseres " +
        "euch euer eure euren eurem eurer eures " +
        "ihnen " +
        // Reflexiv, Demonstrativ, Interrogativ, Relativ, Indefinit
        "sich selbst selber " +
        "dieser diese dieses diesem diesen dies " +
        "jener jene jenes jenem jenen " +
        "welcher welche welches welchen welchem wessen wem wen wer was wo warum wieso weshalb wohin woher " +
        "man einem einen jemand niemand jemanden niemanden jemandem niemandem jedermann " +
        "etwas nichts alles alle allen allem aller " +
        "jeder jede jedes jeden jedem jegliche jeglicher jegliches jeglichen jeglichem " +
        "einige einiger einigem einigen einiges " +
        "andere anderer anderes anderem anderen andern andre andres " + // "andern"/"andre" alte Formen
        "mancher manche manches manchen manchem " +
        "viele vieler vielem vielen vieles viel mehreren mehrere mehrerer mehreres mehrerem " +
        "wenige weniger wenigem wenigen weniges wenig " +
        "beide beiden beider beides " +
        "solche solcher solches solchen solchem solch " +
        // Konjunktionen + Konjunktionaladverbien
        "und oder aber sondern doch dennoch jedoch trotzdem allerdings sonst " +
        "wenn falls sofern damit obwohl obgleich obschon während bevor ehe nachdem sobald " +
        "weil da denn indem sodass so als wie ob dass daß dasz " + // "dasz" historisch
        "sowie sowohl weder noch entweder auch außerdem ferner darüber " +
        "zwar gleichwohl demnach mithin folglich nämlich zumal wobei somit deshalb deswegen darum " +
        "dabei dadurch dazu dafür dagegen dahinter darauf daran daraus darin " +
        "darüber darunter davon davor dazwischen hinsichtlich hingegen jedenfalls " +
        // Präpositionen
        "an auf aus bei bis durch für gegen in mit nach ohne seit über um unter vor von zu " +
        "während wegen trotz statt anstatt " +
        "kraft laut gemäß dank ungeachtet vermöge seitens mangels binnen " +
        "gegenüber zwischen neben hinter unterhalb oberhalb innerhalb außerhalb diesseits jenseits " +
        "am ans aufs beim durchs fürs im ins übers ums unters vom vors zum zur " +
        // Adverbien
        "hier dort da überall nirgends nirgendwo irgendwo irgendwohin irgendwoher " +
        "jetzt dann danach damals zuerst zuletzt schließlich endlich sofort gleich bald " +
        "früher später gestern heute morgen vorher nachher immer nie niemals stets " +
        "manchmal oft häufig selten gewöhnlich meistens meist mehrmals " +
        "sehr kaum wenig überaus äußerst gänzlich völlig fast beinahe nahezu ziemlich recht " +
        "so wie ganz einfach etwa " +
        "hierhin dorthin dahin hin her hinauf hinunter hinein hinaus herauf herunter herein heraus " +
        "hierher dorther oben unten links rechts vorne hinten drinnen draußen drüben " +
        "keineswegs mitnichten sicher sicherlich gewiss tatsächlich natürlich vermutlich " +
        "wahrscheinlich hoffentlich leider glücklicherweise offenbar scheinbar anscheinend " +
        "sowieso ohnehin überdies zudem außerdem ferner weiterhin daraufhin " +
        // SEIN – alle Formen inkl. Konjunktiv + historische
        "bin bist ist sind seid war warst waren wart gewesen seyn seyd seye " + // seyn/seyd historisch
        "sei seiest seist seien seiet " +
        "wäre wärest wärst wären wärt wäret " +
        // HABEN
        "habe hast hat haben habt hatte hattest hatten hattet gehabt " +
        "habest habet hätte hättest hätten hättet " +
        // WERDEN
        "werde wirst wird werden werdet wurde wurdest wurden wurdet geworden worden ward " +
        "werdest würde würdest würden würdet " +
        // KÖNNEN
        "kann kannst können könnt konnte konntest konnten konntet gekonnt " +
        "könne könnest könnet könnte könntest könnten könntet " +
        // MÜSSEN
        "muss musst müssen müsst musste musstest mussten musstet gemusst muß mußt mußte mußten " + // muß historisch
        "müsse müssest müsset müsste müsstest müssten müsstet " +
        // SOLLEN
        "soll sollst sollen sollt sollte solltest sollten solltet gesollt " +
        "solle sollest sollet " +
        // WOLLEN
        "will willst wollen wollt wollte wolltest wollten wolltet gewollt " +
        "wolle wollest wollet " +
        // DÜRFEN
        "darf darfst dürfen dürft durfte durftest durften durftet gedurft " +
        "dürfe dürfest dürfet dürfte dürftest dürften dürftet " +
        // MÖGEN
        "mag magst mögen mögt mochte mochtest mochten mochtet gemocht " +
        "möge mögest möget möchte möchtest möchten möchtet " +
        // Häufige Vollverben inkl. historischer Formen (thut, thun, gieng, hiess, sey)
        "gehe gehst geht gehen ging gingst gingen gingt gegangen ginge gieng giengen " + // gieng historisch
        "komme kommst kommt kommen kam kamst kamen kamt gekommen käme " +
        "mache machst macht machen machte machtest machten machtet gemacht " +
        "tue tust tut tun tat tatest taten tatet getan täte thut thun that thaten " + // thut/thun historisch
        "sage sagst sagt sagen sagte sagtest sagten sagtet gesagt " +
        "sehe siehst sieht sehen seht sah sahst sahen saht gesehen sähe " +
        "stehe stehst steht stehen stand standest standen standet gestanden stünde stände " +
        "gebe gibst gibt geben gebt gab gabst gaben gabt gegeben gäbe giebt " + // giebt historisch
        "nehme nimmst nimmt nehmen nehmt nahm nahmst nahmen nahmt genommen nähme " +
        "halte hältst hält halten haltet hielt hieltest hielten hieltet gehalten hielte " +
        "denke denkst denkt denken dachte dachtest dachten dachtet gedacht dächte " +
        "glaube glaubst glaubt glauben glaubte glaubtest glaubten glaubtet geglaubt " +
        "finde findest findet finden fand fandst fanden fandt gefunden fände " +
        "führe führst führt führen führte führtest führten führtet geführt " +
        "trage trägst trägt tragen tragt trug trugst trugen trugt getragen trüge " +
        "bringe bringst bringt bringen brachte brachtest brachten brachtet gebracht brächte " +
        "lasse lässt lasst lassen ließ ließest ließen ließt gelassen ließe " +
        "heiße heißt heißen hieß hießest hießen hießt geheißen hieße heisst hiess heissen " + // ss-Varianten
        "bleibe bleibst bleibt bleiben blieb bliebst blieben bliebt geblieben bliebe " +
        "spiele spielst spielt spielen spielte spieltest spielten spieltet gespielt " +
        "lebe lebst lebt leben lebte lebtest lebten lebtet gelebt " +
        "liege liegst liegt liegen lag lagst lagen lagt gelegen läge " +
        "sitze sitzt sitzen setzt saß saßt gesessen säße " +
        "spreche sprichst spricht sprechen sprecht sprach sprachst sprachen spracht gesprochen spräche " +
        "schreibe schreibst schreibt schreiben schrieb schriebst schrieben schriebt geschrieben schriebe " +
        "höre hörst hört hören hörte hörtest hörten hörtet gehört " +
        "weiß weißt wissen wisst wusste wusstest wussten wusstet gewusst wüsste " +
        "meine meinst meint meinen meinte meintest meinten meintet gemeint " +
        "zeige zeigst zeigt zeigen zeigte zeigtest zeigten zeigtet gezeigt " +
        "erkenne erkennst erkennen erkannte erkanntest erkannten erkanntet erkannt " +
        "verstehe verstehst versteht verstehen verstand verstandest verstanden verstandet verstünde " +
        "gehöre gehörst gehören gehörte gehörten gehört " +
        // Passiv-/Perfekt-Hilfen
        "wird wurde geworden werden würde worden ward " +
        // Häufige Adjektive (Deklinationen komplett)
        "gut gute guten guter gutes gutem besser bessere besseren besserer besseres besserem best beste besten " +
        "groß große großen großer großes großem größer größere größten größte " +
        "klein kleine kleinen kleiner kleines kleinem kleinste kleinsten " +
        "neu neue neuen neuer neues neuem " +
        "alt alte alten alter altes altem älter älteste ältesten " +
        "erst erste ersten erster erstes erstem " +
        "letzt letzte letzten letzter letztes letztem " +
        "eigen eigene eigenen eigener eigenes eigenem eignen eigner eignes eignem " +
        "ganz ganze ganzen ganzer ganzes ganzem " +
        "hoch hohe hohen hoher hohes hohem höher höhere höchsten höchste " +
        "kurz kurze kurzen kurzer kurzes kurzem " +
        "lang lange langen langer langes langem länger längste " +
        "gleich gleiche gleichen gleicher gleiches gleichem gleicherweise " +
        "recht rechte rechten rechter rechtes rechtem " +
        "wahr wahre wahren wahrer wahres wahrem wirklich wirkliche wirklichen wirklicher wirkliches wirklichem " +
        "richtig richtige richtigen richtiger richtiges richtigem " +
        "falsch falsche falschen falscher falsches falschem " +
        "möglich mögliche möglichen möglicher mögliches möglichem " +
        "nötig nötige nötigen nötiger nötiges nötigem notwendig notwendige notwendigen " +
        // Abkürzungen
        "usw etc bzw ca vgl siehe nämlich zwar folglich zb dh " +
        // Superlativ-Endungen einzelner Adverbien
        "besonders speziell insbesondere hauptsächlich vornehmlich weitgehend teilweise vollständig"
    ).split(/\s+/);
    var STOPWORDS_EN = ("the a an and or but if while for of in on at to from by with about against " +
        "between into through during before after above below to from up down out off over under again " +
        "further then once here there when where why how all any both each few more most other some such " +
        "no nor not only own same so than too very s t can will just don should now i me my myself we " +
        "our ours ourselves you your yours yourself he him his himself she her hers herself it its itself " +
        "they them their theirs themselves what which who whom this that these those am is are was were " +
        "be been being have has had having do does did doing").split(" ");
    // Häufigste hebräische Funktionswörter (bewusst konservativ, damit Fachbegriffe bleiben)
    var STOPWORDS_HE = ("\u05D0\u05EA \u05E9\u05DC \u05E2\u05DC \u05DB\u05D9 \u05DE\u05DF \u05DB\u05DE\u05D5 " +
        "\u05DC\u05D0 \u05D0\u05D9\u05DF \u05D0\u05DA \u05D0\u05D1\u05DC \u05D2\u05DD \u05D0\u05E3 \u05D9\u05E9 " +
        "\u05D4\u05D9\u05D4 \u05D4\u05D9\u05D5 \u05D4\u05D9\u05EA\u05D4 \u05D9\u05D4\u05D9\u05D4 \u05D0\u05E9\u05E8 " +
        "\u05DB\u05D0\u05E9\u05E8 \u05D0\u05DD \u05D0\u05D5 \u05E2\u05DD \u05D1\u05D9\u05DF \u05DC\u05E4\u05E0\u05D9 " +
        "\u05D0\u05D7\u05E8\u05D9 \u05EA\u05D7\u05EA \u05DE\u05E2\u05DC \u05D0\u05E6\u05DC \u05D6\u05D4 " +
        "\u05D6\u05D5 \u05D6\u05D0\u05EA \u05D0\u05DC\u05D4 \u05D4\u05D5\u05D0 \u05D4\u05D9\u05D0 \u05D4\u05DD " +
        "\u05D4\u05DF \u05D0\u05E0\u05D9 \u05D0\u05E0\u05D7\u05E0\u05D5 \u05D0\u05EA\u05D4 \u05DC\u05D9 \u05DC\u05DA " +
        "\u05DC\u05D5 \u05DC\u05D4 \u05DC\u05E0\u05D5").split(" ");

    /**
     * Hebräisches ו-Präfix ("und ...") am Wortanfang abtrennen.
     * Konservativ: nur wenn Rest ≥ 3 Zeichen. ה/ב/ל/כ/מ/ש-Präfixe werden NICHT
     * abgetrennt, weil zu viele echte Wörter mit diesen Buchstaben anfangen
     * (הר, הוא, ברית, בית, לחם, כהן, מלך, שלום …).
     * Wird nur für den Vergleichsschlüssel benutzt, der Original-Text bleibt.
     */
    function stripHebrewPrefixes(text) {
        var s = String(text);
        if (s.length < 4) return s;
        if (s.charAt(0) === "\u05D5") {
            var rest = s.substring(1);
            if (rest.length >= 3 && /^[\u05D0-\u05EA]/.test(rest)) return rest;
        }
        return s;
    }

    // Zusätzliche hebräische Nicht-Index-Wörter: Partikeln, Pronomen mit
    // Suffixen, Flexions-/Verbformen, die aus Kandidaten-Wortlisten
    // erfahrungsgemäß durchrutschen (Befund: generierter Index S. 250 ff.).
    var STOPWORDS_HE_EXTRA = (
        "\u05D0\u05DC\u05D0 \u05D0\u05E4\u05E9\u05E8 \u05E2\u05D5\u05D3 \u05D0\u05D7\u05E8 \u05D0\u05D7\u05E8\u05EA " +
        "\u05D0\u05EA\u05DB\u05DD \u05D0\u05EA\u05DD \u05D0\u05D5\u05EA\u05D5 \u05D0\u05D5\u05EA\u05D4 \u05D0\u05D5\u05EA\u05DD " +
        "\u05D4\u05E8\u05D9 \u05DB\u05D1\u05E8 \u05E8\u05E7 \u05DB\u05DC \u05E9\u05DC\u05D0 \u05DB\u05DE\u05D4 " +
        "\u05D0\u05D9\u05D6\u05D4 \u05D1\u05DC\u05D9 \u05DE\u05D1\u05DC\u05D9 \u05DB\u05D3\u05D9 \u05DC\u05DE\u05E2\u05DF " +
        "\u05D0\u05DE\u05E0\u05DD \u05D0\u05DB\u05DF \u05D5\u05D2\u05D5 \u05D5\u05DB\u05D5 \u05DB\u05D2\u05D5\u05DF " +
        "\u05D4\u05D9\u05D9\u05E0\u05D5 \u05DE\u05DE\u05E0\u05D5 \u05DE\u05DE\u05E0\u05D4 \u05DE\u05D4\u05DD \u05DE\u05D4\u05DF " +
        "\u05D1\u05D4\u05DD \u05D1\u05D4\u05DF \u05DC\u05D4\u05DD \u05DC\u05D4\u05DF \u05E9\u05DC\u05D5 \u05E9\u05DC\u05D4 " +
        "\u05E9\u05DC\u05D4\u05DD \u05E9\u05DC\u05E0\u05D5 \u05D0\u05DC\u05D9\u05D5 \u05D0\u05DC\u05D9\u05D4 " +
        "\u05D0\u05DC\u05D9\u05E0\u05D5 \u05E2\u05DC\u05D9\u05D5 \u05E2\u05DC\u05D9\u05D4 \u05E2\u05DC\u05D9\u05D4\u05DD " +
        "\u05E2\u05DC\u05D9\u05E0\u05D5 \u05DC\u05E4\u05E0\u05D9\u05D5 \u05DC\u05E4\u05E0\u05D9\u05D4\u05DD " +
        "\u05D1\u05D5 \u05D1\u05D4 \u05D1\u05DD \u05DB\u05DF \u05DC\u05DB\u05DF \u05D5\u05D0\u05DD \u05D5\u05D2\u05DD " +
        "\u05D5\u05DB\u05DF \u05D5\u05DB\u05DC \u05D5\u05D1\u05D9\u05DF " +
        "\u05D0\u05D1\u05D9\u05DA \u05D0\u05DE\u05DA \u05D0\u05DE\u05EA\u05DA \u05D0\u05DC\u05E7\u05D9\u05DA " +
        "\u05D0\u05DC\u05D3\u05D9\u05DA \u05D0\u05DC\u05D4\u05D9 \u05D0\u05DC\u05E7\u05D9 \u05D4\u05D0\u05DC\u05E7\u05D9 " +
        "\u05D4\u05D0\u05DC\u05E7\u05D9\u05DD \u05D4\u05D0\u05DC\u05D4\u05D9\u05DD \u05D1\u05E8\u05E2\u05DA " +
        "\u05DC\u05E9\u05D5\u05E0\u05D0\u05D9 \u05DC\u05E9\u05D5\u05D0 \u05D2\u05D9\u05DC\u05D5 \u05D5\u05D9\u05D2\u05D3 " +
        "\u05D5\u05D6\u05D1\u05D7\u05D9\u05DD \u05D0\u05D1\u05D4"
    ).split(/\s+/);

    // Erweiterung der deutschen Stoppwörter: Adverbien, Konjunktionen,
    // Pronominal-/Verbformen und historische Schreibungen, die in der
    // Grundliste fehlen (Befund: "also", "daher", "dessen" u. a. tauchten
    // als Kandidaten auf).
    var STOPWORDS_DE_EXTRA = (
        "also daher dessen deren denen allein nun deshalb darum dadurch dabei " +
        "dazu davon darauf daran darin darüber darunter dagegen danach davor " +
        "dahin daraus somit sodann alsdann ferner zudem außerdem jedoch dennoch " +
        "trotzdem hingegen indem sofern soweit sobald solange während wobei " +
        "wodurch wovon wozu worauf worin womit wonach demnach folglich mithin " +
        "gleichwohl indessen inzwischen unterdessen überdies gleichfalls " +
        "desgleichen andererseits einerseits beziehungsweise bzw usw etc " +
        "allerdings freilich immerhin keineswegs vielmehr nämlich zunächst " +
        "zuletzt zuerst schließlich übrigens insbesondere insofern insoweit " +
        "jedenfalls irgendwie irgendwo irgendwann irgendein irgendeine sowohl " +
        "weder entweder anstatt statt gemäß laut mittels seitens zwecks " +
        "angesichts aufgrund infolge anhand anlässlich bezüglich hinsichtlich " +
        "innerhalb außerhalb oberhalb unterhalb diesseits jenseits abermals " +
        "nochmals nochmal derart dermaßen ebenso genauso geradezu allzu umso " +
        "desto sofort bald früher später jetzt heute morgen gestern damals " +
        "einst stets immer oft häufig selten manchmal meist meistens zumeist " +
        "bisweilen zuweilen niemand jemand jedermann einander gegenseitig " +
        "beide beiden beides mehrere einige etliche sämtliche wenige viele " +
        "vieles weniger wenigstens mindestens höchstens alles allem aller " +
        "allen jeder jede jedes jedem jeden derjenige diejenige dasjenige " +
        "denjenigen demjenigen derselbe dieselbe dasselbe denselben demselben " +
        "desselben derselben solch solcher solche solches solchen solchem " +
        "hierbei hierzu hierfür hiermit hierauf hieraus hierin hiervon " +
        "worden wurde wurden würde würden hätte hätten wäre wären sei seien " +
        "ist sind war waren hat haben hatte hatten wird werden kann können " +
        "konnte konnten muss müssen musste mussten soll sollen sollte sollten " +
        "will wollen wollte wollten mag mögen mochte darf dürfen durfte " +
        "lässt lassen ließ gibt gab gegeben macht machen machte gemacht " +
        "kommt kommen kam gekommen geht gehen ging gegangen steht stehen " +
        "stand gestanden sagt sagen sagte gesagt heißt hieß zeigt zeigen " +
        "zeigte gezeigt findet finden fand gefunden bleibt bleiben blieb " +
        "geblieben liegt liegen lag gelegen bringt bringen brachte gebracht " +
        "nimmt nehmen nahm genommen trägt tragen trug getragen gilt gelten " +
        "galt gegolten scheint scheinen schien " +
        // historische Schreibungen (19. Jh., Hirsch-Kommentar)
        "gethan thun thut that nothwendig noth ward sonach wornach worinnen " +
        "hierinnen darinnen alldieweil dieweil"
    ).split(/\s+/);

    function buildStopwordSet(useDe, useEn, useHe, extra) {
        var set = {};
        // Stoppwörter müssen durch dieselbe Normalisierung wie die Text-Kandidaten,
        // sonst matcht "heißt" (Liste) nicht auf "heisst" (Kandidat nach ß→ss).
        function add(list) {
            for (var i = 0; i < list.length; i++) {
                var w = list[i];
                if (!w) continue;
                var k = makeCompareKey(w, { matchMode: "normalized", ignoreNiqqud: true });
                if (k) set[k] = true;
            }
        }
        if (useDe) add(STOPWORDS_DE);
        if (useDe) add(STOPWORDS_DE_EXTRA);
        if (useEn) add(STOPWORDS_EN);
        if (useHe) add(STOPWORDS_HE);
        if (useHe) add(STOPWORDS_HE_EXTRA);
        if (extra) add(extra);
        return set;
    }

    /**
     * Zählt Wort-Frequenzen im Corpus.
     * Rückgabe: Array [{ text, key, count, pages, samplePage }]
     * text = darstellbare Form (Erstvorkommen im Text)
     * key  = normalisierte Vergleichsform (Kleinschrift, ohne Niqqud)
     */
    function extractCandidates(corpus, opts) {
        opts = opts || {};
        var minFreq   = opts.minFreq || 2;
        var stopwords = opts.stopwords || {};
        var known     = opts.knownKeys || {};
        var minLen    = opts.minLen || 3;
        var onlyScript = opts.onlyScript;
        var formatFilter = opts.formatFilter;
        var stripHePrefix = !!opts.stripHebrewPrefixes;

        var buckets = {};
        for (var pi = 0; pi < corpus.paragraphs.length; pi++) {
            var cp = corpus.paragraphs[pi];
            if (formatFilter && cp.paragraphStyle && formatFilter[cp.paragraphStyle.toLowerCase()]) continue;
            var toks = tokenize(cp.text);
            for (var ti = 0; ti < toks.length; ti++) {
                var t = toks[ti].text;
                if (t.length < minLen) continue;
                if (/^\d+$/.test(t)) continue;
                var sc = detectScript(t);
                if (onlyScript && sc !== onlyScript && !(onlyScript === "latin" && sc === "mixed")) continue;
                // Kleingeschriebene lateinische Wörter sind im Deutschen
                // praktisch nie indexwürdig (Substantive/Namen sind groß).
                if (opts.onlyCapitalized && sc !== "hebrew") {
                    var cc0 = t.charAt(0);
                    if ((cc0 >= "a" && cc0 <= "z") || "äöüß".indexOf(cc0) >= 0) continue;
                }

                var normalized = t;
                if (stripHePrefix && sc === "hebrew") {
                    normalized = stripHebrewPrefixes(t);
                }
                var key = makeCompareKey(normalized, { matchMode: "normalized", ignoreNiqqud: true });
                if (!key) continue;
                if (stopwords[key]) continue;
                if (known[key]) continue;

                var b = buckets[key];
                if (!b) {
                    b = buckets[key] = {
                        text: t, key: key, count: 0, pages: {},
                        samplePage: cp.page, script: sc,
                        variants: {}
                    };
                }
                b.count++;
                b.variants[t] = (b.variants[t] || 0) + 1;
                if (cp.page != null) b.pages[cp.page] = true;
            }
        }
        var out = [];
        for (var k in buckets) if (buckets.hasOwnProperty(k)) {
            var b0 = buckets[k];
            if (b0.count < minFreq) continue;
            var pgList = []; for (var p in b0.pages) if (b0.pages.hasOwnProperty(p)) pgList.push(p);
            // Häufigste Form als Anzeigetext
            var bestForm = b0.text, bestCount = -1;
            for (var v in b0.variants) if (b0.variants.hasOwnProperty(v)) {
                if (b0.variants[v] > bestCount) { bestForm = v; bestCount = b0.variants[v]; }
            }
            var formList = [];
            for (var vf in b0.variants) if (b0.variants.hasOwnProperty(vf)) formList.push(vf);
            out.push({
                text: bestForm, key: b0.key, count: b0.count,
                pages: pgList, samplePage: b0.samplePage, script: b0.script,
                variantCount: countKeys(b0.variants),
                variantForms: formList
            });
        }
        out.sort(function (a, b) {
            if (a.count !== b.count) return b.count - a.count;
            return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
        });
        return out;
    }
    function countKeys(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }

    /** Bekannte Compare-Keys aus schon existierenden Wortlisten. */
    function knownKeysFromEntries(entries, globals) {
        var out = {};
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.isRegex) continue;
            var opts = effectiveOpts(e, globals);
            opts.ignoreNiqqud = true; opts.matchMode = "normalized";
            var forms = [e.term].concat(e.variants || []);
            for (var f = 0; f < forms.length; f++) {
                var s = trim(forms[f]); if (!s) continue;
                var tokens = tokenize(s);
                for (var t = 0; t < tokens.length; t++) {
                    var k = makeCompareKey(tokens[t].text, opts);
                    if (k) out[k] = true;
                }
                out[makeCompareKey(s, opts)] = true;
            }
        }
        return out;
    }

    function candidatesToCsv(selected) {
        var lines = ["term;variants;language;subentry;sortKey;ignoreNiqqud;caseSensitive;enabled;see;seeAlso;category"];
        function q(s) {
            s = String(s == null ? "" : s);
            return /[";]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        for (var i = 0; i < selected.length; i++) {
            var c = selected[i];
            var isHe = (c.script === "hebrew");
            var lang = isHe ? "he" : "de";

            // Hebräisch: Grundform (ohne ו-Präfix, ohne Niqqud) als term.
            var term = c.text;
            if (isHe) {
                var baseForm = stripHebrewPrefixes(stripHebrewMarks(term));
                if (baseForm) term = baseForm;
            }

            // Alle beobachteten Oberflächenformen als Varianten sichern,
            // damit z. B. ו-präfigierte oder punktierte Vorkommen beim
            // Index-Lauf ebenfalls matchen (der Index-Matcher trennt
            // Präfixe NICHT selbst ab).
            var seen = {}; seen[term] = true;
            var vars = [];
            var forms = c.variantForms || [];
            for (var v = 0; v < forms.length; v++) {
                var f0 = trim(forms[v]);
                if (f0 && !seen[f0]) { seen[f0] = true; vars.push(f0); }
            }

            lines.push(q(term) + ";" + q(vars.join("|")) + ";" + lang + ";;;;;ja;;;auto");
        }
        return lines.join("\n");
    }

    /**
     * Kandidaten-Dialog: Multi-Select mit Häufigkeit und Seiten.
     * Rückgabe: { selected: [candidates], appendTo: File|null, saveNewAs: File|null }
     */
    function showCandidatesDialog(corpus, existingEntries, styles, globals) {
        var dlg = new Window("dialog", "IndexBuilder – Wortlisten-Kandidaten (" +
            (SCRIPT_MODE === "hebrew" ? "nur Hebräisch" : "nur Deutsch/Lateinisch") + ")");
        dlg.orientation = "column"; dlg.alignChildren = "fill";
        dlg.margins = 14; dlg.spacing = 8;
        dlg.preferredSize.width = 640;

        var head = dlg.add("statictext", undefined,
            "Kandidaten aus dem Dokument – filtern, auswählen, in Wortliste übernehmen");
        head.graphics.font = ScriptUI.newFont(head.graphics.font.name, "BOLD", 13);

        /* ---- Filter-Zeile ---- */
        var grpFlt = dlg.add("panel", undefined, "Filter");
        grpFlt.orientation = "column"; grpFlt.alignChildren = "fill";
        grpFlt.margins = 10; grpFlt.spacing = 4;

        var row1 = grpFlt.add("group"); row1.alignChildren = "left";
        row1.add("statictext", undefined, "Mindest-Häufigkeit:");
        var edtMin = row1.add("edittext", undefined, "2");
        edtMin.characters = 4;
        row1.add("statictext", undefined, "Mindestlänge (Zeichen):");
        var edtLen = row1.add("edittext", undefined, "3");
        edtLen.characters = 4;

        var row2 = grpFlt.add("group"); row2.alignChildren = "left";
        var chkStopDe = row2.add("checkbox", undefined, "Deutsche Stoppwörter");
        chkStopDe.value = true;
        var chkStopEn = row2.add("checkbox", undefined, "Englische Stoppwörter");
        chkStopEn.value = true;
        var chkStopHe = row2.add("checkbox", undefined, "Hebräische Funktionswörter");
        chkStopHe.value = true;
        // Nur die für diese Skript-Variante relevanten Stoppwort-Optionen zeigen
        if (SCRIPT_MODE === "hebrew") { chkStopDe.visible = false; chkStopEn.visible = false; }
        else { chkStopHe.visible = false; }
        var chkCap = row2.add("checkbox", undefined,
            "Nur großgeschriebene Wörter (Substantive/Namen) – empfohlen");
        chkCap.value = (SCRIPT_MODE !== "hebrew");
        if (SCRIPT_MODE === "hebrew") chkCap.visible = false;

        var row3 = grpFlt.add("group"); row3.alignChildren = "left";
        var chkFilterKnown = row3.add("checkbox", undefined,
            "Bereits in common/existierender Wortliste abgedeckt: ausblenden");
        chkFilterKnown.value = true;
        row3.add("statictext", undefined, "     Skript: " +
            (SCRIPT_MODE === "hebrew" ? "nur Hebräisch (durch dieses Skript festgelegt)"
                                      : "nur Deutsch/Lateinisch (durch dieses Skript festgelegt)"));

        var row4 = grpFlt.add("group"); row4.alignChildren = "left";
        var chkStripHe = row4.add("checkbox", undefined,
            "Hebräisches ו-Präfix (\u201Eund …\u201C) beim Vergleich abtrennen – ורתי und רתי zusammenführen");
        chkStripHe.value = true;
        if (SCRIPT_MODE !== "hebrew") { row4.visible = false; chkStripHe.value = false; }

        /* ---- Excluded styles (aus Setup schon vorbereitet) ---- */
        var grpFmt = dlg.add("panel", undefined, "Absatzformate ausschließen (Kolumnentitel, Überschrift, …)");
        grpFmt.orientation = "column"; grpFmt.alignChildren = "fill";
        grpFmt.margins = 10;
        var fmtList = grpFmt.add("listbox", undefined, [], { multiselect: true });
        fmtList.preferredSize.height = 60;
        for (var si = 0; si < styles.length; si++) {
            fmtList.add("item", styles[si].name + "   (" + styles[si].count + ")");
        }

        /* ---- Aktions-Buttons ---- */
        var actRow = dlg.add("group"); actRow.alignChildren = "left";
        var btnAnalyse = actRow.add("button", undefined, "Analysieren");
        var lblStats = actRow.add("statictext", undefined, "");
        lblStats.characters = 60;

        /* ---- Ergebnisliste ---- */
        var grpRes = dlg.add("panel", undefined, "Kandidaten (Häufigkeit × Wort · Seiten)");
        grpRes.orientation = "column"; grpRes.alignChildren = "fill";
        grpRes.margins = 10;

        // Suchfeld über der Liste
        var searchRow = grpRes.add("group"); searchRow.alignChildren = "left";
        searchRow.add("statictext", undefined, "Suchen:");
        var edtSearch = searchRow.add("edittext", undefined, "");
        edtSearch.characters = 30;
        var lblFilterCount = searchRow.add("statictext", undefined, "");
        lblFilterCount.characters = 70;

        var resList = grpRes.add("listbox", undefined, [],
            { multiselect: true, numberOfColumns: 3,
              showHeaders: true, columnTitles: ["Anzahl", "Wort", "Seiten"],
              columnWidths: [60, 260, 260] });
        resList.preferredSize.height = 260;
        var resRow = grpRes.add("group");
        var btnAll = resRow.add("button", undefined, "Alle sichtbaren auswählen");
        var btnNone = resRow.add("button", undefined, "Auswahl aufheben");
        var btnSaveVisible = resRow.add("button", undefined, "Alle Treffer speichern …");
        var lblSel = resRow.add("statictext", undefined, "0 ausgewählt");
        lblSel.characters = 30;

        /* ---- Speichern ---- */
        var grpSave = dlg.add("panel", undefined, "Ausgewählte Kandidaten speichern");
        grpSave.orientation = "column"; grpSave.alignChildren = "fill";
        grpSave.margins = 10;
        var saveHint = grpSave.add("statictext", undefined,
            "Als neue CSV speichern (Vorschlag: <Buchname>.csv im Ordner der Wortlisten).");
        var saveHint2 = grpSave.add("statictext", undefined,
            "Anschließend die neue Datei zusätzlich zur common.csv beim Index-Lauf laden.");
        saveHint2.graphics.foregroundColor = saveHint2.graphics.newPen(
            saveHint2.graphics.PenType.SOLID_COLOR, [.4, .4, .4, 1], 1);

        var grpBtn = dlg.add("group"); grpBtn.alignment = "right";
        var btnCancel = grpBtn.add("button", undefined, "Schließen", { name: "cancel" });
        var btnSave = grpBtn.add("button", undefined, "Ausgewählte speichern …", { name: "ok" });
        btnSave.enabled = false;

        // GRUEN = analysieren/auswaehlen · MAGENTA = CSV schreiben · ORANGE = schliessen
        styleWorkflowText(head,UI_GREEN,"Kandidaten aus dem Dokument analysieren und auswählen.");
        styleWorkflowPanel(grpFlt,UI_GREEN,"Grüne Einstellungen gehören zur Kandidatenanalyse.");
        styleWorkflowField(edtMin,UI_GREEN,"Mindesthäufigkeit für Kandidaten.");
        styleWorkflowField(edtLen,UI_GREEN,"Mindestlänge eines Kandidaten.");
        styleWorkflowChoice(chkStopDe,UI_GREEN);
        styleWorkflowChoice(chkStopEn,UI_GREEN);
        styleWorkflowChoice(chkStopHe,UI_GREEN);
        styleWorkflowChoice(chkCap,UI_GREEN);
        styleWorkflowChoice(chkFilterKnown,UI_GREEN);
        styleWorkflowChoice(chkStripHe,UI_GREEN);
        styleWorkflowPanel(grpFmt,UI_GREEN);
        styleWorkflowField(fmtList,UI_GREEN,"Absatzformate, die bei der Kandidatenanalyse ausgelassen werden.");
        styleWorkflowButton(btnAnalyse,UI_GREEN,"Dokument mit den gewählten Filtern analysieren.");
        styleWorkflowPanel(grpRes,UI_GREEN);
        styleWorkflowField(edtSearch,UI_GREEN,"Gefundene Kandidaten filtern.");
        styleWorkflowField(resList,UI_GREEN,"Grüne Auswahlliste der analysierten Kandidaten.");
        styleWorkflowButton(btnAll,UI_GREEN,"Alle aktuell sichtbaren Kandidaten auswählen.");
        styleWorkflowButton(btnNone,UI_GREEN,"Aktuelle Kandidatenauswahl aufheben.");
        styleWorkflowPanel(grpSave,UI_MAGENTA,"Magenta kennzeichnet den CSV-Export.");
        styleWorkflowButton(btnSaveVisible,UI_MAGENTA,"Alle sichtbaren Treffer unmittelbar als CSV speichern.");
        styleWorkflowButton(btnSave,UI_MAGENTA,"Nur die ausgewählten Kandidaten als CSV speichern.");
        styleWorkflowButton(btnCancel,UI_ORANGE,"Dialog schließen, ohne eine neue CSV zu speichern.");

        var candidates = [];       // Alle Kandidaten (nach Analyse)
        var visibleIdx = [];       // Indizes in candidates, die aktuell in resList stehen

        function selectionCount() {
            var sel = resList.selection;
            if (!sel) return 0;
            if (!isArray(sel)) return 1;
            return sel.length;
        }
        function refreshCountLabel() {
            var n = selectionCount();
            lblSel.text = n + " ausgewählt";
            btnSave.enabled = n > 0;
        }

        // ScriptUI-Listboxen werden ab wenigen tausend Zeilen unbenutzbar
        // (Minuten-Hänger beim Befüllen und bei der Auswahl). Deshalb wird
        // die Anzeige gedeckelt; gespeichert werden kann trotzdem ALLES,
        // was dem aktuellen Filter entspricht ("Alle Treffer speichern").
        var MAX_LIST_ROWS = 400;
        var matchingIdx = [];   // alle Filter-Treffer, auch jenseits der Anzeige
        function renderList() {
            resList.removeAll();
            visibleIdx = [];
            matchingIdx = [];
            var q = trim(edtSearch.text).toLowerCase();
            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                if (q && c.text.toLowerCase().indexOf(q) === -1 &&
                    c.key.toLowerCase().indexOf(q) === -1) continue;
                matchingIdx.push(i);
                if (visibleIdx.length < MAX_LIST_ROWS) {
                    var item = resList.add("item", String(c.count));
                    item.subItems[0].text = c.text;
                    var pgs = sortPages(c.pages);
                    if (pgs.length > 8) pgs = pgs.slice(0, 8).concat(["…"]);
                    item.subItems[1].text = pgs.join(", ");
                    visibleIdx.push(i);
                }
            }
            if (matchingIdx.length > visibleIdx.length) {
                lblFilterCount.text = "zeige " + visibleIdx.length + " von " +
                    matchingIdx.length + " Treffern – Filter verfeinern oder " +
                    "„Alle Treffer speichern“ nutzen";
            } else {
                lblFilterCount.text = q
                    ? "(" + matchingIdx.length + " von " + candidates.length + " sichtbar)"
                    : "";
            }
            refreshCountLabel();
        }

        function analyse() {
            var minFreq = parseInt(edtMin.text, 10) || 2;
            var minLen  = parseInt(edtLen.text, 10) || 3;
            var stopwords = buildStopwordSet(chkStopDe.value, chkStopEn.value, chkStopHe.value, null);
            var known = chkFilterKnown.value ? knownKeysFromEntries(existingEntries || [], globals) : {};
            // Schrift ist durch die Skript-Variante fest vorgegeben
            var onlyScript = (SCRIPT_MODE === "hebrew") ? "hebrew" : "latin";

            var excluded = {};
            var sel = fmtList.selection;
            if (sel) {
                if (!isArray(sel)) sel = [sel];
                for (var i = 0; i < sel.length; i++) {
                    excluded[styles[sel[i].index].name.toLowerCase()] = true;
                }
            }

            candidates = extractCandidates(corpus, {
                minFreq: minFreq, minLen: minLen,
                stopwords: stopwords, knownKeys: known,
                onlyScript: onlyScript, formatFilter: excluded,
                stripHebrewPrefixes: chkStripHe.value,
                onlyCapitalized: (SCRIPT_MODE !== "hebrew") && chkCap.value
            });

            var latN = 0, hebN = 0, othN = 0;
            for (var ci = 0; ci < candidates.length; ci++) {
                if (candidates[ci].script === "hebrew") hebN++;
                else if (candidates[ci].script === "latin" || candidates[ci].script === "mixed") latN++;
                else othN++;
            }
            lblStats.text = candidates.length + " Kandidaten – Lateinisch: " + latN +
                ", Hebräisch: " + hebN + (othN ? ", Andere: " + othN : "");

            edtSearch.text = "";
            renderList();
        }
        btnAnalyse.onClick = analyse;
        edtSearch.onChanging = renderList;
        btnAll.onClick = function () {
            var arr = [];
            for (var i = 0; i < resList.items.length; i++) arr.push(i);
            resList.selection = arr;
            refreshCountLabel();
        };
        btnNone.onClick = function () {
            resList.selection = null;
            refreshCountLabel();
        };
        resList.onChange = refreshCountLabel;

        var result = null;
        function saveCands(cands) {
            if (!cands.length) return;
            var suggested = (app.activeDocument.name || "wortliste")
                .replace(/\.indd$/i, "") + "-" + FILE_SUFFIX + ".csv";
            var f = File.saveDialog("Wortliste speichern", suggested, "CSV:*.csv");
            if (!f) return;
            if (!/\.csv$/i.test(f.name)) f = new File(f.fsName + ".csv");
            try {
                writeTextFile(f, "\uFEFF" + candidatesToCsv(cands));
                result = { count: cands.length, file: f };
                dlg.close(1);
            } catch (e) {
                alert("Speichern fehlgeschlagen: " + e.message);
            }
        }
        btnSave.onClick = function () {
            var sel = resList.selection;
            if (!sel) return;
            if (!isArray(sel)) sel = [sel];
            var selectedCands = [];
            for (var i = 0; i < sel.length; i++) {
                selectedCands.push(candidates[visibleIdx[sel[i].index]]);
            }
            saveCands(selectedCands);
        };
        btnSaveVisible.onClick = function () {
            var cands = [];
            for (var i = 0; i < matchingIdx.length; i++) {
                cands.push(candidates[matchingIdx[i]]);
            }
            if (cands.length > 3000 && !confirm(
                cands.length + " Kandidaten speichern?\n\n" +
                "Das ist ungewöhnlich viel – meist lohnt es sich, die " +
                "Mindest-Häufigkeit zu erhöhen oder die Filter zu verfeinern.\n" +
                "Trotzdem fortfahren?")) return;
            saveCands(cands);
        };
        btnCancel.onClick = function () { dlg.close(0); };

        // Initial analysieren
        analyse();

        var r = dlg.show();
        return r === 1 ? result : null;
    }

    /* ================================================================== *
     * 12. ScriptUI: Setup-Dialog
     * ================================================================== */

    function showSetupDialog(styles, wordlistFilesInitial, cfgDefaults) {
        cfgDefaults = cfgDefaults || {};
        var dlg = new Window("dialog", "IndexBuilder – Einstellungen");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";
        dlg.margins = 14; dlg.spacing = 10;

        // Kopfzeile
        var head = dlg.add("statictext", undefined,
            "IndexBuilder " + VERSION + " – Ben Ish Chai");
        head.graphics.font = ScriptUI.newFont(head.graphics.font.name, "BOLD", 13);

        /* ---------- Wortlisten ---------- */
        var grpWL = dlg.add("panel", undefined, "Wortlisten");
        grpWL.orientation = "column"; grpWL.alignChildren = "fill";
        grpWL.margins = 10; grpWL.spacing = 6;
        var wlList = grpWL.add("listbox", undefined, [],
            { multiselect: false });
        wlList.preferredSize.height = 90;
        var wlButtons = grpWL.add("group");
        var wlAdd = wlButtons.add("button", undefined, "Hinzufügen …");
        var wlDel = wlButtons.add("button", undefined, "Entfernen");
        var wlFiles = [];
        function refreshWL() {
            wlList.removeAll();
            for (var i = 0; i < wlFiles.length; i++) wlList.add("item", wlFiles[i].name);
        }
        for (var i0 = 0; i0 < (wordlistFilesInitial || []).length; i0++) {
            wlFiles.push(wordlistFilesInitial[i0]);
        }
        refreshWL();
        wlAdd.onClick = function () {
            var files = File.openDialog("Wortlisten (JSON/CSV/TXT)",
                "Wortlisten:*.json;*.csv;*.tsv;*.txt", true);
            if (!files) return;
            if (!isArray(files)) files = [files];
            for (var i = 0; i < files.length; i++) wlFiles.push(files[i]);
            refreshWL();
        };
        wlDel.onClick = function () {
            if (wlList.selection == null) return;
            var idx = wlList.selection.index;
            wlFiles.splice(idx, 1);
            refreshWL();
        };

        /* ---------- Optionen ---------- */
        var grpOpt = dlg.add("panel", undefined, "Suchoptionen");
        grpOpt.orientation = "column"; grpOpt.alignChildren = "left";
        grpOpt.margins = 10; grpOpt.spacing = 4;
        var chkHist  = grpOpt.add("checkbox", undefined,
            "Historische Rechtschreibung (Thora↔Tora, Muth↔Mut, ae↔ä, ue↔ü, oe↔ö, ß↔ss)");
        chkHist.value = true;
        var chkHFirst = grpOpt.add("checkbox", undefined, "Hebräischen Index zuerst");
        chkHFirst.value = false;
        var chkFn = grpOpt.add("checkbox", undefined, "Fußnoten einbeziehen");
        chkFn.value = true;
        var chkTb = grpOpt.add("checkbox", undefined, "Tabellen einbeziehen");
        chkTb.value = true;
        var chkCs6 = grpOpt.add("checkbox", undefined,
            "InDesign CS5/CS6-Kompatibilität – hebräischen Text im Dokument spiegeln " +
            "(bereits beim Lesen aktiviert – hier nur informativ)");
        chkCs6.value = !!cfgDefaults.reverseHebrew;
        chkCs6.enabled = false;   // Fuer den nativen Modus nicht noetig.
        var chkAlef = grpOpt.add("checkbox", undefined, "Alef-Bet-Gruppierung unter Symbols");
        chkAlef.value = true;
        var chkReplaceFlat = grpOpt.add("checkbox", undefined,
            "Vorhandene flache hebräische Topics ersetzen (englische bleiben)");
        chkReplaceFlat.value = true;
        var chkSample = grpOpt.add("checkbox", undefined, "Probelauf: zuerst 10 Begriffe");
        chkSample.value = false;

        /* ---------- Format-Filter ---------- */
        var grpFmt = dlg.add("panel", undefined,
            "Absatzformate ausschließen (Kolumnentitel, Überschriften …)");
        grpFmt.orientation = "column"; grpFmt.alignChildren = "fill";
        grpFmt.margins = 10; grpFmt.spacing = 4;
        var fmtList = grpFmt.add("listbox", undefined, [], { multiselect: true });
        fmtList.preferredSize.height = 120;
        for (var s2 = 0; s2 < styles.length; s2++) {
            fmtList.add("item", styles[s2].name + "   (" + styles[s2].count + ")");
        }
        var hintFmt = grpFmt.add("statictext", undefined,
            "Strg-Klick / Cmd-Klick für Mehrfachauswahl. Häufige Kandidaten: " +
            "Kolumnentitel, Überschrift, Kapitelnr, Fußzeile.");
        hintFmt.graphics.foregroundColor = hintFmt.graphics.newPen(
            hintFmt.graphics.PenType.SOLID_COLOR, [.4, .4, .4, 1], 1);

        /* ---------- Ausgabe ---------- */
        var grpOut = dlg.add("panel", undefined, "Ausgabe");
        grpOut.orientation = "column"; grpOut.alignChildren = "left";
        grpOut.margins = 10; grpOut.spacing = 4;
        var chkHtml = grpOut.add("checkbox", undefined, "HTML exportieren");
        chkHtml.value = false;
        var chkJson = grpOut.add("checkbox", undefined, "JSON exportieren");
        chkJson.value = false;
        var chkNative = grpOut.add("checkbox", undefined,
            "In nativen InDesign-Index schreiben (verändert das Dokument)");
        chkNative.value = true;

        /* ---------- Buttons ---------- */
        var grpBtn = dlg.add("group");
        grpBtn.alignment = "right";
        var btnCancel = grpBtn.add("button", undefined, "Abbrechen", { name: "cancel" });
        var btnOK = grpBtn.add("button", undefined, "Suche starten", { name: "ok" });

        // BLAU = Wortlistenbasis · GRUEN = Suchauswahl · MAGENTA = Ausgabe · ORANGE = Abbruch
        styleWorkflowText(head,UI_BLUE,"Einstellungen für den hebräischen Index.");
        styleWorkflowPanel(grpWL,UI_BLUE,"Blaue Elemente bestimmen die verwendeten Wortlisten.");
        styleWorkflowField(wlList,UI_BLUE,"Geladene Wortlisten für diesen Indexlauf.");
        styleWorkflowButton(wlAdd,UI_BLUE,"Eine weitere Wortliste hinzufügen.");
        styleWorkflowButton(wlDel,UI_ORANGE,"Markierte Wortliste aus dieser Auswahl entfernen; die Datei selbst bleibt erhalten.");
        styleWorkflowPanel(grpOpt,UI_GREEN,"Grüne Optionen steuern Suche, Alef-Bet-Gruppierung und Trefferumfang.");
        styleWorkflowChoice(chkHist,UI_GREEN);
        styleWorkflowChoice(chkHFirst,UI_GREEN);
        styleWorkflowChoice(chkFn,UI_GREEN);
        styleWorkflowChoice(chkTb,UI_GREEN);
        styleWorkflowChoice(chkCs6,UI_GREEN);
        styleWorkflowChoice(chkAlef,UI_GREEN);
        styleWorkflowChoice(chkReplaceFlat,UI_GREEN);
        styleWorkflowChoice(chkSample,UI_GREEN);
        styleWorkflowPanel(grpFmt,UI_GREEN);
        styleWorkflowField(fmtList,UI_GREEN,"Absatzformate auswählen, die von der Suche ausgeschlossen werden.");
        styleWorkflowPanel(grpOut,UI_MAGENTA,"Magenta kennzeichnet alle Index- und Exportausgaben.");
        styleWorkflowChoice(chkHtml,UI_MAGENTA);
        styleWorkflowChoice(chkJson,UI_MAGENTA);
        styleWorkflowChoice(chkNative,UI_MAGENTA);
        styleWorkflowButton(btnOK,UI_MAGENTA,"Indexsuche starten und die gewählten Ausgaben erzeugen.");
        styleWorkflowButton(btnCancel,UI_ORANGE,"Einstellungen schließen, ohne den Indexlauf zu starten.");

        var result = null;
        btnOK.onClick = function () {
            if (wlFiles.length === 0) {
                alert("Bitte mindestens eine Wortliste hinzufügen.");
                return;
            }
            var excluded = {};
            var sel = fmtList.selection;
            if (sel) {
                if (!isArray(sel)) sel = [sel];
                for (var i = 0; i < sel.length; i++) {
                    excluded[styles[sel[i].index].name.toLowerCase()] = true;
                }
            }
            result = {
                wordlists: wlFiles.slice(),
                foldHistorical: chkHist.value,
                hebrewFirst: chkHFirst.value,
                includeFootnotes: chkFn.value,
                includeTables: chkTb.value,
                reverseHebrew: chkCs6.value,
                excludedStyles: excluded,
                exportHtml: chkHtml.value,
                exportJson: chkJson.value,
                writeNative: chkNative.value,
                alefBet: chkAlef.value,
                replaceFlat: chkReplaceFlat.value,
                sample: chkSample.value
            };
            dlg.close(1);
        };
        btnCancel.onClick = function () { dlg.close(0); };

        var r = dlg.show();
        return r === 1 ? result : null;
    }

    /* ================================================================== *
     * 13. Nativer InDesign-Index-Writer (mit Bestätigung)
     * ================================================================== */

    function isNativeIndexSupported(doc) {
        try { return !!(doc.indexes && typeof doc.indexes.add === "function"); }
        catch (e) { return false; }
    }

    function confirmNativeWrite(idx) {
        var count = 0;
        for (var s = 0; s < idx.sections.length; s++) {
            for (var g = 0; g < idx.sections[s].groups.length; g++) {
                count += idx.sections[s].groups[g].entries.length;
            }
        }
        var msg = "Es werden " + count + " " +
            (SCRIPT_MODE === "hebrew" ? "hebr\u00e4ische" : "deutsche/lateinische") +
            " Begriffe (mit " + idx.stats.subentries + " Untereintr\u00e4gen) in den nativen " +
            "InDesign-Index geschrieben.\n\n" +
            "Hinweis: InDesign verwaltet nur EINEN Index pro Dokument. Dieses Skript " +
            "bef\u00fcllt ihn ausschlie\u00dflich mit " +
            (SCRIPT_MODE === "hebrew" ? "hebr\u00e4ischen" : "deutschen/lateinischen") +
            " Eintr\u00e4gen; f\u00fcr die andere Schrift gibt es das Schwester-Skript " +
            OTHER_SCRIPT + ".\n\n" +
            "Das Dokument wird dadurch ver\u00e4ndert. Fortfahren?";
        return confirm(msg);
    }

    var ALEFBET = "\u05D0\u05D1\u05D2\u05D3\u05D4\u05D5\u05D6\u05D7\u05D8\u05D9\u05DB\u05DC\u05DE\u05E0\u05E1\u05E2\u05E4\u05E6\u05E7\u05E8\u05E9\u05EA";
    var FINAL_TO_REGULAR = { "\u05DA":"\u05DB", "\u05DD":"\u05DE", "\u05DF":"\u05E0", "\u05E3":"\u05E4", "\u05E5":"\u05E6" };

    function hebLetterOf(term) {
        var t = stripHebrewMarks(String(term));
        for (var i = 0; i < t.length; i++) {
            var c = t.charAt(i);
            if (FINAL_TO_REGULAR[c]) c = FINAL_TO_REGULAR[c];
            if (ALEFBET.indexOf(c) >= 0) return c;
        }
        return "";
    }

    // Normalisierter Vergleichsschluessel fuer die Schreib-Verifizierung:
    // tolerant gegenueber Niqqud/Teamim, typografischen Zeichen und
    // Gross-/Kleinschreibung. Behebt die massenhaften "Text-Mismatch"-Skips.
    function verifyKey(s) {
        return foldGermanUmlauts(unifyPunctuation(stripHebrewMarks(toNFC(String(s))))).toLowerCase();
    }

    function writeNativeIndex(doc, indexModel, progress) {
        var reverseHe = indexModel._reverseHebrew;
        var report = {
            topics: 0, subtopics: 0, pageRefs: 0, skipped: 0, errors: [],
            indexName: "", indexId: null, indexExisted: false,
            purgedTopics: 0, letterGroups: 0, relocated: 0,
            latinTopics: 0, hebrewTopics: 0,
            skipReasons: { noMatch: 0, noStory: 0, badRange: 0, textMismatch: 0, otherError: 0 }
        };

        // InDesign 18.1 erlaubt genau EINEN Index pro Dokument. Wir verwenden
        // ihn exklusiv fuer die Schrift dieses Skripts (SCRIPT_MODE).
        var idx = null;
        try {
            if (doc.indexes.length > 0) {
                idx = doc.indexes.everyItem().getElements()[0];
                report.indexExisted = true;
            } else {
                doc.indexes.add();
                idx = doc.indexes.everyItem().getElements()[0];
            }
            try { idx.name = INDEX_NAME; } catch (eN) {}
            try { report.indexId = idx.id; } catch (eI) {}
            try { report.indexName = idx.name; } catch (eM) { report.indexName = INDEX_NAME; }
        } catch (e) {
            report.errors.push("Index-Erstellung fehlgeschlagen: " + e.message);
            return report;
        }

        // Vorhandene Topics (z. B. vom Schwester-Skript) entfernen?
        // Wichtig: bereits GENERIERTE Index-Textrahmen bleiben davon
        // unberuehrt - sie sind nach dem Generieren statischer Text.
        var hadTopics = 0;
        try { hadTopics = idx.topics.length; } catch (eT) {}
        if (hadTopics > 0) {
            var doPurge = confirm(
                "Der Index enth\u00e4lt bereits " + hadTopics + " Eintr\u00e4ge (Topics).\n\n" +
                "Diese jetzt l\u00f6schen?\n\n" +
                "Ja  = leeren und nur die " +
                (SCRIPT_MODE === "hebrew" ? "hebr\u00e4ischen" : "deutschen/lateinischen") +
                " Eintr\u00e4ge dieses Laufs schreiben\n" +
                "         (empfohlen im Zwei-Index-Workflow; bereits generierte\n" +
                "         Index-Textrahmen bleiben unber\u00fchrt)\n" +
                "Nein = neue Eintr\u00e4ge zus\u00e4tzlich zu den vorhandenen schreiben");
            if (doPurge) {
                try {
                    idx.topics.everyItem().remove();
                } catch (eP) {
                    try {
                        for (var pgi = idx.topics.length - 1; pgi >= 0; pgi--) {
                            try { idx.topics.item(pgi).remove(); } catch (eP2) {}
                        }
                    } catch (eP3) {}
                }
                report.purgedTopics = hadTopics;
            }
        }

        // Nur Hebraeisch: optionale Alef-Bet-Gruppierung. InDesign sortiert
        // hebraeische Topics sonst flach unter "Symbols"; mit Buchstaben-
        // Obereintraegen (sortOrder 01..22) bekommt der generierte Index
        // saubere Alef-Bet-Abschnitte.
        var useLetterGroups = false;
        if (SCRIPT_MODE === "hebrew") {
            useLetterGroups = confirm(
                "Alef-Bet-Gruppierung verwenden?\n\n" +
                "Ja  = Buchstaben-Obereintr\u00e4ge (\u05D0, \u05D1, \u05D2 \u2026) anlegen; die Begriffe\n" +
                "         werden deren Untereintr\u00e4ge. Der generierte Index erh\u00e4lt\n" +
                "         so saubere hebr\u00e4ische Abschnitte in Alef-Bet-Reihenfolge\n" +
                "         statt einer flachen Liste unter \u201ESymbols\u201C.\n" +
                "Nein = flache Liste (alle Begriffe direkt unter \u201ESymbols\u201C)");
        }

        var letterTopics = {};
        function letterTopicFor(idxObj, term) {
            var c = hebLetterOf(term);
            if (!c) return null;
            if (letterTopics[c]) return letterTopics[c];
            var lt = null;
            try {
                var ex = null;
                try { ex = idxObj.topics.itemByName(c); } catch (eL0) {}
                if (ex && ex.isValid) lt = ex;
                else {
                    lt = idxObj.topics.add(c);
                    report.letterGroups++;
                }
                try { lt.sortOrder = padNum(ALEFBET.indexOf(c) + 1, 2); } catch (eL1) {}
            } catch (eL) {
                report.errors.push("Buchstabengruppe '" + c + "': " + eL.message);
                return null;
            }
            letterTopics[c] = lt;
            return lt;
        }

        var storyById = {};
        var stories = doc.stories.everyItem().getElements();
        for (var i = 0; i < stories.length; i++) storyById[String(stories[i].id)] = stories[i];

        var allEntries = [];
        for (var si = 0; si < indexModel.sections.length; si++) {
            var sec = indexModel.sections[si];
            for (var gi = 0; gi < sec.groups.length; gi++) {
                for (var ei = 0; ei < sec.groups[gi].entries.length; ei++) {
                    var ent = sec.groups[gi].entries[ei];
                    ent._targetScript = sec.script;
                    allEntries.push(ent);
                }
            }
        }

        for (var ai = 0; ai < allEntries.length; ai++) {
            var entry = allEntries[ai];
            var isHebrew = (entry._targetScript === "hebrew");

            // Sicherheitsnetz: nur die Schrift dieses Skripts schreiben
            if (SCRIPT_MODE === "hebrew" && !isHebrew) continue;
            if (SCRIPT_MODE !== "hebrew" && isHebrew) continue;

            var parent = idx;
            if (useLetterGroups && isHebrew) {
                var lt2 = letterTopicFor(idx, entry.sortKey || entry.term);
                if (lt2) parent = lt2;
            }
            var topic;
            try {
                var existing = null;
                try { existing = parent.topics.itemByName(entry.term); } catch (e0) {}
                if (existing && existing.isValid) topic = existing;
                else topic = parent.topics.add(entry.term);
                var so = (entry.sortKey && entry.sortKey !== entry.term) ? entry.sortKey
                       : (isHebrew ? stripHebrewMarks(entry.term) : "");
                if (so && so !== entry.term) { try { topic.sortOrder = so; } catch (e1) {} }
                report.topics++;
                if (isHebrew) report.hebrewTopics++; else report.latinTopics++;
            } catch (e) {
                report.errors.push("Topic '" + entry.term + "': " + e.message);
                continue;
            }
            addPageRefs(topic, entry, storyById, report, reverseHe);

            for (var subi = 0; subi < entry.subentries.length; subi++) {
                var sub = entry.subentries[subi];
                try {
                    var subTopic;
                    var existSub = null;
                    try { existSub = topic.topics.itemByName(sub.term); } catch (e2) {}
                    if (existSub && existSub.isValid) subTopic = existSub;
                    else subTopic = topic.topics.add(sub.term);
                    report.subtopics++;
                    addPageRefs(subTopic, sub, storyById, report, reverseHe);
                } catch (e) {
                    report.errors.push("Subtopic '" + sub.term + "': " + e.message);
                }
            }
            if (progress && (ai & 15) === 15) progress(ai + 1, allEntries.length);
        }
        return report;
    }

    function addPageRefs(topic, entry, storyById, report, reverseHe) {
        var pages = entry.pageList || [];
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            var m = entry.firstMatchPerPage && entry.firstMatchPerPage[page];
            if (!m) { report.skipped++; report.skipReasons.noMatch++; continue; }
            if (!m.canWriteNative) { report.skipped++; report.skipReasons.noMatch++; continue; }
            var story = storyById[String(m.storyId)];
            if (!story) { report.skipped++; report.skipReasons.noStory++; continue; }
            try {
                var len = story.characters.length;
                var wantLen = m.storyCharEnd - m.storyCharStart;
                var start = m.storyCharStart;
                if (start < 0 || start >= len) { report.skipped++; report.skipReasons.badRange++; continue; }
                var endIdx = Math.min(start + wantLen - 1, len - 1);
                if (endIdx < start) { report.skipped++; report.skipReasons.badRange++; continue; }

                var range = story.characters.itemByRange(start, endIdx);
                var current = "";
                try { current = String(range.contents); } catch (e0) {}
                if (reverseHe) current = reverseHebrewRuns(current);

                // Toleranter Vergleich statt exakter Gleichheit
                var okMatch = !current || verifyKey(current) === verifyKey(m.matchedText);

                // Re-Synchronisation bei Offset-Drift (Sonderzeichen, Anker,
                // Tabellenmarken): Treffer im lokalen Fenster neu suchen.
                // (Nur ohne CS6-Spiegelung, da sonst die Positionen im
                // gespiegelten Text nicht den Story-Positionen entsprechen.)
                if (!okMatch && !reverseHe) {
                    var winStart = Math.max(0, start - 120);
                    var winEnd = Math.min(len - 1, start + wantLen + 120);
                    var winTxt = "";
                    try { winTxt = String(story.characters.itemByRange(winStart, winEnd).contents); } catch (eW) {}
                    if (winTxt) {
                        var target = m.matchedText;
                        var pos = winTxt.indexOf(target);
                        var newLen = wantLen;
                        if (pos < 0) {
                            // Normalisiert suchen, Positionen ueber eine
                            // Zeichen-Landkarte zurueckrechnen
                            var map = [], keys = [];
                            for (var ci = 0; ci < winTxt.length; ci++) {
                                var k = verifyKey(winTxt.charAt(ci));
                                for (var ki = 0; ki < k.length; ki++) { keys.push(k.charAt(ki)); map.push(ci); }
                            }
                            var hay = keys.join("");
                            var needle = verifyKey(target);
                            var p2 = needle ? hay.indexOf(needle) : -1;
                            if (p2 >= 0 && map.length) {
                                var rs = map[p2];
                                var re = map[Math.min(p2 + needle.length - 1, map.length - 1)];
                                pos = rs; newLen = re - rs + 1;
                            }
                        }
                        if (pos >= 0) {
                            start = winStart + pos;
                            endIdx = Math.min(start + newLen - 1, len - 1);
                            if (endIdx >= start) {
                                range = story.characters.itemByRange(start, endIdx);
                                report.relocated++;
                                okMatch = true;
                            }
                        }
                    }
                }

                if (!okMatch) { report.skipped++; report.skipReasons.textMismatch++; continue; }
                topic.pageReferences.add(range);
                report.pageRefs++;
            } catch (e) {
                report.skipped++;
                report.skipReasons.otherError++;
                report.errors.push("PageRef '" + entry.term + "' S." + page + ": " + e.message);
            }
        }
    }

    /* ================================================================== *
     * 13b. Wortlisten-Bereinigung vor dem Index-Lauf
     *      Sortiert Stoppwörter, Flexionsformen und Kleingeschriebenes
     *      aus, bevor sie den Index verschmutzen. Kuratierte Einträge
     *      (mit Varianten, sortKey, Untereintrag oder Querverweisen)
     *      gelten als bewusst gewählt und werden nie angetastet.
     * ================================================================== */

    function entrySuspicion(entry, stopSet) {
        var t = trim(entry.term || "");
        if (!t) return "leer";

        // Kuratierte Einträge sind vertrauenswürdig. Auto-generierte
        // Kandidatenlisten (category=auto) bekommen den Varianten-Bonus
        // NICHT, damit ihre automatisch gesammelten Oberflächenformen die
        // Stoppwort-Prüfung nicht aushebeln.
        var autoGen = (entry.category === "auto");
        if ((entry.variants && entry.variants.length && !autoGen) ||
            (entry.crossRefs && entry.crossRefs.length) ||
            entry.sortKey || entry.subentry) return "";

        // Phrasen (mehrere Wörter) gelten als bewusst gewählt
        if (t.indexOf(" ") >= 0) return "";

        var sc = detectScript(t);
        var bare = (sc === "hebrew") ? stripHebrewMarks(t) : t;
        if (bare.length < 2) return "zu kurz";

        var key = makeCompareKey(t, { matchMode: "normalized", ignoreNiqqud: true });
        if (key && stopSet[key]) return "Stoppwort/Funktionswort";
        if (sc === "hebrew") {
            var keyPfx = makeCompareKey(stripHebrewPrefixes(bare),
                { matchMode: "normalized", ignoreNiqqud: true });
            if (keyPfx && stopSet[keyPfx]) return "Stoppwort mit \u05D5-Pr\u00e4fix";
        }

        if (sc !== "hebrew") {
            var c0 = t.charAt(0);
            if ((c0 >= "a" && c0 <= "z") || "\u00e4\u00f6\u00fc\u00df".indexOf(c0) >= 0) {
                return "kleingeschrieben (kein Substantiv/Name)";
            }
            if (bare.length < 3) return "zu kurz";
        }
        return "";
    }

    function serializeWordlistCsv(entries) {
        var lines = ["term;variants;language;subentry;sortKey;ignoreNiqqud;caseSensitive;enabled;see;seeAlso"];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var see = [], seeAlso = [];
            var xr = e.crossRefs || [];
            for (var x = 0; x < xr.length; x++) {
                if (xr[x].type === "seeAlso") seeAlso.push(xr[x].target);
                else see.push(xr[x].target);
            }
            lines.push([
                e.term,
                (e.variants || []).join("|"),
                e.language || "",
                e.subentry || "",
                e.sortKey || "",
                (e.ignoreNiqqud === false) ? "nein" : "ja",
                e.caseSensitive ? "ja" : "",
                (e.enabled === false) ? "nein" : "ja",
                see.join("|"),
                seeAlso.join("|")
            ].join(";"));
        }
        return lines.join("\n");
    }

    // Rückgabe: gefiltertes Array oder null (= Abbruch durch Nutzer)
    function cleanupWordlist(entries) {
        var stopSet = buildStopwordSet(true, true, true, null);
        var sus = [], ok = [];
        for (var i = 0; i < entries.length; i++) {
            var reason = entrySuspicion(entries[i], stopSet);
            if (reason) { entries[i]._susReason = reason; sus.push(entries[i]); }
            else ok.push(entries[i]);
        }
        if (!sus.length) return entries;

        var dlg = new Window("dialog", "IndexBuilder \u2013 Wortlisten-Bereinigung");
        dlg.orientation = "column"; dlg.alignChildren = "fill";
        dlg.margins = 16; dlg.spacing = 8;

        var head = dlg.add("statictext", undefined,
            sus.length + " von " + entries.length + " Eintr\u00e4gen sehen nicht nach Index-Begriffen aus");
        head.graphics.font = ScriptUI.newFont(head.graphics.font.name, "BOLD", 13);
        dlg.add("statictext", undefined,
            "(Stoppw\u00f6rter, Funktionsw\u00f6rter, kleingeschriebene Formen, Suffix-Formen).");
        dlg.add("statictext", undefined,
            "Eintr\u00e4ge markieren, die TROTZDEM in den Index sollen (Strg/Cmd + Klick f\u00fcr mehrere):");

        var items = [];
        for (var s = 0; s < sus.length; s++) {
            items.push(sus[s].term + "    \u2014 " + sus[s]._susReason);
        }
        var lb = dlg.add("listbox", undefined, items, { multiselect: true });
        lb.preferredSize = [460, 320];

        var cbSave = dlg.add("checkbox", undefined,
            "Bereinigte Wortliste anschlie\u00dfend als CSV speichern (f\u00fcr k\u00fcnftige L\u00e4ufe)");
        cbSave.value = true;

        var grpBtn = dlg.add("group"); grpBtn.alignment = "right";
        var btnCancel = grpBtn.add("button", undefined, "Abbrechen");
        var btnNone   = grpBtn.add("button", undefined, "Nichts filtern");
        var btnKeep   = grpBtn.add("button", undefined, "Auswahl behalten, Rest filtern");
        var btnAll    = grpBtn.add("button", undefined, "Alle " + sus.length + " ausfiltern");

        styleWorkflowText(head,UI_ORANGE,"Orange kennzeichnet die Wortlisten-Bereinigung.");
        styleWorkflowField(lb,UI_ORANGE,"Einträge markieren, die trotz Warnung erhalten bleiben sollen.");
        styleWorkflowChoice(cbSave,UI_ORANGE,"Bereinigte Wortliste zusätzlich als CSV speichern.");
        styleWorkflowButton(btnCancel,UI_ORANGE,"Bereinigung abbrechen.");
        styleWorkflowButton(btnNone,UI_ORANGE,"Keine vorgeschlagenen Einträge entfernen.");
        styleWorkflowButton(btnKeep,UI_ORANGE,"Markierte Einträge behalten und die übrigen Vorschläge entfernen.");
        styleWorkflowButton(btnAll,UI_ORANGE,"Alle vorgeschlagenen Einträge ausfiltern.");

        var decision = null;   // "all" | "keepSel" | "none"
        btnCancel.onClick = function () { dlg.close(0); };
        btnNone.onClick   = function () { decision = "none";    dlg.close(1); };
        btnKeep.onClick   = function () { decision = "keepSel"; dlg.close(1); };
        btnAll.onClick    = function () { decision = "all";     dlg.close(1); };

        var r = dlg.show();
        if (r !== 1 || decision === null) return null;

        var kept;
        var removed = 0;
        if (decision === "none") {
            kept = entries;
        } else if (decision === "all") {
            kept = ok; removed = sus.length;
        } else {
            var selIdx = {};
            var sel = lb.selection;
            if (sel) {
                if (!isArray(sel)) sel = [sel];
                for (var si = 0; si < sel.length; si++) selIdx[sel[si].index] = true;
            }
            kept = [];
            for (var ko = 0; ko < ok.length; ko++) kept.push(ok[ko]);
            for (var k2 = 0; k2 < sus.length; k2++) {
                if (selIdx[k2]) kept.push(sus[k2]); else removed++;
            }
        }
        logInfo("Wortlisten-Bereinigung: " + removed + " Eintr\u00e4ge ausgefiltert, " +
                kept.length + " verbleiben.");

        if (cbSave.value && removed > 0) {
            var f = pickSaveFile("Bereinigte Wortliste speichern",
                "wortliste-bereinigt.csv", "CSV:*.csv");
            if (f) {
                try {
                    if (!/\.csv$/i.test(f.name)) f = new File(f.fsName + ".csv");
                    writeTextFile(f, serializeWordlistCsv(kept));
                    logInfo("Bereinigte Wortliste: " + f.fsName);
                } catch (eS) { logError("Wortlisten-Export: " + eS.message); }
            }
        }
        return kept;
    }

    /* Der native Writer fuer Ben Ish Chai nutzt die direkt gefundenen Textobjekte.
       Der bisherige grosse IndexBuilder bleibt fuer HTML/JSON und Kandidaten. */
    function runBenIshChaiNativeIndex(nativeCfg) {

/* Hebraeischer nativer Index, InDesign 18.1 (ExtendScript).
   Eingabe: UTF-8 CSV/TSV, mindestens Spalte term; optional variants,
   indexAs, subentry, ignoreNiqqud, enabled. Varianten: | getrennt.
   CSV-sortKey bestimmt den Anfangsbuchstaben der Alef-Bet-Gruppe;
   eine gesonderte native sortBy-Sortierung wird nicht erzwungen.
   Vor dem ersten vollen Lauf eine Kopie der INDD-Datei anlegen. */
(function () {
    var VERSION = "5.1-AlefBet";
    var MARKS = "[\\x{0591}-\\x{05C7}]*";
    var HEB = /[\u05D0-\u05EA]/;
    var LETTERS = "\u05D0\u05D1\u05D2\u05D3\u05D4\u05D5\u05D6\u05D7\u05D8\u05D9\u05DB\u05DC\u05DE\u05E0\u05E1\u05E2\u05E4\u05E6\u05E7\u05E8\u05E9\u05EA";
    var FINALS = {"\u05DA":"\u05DB","\u05DD":"\u05DE","\u05DF":"\u05E0","\u05E3":"\u05E4","\u05E5":"\u05E6"};
    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }
    function unmark(s) { return String(s).replace(/[\u0591-\u05C7]/g, ""); }
    function sortKey(s) { return unmark(s).replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, function (c) { return FINALS[c]; }); }
    // In der Ben-Ish-Chai-INDD stand Symbol.include bereits auf true, aber
    // idx.indexSections enthielt nur A-Z. Im Dokumentvergleich wurde ein
    // hebr. Topic erst durch ERNEUTES Setzen von include=true gueltig; danach
    // entstand die IndexSection "Symbols". Devarim benoetigte das nicht.
    function refreshSymbolSort(doc) {
        var opts=doc.indexingSortOptions;
        for(var i=0;i<opts.length;i++) {
            var option=opts[i];
            if (/symbol/i.test(String(option.name))) {
                option.include=true; // auch bei bisher true zwingend erneut setzen
                if (option.include!==true) throw Error("Symbol-Sortieroption blieb deaktiviert.");
                return String(option.name);
            }
        }
        throw Error("InDesign-Sortieroption 'Symbol' nicht gefunden.");
    }
    function hasSymbols(idx) {
        for(var i=0;i<idx.indexSections.length;i++)
            if (/symbol/i.test(String(idx.indexSections[i].name))) return true;
        return false;
    }
    function err(e) { return String(e && e.message ? e.message : e) + (e && e.number ? " [" + e.number + "]" : ""); }
    function bool(s, defaultValue) {
        s = trim(s).toLowerCase();
        if (!s) return defaultValue;
        return !(s === "0" || s === "false" || s === "no" || s === "nein");
    }
    function readFile(f) {
        f.encoding = "UTF-8";
        if (!f.open("r")) throw Error("CSV kann nicht gelesen werden: " + f.fsName);
        var s;
        try { s = f.read(); } finally { f.close(); }
        return s.replace(/^\uFEFF/, "");
    }
    // Vollstaendige CSV-Felder, einschliesslich umbrochener Anfuehrungszeichen.
    function csvRows(s, sep) {
        var rows = [], row = [], field = "", quoted = false, i, c;
        s = s.replace(/\r\n?/g, "\n");
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i);
            if (c === '"') {
                if (quoted && s.charAt(i+1) === '"') { field += '"'; i++; }
                else quoted = !quoted;
            } else if (c === sep && !quoted) { row.push(field); field = ""; }
            else if (c === "\n" && !quoted) {
                row.push(field); if (row.join("").replace(/\s/g, "")) rows.push(row);
                row = []; field = "";
            } else field += c;
        }
        row.push(field); if (row.join("").replace(/\s/g, "")) rows.push(row);
        if (quoted) throw Error("CSV: Anfuehrungszeichen nicht geschlossen.");
        return rows;
    }
    function parseCSV(s) {
        var first = s.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
        var choices = [";", "\t", ","], sep = ";", n = -1, i;
        for (i=0; i<choices.length; i++) {
            var count = csvRows(first, choices[i])[0].length;
            if (count > n) { n = count; sep = choices[i]; }
        }
        var rows = csvRows(s, sep), header = {}, result = [];
        if (!rows.length) throw Error("CSV ist leer.");
        for (i=0; i<rows[0].length; i++) header[trim(rows[0][i]).toLowerCase()] = i;
        if (header.term === undefined && header.begriff === undefined)
            throw Error("CSV benoetigt die Spalte 'term' oder 'begriff'.");
        function cell(row, col) {
            var k = header[col]; return k === undefined ? "" : trim(row[k] || "");
        }
        for (i=1; i<rows.length; i++) {
            var r = rows[i], term = cell(r, header.term === undefined ? "begriff" : "term");
            if (!term || term.charAt(0) === "#" || !bool(cell(r,"enabled"), true)) continue;
            var forms = [term], variants = cell(r,"variants").split("|");
            for (var v=0; v<variants.length; v++) if (trim(variants[v])) forms.push(trim(variants[v]));
            result.push({term:term, forms:forms, name:cell(r,"indexas") || term,
                sub:cell(r,"subentry"), sort:cell(r,"sortkey"),
                niqqud:bool(cell(r,"ignoreniqqud"),true)});
        }
        if (!result.length) throw Error("CSV hat keine aktivierten Begriffe.");
        return result;
    }
    function escapeRE(c) { return c.replace(/[\\.^$|?*+()\[\]{}]/g,"\\$&"); }
    function pattern(form, ignoreMarks) {
        var s = ignoreMarks ? unmark(form) : form, body = "";
        for (var i=0; i<s.length; i++) {
            var c = s.charAt(i);
            if (HEB.test(c)) body += c + (ignoreMarks ? MARKS : "");
            else if (/\s/.test(c) || c === "\u00A0") body += "\\s+";
            else if (c === "-" || c === "\u05BE") body += "[-\\x{05BE}]";
            else body += escapeRE(c);
        }
        return body ? "(?<![\\x{05D0}-\\x{05EA}])" + body + "(?![\\x{05D0}-\\x{05EA}])" : "";
    }
    function pageOf(t) {
        try { var f=t.parentTextFrames; if(f.length && f[0].parentPage) return f[0].parentPage; } catch (_) {}
        try { var p=t.parent, k=0;
            while (p && k++ < 10) {
                if (p.constructor && p.constructor.name === "Footnote") {
                    var a=p.storyOffset.parentTextFrames;
                    if (a.length && a[0].parentPage) return a[0].parentPage;
                }
                p=p.parent;
            }
        } catch (_) {}
        return null;
    }
    function rootTopic(idx, name) {
        var t;
        // Zuerst die Symbol-Sektion: ein frueherer A-Sort-Probelauf kann
        // gleichnamige hebr. Topics unter A zurueckgelassen haben.
        for(var s=0;s<idx.indexSections.length;s++) {
            var section=idx.indexSections[s];
            if (!/symbol/i.test(String(section.name))) continue;
            try { t=section.topics.itemByName(name); if(t.isValid && t.pageReferences.length>=0) return t; }
            catch (_) {}
        }
        if (/[\u05D0-\u05EA]/.test(name))
            throw Error("Hebraeisches Topic fehlt unter 'Symbols': " + name);
        try { t=idx.topics.itemByName(name); if(t.isValid && t.pageReferences.length>=0) return t; } catch (_) {}
        throw Error("Symbol-Topic nicht auffindbar: " + name);
    }
    function lookup(parent, name) {
        var t;
        var hebRoot=(parent === idx && /[\u05D0-\u05EA]/.test(name));
        if (hebRoot) {
            try { return rootTopic(idx,name); } catch (_) {}
        }
        else try {t=parent.topics.itemByName(name); if(t.isValid && t.pageReferences.length>=0) return t;}catch(_){}
        // Ohne kuenstlichen A-Sortierschluessel: hebr. Topic nach "Symbols".
        t=parent.topics.add(name);
        if(!t.isValid) throw Error("Hebraeisches Topic ungueltig trotz aktualisierter Symbol-Sortierung: "+name);
        return t;
    }
    function groupedTopic(idx, letter, name, create) {
        if(create) lookup(idx,letter);
        // Das Anlegen des Buchstabens veraendert die IndexSection. Der zuvor
        // zurueckgegebene Topic-Specifier darf NICHT fuer .topics.add dienen.
        var head=rootTopic(idx,letter);
        try { head=head.getElements()[0]; } catch (_) {}
        var t;
        try {
            t=head.topics.itemByName(name);
            if(t.isValid && t.pageReferences.length>=0) return t;
        } catch (_) {}
        if(!create) throw Error("Alef-Bet-Unterbegriff fehlt: " + letter + " > " + name);
        t=head.topics.add(name);
        if(!t.isValid || t.pageReferences.length<0)
            throw Error("Alef-Bet-Unterbegriff ungueltig: " + letter + " > " + name);
        return t;
    }
    function testGrouping(idx) {
        var letter="\u05EA", existed=true, head=null, test=null, stage="Buchstabe nachschlagen";
        try { head=rootTopic(idx,letter); } catch (_) { existed=false; }
        try {
            if(!existed) {
                stage="Buchstabe anlegen";
                lookup(idx,letter);
            }
            stage="Buchstabe nach Index-Umordnung frisch lesen";
            head=rootTopic(idx,letter);
            try { head=head.getElements()[0]; } catch (_) {}
            stage="Unterbegriff unter frischem Buchstaben anlegen";
            test=head.topics.add("\u05D1\u05D3\u05D9\u05E7\u05EA-\u05D0\u05D9\u05E0\u05D3\u05E7\u05E1-"+(new Date()).getTime());
            stage="Unterbegriff validieren";
            if(!test.isValid || test.pageReferences.length!==0)
                throw Error("Hebraeischer Unterbegriff ist ungueltig.");
            stage="Symbols-Abschnitt validieren";
            if(!hasSymbols(idx)) throw Error("Symbol-Abschnitt fehlt beim Gruppentest.");
        } catch (e) {
            throw Error("Alef-Bet-Test, Schritt '" + stage + "': " + err(e));
        } finally {
            try { if(test && test.isValid) test.remove(); } catch (_) {}
            try { if(!existed && head && head.isValid && !head.topics.length && !head.pageReferences.length) head.remove(); }
            catch (_) {}
        }
    }
    function removeFlatHebrew(doc, migrated, warnings) {
        // InDesign invalidiert indexSections/sections.topics beim Entfernen.
        // Erst Namen festhalten, dann jede flache Wurzel frisch aufloesen.
        var names=[], removed=0, name, i, s, section, direct, current;
        for(name in migrated) if(migrated.hasOwnProperty(name) && migrated[name])
            names.push(name);
        for(i=0;i<names.length;i++) {
            name=names[i];
            if(name.length===1 && LETTERS.indexOf(name)>=0) continue;
            try {
                current=doc.indexes[0];
                direct=null;
                for(s=0;s<current.indexSections.length;s++) {
                    section=current.indexSections[s];
                    if(!/symbol/i.test(String(section.name))) continue;
                    direct=section.topics.itemByName(name);
                    break;
                }
                if(direct && direct.isValid) { direct.remove(); removed++; }
            } catch(cleanupError) {
                warnings.push("Flaches HE-Topic '"+name+"' nicht entfernt: "+err(cleanupError));
            }
        }
        return removed;
    }
    function testGroupingOnCopy(doc) {
        var tmp=File(Folder.temp.fsName+"/HE_AlefBet_Test_"+(new Date()).getTime()+".indd");
        var copy=null;
        try {
            doc.saveACopy(tmp);
            copy=app.open(tmp);
            refreshSymbolSort(copy);
            var ci=copy.indexes.length ? copy.indexes[0] : copy.indexes.add();
            testGrouping(ci);
        } finally {
            if(copy) try {copy.close(SaveOptions.NO);} catch (_) {}
            try {if(tmp.exists) tmp.remove();} catch (_) {}
        }
    }
    function letterOf(s) {
        s=sortKey(s);
        for(var i=0; i<s.length; i++) if(LETTERS.indexOf(s.charAt(i)) >= 0) return s.charAt(i);
        return "";
    }
    function writeLog(file, lines) {
        try {
            var out=File(file.path + "/IndexBuilder_HE_Bericht.txt"); out.encoding="UTF-8";
            if(out.open("w")) { out.write(lines.join("\n")); out.close(); return out.fsName; }
        } catch (_) {}
        return "Bericht konnte nicht gespeichert werden";
    }
    function existingPages(topic) {
        var pages={}, refs=topic.pageReferences;
        for(var r=0;r<refs.length;r++) {
            try {
                var pg=pageOf(refs[r].sourceText);
                if(pg) pages[String(pg.id)]=true;
            } catch (_) {}
        }
        return pages;
    }
    // InDesign kann einen aus der Story-Position neu konstruierten Anker
    // ablehnen, obwohl das vom Suchlauf gelieferte Textobjekt gueltig ist.
    function addAtMatch(topic, job) {
        var attempted=[], sources=[], t=job.found;
        // Keine getElements()/isValid/length-Abfragen nach dem Hinzufuegen:
        // ein Indexmarker kann DOM-Specifier beim Textumbruch entwerten.
        sources.push({label:"Fundtext", fetch:function(){return t;}});
        sources.push({label:"Original-Einfuegemarke", fetch:function(){return t.insertionPoints.item(0);}});
        sources.push({label:"Story-Einfuegemarke", fetch:function(){return job.story.insertionPoints.item(job.pos);}});
        for (var q=0; q<sources.length; q++) {
            var candidate=sources[q];
            try {
                var source=candidate.fetch();
                topic.pageReferences.add(source);
                return candidate.label;
            } catch (addError) { attempted.push(candidate.label+" add(): "+err(addError)); }
        }
        // Manche InDesign-Versionen akzeptieren statt findGrep-Text nur das
        // durch eine Selektion normalisierte Textobjekt.
        try {
            app.select(t);
            if(app.selection.length) {topic.pageReferences.add(app.selection[0]);return "Selektion";}
        } catch (e3) { attempted.push("Selektion add(): "+err(e3)); }
        try { attempted.push("Story-InsertionPoints: "+job.story.insertionPoints.length); } catch (_) {}
        throw Error(attempted.join(" | "));
    }
    var doc=nativeCfg.doc, files=nativeCfg.wordlists, file=files[0], entries=[];
    try {
        for(var listNo=0;listNo<files.length;listNo++) {
            if(!/\.(csv|tsv)$/i.test(files[listNo].name))
                throw Error("Nativer Index benoetigt bereinigte HE-CSV/TSV: " + files[listNo].name);
            var part=parseCSV(readFile(files[listNo]));
            for(var n=0;n<part.length;n++) entries.push(part[n]);
        }
    } catch (loadError) { alert("Wortliste: " + err(loadError)); return; }
    var foot={value:nativeCfg.includeFootnotes};
    var rebuild={value:false}; // Nur HE ersetzen, englische Topics erhalten.
    var grouping={value:nativeCfg.alefBet};
    var replaceFlat={value:nativeCfg.replaceFlat};
    var sample={value:nativeCfg.sample};
    var count=sample.value ? Math.min(entries.length,10) : entries.length;
    var report=["IndexBuilder HE " + VERSION, "Dokument: " + doc.name, "CSV: " + file.fsName,
        "Begriffe im Lauf: " + count + " / " + entries.length, "Alef-Bet: " + grouping.value], failures=[], cleanupWarnings=[], stats={hits:0,refs:0,verified:0,topics:0,groups:0,missing:0,unpaged:0,filtered:0};
    var prevGrep=app.findGrepPreferences.properties, prevOptions=app.findChangeGrepOptions.properties;
    var idx, i, j, k, stopped=false;
    var progress=new Window("palette", "IndexBuilder HE: Suche und Index schreiben");
    progress.alignChildren="fill";
    var progressText=progress.add("statictext",undefined,"Bereite den Index vor ...");
    progressText.preferredSize=[490,24];
    var progressBar=progress.add("progressbar",undefined,0,count);
    progressBar.preferredSize=[490,18];
    var progressCount=progress.add("statictext",undefined,"0 / " + count + " | 0 Seitenverweise");
    var cancelButton=progress.add("button",undefined,"Nach diesem Begriff abbrechen");
    styleWorkflowText(progressText,UI_MAGENTA,"Magenta: hebräische Begriffe werden gesucht und in den nativen Index geschrieben.");
    styleWorkflowField(progressBar,UI_MAGENTA);
    styleWorkflowText(progressCount,UI_MAGENTA);
    styleWorkflowButton(cancelButton,UI_ORANGE,"Nach Abschluss des aktuell bearbeiteten Begriffs kontrolliert abbrechen.");
    cancelButton.onClick=function(){stopped=true; progressText.text="Abbruch angefordert; warte auf die aktuelle Suche ...";progress.update();};
    progress.show();
    function status(message, n) {
        progressText.text=message;
        progressBar.value=n;
        progressCount.text=n+" / "+count+" | "+stats.refs+" Seitenverweise | "+failures.length+" Fehler";
        progress.update();
    }
    try {
        app.findGrepPreferences=NothingEnum.NOTHING;
        app.findChangeGrepOptions.includeFootnotes=foot.value;
        app.findChangeGrepOptions.includeMasterPages=false;
        app.findChangeGrepOptions.includeHiddenLayers=false;
        if(grouping.value) {
            status("Teste Alef-Bet-Unterbegriffe in einer Dokumentkopie ...",0);
            testGroupingOnCopy(doc);
        }
        report.push("Symbol-Sortieroption aktualisiert: " + refreshSymbolSort(doc));
        idx=doc.indexes.length ? doc.indexes[0] : doc.indexes.add();
        if(grouping.value) {
            status("Pruefe Alef-Bet im aktiven Dokument ...",0);
            testGrouping(idx);
            report.push("Alef-Bet-Unterbegriff im Vorabtest gueltig.");
        }
        if (rebuild.value) {
            for (i=idx.topics.length-1; i>=0; i--) idx.topics[i].remove();
        }
        var done={}, migrated={}, failStreak=0;
        for (i=0; i<count; i++) {
            if (stopped) break;
            var entry=entries[i], pages={}, hits=0, jobs=[];
            // Wichtig: InDesign muss die Topic-Struktur VOR den Suchtreffern
            // veraendern, nicht zwischen findGrep() und pageReferences.add().
            var target, letter=grouping.value ? letterOf(entry.sort || entry.name) : "";
            try {
                if(grouping.value && !letter) throw Error("Kein Alef-Bet-Buchstabe in '"+entry.name+"'.");
                if(grouping.value) {
                    var already=true;
                    try {rootTopic(idx,letter);} catch (_) {already=false;}
                    target=groupedTopic(idx,letter,entry.name,true);
                    if(!already) stats.groups++;
                } else target=lookup(idx,entry.name);
                if (!hasSymbols(idx)) throw Error("Nach dem Topic fehlt der Indexabschnitt 'Symbols'. Lauf angehalten.");
                if (entry.sub) target=lookup(target,entry.sub);
                if(target.pageReferences.length<0)throw Error("Topic ohne PageReferences-Sammlung");
                pages=existingPages(target);
            } catch (topicError) {
                failures.push("Topic vor Suche '"+entry.name+"': "+err(topicError));
                if (stats.refs===0) {stopped=true;break;}
                continue;
            }
            var parts=[];
            for (j=0; j<entry.forms.length; j++) {
                var ptn=pattern(entry.forms[j], entry.niqqud);
                if (ptn) parts.push("(?:"+ptn+")");
            }
            status("Suche " + (i+1) + "/" + count + ": " + entry.term, i);
            if (parts.length) {
                try {
                    // Varianten in nur EINER Dokument-Suche statt eine Suche je Variante.
                    app.findGrepPreferences.findWhat=parts.join("|");
                    var found=doc.findGrep();
                    for (k=0; k<found.length; k++) {
                        var t=found[k], rejected=false;
                        try {
                            var para=t.paragraphs[0], style=String(para.appliedParagraphStyle.name).toLowerCase();
                            rejected=!!nativeCfg.excludedStyles[style];
                        } catch (_) {}
                        if(rejected) {stats.filtered++; continue;}
                        var pg=pageOf(t);
                        if (!pg) { stats.unpaged++; continue; }
                        var pageKey=String(pg.id);
                        if (pages[pageKey]) continue;
                        try {
                            var ip=t.insertionPoints.item(0);
                            // Eine konkrete Fundstelle pro Topic und Seite.
                            var story=ip.parentStory;
                            jobs.push({entry:entry, found:t, story:story, storyId:String(story.id), pos:ip.index,
                                page:pg.name, term:entry.name});
                            pages[pageKey]=true; hits++; stats.hits++;
                        } catch (posError) { failures.push("Fundstelle " + entry.term + ": " + err(posError)); }
                    }
                } catch (grepError) { failures.push("GREP " + entry.term + ": " + err(grepError)); }
            }
            if (!hits) {
                var hadPage=false;
                for(var pk in pages) if(pages.hasOwnProperty(pk)) {hadPage=true;break;}
                if(!hadPage) stats.missing++;
            }
            if (jobs.length) status("Schreibe " + (i+1) + "/" + count + ": " + entry.term, i);
            // Zuerst spaete Positionen: eingefuegte Marken veraendern keine frueheren Offsets.
            jobs.sort(function (a,b) { if(a.storyId === b.storyId) return b.pos-a.pos;
                return a.storyId < b.storyId ? -1 : 1; });
            for (j=0; j<jobs.length; j++) {
                var job=jobs[j], e=job.entry, name=e.name, topic;
                try {
                    // Jeder Zugriff auf den Index frisch; alte Specifier sind nach
                    // dem Setzen von Marken in einer langen Story nicht stabil.
                    topic=grouping.value ? groupedTopic(idx,letter,name,false) : rootTopic(idx,name);
                    if (e.sub) topic=topic.topics.itemByName(e.sub);
                    // Direkte Fundstelle zuerst; rekonstruierte Story-Position nur
                    // als Fallback. Wichtig bei unabhaengig verketteten Textfluesen.
                    var method=addAtMatch(topic,job);
                    if (stats.refs===0) report.push("Erster erfolgreicher Anker: "+method);
                    stats.refs++; failStreak=0;
                    if (!done[i]) {stats.topics++;done[i]=true;}
                } catch (writeError) {
                    failures.push("PageRef '" + name + "' S." + job.page + " Story " + job.storyId +
                        " Pos " + job.pos + ": " + err(writeError));
                    failStreak++;
                    if (failStreak >= 8 && stats.refs === 0) {
                        failures.push("Abbruch nach 8 Fehlern ohne erfolgreichen Seitenverweis."); stopped=true; break;
                    }
                }
            }
            if (jobs.length) {
                try {
                    var fresh=grouping.value ? groupedTopic(idx,letter,entry.name,false) : rootTopic(idx,entry.name);
                    if (entry.sub) fresh=fresh.topics.itemByName(entry.sub);
                    var actual=fresh.pageReferences.length;
                    stats.verified+=actual;
                    if (grouping.value && actual>0) migrated[entry.name]=true;
                    report.push("Topic '"+entry.name+"': "+actual+" native Verweise nach Suchlauf");
                } catch (verifyError) {
                    report.push("Topic '"+entry.name+"' Nachpruefung: "+err(verifyError));
                }
            }
            status("Fertig: " + entry.term, i+1);
        }
        if (grouping.value && replaceFlat.value) {
            report.push("Flache HE-Topics nach erfolgreicher Gruppierung entfernt: "+removeFlatHebrew(doc,migrated,cleanupWarnings));
        }
        try { idx.update(); } catch (_) {}
        try {
            var sections=[];
            for (var sec=0; sec<idx.indexSections.length; sec++) {
                sections.push(String(idx.indexSections[sec].name));
            }
            report.push("InDesign-Indexabschnitte: " + sections.join(" | "));
        } catch (_) {}
    } catch (fatal) { failures.push("Abbruch: " + err(fatal)); }
    finally {
        try { progress.close(); } catch (_) {}
        try { app.findGrepPreferences=NothingEnum.NOTHING; app.findGrepPreferences.properties=prevGrep; } catch (_) {
            try { app.findGrepPreferences=NothingEnum.NOTHING; } catch (__) {} }
        try { app.findChangeGrepOptions.properties=prevOptions; } catch (_) {}
    }
    report.push("Verarbeitete Begriffe: " + i + (stopped ? " (vorzeitig beendet)" : ""),
        "Gefundene Seiten: " + stats.hits, "Alef-Bet-Gruppen neu: " + stats.groups,
        "Topics mit Fundstellen: " + stats.topics,
        "Schreibaufrufe ohne Fehler: " + stats.refs, "Nativ nachpruefbare Verweise: " + stats.verified,
        "Begriffe ohne Treffer: " + stats.missing,
        "Treffer ohne Layoutseite: " + stats.unpaged, "Treffer aus Absatzformat-Filter: " + stats.filtered, "Fehler: " + failures.length);
    for (i=0;i<failures.length;i++) report.push(failures[i]);
    for (i=0;i<cleanupWarnings.length;i++) report.push("Hinweis: "+cleanupWarnings[i]);
    var logfile=writeLog(file,report);
    alert("IndexBuilder HE abgeschlossen.\n\n" + "Verweise (Schreibaufrufe): " + stats.refs +
        "\nNativ nachpruefbar: " + stats.verified +
        "\nBegriffe im Lauf: " + count + " / " + entries.length +
        "\nAlef-Bet-Gruppen neu: " + stats.groups +
        "\nBegriffe ohne Treffer: " + stats.missing +
        "\nTreffer ohne Layoutseite: " + stats.unpaged + "\nDurch Formatfilter ausgelassen: " + stats.filtered + "\nFehler: " + failures.length +
        "\nHinweise zur Bereinigung: " + cleanupWarnings.length +
        "\n\nBericht: " + logfile + (failures.length ? "\n\nErster Fehler: " + failures[0] : "") +
        "\n\nIndex-Bedienfeld: Referenzansicht waehlen; danach Index generieren.");
})();

    }

    /* ================================================================== *
     * 14. Modus-Auswahl beim Start
     * ================================================================== */

    function showModeDialog() {
        var dlg = new Window("dialog", "IndexBuilder HE " + VERSION);
        dlg.orientation = "column"; dlg.alignChildren = "fill";
        dlg.margins = 16; dlg.spacing = 10;

        var head = dlg.add("statictext", undefined, "Was möchtest du tun?");
        head.graphics.font = ScriptUI.newFont(head.graphics.font.name, "BOLD", 14);

        var grp = dlg.add("panel");
        grp.orientation = "column"; grp.alignChildren = "left"; grp.margins = 12; grp.spacing = 6;
        var rbIndex = grp.add("radiobutton", undefined, "Stichwortverzeichnis erzeugen");
        var rbCands = grp.add("radiobutton", undefined,
            "Wortlisten-Kandidaten aus dem Dokument extrahieren – " +
            (SCRIPT_MODE === "hebrew" ? "nur hebräische Wörter" : "nur deutsche/lateinische Wörter"));
        rbIndex.value = true;

        var hint1 = grp.add("statictext", undefined,
            "     – Wortlisten laden, Filter setzen, HTML/JSON/nativer Index");
        hint1.graphics.foregroundColor = hint1.graphics.newPen(
            hint1.graphics.PenType.SOLID_COLOR, [.4, .4, .4, 1], 1);
        var hint2 = grp.add("statictext", undefined,
            "     – Häufige Wörter finden, Stoppwörter filtern, auswählen, als CSV speichern");
        hint2.graphics.foregroundColor = hint2.graphics.newPen(
            hint2.graphics.PenType.SOLID_COLOR, [.4, .4, .4, 1], 1);

        var grpBtn = dlg.add("group"); grpBtn.alignment = "right";
        var btnCancel = grpBtn.add("button", undefined, "Abbrechen", { name: "cancel" });
        var btnNext = grpBtn.add("button", undefined, "Weiter", { name: "ok" });

        styleWorkflowText(head,UI_BLUE,"Arbeitsmodus wählen: Kandidatenanalyse oder Indexerzeugung.");
        styleWorkflowPanel(grp,UI_BLUE);
        styleWorkflowChoice(rbIndex,UI_MAGENTA,"Magenta: bestehenden Wortlistenindex erzeugen.");
        styleWorkflowChoice(rbCands,UI_GREEN,"Grün: neue Wortlisten-Kandidaten analysieren.");
        styleWorkflowButton(btnNext,UI_BLUE,"Mit dem gewählten Arbeitsmodus fortfahren.");
        styleWorkflowButton(btnCancel,UI_ORANGE,"IndexBuilder schließen.");

        var r = dlg.show();
        if (r !== 1) return null;
        return rbCands.value ? "candidates" : "index";
    }

    function quickDocumentStyles(doc) {
        var result=[], seen={}, styles;
        try { styles=doc.allParagraphStyles; } catch (_) {}
        if(!styles) styles=doc.paragraphStyles;
        for(var s=0;s<styles.length;s++) {
            try {
                var n=String(styles[s].name);
                if(!seen[n]) {result.push({name:n,count:"?"});seen[n]=true;}
            } catch (_) {}
        }
        result.sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0;});
        return result;
    }

    /* ================================================================== *
     * 15. Hauptablauf
     * ================================================================== */

    function main() {
        if (app.documents.length === 0) {
            alert("Kein Dokument geöffnet. Bitte zuerst ein Dokument in InDesign öffnen.");
            return;
        }
        var doc = app.activeDocument;

        var mode = showModeDialog();
        if (!mode) return;
        var cfgFast=null;
        if(mode === "index") {
            cfgFast=showSetupDialog(quickDocumentStyles(doc), [], {reverseHebrew:false});
            if(!cfgFast) return;
            if(cfgFast.writeNative) {
                cfgFast.doc=doc;
                runBenIshChaiNativeIndex(cfgFast);
            }
            if(!cfgFast.exportHtml && !cfgFast.exportJson) return;
            // HTML/JSON bleiben im bisherigen Dokumentmodell erhalten.
            cfgFast.writeNative=false;
        }

        // CS6-Modus: einmal abfragen, bevor das Dokument gelesen wird.
        // Für Index-Modus wird das später im Setup-Dialog nochmal gezeigt,
        // dort ist das aber nur informativ – gelesen wird jetzt.
        var reverseHebrew = confirm(
            "Hat dein Dokument reverse hebräischen Text?\n\n" +
            "Ja  = InDesign CS5/CS6-Kompatibilität (Text wird intern gespiegelt)\n" +
            "Nein = normales InDesign 18.1 mit World-Ready Composer\n\n" +
            "Faustregel: 'Ja' wählen, wenn hebräische Wörter in älteren Skripten\n" +
            "als ורתי statt יתרו auftauchen.");

        // Dokument lesen
        var scanWin = new Window("palette", "IndexBuilder – Lese Dokument …");
        scanWin.orientation = "column"; scanWin.alignChildren = "fill"; scanWin.margins = 16;
        var scanLbl = scanWin.add("statictext", undefined, "Bitte warten …");
        scanLbl.characters = 60;
        styleWorkflowText(scanLbl,UI_BLUE,"Blau: Dokument und Absatzformate werden als Arbeitsgrundlage gelesen.");
        scanWin.show();
        var corpus;
        try {
            corpus = readActiveDocument({
                includeFootnotes: true, includeTables: true,
                reverseHebrew: reverseHebrew
            });
        } catch (e) {
            scanWin.close(); alert("Lesefehler:\n" + e.message); return;
        }
        scanLbl.text = "Corpus: " + corpus.paragraphs.length + " Absätze";
        scanWin.close();

        var styles = collectParagraphStyles(corpus);

        /* ============ Modus 2: Kandidaten-Extraktion ============ */
        if (mode === "candidates") {
            // Optional: bestehende Wortliste(n) laden, damit deren Begriffe ausgeblendet werden
            var loadKnown = confirm(
                "Möchtest du eine bestehende Wortliste laden (z. B. common.csv),\n" +
                "damit deren Begriffe nicht als Kandidaten auftauchen?\n\n" +
                "Ja = Datei wählen, Nein = ohne Vorfilter");
            var existing = [];
            if (loadKnown) {
                var files = File.openDialog("Bestehende Wortliste(n) wählen",
                    "Wortlisten:*.json;*.csv;*.tsv;*.txt", true);
                if (files) {
                    if (!isArray(files)) files = [files];
                    for (var fi = 0; fi < files.length; fi++) {
                        try {
                            var txt = readTextFile(files[fi]);
                            var ext = ("" + files[fi].name).replace(/^.*\./, "").toLowerCase();
                            var pr = parseWordlist(txt, ext);
                            for (var pj = 0; pj < pr.entries.length; pj++) existing.push(pr.entries[pj]);
                        } catch (e) { logWarn("Wortliste " + files[fi].name + ": " + e.message); }
                    }
                }
            }
            var globals = { foldHistorical: true };
            var res = showCandidatesDialog(corpus, existing, styles, globals);
            if (res) {
                alert("Wortliste gespeichert:\n" + res.file.fsName + "\n\n" +
                      res.count + " Einträge übernommen.\n\n" +
                      "Beim nächsten Index-Lauf zusätzlich zu common.csv laden.");
            }
            return;
        }

        /* ============ Modus 1: Index erzeugen ============ */
        var cfg = cfgFast || showSetupDialog(styles, [], { reverseHebrew: reverseHebrew });
        if (!cfg) return;

        // Wortlisten laden
        var allEntries = [];
        var srcSummary = [];
        for (var wi = 0; wi < cfg.wordlists.length; wi++) {
            var wlFile = cfg.wordlists[wi];
            var wlText;
            try { wlText = readTextFile(wlFile); }
            catch (e) {
                alert("Wortliste nicht lesbar:\n" + wlFile.fsName + "\n\n" + e.message);
                return;
            }
            var ext2 = ("" + wlFile.name).replace(/^.*\./, "").toLowerCase();
            var parsed = parseWordlist(wlText, ext2);
            for (var pe = 0; pe < parsed.errors.length; pe++) {
                logWarn(wlFile.name + ": " + parsed.errors[pe]);
            }
            srcSummary.push(wlFile.name + " (" + parsed.entries.length + ")");
            for (var pi2 = 0; pi2 < parsed.entries.length; pi2++) allEntries.push(parsed.entries[pi2]);
        }
        if (!allEntries.length) {
            alert("Keine gültigen Wortlisten-Einträge.\n\n" + srcSummary.join("\n"));
            return;
        }
        logInfo("Wortlisten: " + srcSummary.join(", "));

        // Wortlisten-Hygiene: Stoppwörter/Nicht-Index-Wörter aussieben.
        // Kuratierte Einträge (mit Varianten/sortKey/Querverweisen) bleiben
        // grundsätzlich unangetastet.
        var cleanedEntries = cleanupWordlist(allEntries);
        if (cleanedEntries === null) return;   // Abbruch durch Nutzer
        allEntries = cleanedEntries;
        if (!allEntries.length) {
            alert("Nach der Wortlisten-Bereinigung sind keine Einträge übrig.");
            return;
        }


        // Titelei/Musterseiten: Absätze auf Seiten ohne numerische
        // Seitenzahl (z. B. "a", "II", "IV") oder ohne Seitenzuordnung
        // erzeugen sinnlose Verweise wie "a, II" im Index – optional raus.
        var nonNumPages = 0;
        for (var nn = 0; nn < corpus.paragraphs.length; nn++) {
            var pgN = corpus.paragraphs[nn].page;
            if (pgN == null || !/^\d+$/.test(String(pgN))) nonNumPages++;
        }
        if (nonNumPages > 0 && confirm(
            nonNumPages + " Absätze liegen auf Seiten ohne numerische Seitenzahl\n" +
            "(Titelei/römische Paginierung, z. B. \u201Ea\u201C, \u201EII\u201C, \u201EIV\u201C) oder ohne Seitenzuordnung.\n\n" +
            "Diese vom Index ausschließen? (empfohlen)")) {
            var keptNum = [];
            for (var nk = 0; nk < corpus.paragraphs.length; nk++) {
                var pgK = corpus.paragraphs[nk].page;
                if (pgK == null || !/^\d+$/.test(String(pgK))) continue;
                keptNum.push(corpus.paragraphs[nk]);
            }
            corpus.paragraphs = keptNum;
        }

        // Fußnoten/Tabellen ausfiltern falls abgewählt
        if (!cfg.includeFootnotes || !cfg.includeTables) {
            var kept = [];
            for (var kk = 0; kk < corpus.paragraphs.length; kk++) {
                var ps = corpus.paragraphs[kk].storySource;
                if (ps === "footnote" && !cfg.includeFootnotes) continue;
                if (ps === "table" && !cfg.includeTables) continue;
                kept.push(corpus.paragraphs[kk]);
            }
            corpus.paragraphs = kept;
        }

        // Suchen
        var globals2 = { foldHistorical: cfg.foldHistorical };
        var prepped = buildLookup(allEntries, globals2);

        var searchWin = new Window("palette", "IndexBuilder – Suche läuft");
        searchWin.orientation = "column"; searchWin.alignChildren = "fill"; searchWin.margins = 16;
        var sLbl = searchWin.add("statictext", undefined, "Starte …");
        sLbl.characters = 60;
        var sBar = searchWin.add("progressbar", undefined, 0, 100);
        sBar.preferredSize.width = 400;
        styleWorkflowText(sLbl,UI_GREEN,"Grün: Wortlisten werden im Dokument gesucht und analysiert.");
        styleWorkflowField(sBar,UI_GREEN);
        searchWin.show();

        var matches = findMatches(corpus, prepped, function (done, total, m) {
            sLbl.text = "Absatz " + done + " / " + total + " – " + m + " Treffer";
            sBar.value = Math.round(100 * done / total);
            searchWin.update();
        }, cfg.excludedStyles);

        sLbl.text = "Treffer: " + matches.length + " – führe zusammen …";
        sBar.value = 90; searchWin.update();
        var occs = mergeMatches(matches);
        var idx = generateIndex(occs, {
            rangeMinRun: 3,
            hebrewFirst: cfg.hebrewFirst
        });
        idx._reverseHebrew = reverseHebrew;   // Weitergabe an nativen Writer
        searchWin.close();

        if (idx.stats.entries === 0) {
            alert("Keine Indexeinträge für dieses Skript (" +
                  (SCRIPT_MODE === "hebrew" ? "Hebräisch" : "Deutsch/Lateinisch") +
                  ") gefunden.\n\n" +
                  "Treffer: " + matches.length + "\n" +
                  (idx.stats.filteredOut ? "Andere Schrift (übernimmt " + OTHER_SCRIPT + "): " +
                      idx.stats.filteredOut + " Einträge\n" : "") +
                  (matches._skippedByFilter ? "Vom Format-Filter übersprungen: " +
                      matches._skippedByFilter + " Absätze\n" : "") +
                  "Prüfen: Wortliste, Formatfilter, historische Rechtschreibung.");
            return;
        }
        for (var w2 = 0; w2 < idx.warnings.length; w2++) logWarn(idx.warnings[w2]);

        // Export
        var baseName = doc.name.replace(/\.indd$/i, "") + "-index-" + FILE_SUFFIX;
        var meta = { title: "Stichwortverzeichnis", documentName: doc.name };

        if (cfg.exportHtml) {
            var htmlFile = pickSaveFile("HTML-Export speichern",
                baseName + ".html", "HTML:*.html");
            if (htmlFile) {
                try {
                    if (!/\.html?$/i.test(htmlFile.name)) htmlFile = new File(htmlFile.fsName + ".html");
                    writeTextFile(htmlFile, toHTML(idx, meta));
                    logInfo("HTML: " + htmlFile.fsName);
                } catch (e) { logError("HTML-Export: " + e.message); }
            }
        }
        if (cfg.exportJson) {
            var jsonFile = pickSaveFile("JSON-Export speichern",
                baseName + ".json", "JSON:*.json");
            if (jsonFile) {
                try {
                    if (!/\.json$/i.test(jsonFile.name)) jsonFile = new File(jsonFile.fsName + ".json");
                    writeTextFile(jsonFile, toJSON(idx, meta));
                    logInfo("JSON: " + jsonFile.fsName);
                } catch (e) { logError("JSON-Export: " + e.message); }
            }
        }

        // Nativer Index
        var writeReport = null;
        if (cfg.writeNative) {
            if (!isNativeIndexSupported(doc)) {
                alert("Native Index-API ist in diesem Host nicht verfügbar.");
            } else if (confirmNativeWrite(idx)) {
                var wWin = new Window("palette", "IndexBuilder – Schreibe Index");
                wWin.orientation = "column"; wWin.alignChildren = "fill"; wWin.margins = 16;
                var wLbl = wWin.add("statictext", undefined, "0 / 0");
                wLbl.characters = 40;
                var wBar = wWin.add("progressbar", undefined, 0, 100);
                wBar.preferredSize.width = 300;
                styleWorkflowText(wLbl,UI_MAGENTA,"Magenta: native Indexeinträge und Seitenverweise werden geschrieben.");
                styleWorkflowField(wBar,UI_MAGENTA);
                wWin.show();
                writeReport = writeNativeIndex(doc, idx, function (done, total) {
                    wLbl.text = done + " / " + total;
                    wBar.value = Math.round(100 * done / total);
                    wWin.update();
                });
                wWin.close();
                for (var wi2 = 0; wi2 < writeReport.errors.length; wi2++) logError(writeReport.errors[wi2]);
            }
        }

        // Ergebnis
        var counts = idx.stats.sectionCounts || {};
        var byScript = [];
        if (counts.latin)  byScript.push("Lateinisch: " + counts.latin);
        if (counts.hebrew) byScript.push("Hebräisch: "  + counts.hebrew);
        if (counts.other)  byScript.push("Andere: "     + counts.other);
        var msg = "IndexBuilder abgeschlossen.\n\n" +
              matches.length + " Treffer" +
              (matches._skippedByFilter ? " (" + matches._skippedByFilter +
                  " Absätze durch Format-Filter übersprungen)" : "") + "\n" +
              idx.stats.entries + " Einträge insgesamt (" + byScript.join(", ") + ")\n" +
              idx.stats.subentries + " Untereinträge";
        if (writeReport) {
            msg += "\n\nNativer Index:\n" +
                writeReport.topics + " Topics (Latein: " + writeReport.latinTopics +
                    ", Hebräisch: " + writeReport.hebrewTopics + "), " +
                writeReport.subtopics + " Subtopics, " +
                writeReport.pageRefs + " Seitenverweise";
            if (writeReport.skipped) {
                var sk = writeReport.skipReasons;
                msg += "\n" + writeReport.skipped + " übersprungen (" +
                    "kein Body: " + sk.noMatch + ", " +
                    "Text-Mismatch: " + sk.textMismatch + ", " +
                    "Story fehlt: " + sk.noStory + ", " +
                    "Range: " + sk.badRange +
                    (sk.otherError ? ", Fehler: " + sk.otherError : "") + ")";
            }
            if (writeReport.errors.length) msg += "\n" + writeReport.errors.length + " Fehler-Meldungen";
            msg += "\n\nIndex: \u201E" + writeReport.indexName + "\u201C" +
                (writeReport.indexId != null ? " (ID " + writeReport.indexId + ")" : "");
            if (writeReport.purgedTopics) msg += "\n" + writeReport.purgedTopics + " vorhandene Eintr\u00e4ge vorab entfernt";
            if (writeReport.letterGroups) msg += "\n" + writeReport.letterGroups + " Alef-Bet-Buchstabengruppen angelegt";
            if (writeReport.relocated)    msg += "\n" + writeReport.relocated + " Seitenverweise automatisch re-synchronisiert";
            msg += "\n\nZwei-Index-Workflow (InDesign erlaubt nur EINEN Index):" +
                "\n1. Jetzt: Layout \u2192 Index \u2192 Index generieren \u2192 Rahmen aufziehen." +
                "\n2. Danach " + OTHER_SCRIPT + " ausf\u00fchren und dort das L\u00f6schen" +
                "\n    der vorhandenen Eintr\u00e4ge best\u00e4tigen." +
                "\n3. Beim zweiten Generieren \u201EVorhandenen Index ersetzen\u201C ABW\u00c4HLEN \u2013" +
                "\n    der zuerst generierte Index bleibt als normaler Text im Layout stehen.";
        }
        if (LOG.errors.length)   msg += "\n\n" + LOG.errors.length   + " Fehler";
        if (idx.warnings.length) msg += "\n" + idx.warnings.length + " Querverweis-Warnungen";
        alert(msg);
    }

    // Fehler nie still: alles in einen alert() eskalieren
    try { main(); }
    catch (e) {
        alert("IndexBuilder – unerwarteter Fehler:\n\n" + e.message +
              (e.line ? "\n(Zeile " + e.line + ")" : ""));
    }
})();
