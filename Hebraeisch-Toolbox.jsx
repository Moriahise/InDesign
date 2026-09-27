/*
================================================================================
  HEBRÄISCH-TOOLBOX FÜR ADOBE INDESIGN
  Version 1.6  ·  getestet für InDesign 18.1 (2023), ExtendScript

  Vereint die bisher getrennten Skripte in einer Palette:
    1. Schriften & Absatz   – Hebräisch/Lateinisch mischen, Größe, Ausrichtung,
                              World-Ready-Setzer, Absatzrichtung
    2. Transliteration      – Hebräisch → wissenschaftliche, vereinfachte
                              oder modern-israelische Umschrift, auf Wunsch
                              mit vorgeschalteter Vokalisierung (Dicta Nakdan)
    3. Stapel (Buch)        – ein Skript oder Modul 1 über alle Dokumente eines
                              Buches laufen lassen, optional speichern/schließen
    4. Dokument & Layout    – NEU in 1.1: Buchgerüst anlegen (Seitenformat,
                              Ränder, Bindung links/rechts, Musterseite mit
                              Grundtextrahmen, Seitenzahlen auch in hebräischen
                              Buchstaben, Absatzformate, Beispielinhalt)
    5. Hilfe                – Erklärungen zu allen Feldern

  NEU IN VERSION 1.6
    Behoben: Nakdan lieferte für jede Markierung dasselbe Ergebnis, meist
    שָׁלוֹם עוֹלָם aus der Verbindungsprobe. Der Schlüssel des Zwischenspeichers
    enthielt ein Nullzeichen, und ExtendScript schneidet Eigenschaftsnamen
    dort ab – dadurch fielen alle Einträge auf einen einzigen zusammen.
    Der Schlüssel trennt jetzt mit ‖, die Verbindungsprobe umgeht den
    Speicher ganz, und ein Wechsel von Stil oder Server leert ihn.

  NEU IN VERSION 1.5
    Nakdan behoben: Zwischen den Wörtern erschien „undefined“, und im Text
    klebten sie zusammen (shalomolam). Ursache waren die Trennzeichen in
    Dictas Antwort, die je nach Fassung unter anderen Feldnamen stehen.
    Das Skript wertet jetzt nur noch die punktierten Wörter aus und setzt
    sie an die Stellen der unpunktierten im Originaltext – Leerzeichen,
    Satzzeichen und Zeilenumbrüche bleiben dadurch unangetastet.
    Passt die Wortzahl nicht zusammen, bricht der Lauf mit Meldung ab,
    statt lückenhaften Text zu liefern.

  NEU IN VERSION 1.4
    Vokalisierung ohne Internet: Das Skript bringt ein Wörterbuch mit rund
    12000 punktierten hebräischen Wortformen mit (hebräisches Wiktionary über
    den Datensatz von TaatikNet, CC BY-SA 3.0). Unbekannte Wörter werden über
    Vorsilben zerlegt und sonst nach Regeln der vollen Schreibung geraten.
    Damit wird aus שלום עולם auch offline shalom olam statt shlvm vlm.
    Die Quelle der Punktation ist jetzt eine Auswahlliste: aus, Wörterbuch,
    Nakdan, oder Nakdan mit dem Wörterbuch als Rückfallebene.
    Behoben: In Fassung 1.3 lieferte die Nakdan-Antwort „undefinedundefined“,
    weil Dicta die Feldnamen geändert hat. Die Auswertung sucht jetzt die
    punktierte Zeichenkette selbst, statt auf feste Feldnamen zu bauen.

  NEU IN VERSION 1.3
    Reiter „Transliteration“: Anbindung an den Nakdan von Dicta
    (nakdan.dicta.org.il). Unpunktierter Text wird vor der Umschrift
    automatisch vokalisiert, damit aus שלום nicht shlvm, sondern shalom wird.
    Zusätzlich lässt sich die Punktation direkt in das Dokument einsetzen.
    Da ExtendScript kein HTTPS beherrscht, läuft die Anfrage über curl
    (macOS und Windows) bzw. ersatzweise über MSXML2.ServerXMLHTTP (Windows).
    Die Antwort wird mit einem eigenen JSON-Leser ausgewertet, nicht mit eval.

  NEU IN VERSION 1.2
    Reiter „Transliteration“: drittes Verfahren „vereinfachtes modernes
    Ivrit“ – gibt die heutige israelische Aussprache wieder (shalom,
    yerushalayim, midrash). Der Algorithmus ist die nach ExtendScript
    übersetzte Fassung des Moduls „Translit“ aus index.html; die Regeln
    sind unverändert. Die Wahl des Verfahrens erfolgt jetzt über eine
    Auswahlliste statt über Schalter; nicht zuständige Optionen
    (Schwa, Lesemütter, Gemination) werden dabei abgeblendet.

  NEU IN VERSION 1.1
    Reiter „Dokument & Layout“ ersetzt die Einzelskripte
      A5-Midrasch.jsx, A5-MidraschHE.jsx, A5-MidraschHE – Seitenzahl.jsx,
      A5-Midrasch-mit-Seitenzahlen-DE.jsx, A5-Midrasch-mit-Seitenzahlen-HE.jsx,
      A5-Midrash-layout-Band-II.jsx
    Dabei behoben:
      · Seitenzahlen lagen bisher als starrer Text auf jeder Einzelseite; jetzt
        wahlweise als echte automatische Seitenzahl auf der Musterseite.
      · Die hebräische Zahlwertfunktion konnte nur bis 400 zählen und setzte
        Geresch/Gerschajim falsch; jetzt korrekt bis 9999 samt טו/טז.
      · Rahmenkoordinaten waren feste Zahlen für A5; jetzt aus Seitengröße und
        Rändern berechnet, also für jedes Format gültig.
      · Bundsteg und Außensteg werden je nach Buchseite richtig gespiegelt.
      · Fehlende Schriften führten zum Abbruch; jetzt Meldung und Weiterlauf.
      · Alles läuft in einem einzigen Widerrufsschritt.

  INSTALLATION
    Datei ablegen in:
      Windows: C:\Users\<Name>\AppData\Roaming\Adobe\InDesign\Version 18.0\de_DE\
               Scripts\Scripts Panel\
      macOS:   ~/Library/Preferences/Adobe InDesign/Version 18.0/de_DE/
               Scripts/Scripts Panel/
    Danach in InDesign: Fenster > Hilfsprogramme > Skripte > Doppelklick.

  WICHTIG: Die Datei muss als UTF-8 gespeichert bleiben (am besten mit BOM),
  sonst werden Umlaute und Sonderzeichen der Umschrift falsch gelesen.

  Grundlage: Skripte von Uwe Laubender und Martin Fischer (Buch-Stapel),
  überarbeitet und zusammengeführt.
================================================================================
*/

#targetengine "HebrewToolbox"

// ============================================================================
// 0 · Namensraum und Voreinstellungen
// ============================================================================

var HT = {};

HT.VERSION = "1.6";
HT.settingsFile = File(Folder.userData + "/HebrewToolbox_settings.txt");

HT.defaults = {
    // Modul 1
    "scope": "selection",              // selection | story | document
    "includeTables": true,
    "applyFonts": true,
    "hebFamily": "Keter YG",
    "hebStyle": "Medium",
    "latFamily": "Cambria",
    "latStyle": "Regular",
    "neutralMode": "inherit",          // inherit | latin | keep
    "applySize": true,
    "size": 9,
    "sepHebSize": false,
    "hebSize": 10,
    "applyLeading": false,
    "leading": 11,
    "applyJust": true,
    "just": "LEFT_JUSTIFIED",
    "applyComposer": true,
    "composer": "wr_para",             // wr_para | wr_single | para | single
    "applyDirection": false,
    "direction": "ltr",                // ltr | rtl

    // Modul 2
    "trMode": "scientific",            // scientific | simple | ivrit
    "trShva": "auto",                  // auto | schwa | e | none
    "trMatres": true,
    "trDouble": false,
    "trPlacement": "after",            // after | before | replace | preview
    "trTemplate": " [%s]",
    "trFamily": "Noto Sans",
    "trStyle": "Regular",
    "trSize": 6,

    // Modul 2b – Vokalisierung über Dicta Nakdan
    "vocalMode": "dict",               // off | dict | nakdan | nakdan_dict
    "nakdanForce": false,              // auch bei bereits punktiertem Text
    "nakdanGenre": "modern",           // modern | rabbinic | poetry
    "nakdanUrl": "https://nakdan-u1-0.loadbalancer.dicta.org.il/api",

    // Modul 3
    "batchAllBooks": false,
    "batchBook": "",
    "batchAction": "external",         // external | typography
    "batchScript": "",
    "batchSaveClose": true,
    "batchSilent": true,

    // Modul 4 – Dokument & Layout
    "docTarget": "new",                // new | active
    "docPreset": "A5 (148 × 210)",                 // Schlüssel aus HT.pagePresets oder "frei"
    "docWidth": 148,                   // mm
    "docHeight": 210,                  // mm
    "docLandscape": false,
    "docPages": 50,
    "docFacing": true,
    "docBinding": "ltr",               // ltr | rtl
    "docMarginTop": 18,
    "docMarginBottom": 20,
    "docMarginInside": 20,
    "docMarginOutside": 15,
    "docColumns": 1,
    "docGutter": 5,
    "docMasterFrame": true,
    "docPageNumbers": true,
    "docNumStyle": "arabic",           // arabic | hebrew | hebrewNS |
                                       // staticHeb | staticHebDesc | staticDesc
    "docNumPos": "center",             // center | outside | inside
    "docNumDistance": 10,              // mm ab Seitenunterkante
    "docNumSize": 9,
    "docNumHebFont": false,
    "docStyles": true,
    "docStylePrefix": "HT ",
    "docTitleSize": 20,
    "docBodySize": 12,
    "docCommentSize": 9,
    "docSample": false,
    "docSampleLang": "he",             // he | de | en
    "docTitleText": ""
};

// ============================================================================
// 1 · Kleine Helfer (ExtendScript kennt kein JSON, kein Array.indexOf usw.)
// ============================================================================

function inArray(arr, val) {
    for (var i = 0; i < arr.length; i++) { if (arr[i] === val) return i; }
    return -1;
}

function cloneObj(o) {
    var c = {}, k;
    for (k in o) { if (o.hasOwnProperty(k)) c[k] = o[k]; }
    return c;
}

function toNum(str, fallback) {
    var v = parseFloat(String(str).replace(",", "."));
    return isNaN(v) ? fallback : v;
}

function loadSettings() {
    var s = cloneObj(HT.defaults);
    try {
        if (HT.settingsFile.exists) {
            HT.settingsFile.encoding = "UTF-8";
            HT.settingsFile.open("r");
            var txt = HT.settingsFile.read();
            HT.settingsFile.close();
            var o = eval("(" + txt + ")");
            for (var k in o) { if (o.hasOwnProperty(k) && s.hasOwnProperty(k)) s[k] = o[k]; }
        }
    } catch (e) { /* Voreinstellungen behalten */ }
    return s;
}

function saveSettings(s) {
    try {
        HT.settingsFile.encoding = "UTF-8";
        HT.settingsFile.open("w");
        HT.settingsFile.write(s.toSource());
        HT.settingsFile.close();
        return true;
    } catch (e) { return false; }
}

// ---- Schriften -------------------------------------------------------------

function buildFontIndex() {
    var map = {}, families = [], names, i, parts, fam, sty;
    try { names = app.fonts.everyItem().name; } catch (e) { names = []; }
    if (!(names instanceof Array)) { names = (names ? [names] : []); }
    for (i = 0; i < names.length; i++) {
        parts = String(names[i]).split("\t");
        fam = parts[0];
        sty = (parts.length > 1 && parts[1] !== "") ? parts[1] : "Regular";
        if (!map.hasOwnProperty(fam)) { map[fam] = []; families.push(fam); }
        if (inArray(map[fam], sty) < 0) { map[fam].push(sty); }
    }
    families.sort();
    return { "map": map, "families": families };
}

/* Liefert ein Font-Objekt oder null. Fällt notfalls auf einen anderen
   Schnitt derselben Familie zurück. */
function resolveFont(family, style) {
    var f, styles, i;
    try {
        f = app.fonts.itemByName(family + "\t" + style);
        if (f.isValid) return f;
    } catch (e) {}
    styles = HT.fonts.map.hasOwnProperty(family) ? HT.fonts.map[family] : [];
    for (i = 0; i < styles.length; i++) {
        try {
            f = app.fonts.itemByName(family + "\t" + styles[i]);
            if (f.isValid) return f;
        } catch (e2) {}
    }
    return null;
}

// ---- Setzer (Composer) -----------------------------------------------------
/* Die Namen des Setzers sind je nach Programmsprache verschieden. Deshalb wird
   eine Liste möglicher Schreibweisen durchprobiert, bis eine akzeptiert wird. */
HT.composerCandidates = {
    "wr_para": ["Adobe World-Ready Paragraph Composer",
                "Adobe World-Ready-Absatzsetzer",
                "Adobe World-Ready Absatzsetzer",
                "$ID/HL Composer WR",
                "$ID/WRHL Composer"],
    "wr_single": ["Adobe World-Ready Single-line Composer",
                  "Adobe World-Ready-Einzeilensetzer",
                  "$ID/SL Composer WR",
                  "$ID/WRSL Composer"],
    "para": ["Adobe Paragraph Composer", "Adobe Absatzsetzer", "$ID/HL Composer"],
    "single": ["Adobe Single-line Composer", "Adobe Einzeilensetzer", "$ID/SL Composer"]
};

/* Ermittelt einmal pro Lauf den funktionierenden Namen. */
function findComposerName(paragraph, mode) {
    var list = HT.composerCandidates[mode], i, before;
    if (!list) return null;
    for (i = 0; i < list.length; i++) {
        try {
            before = String(paragraph.composer);
            paragraph.composer = list[i];
            return list[i];
        } catch (e) { /* nächster Kandidat */ }
    }
    return null;
}

// ---- Auswahl und Zielbereiche ---------------------------------------------

HT.textKinds = { "Text": 1, "Word": 1, "Character": 1, "Line": 1,
                 "Paragraph": 1, "TextColumn": 1, "TextStyleRange": 1 };

function selectionTexts() {
    var out = [], i, sel, cn;
    if (app.documents.length === 0) return out;
    for (i = 0; i < app.selection.length; i++) {
        sel = app.selection[i];
        cn = sel.constructor.name;
        if (HT.textKinds.hasOwnProperty(cn)) { out.push(sel); continue; }
        if (cn === "InsertionPoint") { continue; }
        try {
            if (sel.hasOwnProperty("texts") && sel.texts[0].characters.length > 0) {
                out.push(sel.texts[0]);
            }
        } catch (e) {}
    }
    return out;
}

/* Ergänzt Tabellenzellen und Fußnoten eines Textbereichs. */
function expandNested(txt, list) {
    var tables, i, cells, c, notes;
    try {
        tables = txt.tables.everyItem().getElements();
        for (i = 0; i < tables.length; i++) {
            cells = tables[i].cells.everyItem().getElements();
            for (c = 0; c < cells.length; c++) {
                try {
                    if (cells[c].texts[0].characters.length > 0) {
                        list.push(cells[c].texts[0]);
                        expandNested(cells[c].texts[0], list);
                    }
                } catch (e1) {}
            }
        }
    } catch (e2) {}
    try {
        notes = txt.footnotes.everyItem().getElements();
        for (i = 0; i < notes.length; i++) {
            if (notes[i].texts[0].characters.length > 0) list.push(notes[i].texts[0]);
        }
    } catch (e3) {}
}

function collectTargets(cfg) {
    var list = [], base = [], i, stories, doc;
    if (cfg.scope === "document") {
        if (app.documents.length === 0) return list;
        doc = app.activeDocument;
        stories = doc.stories.everyItem().getElements();
        for (i = 0; i < stories.length; i++) {
            if (stories[i].characters.length > 0) base.push(stories[i].texts[0]);
        }
    } else if (cfg.scope === "story") {
        var sels = selectionTexts();
        var seen = {};
        for (i = 0; i < sels.length; i++) {
            try {
                var st = sels[i].parentStory;
                if (!seen[st.id]) { seen[st.id] = true; base.push(st.texts[0]); }
            } catch (e) {}
        }
    } else {
        base = selectionTexts();
    }
    for (i = 0; i < base.length; i++) {
        list.push(base[i]);
        if (cfg.includeTables) expandNested(base[i], list);
    }
    return list;
}

function storiesOfDoc(doc) {
    var out = [], stories, i;
    stories = doc.stories.everyItem().getElements();
    for (i = 0; i < stories.length; i++) {
        if (stories[i].characters.length > 0) out.push(stories[i].texts[0]);
    }
    return out;
}

// ============================================================================
// 2 · MODUL 1 – Schriften, Größe, Absatzeinstellungen
// ============================================================================

function charClass(c) {
    var cp = c.charCodeAt(0);
    // Hebräisch inkl. Präsentationsformen
    if ((cp >= 0x0590 && cp <= 0x05FF) || (cp >= 0xFB1D && cp <= 0xFB4F)) return "heb";
    // Latein inkl. Zusatzzeichen und Modifikatoren (ʾ ʿ ḥ ṭ ṣ …)
    if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A) ||
        (cp >= 0x00C0 && cp <= 0x024F) || (cp >= 0x02B0 && cp <= 0x02FF) ||
        (cp >= 0x1E00 && cp <= 0x1EFF)) return "lat";
    return "neutral";
}

/* Zerlegt den Text in zusammenhängende Abschnitte gleicher Schrift.
   Das ist deutlich schneller als Zeichen für Zeichen zu formatieren. */
function buildRuns(s, neutralMode) {
    var runs = [], cur = null, i, cls, last = "lat";
    for (i = 0; i < s.length; i++) {
        cls = charClass(s.charAt(i));
        if (cls === "neutral") {
            if (neutralMode === "latin") { cls = "lat"; }
            else if (neutralMode === "inherit") { cls = last; }
            else { if (cur) { runs.push(cur); cur = null; } continue; }
        } else {
            last = cls;
        }
        if (cur && cur.type === cls) { cur.end = i; }
        else { if (cur) runs.push(cur); cur = { "type": cls, "start": i, "end": i }; }
    }
    if (cur) runs.push(cur);
    return runs;
}

function applyTypography(cfg, targets, log) {
    var hebFont = null, latFont = null, trFontMissing = [];
    var composerName = null, composerTried = false;
    var i, t, txt, contents, story, offset, runs, r, run, fnt, count = 0, paraCount = 0;

    if (cfg.applyFonts) {
        hebFont = resolveFont(cfg.hebFamily, cfg.hebStyle);
        latFont = resolveFont(cfg.latFamily, cfg.latStyle);
        if (!hebFont) trFontMissing.push(cfg.hebFamily + " " + cfg.hebStyle);
        if (!latFont) trFontMissing.push(cfg.latFamily + " " + cfg.latStyle);
    }

    for (t = 0; t < targets.length; t++) {
        txt = targets[t];
        try { contents = txt.contents; } catch (e) { continue; }
        if (typeof contents !== "string" || contents.length === 0) continue;

        try { story = txt.parentStory; offset = txt.insertionPoints[0].index; }
        catch (e) { continue; }

        // --- Schriften
        if (cfg.applyFonts && (hebFont || latFont)) {
            runs = buildRuns(contents, cfg.neutralMode);
            for (r = 0; r < runs.length; r++) {
                run = runs[r];
                fnt = (run.type === "heb") ? hebFont : latFont;
                if (!fnt) continue;
                try {
                    story.characters.itemByRange(offset + run.start, offset + run.end)
                         .appliedFont = fnt;
                } catch (e) { log("Schrift nicht zuweisbar: " + e); }
            }
        }

        // --- Schriftgrad
        if (cfg.applySize) {
            try {
                if (cfg.sepHebSize) {
                    runs = buildRuns(contents, cfg.neutralMode);
                    for (r = 0; r < runs.length; r++) {
                        run = runs[r];
                        story.characters.itemByRange(offset + run.start, offset + run.end)
                             .pointSize = (run.type === "heb") ? cfg.hebSize : cfg.size;
                    }
                } else {
                    txt.pointSize = cfg.size;
                }
            } catch (e) { log("Schriftgrad nicht zuweisbar: " + e); }
        }

        // --- Zeilenabstand
        if (cfg.applyLeading) {
            try { txt.leading = cfg.leading; }
            catch (e) { log("Zeilenabstand nicht zuweisbar: " + e); }
        }

        // --- Absatzeinstellungen
        var paras;
        try { paras = txt.paragraphs; paraCount += paras.length; } catch (e) { paras = null; }
        if (paras && paras.length > 0) {
            if (cfg.applyJust) {
                try { paras.everyItem().justification = Justification[cfg.just]; }
                catch (e) { log("Ausrichtung nicht zuweisbar: " + e); }
            }
            if (cfg.applyComposer) {
                if (!composerTried) {
                    composerTried = true;
                    composerName = findComposerName(paras[0], cfg.composer);
                    if (!composerName) log("Setzer nicht verfügbar – bitte World-Ready-Funktionen prüfen.");
                }
                if (composerName) {
                    try { paras.everyItem().composer = composerName; }
                    catch (e) { log("Setzer nicht zuweisbar: " + e); }
                }
            }
            if (cfg.applyDirection) {
                try {
                    paras.everyItem().paragraphDirection = (cfg.direction === "rtl")
                        ? ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION
                        : ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;
                } catch (e) {
                    log("Absatzrichtung nicht verfügbar (World-Ready-Funktionen nötig).");
                }
            }
        }
        count++;
    }

    if (trFontMissing.length > 0) {
        log("Nicht installiert: " + trFontMissing.join(", "));
    }
    return { "texts": count, "paragraphs": paraCount };
}

function analyzeSelection(cfg) {
    var targets = collectTargets(cfg), i, s, c, cls;
    var heb = 0, lat = 0, neu = 0, chars = 0, paras = 0;
    for (i = 0; i < targets.length; i++) {
        try { s = targets[i].contents; } catch (e) { continue; }
        if (typeof s !== "string") continue;
        chars += s.length;
        try { paras += targets[i].paragraphs.length; } catch (e2) {}
        for (c = 0; c < s.length; c++) {
            cls = charClass(s.charAt(c));
            if (cls === "heb") heb++; else if (cls === "lat") lat++; else neu++;
        }
    }
    return { "targets": targets.length, "chars": chars, "paras": paras,
             "heb": heb, "lat": lat, "neu": neu };
}

// ============================================================================
// 3 · MODUL 2 – Wissenschaftliche Transliteration
// ============================================================================

HT.CONS = {};
function defCons(code, sci, simple, sciRafe, simpleRafe) {
    HT.CONS[code] = { "sci": sci, "simple": simple,
                      "sciRafe": sciRafe, "simpleRafe": simpleRafe };
}
//        Zeichen    wissenschaftl.  vereinfacht  ohne Dagesch (wiss.)  ohne Dagesch (einf.)
defCons("\u05D0", "\u02BE", "",     null, null);       // Alef  ʾ
defCons("\u05D1", "b",      "b",    "\u1E07", "v");    // Bet   b / ḇ
defCons("\u05D2", "g",      "g",    "\u1E21", "g");    // Gimel g / ḡ
defCons("\u05D3", "d",      "d",    "\u1E0F", "d");    // Dalet d / ḏ
defCons("\u05D4", "h",      "h",    null, null);       // He
defCons("\u05D5", "w",      "v",    null, null);       // Waw
defCons("\u05D6", "z",      "z",    null, null);       // Sajin
defCons("\u05D7", "\u1E25", "ch",   null, null);       // Chet  ḥ
defCons("\u05D8", "\u1E6D", "t",    null, null);       // Tet   ṭ
defCons("\u05D9", "y",      "y",    null, null);       // Jod
defCons("\u05DB", "k",      "k",    "\u1E35", "kh");   // Kaf   k / ḵ
defCons("\u05DA", "k",      "k",    "\u1E35", "kh");   // Kaf final
defCons("\u05DC", "l",      "l",    null, null);       // Lamed
defCons("\u05DE", "m",      "m",    null, null);       // Mem
defCons("\u05DD", "m",      "m",    null, null);       // Mem final
defCons("\u05E0", "n",      "n",    null, null);       // Nun
defCons("\u05DF", "n",      "n",    null, null);       // Nun final
defCons("\u05E1", "s",      "s",    null, null);       // Samech
defCons("\u05E2", "\u02BF", "",     null, null);       // Ajin  ʿ
defCons("\u05E4", "p",      "p",    "p\u0304", "f");   // Pe    p / p̄
defCons("\u05E3", "p",      "p",    "p\u0304", "f");   // Pe final
defCons("\u05E6", "\u1E63", "ts",   null, null);       // Zade  ṣ
defCons("\u05E5", "\u1E63", "ts",   null, null);       // Zade final
defCons("\u05E7", "q",      "k",    null, null);       // Qof
defCons("\u05E8", "r",      "r",    null, null);       // Resch
defCons("\u05E9", "\u0161", "sh",   null, null);       // Schin š (Sin siehe unten)
defCons("\u05EA", "t",      "t",    "\u1E6F", "t");    // Taw   t / ṯ

HT.VOWELS = {
    "\u05B0": { "sci": "\u0259", "simple": "e" },   // Schwa      ə
    "\u05B1": { "sci": "\u0115", "simple": "e" },   // Chataf-Segol ĕ
    "\u05B2": { "sci": "\u0103", "simple": "a" },   // Chataf-Patach ă
    "\u05B3": { "sci": "\u014F", "simple": "o" },   // Chataf-Qamez ŏ
    "\u05B4": { "sci": "i",      "simple": "i" },   // Chiriq
    "\u05B5": { "sci": "\u0113", "simple": "e" },   // Zere       ē
    "\u05B6": { "sci": "e",      "simple": "e" },   // Segol
    "\u05B7": { "sci": "a",      "simple": "a" },   // Patach
    "\u05B8": { "sci": "\u0101", "simple": "a" },   // Qamez      ā
    "\u05B9": { "sci": "\u014D", "simple": "o" },   // Cholem     ō
    "\u05BA": { "sci": "\u014D", "simple": "o" },   // Cholem Waw
    "\u05BB": { "sci": "u",      "simple": "u" },   // Qibbuz
    "\u05C7": { "sci": "o",      "simple": "o" }    // Qamez qatan
};

function isHebMark(c) {
    var cp = c.charCodeAt(0);
    return (cp >= 0x0591 && cp <= 0x05BD) || cp === 0x05BF ||
           cp === 0x05C1 || cp === 0x05C2 || cp === 0x05C4 ||
           cp === 0x05C5 || cp === 0x05C7;
}

function firstVowel(marks) {
    var i, c;
    for (i = 0; i < marks.length; i++) {
        c = marks.charAt(i);
        if (HT.VOWELS.hasOwnProperty(c)) return c;
    }
    return null;
}

/* Lange Vokale – nötig für die Regel zum stummen Schwa. */
HT.LONG_VOWELS = "\u05B8\u05B5\u05B9\u05BA";

function vowelText(v, sci, cfg) {
    if (v === "\u05B0") {
        if (cfg.trShva === "none") return "";
        if (cfg.trShva === "e") return "e";
        return sci ? "\u0259" : "e";
    }
    var e = HT.VOWELS[v];
    return sci ? e.sci : e.simple;
}

/* Schwa mobile (gesprochen) oder quiescens (still)?
   Gesprochen ist es am Wortanfang, nach einem langen Vokal, nach einem
   weiteren Schwa und unter einem Konsonanten mit Dagesch forte.
   Am Wortende ist es immer still. */
function shvaIsVocal(atWordStart, atWordEnd, prevLong, prevShva, dagesh) {
    if (atWordEnd) return false;
    if (atWordStart) return true;
    if (prevShva) return true;
    if (dagesh) return true;
    if (prevLong) return true;
    return false;
}

function letterText(info, sci, plosive) {
    if (info.sciRafe === null) return sci ? info.sci : info.simple;
    if (plosive) return sci ? info.sci : info.simple;
    return sci ? info.sciRafe : info.simpleRafe;
}

/* Wandelt hebräischen Text in lateinische Umschrift um.
   Automatik ersetzt keine fachliche Prüfung – Ergebnis bitte durchsehen. */
function transliterate(str, cfg) {
    if (cfg.trMode === "ivrit") return transliterateIvrit(str);
    var sci = (cfg.trMode === "scientific");
    var vocalized = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/.test(str);
    var out = [], i = 0, n = str.length;
    var prevVowel = false, wordStart = true, prevLong = false, prevShva = false;
    var ch, j, marks, dagesh, shinDot, sinDot, vowel, info, letter, k, m2, nxt, k2, m3, after;
    var wasWordStart, atWordEnd, vt, isLong;

    while (i < n) {
        ch = str.charAt(i);

        if (!HT.CONS.hasOwnProperty(ch)) {
            if (ch === "\u05BE") { out.push("-"); wordStart = true; }
            else if (ch === "\u05F3" || ch === "\u05F4" || ch === "\u05C0" || ch === "\u05C3") { /* entfällt */ }
            else if (isHebMark(ch)) { /* verwaistes Zeichen */ }
            else {
                out.push(ch);
                if (charClass(ch) !== "heb") {
                    wordStart = true; prevVowel = false; prevLong = false; prevShva = false;
                }
            }
            i++;
            continue;
        }

        // Diakritika hinter dem Konsonanten einsammeln
        j = i + 1; marks = "";
        while (j < n && isHebMark(str.charAt(j))) { marks += str.charAt(j); j++; }
        dagesh  = marks.indexOf("\u05BC") >= 0;
        shinDot = marks.indexOf("\u05C1") >= 0;
        sinDot  = marks.indexOf("\u05C2") >= 0;
        vowel   = firstVowel(marks);
        info    = HT.CONS[ch];

        // Waw als Vokalbuchstabe: Schuruq (ū) und Cholem male (ō)
        if (ch === "\u05D5" && cfg.trMatres && !wordStart && !prevVowel) {
            if (dagesh && !vowel) {
                out.push(sci ? "\u016B" : "u");
                prevVowel = true; prevLong = true; prevShva = false;
                wordStart = false; i = j; continue;
            }
            if (!dagesh && (vowel === "\u05B9" || vowel === "\u05BA")) {
                out.push(sci ? "\u014D" : "o");
                prevVowel = true; prevLong = true; prevShva = false;
                wordStart = false; i = j; continue;
            }
        }

        // Konsonant
        wasWordStart = wordStart;
        letter = letterText(info, sci, dagesh || !vocalized);
        if (ch === "\u05E9") {
            if (sinDot) letter = sci ? "\u015B" : "s";
            else letter = sci ? "\u0161" : "sh";
        }
        if (cfg.trDouble && dagesh && vocalized && !wasWordStart && prevVowel &&
            "\u05D0\u05D4\u05D7\u05E2\u05E8".indexOf(ch) < 0) {
            letter = letter + letter;
        }
        out.push(letter);

        // Vokal samt Lesemutter
        if (vowel) {
            isLong = HT.LONG_VOWELS.indexOf(vowel) >= 0;
            if (vowel === "\u05B0") {
                atWordEnd = (j >= n) || !HT.CONS.hasOwnProperty(str.charAt(j));
                if (cfg.trShva === "auto") {
                    vt = shvaIsVocal(wasWordStart, atWordEnd, prevLong, prevShva, dagesh)
                         ? (sci ? "\u0259" : "e") : "";
                } else if (atWordEnd && cfg.trShva !== "e") {
                    vt = "";
                } else {
                    vt = vowelText(vowel, sci, cfg);
                }
                out.push(vt);
                prevVowel = (vt !== ""); prevLong = false; prevShva = true;
                wordStart = false; i = j;
                continue;
            }
            vt = vowelText(vowel, sci, cfg);
            if (cfg.trMatres) {
                nxt = (j < n) ? str.charAt(j) : "";
                if (nxt === "\u05D9") {                       // Jod als Lesemutter
                    k = j + 1; m2 = "";
                    while (k < n && isHebMark(str.charAt(k))) { m2 += str.charAt(k); k++; }
                    if (m2.indexOf("\u05BC") < 0 && !firstVowel(m2)) {
                        if (vowel === "\u05B4") { vt = sci ? "\u012B" : "i"; j = k; isLong = true; }
                        else if (vowel === "\u05B5" || vowel === "\u05B6") {
                            vt = sci ? "\u0113" : "e"; j = k; isLong = true;
                        }
                    }
                } else if (nxt === "\u05D4") {                // stummes He am Wortende
                    k2 = j + 1; m3 = "";
                    while (k2 < n && isHebMark(str.charAt(k2))) { m3 += str.charAt(k2); k2++; }
                    after = (k2 >= n) ? "" : str.charAt(k2);
                    if ((k2 >= n || !HT.CONS.hasOwnProperty(after)) &&
                        m3.indexOf("\u05BC") < 0 && !firstVowel(m3)) { j = k2; }
                } else if (nxt === "\u05D5" && vowel === "\u05B9") {
                    k = j + 1; m2 = "";
                    while (k < n && isHebMark(str.charAt(k))) { m2 += str.charAt(k); k++; }
                    if (m2.indexOf("\u05BC") < 0 && !firstVowel(m2)) { j = k; }
                }
            }
            out.push(vt);
            prevVowel = (vt !== "");
            prevLong = isLong;
            prevShva = false;
        } else {
            prevVowel = false;
            prevLong = false;
            prevShva = false;
        }

        wordStart = false;
        i = j;
    }
    return out.join("");
}

// ----------------------------------------------------------------------------
// 3b · Vereinfachtes modernes Ivrit
//      Wortweise Umschrift nach heutiger israelischer Aussprache.
//      Übernommen aus dem Modul „Translit“ der Datei index.html
//      (Sefaria-Studio) und für ExtendScript nach ES3 übersetzt.
//      Die Regeln sind unverändert; nur Sprachmittel wie const, for…of und
//      Pfeilfunktionen wurden ersetzt.
// ----------------------------------------------------------------------------

HT.IV = {};

/* Kantillation und Sonderzeichen, die für die Aussprache ohne Belang sind. */
HT.IV.STRIP = /[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3\u05C4\u05C5\u05C6]/g;

/* Vokalzeichen → gesprochener Vokal (fünf Vokale des modernen Ivrit). */
HT.IV.V = {
    "\u05B1": "e", "\u05B2": "a", "\u05B3": "o",
    "\u05B4": "i", "\u05B5": "e", "\u05B6": "e",
    "\u05B7": "a", "\u05B8": "a", "\u05B9": "o", "\u05BA": "o",
    "\u05BB": "u", "\u05C7": "o"
};

HT.IV.SHVA = "\u05B0";
HT.IV.DAGESH = "\u05BC";
HT.IV.SHIN = "\u05C1";
HT.IV.SIN = "\u05C2";

/* Konsonanten. Ein Array bedeutet: [ohne Dagesch, mit Dagesch]. */
HT.IV.BASE = {
    "\u05D0": "",                    // Alef  – stumm
    "\u05D1": ["v", "b"],            // Bet
    "\u05D2": "g",                   // Gimel
    "\u05D3": "d",                   // Dalet
    "\u05D4": "h",                   // He
    "\u05D5": "v",                   // Waw
    "\u05D6": "z",                   // Sajin
    "\u05D7": "ch",                  // Chet
    "\u05D8": "t",                   // Tet
    "\u05D9": "y",                   // Jod
    "\u05DB": ["kh", "k"],           // Kaf
    "\u05DA": ["kh", "k"],           // Kaf final
    "\u05DC": "l",                   // Lamed
    "\u05DE": "m",                   // Mem
    "\u05DD": "m",                   // Mem final
    "\u05E0": "n",                   // Nun
    "\u05DF": "n",                   // Nun final
    "\u05E1": "s",                   // Samech
    "\u05E2": "",                    // Ajin  – stumm
    "\u05E4": ["f", "p"],            // Pe
    "\u05E3": ["f", "p"],            // Pe final
    "\u05E6": "tz",                  // Zade
    "\u05E5": "tz",                  // Zade final
    "\u05E7": "k",                   // Qof
    "\u05E8": "r",                   // Resch
    "\u05E9": "sh",                  // Schin (Sin über Punkt)
    "\u05EA": "t"                    // Taw
};

/* Buchstabe mit Geresch – Lehnlaute des modernen Ivrit (ג׳ = j, צ׳ = tch …). */
HT.IV.GERESH = {
    "\u05D2": "j", "\u05D6": "zh", "\u05E6": "tch", "\u05E5": "tch",
    "\u05EA": "th", "\u05D3": "dh", "\u05D7": "kh", "\u05E2": ""
};

/* Zerlegt ein Wort in Buchstabengruppen samt zugehörigen Zeichen. */
function ivWordToClusters(word) {
    var cl = [], i, ch, k;
    for (i = 0; i < word.length; i++) {
        ch = word.charAt(i);
        if (HT.IV.BASE.hasOwnProperty(ch)) {
            cl.push({ "c": ch, "dagesh": false, "shin": null,
                      "vowel": null, "shva": false, "geresh": false });
        } else if (cl.length > 0) {
            k = cl[cl.length - 1];
            if (ch === HT.IV.DAGESH) k.dagesh = true;
            else if (ch === HT.IV.SHIN) k.shin = "sh";
            else if (ch === HT.IV.SIN) k.shin = "s";
            else if (ch === HT.IV.SHVA) k.shva = true;
            else if (HT.IV.V.hasOwnProperty(ch)) k.vowel = HT.IV.V[ch];
            else if (ch === "\u05F3" || ch === "'" || ch === "\u2019") k.geresh = true;
        }
    }
    return cl;
}

/* Setzt die Buchstabengruppen in lateinische Schrift um. */
function ivClustersToLatin(cl) {
    var out = "", prevVowel = null, i, k, isLast, cons, base;
    for (i = 0; i < cl.length; i++) {
        k = cl[i];
        isLast = (i === cl.length - 1);
        base = HT.IV.BASE[k.c];

        if (k.geresh && HT.IV.GERESH.hasOwnProperty(k.c)) cons = HT.IV.GERESH[k.c];
        else if (k.c === "\u05E9") cons = k.shin ? k.shin : "sh";
        else if (base instanceof Array) cons = base[k.dagesh ? 1 : 0];
        else cons = base;

        // Waw als Vokal: Schuruq (u) und Cholem male (o)
        if (k.c === "\u05D5") {
            if (k.dagesh && !k.vowel && !k.shva) {
                out += "u"; prevVowel = "u"; continue;
            }
            if (k.vowel === "o" && !k.dagesh && i > 0 &&
                !cl[i - 1].vowel && !cl[i - 1].shva) {
                out += "o"; prevVowel = "o"; continue;
            }
        }
        // Jod als Lesemutter nach i oder e
        if (k.c === "\u05D9" && !k.vowel && !k.shva &&
            (prevVowel === "i" || prevVowel === "e")) continue;
        // Alef und Ajin ohne Vokal bleiben stumm
        if ((k.c === "\u05D0" || k.c === "\u05E2") && !k.vowel && !k.shva) continue;
        // Stummes He am Wortende nach e
        if (isLast && k.c === "\u05D4" && !k.vowel && !k.shva && !k.dagesh &&
            prevVowel === "e") continue;
        // Patach furtivum: רוּחַ wird ruach, nicht rucha
        if (isLast && k.vowel === "a" &&
            (k.c === "\u05D7" || k.c === "\u05E2" || (k.c === "\u05D4" && k.dagesh))) {
            out += "a" + cons; prevVowel = "a"; continue;
        }

        out += cons;
        if (k.vowel) {
            out += k.vowel; prevVowel = k.vowel;
        } else if (k.shva) {
            if (i === 0 && cl.length > 1) { out += "e"; prevVowel = "e"; }
            else prevVowel = null;
        } else {
            prevVowel = null;
        }
    }
    return out;
}

/* ExtendScript kennt kein String.trim. */
function ivTrim(s) {
    return String(s).replace(/^\s+/, "").replace(/\s+$/, "");
}

function transliterateIvrit(text) {
    if (!text) return "";
    var clean = String(text)
        .replace(HT.IV.STRIP, "")
        .replace(/\u05BE/g, "-")
        .replace(/[\u05F4\u201C\u201D]/g, "\"");
    var parts = clean.split(/(\s+|-)/);
    var out = [], i, tok;
    for (i = 0; i < parts.length; i++) {
        tok = parts[i];
        if (!/[\u0590-\u05FF]/.test(tok)) { out.push(tok); continue; }
        out.push(ivClustersToLatin(ivWordToClusters(tok)));
    }
    return ivTrim(out.join("").replace(/\s{2,}/g, " "));
}

// ----------------------------------------------------------------------------
// 3c · Vokalisierung über Dicta Nakdan (nakdan.dicta.org.il)
//      Unpunktierter hebräischer Text lässt sich nicht zuverlässig umschreiben:
//      שלום kann shalom, shilem oder shulam sein. Nakdan setzt die Punktation
//      kontextabhängig, danach greifen die Umschriftregeln der Module oben.
//
//      ExtendScript kann selbst kein HTTPS (das Socket-Objekt beherrscht kein
//      TLS). Deshalb läuft die Anfrage über das Betriebssystem:
//        Windows  – curl.exe, ersatzweise MSXML2.ServerXMLHTTP  (VBScript)
//        macOS    – /usr/bin/curl                               (AppleScript)
//      Anfrage und Antwort laufen über zwei Dateien im Temp-Ordner, damit
//      keine Umlaute oder hebräischen Zeichen durch die Shell müssen.
// ----------------------------------------------------------------------------

HT.NK = {
    "url": "https://nakdan-u1-0.loadbalancer.dicta.org.il/api",
    "chunkSize": 1200,     // Zeichen je Anfrage
    "timeout": 60,         // Sekunden
    "cache": {}            // Sitzungszwischenspeicher: Text → vokalisierter Text
};

/* Schlüssel für den Zwischenspeicher.
   ACHTUNG: Hier darf kein Nullzeichen stehen. ExtendScript schneidet
   Eigenschaftsnamen an \u0000 ab; dadurch hießen bis Fassung 1.5 alle
   Schlüssel nur „modern“, und jede Anfrage bekam die zuerst gespeicherte
   Antwort zurück – unabhängig vom markierten Text. Das Zeichen ‖ (U+2016)
   kommt in keiner Stilbezeichnung vor und trennt daher zuverlässig. */
function nakdanCacheKey(genre, text) {
    return "k" + String(genre) + "\u2016" + String(text);
}

HT.genreOptions = [
    ["modern – Ivrit der Gegenwart", "modern"],
    ["rabbinisch – Mischna, Talmud, Halacha", "rabbinic"],
    ["poetisch – Pijjut und Dichtung", "poetry"]
];

/* Nikkud vorhanden? Vokalzeichen, Dagesch, Schin-/Sin-Punkt. */
function hasNikkud(s) {
    return /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/.test(String(s));
}

function hasHebrew(s) {
    return /[\u0590-\u05FF]/.test(String(s));
}

/* JSON-Zeichenkette, bei der alles außerhalb von ASCII als \uXXXX steht.
   Dadurch ist der gesamte Anfragekörper reines ASCII und übersteht jede
   Kodierungsstufe unverändert. */
function jsonQuoteAscii(s) {
    var out = '"', i, c, cp, hex;
    s = String(s);
    for (i = 0; i < s.length; i++) {
        c = s.charAt(i);
        cp = s.charCodeAt(i);
        if (c === '"') out += '\\"';
        else if (c === "\\") out += "\\\\";
        else if (cp === 8) out += "\\b";
        else if (cp === 9) out += "\\t";
        else if (cp === 10) out += "\\n";
        else if (cp === 12) out += "\\f";
        else if (cp === 13) out += "\\r";
        else if (cp < 32 || cp > 126) {
            hex = cp.toString(16);
            while (hex.length < 4) hex = "0" + hex;
            out += "\\u" + hex;
        } else out += c;
    }
    return out + '"';
}

// ---- Kleiner JSON-Leser ----------------------------------------------------
/* ExtendScript kennt kein JSON-Objekt. eval() auf eine Antwort aus dem Netz
   wäre leichtsinnig, deshalb hier ein eigener, rein lesender Parser. */
function jsonParse(txt) {
    var s = String(txt), i = 0, n = s.length;

    function fail(m) { throw new Error(m + " an Position " + i); }
    function ws() { while (i < n && " \t\r\n".indexOf(s.charAt(i)) >= 0) i++; }

    function lit(word, value) {
        if (s.substr(i, word.length) !== word) fail("Unerwartetes Zeichen");
        i += word.length;
        return value;
    }

    function str() {
        var out = "", c, hex;
        i++;                                   // öffnendes Anführungszeichen
        while (i < n) {
            c = s.charAt(i++);
            if (c === '"') return out;
            if (c !== "\\") { out += c; continue; }
            c = s.charAt(i++);
            if (c === "u") {
                hex = s.substr(i, 4); i += 4;
                out += String.fromCharCode(parseInt(hex, 16));
            }
            else if (c === "n") out += "\n";
            else if (c === "t") out += "\t";
            else if (c === "r") out += "\r";
            else if (c === "b") out += String.fromCharCode(8);
            else if (c === "f") out += String.fromCharCode(12);
            else out += c;                     // " \ / und alles Übrige
        }
        fail("Zeichenkette nicht geschlossen");
    }

    function num() {
        var start = i;
        if (s.charAt(i) === "-") i++;
        while (i < n && "0123456789".indexOf(s.charAt(i)) >= 0) i++;
        if (s.charAt(i) === ".") { i++; while (i < n && "0123456789".indexOf(s.charAt(i)) >= 0) i++; }
        if (s.charAt(i) === "e" || s.charAt(i) === "E") {
            i++;
            if (s.charAt(i) === "+" || s.charAt(i) === "-") i++;
            while (i < n && "0123456789".indexOf(s.charAt(i)) >= 0) i++;
        }
        if (start === i) fail("Zahl erwartet");
        return parseFloat(s.substring(start, i));
    }

    function arr() {
        var a = [];
        i++; ws();
        if (s.charAt(i) === "]") { i++; return a; }
        while (i < n) {
            a.push(val()); ws();
            if (s.charAt(i) === ",") { i++; continue; }
            if (s.charAt(i) === "]") { i++; return a; }
            fail("Komma oder ] erwartet");
        }
        fail("Feld nicht geschlossen");
    }

    function obj() {
        var o = {}, k;
        i++; ws();
        if (s.charAt(i) === "}") { i++; return o; }
        while (i < n) {
            ws();
            if (s.charAt(i) !== '"') fail("Schlüssel erwartet");
            k = str(); ws();
            if (s.charAt(i) !== ":") fail("Doppelpunkt erwartet");
            i++;
            o[k] = val(); ws();
            if (s.charAt(i) === ",") { i++; continue; }
            if (s.charAt(i) === "}") { i++; return o; }
            fail("Komma oder } erwartet");
        }
        fail("Objekt nicht geschlossen");
    }

    function val() {
        ws();
        var c = s.charAt(i);
        if (c === "{") return obj();
        if (c === "[") return arr();
        if (c === '"') return str();
        if (c === "t") return lit("true", true);
        if (c === "f") return lit("false", false);
        if (c === "n") return lit("null", null);
        return num();
    }

    var v = val();
    return v;
}

// ---- Netzzugriff -----------------------------------------------------------

function isWindows() {
    return String($.os).toLowerCase().indexOf("windows") >= 0;
}

function tmpPath(name) {
    return Folder.temp.fsName + (isWindows() ? "\\" : "/") + name;
}

/* VBScript-Zeichenkettenliteral (innere Anführungszeichen verdoppeln). */
function vbStr(s) {
    return '"' + String(s).replace(/"/g, '""') + '"';
}

/* AppleScript-Zeichenkettenliteral. */
function asStr(s) {
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/* Sendet einen ASCII-JSON-Körper und legt die Antwort in eine Datei.
   Rückgabe: Antworttext oder null. */
function httpPostJson(url, bodyAscii, timeoutSec, log) {
    var reqFile = File(tmpPath("ht_nakdan_req.json"));
    var resFile = File(tmpPath("ht_nakdan_res.json"));
    var reqPath = reqFile.fsName, resPath = resFile.fsName;
    var script, answer = null;

    try { if (resFile.exists) resFile.remove(); } catch (e) {}

    reqFile.encoding = "UTF-8";
    reqFile.lineFeed = "Unix";
    if (!reqFile.open("w")) { log("Temp-Datei nicht beschreibbar: " + reqPath); return null; }
    reqFile.write(bodyAscii);
    reqFile.close();

    if (isWindows()) {
        var cmd = 'curl.exe -s -S -m ' + timeoutSec + ' -X POST "' + url + '"' +
                  ' -H "Content-Type: application/json"' +
                  ' -H "Accept: application/json"' +
                  ' --data-binary "@' + reqPath + '"' +
                  ' -o "' + resPath + '"';
        script = 'Dim sh\r' +
                 'Set sh = CreateObject("WScript.Shell")\r' +
                 'sh.Run ' + vbStr(cmd) + ', 0, True\r';
        try { app.doScript(script, ScriptLanguage.VISUAL_BASIC); }
        catch (e1) { log("VBScript nicht ausführbar: " + e1); }

        // Ersatzweg ohne curl (ältere Windows-Fassungen)
        if (!resFile.exists || resFile.length === 0) {
            script =
                'Dim si, sh, hp, so, body\r' +
                'Set si = CreateObject("ADODB.Stream")\r' +
                'si.Type = 2 : si.Charset = "utf-8" : si.Open\r' +
                'si.LoadFromFile ' + vbStr(reqPath) + '\r' +
                'body = si.ReadText : si.Close\r' +
                'Set hp = CreateObject("MSXML2.ServerXMLHTTP.6.0")\r' +
                'hp.setTimeouts 5000, 10000, ' + (timeoutSec * 1000) + ', ' + (timeoutSec * 1000) + '\r' +
                'hp.Open "POST", ' + vbStr(url) + ', False\r' +
                'hp.setRequestHeader "Content-Type", "application/json"\r' +
                'hp.send body\r' +
                'Set so = CreateObject("ADODB.Stream")\r' +
                'so.Type = 2 : so.Charset = "utf-8" : so.Open\r' +
                'so.WriteText hp.responseText\r' +
                'so.SaveToFile ' + vbStr(resPath) + ', 2\r' +
                'so.Close\r';
            try { app.doScript(script, ScriptLanguage.VISUAL_BASIC); }
            catch (e2) { log("Zweiter Versuch (ServerXMLHTTP) fehlgeschlagen: " + e2); }
        }
    } else {
        var shell = "/usr/bin/curl -s -S -m " + timeoutSec + " -X POST '" + url + "'" +
                    " -H 'Content-Type: application/json'" +
                    " -H 'Accept: application/json'" +
                    " --data-binary '@" + reqPath + "'" +
                    " -o '" + resPath + "'";
        script = "do shell script " + asStr(shell);
        try { app.doScript(script, ScriptLanguage.APPLESCRIPT); }
        catch (e3) { log("AppleScript nicht ausführbar: " + e3); }
    }

    if (!resFile.exists) { log("Keine Antwort erhalten – Internetverbindung prüfen."); return null; }
    resFile.encoding = "UTF-8";
    if (resFile.open("r")) {
        answer = resFile.read();
        resFile.close();
    }
    try { reqFile.remove(); } catch (e4) {}
    try { resFile.remove(); } catch (e5) {}

    if (answer === null || answer === "") { log("Leere Antwort vom Server."); return null; }
    if (answer.charCodeAt(0) === 0xFEFF) answer = answer.substring(1);   // BOM
    return answer;
}

// ---- Nakdan ----------------------------------------------------------------

/* Antwort auswerten. Zwei Formate sind im Umlauf:
     neu  {"data":[{"str":"...","nakdan":{"options":[{"w":"...","levelChoice":1}]}}]}
     alt  [{"word":"...","options":[{"w":"..."}],"sep":false}]
   Beide werden hier bedient. Das Zeichen | trennt in der Antwort Vorsilben
   vom Wortstamm und wird entfernt. */
/* Sucht im Objekt die erste Zeichenkette, die hebräische Punktation enthält.
   Damit bleibt die Auswertung auch dann heil, wenn Dicta die Feldnamen
   ändert – genau daran ist Fassung 1.3 gescheitert. */
function firstNikkudString(obj, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 3 || obj === null || obj === undefined) return null;
    var k, v, r;
    if (typeof obj === "string") return hasNikkud(obj) ? obj : null;
    if (typeof obj !== "object") return null;
    for (k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        v = obj[k];
        if (typeof v === "string" && hasNikkud(v)) return v;
    }
    for (k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        r = firstNikkudString(obj[k], depth + 1);
        if (r) return r;
    }
    return null;
}

/* Sammelt aus der Antwort nur die punktierten Wörter, in ihrer Reihenfolge.
   Die Trennzeichen der Antwort werden bewusst nicht verwendet: Dicta liefert
   sie je nach Fassung unter wechselnden Feldnamen, wodurch in Fassung 1.3
   Leerzeichen verschwanden und „undefined“ im Text landete. Die Abstände
   kommen deshalb aus dem Originaltext, siehe nakdanMerge. */
function nakdanWordList(parsed) {
    var items, i, it, opts, chosen, k, w, out = [];
    if (!parsed) return null;
    if (parsed instanceof Array) items = parsed;
    else if (parsed.data && (parsed.data instanceof Array)) items = parsed.data;
    else return null;

    for (i = 0; i < items.length; i++) {
        it = items[i];
        w = null;

        if (typeof it === "string") {
            w = it;
        } else if (it) {
            opts = null;
            if (it.nakdan && it.nakdan.options) opts = it.nakdan.options;
            else if (it.options) opts = it.options;

            if (opts && (opts instanceof Array) && opts.length > 0) {
                chosen = null;
                for (k = 0; k < opts.length; k++) {
                    if (opts[k] && opts[k].levelChoice === 1) { chosen = opts[k]; break; }
                }
                if (!chosen) chosen = opts[0];
                if (typeof chosen === "string") w = chosen;
                else if (chosen && typeof chosen.w === "string") w = chosen.w;
                else if (chosen && typeof chosen.word === "string") w = chosen.word;
                else w = firstNikkudString(chosen);
            }
            if (typeof w !== "string" || w === "") {
                if (typeof it.str === "string") w = it.str;
                else if (typeof it.word === "string") w = it.word;
                else w = null;
            }
        }

        if (typeof w !== "string") continue;
        w = w.replace(/\|/g, "");                      // Trennstrich vor Vorsilben
        if (!/[\u05D0-\u05EA]/.test(w)) continue;      // Trennzeichen überspringen
        out.push(w);
    }
    return out;
}

/* Zeichen, die zu einem hebräischen Wort gehören: Buchstaben, Punktation,
   Geresch. Maqaf und Satzzeichen trennen. */
HT.NK.wordRe = /[\u05D0-\u05EA][\u05D0-\u05EA\u0591-\u05BD\u05BF-\u05C2\u05C4\u05C5\u05C7\u05F3\u05F4]*/g;

/* Setzt die punktierten Wörter an die Stellen der unpunktierten im
   Originaltext. Abstände, Satzzeichen und Zeilenumbrüche bleiben dadurch
   genau erhalten. Passt die Anzahl nicht, wird null geliefert. */
function nakdanMerge(original, words) {
    var s = String(original), out = "", pos = 0, k = 0, m;
    HT.NK.wordRe.lastIndex = 0;
    while ((m = HT.NK.wordRe.exec(s)) !== null) {
        out += s.substring(pos, m.index);
        if (k < words.length) out += words[k];
        else out += m[0];
        k++;
        pos = m.index + m[0].length;
        if (m[0].length === 0) HT.NK.wordRe.lastIndex++;      // Endlosschleife vermeiden
    }
    out += s.substring(pos);
    if (k !== words.length) return null;
    return out;
}

/* Text in Häppchen zerlegen, ohne Wörter zu zerreißen. */
function nakdanChunks(text, size) {
    var parts = String(text).split(/(\s+)/), out = [], cur = "", i;
    for (i = 0; i < parts.length; i++) {
        if (cur.length + parts[i].length > size && cur.length > 0) { out.push(cur); cur = ""; }
        cur += parts[i];
    }
    if (cur.length > 0) out.push(cur);
    return out;
}

/* Hauptfunktion: gibt den vokalisierten Text zurück oder null. */
function nakdanVocalize(text, cfg, log, noCache) {
    var url = (cfg.nakdanUrl && cfg.nakdanUrl !== "") ? cfg.nakdanUrl : HT.NK.url;
    var genre = cfg.nakdanGenre || "modern";
    var chunks, i, body, answer, parsed, piece, out = "", key;

    if (!hasHebrew(text)) return text;
    key = nakdanCacheKey(genre, text);
    if (!noCache && HT.NK.cache.hasOwnProperty(key)) return HT.NK.cache[key];

    chunks = nakdanChunks(text, HT.NK.chunkSize);
    for (i = 0; i < chunks.length; i++) {
        if (!hasHebrew(chunks[i])) { out += chunks[i]; continue; }
        body = "{" +
               '"task":"nakdan",' +
               '"genre":' + jsonQuoteAscii(genre) + "," +
               '"data":' + jsonQuoteAscii(chunks[i]) + "," +
               '"addmorph":true,' +
               '"keepmetagim":false,' +
               '"keepqq":false,' +
               '"nodageshdefmem":false,' +
               '"patachma":false,' +
               '"useTokenization":true' +
               "}";
        answer = httpPostJson(url, body, HT.NK.timeout || 60, log);
        if (answer === null) return null;
        try { parsed = jsonParse(answer); }
        catch (e) {
            log("Antwort nicht lesbar: " + e + " · Anfang: " + answer.substring(0, 60));
            return null;
        }
        var wl = nakdanWordList(parsed);
        if (wl === null) {
            log("Unbekanntes Antwortformat. Anfang der Antwort: " + answer.substring(0, 200));
            return null;
        }
        piece = nakdanMerge(chunks[i], wl);
        if (piece === null) {
            log("Wortzahl passt nicht zusammen: Nakdan " + wl.length + ", Abschnitt " +
                (String(chunks[i]).match(HT.NK.wordRe) || []).length +
                ". Der Text bliebe lückenhaft, deshalb Abbruch.");
            return null;
        }
        out += piece;
        if (chunks.length > 1) log("Nakdan: Abschnitt " + (i + 1) + " von " + chunks.length + " fertig.");
    }
    if (!noCache) HT.NK.cache[key] = out;
    return out;
}



// ----------------------------------------------------------------------------
// 3d · Offline-Wörterbuch: Nikkud ohne Internet
//      Grundlage ist eine Wortliste aus dem hebräischen Wiktionary
//      (über den Datensatz von TaatikNet, github.com/morrisalp/taatiknet,
//      CC BY-SA 3.0). Sie enthält rund 12000 punktierte Grundformen.
//      Bei mehrdeutigen Schreibungen wird die Form mit der wenigsten
//      Punktation bevorzugt, also שָׁלוֹם statt שְׁלוֹם oder שִׁלּוּם.
//      Lückenhaft punktierte Einträge der Quelle sind aussortiert.
//      Nicht gefundene Wörter werden über Vorsilben zerlegt und, wenn auch
//      das nicht greift, nach Regeln der Ktiv-male-Schreibung geraten.
//      Das Wörterbuch wird erst beim ersten Gebrauch aufgebaut.
// ----------------------------------------------------------------------------

HT.DIC = { "map": null, "count": 0, "ambiguous": 0 };

/* Punktation entfernen (Vokalzeichen, Dagesch, Kantillation). */
function stripNikkud(s) {
    return String(s).replace(/[\u0591-\u05C7]/g, "");
}

HT.DIC.raw = [
"אֵאוּגֶנִיקָה|אֵאוֹזִינוֹפִיל|אָאוּטִינְג|אָב|אַבָּא|אֲבָבִית|אֶבְגֵּינוֹס|אַבְגַּר|אָבַד|אַבָּדַאי|אֲבֵדָה|אָבְדוּ|אֲבַדּוֹן|אָבְדַן|אֵבֶה|אַבְהַל|אַבּוּ|אַבּוּב|אֲבוֹבְיָה|אַבּוּבָן|אָבוּד|אֲבוֹי|אָבוּל|אֶבוֹלוּצְיָה|אֶבוֹלוּצְיוֹנִי|אֶבּוּלְיוֹמֶטֶר|אָבוּס|אָבוֹקָדוֹ|אֲבוּקָה|אָבּוֹרִיגִ'ינִי|אָבוֹת|אַבְזָם|אִבְחָה|אִבְחוּן|אִבְחַת|אַבְטָחָה|אֲבַטִּיחַ|אַבְטָלָה|אֲבִיב|אֲבִיבִי|אֶבְיוֹן|אֲבִיּוֹנָה|אֶבְיוֹנוּת|אָבִיךְ|אָבִיק|אַבִּיר|אַבִּירוּת|אֹבֶךְ|אֲבָל|אֶבֶן|אַבְנֵט|אָבְנָיִם|אַבְנִית|אַבְּסוּרְד|אַבְּסוּרְדִּי|אַבְּסְטְרַקְטִית|אָבָץ|אֲבָק|אִבְקָה|אַבְקָן|אֵבֶר|אֶבְרָה|אַבְרָהָם|אֶבְרוֹן|אַבַּרְזִין|אַבְרֵךְ|אַבֵּרַצְיָה|אַבְּרָקָדַבְּרָה|אָגֶ'נְדָה|אֲגֻדָּה|אַגָּדִי|אֶגוֹ|אֶגוֹאִיסְט|אֲגוּדָל|אֱגוֹז|אֶגוֹלוֹגִיָה|אִגּוּם|אֵגוֹצֶנְטְרִי|אֵגוֹצֶנְטְרִיּוּת|אָגוֹרָה|אָגוֹרָנוֹמוֹס|אָגוֹרָפוֹבְּיָה|אֶגְזוֹז|אֵגֶל|אֲגַם|אֲגַמּוֹן|אֹגֶן|אַגְנוֹסְטִי|אַגָּס|אֲגַף|אִגָּרָא|אַגְרֶגַצְיָה|אַגְרָה|אֶגְרוֹן|אַגְרוֹנוֹם|אַגְרוֹנוֹמְיָה|אֶגְרוֹף|אֶגְרוֹפָן|אֲגַרְטָל|אַגְרָן|אִגֶּרֶת|אַד|אַדְוָה|אִדּוּי|אֱדוֹם|אָדוֹן|אָדוּק|אִדּוּשׁ|אַדְיַאבָּטִי|אַדְיַבָּטָה|אֵדִיּוּת|אֵדִים|אֶדִיפּוּס|אָדִישׁ|אֶדֶלְוַויְיס|אָדֹם|אֲדָמָה|אַדְמוֹנִי|אַדְמוֹנִית|אֲדֻמִּים|אַדְמִירָל|אַדְמִירָלוּת|אַדְמִירָלִי|אַדְמִירָלִיוּת|אֶדָמָמֶה|אַדְמַת|אֶדֶן|אָדֵנוֹזִין|אֲדֹנָי|אָדֶנִין|אֲדָנִית|אָדַפְּטִיבִי|אֲדָר|אֲדָרָא|אַדְּרַבָּה|אִדְרָה|אַדְרִיכָל|אַדְרִיכָלוּת|אַדְרִיכָלִי|אַדְרֶנַל|אַדְרֵנָלִין|אַדֶּרֶת|אַהֲבָה|אֲהָבִים|אַהֲבַת|אַהֲדָה|אֲהָהּ|אָהוּד|אֲהוֹי|אֱהִי|אָהִיל|אָהָל|אַהְלָן|אוֹ|אוּ\"ם|אוֹאוֹגֵנֵזָה|אוֹאָזִיס|אוֹב|אוֹבֵד|אוֹבְּיֶקְט|אוֹבְּיֶקְטִיבִי|אוֹבְּיֶקְטִיבִיּוּת|אוּבָל|אוֹבָלִי|אוּבְּלִיאֶט|אוֹבֶּלִיסְק|אוֹבְּסִידִיאַן|אוֹבְּסֶסִיבִי|אוֹבְּסֵסְיָה|אוֹגֵד|אוֹגוּסְט|אוּגַנְדָּה|אוֹגָנֶסוֹן|אוֹגֵר|אוּד|אוֹדוֹנְטוֹלוֹגְיָה|אוֹדוֹת|אוֹדְיוֹ|אוֹדְיוֹמֶטֶר|אוֹדִישֶׁן|אוֹהְם|אֲוָז|אוּזוֹ|",
"אוֹזוֹן|אוּחצָ'ה|אוֹטְאֵקוֹלוֹגְיָה|אוֹטוֹ|אוֹטוֹבּוּס|אוֹטוֹבָּן|אוֹטוֹדִידַקְט|אוֹטוֹדִידַקְטִיּוּת|אוֹטוֹטְרוֹף|אוֹטוֹמוֹבִּיל|אוֹטוֹמָט|אוֹטוֹמָטִי|אוֹטוֹנוֹמְיָה|אוֹטוֹסוּגֶסְטְיָה|אוֹטוֹסְטְרָדָה|אוֹטוֹפּוֹרְטְרֶט|אוּטוֹפְּיָה|אוֹטוֹפִיט|אוטוֹקְרָט|אוֹטוֹקְרַטְיָה|אוֹטוֹרִיטָה|אוֹטוֹרִינוֹלָרִינְגוֹלוֹגְיָה|אוֹטְרִיאָד|אוֹטָרִיִּים|אוֹטַרְקְיָה|אוֹי|אוֹיֵב|אוֹיְבוּת|אֱוִיל|אֱוִילִי|אֲוִיר|אֲוִירָה|אֲוִירוֹבָּטִיקָה|אֲוִירוֹדִינָמִי|אֲוִירוֹדִינָמִיקָה|אֲוִירוֹן|אֲוִירוֹנָאוּטִיקָה|אֲוִירוֹנָאוּטִית|אֲוִירוֹנוֹטִיקָה|אֲוִירוֹנִים|אֲוִירִי|אֲוִירָנִי|אוֹכֵל|אוֹכֶלֶת|אוּל|אוּלְטִימָטוּם|אוּלְטִימֵיט|אוּלַי|אוֹלִיגוֹפְּסוֹן|אוֹלִיגוֹקֵן|אוֹלִיגַרְךְ|אוֹלִיגַרְכְיָה|אוֹלִימְפִּי|אוּלַם|אוֹלָר|אִוֶּלֶת|אוֹמֶגָה|אוֹמֵן|אוֹמְנִיפּוֹטֶנְט|אוֹמֶנֶת|אוֹן|אֶוַנְגֵּלְיוֹן|אוֹנְגַּרְד|אָוַנְגַּרְדִּי|אוֹנוֹ|אוֹנוֹמָטוֹפֵּיָה|אוֹנוֹמַסְטִיקָה|אוֹנוֹמַסְטִיקוֹן|אוֹנוּת|אֲוַנְטָה|אוֹנְטוֹלוֹגְיָה|אוּנִיבֶרְסִיטָה|אוּנְיָה|אוּנִיטָרִי|אוֹנִים|אוֹנָנוּת|אוֹנְקוֹלוֹגְיָה|אוּנְקִיָה|אוּנְקְלוֹס|אוּנָרִי|אוֹסְטֵאוֹדֶרְם|אוֹסְטֵאוֹפָּת|אוֹסְטֵאוֹקָלְצִין|אוֹסְטְרֵאָה|אוֹסְטְרִי|אוֹסְטְרִיָּה|אוֹסְטְרַלְאַסְיָה|אוֹסְטְרָלִי|אוֹסְטְרַלְיָה|אוֹסְטְרָקִיזְם|אוֹסְלוֹ|אוֹסְמוֹזָה|אוֹסְמוֹפוֹבְּיָה|אוֹסְמְיוּם|אוֹסְצִילוֹקוֹקִינוּם|אוֹסְקָר|אוּף|אוֹפֶה|אוֹפּוֹזִיצְיָה|אוֹפּוֹזִיצְיוֹנֶר|אוֹפּוֹרְטוּנִיזְם|אוּפוֹרְיָה|אוֹפְּטוֹמֶטֶר|אוֹפְּטוֹמֶטְרַאי|אוֹפְּטוֹמֶטְרִיָּה|אוֹפְּטוֹמֶטְרִיסְט|אוֹפְּטוֹפוֹן|אוֹפְּטִי|אוֹפְּטִימִי|אוֹפְּטִימִיזַצְיָה|אוֹפְּטִיקָה|אוֹפְּטִית|אוֹפְטַלְמוֹסְקוֹפּ|אוֹפְטַלְמוֹסְקוֹפְּיָה|אוֹפְּיוּם|אוֹפִיקְלֵאִידָה|אוֹפִיר|אוֹפָן|אוֹפַנּוֹעַ|אוֹפַנֵּי|אוֹפַנַּיִם|אוֹפַנָּן|אוּפְּס|אוֹפֵּרָה|אוֹפֶּרָטִיבִית|אוֹפְתַלְמוֹלוֹגְיָה|אוֹצַר|אוֹקוּלוּס|אוֹקוּלְטִיזְם|אוֹקַזְיוֹנָלִיזְם|אוֹקְטָאֶדֶר|אוֹקְטָהֶדְרוֹן|אוֹקְטוֹבֶּר|אוֹקְטֶט|אוֹקֵיְ|אוֹקְיָאנוֹגְרַפְיָה|אוֹקְיָאנִית|",
"אוֹקְיָנוֹס|אוֹקְיַנְיָה|אוֹקְסִידֶנְטָלִיזְם|אוֹקְסִימוֹרוֹן|אוֹר|אוּרֵאָה|אוֹרֵב|אוֹרְבִּיטָה|אוֹרְבִּיטַל|אוּרְבָּנִיזְם|אוֹרְגַּזְמָה|אוֹרְגְּיָה|אוֹרְגִים|אוֹרְגָּן|אוֹרֶגָנוֹ|אוֹרְגַּנְזָה|אוֹרְגָּנִי|אוֹרְגָּנִיזְם|אוֹרְגָּנִית|אוֹרְדּוֹבִיק|אוֹרֶה|אוֹרוֹגֵּנֵזָה|אוּרוֹלוֹגְיָה|אוּרוֹפִילְיָה|אוֹרֵחַ|אוֹרְחָה|אוֹרְחָן|אוֹרָטוֹרְיָה|אוּרִי|אוֹרִיגָמִי|אוּרִיָּה|אוּרִים|אוֹרְיָן|אוֹרְיָנוּת|אוֹרִיקוֹלוֹתֵרַפְּיָה|אַוְרִירִי|אוֹרְלוֹגִין|אוּרַנְגְּאוּטָן|אוּרַנְיָה|אוּרַנְיוּם|אוֹרְנִיתוֹלוֹגְיָה|אוֹרְתוֹגוֹנָל|אוֹרְתּוֹגוֹנָלִי|אוֹרְתּוֹדוֹקְס|אוֹרְתּוֹפֶּדְיָה|אוֹרְתוֹקֵרָטוֹלוֹגְיָה|אִוְשָׁה|אוֹת|אוֹתָהּ|אוֹתוֹ|אוֹתוֹת|אוֹתֶנְטִי|אָז|אָזֵאוֹטְרוֹפּ|אִזְדָּרֶכֶת|אַזְהָרוֹת|אֵזוֹב|אֲזוֹבְיוֹן|אֲזוֹבִית|אֵזוֹטֶרִי|אִזּוּן|אֵזוֹר|אֲזוֹרִית|אָזִימוּט|אֵזֶל|אָזְלַת|אִזְמֵל|אִזְמֵלוֹן|אִזְמָרַגְדּ|אָזֵן|אָזְנוֹ|אָזְנֵי|אָזְנִית|אַזְעָקָה|אֲזִקּוֹן|אֲזִקִּים|אָזַר|אָזֶרְבַּיְגָ'ן|אֶזְרָח|אֶזְרָחִי|אֶזְרָחֶיהָ|אֶזְרָחִית|אָח|אֶחָד|אַחְדוּת|אָחוּ|אָחוּז|אִחוּל|אָחוֹר|אֲחוֹרִי|אֲחוֹרִית|אָחוֹת|אֶחֶז|אֲחֻזָּה|אֲחֻזַּת|אָחִי|אֲחִיזַת|אֲחִילוּ|אַחְיָן|אַחְלָה|אַחְלָמָה|אַחֵר|אַחְרָה|אַחֲרוֹן|אַחֲרוֹנִים|אַחֲרָיוּת|אַחְרָיוּתִיּוּת|אַחֲרִית|אַחְרַת|אֲחַשְׁדַּרְפָּן|אֲחַשְׁוֵרוֹשׁ|אֲחַשְׁתְּרָן|אַחַת|אַט|אֶטֶב|אָטָד|אָטָוִיזְם|אָטוֹל|אָטוֹם|אָטוֹמִי|אָטוֹמִית|אֵטוּן|אִטִּי|אֶטְיוֹלוֹגְיָה|אֵטִימוֹלוֹגְיָה|אִטְלוּלִית|אִטְלִיז|אַטְלָס|אָטַם|אִטְמוֹן|אַטְמוֹסְפֶרָה|אַטְמוֹסְפֵרִי|אִטֵּר|אִטְרִיָּה|אַטְרְיוּם|אִי|אַיאוֹלוּס|אֵיבָה|אִיבּוֹגָאִין|אֵיבָר|אֵיבָרָיו|אִיגָיוֹן|אַיְגִיר|אִיגְלוּ|אִיגְנוֹסְטִיוּת|אִיגְנוֹסְטִיצִיזְם|אִידֵאָה|אִידֵאוֹגְרָפִי|אִידֵאוֹגְרָפְיָה|אִידֵאוֹלוֹגְיָה|אִידֵאָל|אִידְיוֹט|אִידְיוֹלֶקְט|אִידִילְיָה|אִידָךְ|אִידָן|אַיָּה|אִיּוֹב|אִיּוּם|אִיזוֹבָּר|אִיזוֹבָּרה|אִיזוֹטוֹפּ|אִיזוֹטוֹפּוֹלוֹג|אִיזוֹטְרוֹפִּי|אִיזוֹכוֹרָה|אִיזוֹמֵר|אִיזוֹסְטַסְיָה|",
"אִיזוֹפְּרוֹפָּנוֹל|אִיזוֹתֶרְמָה|אִיזוֹתרמי|אִיטַלְקִי|אִיטַלְקִית|אִיטֶרְבְּיוּם|אִיטֶרָטוֹר|אִיטְרְיוּם|אִיטֶרַצְיָה|אִיֵּי|אֵיךְ|אֵיכָה|אֵיכוּת|אֵיכוּתִי|אֵיכוּתִית|אִיכְס|אִיכְתִיאוֹרְנִיס|אִיכְתְיוֹזָאוּרוּס|אִיכְתְּיוֹלוֹגְיָה|אַיִל|אַיָּלָא|אַיָּלָה|אִילוֹ|אִילוּזִיה|אַיְלוֹנִית|אִילַן|אִילָנִית|אַיֶּלֶת|אָיֹם|אֵימָא|אִימְבָּצִיל|אִימוֹגִ'י|אִימוּנוֹבְּלוֹט|אִימוּנוֹלוֹגְיָה|אִימָנֶנְטְיּוּת|אִימְפּוּלְסִיבִי|אִימְפְּלִיקָטוּרָה|אִימְפַּסְטוֹ|אִימְפֶּרְיָאלִיזְם|אִימְפֶּרְיָה|אֵימַת|אֵימָתַי|אֵימְתָן|אַיִן|אִינְגְּלוּז|אִינְדּוּלְגֶּנְצְיָה|אִינְדּוֹקְטְרִינַצְיָה|אִינְדּוּקְצְיָה|אִינְדְיָאמֶן|אִינְדִיָאנִי|אִינְדִּיגוֹ|אִינְדְּיוּם|אִינְדִּיַּנָה|אִינְדִּיַּנִי|אִינְדִּיקָטוֹר|אִינְדֶּקְס|אִינְהִיבִּיצְיָה|אִינְהֶרֶנְטִי|אִינְוָלִיד|אִינוּלִין|אִינְוֶרְסְיָה|אִינְוֶרְסְיַּת|אִינְטֶגְרָטִיבִי|אִינְטֶגְרָל|אִינְטֶגְרָלִי|אִינְטֶגְרַצְיָה|אִינְטוּאִיצְיָה|אִינְטוּאִיצְיוֹנִיזְם|אִינְטוֹנָצְיָה|אִינְטִימִי|אִינְטֶלִיגֶנְצְיָה|אִינְטֶלֶקְטוּאָל|אִינְטֶלֶקְטוּאָלִיזַצְיָה|אִינְטֶרְאַקְטִיבִי|אִינְטֶרְאַקְצְיָה|אִינְטֶרְדִּיסְצִיפְּלִינָרִי|אִינְטְרוֹבֶרְט|אִינְטְרוֹבֶרְטִי|אִינְטְרוֹבֶרְסְיָה|אִינְטְרוֹן|אִינְטֶרְלֵוּקִין|אִינְטֶרְנֶט|אִינְטֶרְנַצְיוֹנָלִיזְם|אִינְטֶרֶס|אִינְטֶרֶסַנְט|אִינְטֶרְסֶקְס|אִינְטֶרְפּוֹלַצְיָה|אִינְטֶרְפּוּץ|אִינְטֶרְפָזָה|אִינְטֶרְפֶרוֹמֶטֶר|אִינְטֶרְקוֹם|אִינְסוּלִין|אִינְסוֹמְנִיָּה|אֵינְסוֹף|אֵינְסוֹפִי|אִינְסְטִינְקְט|אִינְסְטֶלָטוֹר|אִינְסְפֶּקְטוֹר|אִינְפִינִיטֶסִימָל|אִינְפְלַצְיָה|אִינְפַנְטִילִי|אִינְץ'|אִינְצִ'י|אִינְצִידֶנְט|אִינְקוּבָּטוֹר|אִינְקוֹגְנִיטוֹ|אִינְקְוִיזִיצְיָה|אִינְקְרֶמֶנְטָלִי|אִינֶרְטִי|אִינֶרְצְיָאלִית|אִינְתִּיפָדָה|אֵיסֶה|אִיסְטְרִידָא|אִיסְלַנְד|אִיסְקוּפָּה|אֵיפָה|אִיפְּכָא|אִיפְּסוֹ|אֵיפַּרְכִיָּא|אֵיפְשָׁר|אַיקוֹן|אִיקוֹנוֹגְרַפְיָה|אִיקוֹנוֹדוּלִיסְט|אִיקוֹנוֹפִיל|אִיקוֹנוֹקְלַזְם|אִיקוֹנִי|",
"אִיקוֹנִין|אִיקְס|אֵיקַרְיוֹט|אֵיקַרְיוֹטִי|אֵיקְרִיפְטִיט|אִיָּר|אִירֶדֶנְטָה|אֵירוֹאָמֵרִיקָה|אֵירוֹאַסְיָה|אִירוֹנְיָה|אִירוּס|אֵירוֹפָּה|אֵירוֹפְּיוּם|אִירִידְיוּם|אֵירִיטוֹפִּי|אִירִית|אֵירְלֶס|אִישׁ|אִישׁוֹן|אִישִׁי|אִישִׁיּוּת|אִישִׁים|אִיתוֹן|אִיתוּת|אִיתָמָר|אֵיתָנוּת|אַךְ|אַכַּדִּית|אַכְזָב|אַכְזָבָה|אַכְזָר|אַכְזָרִי|אַכְזָרִיּוּת|אָכִיל|אֲכִילָה|אַכִילֵס|אֲכִיפָה|אָכַל|אָכְלָה|אֻכְלוּסִיָּה|אֻכְלוּסִין|אֻכְמָנִית|אַכָּן|אַכְסַדְרָה|אַכְסַנְיָה|אַכְסַנְיַת|אֶכֶף|אִכְפַּת|אִכְפַּתִי|אִכָּר|אַל|אֶלָּא|אַלְבּוֹם|אַלְבַּנְיָה|אֶלְגָּבִישׁ|אַלְגֶּבְּרִית|אִלְגּוּן|אַלְגּוֹרִיתֶם|אֶלֶגַנְטִי|אָלָה|אַלְהוֹרוּת|אֱלֹהִי|אֱלֹהִים|אֵלּוּ|אִלּוּחַ|אָלוֹטְרוֹפּ|אָלוֹטְרוֹפְּיָה|אֱלוּל|אִלּוּלֵא|אֱלוּלִי|אָלוּמִינְיוּם|אַלּוֹן|אֲלוּנְתית|אָלוֹסְטֶרְיָה|אַלּוּף|אִלְחוּשׁ|אַלְטָאִיר|אַלְטוֹקוּמוּלוּס|אַלְטֶר|אַלְטְרוּאִיזְם|אַלְטֶרְנָטִיבִית|אַלִּיבָּא|אָלִיבִּי|אָלִיגָטוֹר|אֵלִיָּה|אֵלִיָּהוּ|אֶלִיטִיזְם|אָלִיטֶרַצְיָה|אֱלִיל|אֱלִילִים|אַלִּים|אַלִּימוּת|אֶלִימִינַצְיָה|אֶלִיפְּטִי|אֵלִיפְּטִיקָל|אֵלִיפְּסָה|אֶלִיפְּסוֹאִיד|אֵלִיקְסִיר|אֱלִישָׁה|אֲלִית|אַלְכּוֹהוֹל|אַלְכּוֹהוֹלִיזְם|אַלְכּוֹהוֹלִיסְט|אַלְכִימַאי|אַלְכִימְיָה|אֲלַכְסוֹן|אֲלֶכְּסַנְדֶּר|אֲלֶכְּסַנְדְּרִיָּה|אֲלֶכְּסַנְדְרִית|אָלֵל|אַלְלָה|אַלֵלוֹכִימִיקָל|אָלֶלוֹפַּתְיָה|אֵלֶם|אַלְמֻגִּים|אֲלֻמָּה|אַלְמוֹנִי|אַלְמָוֶת|אִלְמָלֵא|אִלְמָלֵי|אַלְמָן|אַלְמָנְדִין|אַלְמָנָה|אַלְמָנוּת|אֶלֶמֶנְטָרִי|אַלְמָנָךְ|אַלְמְנַת|אֶלֶן|אֲלֻנְקָה|אָלַסְקָה|אֶלָּסָר|אֶלֶף|אַלְפָא|אָלֶפְבֵּית|אָלֶפְבֵּיתִי|אִלְפָּה|אַלְפָחוֹר|אַלְפִּית|אֻלְפָּן|אֻלְפָּנָה|אִלְפָּס|אֶלֶקְטִיבִי|אֶלֶקְטְרָה|אֶלֶקְטְרוֹאוֹפְּטִיקָה|אֶלֶקְטְרוֹאֶנְצֶפָלוֹגְרָם|אֶלֶקְטְרוֹאֶנְצֶפָלוֹגְרָף|אֶלֶקְטְרוֹאָקוּסְטִיקָה|אֶלֶקְטְרוֹדִינָמִיקָה|אֵלֶקְטְרוֹכִימַאי|אֵלֶקְטְרוֹכִימִי|אֶלֶקְטְרוֹכִימְיָה|אֶלֶקְטְרוֹלִיזָה|אֶלֶקְטְרוֹלִיטִי|",
"אֶלֶקְטְרוֹמַגְנֵטִיוּת|אֶלֶקְטְרוֹמַגְנֵטִית|אֶלֶקְטְרוֹן|אֶלֶקְטְרוֹנִי|אֶלֶקְטְרוֹנִיקָה|אֶלֶקְטְרוֹנִית|אֶלֶקְטְרוֹסְטָטִיקָה|אֶלֶקְטְרוֹסְקוֹפּ|אֵלֶקְטְרוֹפּוֹרַצְיָה|אֵלֶקְטְרוֹקַרְדְּיוֹגְרָמָה|אֱלֹקִי|אַלְקִיל|אַלְקִילַצְיָה|אַלְקָלִית|אַלְקֶן|אָלֶרְגִּי|אָלֶרְגִּיָּה|אָלֶרְגֶּן|אֵלַת|אִלְתּוּר|אֵלָתִיִּים|אִלְתִּית|אַלְתַּר|אִם|אִמָּא|אַמְבּוּשׁ|אַמְבָּט|אַמְבַּטְיָה|אַמְבִּיגְרָמָה|אַמְבִּיוָלֶנְטִי|אַמְבִּיצְיָה|אַמְבַּסָּדוֹר|אֶמְבַּרְגּוֹ|אֶמְבְּרִיּוֹלוֹגְיָה|אֹמֶד|אֻמְדָּן|אָמָה|אַמְהָרִית|אַמּוֹ|אָמוֹדַאי|אִמּוּם|אֵמוּן|אֱמוּנָה|אָמוֹנְיָאק|אֱמוּנִים|אִמּוּנִית|אִמּוּץ|אָמוֹק|אָמוּר|אֱמוֹרִי|אֵמוּרִים|אָמוֹרְפִיּוּת|אַמּוֹת|אָמִיגְדָלָה|אָמִיד|אֶמַיְל|אָמִין|אָמִינִית|אֶמִיסְיָה|אַמִּיץ|אָמִיר|אַמִירָל|אֻמְלָל|אַמָּמָה|אֹמֶן|אֲמָנָה|אַמְנוֹן|אָמָּנוּת|אֻמָּנוּתוֹ|אַמְנֶזְיָה|אֶמַנְצִיפַּצְיָה|אַמְסְטֶרְדָּם|אַמְפּוּטַצְיָה|אַמְפּוּלָה|אַמְפוֹרָה|אַמְפוֹתֵרִי|אַמְפֶטָמִין|אַמְפִיבּוֹלְיָה|אַמְפִיבִּי|אַמְפִיבְּיָה|אַמְפִיבִּית|אַמְפִיפִילִיוּת|אֶמְפִּירִי|אֶמְפִּירִיזְם|אַמְפִיתֵאַטְרוֹן|אַמְפְּלִיטוּדָה|אַמְפְּלִיקוֹן|אֶמְפָּנַדָה|אַמְפֶּר|אַמְפֶּרְמֶטֶר|אֶמְפַּתְיָה|אֹמֶץ|אַמְצָאוֹת|אֻמְצָה|אֶמְצָעִי|אֶמְצָעִית|אֹמֶר|אִמְרָה|אֲמָרֶטוֹ|אֲמָרִים|אָמֶרִיציוּם|אָמֵרִיקָאִי|אָמֶרִיקָה|אָמֶרִיקָנוֹ|אָמֶרִיקָנִי|אִמְרַת|אֶמֶשׁ|אֱמֶת|אֲמִתָּה|אַמְתַּחַת|אֲמַתְלָה|אַנְ'לֹא|אֶנֵאַגְרָמָה|אַנְאוֹקְסִי|אַנְאוֹרְגָּנִית|אָנָאלִי|אַנְאֵרוֹבִּי|אָנְגִ'ינָרַה|אַנְגִּינָה|אִנְגְּלוּז|אַנְגְּלִי|אַנְגְּלִית|אַנְגְסְטְרוֹם|אָנַגְרָמָה|אֵנְדוֹדֶרְמָה|אֶנְדּוֹטוֹקְסִין|אֶנְדּוֹסְפֶּרְם|אֶנְדּוֹסְקוֹפּ|אִנְדוּקְס|אֶנְדּוֹקְרִינוֹלוֹג|אֶנְדּוֹקְרִינוֹלוֹגְיָה|אֶנְדוֹרְפִין|אַנְדָּלוּסְיָה|אֶנְדֶמְיָה|אַנְדְּרָגוֹגְיָה|אַנְדְּרוֹפוֹבְּיָה|אָנָה|אָנוּ|אִנּוּד|אָנוֹדָה|אָנוֹמְיָה|אָנוֹמַלְיָה|אֲנוֹנָה|אֲנוֹנִימִיּוּת|אָנוֹפֶלֶס|אָנוֹרֶקְסִיָּה|אֱנוֹשׁ|אֲנוּשׁוֹת|אֱנוֹשִׁי|",
"אֻנּוֹת|אֶנְזִים|אֶנְזִימָטִית|אֲנָחָה|אֲנַחְנוּ|אַנְטָגוֹנִיזְם|אַנְטָגוֹנִיסְט|אֶנְטוֹמוֹלוֹגְיָה|אָנָטוֹמְיָה|אַנְטִי|אַנְטִיבִּיּוֹזָה|אַנְטִיבְּיוֹטִי|אַנְטִיבְּיוֹטִיקָה|אַנְטִיטוֹקְסִין|אַנְטִילוֹפָּה|אַנְטִילְיָה|אַנְטִימוֹן|אַנְטִיפָּתִי|אַנְטִיקְלִינָה|אַנְטִישֵׁמִי|אַנְטִישֵׁמִיּוּת|אַנְטִיתֵזָה|אַנְטֶנָה|אַנְטֶרוֹגְרָדִית|אֶנְטְרוֹפְּיָה|אֳנִי|אֵנִיגְמָטִי|אֳנִיַָה|אָנִיהִילַצְיָה|אַנְיוֹן|אֳנִיוֹת|אָנִימָה|אָנִימָטוֹר|אָנִימַצְיָה|אֳנִיַת|אֲנָךְ|אָנֹכִי|אָנַכְרוֹנִיזְם|אַנְלָגִין|אָנָלוֹגִי|אָנָלוֹגְיָה|אֲנָלִיזָה|אָנָלִיטִי|אָנָלִיטִית|אָנָלִיסְט|אָנֶמוֹמֶטֶר|אַנָמוֹקְס|אָנָמוֹרְפִיזֶם|אָנֶמְיָה|אָנָנָס|אַנֶנְצֶפַלִי|אֹנֶס|אָנֶסְתֶזְיָה|אָנָעָרֶף|אֲנָפָה|אָנָפוֹרָה|אַנְפּוֹרְיָא|אַנְפִּין|אֶנְצִיקְלוֹפֶּדְיָה|אֶנְצֵפָלוֹפַּתְיָה|אַנֵקְדוֹטָה|אֲנָקָה|אֶנְקוֹדֶר|אַנְקוֹל|אֶנְקוֹפְּרֶזִיס|אַנְקוֹר|אֶנְקְלִיטִי|אֵנֶרְגִּיָּה|אָנַרְכִי|אָנַרְכְיָה|אָנַרְכִיזְם|אַנְשֵׁי|אֲנָשִׁים|אַנְתּוֹלוֹגְיָה|אַנְתְּרוֹפּוֹאִיד|אַנְתְּרוֹפּוֹלוֹג|אַנְתְּרוֹפּוֹלוֹגְיָה|אַנְתְּרוֹפּוֹנוֹמַסְטִיקָה|אַנְתְּרוֹפּוֹקֶן|אָסָאדוֹ|אַסְדָּה|אַסְדַת|אָסוּךְ|אֲסוֹן|אָסוֹנַנְס|אָסוּף|אֲסוּפִי|אָסוֹצְיַאצְיָה|אִסּוּר|אֲסוּרִים|אָסוּתָא|אִסְטְוָה|אֶסְטוֹנְיָה|אִסְטוּר|אַסְטָטִין|אַסְטִיגְמָצִיָּה|אַסְטֶלָה|אֶסְטָן|אִסְטְנִיס|אַסְטֶרוֹאִיד|אַסְטֶרוֹאִידִים|אַסְטְרוֹלוֹג|אַסְטְרוֹלוֹגְיָה|אַסְטְרוֹמֶטְרִיָה|אַסְטְרוֹנוֹם|אַסְטְרוֹנוֹמִי|אַסְטְרוֹנוֹמְיָה|אִסְטַרְטָא|אֶסְטְרִיוֹל|אַסְטֶרִיזְם|אֶסְטֵרִיפִיקַצְיָה|אַסְיָה|אֲסִימוֹן|אָסִימְפְּטוֹטָה|אָסִיסְטֶנְט|אָסִיף|אֲסִיר|אֲסִירִים|אֶסְכַּדְרָה|אַסְכּוֹלָה|אַסְכָּלָה|אַסְכֶּמֶת|אֵסֶל|אַסְלָה|אַסְלָנִית|אָסָם|אָסֶמְבְּלִי|אָסֶמְבְּלֶר|אַסְמַכְתָּה|אָסָף|אַסְפַלְט|אִסְפְּלָנִית|אַסְפַּמְיָה|אַסְפָן|אַסְפָּנָה|אַסְפָנוּת|אֲסַפְסוּף|אַסְפֶּסֶת|אַסְפָּקָה|אַסְפַּקְלַרְיָה|אַסְפָּרָגוֹס|אֶסְקַדְרוֹן|אַסְקֶטִי|אֶסְקָלַצְיָה|אֶסְקֶפִּיזְם|",
"אַסְקֻפִּית|אִסָּר|אִסְרוּ|אַסֵרוֹלָה|אַסֶרְטִיבִי|אֶסְתֶּטִיקָה|אַסְתְּמָה|אֶסְתָּן|אַסְתֵנוֹסְפַרָה|אֶסְתֵּר|אִסְתְּרָא|אַף|אַפּ|אַפְגָּנִיסְטָן|אֲפֻדָּה|אַפֶּדֶן|אַפַּדְנָא|אֲפֻדַת|אַפְהֶליוֹן|אֵפוֹא|אַפוֹגַטוֹ|אֵפוֹד|אֵפוּזְיָה|אַפּוֹטְרוֹפּוֹס|אֲפוּיָה|אִפּוּל|אָפּוֹלוֹגֶטִיקָה|אֲפוּנָה|אֶפּוֹנִים|אֶפּוֹס|אִפּוּק|אַפּוֹקַלִיפְּסָה|אִפּוּר|אַפּוֹתֵקָאִי|אַפְטֶר|אֹפִי|אֶפִּיגוֹן|אֶפִּיגוֹנִיוּת|אֶפִּיגְרַפְיָה|אֶפִּידֶמְיוֹלוֹגְיָה|אֶפִּידֶרְמִיס|אֶפִּיזוֹדָה|אֶפִּיטָף|אָפִיל|אֶפִּילוֹג|אֶפִּילֶפְּסְיָה|אֶפִּילַצְיָה|אָפְיָנִית|אֶפִּינֶפְרִין|אֶפִּיסְטֵזָה|אֶפִּיסְטֶמוֹלוֹגְיָה|אֶפִּיסְקוֹפּ|אֶפִּיפוֹרָה|אַפִּיפְיוֹר|אֶפִּיפִיט|אֲפִיפִית|אֲפִיצוּת|אָפִיק|אֲפִיקוֹמָן|אֶפִּיקוֹנְטִינֶנְטָלִי|אֶפִּיקוֹרוֹס|אֶפִּיתֶל|אֲפֵלָה|אֲפִלּוּ|אַפְּלָטוֹנִי|אַפְּלָטוֹנִית|אַפְלָיָה|אַפְּלִיקַצְיָה|אֵפֵמֵרָה|אֹפֶן|אָפְנָיו|אֶפֶס|אַפְּסִידָה|אָפְסַיִם|אַפְסַנְיָא|אַפְסָר|אֶפַע|אֶפֶּעס|אֹפֶק|אֶפֶקְט|אֶפֶקְטִיבִי|אָפְקִי|אָפְקִיּוּת|אֲפָר|אַפְרוֹדִיזְיָאק|אַפְרוֹדִיטִי|אֶפְרוֹחַ|אִפְרוּט|אַפְרוֹטְרוֹפִּי|אַפְּרוֹפּוֹ|אַפְרוּרִי|אַפְרוּרִיּוּת|אַפְרוּרִית|אַפַּרְטְהַיְד|אַפִּרְיוֹן|אָפֶּרִיטִיף|אַפְּרִיל|אֲפֹרִים|אַפְרִיקַאי|אַפְרִיקָאנְְס|אַפְרִיקָה|אֲפַרְכֶּסֶת|אֲפַרְסְמוֹן|אֲפַרְסֵק|אֲפַרְפַּר|אֲפַרְשְׁזִיף|אֶפְרָת|אִפְשׁוּט|אֶפְשָׁר|אֶפְשָׁרוּת|אַפַּתְיָה|אֶצְבַּע|אֶצְבָּעוֹן|אֶצְבָּעוֹת|אַצָּה|אַצְוָה|אִצְטַבָּה|אִצְטַגְנִין|אִצְטַדְיוֹן|אִצְטוּמְכָא|אָצֶטוֹן|אִצְטְוָנָה|אָצֵטִילְכוֹלִין|אָצֶטִית|אִצְטְלָה|אִצְטְרֻבָּל|אַצְטְרוֹלָב|אָצִיל|אֲצִילָה|אֵצֶל|אָצָן|אֶצְעָדָה|אַק'|אֶקְדָּח|אֶקְדָּם|אָקָדֶמִי|אָקָדֶמְיָה|אָקָדֶמִית|אַקּוֹ|אַקְוָה|אֶקוֹטוֹן|אֶקוֹטוֹפּ|אֵקוֹטִיפּ|אֶקְוִיוָלֶנְטִית|אַקְוִיקְלוּדָה|אֶקוֹלוֹגִי|אֵקוֹלוֹגְיָה|אֶקוֹלוֹגִית|אַקְוָמָרִין|אָקוֹן|אָקוּסְטִיקָה|אָקוּסְטִית|אֶקוֹפֵמִינִיזְם|אֵקוֹפֵנוֹטִיפּ|אֵקוֹקְלִינָה|אָקוֹרְד|אָקּוֹרְדִּיּוֹן|אָקוֹרוּס|",
"אַקְוַרְיוּם|אַקְוָתְלוֹן|אֲקְטוּאַלְיָה|אַקְטוּאָר|אַקְטוּאַרְיָה|אֵקְטוֹדֶרְמָה|אֶקְטוֹזִיט|אֶקְטוֹטְרוֹפִי|אַקְטִיבַצְיָה|אַקְטִינוֹבִּיּוֹלוֹגְיָה|אַקְטִינְיוּם|אִקְלוּם|אַקְלִים|אַקְלִימִית|אֵקָלִיפְּטוּס|אַקְנֶה|אֶקְסְהִיבִּיצְיוֹנִיזְם|אֶקְסוֹבִּיּוֹלוֹגְיָה|אֶקְסוֹן|אַקְסוֹנוֹמֶטְרְיָה|אֶקְסוֹסְפֵרָה|אֶקְסְטָזָה|אֵקְסְטְרוֹבֶרְטִי|אֶקְסְטֶרְמוּם|אֶקְסְטְרֵמוֹפִיל|אַקְסְיוֹמָה|אֶקְסְפְּרֶסִיבִי|אַקְצָרָה|אַקְרָאִי|אִקְרָה|אַקְרוֹבָּט|אַקְרוֹמֵגָלְיָה|אַקְרוֹפוֹבְּיָה|אַקְרוֹפּוֹלִיס|אַקְרִילִי|אַר|אֶרְאֵל|אַרְבַּאי|אֲרֻבָּה|אֲרֻבּוֹת|אֶרְבְּיוּם|אַרְבַּע|אַרְבָּעָה|אַרְבָּעוֹן|אַרְבַּעַת|אֶרֶג|אַרְגּוֹן|אַרְגַּז|אַרְגָּמָן|אַרְגְּמֶנֶת|אַרְגֶּנְטוֹמֶטְרִיָּה|אָרָד|אָרָה|אֵרוֹבִּי|אֵרוֹגֶ'ל|אֻרְוָה|אָרוּז|אֲרוּחָה|אֲרוּחַת|אֶרוֹטִי|אֲרוּכָה|אָרוֹמָה|אָרוֹמָטִי|אָרוֹמָתֶרַפְּיָה|אָרוֹן|אָרוֹנִיסְט|אֵרוֹס|אֵרוּסִין|אֵרוּעַ|אָרוּר|אֹרֶז|אַרְזָה|אֹרַח|אָרְחוֹ|אָרְחוֹת|אָרְחֵי|אַרְטִיזַנְלִי|אַרְטִילֶרְיָה|אַרְטִיק|אַרְטִישׁוֹק|אַרְטֶרְיוֹזוּס|אֲרִי|אֲרִיאֵל|אָרִיג|אַרְיֵה|אֲרָיוֹת|אֲרִיזָה|אֲרִיזוֹנָה|אָרִיחַ|אֱרִימוֹן|אֲרִינָמָל|אֲרִיסוּת|אֹרֶךְ|אַרְכֵאוֹזוֹאוֹלוֹגְיָה|אַרְכֵאוֹלוֹג|אַרְכֵאוֹלוֹגִי|אַרְכֵאוֹלוֹגְיָה|אַרְכֵאוֹן|אַרְכָאִי|אַרְכָאִיקוֹן|אַרְכֻּבָּה|אֲרֻכָּה|אַרְכּוֹף|אָרְכִּי|אַרְכִיב|אַרְכִיבִּישׁוֹף|אַרְכִיוֹן|אַרְכִיטֶקְטוּרָה|אַרְכִימֶדֶס|אַרְכִיפֶּלָג|אָרְכִּית|אַרְכֵלוֹן|אָרַכְנוֹלוֹגְיָה|אָרַכְנוֹפוֹבְּיָה|אַרְכָנִי|אֶרְלֶנְמָיֶר|אֲרָם|אַרְמָגֶדוֹן|אַרְמָדָה|אַרְמָדִיל|אַרְמוֹן|אֶרְמֵז|אַרְמִיָּה|אֲרָמִית|אֹרֶן|אַרְנָב|אַרְנָבוֹן|אַרְנֶבֶת|אַרְנוֹנָה|אָרְנִיָּה|אַרְנָק|אֶרֶס|אַרְסֶן|אַרְסֵנוֹפִּירִיט|אַרְסֵנִיד|אַרְסֵנָל|אֵרָעוֹן|אֲרָעִי|אֶרֶץ|אַרְצוֹת|אַרְצִי|אֶרֶקְטוּס|אֲרָרָט|אֲרֶשֶׁת|אִשׁ|אֶשְׁבּוֹרָן|אֶשְׁגָּר|אֶשְׁגָרִים|אֶשְׁגָרִית|אֶשֶׁד|אַשְׁדּוֹד|אִשֶּׁה|אַשּׁוּחַ|אִשּׁוּם|אָשׁוּר|אַשּׁוּרִית|אָשְׁיָה|אֲשִׁישָה|אֶשֶׁךְ|אַשְׁכָּבָה|",
"אֶשְׁכּוֹל|אַשְׁכּוֹלות|אֶשְׁכּוֹלִית|אַשְׁכְּנַז|אַשְׁכְּנַזִּי|אֻשְׁכָּף|אֶשְׁכָּר|אַשְׁכָּרָה|אֵשֶׁל|אַשְׁלָג|אַשְׁלְגָן|אַשְׁלָיָה|אָשֵׁם|אַשְׁמַאי|אַשְׁמְדַאי|אַשְׁמָה|אַשְׁמוּרָה|אַשְׁמֹרֶת|אֶשְׁנָב|אַשָּׁף|אַשְׁפָּה|אִשְׁפּוּז|אֻשְׁפִּיז|אֶשְׁפָּר|אַשְׁפָּתוֹת|אִשְׁקוּקָה|אִשְׁקוּקָן|אַשְׁקְלוֹן|אֶשְׁקָף|אֹשֶׁר|אַשְׁרַאי|אֲשֵׁרָה|אַשְׁרֵי|אֵשֶׁת|אֶשְׁתַּנּוּר|אֶשְׁתָּקַד|אֶת|אָתֵאִיזְם|אָתֵאִיסְט|אֶתְגָּר|אַתָּה|אֵתוֹלוֹגְיָה|אֲתוּנָה|אֵתוֹס|אִתְחוּל|אֶתִי|אַתִּיק|אַתְלֵט|אַתְלֶטִיקָה|אַתֶּם|אֶתְמוֹל|אֵתְנוֹאֵקוֹלוֹגְיָה|אֵתְנוֹבּוֹטָנִיקָה|אֵתְנוֹבִּיוֹלוֹג|אֵתְנוֹבִּיוֹלוֹגְיָה|אֶתְנוֹגְרַפְיָה|אֵתְנוֹזוֹאוֹלוֹגְיָה|אֶתָנוֹל|אֶתְנוֹלוֹגְיָה|אֵתְנוֹלֶקְט|אֶתְנוֹמוּזִיקוֹלוֹגְיָה|אֵתְנוֹפּוֹאֵטִיקָה|אֶתְנוֹצֶנְטְרִי|אֶתְנַחְתָּא|אֶתְנַחְתָּה|אֶתְנִי|אֶתְנִית|אֶתְנַן|אֶתְנַרְךְ|אֶתֶר|אֶתְרוֹג|אֶתֶרִי|אִתְּרַע|בָּא|בְּאָב|בְּאִבּוֹ|בָּאוּ|בָּאוֹבַּבּ|בָּאֲוִיר|בָּאוּלִינְגּ|בֵּאוּר|בְּאִי|בָּאיֵה|בֹּאֲכָה|בְּאָלֶף|בַּאַס|בַּאְסָה|בְּאַסְפַּמְיָה|בְּאֶצְבַּע|בָּאקוּ|בְּאֵר|בְּאַרְבַּע|בְּאֵשׁ|בָּב|בְּבַד|בָּבָה|בָּבוּאָה|בַּבּוֹנָג|בְּבֶכִי|בָּבֶל|בֻּבָּן|בֻּבָּנַאי|בְּבַקָּשָׁה|בֻּבַּת|בֶּגֶד|בַּגְדָּד|בְּגָדוֹל|בִּגְדֵי|בְּגוֹ|בִּגּוּד|בָּגָז'|בָּגֶט|בְּגִידָה|בְּגִין|בְּגִלּוּי|בְּגַמָּד|בְּגַפּוֹ|בַּגָּרוֹן|בַּגְרוּת|בַּד|בַּדַּאי|בַּדָּבָר|בִּדְבַשׁ|בִּדְגָלִים|בָּדָד|בִּדּוּד|בָּדוּק|בִּדּוּר|בְּדוּתָה|בִּדְחִילוּ|בְּדֵי|בְּדִיד|בְּדִידוּת|בִּדְיוֹן|בִּדְיוֹנִי|בְּדִיחָה|בְּדִיחַת|בְּדִימוֹס|בְּדִיעֲבַד|בְּדִיקָתִיּוּת|בְּדָל|בַּדְלָנוּת|בִּדְמִי|בְּדַעְתּוֹ|בֶּדֶק|בַּדַּקָה|בַּדֶּרֶךְ|בַּה|בֹּהוּ|בַּהַט|בָּהִיר|בֶּהָלָה|בְּהֵמָה|בְּהֶמְשֵׁכִים|בֹּהֶן|בְּהֶפְסֵדוֹ|בְּהַקְפָּאָה|בַּהֶרֶת|בּוֹ|בּוּבָּל|בּוֹגֵד|בּוּגֶנְוִילְיָה|בּוּד|בּוֹדֵד|בּוּדְהִיזְם|בּוּדַפֶּשְׁט|בּוּדְקֶה|בּוֹהֵמָה|בּוֹזֹֹוֹן|בּוֹט|בּוֹטֶה|בּוּטָנוֹל|בּוֹטָנִיקָה|בּוֹטָנִית|בּוֹיָה|",
"בּוּכְטָה|בּוּכְיָר|בּוּל|בּוּלְגַּרְיָה|בּוֹלֵט|בּוֹלֵעַ|בּוֹלשֵׁבִיק|בּוּלְשִׁיט|בּוֹמְבָּה|בּוֹנֶה|בּוֹנְנוּת|בּוֹנְסַאי|בּוּנְקֶר|בּוּע|בּוּעָה|בּוּעַת|בּוּץ|בּוּצִית|בּוֹק|בּוּקִיצָה|בּוּקָנִיר|בּוּקְסָה|בּוֹקַעַת|בּוֹקֵר|בּוּקָרֶשְׁט|בּוֹר|בּוֹרְדֶל|בּוּרוּת|בּוֹרְחָנוּת|בּוּרִי|בּוּרְסָה|בּוּרְסִי|בּוּרְסְקִי|בּוּרְקָה|בּוּרֶקָס|בּוֹרְרוּת|בּוּשָׁה|בַּז|בֵּז'|בָּזוּקָה|בִּזּוּר|בִּזָּיוֹן|בָּזִיךְ|בָּזִילִיקוּם|בַּזְיָר|בַּזְיָרוּת|בַּזֶּלֶת|בָּזָק|בַּזָּר|בַּחוּן|בָּחוּר|בְּחוּרוֹת|בְּחֵטְא|בְּחִילָה|בְּחִינַת|בָּחִיר|בְּחִירוֹת|בּׂחַן|בְּחֶסֶד|בְּחֵפֶץ|בַּחֲצִי|בַּטַּאי|בִּטוּחַ|בִּטּוּי|בֶּטוֹן|בֶּטַח|בִּטָּחוֹן|בְּטַחֲנוֹת|בָּטָטָה|בָּטִיחַ|בְּטִיחוּת|בָּטֵל|בָּטֶלְדְרֶס|בַּטָּלָה|בְּטֵלִים|בַּטְלָן|בֹּטֶן|בְּטָעוּן|בַּי|בִּיאָה|בִּיב|בֵּיבִּיסִיטֶר|בִּיבְּלִיוֹגְרַפְיָה|בִּיבְּלִיּוֹמַנְיָה|בִּיבְּלִיּוֹפִיל|בִּיבְּלִיּוֹפִילְיָה|בֵּיבָר|בֵּיְגָּלֶה|בְּיַד|בִּידֶה|בְּיָדוֹ|בִּידוּד|בִּיהֶבְיוֹרִיזְם|בִּיוֹ|בִּיוֹגֵּאוֹגְרַפְיָה|בִּיוֹגֶנֶזָה|בִּיוֹגְרָפְיָה|בִּיּוֹטִיפּ|בִּיוֹטֶכְנוֹלוֹגְיָה|בִּיוֹכִימִי|בִּיוֹכִימְיָה|בִּיוֹלוֹג|בִּיוֹלוֹגִי|בִּיוֹלוֹגְיָה|בִּיוֹלוֹגִית|בִּיּוֹם|בִּיוֹמָה|בִּיּוֹמֶטְרִיָּה|בִּיוֹמִימִיקְרִי|בִּיוֹמִינֶרָל|בִּיוֹמִינֶרָליזַצְיָה|בִּיוֹמֶכָנִיקָה|בִּיוּן|בִּיוֹנִיקָה|בִּיוֹנָנוֹטֶכְנוֹלוֹגְיָה|בִּיוֹפּוֹלִימֶר|בִּיוֹפִידְבֶּק|בִּיּוֹפִיזִיקָה|בִּיּוּץ|בִּיּוּת|בְּיוֹתֵר|בִּיז'וֹ|בִּיזָרִי|בְּיַחַס|בִּיט|בִּילְהַרְצְיָה|בִּילְיַארְד|בִּילִירוּבִּין|בַּיָם|בִּימְבָּה|בִּימָה|בַּיָּמִים|בֵּין|בִּינָה|בֵּינַיִם|בֵּינַת|בִּיס|בֵּיסְבּוֹל|בִּיסְמוּת|בִּיסְקְוִיט|בִּיסֶקְסוּאָלִיּוּת|בִּיפוֹבְּיָה|בֵּיצָה|בֵּיצִים|בִּיקִינִי|בִּיקַרְבּוֹנָט|בִּירָה|בִּירוֹקְרַטִיָּה|בִּירִית|בִּירֶמָה|בִּישׁ|בִּישׁוֹף|בִּישׁוֹפוּת|בַּיְשָׁן|בַּיִת|בֵּיתָא|בָּיְתָה|בִּיתָן|בִּכְבוֹדוֹ|בַּכְּבִישִׁים|בִּכְדֵי|בְּכוֹס|בִּכּוּר|בְּכוֹרָה|בְּכוֹרוֹת|",
"בִּכּוּרִים|בֶּכִי|בָּכִיר|בְּכָל|בַּכְּלָלִי|בֻּכְנָאִי|בֻּכְנָה|בִּכְפִיָּה|בֶּכֶר|בְּכֶתֶר|בַּל|בְּלא|בַּלָּאט|בַּלַאטַה|בֻּלְבּוּל|בֻּלְבּוּסִי|בֶּלְגְּיָה|בָּלָגָן|בַּלְדָּר|בֶּלָה|בַּלָּהָה|בְּלוֹ|בְּלוֹג|בְּלוֹגֶר|בַּלוּט|בַּלּוּטַת|בָּלוּם|בָּלוֹן|בְּלוֹנְד|בְּלוֹנְדָה|בְּלוֹף|בְּלוֹק|בָּלוֹרָה|בְּלוֹרִית|בְּלוֹש|בְּלוּת|בָּלֵט|בָּלָטָה|בֶּלִי|בֵּלִיבֵּר|בְּלָיָה|בֶּלִיז|בְּלִיטָה|בַּלַּיְלָה|בְּלִימָה|בְּלַיְנְד|בָּלִיסְטִי|בָּלִיסְטִיקָה|בָּלִיסְטְרָה|בְּלִיעָה|בְּלֵך|בָּלָם|בֻּלְמוֹס|בַּלָּן|בְּלֶנְדֶּר|בַּלְסָמִי|בְּלֶק|בַּלְקוֹן|בָּלֶרִינָה|בַּלָּשׁ|בַּלְשָׁן|בַּלְשָׁנוּת|בֹּלֶשֶׁת|בִּלְתִּי|בַּמַּאי|בַּמְבּוּק|בַּמִּדְבָּר|בָּמָה|בְּמוֹ|בְּמוֹל|בְּמַחֲלֹקֶת|בְּמָטוּתָה|בְּמֵישָׁרִין|בִּמְכֻוָּן|בִּמְלוֹא|בְּמַעֲלֵה|בַּמְשׁוֹטִים|בִּמְשׂוּרָה|בְּמִתְכַּוֵּן|בֶּן|בַּנַּאי|בַּנָּאִים|בַּנְג'וֹ|בַּנְדִיט|בָּנוֹת|בֶּנְזוֹדִיאָזָפִּין|בֶּנְזִין|בַּנְטוּ|בִּנְטִיעוֹת|בִּנְיָה|בָּנִים|בִּנְיָמִין|בִּנְיָמִינָה|בִּנְיַן|בְּנִיַּת|בָּנָלִי|בָּנָנָה|בָּנָנוֹת|בְּנַפְשׁוֹ|בַּנְק|בַּנְקוֹמָט|בַּנְקָט|בְּנֵרוֹת|בָּס|בִּסְדוֹם|בְּסֶדֶר|בַּסּוּגַר|בָּסוֹן|בְּסוּפָה|בַּסְטָה|בָּסִילְקִי|בְּסִימָן|בָּסִיס|בְּסֵיסֶה|בָּסִיסְט|בְּסִיסִי|בְּסִיסִים|בֻּסְתָּן|בַּסֵּתֶר|בְּעַד|בְּעוׂכְרָיו|בִּעוּר|בֹּעַז|בְּעִיטָה|בְּעִיטַת|בְּעִילַת|בְּעַיִן|בְּעֵינוֹ|בָּעִיר|בָּעֵית|בַּעַל|בַּעֲלִיל|בָּעֹמֶר|בְּעָנָן|בְּעִסּוּק|בְּעַצְמוֹתָיו|בְּעַצְמְךָ|בְּעֵרָה|בַּעֲרוּת|בְּעָרְפּוֹ|בַּעֲרָפֶל|בַּעַת|בְּעָתָה|בְּפֶה|בְּפַחֵי|בְּפִיו|בִּפְסִיסִים|בֹּץ|בַּצִּבּוּר|בְּצַד|בִּצָּה|בְּצַוָּארוֹ|בִּצּוּעַ|בָּצִיר|בִּצִּית|בָּצָל|בְּצַלְאֵל|בַּצַּלַּחַת|בְּצַלְצַל|בֶּצַע|בָּצֵק|בַּצֶּקֶת|בֶּצֶר|בִּצָּרוֹן|בַּצֹּרֶת|בַּקְבּוּק|בַּקְבּוּקוֹן|בַּקֶבֶר|בְּקִבְרוֹ|בִּקּוּעַ|בִּקּוּר|בְּקָטָן|בַּקְּטַנָּה|בַּקְטֶרְיָה|בַּקְטֶרְיוֹלוֹגְיָה|בָּקִי|בַּקִיר|בַּקְלָוָה|בֶּקַע|בְּקַעֲצוּר|בִּקְצֵה|בֹּקֶר|",
"בַּקָּרָה|בַּקַּרְקַע|בַּקָּרַת|בִּקֵּשׁ|בַּקָּשָׁה|בַּקְשִׁישׁ|בִּקְתָּה|בָּר|בְּרָאבוֹ|בָּרֹאשׁ|בָּרָאשִׁי|בְּרֵאשִׁית|בַּרְבּוּר|בָּרַבִּים|בְּרִבִּית|בֶּרְבַּק|בַּרְבָּרִי|בֹּרֶג|בֻּרְגּוּל|בָּרְגֵי|בָּרְגִיִּים|בְּרֶגֶל|בֻּרְגָּן|בֻּרְגָּנוּת|בָּרָד|בַּרְדְּלָס|בַּרְדָּס|בַּרְדָּק|בְּרַהְמָה|בַּרְוָז|בַּרְוָזוֹן|בַּרְוָזָן|בְּרוּחַ|בְּרוּטוֹ|בָּרוּךְ|בְּרוֹם|בְּרוֹמָא|בָּרוֹמֶטֶר|בְּרוֹקוֹלִי|בְּרוֹקֶר|בָּרוּר|בְּרוֹשׁ|בָּרוּת|בֶּרֶז|בְּרָזִיל|בַּרְזֶל|בַּרְזִלַּי|בְּרֶזֶנְט|בָּרִיא|בְּרִיאוּת|בְּרִיאוּתִי|בְּרִיאָתָנוּת|בְּרִיג|בְּרִיגָנְטִינָה|בְּרִיגָנִית|בִּרְיָה|בֻּרְיוֹ|בַּרְיוֹם|בִּרְיוֹן|בִּרְיוֹנוּת|בְּרִיּוֹשׁ|בְּרִיזָה|בָּרִיחַ|בְּרִיחַת|בָּרִיטוֹן|בְּרִיטִי|בְּרִיטַנְיָה|בְּרַיְל|בֶּרִילְיוּם|בְּרֵיק|בָּרִיקָדוֹת|בְּרֵישׁ|בֹּרִית|בָּרָיְתָא|בֶּרֶךְ|בְּרָכָה|בִּרְכוֹת|בְּרֵכִיָּה|בִּרְכַּיִם|בְּרֵכַת|בֶּרָלֶה|בְּרַם|בֶּרְמוּדָה|בֶּרְמוּדִי|בַּרְמֶן|בְּרֶנְדִּי|בַּרְנָשׁ|בָּרָק|בַּרְקַאי|בַּרְקוֹד|בַּרְקִית|בֶּרְקֶלְיוּם|בַּרְקֶנְטִינָה|בַּרְקָנִית|בָּרֶקֶת|בְּרָרָה|בְּרֵרַת|בִּרְשׁוּת|בֵּשׁ|בִּשְׁאֵלָה|בִּשְׁבָט|בִּשְׁבִיל|בִּשְׁבִילִי|בְּשֶׁבַע|בְּשׁוֹטְטוֹת|בִּשּׁוּל|בְּשׂוֹרָה|בַּשּׁוֹשַׁנִּים|בְּשֶכְּבָר|בִּשְׂכָרוֹ|בָּשֵׁל|בֹּשֶׂם|בְּשִׂמְחָה|בְּשֹׂמֶת|בָּשְׁנָה|בִּשְׁנֵי|בַּשַּׁעַר|בְּשֹׁפִי|בַּשַּׂק|בָּשָׂר|בִּשְׂרוֹנִי|בְּשִׁשִּׁים|בֹּשֶׁת|בַּת|בְּתֵאָבוֹן|בַּתֵּבָה|בָּתָה|בְּתוּלָה|בְּתוּלִים|בְּתוּלִין|בְּתוֹר|בַּתּוֹרָה|בִּתְיָה|בָּתִיסְקָף|בַּתֶּלֶם|בְּתֻפִּים|בֶּתֶר|בִּתְרוֹן|בִּתְשׁוּבָה|גָּ'בְּסְקוֹ|גּ'וֹלִיבּוֹט|גּ'וֹרָה|גַ'חְנוּן|גֶּ'ט|גִ'י|גִ'יבְּרִישׁ|גִ'ינְגִ'י|גִ'ינְגֶ'ר|גִ'ינְגֶּל|גִּ'ינְס|גִ'יפּ|גִּ'ירָפָה|גֶ'ל|גֶ'לָטִין|גָ'מוּס|גָ'מַיְקָה|גֶ'נְטְלְמֶן|גֶ'סְטָה|גֵּ'ק|גָ'קוּזִי|גֶ'קְסוֹן|גֶ'רִיקָן|גַּאדְגֵּ'ט|גֵּאֶה|גֵּאוֹבּוֹטָנִיקָה|גֵּאוֹגְלִיף|גֵּאוֹגְרָף|גֵּאוֹגְרַפְיָה|גֵּאוֹדֶזְיָה|גַּאֲוָה|גֵּאוֹכִימִי|",
"גֵּאוֹכְרוֹנוֹלוֹגְיָה|גֵּאוֹלוֹגִי|גֵּאוֹלוֹגְיָה|גֵּאוֹמֶטְרִי|גֵּאוֹמֶטְרִיָּה|גָּאוֹן|גֵּאוֹפּוֹלִיטִיקָה|גֵּאוֹפִיזִיקָה|גֵּאוֹפִיט|גָּאוּצ'וֹ|גֵּאוֹרְגִּי|גֵּאוּת|גַּאַוְתָנוּת|גֹֹּאַל|גְּאֻלָּה|גַּאלְיוֹט|גֵּב|גַּבַּאי|גְּבָבָה|גֹּבַהּ|גָּבְהִית|גְּבוֹהָה|גִּבּוּל|גִּבּוּעַ|גִּבּוֹר|גְּבוּרָה|גִּבֵּחַ|גַּבַּחַת|גָּבִין|גְּבִינָה|גְּבִינִית|גָּבִיעַ|גְּבִיר|גָּבִישׁ|גְּבִישׁוֹן|גַּבִּית|גַּבָּל|גֶּבֶן|גֶּבֶס|גִּבְעוֹל|גֶּבֶר|גַּבְרִי|גַּבְרִיאֵל|גַּבְרִיּוּת|גְּבֶרֶת|גְּבַרְתָּן|גִּבְּתוֹן|גֻּבְתַת|גַּג|גָּד|גֻּדְגְּדָן|גָּדָה|גְּדוּד|גְּדוּדִי|גְּדוּדִית|גָּדוֹל|גְּדוֹלָה|גְּדוֹלוֹת|גָּדוֹלִינְיוּם|גָּדִי|גָּדִיד|גְּדִיל|גָּדִישׁ|גֹּדֶל|גְּדַלְיָה|גֶּדֶם|גָּדֵר|גֹּדֶרֶת|גֹּדֶשׁ|גִּהוּק|גָּהָץ|גֵּו|גּוֹאָשׁ|גּוֹגוֹ|גֵּוָה|גּוּז'וֹן|גוֹזִי|גּוֹזָל|גוּזְנִיק|גּוֹחָה|גּוֹי|גּוּיָבָה|גּוֹיֵי|גְּוִיל|גּוֹל|גּוֹלְדָּה|גּוֹלְדֶּן|גּוּלֶט|גּוּלִיבֶר|גּוּלְיָר|גּוֹלָל|גּוֹלָן|גּוֹלְף|גּוֹלֵשׁ|גּוּמִי|גּוּמִיָּה|גּוֹמְלִין|גָּוֶן|גּוֹנְדוֹלָה|גּוֹנְדוֹלְיֵר|גוֹנְדִי|גּוֹסֵס|גּוּף|גּוּפָה|גּוּפִי|גּוּפִיָּה|גּוּפִיף|גּוֹפָן|גּוּפָנִי|גּוּפָנִית|גוּר|גּוֹרִילָה|גּוֹרָלִי|גּוֹרֵם|גּוּרְמֵה|גּוּרְנִישְׁט|גּוֹרֵר|גּוֹרֶרֶת|גּוּשׁ|גֵּוַת|גָּז|גִּזְבָּר|גָּזוֹז|גְּזֻזְטְרָה|גָּזִי|גָּזִיבּוֹ|גָּזִים|גְּזִירָה|גָּזִית|גָּזֵל|גָּזָם|גֶּזַע|גִּזְעוֹל|גֶּזֶר|גִּזְרָה|גִּזָּרוֹן|גִּזְרוֹנִי|גִּזְרַת|גָּחוׂן|גַּחְלִילִית|גַּחֶלֶת|גַּחֲמָה|גֵּט|גֶּטוֹ|גַּיְא|גִּיג|גִּיד|גִּיוּס|גִּיּוּר|גִּיּוֹרָא|גִּיחוֹר|גִּיטָרָה|גִּיטָרִיסְט|גִּיטָרַת|גֵּייְדָאר|גִּיל|גִּילָנוּת|גִּימַטְרִיָּה|גִּימִיק|גֵּיְמֶר|גִּינֵקוֹמַסְטְיָה|גַּיִס|גְּיָסוֹת|גִּיסָן|גִּיסָנִית|גִּיפֶן|גִּיר|גִּירוֹסְקוֹפּ|גִּירִית|גִּישָׁה|גַּל|גְּלָאִית|גַּלָּב|גַּלְבּוֹ|גָּלָבִּיָּה|גִּלְבֹּעַ|גִּלְגּוּל|גַּלְגַל|גַּלְגָּלוֹת|גַּלְגַּלֵּי|גַּלְגַּלִּים|גֻּלְגֹּלֶת|גַּלְגֶּשֶׁת|גֶּלֶד|גְּלַדְיָאטוֹר|גִּלֹה|גְּלוּאוֹן|",
"גְּלוֹבּוּס|גְּלוֹבָּלִית|גָּלוּחַ|גְּלוּטֶן|גָּלוּי|גְּלוּלָה|גְּלוּלַת|גָּלוֹן|גַּלְוָנוֹמֶטֶר|גַּלְוָנוֹפְּלַסְטִיקָה|גַּלְוָנִי|גְּלוּסְקָה|גְּלוֹסְקֵמָה|גְּלוּפָה|גִּלּוּפִין|גְּלוּקוֹז|גְּלוֹקָלִיזַצְיָה|גְלַזְגוֹ|גֶּלִי|גַּלֵּיאָה|גַּלֵיאוֹן|גַּלֵיאָסָה|גְּלִידֶרִיָּה|גַּלְיוּם|גִּלָּיוֹן|גָּלִיל|גְּלִילִי|גַּלִּים|גְּלִימָה|גַּלֵּינֵי|גְּלִיף|גְּלִיצֶרוֹל|גְּלִיצֶרִיד|גְּלִיקוֹגֶן|גְלִיקוֹלִיזָה|גָּלָל|גֹּלֶם|גַּלְמוּד|גְּלֶמְפִּינְג|גַּלְנוֹעַ|גַּלֶנְטֶרְיָה|גַּלְס|גִּלְעָד|גָּלַקְטוֹז|גָּלֶרְיָה|גַּלְשַׁן|גֻּלַּת|גַּם|גֹּמֶא|גַּמְבָּה|גִּמְגּוּם|גֹּמֶד|גַּמָּדוּת|גֻּמָּה|גָּמוּל|גַּמָּזִית|גֻּמְחָה|גֻּמִּי|גְּמִילָה|גְּמִילוּת|גָּמִישׁ|גְּמִישׁוֹת|גְּמִישִׁים|גָּמָל|גַּמְלָה|גַּמְלוֹן|גַּמְלוֹנִי|גַּמֶּלֶת|גָּמַר|גְמָרָא|גֵּן|גְּנַאי|גֵּנֵאָלוֹג|גַּנָּב|גַּנָּבִים|גְּנֵבַת|גַּנְגְוֵוי|גֻּנְדָּה|גֻּנְדָּר|גַּנְדְּרָן|גִּנָּה|גָּנוּב|גְּנוּבִים|גֶּנוֹטִיפּ|גֶּנוֹם|גֶּנוֹמִיקָה|גַּנּוֹן|גְּנוֹנָה|גֶּנוּסְיָא|גִּנּוֹסָר|גֶּנֶטִי|גֶּנֶטִיקָה|גֶּנֶטִית|גֶּנִיקוֹלוֹג|גֶּנִיקוֹלוֹגְיָה|גַּנָּן|גֵּנֵרָטוֹר|גֵּנֵרָל|גַּס|גַּסָּה|גַּסְטְרוֹאֶנְטְרוֹלוֹגְיָה|גַּסְטְרוֹלוֹגְיָה|גַּסְטְרוֹנוֹמְיָה|גִּעְגּוּעַ|גֵעוואַלְדּ|גֹּעַל|גַּעֲשִׁית|גַּף|גֶּפִילְטֶע|גָּפִיר|גֶּפֶן|גֹּפֶר|גָּפְרָה|גַּפְרוּר|גַּפְרוּרִים|גָּפְרִית|גָּפְרִיתִי|גָּפְרָתִית|גֶּפֶת|גֵּץ|גֵּר|גְּרָאד|גְּרָאוּט|גָּרָב|גִּרְבּוּץ|גַרְבִּיוֹן|גְּרָבִיטַצְיָה|גַּרְגְּרָן|גַּרְגְּרָנוּת|גַּרְדּוֹם|גְּרוֹג|גְּרוֹגֶרֶת|גֵּרוּד|גְּרוּזִינִי|גְּרוּטָאָה|גְּרוּטָה|גְּרוֹטֶסְקָה|גְּרוֹטֶסְקִי|גֵּרוּי|גָּרוֹן|גֶּרוֹנְטוֹלוֹגְיָה|גֶּרוֹנְטוֹפִילְיָה|גְּרוֹנִית|גָּרוֹס|גְּרוֹפִית|גָּרוּר|גֵּרוּשׁ|גֵּרוּשִׁין|גֶּרֶז|גַּרְזֶן|גַרְטְל|גָּרִיד|גְּרֵידָא|גְּרִידָה|גְּרִיז|גְּרִיטָה|גְּרִיל|גֶּרִילָה|גְּרֵיְן|גְּרִינְגּוֹ|גְּרִינִיץ'|גְּרִיס|גְּרִירָה|גֶּרֶם|גַּרְמוֹשְׁקָה|גֶּרְמָנִי|גֶּרְמַנְיָה|גֶּרְמַנְיוּם|גֶּרְמָנִית|",
"גְּרֵנָדָה|גְּרָנוֹלָה|גְּרָנוֹלִיט|גְּרָנָט|גִּרְסָא|גִּרְסָה|גִּרְסַת|גַּרְעִינוֹן|גַּרְעִינִי|גַּרְעִינִית|גְּרָף|גְּרַפָּה|גְּרָפוֹמַנְיָה|גְּרָפִי|גְּרָפִיט|גְּרֹפֶת|גָּרַר|גְּרָרָה|גֶּרֶשׂ|גִּשּׁבּוֹר|גִּשּׁוּר|גָּשׁוֹשׁ|גֶּשְׁטַלְט|גֶּשֶׁם|גַּשְׁמִיּוּת|גֻּשְׁפַּנְקָה|גֶּשֶׁר|גַּשָּׁשׁ|גַּת|גִּתִּית|דַאֲבוֹן|דָּאָה|דֶּאוֹדוֹרַנְט|דַּאַוִין|דָּאוֹן|דֹּאַר|דְּאַתְרָא|דֹּב|דֹבֶא|דֻּבְדְּבָן|דֶּבָּה|דִּבּוּג|דֵּבוֹן|דִּבּוּק|דָּבוּר|דְּבוֹרַאי|דְּבוֹרָה|דִּבּוּרִית|דְּבוֹרָנִית|דֻּבִּי|דְּבִיבוֹן|דֶּבִּיל|דְּבִיר|דְּבַּע|דֶּבֶק|דָּבְקָה|דְּבֵקוּת|דָּבָר|דִּבְרָה|דִּבְרֵי|דְּבָרִים|דְּבַשׁ|דִּבְשָׁה|דִּבְשׁוֹן|דִּבְשִׁית|דַּבֶּשֶׁת|דַּג|דַּגְדְּגָן|דִּגְדּוּג|דָּגָה|דָּגוּל|דָּגוּשׁ|דָּגִים|דֶּגֶל|דִּגְלוּל|דִּגְלוֹן|דְּגָלִים|דַּגְלָן|דֶּגֶם|דֻּגְמָה|דֻּגְמָן|דֻּגְמָנִית|דָּגָן|דִּגְנֵי|דְּגָנִית|דֵּגֵנֵרָט|דֶּגֶנֶרַצְיָה|דַּגֶּנֶת|דָּגֵשׁ|דֶּד|דֶּדוּקְצְיָה|דֶּה|דֵּהֶה|דָּהוּי|דְּהִימָה|דְּהַרְמָה|דּוּ|דּוּ\"חַ|דּוּאִית|דּוּאָלִיזְם|דּוֹבֵר|דּוֹבְרָה|דּוּגָה|דּוּגִית|דּוֹגְמָה|דוֹגֶר|דּוּגְרִי|דּוֹד|דּוּדָא|דּוֹדָה|דּוֹדָן|דָּוָה|דּוֹחֶה|דּוֹחְפָן|דַּוָּי|דָּוִית|דּוּכִיפַת|דּוּכָן|דּוּכָנִית|דּוֹלֵה|דּוֹלוֹמִיט|דּוֹלֵלָה|דּוֹלְפִין|דּוֹלְפִינַרְיוּם|דּוֹלָר|דּוּם|דּוּמִיָּה|דּוֹמִינוֹ|דּוֹמִינִיקָה|דּוֹמִינַנְטִי|דּוֹמֵם|דּוֹן|דּוֹנַג|דּוֹס|דּוֹעֶכֶת|דּוֹק|דַּוְקָא|דוּקְטוּס|דּוֹקְטוֹר|דוֹקְטוֹרָט|דּוֹקְטוֹרַנְט|דּוֹקְטְרִינָה|דּוֹקְרָן|דּוֹר|דּוּרָה|דּוֹרוֹן|דּוֹרֵס|דוֹרֵש|דּוּשׁ|דּוּשְׁבֶּג|דַּוְשָׁה|דֶזָ'ה|דָחָה|דָּחוּס|דֶּחִי|דַּחְיָנוּת|דְּחִיסָה|דְּחִיף|דְּחִיק|דְּחִיקָה|דַּחְלִיל|דֹּחַן|דַּחַף|דַּחְפּוֹר|דְּחָק|דַּחְקָה|דֶּטוֹנַצְיָה|דֶּטֶרְגֶּנְט|דֶּטֶרְמִינִיזְם|דִּי|דִּיאַגְרָמַת|דִּיאָדָה|דִּיאֵטָה|דִּיאֶטָן|דִּיאָלוֹג|דִּיאָלֶקְט|דִּיאַסְטוֹלִי|דִּיאַסְטַז|דִּיאַפְרַגְמָה|דִּיאָקְרִיטִי|דִּיאַקְרִיטִית|דִּיבֵּיט|דִּיבֵּל|דַּיִג|דִּיגִיטָלִית|דַּיָגִים|",
"דִּיגְלוֹסְיָה|דִּידְגֶ'רִידוּ|דִּידַקְטִיּוֹת|דִּידַקְטִיקָה|דַּיָּה|דִּיּוֹ|דְּיוֹדָה|דִּיוָה|דְּיוֹטָה|דִּיּוּן|דְּיוּנָה|דְּיוֹנוּן|דְּיוֹקָן|דִּיוֹקֶסְיָה|דִּיּוּר|דְּיוֹרָמָה|דְּיוֹתָא|דְּיוֹתָה|דִּיזֶל|דִּיזֶנְטֶרְיָה|דִּיכוֹטוֹמְיָה|דַּיָּל|דִילְדוֹ|דֵּילָטוֹרְיָה|דִִּילִיזַ'נְס|דִּילֶמָּה|דִּילֶר|דִּימוֹס|דִּין|דִּינְגוֹ|דִּינוֹזָאוּר|דִּינֵי|דִּינָמוֹ|דִּינָמִיט|דִּינָמִיקָה|דִּינָמִית|דְּיַנְקוּתָא|דִּינָר|דִּיסְאִינְפְלַצְיָה|דִּיסְגְּרָפְיָה|דִּיסוֹנַנְס|דִּיסְטוֹפְּיָה|דִּיסְפְּרוֹסְיוּם|דִּיסְפְּרוֹפּוֹרְצְיָה|דִּיסְפֶּרְסְיָה|דִּיסְצִיפְּלִינָה|דִּיסְק|דִּיסְקוֹ|דִּיסְקוֹטֶק|דִּיסְקֶט|דִּיסְקַלְקוּלְיָה|דִיסְקְרַבְיָה|דִּיסְקְרֶטִי|דִּיפוּזְיָה|דִּיפּוֹל|דִּיפְּלוֹמָה|דִּיפְּלוֹמָט|דִּיפְּלוֹמָטִי|דִּיפֶרֶנְצְיָאלִי|דָּיֵק|דִּיקְטָטוֹר|דִּיקְטָטוּרָה|דִּיקְטָפוֹן|דַּיְקָן|דִּיר|דִּירָה|דִּירֶקְטוֹר|דִּירֶקְטוֹרְיוֹן|דִּירַת|דַּיִשׁ|דִּישׁוֹן|דַּךְ|דַּכָּא|דִּכְדּוּךְ|דֹּכִי|דֻּכָּס|דִּכְפִין|דַּל|דַּלְגִּית|דַּלָּה|דָּלוּחַ|דֶּלוּקְס|דְּלוֹרִית|דַּלְטוֹנִיזְם|דְּלִי|דַּלְיָה|דְּלִיפָה|דֶּלִיקְטִי|דָּלִית|דְּלַעַת|דַּלְפוֹן|דֶּלְפֵּק|דָּלָק|דַּלֶּקֶת|דַּלַּקְתִּי|דֶּלֶת|דַּלְתּוֹן|דָּם|דֵּמָגוֹגְיָה|דִּמְדּוּמִים|דֻּמְדְּמָנִית|דֶּמֶה|דֶּמוֹגְרַפְיָה|דָּמוּי|דִּמּוּם|דָּמוֹקְלֶס|דֵּמוֹקְרַטְיָה|דְּמוּת|דְּמֵי|דִּמְיוֹן|דִּמְיוֹנִי|דָמִים|דֵּמִיקוּלוּ|דְּמָמָה|דִּמְמַת|דֹּמֶן|דֶּמֶנְצְיָה|דַּמְקָה|דַּמֶּשֶׂק|דָּן|דְּנָא|דִּנְגִית|דַּנְדַּנָּה|דֶּנְדְּרִיט|דְּנוּרָא|דֶּנְטָלִי|דָּנִיֵּאל|דִסְפִינְתָא|דִּסְקַת|דְּסָתְרֵי|דְּעָבִיד|דֵּעָה|דַּעַת|דַּעְתּו|דַּף|דִּפְדּוּף|דַּפְדְּפָן|דַּפְדֶּפֶת|דֶּפּוֹ|דְּפוּס|דָּפוּק|דֹּפִי|דֶּפִיבְּרִילָטוֹר|דֶּפִיבְּרִילַצְיָה|דֹּפֶן|דַּפְנָה|דַפְנִי|דָפְנָתִי|דֶּפֶק|דֵּפֶקְט|דֶּפְּרֶסְיָה|דִּפְתָּר|דֶּצִיגְרָם|דֶּצִילִיטֶר|דֶּצִימֶטֶר|דֵּצֶמְבֶּר|דֶּק|דֵּקָדָה|דִּקְדּוּקֵי|דֵּקָדֶנְטִי|דַּקָּה|דֶּקוֹלְטֶה|דַּקּוּת|",
"דְּקִירָה|דֶּקֶל|דִּקְלוּם|דֶּקָן|דֶּקֶר|דַּקַּת|דֶּר|דְּרָאג|דֵּרָאוֹן|דַּרְבּוּקָה|דֶּרְבִּי|דְּרִבִּית|דָּרְבָּן|דָּרְבָּנִית|דְּרָגוֹת|דְּרַגְנוֹעַ|דַּרְגָּשׁ|דְּרֶדְנוֹט|דַּרְדַּק|דַּרְדַּר|דֵּרוּג|דָּרוּךְ|דָּרוֹם|דְּרוֹמוֹן|דְּרוֹמִי|דְּרוֹר|דְּרִיסָה|דְּרִיקְס|דֶּרֶך|דַּרְכּוֹ|דַּרְכּוֹן|דַּרְכֵי|דְּרָכִים|דְּרָמָה|דֶּרְמָטוֹגְלִיפִיקָה|דֶּרְמָטוֹלוֹגְיָה|דְּרָמָטוּרְגִּיָּה|דֶּרֶן|דְּרַסְטִי|דְּרֵעק|דְּרָקוֹן|דְּרָקוֹנִי|דְּרָרָה|דְּרָשׁ|דְרִתְחָא|דַּשׁ|דֶּשֶׁא|דֶּשֶׁן|דַּת|דָּתִי|הֵא|הָאָבִיב|הָאֲבָנִים|הַאֲבָסָה|הַאֲבָקָה|הֵאָבְקוּת|הָאָדָם|הָאַדְמִירָלִיוּת|הָאוֹצָר|הַאוֹקְיָנוֹס|הָאוּרִים|הַאֶזְרָחוּת|הֶאָח|הָאַחְרָה|הָאִינְפוֹרְמַצְיָה|הֵאִיר|הַאִם|הַאֲמָנָה|הָאֱמֶת|הָאֱנוֹשִׁי|הַאֳנִיָּה|הָאֲנָךְ|הַאֲנָשָׁה|הָאֲסִימוֹן|הָאַף|הָאֹפֶל|הַאֲפָלָה|הַאִצְטְרֻבָּל|הֶאָרָה|הָאֲרוֹן|הַאֵרוּעַ|הָאֲרִי|הָאָרֶץ|הַאֲרָצָה|הַאֲרָקָה|הַבָּא|הַבָּב|הַבַּד|הֶבְדֵּל|הַבְדָּלָה|הָבָה|הִבְהוּב|הַבְהָרָה|הַבֶּהָרוֹת|הַבִּטּוּי|הַבְטָחָה|הַבִּטָּחוֹן|הֵבִיא|הַבִּיטָט|הֵבִין|הַבַּיִת|הַבַּיְתָה|הַבִּכּוּרִים|הַבָּכִיר|הַבֻּכְנָה|הֶבֶל|הֲבָלִים|הַבֵּן|הֲבָנָה|הַבְנָיָה|הַבָּעָה|הַבְעָרָה|הַבֹּקֶר|הֲבָרָה|הַבְרָזָה|הַבְרָחָה|הַבְּרִיטִי|הַבְּרִית|הַבַּת|הַבְּתוּלִים|הַגֵּאוּת|הַגַּאי|הֲגָאִים|הֲגָבָה|הַגָּבוֹהַּ|הַגְּבוֹהִים|הַגְּבוּל|הַגְבָּרָה|הַגָּדָה|הַגָדוֹל|הַגְּדִי|הִגְדִיל|הַגָּדֵר|הַגְדָּרָה|הֶגֶה|הַגּוֹלָה|הַגּוֹמֵל|הָגוּן|הַגּוּף|הַגּוֹרָל|הָגִיג|הִגָּיוֹן|הֶגְיוֹנִי|הִגְיֶנָה|הֲגִירָה|הַגְּלִי|הֲגַם|הֶגְמוֹן|הֶגְמוֹנוּת|הֶגְמוֹנְיָה|הַגָּמָל|הַגַּמְלָה|הֲגָנָה|הַגַּף|הָגָר|הַגְּרֶגוֹרְיָאנִי|הַגְרִי|הַגְרָלָה|הַגֶשֶׁר|הֵד|הֶדְבֵּק|הִדָּבְקוּת|הַדָּבָר|הַדְבָּרָה|הַדִּבְּרוֹת|הַדָּג|הַדֶּגֶל|הֲדָדִי|הׂדּוּ|הַדּוֹד|הֲדוֹם|הֶדוֹנִיזְם|הֶדוֹנִיסְט|הִדּוּק|הָדוּר|הֶדְחֵק|הַדְחָקָה|הֶדְיוֹט|הַדִּין|הַדַּיְסָה|הֲדִיפַת|הַדְלָיָה|הַדְלָפָה|הַדָּם|הִדַּמּוּת|הַדְמָיָה|הֲדַס|",
"הַדַּעַת|הֶדֶף|הֶדֶק|הָדָר|הֲדָרָה|הַדְרוֹמִי|הַדֶּרֶךְ|הַדְרָכָה|הֲדָתָה|הַהַגַּאי|הַהֶגֶה|הַהׂדִּי|הָהוֹבָלָה|הַהוֹן|הַהַכָּרָה|הַהַלֵּל|הַהִפּוּךְ|הַהֶפְקֵר|הַהִתְבַּגְּרוּת|הוּא|הוֹבָאָה|הוֹבִיל|הוֹגֵן|הוֹד|הוֹדָאָה|הוֹדוּ|הֹוָה|הוֹוֶה|הוּטַל|הוֹי|הֲוָיָה|הוֹכָחָה|הִוָּלְדוֹ|הוֹלוֹקֵן|הוֹלֵךְ|הוֹלְמְיוּם|הוֹלַנְד|הוֹלַנְדִּית|הוֹמֵאוֹסְטָסִיס|הוֹמוֹ|הוֹמוֹגֶנִית|הוֹמוֹגְרָף|הוֹמוֹזִיגוֹט|הוֹמוֹלוֹגִי|הוֹמוֹנִימְיָה|הוֹמוֹנְקוּלוּס|הוֹמוֹפוֹבּ|הוֹמוֹפוֹבְּיָה|הוֹמוֹפוֹן|הוֹמוֹפוֹנִי|הוּמוֹר|הוּמוֹרִיסְטִי|הוּמוֹרִיסְטָן|הוֹמִינֶם|הוֹמֵם|הוּמָנִיזְם|הוֹן|הוֹנָאָה|הוּנְגַּרְיָה|הוּנְגָּרִית|הוּנְדּוּרָס|הוֹסְטֶל|הוֹפָעוֹת|הוֹצָאָה|הוֹצָאַת|הוֹצִיא|הוֹקוּס|הוֹקִי|הוֹרָאָה|הוֹרָדָה|הוֹרָה|הוֹרוֹסְקוֹפּ|הוֹרוּת|הוֹרִיד|הוּרִיקָן|הוֹרְמוֹן|הוֹרְסְט|הוֹרָשָׁה|הוֹשֵׁעַ|הִזְדַּהוּת|הִזְדַּמְּנוּת|הִזְדַּקְּרוּת|הַזֶּה|הַזָּהָב|הִזּוּן|הַזּוֹרְמִים|הֲזָחָה|הֲזָיָה|הַזֵּיתִים|הַזְּמַן|הַזָּנָב|הֲזָנָה|הַזְנָחָה|הַזָּעָה|הַזָּרִים|הַזֶּרַע|הַזְרָקַת|הַחֶבְרָה|הָחֶדֶר|הֶחָדָשׁ|הַחֲדָשָׁה|הַחוֹל|הַחוֹפִים|הֶחָזֶה|הַחַי|הַחְיָאָה|הַחַיּוֹת|הַחַיִּים|הַחֲכָמִים|הֶחָלָב|הַחַלּוֹנוֹת|הַחְלָטָה|הֶחְלֵטִיּוּת|הֶחָלָל|הַחְלָקָה|הַחַמָּה|הַחֲמָמָה|הַחְמָצָה|הַחֹמֶר|הַחִנּוּךְ|הַחִסּוּן|הַחֲסִי|הֶחְסֵן|הֶחָפָה|הַחִפָּזוֹן|הַחְפָּצָה|הַחֹפֶשׁ|הַחָפְשִׁית|הַחַרְטוֹם|הַחְשָׁכָה|הַחְתָּמָה|הִטְבִּיעַ|הַטְבָּעָה|הַטַּבַּעַת|הַטּוֹבָה|הַטּוּחָה|הַטּוֹן|הַטָּיָה|הֵטִיל|הֵטֵל|הֲטָלָה|הַטְמָעָה|הֶטְרוֹגֶנִית|הֶטְרוֹזִיגוֹט|הֶטֶרוֹטְרוֹף|הֶטְרוֹסֶקְסוּאָל|הֶטְרוֹסֶקְסוּאָלִיּוּת|הַטְרָמָה|הַי|הִיא|הִיבִּיסְקוּס|הִיבְּרִיס|הִיגְרוֹמֶטֶר|הַיָּד|הַיָּדַיִם|הִידְרָאוּלִית|הִידְרוֹגֶנַצְיָה|הִידְרוֹדִינָמִיקָה|הִידְרוֹזִין|הִידְרוֹטֶכְנִיקָה|הִידְרוֹלוֹגְיָה|הִידְרוֹלִי|הִידְרוֹסְטָטִיקָה|הִידְרוֹסְפֶרָה|הִידְרוֹפוֹבִּי|הִידְרוֹפוֹבְּיה|הִידְרוֹפּוֹנִיקָה|הִידְרוֹפוֹר|הִידְרוֹפִילִי|הִידְרוֹקְסִיל|",
"הִידְרַנְט|הֱיֵה|הַיַּהֲלוֹם|הַיּוֹם|הַיּוֹצֵר|הֵיטִיב|הַיַּיִן|הֵיכָא|הֵיכָן|הַיְלָדִים|הֵילָךְ|הֵילֵל|הַיַּם|הַיַּמָּאִים|הַיַּמִּי|הַיַמִִּיָּה|הַיָּמִים|הִין|הַיְנוּ|הִינוּמָה|הִיסְטוֹגְרָמָה|הִיסְטוֹרִי|הִיסְטוֹרְיָה|הִיסְטוֹרְיוֹגְרָף|הִיסְטוֹרְיוֹגְרַפְיָה|הִיסְטוֹרְיוֹן|הִיסְטָמִין|הִיסְטֶרְיָה|הִיסְפָּנִי|הַיַּעַד|הִיפּוֹגְלִיקֶמְיָה|הִיפּוֹדְרוֹם|הִיפּוֹכוֹנְדֶּר|הִיפּוֹכוֹנְדְּרִיָּה|הִיפּוֹפּוֹטָם|הִיפּוֹקַמְפּוֹס|הִיפּוֹתֶטִי|הִיפְּנוֹזָה|הִיפְּנוֹטִיזְם|הִיפְּנוֹתֶּרַפְּיָה|הִיפֶּר|הִיפֶּרְאַקוּזִיס|הִיפֶּרְבּוֹלִית|הִיפֶּרְגְלִיקֶמְיָה|הַיְּצָרִים|הִיקִי|הַיַרְדָּה|הִירוֹגְלִיפִים|הַיַּרְכָתַיִם|הַיָּרֹק|הִירַרְכְיָה|הַיָּשָׁן|הַיְּשָׁנָה|הַיְשֵׁר|הַכָּבוֹד|הִכְבִּיד|הִכָּה|הַכְחָדָה|הֲכִי|הַכִּיס|הַכֶּלֶב|הֲכָלָה|הַכִּלְיָה|הַכֵּלִים|הַכְלָלָה|הִכָּלְלוּת|הַכְּלָלִי|הֲכָנָה|הַכַּנָּן|הַכְנָסָה|הַכִּסְאוֹת|הַכֶּסֶף|הַכִּפּוּרִים|הַכְּפָפָה|הֶכֵּר|הַכָּרָה|הַכְרָזָה|הֶכְרֵחַ|הַכְרָחָה|הַכֹּתֶל|הֵל|הֲלֹא|הָלְאָה|הַלְאָמָה|הַלֵּב|הַלְּבָנָה|הַלְבָּנַת|הֻלֶּדֶת|הַלָּה|הַלְוָאָה|הַלְוָאַת|הָלוֹבִּיוֹס|הַלּוֹג|הָלוֹגֶן|הַלּוּחַ|הָלוֹךְ|הִלּוּכִים|הֲלוֹם|הָלוּצִינַציָה|הַלּוֹרְד|הַלַּזְבֶּזֶת|הַלֶחֶם|הַלְחָמָה|הַלְחָנָה|הֶלְיוֹגְרָף|הֶלְיוּם|הֲלִיךְ|הֲלִיכוֹן|הֲלִיכוֹת|הֵלִיקוֹן|הֶלִיקוֹפְּטֶר|הֶלִיקוֹפְּטֵרִים|הֵלֶךְ|הֲלָכָה|הִלְכָּךְ|הֻלָּל|הַלְלוּיָהּ|הֶלֶם|הַלִּמּוּדִים|הַלְמָן|הֲלָנָה|הֶלֶנִי|הֶלֶנִיזְם|הֲלָנַת|הַלָּשׁוֹן|הֵם|הַמָּאוֹר|הַמַּאֲמִין|הַמְבּוּרְגֶּר|הַמְבּוּרְגֶּרִיָּה|הַמָּגֵן|הַמַּגָּף|הַמִדְבָּר|הַמְּדִינוֹת|הֵמָּה|הַמְּהַדְּרִין|הֶמוֹגְלוֹבִּין|הַמוֹחַ|הַמּוֹלָד|הָמוֹן|הֲמוֹנִים|הֲמוֹנִית|הִמּוּר|הִמּוּרִים|הַמָּוֶת|הַמָזוֹן|הַמַּזָּל|הַמַּזְלֵג|הַמַּזָּלוֹת|הַמִּזְרָח|הַמִזְרָחִית|הַמְחָאָה|הַמְחָזָה|הַמַּחֲזִיק|הַמִטָּה|הֶמָטוֹמָה|הַמִּטְעָן|הֶמְיָה|הַמַּיִם|הַמִּין|הַמִּינִים|הָמֵיתָרִים|הַמַּכַּבִּים|הַמִּכְנָס|הֲמֻלָּה|הַמֶּלַח|",
"הַמַלָּחִים|הַמִלְחַמְתִּי|הַמַלְכוּתִי|הַמְּלָכִים|הַמִלְקֶה|הָמָן|הַמִּנְהָרָה|הִמְנוֹן|הֶמֶס|הַמִסְחָר|הַמִסְחָרִי|הַמַּסְטִיק|הַמָּסָךְ|הַמִסְפָּר|הַמִּסְפָּרִים|הַמַּעְגָּל|הַמַּעֲטֶה|הַמַּעֲרָבִי|הַמַעֲרָבִית|הַמַּפָּץ|הַמַּפְרֶקֶת|הַמִפְרָשׂ|הַמִפְרָשִׂים|הַמַּצּוֹת|הַמְּצִיאָה|הַמְּצִיאוּת|הַמְּצָרִים|הַמִּקְדָּשׁ|הַמָּקוֹם|הַמִּקְרָא|הַמְרָאָה|הַמְרֻבֶּה|הַמְּרֻבָּעִים|הֲמָרָה|הַמֶרְחָבִים|הַמֶּרְכָּזִית|הַמַּשְׁוֶה|הַמִּשְׂחָקִים|הַמִּשְׁכָּן|הַמִּשְׁפָּט|הַמֵּתִים|הַמָתְנַיִם|הֲמָתַת|הֲנָאָה|הֶנְגְּאוֹבֶר|הַנְגָּנָה|הֶנְדִיקֶפ|הַנְדָּסָה|הַנְדָּסִית|הַנְדָּסַת|הֵנָּה|הַנְהָלַת|הַנּוֹרָאִים|הַנָּזִיר|הֲנָחַת|הֶנְטָאִי|הַנֶּפֶשׁ|הַנְפָּשָׁה|הָנֵץ|הַנִּצָּבִים|הֲנָקָה|הַנָּשׁ|הַנָּשִׁים|הַנְּשִׁימָה|הַס|הַסְּאָה|הַסְּבִיבָה|הֶסְבֵּר|הַסְגַּבְרָה|הַסָּגֹל|הַסֵּדֶר|הַסְוָאָה|הַסוֹחֵר|הַסּוּסִים|הַסַּחַר|הֶסֵּט|הִסִּיג|הֵסִיר|הֶסְכֵּם|הַסְכָּמָה|הַסְלָמָה|הַסְמָקָה|הִסַּסְתָּ|הַסְּעִפִּים|הַסְּפָּגֶטִי|הַסִפּוּן|הַסִּפִּים|הַסְפִינָה|הַסְפִינוֹת|הַסְּפִירָה|הַסַפָּנִים|הֶסְפֵּק|הַסֵּפֶר|הַסְּפָרִים|הֶסֵּק|הַסְקִילָה|הַסְּקַרְיָה|הַסַּקְרָנוּת|הַסָּקַת|הָסֵר|הַסַּרְטָן|הִסְתַּבְּרוּת|הִסְתַּדְּרוּת|הֲסָתָה|הִסְתַּנְּנוּת|הָעֲבוֹתוֹת|הָעִבְרִי|הָעֲגָלָה|הָעֹגֶן|הַעֲדָפָה|הָעוֹלָם|הַעַיִן|הָעִכּוּל|הַעֲלָאָה|הֶעֱלָה|הָעֶלְיוֹן|הֶעֱמִיד|הָעַמִּים|הָעֹמֶר|הֵעָנוּת|הָעֹנִי|הַעְפָּלָה|הָעֵצִים|הָעַצְמָאוּת|הַעֲרָכַת|הַעֲרָצָה|הֶעָרַת|הָעֲשִׂירִי|הֶעֱתֵק|הַעְתָּקָה|הַפְגָּנָה|הֲפוּגָה|הָפוּךְ|הָפוּכָה|הֶפְּטָגוֹן|הַפַּטִּישׁ|הַפְטָרָה|הֲפִיחָה|הָפִיךְ|הֲפִיכָה|הַפִּיל|הֶפֶךְ|הָפְכִּי|הֲפַכְפַּךְ|הַפְלֵא|הַפְלָגָה|הַפְלָגַת|הַפְנְיוּם|הַפָּנִים|הֶפֶּנִינְג|הַפְנָמָה|הֶפְסֵד|הֶפְסֵדוֹ|הֶפְסֵק|הַפְסָקָה|הַפְסָקַת|הַפָּעִיל|הֻפְעַל|הַפְעָלָה|הַפְקָדָה|הַפְּקֻדּוֹת|הַפִּקוּד|הֶפְקֵר|הַפְרֵד|הַפְרָטָה|הַפְרָעָה|הַפְרָעַת|הֶפְרֵשׁ|הַפְרָשָׁה|הַפְשָׁטָה|הַפָּתוּחַ|הַפְתָּעָה|",
"הַצָּבָא|הַצְּבִי|הַצָּגָה|הַצְדָּעָה|הַצַּוָּאר|הַצּוֹפֶה|הַצּוֹפִים|הִצְטַיְּנוּת|הִצְטַנְּנוּת|הַצִי|הַצִיר|הַצְּלָב|הַצָּלָה|הַצְלָחָה|הֲצָפָה|הַצָּפוֹן|הַצְפוֹנִי|הַצְפוֹנִית|הַצְפָּנָה|הַצְרָחָה|הַצָּתָה|הֲקָאָה|הַקְבָּלָה|הַקְבָּצָה|הַקְּדוֹשִׁים|הַקַּדִּישׁ|הַקַּדְמָה|הַקָדְקוֹד|הַקַּו|הַקוֹל|הַקּוֹלָר|הַקֹּטֶב|הַקֶּטֶל|הַקָטָן|הַקְטָנָה|הַקְּטַנּוֹת|הַקִיטוֹר|הַקְלָדָה|הֲקַלָּה|הַקְּלָפִים|הַקָּנֶה|הֶקְסָגוֹן|הֶקֵּף|הַקְפָּדָה|הַקֶּפְּטֵן|הֶקֵּפִי|הַקָצִין|הַקְּצִינִים|הַקָּצִיר|הָקֶרַח|הַקְּרִיאָה|הַקַּרְקַע|הַקַּשׁ|הַקְשָׁאָה|הַקְשָׁבָה|הַר|הָרֹאשׁ|הָרֹאשָׁה|הַרִאשׁוֹן|הַרֵאָתִי|הַרְבֵּה|הִרְבִּיץ|הֶרְבָּלִיזְם|הֶרֶג|הֲרֵגָה|הָרֶגֶל|הַרְדּוּף|הָרֶה|הִרְהוּר|הָרוּחַ|הָרוּחוֹת|הָרוֹקְחִים|הַרְטָבָה|הַרְטָבַת|הֲרֵי|הֲרִיגָה|הֵרָיוֹן|הָרִים|הֶרְכֵּב|הָרַכֶּבֶת|הִרְכִּין|הָרֵם|הַרְמוֹן|הַרְמוֹנְיָה|הֶרְמֵז|הֶרְמֶנוֹיְטִיקָה|הֶרְמָפְרוֹדִיט|הֲרָמַת|הֶרֶס|הָרַע|הַרְעָלַת|הַרְעָשָׁה|הַרְפַּתְקָה|הַרְפַּתְקָן|הֶרְץ|הֶרְצֶל|הֶרְצְלִיָּה|הָרִצְפָּה|הֻרְקָנוֹס|הַרְשָׁאָה|הַרְשָמָה|הֶרֶת|הַשָּׁאָה|הַשְׁאָלָה|הַשָּׁבוּעַ|הַשְׁבָּרָה|הַשְׁבָּתָה|הֶשֵּׂג|הַשָּׂגָה|הַשִּׁדְרָה|הַשְׁוָאָה|הַשִּׁוְיוֹן|הַשּׁוּם|הַשּׁוּרָה|הַשְׁחָזָה|הַשְׁחָלָה|הַשַּׁחַר|הַשַׁיִט|הַשַּׁיָּטִים|הַשִּׁיטִין|הַשִּׁירִים|הַשְׁכָּבָה|הַשְׂכֵּל|הַשְׁכֵּם|הַשָּׁלוֹם|הִשְׁלִיךְ|הַשְׁלָכָה|הַשְׁלָמָה|הַשְּׁלֵמִים|הַשֵּׁם|הַשְׁמָדָה|הַשָּׁמַיִם|הַשְׁמָעָה|הַשְׁמָצָה|הַשֶּׁמֶשׁ|הַשְּׁמָשׁוֹת|הַשֶּׁנְהָב|הַשְׁעָרָה|הַשָּׂפָה|הַשֶׁפֶל|הַשְׁפָּלָה|הַשְׁפָּעָה|הַשָּׁקָה|הַשָׁקֵט|הַשֶּׁקֶל|הַשְׁקָעָה|הַשְׁקָעוֹת|הַשְׁרָאָה|הַשֵׁרוּת|הַשַּׁרְשֶׁרֶת|הַשְּׁתִיָּה|הִשְׁתִּין|הִשְׁתַּלְּטוּת|הִשְׁתַּלְּמוּת|הִשְׁתַּמְּטוּת|הַשֶּׁתֶן|הַשְׁתָּנָה|הִשְׁתְּפַנְפְנוּת|הִתְאַבְּדוּת|הִתְאַבְּכוּת|הַתְאָמָה|הִתְבַּגְּרוּת|הִתְבּוֹלְלוּת|הִתְבַּטְּלוּת|הִתְדַּיְּנוּת|הִתְהַפֵּך|הַתְוָיָה|הִתּוּךְ|הַתּוֹרָה|הַתוֹתְחָן|",
"הַתּוֹתְחָנִים|הִתְחַזּוּת|הַתְחָלָה|הִתְחַמְּמוּת|הַתַּחֲנָה|הִתְחַפְּשׂוּת|הִתְחַשְׁמְלוּת|הַתַּחְתּוֹנָה|הַתַחְתִּית|הִתְיַבְּשׁוּת|הַתִּיכוֹן|הַתִּימוּס|הִתְכַּדְּדוּת|הַתָּכָה|הִתְכְּלַבְלְבוּת|הִתְכַּרְבְּלוּת|הִתְכַּרְכְּמוֹת|הִתְלַהֲבוּת|הַתְּלוּיִּם|הֶתְמֵד|הִתְמוֹטְטוּת|הִתְמַכְּרוּת|הִתְמָרְדוּת|הִתְנַגְּשׁוּת|הִתְנַדְּבוּת|הִתְנָה|הִתְנַהֵג|הִתְנַהֲגוּת|הִתְנַזְּרוּת|הַתְנָיָה|הִתְנַסּוּת|הִתְנַצְּלוּת|הִתְנַקְּשׁוּת|הִתְנַשְּׂאוּת|הִתְעַבּוּת|הִתְעַלְּלוּת|הִתְעַלְּסוּת|הִתְפַּכְּחוּת|הִתְפַּלְּאוּת|הִתְפַּלְּגוּת|הַתְפָּלָה|הִתְפַּלְפֵּלוּת|הִתְּפַּעֲמוּת|הִתְפַּקְּדוּת|הִתְפַּקְּחוּת|הִתְפָּרֵץ|הֶתְקֵן|הֶתְקֵף|הַתְקָפָה|הִתְקַרְנְפוּת|הִתְקַשְּׁרוּת|הַתְרָאָה|הִתְרַגְּלוּת|הַתַּרְדֵּמָה|הַתָּרָה|הַתְּרִיס|הִתְרַכְּבוּת|הַתֹרֶן|הַתָּשָׁה|הַתְשׁוּבָה|וָאט|וְאִטְלוּלָא|וְאִידָךְ|וְאֵין|וְאֶל|וּאַלָּה|וָאֵם|וָאן|וָאֵפֶר|וָבֹהוּ|וּבֵיהּ|וּבְכֵן|וּבַל|וּבִמְחוֹלוֹת|וּבִקּוּשׁ|וֶבֶּר|וּבָרִאשׁוֹנָה|וּבָרַח|וָגִינִיזְמוּס|וְגָר|וְגֶרֶז|וַדַּאי|וּדְבַשׁ|וֵדְג'|וִדּוּא|וָדִי|וָהֵב|וְהוֹתֵר|וָו|ווּגָ'רַס|ווֹדְבִיל|ווּדוּ|ווֹדְקָה|וֹוז|וֹוט|ווּלְגָרִי|ווֹלְט|ווֹלְטָאג'|ווֹלְטָמֶטֶר|ווּלְקָן|ווּלְקָנוֹלוֹגְיָה|ווּלְקָנִי|ווּלְקָנִיזְם|ווּלְקָנִית|ווֹק|ווֹרְט|וָזֵלִין|וְחָלָב|וְחִלוּץ|וְחָלָק|וַחֲצִי|וְחָשְׁדֵהוּ|וֶטֶרִינָר|וִי|וִיָאדוּקְט|וִיאֵזָ'ה|וִיבְּרָטוֹ|וִיבְּרָטוֹר|וִידֵאוֹ|וידְגֶ'ט|וִיווֹ|וְיוֹלָה|וִיוֶנְדִי|וִיזָה|וִיזוּאָלִי|וִיטָלִיזְם|וִיטָמִין|וִיֶּטְנָמִי|וִיטְרוֹ|וִיטְרָז'|וִילָה|וִילוֹן|וִילוֹנִית|וְיָמִין|וִינְיֶטָה|וִיסְקִי|וִיפָּסָנָה|וִיקְטִימוֹלוֹגְיָה|וִיקִי|וִיקִימֶדְיָה|וִיקִימִלּוֹן|וִיקִינְגּ|וִיקִיפֶּדְיָה|וַיִּקְרָא|וִירְגָּה|וִירוֹלוֹגְיָה|וִירוּס|וִירְטוּאוֹז|וִירְטוּאָלִי|וִירְטוּאָלִית|וִירָלִי|וְיֵשׁ|וּכְאֶפֶס|וּכְבַד|וִכּוּחַ|וְכִסָּה|וְלֹא|וָלָד|וַלְדָּנִית|וְלֵית|וָלֵךְ|וְלָנוּחַ|וַלְס|וּלְעֵלָּא|וְלִשְׁנִינָה|וְמִגְרַעַת|וּמוֹרֶה|",
"וּמוֹרִי|וּמָוֶת|וּמִכָּאן|וָמַעְלָה|וּמְפַקֵּד|וּמַשָּׂא|וּמְשֹׁל|וָנַדְיוּם|וְנֶהִי|וְנְחָשִׁים|וַנְטָה|וֶנְטִילָטוֹר|וָנִיל|וֵנֵצוּאֵלָה|וְנָקִי|וְנִשְׁמָע|וַסַבִּי|וֵסְט|וַסָּל|וֶסֶת|וְעַד|וְעֹזֵב|וַעֲמוֹרָה|וָעֵרֶב|וּפוֹחֲזִים|וָפֶל|וָפֶלֶא|וּפְסִיק|וְצִלְצוּלִים|וְקוֹץ|וֶקְטוֹר|וְקַיָּם|וָקֶשֶׁת|וְרַבּוֹתַּי|וְרִבְעוֹ|וֶרֶד|וְרָדִים|וּרְחִימוּ|וֶרְטִיקָלִי|וַרְיַאצְיָה|וְרִיד|וְרִידִי|וָרִיקוֹצֶלָה|וֶרַנְדָּה|וַרְנִישׁ|וַרְנִית|וֶרְסָטִילִי|וּרְעוּת|וָרֶתַח|וָשֶׁבֶר|וָשוּב|וֵשֶׁט|וְשָׁלוֹם|וְשַׁעֲשׁוּעִים|וָשֵׁפֶל|וַשְׁתִּי|וָתִיק|וְתֻּמִּים|וְתָמָר|וֶתֶק|וַתְרָן|וַתְרָנוּת|וְתִשְׁכַּח|זִ'יטוֹן|זָ'נֶרוֹלוֹגְיָה|זָ'קֵט|זָ'רְגוֹן|זְאֵב|זְאֵבִים|זַאֲטוּט|זֹאת|זֹאתִּי|זָב|זֶבֶד|זְבוּב|זִבּוּרִית|זֶבַח|זֶבֶל|זְבֻלוּן|זַבְּלָן|זַבָּן|זֶבְּרָה|זָבַת|זַג|זַגָּג|זִגּוּג|זֵד|זָדָה|זָדוֹן|זְדוֹנִי|זֹה|זָהֹב|זְהַבְהַב|זְהֻבִּים|זַהֲבָן|זֶהוּ|זִהוּי|זִהוּם|זְהוֹרִית|זֶהוּת|זְהִירָה|זֹהַר|זַהֲרוּר|זוֹ|זוֹאוֹלוֹג|זוֹאוֹפִיט|זוֹאוֹפִילְיָה|זוּבּוּר|זוֹג|זוּגָה|זוּגִי|זוּגִיָּה|זוּגִית|זוּגָן|זוֹדְיָאק|זִוּוּד|זוֹט|זוּטָא|זוֹטוֹ|זוּטָר|זְוִיג|זְוִיגִית|זָוִית|זוֹל|זוֹלָה|זוּלָת|זוּלָתָנוּת|זוּם|זוֹמְבִּי|זוֹנָה|זְוָעָה|זוֹרֵם|זָחוּחַ|זָחוֹן|זְחִיָה|זָחִיחַ|זְחִיחָה|זְחִיחוּת|זְחִיל|זַחַל|זַחֲלָן|זַטֶּרֶת|זִיבָה|זִיגוֹטָה|זִיו|זִיחַ|זִיל|זַיִן|זִיף|זַיְפָן|זִיר|זִירָה|זִירְקוֹן|זִירְקוֹנְיוּם|זִירַת|זַיִת|זַךְ|זַכַּאי|זָכָה|זִכּוּי|זְכוּכִית|זָכוּר|זְכוּת|זְכֻיּוֹת|זַכְיָנוּת|זֵכֶר|זִכְרוֹ|זִכָּרוֹן|זַכְרוּת|זִכְרִי|זְכַרְיָה|זַלְדְּקָן|זַלְזַל|זַלְלָנוּת|זְלֹלֶת|זַלְעָפָה|זִמָּה|זִמּוּנִית|זְמוֹרָה|זַמְזַם|זָמִיר|זְמָם|זְמַן|זְמַנִּים|זְמַנִּית|זֶמֶר|זִמְרָה|זַמְרִיר|זָמְשׁ|זַן|זָנָב|זַנְגְּבִיל|זְנוּבָה|זְנוּת|זֶנִית|זֶנֶק|זֵעָה|זַעַם|זַעַף|זָעַק|זַעְתָּר|זֶפִיר|זֶפֶק|זֶפֶת|זֵץ|זֵק|זִקָּה|זְקוּנִים|זָקוּף|זָקוּק|זִקִּית|זָקֵן|זִקְנָה|זָקֵף|זִקְפָּה|זָר|זָרָא|זַרְבּוּבִית|זֶרֶד|",
"זָרָה|זָרוּעַ|זָרָז|זַרְזִיף|זַרְזִיר|זַרְחָן|זַרְחָתִי|זָרִיז|זְרִיחָה|זָרִים|זְרִימָה|זְרִימַת|זְרִיקָה|זֶרֶם|זַרְנוּק|זֶרַע|זָרַק|זַרְקָא|זַרְקָן|זֶרֶת|חָאג'|חַאפֶּר|חִבָּה|חֲבוּטָה|חִבּוּץ|חִבּוּק|חִבּוּר|חַבּוּרָה|חֲבָטוֹת|חָבִיב|חֶבְיוֹן|חָבִיוֹת|חֲבִילָה|חֲבִיצָה|חֲבִישָׁה|חָבִית|חֲבִיתָה|חֲבִיתִית|חֵבֶל|חַבְלַאי|חַבָּלָה|חֲבָלִים|חַבְּלָן|חַבְּלָנִית|חַבְלָר|חַבְלָרִיָּה|חֲבַצֶּלֶת|חֶבֶק|חֲבֵר|חֲבַרְבָּר|חֲבֵרָה|חֲבֵרוֹ|חֶבְרוֹן|חַבְרוּר|חֲבֵרוּת|חַבְרוּתָא|חַבְרוּתִי|חֲבֵרִים|חֶבְרַת|חֶבְרָתִי|חֶבְרָתִית|חָבַשׁ|חַבְתָן|חַג|חָגָב|חֲגוֹר|חֲגוֹרָה|חֲגוֹרָת|חַגַּי|חֲגִיגָה|חָגְלָה|חִגֵּר|חֹד|חַדָּה|חֶדְוָה|חָדֵל|חֵדֶק|חִדֶּקֶל|חֲדַר|חַדְרוֹן|חֹדֶשׁ|חֲדָשָׁה|חֲדָשׁוֹת|חַדְשִׁיר|חַדְשָׁן|חַדְשָׁנוּת|חָה|חוֹב|חוֹבָב|חוֹבְבִים|חוֹבְבָנוּת|חוֹבְבָנִי|חוֹבָה|חוּבֵּיזָה|חוֹבֵל|חוֹבְלִים|חוֹבֶרֶת|חוֹבֵשׁ|חוּג|חוּגָה|חוֹגֵר|חוֹגֶרֶת|חוֹדְרָנִית|חִוָּה|חוֹזֶה|חוֹזֵר|חוֹזֶרֶת|חוֹחִית|חוּט|חוֹטֵא|חוֹטֵב|חוּטֵי|חוּטִינִי|חוֹטֶם|חִוְיַאי|חֲוִילָה|חוּכָא|חוֹל|חוֹלָה|חוּלִיגָנִיּוּת|חוֹלִים|חוֹלִית|חוֹלָם|חוֹלֵץ|חוֹלֶצֶת|חוּם|חוֹמָה|חוּמוּס|חוּמִית|חוֹמש|חוֹמַת|חוֹף|חוֹפָאוּת|חוֹפָה|חוֹפִים|חוֹפִית|חוּץ|חוֹצֵה|חוּצוֹת|חוּצָן|חֲוַק|חַוְקֵי|חוֹקֵר|חוֹר|חוֹרֵג|חוֹרוֹן|חוֹרְפָּן|חוֹרֵשׁ|חוּשׁ|חוֹשֵׁב|חוּשִׁי|חוּשָׁנִי|חוֹשֶׁק|חוֹתֵךְ|חוֹתֶלֶת|חוֹתָם|חוֹתֶמֶת|חוֹתֵן|חותֶנֶת|חוֹתֵר|חַזַּאי|חָזֶה|חָזוֹן|חָזוּתִי|חֲזָזִית|חֲזִיז|חֲזִיר|חֲזִירִי|חֲזִית|חַזָּן|חַזָּנוּת|חָזָק|חֲזָקָה|חֲזָרָה|חֲזַרְזִיר|חֲזַרְזַר|חֲזֶרֶת|חָח|חָט|חֵטְא|חַטָּאת|חַטָּב|חִטָּה|חֲטוֹטֶרֶת|חִטּוּי|חֲטָט|חֲטִיבָה|חֲטִיבַת|חֲטִיף|חֹטֶם|חָטְמִית|חֲטַף|חֹטֶר|חַי|חַיָּב|חִידָה|חִידוֹן|חִידוֹנַאי|חַיְדַּק|חַיְדַּקִּים|חַיָּה|חִיּוּב|חִיּוּבִים|חִיּוּג|חִיּוּךְ|חִיּוּנִי|חַיּוֹת|חַיְזָר|חַיָּט|חַיָּטוּת|חַיֵּי|חַיִּים|חֵיל|חֲיָלִים|חִינָה|חֵיפָה|חִיצוֹן|חִיצוֹנִי|חִיצוֹנִים|חִיצוֹנִית|חֵיק|חַיְשָׁן|חַיַּת|חֵךְ|חַכָּה|",
"חִכּוּךְ|חֲכִירָה|חֲכִירוּת|חֲכָךְ|חַכְלִילִי|חָכָם|חָכְמָה|חָכְמוֹלוֹג|חֲכָמִים|חֹל|חֶלְאָה|חָלָב|חִלְבָּה|חֶלְבּוֹן|חֲלָבִי|חֲלַבְלוּב|חֶלֶד|חֻלְדָּה|חַלָּה|חַלְוָה|חָלוּט|חִלּוּל|חֲלוֹם|חֲלוֹמוֹת|חַלּוֹן|חִלּוֹנִי|חִלּוֹנִיּוּת|חַלּוֹנִית|חִלּוּף|חֲלוּפִי|חִלּוּפִין|חָלוּץ|חָלוּק|חִלָּזוֹן|חַלְחָלָה|חֲלִי|חֻלְיָה|חֲלִיטָה|חֲלִיל|חָלִילָה|חֲלִילִים|חֲלִילִית|חֲלִילָן|חֻלִּין|חֲלִיפָה|חֲלִיפוֹת|חֲלִיפִין|חֲלִיפַת|חָלִיץ|חֳלִיצָה|חֳלִירָע|חֻלְיַת|חֻלְיְתָן|חֵלְכָה|חָלָל|חֲלָלִית|חֶלְמָאִי|חֶלְמוֹן|חַלָּמוּת|חַלָּמִישׁ|חֶלְמִית|חֵלֶף|חַלְפָן|חֶלֶץ|חֻלְצָה|חֲלָצַיִם|חַלֶּצֶת|חָלָק|חֲלֻקָּה|חֶלְקִיקִים|חֶלְקִית|חֲלַקְלַק|חֶלְקַת|חֲלָשׁ|חֲלַשְׁלוּשׁ|חַלַּת|חָם|חֶמְאָה|חַמָּאם|חַמְגָּשִׁית|חֶמֶד|חַמְדוּלִילָה|חֵמָה|חָמוּד|חִמּוּם|חָמוּץ|חֲמוּצִית|חַמּוּק|חֲמוֹר|חֲמוֹרָתַיִם|חָמוּשׁ|חֲמוּשָׁה|חָמוֹת|חֹמֶט|חֲמִיטָה|חָמִים|חַמִּין|חֲמִיצָה|חֲמִישִׁי|חֲמִישִׁים|חֲמִישִׁית|חֶמְלָה|חֲמָמָה|חֲמָמִית|חַמָּן|חַמָּנִיָּה|חָמָס|חַמְסָה|חַמְסִין|חָמֵץ|חֻמְצָה|חִמְצוּן|חֻמְצִי|חַמְצִיץ|חַמְצָן|חַמְצָנִי|חֻמְצַת|חֲמַקְמַק|חֹמֶר|חֳמָרִים|חֲמַרְמֹרֶת|חַמְרָן|חַמֶּרֶת|חָמֵשׁ|חַמְשָׁה|חַמְשׁוּשׁ|חֵמֶת|חֵן|חַנָּה|חֲנוֹךְ|חִנּוּכִי|חַנּוּן|חֶנְוָנִי|חֲנוּת|חַנְטָרִיש|חֲנָיָה|חַנְיוֹן|חְנִיוֹק|חָנִיךְ|חֲנִיכָה|חֲנִיכוּת|חֲנִינָה|חֲנִית|חֲנֻכָּה|חֲנֻכִּיָּה|חִנָּם|חֲנָמַל|חִנָּנִית|חֲנֻפָּה|חַנְפָן|חֶנֶק|חַנְקָה|חַנְקָן|חַנְקָתִי|חַנְקָתִית|חָס|חֲסָאִית|חֶסֶד|חֲסָדִים|חַסָּה|חָסוּי|חִסּוּם|חָסוֹן|חִסּוּנִי|חָסוּת|חָסִיד|חֲסִידָה|חֲסִילוֹן|חֲסִין|חֲסִיפָה|חֲסַךְ|חִסָּכוֹן|חָסָם|חֹסֶן|חֲסָקֶה|חֹסֶר|חָף|חַפְּ\"שָׁן|חֻפָּה|חִפּוּשׂ|חִפּוּשִׁית|חִפָּזוֹן|חֲפִינָה|חֲפִיסָה|חָפִיף|חֲפִיץ|חֲפִיר|חֲפִירוֹת|חַפְלָה|חֹפֶן|חֵפֶץ|חֶפְצִיבָהּ|חֲפָצִים|חֲפַרְפֶּרֶת|חֹפֶשׁ|חֻפְשָׁה|חָפְשִׁי|חָפְשִׁית|חֻפְשַׁת|חֵפֶת|חֵץ|חָצַ'פּוּרִי|חֲצָאֵי|חֲצָאִית|חָצָב|חָצָה|חֲצוּבָה|חָצוּי|חָצוּף|חֲצוֹצְרָה|חֲצוֹצְרָן|חֲצוֹת|",
"חֲצִי|חֶצְיוֹן|חֲצִיצָה|חָצִיר|חֻצְפָּה|חָצָץ|חָצֵר|חֹק|חֻקָּה|חִקּוּי|חָקִי|חַקְיָן|חַקְלָאוּת|חַקְלָאִי|חַקְלָאִית|חֵקֶר|חֻקַּת|חֻקָּתִית|חֹר|חֶרֶב|חָרָבָה|חֶרְבּוֹן|חֻרְבָּן|חׂרֵג|חִרְגָּה|חַרְגּוֹל|חֵרָגוֹן|חֲרָדָה|חַרְדּוֹן|חֲרֵדִי|חֶרְדַת|חָרוּב|חָרוּבִים|חָרוֹז|חָרוּט|חֲרוּכָה|חָרוּל|חָרוּם|חָרוֹן|חָרוּף|חָרוּץ|חֵרוּת|חַרְזָן|חֶרֶט|חֲרָטָה|חֻרטוּם|חַרְטוֹמִי|חַרטוֹמִית|חַרְטֹם|חַרְטֻמִּים|חֹרִי|חָרִיג|חֲרִיגָה|חַרְיוֹנָה|חֲרִיזָה|חָרִיט|חְרַיְמֶה|חֹרִין|חָרִיף|חֲרִיפוּת|חָרִיצוּת|חֲרִישִׁי|חָרָךְ|חָרֻם|חָרְמָה|חֶרְמוֹ|חַרְמָן|חֶרְמֵשׁ|חֶרְמֵשִׁית|חֶרֶס|חַרְסִינָה|חֲרֹסֶת|חֹרֶף|חֶרְפָּה|חָרְפִּי|חַרְצֻבּוֹת|חַרְצִית|חֶרֶק|חָרָקִירִי|חָרֵר|חָרָשׁ|חַרְשָׁן|חֻרְשָׁף|חֲרֹשֶׁת|חָשׁ|חֲשַׁאי|חִשְּׁבָה|חֶשְׁבּוֹן|חֶשְׁבּוֹנוֹת|חֶשְׁבּוֹנִיָּה|חֶשְׁבּוֹנִית|חֲשָׁד|חָשׁוּב|חִשּׁוּבִיּוּת|חִשּׁוּבִית|חָשׁוּד|חָשׂוּךְ|חִשּׁוּל|חֶשְוָן|חָשׁוּק|חִשּׁוּר|חֲשִׁיבָה|חֲשִׁיבוּת|חֲשִׁישׁ|חָשַׁךְ|חָשְׁכוּ|חִשָּׁכוֹן|חַשְׁמוֹנַאי|חַשְׁמַל|חַשְׁמַלָּאוּת|חַשְׁמַלַּאי|חַשְׁמַלִי|חַשְׁמַלִּית|חַשְׁמָן|חַשְׂפָן|חַשְׂפָנוּת|חַשְׁרָה|חַת|חִתּוּךְ|חָתוּל|חִתּוּלִים|חִתּוּלִית|חִתְחוּת|חַתְחַת|חְתְיָאר|חָתִיךְ|חֲתִיכָה|חֲתִימָה|חֲתִירָה|חֹתָל|חֲתַלְתּוּל|חָתָן|חֲתֻנָּה|חֲתֻנַּת|חֶתֶף|חַתְרִית|טַאי|טַב|טַבּוּלַה|טַבּוּן|טַבּוּר|טֶבַח|טְבִילָה|טְבִיעָה|טְבִיעַת|טֶבֶל|טַבְלָה|טַבְּלֶט|טַבְלָר|טֶבַע|טִבְעוֹנִי|טִבְעִי|טַבַּעַת|טַבָּק|טְבֶרְיָה|טַבְרָנִי|טֵבֵת|טִגּוּן|טֻגָּן|טְדֵי|טָהוֹר|טוּאַלֵט|טוֹב|טוֹבָה|טוּבִין|טוֹגָה|טְוָח|טוֹחֶנֶת|טוֹטָלִיטָרִי|טוֹטָלִיטָרִיזְם|טוֹטֶם|טוֹטָף|טוֹטֶפֶת|טְוִיָּה|טוֹלֶרַנְטִיּוּת|טוֹן|טוֹנַאז'|טוּנְגְּסְטֶן|טוּנְדְּרָה|טוֹנָה|טוֹנוּס|טוֹנִיק|טוּנֵפָה|טַוָּס|טוֹסְטֶר|טוּף|טוֹפוּ|טוֹפּוֹגְרַפְיָה|טוֹפּוֹגְרָפִית|טוֹפּוֹלוֹגִי|טוֹפּוֹלוֹגְיָה|טוֹפָּז|טוֹפִי|טוֹקְבֵּק|טוֹקְבֵּקִיסְט|טוֹקְסִין|טוֹקְסִיקוֹלוֹגְיָה|טוּר|טוּרַאי|טוּרְבִּינַת|טוּרגוֹר|טוּרָה|טוֹרְט|",
"טוֹרְטִיָּה|טוּרִי|טוֹרִיאִי|טוּרִיָה|טוּרִית|טוּרְמָלִין|טוֹרֵף|טוֹרְפֶּדוֹ|טוּרְקִי|טוּרְקִיז|טוּשׁ|טַחַב|טָחוּ|טְחוֹל|טָחוּן|טְחוֹרִים|טְחִינָה|טָחַן|טַחֲנָה|טַחֲנַת|טֶטָנוּס|טָיָארָה|טִיב|טַיְגָּה|טִיגְרִיס|טְיוּטָה|טִיוּל|טִיּוּלִית|טִיז|טִיזִינַבִּי|טִיחַ|טִיט|טִיטִין|טִיטַנְיוּם|טַיִטְס|טִיטְרַצְיָה|טִיל|טִילְדֶּה|טִילִים|טַיֶּלֶת|טַיְם|טִימְבֶּל|טִין|טִינִיטוּס|טַיִס|טִיסָה|טַיָּסִים|טִיסַת|טֵיפּ|טִיפוּס|טִיפֶּקְס|טַיְקוּן|טִירָה|טִירוֹן|טִירוֹנוּת|טֵית|טָכוֹמֶטֶר|טֶכְנַאי|טֶכְנוֹלוֹגִי|טֶכְנוֹלוֹגְיָה|טֶכְנוֹפוֹבּ|טֶכְנוֹפוֹבְּיָה|טֶכְנֶטְיוּם|טֶכְנִי|טֶכְנִיקָה|טַל|טֵלֵאוֹלוֹגְיָה|טֶלֶגְרָמָה|טֵלֶגְרָף|טֶלֶגְרַפְיָה|טָלֶה|טֶלֶוִיזוֹר|טֶלֶוִיזְיָה|טֶלֶוִיזְיוֹנִי|טֶלוֹמֶר|טִלְטוּל|טַלְטַל|טַלְטֵלָה|טֶלֶטֶקְסְט|טַלִּית|טֶלֶסְקוֹפּ|טֶלֶסְקוֹפִּי|טֶלֶף|טֶלֶפוֹן|טֶלֶפוֹנִים|טַלְפָּן|טֶלֶפְּרִינְטֶר|טֶלֶפַּתְיָה|טֶלֶקוֹמוּנִיקַצְיָה|טֶלֶקִינֶזִיס|טָמֵא|טַמְבּוּרִין|טֶמְבֶּל|טָמַגוֹצִ'י|טַמוֹקְסִיפֶן|טִמְטוּם|טִמְיוֹן|טָמִיר|טָמַן|טַמְפּוֹן|טַמְפּוֹנָדָה|טֶמְפֶּרָטוּרָה|טֶמְפֶּרָטוּרַת|טֶמְפֶּרָמֶנְט|טַנְגָּה|טַנְגּוֹ|טַנְגֶּנְס|טֶנְדֶּר|טַנְהַא|טִנְטוּן|טַנְטָלוּם|טֵנִיס|טֶנִיסַאי|טַנְק|טַנְקִים|טַנְקִיסְט|טָנְקֶר|טַס|טֶסְטוֹסְטֶרוֹן|טֶסְטֶר|טֵסֵרַקְט|טִעוּן|טָעוּת|טְעִינָה|טַעַם|טֵף|טִפָּה|טִפּוּל|טִפּוּס|טֶפַח|טְפָחוֹת|טְפָחַיִם|טַפְטֶפָה|טַפְטֶפֶת|טִפִּין|טְפִיפִית|טַפִּיר|טָפֵל|טְפֵלָה|טִפְלוּל|טֹפֶס|טַפְסָה|טַפְסָר|טֹפֶר|טִפֵּשׁ|טֶק|טַקְוַנְדוֹ|טֶקִילָה|טַקְסוֹנוֹמְיָה|טֶקְסְט|טֶקְסְטִיל|טָרָ\"שׁ|טְרָאוּמָה|טֶרְבְּיוּם|טְרָגֶדְיָה|טְרָגִי|טֶרֶדוֹ|טֵרָדוֹן|טֶרָה|טָרוּט|טְרוּטָה|טְרוֹיָנִי|טְרוֹל|טְרוֹלִי|טְרוֹלִיבּוּס|טְרוֹמְבּוֹן|טְרוּנְיָא|טֵרוּף|טְרוּפָה|טְרוֹפִּי|טְרוֹקָר|טֶרוֹר|טֶרוֹרִיסְט|טׂרַח|טִרְחָה|טֶרָטוֹגֶן|טֶרָטוֹלוֹגְיָה|טָרִי|טְרִיאָס|טְרִיאֵרָה|טְרִיאַתְלוֹן|טְרִיבּוֹלוּמִינֶסְצֶנְסְיָה|טְרִיבּוּנָה|טְרִיגוֹנוֹמֶטְרְיָה|טְרִיד|טְרִידָה|טְרִידַת|",
"טְרִיוֹדָה|טְרִיוְיָאלִי|טְרִיוְיָה|טְרִיז|טֶרִיטוֹרְיָאלִיִּים|טֶרִיטוֹרְיָה|טְרִיטְיוּם|טְרִילוֹגְיָה|טְרִילְיוֹן|טְרִילְיוֹנִית|טְרִימָרָן|טִרְיָן|טְרִינוֹם|טְרִיפוֹסְפָט|טְרִיפְּטִיכוֹן|טְרִיק|טְרִיקוֹ|טְרִירֶמָה|טֶרֶם|טֶרְמִינוֹלוֹגְיָה|טֶרְמִינָלִית|טְרֶמְפְּ|טְרַמְפּוֹלִינָה|טְרֶמְפִּיסְט|טְרֶנְד|טְרַנְזִיסְטוֹר|טָרַנְטֶה|טְרַנְס|טְרַנְסְגֶ'נְדֶּר|טְרַנְסְגֶ'נְדֶרִיּוּת|טְרַנְסְפוֹבִּיָּה|טְרַנְסְפּוֹזִיצְיָה|טְרַנְסְפּוֹרְט|טְרַנְסְפוֹרְמָטוֹר|טְרַנְסְפוֹרְמַצְיָה|טְרַנְסְפִּירַצְיָה|טְרַנְסְפֶר|טְרַנְסְצֶנְדֶּנְטִי|טְרַנְסְקְרִיפְּצְיָה|טֶרָסָה|טָרָף|טַרְפֶּדֶת|טְרֵפָה|טְרֹפֶת|טֶרָקוֹטָה|טְרַקְטוֹר|טְרַקְטוֹרוֹן|טְרַקְלִין|טָרָרָם|טְרָשִים|טַרְשָׁנִית|טִשְׁטוּשׁ|יָא|יָאֶה|יְאוֹר|יֵאוּשׁ|יָאִיר|יָאללָּה|יְבוּל|יִבּוּשׁ|יַבְחוּשׁ|יָבִיל|יָבָל|יַבֶּלֶת|יָבָם|יָבֵשׁ|יַבָּשָׁה|יַבֶּשֶׁת|יַבַּשְׁתִּי|יַבַּשְׁתָּן|יָגוּאָר|יָגוֹן|יְגֹרֶת|יָד|יָדוֹ|יְדוֹנִית|יָדוּעַ|יְדוּעָן|יְדֵי|יָדִיד|יְדִידוּת|יְדִידוּתִי|יְדִידוּתִית|יָדַיו|יָדֶיךָ|יָדַיִם|יְדִיעָה|יָדִית|יָדַע|יָהּ|יַהַב|יְהָבוֹ|יַהֲדוּת|יְהוּדָה|יְהוּדִי|יְהוּדִית|יְהֹוִיסְט|יְהוֹנָתָן|יְהוֹשֻׁעַ|יָהִיר|יְהִירוּת|יַהֲלוֹם|יֵהָרֵג|יוֹאֵל|יוֹבֵל|יוֹגֵב|יוֹגָה|יוֹגוּרְט|יוֹד|יוֹהֲרָה|יוּחֲסִין|יוּטָה|יוּכְנִי|יוֹל|יוּלִי|יוֹם|יוֹמוּלֶדֶת|יוֹמָם|יוֹמַן|יוֹן|יוֹנָה|יוֹנִי|יוּנִיקוֹד|יוֹנִית|יוֹנֵק|יוֹנַת|יוֹסֵי|יוֹסֵף|יוֹעֵץ|יוֹפִי|יוֹצֵא|יוֹצְמַח|יוֹצֵר|יוֹצְרִים|יוֹקֶשֶׁת|יוֹרֵד|יוֹרֶה|יוֹרָם|יוֹרֵשׁ|יוֹשֵׁב|יוֹשְׁבֶיהָ|יוֹשְׁבָיו|יוֹתֵר|יוֹתֶרֶת|יָזִיז|יִזְכֹּר|יַזָּמוּת|יַחַד|יַחְדָּה|יַחְדָּיו|יַחְדָן|יַחְדָנִי|יִחוּס|יֶחֱטָא|יָחִיד|יְחִידָאִית|יְחִידָה|יְחִידַת|יַחְמוּר|יַחַס|יַחֲסָה|יַחֲסֵי|יֻחֲסִין|יָחֵף|יַחְצָן|יַחְצָנוּת|יָטְבָתָה|יַטְרוֹגֶנִי|יֵין|יִישַׁר|יַכְטָה|יַכְטוֹנֶר|יַכְטוֹת|יָכִין|יְכֹלֶת|יֶלֶד|יַלְדוּת|יַלְדוּתִי|יְלָדִים|יַלְדֹּנֶת|יְלָלָה|יִלְמְדוּ|יַלֶּפֶת|יֶלֶק|יַלְקוּט|יַָם|יַמָּא|יַמָּאוּת|",
"יַמָּאי|יַמָּאִים|יָמָּה|יָמִּי|יַמִּיָּה|יָמָיו|יַמִּיִּים|יֵמִים|יָמִין|יָמִית|יִמְלוֹךְ|יְמָמָה|יְמָנִי|יִמְתָּקו|יָנוּאָר|יִנּוֹן|יָנִיב|יְנִיקָה|יַנְשׁוּף|יְסוֹד|יִסּוּרֵי|יִסּוּרִים|יַסְמִין|יַעֲבור|יַעַד|יָעֶה|יָעוּד|יָעֵז|יָעִיל|יַעֲלֶה|יַעֲנָה|יַעֶפֶת|יַעֲקֹב|יַעַר|יַעֲרָן|יַעֲרָנוּת|יָפֶה|יְפֵהפֶה|יָפוֹ|יִפּוּי|יֹפִי|יִפְיוּף|יָפִיחַ|יַפָּן|יַפָּנִית|יָצַא|יִצְהָר|יִצּוּגִית|יָצוּל|יְצוּר|יִצְחָק|יְצִיאָה|יְצִיאוֹן|יַצִּיב|יָצִיעַ|יְצִירָה|יְצִירָתִי|יְצִירָתִיּוּת|יֶצַע|יַצֶּקֶת|יֵצֶר|יִצְרוֹ'''''|יַצְרָן|יֶקֶב|יְקוֹד|יְקוּם|יָקוֹשׁ|יָקִינְתּוֹן|יְקִיצָה|יַקִּיר|יָקָר|יֻקְרָה|יְקָרוֹת|יָרֵא|יַרְגָּזִי|יָרַד|יַרְדָּה|יַרְדֵּן|יָרוֹד|יְרוּשָׁלַיִם|יְרוּשַׁלְמִי|יֶרַח|יַרְחוֹן|יְרֻחָם|יֶרִי|יָרִיב|יָרִיד|יְרִידָה|יְרִיחוֹ|יָרֵךְ|יַרְכִּית|יַרְכָּתַיִם|יִרְמְיָהוּ|יָרֹק|יֵרָקוֹן|יְרָקוֹת|יַרְקָן|יְרַקְרַק|יֵשׁ|יִשָּׂא|יַשְׁבָן|יִשּׁוּב|יִשּׂוּם|יִשּׂוּמוֹן|יְשׁוּעָה|יֵשׁוּת|יִשַׁי|יְשִׁיבָה|יְשִׁימֹן|יָשִׁיר|יְשִׁירָה|יָשִׁישׁ|יָשֵׁן|יֶשַׁע|יָשְׁפֵה|יִשָּׁק|יֹשֶׁר|יִשְׂרָאבְּלוֹף|יִשְׂרָאֵל|יִשְׂרְאֵלִי|יָשְׁרָה|יְשָׁרִים|יִשָּׂשכָר|יָתֵד|יָתוֹם|יְתוֹמִים|יַתּוּשׁ|יַתְמוּת|יִתֵּן|יֶתֶר|יְתֵרָה|יִתְרוֹן|כְּאֵב|כָּאוֹטִי|כָּאוֹס|כְּאָח|כְּאַחַד|כְּאַין|כְּאִישׁ|כְּאִלּוּ|כָּאן|כַּאֲרִי|כַּאֲשֶׁר|כַּבָּאוּת|כַּבַּאי|כַּבָּאִית|כַּבָּבּ|כָּבֵד|כְּבֵדָה|כַּבְּדֵהוּ|כְּבֵדִים|כָּבוֹד|כְּבוֹדוֹ|כָּבוּי|כָּבוּל|כְּבִידָה|כִּבְיוֹם|כְּבִיסָה|כַּבִּיר|כְּבִישׁ|כֶּבֶל|כַּבְלָרִית|כֶּבֶס|כּבָר|כִּבְרָה|כְּבָרוֹ|כֶּבֶשׂ|כִּבְשָׂה|כִּבְשָׁן|כְּגוֹן|כַּד|כְּדַאי|כִּדּוֹד|כַּדּוּם|כַּדּוּר|כַּדּוּרֶגֶל|כַּדּוּרַגְלָן|כַּדּוּרוֹן|כַּדוִרֵי|כַּדּוּרְיָד|כַּדּוּרִיּוּת|כַּדּוּרְסַל|כַּדּוּרְסַלָּן|כַּדּוּרְעָף|כַּדּוּרשַׂק|כְּדִלְהַלָּן|כַּדֹּרֶת|כֹּה|כֵּהֶה|כְּהוּא|כַּהֲלָכָה|כֹּהֵן|כְּהֻנָּה|כֹּהֲנִים|כַּהֲרָרִים|כּוּבָּנֶה|כּוֹבַע|כַּוָּה|כִּווּן|כִּוּוּנִי|כִּוּוּץ|כּוּז|",
"כּוֹחַ|כּוֹחוֹת|כּוּחלֵה|כְּוִיָּה|כּוּךְ|כּוֹכָב|כּוֹכָבִים|כּוֹכֶבֶת|כּוֹלֵל|כּוֹלֶסְטֶרוֹל|כּוֹלֶרָה|כּוּמָז|כּוֹנַן|כּוֹנְנוּת|כּוֹס|כּוּסוֹן|כּוֹסוֹת|כּוֹסִית|כּוֹפֵר|כּוּפְרָא|כּוּר|כּוֹרֵאוֹגְרָף|כוֹרֵאוֹגְרַפְיָה|כּוֹרֵם|כַּוְרָן|כּוֹרֵת|כּוֹשׁ|כּוּשִׁי|כַּוַּת|כּוּתִי|כּוֹתָר|כּוֹתֶרֶת|כָּזֹאת|כָּזָב|כָּזֶה|כַּזַּיִת|כֹּחַ|כְּחוּט|כְּחוּלָה|כָּחֹל|כְּחְלוּלִי|כְּחַלְחַל|כַּחֹמֶר|כַּחַש|כִּי|כִּיב|כִּידוֹן|כִּידִידִים|כִּיּוֹר|כִּיחַ|כֵּילַפָּה|כִּימָה|כִימוֹאִינְפוֹרְמָטִיקָה|כִימוֹתֶרָפִּי|כִימוֹתֶרַפְּיָה|כִּימִי|כִּימְיָה|כִּימִיקָל|כִּימִית|כִּיס|כִּיסָן|כִּיף|כִּיפוּף|כֵּיצַד|כִּירָה|כִירוּרְגִּי|כִּירוּרְגִּיָּה|כָּכָה|כִּכָּר|כָּל|כֶּלֶא|כִּלְאַחַר|כַּלַּאי|כַּלַאם|כֶּלֶב|כָּלְבּוֹיְנִיק|כַּלְבֵּי|כַּלְבִּיָּה|כְּלָבִים|כַּלְבָן|כַּלְבָנוּת|כַּלֶּבֶת|כְּלַבְתָּא|כָּלָה|כֻּלּוֹ|כָּלוּב|כְּלוֹט|כִּלּוּל|כְּלוּלוֹת|כְּלוּם|כְּלוֹמַר|כְּלוֹנָס|כְּלוֹנְסָאוֹת|כְּלוֹר|כְּלוֹרוֹפִיל|כְלוֹרוֹפְּלַסְט|כְּלוֹרַמְפֵנִיקוֹל|כֶּלַח|כְּלִי|כַּלִּיא|כְּלִיב|כְּלִיבָה|כִּלְיָה|כִּלָיוֹן|כְּלֵיזְמֵר|כָּלִיל|כְּלִילַת|כֵּלִים|כֶּלֶךְ|כַּלְכַּל|כַּלְכָּלָה|כַּלְכָּלִי|כַּלְכָּלִית|כַּלְכְּלָן|כַּלְכָּלַת|כְּלַל|כְּלָלִי|כְּלָלִית|כְּלָמִידִיָּה|כַּלָּנִית|כָּלַנְתֶרִיזְם|כַלְקֵדוֹן|כָּלְתָה|כְּמֵהָה|כְּמוֹ|כַּמּוֹן|כָּמוּס|כְּמוּסוֹת|כְּמוּרָה|כָּמוּשׁ|כַּמּוּת|כַּמּוּתִי|כְּמִיהָה|כְּמִנהָגוֹ|כִּמְעַט|כַמֶפִיט|כֹּמֶר|כַּמֶרֶת|כַּמָּת|כֻּמְתָּה|כַּן|כִּנָּה|כִּנּוּי|כְּנוּפִיָה|כִּנּוֹר|כֵּנוּת|כְּנִימָה|כְּנִיסָה|כְּנִיסוֹן|כַּנָּן|כַּנֶּנֶת|כֶּנֶס|כְּנֵסִיָּה|כְּנֶסֶת|כָּנָף|כְּנָפוֹן|כְּנָפַיִם|כַּנָּר|כִּנֶּרֶת|כַּנֶּשֶׁר|כָּנַת|כֵּס|כִּסֵא|כֻּסְבָּרָה|כֶּסֶה|כִּסּוּי|כָּסוּף|כִּסּוּפִים|כְּסוּת|כְּסִיל|כַּסְיַת|כֵּסֶל|כִּסְלֵו|כֻּסֶּמֶת|כֶּסֶף|כֻּסְפָּה|כַּסְפּוֹמָט|כַּסְפָּר|כַּסֶּפֶת|כֶּסֶת|כִּעוּר|כַּעַךְ|כָּעֵת|כָּף|כַּפָה|כָּפוּי|כָּפּול|כְּפוּלָה|כִּפּוּר|",
"כָּפוּשׁ|כִּפֵּחַ|כָּפִיָּה|כִּפְיוֹן|כָּפִיל|כְּפִילָה|כְּפִילַת|כְּפִיס|כְּפִיפָה|כְּפִיר|כַּפִּית|כְּפִיתָה|כְּפִיָּתִיּוּת|כַּפְכַּף|כֶּפֶל|כַּפְלָן|כָּפָן|כְּפָף|כְּפָפָה|כְּפָפוֹת|כֹּפֶר|כַּפָּרָה|כַּפֹּרֶת|כֶּפֶת|כַּפְתוֹר|כְּצֹאן|כִּקְלִפַּת|כַּר|כַּרְבֹּלֶת|כֵּרָה|כְּרוּב|כְּרוּבִית|כָּרוֹז|כְּרוּכְיָה|כְּרוּכִית|כְּרוֹם|כְּרוֹמָאִי|כְּרוֹמוֹזוֹם|כְרוֹמָטוֹגְרַפְיָה|כְרוֹנוֹבִּיוֹלוֹגְיָה|כְרוֹנוֹלוֹגְיָה|כְרוֹנוֹמֶטֶר|כְרוֹנוֹפִילִיה|כְּרוֹנִיקָה|כִּרְחוֹק|כַּרְטִיס|כַּרְטִיסִיָּה|כָּרִיּוֹת|כָּרִיזְמָה|כָּרִיזְמָטִי|כָּרִיךְ|כְּרִיכָה|כָּרִיש|כָּרִית|כַּרְכֹּב|כֻּרְכּוּם|כְּרַכֵּי|כַּרְכֹּם|כִּרְכָּר|כִּרְכָּרָה|כֶּרֶם|כַּרְמִיל|כַּרְמֶל|כַּרְמֶלִית|כֶּרֶס|כֻּרְסָה|כַּרְסֹמֶת|כָּרֶסֶת|כֶּרַע|כַּרְעֵי|כְּרַעַם|כַּרְפַּס|כְּרֵשָׁה|כָּרֵת|כַּרְתִי|כְּרֵתִים|כִּשּׁוּף|כִּשּׁוּרִים|כַּשִּׁיל|כָּשִׁיר|כְּשִׁירוּת|כִּשָּׁלוֹן|כְּשֶׁמֶן|כַּשֶּׁמֶשׁ|כֶּשֶׁף|כֹּשֶׁר|כִּשָּׁרוֹן|כַּשְׁרוּת|כַּת|כָּתַב|כַּתָּבָה|כְּתַבְלָב|כְּתֹבֶת|כִּתָּה|כְּתוּבִים|כִּתּוּר|כְּתִיב|כְּתִיבָה|כִּתִּים|כַּתִּישׁ|כָּתִית|כְּתִיתָה|כֹּתֶל|כָּתֹם|כֻּתְנָה|כְּתֹנֶת|כֶּתֶף|כְּתֵפָה|כְּתֵפִיָּה|כֶּתֶר|כִּתֵּת|לָ\"ג|לֹא|לַאגֶר|לֵאָה|לְאֹהֲלֹו|לָאוֹר|לְאֶחָד|לְאָחוֹר|לְאַט|לְאֵין|לְאֹם|לְאֻמִי|לְאֻמִּיּוּת|לְאֻמָּנוּת|לֵאמֹר|לַאֲמִתָּהּ|לַאֲנָחוֹת|לַאֲשׁוּרוֹ|לֵב|לֵבָב|לֶבֶד|לִבָּה|לִבּוֹ|לָבוּב|לָבוּד|לְבוֹנָה|לָבּוֹרַנְט|לְבוּשׁ|לֶבֶט|לְבַטָּלָה|לָבִיא|לְבִיבָה|לָבִּירִינְת|לַבְלַב|לִבְלִי|לַבְלָר|לֹבֶן|לְבַנְבַּן|לַבָּנֶה|לְבָנוֹן|לִבְנַת|לַבְקָן|לַבְקָנוּת|לַבְּקָרִים|לַבְּרָדוֹר|לִבְרִיאוּת|לִבְרָכָה|לַבְרָק|לֹג|לַגֹּבַהּ|לֶגוֹ|לָגוּנָה|לִגְיוֹן|לֶגִיטִימַצְיָה|לָגִין|לָגִינָה|לַגָּלוּי|לֹגֶם|לַדָּבָר|לֵדָה|לָדִינוֹ|לְדֶלֶת|לֶדֶרְהוֹזֶן|לֵדַת|לְהָאָה|לַהַב|לֶהָבָה|לַהַג|לַהֶגֶה|לִהוּק|לַהַט|לַהֲטָ\"ב|לַהֲטוּטָנוּת|לָהִיט|לְהַלָּן|לְהִסּוֹג|לַהַק|לַהֲקָה|לַהֲרֹג|לְהָרְגוֹ|לַהֲרָגְךָ|",
"לְהִשָּׁבֵר|לְהִתְרָאוֹת|לוֹ|לְוַאי|לוֹבּוֹטוֹמְיָה|לוּבִי|לוֹבְּסְטֶר|לוֹג|לוֹגוֹ|לוֹגוֹס|לוֹגוֹתֶרַפְּיָה|לוֹגִי|לוֹגִיסְטִי|לוֹגִיקָה|לוּד|לוּדָר|לוֹהֵט|לִוּוּחַ|לוּז|לוּזֶר|לוּחַ|לוּחוֹת|לוּחִית|לוֹחֵם|לוֹט|לוֹטוֹ|לוּטֶטְיוּם|לוּטֶציוּם|לוּטְרָה|לֵוִי|לַוְיָן|לִוְיָתָן|לִוְיְתָנִים|לִוְיְתָנִית|לוֹכְסָן|לוּל|לוּלָאָה|לוּלְאַת|לוֹלָב|לוֹם|לוֹנְדוֹן|לוֹעֲזִית|לוּף|לוּפִית|לוֹק|לוֹקוּם|לוֹקוּס|לוֹקְשׁ|לוֹרְד|לוֹרֶנְצְיוּם|לִזְבֵּז|לַזְבֶּזֶת|לָזֶה|לָזַנְיָה|לְזָרָא|לַח|לַחֲגוֹרָה|לֵחוֹ|לְחוּד|לָחוֹף|לַחוּת|לֶחָי|לְחַיִּים|לְחִימָה|לְחִיצַת|לְחִכּוֹ|לַחְלוּחִי|לַחְלוּחִית|לֶחֶם|לָחְמָה|לַחְמִית|לַחְמָנִיָּה|לַחַן|לְחִנָּם|לַחַץ|לַחֲצִי|לַחַשׁ|לָט|לְטָאָה|לְטַב|לְטֶבַח|לִטּוּן|לִטּוּשׁ|לָטִינִי|לָטִינִית|לֹטֶם|לְטִמְיוֹן|לֶטֶשׁ|לִי|לִיאַס|לִיבּוּרְנָה|לִיבִּידוֹ|לִיבְּרָה|לִיבֶּרָלִיזְם|לִיבֶּרָלִית|לִיבֶרְמוֹרְיוּם|לִיגָה|לִיד|לְיָדַיו|לֵיְזֶר|לִיטָא|לִיטוּרְגִיָּה|לִיטִיגָטוֹר|לִיטִיגַצְיָה|לִיטְרָה|לֵיל|לַיְלָה|לִילִיפּוּט|לִילִיפּוּטי|לִילִית|לִילָךְ|לַיִם|לְיַמָּאוּת|לִימוֹזִינָה|לִימוֹן|לִימוֹנִי|לִימוֹנִית|לִימוֹנְצֶ'לוֹ|לִימֵן|לִימְנוֹלוֹגְיָה|לִימְפָה|לִימְפוֹצִיט|לִינֵאָרִי|לִינֵאָרִית|לִינָה|לִינְץ'|לִיסִינְג|לִיפִּיד|לִיצִ'י|לִיצְלַן|לֵיצַן|לֵיצָנוּת|לִיקְוִידִי|לֵיקוֹמְיָה|לִיקוֹפֶּן|לֵיקוֹפֶּנְיָה|לִיקֶר|לִירָה|לִירִיקָן|לַיִשׁ|לֶיְשְׁמַנְיָה|לֵית|לִיתְיוּם|לִכְאוֹרָה|לִכְבִיסָה|לַכָּה|לְכָל|לִכְלוּךְ|לִכְלוֹנָס|לִכְלֵי|לָכֵן|לְכַף|לֶכֶת|לְלֹא|לְמֵאָה|לַמְּגֵרָה|לִמֵּד|לָמָה|לָמוּד|לְמוֹרַד|לְמֶחֱצָה|לְמִידָה|לָמִינַצְיָה|לְמַכְבִּיר|לַמְּכוֹנָה|לְמַלְקוֹחַ|לְמַעֲלֶה|לְמַעַן|לְמַפְרֵעַ|לַמִּצְעָה|לִמְקוֹמָהּ|לַמְרוֹת|לְמֹרַת|לְמָשׁוֹט|לְמִשְׁכָּב|לְמָשָׁל|לְמִשְׁעִי|לַמִּשְׁתַּמֵּשׁ|לְמֵת|לַנְגֶר|לִנְהָרוֹת|לֶנִינִיזְם|לְנַעֲלַיִם|לַנְקָה|לַנְתָּן|לֵס|לֶסְבִּית|לְסוּטָה|לִסְטִים|לְסִירוֹת|לַסִּפּוּן|לֶסֶת|לֹעַ|לַעַג|לְעוֹלָם|לַעֲזָאזֵל|לְעֵיל|לְעַיִן|",
"לְעֵינֵי|לְעֵלָּא|לְעֵת|לִפְגָם|לָפָה|לְפוּם|לְפָחוֹת|לֶפְּטוֹפּ|לַפִּיד|לַפִּידוֹת|לַפְלַף|לִפְנֵי|לִפְעָמִים|לָפָּרוֹסְקוֹפְּיָה|לֶפֶת|לֵץ|לְצֶדֶק|לַצֶוֶת|לְצָרְכֵי|לַק|לָקוֹחַ|לִקּוּי|לָקוֹנִי|לָקַח|לֶקֶט|לַקְטוֹז|לַקְמוּס|לְקִמְחֵיה|לְקַמָּן|לְקָנוֹסָה|לֶקְסִיקוֹגְרַפְיָה|לֶקְסִיקוֹן|לִקְרַאת|לָרֹאשׁ|לְרַבֵּע|לָרֶגֶל|לָרָדָאר|לָרוּחַ|לִרְוָחָה|לְרוֹעֵץ|לָרֹחַק|לְשָׁד|לַשָּׁוְא|לָשׁוֹן|לְשׁוֹנַאי|לְשׁוֹנו|לְשׁוֹנִי|לְשׁוֹנִית|לְשֵׁזְבָן|לְשַׁיִט|לִשְׁכָּה|לִשְׁכַּת|לַשְׁלֶשֶׁת|לֶשֶׁם|לִשְׁמָהּ|לְשֶׁעָבַר|לְשִׁעוּרִין|לְשֵׁרוּת|לִשְׁתִיָּה|לַתּוֹרָה|לְתִיתָה|לְתִפְאֶרֶת|מְאֻבָּן|מַאֲבֵק|מַאֲגָר|מַאְדִּים|מֵאָה|מְאֹהָב|מְאוֹד|מָאוּזוֹלֵאוּם|מְאוּם|מֵאוּס|מָאוֹר|מְאַוְרֵר|מַאֲזָן|מֹאזְנַיִם|מֵאָחוֹר|מֵאֲחוֹרָיו|מַאֲחַז|מַאי|מֵאֵיפֹה|מֵאִיץ|מֵאִיר|מְאֻיָּשׁ|מֵאִית|מַאֲכָל|מַאֲכֹלֶת|מָאכֶער|מֵאֵלָיו|מְאֻלָּף|מָאמִי|מְאַמֵּן|מַאֲמָר|מָאן|מֵאֳנִיָּה|מְאֻנָּךְ|מְאֻנָּס|מְאַסֵֵּף|מַאֲסָר|מַאֲפֶה|מַאֲפִיָּה|מַאְפֵּלְיָה|מְאֻפָּס|מַאֲפֵרָה|מְאֻרְגָּן|מְאֵרָה|מַאֲרָז|מַאֲרִיךְ|מְאֹרָע|מֵאֵשׁ|מֵאֵת|מְבֻדֶּדֶת|מִבְדוֹק|מֻבְהָק|מָבוֹא|מָבוֹי|מְבוּכָה|מַבּוּל|מִבְזֶקֶת|מִבְחַן|מַבְחֵנָה|מַבָּט|מִבְטָא|מִבְטָח|מֻבְטָל|מֻבְנֶה|מְבֻנְזָג|מִבְנִית|מַבְּסוּט|מִבְצָר|מַבְרֵג|מַבְרֵז|מְבֹרָץ|מִבְרֶשֶׁת|מָגֶ'נְטָה|מַגֵּב|מַגְבֵּהַּ|מַגְּבוֹן|מַגְבִּיל|מֻגְבָּל|מִגְבָּלָה|מֻגְבָּלוּת|מַגְבֵּר|מַגֶּבֶת|מֶגֶד|מְגָדִים|מְגַדֵּל|מִגְדָלוֹר|מַגְדֶּלֶת|מִגְדָּר|מִגְדָרִית|מֶגָה|מְגֹהָץ|מָגוֹז|מָגוֹף|מְגוּפָה|מְגוּפַת|מָגוֹר|מְגוֹרָה|מְגוּרֵי|מְגוּרִים|מְגוּרַת|מַגִּיד|מַגְיָה|מָגִיסְטֶר|מַגָּל|מַגְלֵב|מְגֻלְגֶּלֶת|מֻגְלָה|מַגְלוּל|מְגִלַּת|מַגְמָה|מָגֵן|מְגִנָּה|מַגְנֶזְיוּם|מַגְנֵט|מַגְנֵטִי|מַגְנֵטִיּוּת|מַגְנֵטִיט|מַגְנִיב|מַגָּע|מַגָּף|מַגֵּפָה|מֵגָפוֹן|מְגָרֶה|מַגְרֵסָה|מַגְרֵפָה|מִגְרָשׁ|מַגָּשׁ|מַד|מִדְבּוּר|מַדְבִּיר|מַדְבֵּקָה|מְדַבֵּר|מִדֻּבְשְׁךָ|מַדְגֵּם|מַדְגֵּשׁ|מָדַד|מִדָּה|מַדְוֶה|",
"מֶדוּזָה|מָדוֹךְ|מְדוֹכָה|מָדוֹן|מַדּוּעַ|מָדוֹר|מְדוּרָה|מְדוּרַת|מִדְּחִי|מַדְחֹם|מַדְחָן|מַדְחֵף|מַדְחֵפִי|מָדָי|מְדִידָה|מְדִידַת|מֶדְיָה|מֶדְיוּם|מֵדִיחַ|מֵדִיטַצְיָה|מְדִינַאי|מָדִינָה|מְדִינִי|מְדִינַת|מְדֻיָּק|מְדֻכָּא|מְדֻלְדָּל|מַדְלֵה|מְדַלִיָּה|מַדְלִיף|מָדָם|מַדְמֶה|מַדְמִיעַ|מַדְמֵנָה|מִדָּן|מַדָּע|מַדָּעִי|מַדְּעָן|מַדָּף|מְדֻפְּלָם|מַדְפֶּסֶת|מְדַקְדֵּק|מִדְרָג|מַדְרֵגָה|מַדְרֵגַת|מִדְרוֹן|מִדְרְחוֹב|מֻדְרָךְ|מִדְרָכָה|מִדְרָס|מִדְרָשׁ|מִדְרָשָׁה|מִדְשָׁאָה|מַה|מֵהָאַפִּיפְיוֹר|מֵהָאָרוֹן|מַהַבְּהָרָטָה|מַהְבִּיל|מְהַגְּרִים|מְהַדֵּק|מְהַדֵּר|מְהַדְּרִין|מָהוּהַּ|מַהוּתָנוּת|מְהֵימָן|מָהִיר|מְהִירָה|מְהִירוּת|מַהֲלָכִים|מַהֲמוֹרָה|מֵהַמַּקְפֵּצָה|מְהַנְדֵּס|מְהֻפָּךְ|מַהְפֵּכָה|מַהֲפֶּכֶת|מַהֵר|מָהָרָגָ'ה|מֵהָרוּחַ|מֵהַשָּׂטָן|מוֹ|מוֹאָב|מוֹאָבֶּט|מוּאַזִּין|מוֹבִיל|מוֹבֶלֶת|מוּבָן|מוּג|מוּגָז|מוּגָן|מוֹגֵרָה|מוֹדֶה|מוֹדוּלָרִי|מוֹדוּס|מוֹדִינְג|מוֹדִיעִין|מוֹדֶם|מוֹדָע|מוֹדָעָה|מוּדָעוּת|מוֹדַעַת|מוֹדֶרְנִיזְם|מוֹז|מוּזֵאוֹן|מוּזִיקַאי|מוּזִיקָה|מוּזִיקוֹלוֹגְיָה|מוּזִיקָלִי|מוּזְלְמָן|מוּזָר|מוֹחוֹן|מוֹחוֹת|מוֹחִי|מוֹחָן|מוּחָשִׁי|מוֹט|מוּטָגֵן|מוֹטוֹר|מוֹטוֹרִיקָה|מוֹטִיב|מוֹטֶל|מוּטָס|מוּטַצְיָה|מוּטְרָה|מוֹכִיחַ|מוֹכֵר|מוֹל|מוֹלֶדֶת|מוּלְטִידִּיסְצִיפְּלִינָרִי|מוֹלִי|מוֹלִיבְּדֶן|מוֹלִיךְ|מוֹלִיכוּת|מוֹלָסָה|מוֹלֶקוּלָרִי|מוֹלֵקוּלָרִית|מוֹלָרִי|מוּם|מוֹמֶנְט|מוּמָס|מוֹנְדִּיאָל|מוֹנֶה|מוֹנוֹגַמְיָה|מוֹנוֹגְרָמָה|מוֹנוֹטוֹנִי|מוֹנוֹטְרוֹפִי|מוֹנוֹלוֹג|מוֹנוֹלִית|מוֹנוֹמֶר|מוֹנוֹפּוֹל|מוֹנוֹפְּסוֹן|מוֹנוֹקְל|מוֹנוֹרֵיְל|מוֹנִיזְם|מוֹנִיטוֹר|מוֹנִיטִין|מוֹנִים|מוֹנִית|מוֹנַרְךְ|מוֹנַרְכְיָה|מוֹסָד|מוּסָךְ|מוּסָף|מוּסָקָה|מוּסַר|מוֹסֵרָה|מוֹעֵד|מוֹעֲדוֹן|מוֹעֲדֵי|מוּעָט|מוֹעָצָה|מוֹעֶצֶת|מוּעָקָה|מוֹפָזִית|מוֹפָע|מוֹפֵת|מוֹצִ'ילָה|מוֹצָא|מוּצִי|מוּצָק|מוּצָר|מוֹקֵד|מוֹקָה|מוּקְיוֹן|מוֹקֵשׁ|מוֹקְשִׁים|מוֹרָא|מוֹרַג|מוֹרְגָּנָה|מוֹרָד|מוֹרֶה|מוֹרַי|",
"מוֹרִיָּה|מוּרְיָס|מוֹרָל|מוּרָם|מוּרְסָה|מוֹרְפוֹלוֹגִי|מוֹרְפוֹלוֹגְיָה|מוֹרְפְיוּם|מוֹרְפֶמָה|מוֹרָשָׁה|מוֹרֶשֶׁת|מוֹשָׁב|מוֹשָׁבָה|מוּשְׁט|מוֹשֵׁךְ|מוֹשְכָה|מוֹשְׁכֵי|מוּשְׁק|מָוֶת|מוֹתֵחַ|מוֹתְחָן|מוֹתָר|מוֹתָרוֹת|מָז'וֹר|מִזְבֵּחַ|מִזְבָּלָה|מֶזֶג|מַזְגָן|מְזַהֵם|מִזְוָדָה|מִזְוָדֹנֶת|מְזָוֶה|מְזוּזָה|מֵזוֹזוֹאִיקוֹן|מְזוּזַת|מָזוּט|מָזוֹכִיזְם|מָזוֹכִיסְט|מָזוֹן|מְזוֹנוֹת|מָזוֹר|מֵזַח|מַזְחִילָה|מִזְחֶלֶת|מֵזִין|מְזֻיָּנִים|מְזֻיֶּנֶת|מַזְכִּיר|מַזְכֶּרֶת|מַזָּל|מַזְלֵג|מַזָּלוֹ|מַזָּלִיסְט|מִזְלָלָה|מַזְלֵף|מְזִמָּה|מִזְמוֹר|מַזְמִינוּת|מְזֻמָּן|מַזְמֵרָה|מִזְנוֹן|מִזְנוֹנַאי|מֶזֶנְכִימָה|מַזְנֵק|מִזְעוּר|מֶזְקֻנְקָן|מַזְקֵף|מְזֻקָּקִים|מִזְרַח|מִזְרָחִי|מִזְרְחָן|מִזְרְחָנוּת|מִזְרָן|מַזְרֵק|מִזְרָקָה|מֵחַ|מְחָאָה|מַחֲבוֹא|מַחְבּוֹשׁ|מַחְבֵּט|מְחַבֵּר|מַחְבֶּרֶת|מַחֲבַת|מַחְגֵּר|מְחַדֵּד|מֶחְדָּל|מָחוֹג|מְחוּגָה|מֶחֱוָה|מְחוֹזִי|מִחוּט|מָחוֹךְ|מָחוּל|מְחוֹלִית|מְחוֹלֵל|מַחְוָן|מְחוֹרֵר|מָחוֹשׁ|מַחֲזָאוּת|מַחֲזַאי|מַחֲזֶה|מַחְזוֹר|מַחְזוֹרִי|מַחְזוֹרִית|מַחֲזֶמֶר|מַחַט|מֹחִי|מְחֻיַּב|מְחֻיָּבוּת|מִחְיָה|מְחִילָה|מְחִיצָה|מְחִיקוֹן|מְחִיר|מְחִירוֹן|מְחֻכָּךְ|מַחְלָבָה|מַחֲלָה|מֻחְלָט|מֶחְלָף|מַחְלָפוֹת|מֻחְלָשׁ|מַחֲלַת|מֵחַם|מַחְמָאָה|מַחְמָד|מַחְמוּד|מְחֻמָּשׁ|מֵחֲמַת|מַחֲנָאוּת|מַחֲנֵה|מַחֲנַיִם|מְחַנֵּךְ|מַחֲסֶֶה|מַחְסוֹם|מַחְסָן|מַחְסָנִית|מַחְפִּיר|מַחְפֵּר|מְחֻפַּת|מַחְצָב|מֶחֱצָה|מַחֲצִית|מַחְצֶלֶת|מְחִצַּת|מַחַק|מֶחְקָר|מָחָר|מַחְרָאָה|מַחְרֵטָה|מַחְרֵשָׁה|מַחְשֵׁב|מַחְשָׁבָה|מַחְשְׁבוֹן|מַחְשֶׁבֶת|מַחְתָּה|מַחְתָּךְ|מְחֻתָּל|מַחְתֶּרֶת|מֶטֶאוֹר|מֶטֶאוֹרוֹאִיד|מֵטֵאוֹרוֹלוֹגְיָה|מַטְאֲטֵא|מֶטָבּוֹלִיזְם|מַטְבֵּחַ|מִטְבָּחַיִם|מַטְבֵּעַ|מַטֶה|מְטַהֵר|מִטְוָח|מְטוּטֶלֶת|מָטוֹל|מְטוּלָה|מֶטוֹנִימְיָה|מָטוֹס|מְטוֹסִים|מָטוֹש|מִטּוֹת|מַטָּח|מֶטָטְרוֹן|מְטִיל|מֶטָלוּרְגְּיָה|מַטְלִית|מַטְמוֹן|מֶטָמוֹרְפוֹזָה|מְטֻמְטָם|מַטְמֵן|מַטָּס|מַטָּע|מִטְעַן|מַטְפֶּה|",
"מִטְפַּחַת|מֶטָפִיזִיקָה|מְטַקְסָא|מָטָר|מִטְרָד|מַטָּרָה|מֶטְרוֹלוֹגְיָה|מַטְרוֹנָה|מֶטְרוֹנוֹם|מַטְרוֹנִית|מֶטְרוֹפּוֹלִין|מֶטְרִי|מִטְרִיָּה|מַטְרִיצָה|מְטֹרָף|מַטְרֵפָה|מִטָּרֶפֶת|מִטַּת|מֶטָתֶזָה|מֵי|מְיַבֵּשׁ|מִיגְרֶנָה|מִיָּד|מֵידְבָא|מֵידָלֵע|מִידְשִׁיפְּמֶן|מְיוּאוֹן|מִיוֹזָה|מִיוֹמָה|מִיּוּן|מָיוֹנֶז|מִיזוֹלוֹגְיָה|מִיזְלִי|מֵיזָם|מִיזַנְסְצֶנָה|מִיזַנְתְּרוֹפּ|מֵיזָע|מְיֻחָד|מְיֻחָם|מִיטוֹזָה|מִיטוֹכוֹנְדְרִיָּה|מִיטוֹכוֹנְדְּרִיּוֹן|מִיכָאֵל|מִיכָה|מֵיל|מְיַלֶּדֶת|מִילָה|מִילִי|מִילִיטָרִיזְם|מִילִיטָרִיסְט|מִילִילִיטֶר|מִילִימֶטְרִי|מִילִימִיקְרוֹן|מִילֶנְיוּם|מִילְקְשֵׁיְק|מַיִם|מִימוּנָה|מֵימֵי|מִימִיקָה|מֵימָן|מְיֻמָּנוּת|מִין|מִינָּהּ|מִינוֹ|מִינוֹטָאוּר|מִינֵי|מִינְיָאטוּרִי|מִינֵיהּ|מִינִיוָאן|מִינִיּוּת|מִינִימוּם|מִינִימָלִי|מִינִימַרְקֶט|מִינִיסְטֶרְיָאלִית|מִינִית|מִינַן|מִינָנוּת|מְיַנֶּנֶת|מֵינֶקֶת|מִינָרֶט|מִינֶרָל|מִיסְטִיקָה|מִיסְיוֹנֶר|מִיסִיסִיפִּי|מֵיעָז|מִיץ|מְיַצֵּב|מֵיְקַאפּ|מִיקוֹטְרוֹפִי|מִיקוֹרִיזָה|מִיקְס|מִיקְסֶר|מִיקְרוֹאֶלֶקְטְרוֹנִיקָה|מִיקְרוֹבִּיוֹלוֹג|מִיקְרוֹגַל|מִיקְרוֹגְרַפְיָה|מִיקְרוֹטֶכְנוֹלוֹגְיָה|מִיקְרוֹמֶטֶר|מִיקְרוֹן|מִיקְרוֹסְקוֹפּ|מִיקְרוֹסְקוֹפִּי|מִיקְרוֹפוֹן|מִיקְרוֹפִישׁ|מִיקְרוֹפָּלֵאוֹנְטוֹלוֹגְיָה|מִירִין|מַיִשׁ|מִישׁוֹר|מֵיתָד|מִיתוֹלוֹגְיָה|מִיתוֹלוֹגִיזָצְיָה|מִיתוֹס|מֵיתָר|מִיתַת|מָךְ|מַכְאוֹב|מִכָּאן|מַכְבֵּנָה|מִכְבָּסָה|מִכְּבָר|מֶכָּה|מְכוּלָה|מְכוּלוֹת|מְכוּלַת|מְכוֹנָאוּת|מְכוֹנַאי|מְכוֹנָה|מְכוֹנוֹת|מְכוֹנִית|מְכוֹנָן|מְכוֹנַת|מִכְחוֹל|מֶכָטְרוֹנִיקָה|מְכִירָה|מְכָל|מַכְלֵב|מִכְלוֹא|מִכְּלִי|מַכְלִיב|מְכָלִית|מִכְלָלָה|מַכֹּלֶת|מִכְמֹנֶת|מִכְמֹרֶת|מִכְמֹרְתָּן|מְכַנֶּה|מֶכָנִי|מֶכָנִיקָה|מֵכָנִיקַת|מֶכָנִית|מִכְנָס|מִכְנְסֵי|מִכְנָסַיִם|מְכֻנָּף|מֶכֶס|מִכְסָה|מְכַסַּחַת|מַכְפֵּלָה|מֶכֶר|מְכֻרְאַגְרָף|מִכְרֵה|מְכַרְסֵם|מִכְשׁוֹל|מַכְשִׁיר|מְכַשֵּׁף|מַכַּת|מִכְתָּב|מַכְתֵּבָה|מַכְתֵּשׁ|מָלֵא|",
"מְלֵאָה|מְלַאי|מַלְאַךְ|מְלָאכָה|מַלְאֲכוּת|מְלָאכוּתִי|מְלָאכוּתִית|מָלַאנְתַּלָּפִים|מְלַבִּים|מַלְבֵּן|מַלְבְּנִי|מִלְּבָרִית|מִלְגָּה|מַלְגֵּז|מַלְגֵּזָה|מַלְגֵּזָן|מִלָּה|מִלּוֹא|מִלוּאֵי|מִלּוּאִים|מִלּוּאִימְנִיק|מָלוּג|מַלְוֶה|מָלוּחַ|מְלוּחִים|מְלוּחִית|מִלּוּט|מְלוּכָנוּת|מָלוֹן|מְלוּנָה|מַלוּקַה|מָלוֹשׁ|מֶלַח|מִלְחִי|מִלְחִיָּה|מַלָחִים|מַלְחִין|מְלַחֵךְ|מִלְחָמָה|מִלְחֶמֶת|מִלְחַמְתִּי|מֶלְחֲצֵי|מֶלֶט|מַלְטָה|מִלְיוֹן|מִלְיוֹנִית|מָלִיחַ|מְלִיחוּת|מְלִיחִים|מְלִילָה|מִלִּים|מְלִיצָה|מִלְיַרְדּ|מִלְיַרְדֶּר|מִלִּית|מֶלֶךְ|מַלְכֹּדֶת|מַלְכָּה|מַלְכוּת|מַלְכוּתִי|מַלְכוּתִית|מְלֻכְלָךְ|מְלֻכְסָן|מַלְכַּת|מֶלֶל|מַלְם|מְלֻמָּדָה|מִלְמוּל|מֶלָנוֹצִיט|מֵלָנִין|מִלְעֵיל|מְלָפְפוֹן|מֶלְצַר|מֶלְצָרוּת|מַלְקָה|מַלְקוֹחַ|מַלְקוּת|מַלְקֶטֶת|מָלַרְיָה|מִלְרַע|מִלַּת|מֶלְתָּחָה|מֵם|מַמְאִיר|מֶמְבְּרָנָה|מַמְּגוּרָה|מְמֻגֶּנֶת|מֵמַד|מָמוֹן|מֶמוֹרַנְדּוּם|מִמּוּשׁ|מָמוּתָה|מְמֻזָּג|מַמְזֵר|מֻמְחֶה|מִמְחָטָה|מִמְטָר|מַמְטֵרָה|מִמֵּילָא|מֵמִיר|מֶמֶל|מְמַלֵּא|מִמְלָחָה|מַמְלָכָה|מַמְלַכְתִּי|מְמֻנֶּה|מִמֶּנּוּ|מְמֻנָּע|מְמֻנַּעַת|מֵמֵס|מִמְסָד|מִמְסָךְ|מִמְסָר|מִמַּעֲרָב|מִמְצָא|מְמֻצָּע|מֶמֶר|מִמְרָח|מַמְּרֹר|מַמָּשׁ|מִמְשֶׁה|מַמָּשִׁי|מַמָּשִׁית|מְמֻשָּׁךְ|מִמְשָׁל|מֶמְשָׁלָה|מַמְתָּק|מַן|מִנְאָם|מִנְאֹרֶת|מַנְגּוֹ|מַנְגִּינָה|מַנְגָּן|מַנְגָּנוֹן|מַנְדּוֹלִינָה|מַנְדָּט|מַנְדָּטוֹרִי|מֶנְדֶּל|מֶנְדֶּלֶבְיוּם|מַנְדָלָה|מַנְדֵּף|מַנְדָּרִינָה|מָנָה|מִנְהָג|מַנְהִיג|מַנְהִיגוּת|מְנַהֵל|מִנְהָלִי|מִנְהָרָה|מִנְהֶרֶת|מָנוּאֵלָה|מָנוֹחַ|מְנוּחָה|מְנוּחוֹת|מָנוּי|מְנֻוָּל|מָנוׂמֶטֶר|מָנוֹס|מָנוֹעַ|מְנוֹעִים|מְנוֹעָן|מָנוֹף|מְנוֹפַאי|מָנוֹר|מְנוֹרָה|מָנוֹת|מִנְזָר|מֻנָּח|מִנְחָה|מְנַחֵם|מֻנַּחַת|מֶנְטוּ|מֶנְטָלִיּוּת|מֶנְטָלִיזַצְיָה|מַנְטְרָה|מִנֵּיהּ|מֵנִיחַת|מָנִילָה|מִנְיָן|מֶנִינְגִּיטִיס|מָנִיפּוּלָטִיבִי|מָנִיפּוּלַצְיָה|מְנִיפַת|מָנִיקוּר|מַנְכָּ\"ל|מִנְכָסָיו|מִנְסָרָה|",
"מֶנַע|מִנְעָד|מַנְעוּל|מִנְעָל|מַנְפֵּטָה|מְנֻצֶּה|מְנַצֵּחַ|מְנַקֵּב|מְנַקֵּה|מְנַשֶּׁה|מִנְשָׁר|מְנַת|מִנְתָּה|מְנַתֵּחַ|מֶס|מֵסַב|מִסְבָּאָה|מְסִבָּה|מְסִבַּת|מִסְגָּד|מַסְגֵּר|מִסְגֶּרֶת|מַסַּד|מִסְדְּרוֹן|מָסָה|מָסוֹט|מָסוֹף|מַסּוֹק|מְסוֹקִי|מַסּוֹקִים|מַסּוֹר|מַסּוֹרִית|מִסְחָר|מַסְחָרָה|מִסְחָרִי|מִסְחָרִית|מַסְטוֹדוֹן|מֶסְטִינְג|מַסְטִיק|מַסְטִיקָא|מָסִיבִי|מַסִּיג|מְסֻיָּם|מַסִּיק|מְסִירוּת|מָסָךְ|מַסֵּכָה|מְסַכֵּךְּ|מֻסְכָּמָה|מְסֻכָּן|מִסְכֵּנוּת|מִסְכֶּרֶת|מַסֵּכַת|מְסִלָּה|מַסְלוּל|מַסְלִיד|מִסְלָקָה|מְסִלַּת|מִסְמָךְ|מַסְמֵר|מְסֻנְדָּל|מַסְנֵן|מַסָּע|מִסְעָדָה|מִסְעָף|מִסְפּוֹא|מִסְפּוּן|מַסְפִּיק|מִסְפַּן|מִסְפָּנָה|מִסְפָּר|מִסְפָּרָה|מִסְפְּרֵי|מִסְפָּרַיִם|מַסָּקָה|מַסְקָנָה|מִסְקָר|מַסְקָרָה|מַסְקָרוֹן|מֶסֶר|מְסֻרְבָּל|מַסְרֵגָה|מִסְרוֹן|מַסְרֵטָה|מְסָרֵף|מַסְרֵק|מָסֹרֶת|מָסַת|מִסְתַּבְּרָא|מִסְתּוֹר|מִסְתּוֹרִין|מִסְתַּעֲרֵב|מְעַבֵּד|מַעְבּוֹרַאי|מַעֲבָר|מַעְבָּרָה|מַעְבֹּרֶת|מַעְגָּל|מַעְגָּלִית|מַעֲגָן|מַעֲגָנָה|מָעוּךְ|מָעוֹן|מָעוּף|מְעוֹפֶפֶת|מְעוֹרֵר|מָעֹז|מַעֲזֵבָה|מַעַט|מַעֲטֶה|מַעֲטָן|מַעֲטָפָה|מַעֲטֶפֶת|מַעֲטָר|מְעִי|מְעִידָה|מְעִיל|מְעִילוֹן|מַעְיָן|מְעֻיָּנוֹן|מֹעַל|מַעֲלֵה|מַעֲלוֹן|מַעֲלֵישׁ|מַעֲלִית|מַעֲלָן|מַעֲמָד|מַעֲמָת|מַעַן|מַעֲנֶה|מַעֲנָק|מַעְפִּיל|מַעֲפָן|מְעַצֵּב|מְעַצְבֵּן|מַעֲצָד|מַעֲצוֹר|מַעֲצָמָה|מַעֲצֶמֶת|מַעֲצָר|מְעֻקָּב|מַעֲקֶה|מֵעֻקְצְךָ|מַעֲקָש|מַעֲרָב|מַעֲרָבִי|מְעַרְבֵּל|מְעַרְבֹּלֶת|מְעֹרֶבֶת|מְעֹרֶה|מַעֲרוֹךְ|מַעֲרוּף|מַעֲרַךְ|מַעֲרָכָה|מַעֲרָכוֹן|מַעֲרָכוֹת|מַעֲרֶכֶת|מְעֻרְעָר|מַעֲרָצָה|מַעַשֹ|מַעֲשֶׂה|מֵעֲשׂוֹת|מַעֲשֵׁנָה|מֵעֵת|מַעֲתַק|מַפָּאוּת|מְפֹאָר|מִפְּאַת|מְפַגֵּר|מַפָּה|מַפּוּחַ|מַפּוּחִית|מִפּוּי|מַפּוֹת|מַפְיָה|מֵפִיק|מַפִּית|מַפַּל|מֻפְלָא|מֻפְלָג|מִפְלָגָה|מַפָּלָה|מִפְלָט|מֻפְלֶטָה|מִפְלָס|מְפַלְפֶּלֶת|מִפְלֶצֶת|מְפֻלָּשׁ|מַפֹּלֶת|מִפְנֶה|מִפְּנֵי|מְפֻנָּק|מַפְסֶלֶת|מַפְסֶקֶת|מַפְעִיל|מִפְעָל|מַפֵּץ|",
"מִפְקָד|מִפְקָדָה|מְפַקֵּח|מִפְקָם|מַפְרוּם|מְפֹרָז|מִפְרָט|מְפָרֵךְ|מַפְרֶכֶת|מְפַרְנֵס|מְפֹרָץ|מִפְרָצוֹן|מִפְרֶצֶת|מִפְרָק|מְפָרֵשׁ|מִפְרְשֵׂי|מִפְרָשִׂים|מִפְרָשִׂית|מִפְרָשָׂן|מִפְרָשָׂנוּת|מֻפְשָׁט|מֻפְשֶׁטֶת|מִפֶּשַׁע|מַפְתֵחַ|מִפְתָּן|מֵץ|מָצָא|מַצָּב|מַצֵּבָה|מַצָּג|מַצֶּגֶת|מַצָּה|מָצוֹד|מְצוֹדֵד|מְצוּדָה|מִצְוָה|מִצְווֹת|מָצוּי|מְצוּלָה|מָצוֹף|מְצוּפִית|מָצוֹק|מְצוּקָה|מָצוֹר|מִצְוַת|מֶצַח|מִצְחָף|מְצִיאָה|מְצִיאוּת|מַצִּיָּה|מְצִיעָה|מְצִיצָה|מְצִיצָנוּת|מְצִיצַת|מְצֻיָּר|מַצִּית|מֻצָּל|מַצְלֶה|מֻצְלָח|מַצְלִיבִים|מַצְלִיחַ|מַצְלֵמָה|מַצְלֵמַת|מְצֻלָּע|מִצְלַעַת|מְצִלְתַּיִם|מַצְמֵד|מְצֻמֶּדֶת|מִצְמוּץ|מֻצְנָח|מְצֻנָּן|מִצְנֶפֶת|מַצָּע|מִצְעָה|מַצָּעִית|מְצַעֵר|מִצְעַת|מִצְפֵּה|מַצְפּוּן|מִצְפּוֹר|מַצְפֵּן|מַצֶּקֶת|מִצְרִי|מֵצָרִים|מְצְרָךְ|מְצֹרָע|מָקָאמָה|מַקָּב|מַקְבִּיל|מַקְבִּילוֹן|מַקְבִּילִית|מְקֻבָּל|מָקַבְּרִי|מַקֶּבֶת|מַקְדֵּחַ|מַקְדֵחַת|מַקְדִּימָה|מֻקְדָּם|מִקְדָּמָה|מִקַּדְמַת|מִקְדָּשׁ|מַקְהֵלָה|מִקּוּד|מִקְוֶה|מָקוֹל|מָקוֹם|מְקוֹמוֹן|מְקוֹמִי|מְקוֹמִית|מָקוֹר|מְקוֹרִי|מְקוֹרִיּוּת|מִקְטוֹרָה|מִקְטֹרֶן|מִקְטֶרֶת|מְקַיֵּם|מָקִינֶטָה|מִקִּיר|מֵקֵל|מִקְלֶדֶת|מַקְלֶה|מַקְּלוֹר|מִקְלַחַת|מֻקְלָט|מַקְלֵעַ|מְקֻלְקָל|מַקְמוּרָה|מְקֻמְפְּלָקְס|מִקְנֶה|מַקְסִים|מַקְסִימוּם|מֻקָּף|מִקְפָּא|מַקְפִּיא|מַקְפֵּצָה|מֻקְצֶה|מַקְצוֹע|מִקְצוֹעִית|מִקְצֶפֶת|מִקְצָתֵיהּ|מַקָּק|מֵקַר|מִקְרָא|מִקְרָאִית|מֻקְרֶבֶת|מְקֵרָה|מַקְרוֹבַּיּוֹטִיקָה|מָקָרוּן|מָקָרוֹני|מִקְרִי|מַקְרָמֵה|מַקְרֵן|מִקְרֶצֶת|מְקַרְקְעִין|מְקָרֵר|מְקֹרֶרֶת|מַקָּשׁ|מִקְשָׁה|מַקֶּשֶׁת|מַר|מָרָא|מַרְאָה|מֵרְאוֹת|מַרְאִית|מֵרֹאשׁ|מֵרַב|מַרְבַד|מַרְבֵּה|מְרַבִּית|מְרֻבָּע|מַרְבֵּק|מַרְגֶּז|מְרַגֵּל|מַרְגָּלִית|מַרְגָּנִית|מַרְגָּרִינָה|מֶרֶד|מַרְדִּים|מִרְדָּף|מָרָה|מַרְוָה|מָרוּחַ|מָרוּלָה|מָרוֹם|מַרְוָן|מֵרוֹץ|מֵרוּק|מָרוֹר|מָרוּת|מַרְזֵב|מַרְזֵחַ|מַרְזֶפֶת|מֶרְחָב|מֶרְחָבִית|מֶרְחָפָה|מֶרְחָץ|",
"מַרְחֶשְׁוָן|מַרְחֶשֶׁת|מַרְטִיט|מַרְטִירוֹלוֹגְיָה|מֶרִי|מָרִיאָצִ'י|מֶרִידְיָאן|מָרִיחוּאָנָה|מֶרִיטוֹקְרַטְיָה|מִרְיָם|מָרִינָה|מְרִיצָה|מָרִיר|מָרִישׁ|מָרִית|מְרֻכָּב|מֶרְכָּבָה|מֻרְכָּבִים|מֶרְכֶּבֶת|מִרְכּוּז|מִרְכּוּזיוּת|מַרְכּוֹל|מַרְכּוֹלִית|מֶרְכָּז|מֶרְכָּזִי|מַרְכִּיב|מְרַכֵּךְ|מִרְמָה|מַרְמִיטָה|מַרְמֶלָדָה|מָרָן|מָרָנָן|מַרְס|מְרַע|מַרְעִיש|מְרֹעָף|מִרְעָשׁ|מַרְפֵּא|מִרְפָּאָה|מְרֻפָּט|מֶרְפִי|מִרְפֶּסֶת|מֶרֶץ|מַרְצִיפָּן|מִרְצָף|מִרְצֶפֶת|מָרָק|מַרְקוֹעַ|מֶרְקָחָה|מִרְקַחַת|מַרְקִיעַ|מִרְקָם|מֶרְקַנְטִילִיזְם|מַרְקְסִיזְם|מִרְקָע|מִרְקָקָה|מַרְקֶר|מֵרֵר|מֻרְשׁוֹן|מַרְשָׁל|מַרְשְׁמֵלוֹ|מִרְשֶׁתֶת|מָרְתָא|מָרָתוֹן|מַרְתֵּף|מִרְתָּק|מַשׁ|מַשָּׁא|מַשְׁאָב|מַשְׁאֵבָה|מַשְׁאֵבַת|מַשָּׂאִית|מִשְׁאַל|מִשְׁאָלָה|מַשָּׁב|מִשְׁבֶּצֶת|מְשַׁבֵּר|מֻשָֹּג|מַשְׁגּוֹחַ|מַשְׁגִיחַ|מְשֻׁגָּע|מְשֻׁגָּעִים|מַשְׁגֵּר|מַשְׂדֵּדָה|מַשְׁדֵּר|מֹשֶׁה|מַשֶּׁהוּ|מַשּׁוּאָה|מָשׁוֹב|מְשׁוּבָה|מְשׁוּגָה|מְשֻׁוֶה|מָשׁוֹט|מְשׁוֹטָאי|מְשׁוֹטָה|מְשׁוֹטוֹת|מְשׁוֹטִי|מְשׁוֹטִים|מְשֹוּכָה|מְשׂוּרָה|מְשׁוֹרֵר|מִשְׁוֶרֶת|מִשּׁוּשׁ|מְשֻׁוַּת|מִשְׂחֶה|מִשְׂחוּק|מַשְׁחֶזֶת|מִשְׁחָטָה|מַשְׁחִית|מַשְׁחִיתָה|מַשְׁחֵן|מִשְׂחַק|מִשְׁחַת|מַשְׁחֶתֶת|מַשָּׁט|מִשְׁטָח|מַשְׂטֵמָה|מִשְׁטָר|מִשְׁטָרָה|מֶשִׁי|מָשִׁיחַ|מְשִׁיחָה|מֵשִׁיט|מְשִׁיכָה|מְשִׂימָה|מַשִּׁיק|מֶשֶׁך|מִשְׁכָּב|מַשְׁכּוּכִית|מַשְׂכִּיל|מְשֻׂכָּל|מְשֻׁכְלָל|מִשִּׁכְמוֹ|מִשְׁכָּן|מַשְׁכַּנְתָּה|מַשְׂכֹּרֶת|מִשְׁלָב|מֻשְׁלָג|מִשְׁלוֹחַ|מִשְׁלוֹחִים|מִשְׁלַח|מִשְׁלַחַת|מִשְׁלֵי|מֻשְׁלָם|מְשֻׁלָּשׁ|מְשֻׁלֶשֶׁת|מְשֻׁמָּד|מַשְׁמוֹט|מְשַׁמֵּן|מְשַׁמְּנִים|מַשְׁמָע|מַשְׁמָעוּת|מִשְׁמַעַת|מִשְׁמָר|מֶשְׁמֻרְטָף|מִשְׁמֶרֶת|מִשְׁמֵשׁ|מִשְׁנָה|מִשְׁנִית|מְשֻׁנָּן|מַשְׁנֵק|מְשִׁסָּה|מִשְׁעוֹל|מְשֻׁעַטְנָז|מַשְׁעֵן|מִשְׁעֶנֶת|מִשְׁפָּחָה|מִשְׁפַּחְתּוֹן|מִשְׁפַּחְתִּי|מִשְׁפַּחְתִּית|מִשְׁפַּט|מִשְׁפָּטִי|מִשְׁפָּטִים|מִשְׁפְּטָן|מַשְׁפֵּךְ|מֶשְׁפֻּכְטָל|",
"מֶשֶׁק|מַשְׁקֶה|מִשְׁקוֹלִית|מַשְׁקוֹעַ|מִשְׁקָל|מְשֻׁקְלָל|מִשְׁקֹלֶת|מִשְׁקָע|מִשְׁקָף|מִשְׁקְפֵי|מִשְׁקָפַיִם|מִשְׁקֶפֶת|מֵשָׁר|מִשְׂרַד|מִשְׁרָה|מַשְׁרוֹקִית|מִשֵׁרוּת|מְשֻׁרְיֶנֶת|מַשְׁרָן|מִשְׂרָפָה|מְשָׁרֵת|מְשֻׁשֶּׁה|מִשְׁתֶּה|מַשְׁתִּין|מִשְׁתַּלֶּבֶת|מִשְׁתָּלָה|מִשְׁתַּמֵּשׁ|מִשְׁתָּנָה|מְשֻׁתָּף|מֵת|מְתַאֲבֵן|מִתְאָם|מִתְאָמִי|מַתְבֵּן|מֶתֶג|מֵתָה|מִתְהַפֶּכֶת|מֶתוֹדוֹלוֹגְיָה|מִתְוֶה|מָתוּחַ|מָתוּן|מְתוֹפֵף|מָתוֹק|מְתוּקִים|מֶתַח|מַתְחֵב|מִתְחַזֶּה|מַתְחִיל|מִתַּחַת|מָתַי|מְתִיחָה|מֶתִיל|מֵתִים|מִתְכַּוְנֵן|מַתְכֹּנֶת|מַתֶּכֶת|מַתַּכְתִּי|מִתְלֶה|מִתְלַהֵם|מִתְלַיִם|מְתֻלָּע|מָתֶמָטִי|מָתֶמָטִיקַאי|מָתֶמָטִיקָה|מְתֻמָּן|מֹתֶן|מַתָּנָה|מֵתָנוֹל|מָתְנֵי|מָתְנָיו|מֻתְנֶית|מִתְנַפַּחַת|מַתְפֵּל|מִתְפַּלֵּל|מֹתֶק|מִתְקָן|מִתְקָנִים|מְתַקֶּנֶת|מִתְקָף|מִתְקַפֵּל|מְתַקְתַּק|מְתַקְתֶּקֶת|מְתֻרְגָּם|מְתֻרְגְּמָן|מִתְרָס|מַתָּת|נָא|נֹאד|נֹאדוֹת|נֶאְדָּר|נָאֶה|נֵאוֹגֵן|נָאוֶה|נָאוָואלִיס|נַאוּטִילוּס|נְאוּם|נָאוּמַכְיָה|נֵאוֹן|נָאוֹר|נֵאוֹת|נָאִיבִי|נֶאֱלָח|נֶאֱמָן|נֶאֱמָנוּת|נֶאֱסַף|נְאָצָה|נֶאֱצָל|נָאקָה|נֶאֱשָׁם|נֶבֶג|נִבְדָּל|נְבוּאָה|נָבוּט|נָבוֹכִים|נִבּוּל|נָבוֹן|נִבְזֶה|נִבְזִי|נֶבַח|נִבְחָה|נַבְחָן|נֶבֶט|נָבִיא|נְבִיאִים|נְבִיחָה|נְבִירָה|נֵבֶךְ|נֵבֶל|נְבֵלָה|נְבֵלוֹת|נִבְצָרוּת|נָבָר|נִבְרֶשֶׁת|נֶגֶב|נֶגְבָּה|נֶגֶד|נֶגְדָּה|נֶגְדִּית|נֶגְדָן|נֶגְדָנִי|נֹגַהּ|נִגּוּד|נִגּוּחַ|נִגְזֶרֶת|נָגִיד|נְגִידָה|נְגִינָה|נְגִיף|נָגִישׁ|נְגִישׁוּת|נִגְלֶה|נַגָּן|נֶגַע|נֶגֶף|נֶגֶר|נַגָּרוּת|נַגָּרִיָּה|נִגְרָר|נֵּד|נָדָב|נְדָבָה|נִדְבָּךְ|נַדְבָן|נֵדֶה|נְדוּדֵי|נְדוּדִים|נִדּוֹן|נָדוֹשׁ|נִדָּח|נָדִיב|נְדִיבוּת|נָדִיף|נָדִיר|נָדָל|נָדָן|נַדְנָד|נַדְנֵדָה|נִדָּף|נֶדֶר|נַדְרְשִׁיר|נַהָג|נֶהְדָּר|נִהוּג|נְהור|נְהִי|נְהִיגָה|נִהֵל|נְהָמָה|נֹהַר|נְהָרוֹת|נוֹ|נוֹאָל|נוֹאָשׁ|נוֹאָשׁוּת|נוֹבָה|נוּבוֹ|נוּבוֹרִישׁ|נוֹבְחָנִי|נוֹבֶּל|נוֹבֶלָה|נוֹבֶּלְיוּם|נוׁבֶמְבֶּר|נוֹגֵד|נוֹגֵשׂ|",
"נוֹד|נוֹדֵד|נוֹדֶדֶת|נוּדִיזְם|נוּדְנִיק|נָוֶה|נוֹהֵג|נִווּט|נִוּוּן|נוֹזֵל|נוֹזְלִי|נוֹזְלִית|נוֹחַ|נוֹחָה|נוֹחוּת|נוֹחִיּוּת|נַוָּט|נַוָּטוּת|נַוְטָן|נוּטְרִיָּה|נוֹטַרְיוֹן|נוֹי|נוֹיְרוֹבִּיוֹלוֹגְיָה|נוֹיְרוֹכִירוּרְג|נוֹיְרוֹכִירוּרְגִי|נוֹיְרוֹכִירוּרְגְּיָה|נוֹיְרוֹלוֹג|נוֹיְרוֹלוֹגִי|נוֹיְרוֹלוֹגְיָה|נוֹיְרוֹפִיזְיוֹלוֹגְיָה|נוֹיְרוֹפְּסִיכוֹלוֹגְיָה|נוֹכְחוּת|נוּל|נוֹמֵי|נוֹמִינָלִיזְם|נוּמִיסְמָטִיקָה|נוּן|נוֹנִי|נוֹנְשָׁלַנְטִיּוּת|נוֹסְטַלְגְיָה|נוֹסֵעַ|נוֹסְעֵי|נוֹסְעִים|נוֹף|נוֹפָה|נוֹפֵל|נוֹצָה|נוֹצְרִי|נוֹקֵד|נוֹקְדָן|נוֹקְטוּרְן|נוּקְלֵאוֹטִיד|נוֹרָא|נוּרָה|נוֹרְוֶגְיָה|נוּרִית|נוֹרְמָה|נוּרַת|נוֹשֵׂא|נוֹשֵׂאת|נוֹשָׁב|נוֹשֵׁךְ|נוֹשָׁן|נְוַת|נוֹתְרָה|נִזּוּל|נְזִיד|נְזִילוּת|נְזִיפָה|נָזִיר|נַזֶּלֶת|נֶזֶם|נֵזֶק|נָזְקָה|נְזָקִים|נִזְקָק|נָח|נֶחְבָּא|נַחוּם|נָחוּץ|נָחוֹתֵי|נְחִיָּה|נְחִיל|נְחִיר|נְחִירָה|נְחִיתָה|נַחַל|נַחֲלָה|נַחְלִיאֵלִי|נֶחְמָד|נֶחָמָה|נְחֶמְיָה|נַחְנוּ|נַחְס|נֶחְרָצוּת|נָחָשׁ|נַחְשׁוֹן|נֶחֱשָׁל|נְחֹשֶׁת|נְחֻשְׁתַּיִם|נְחֻשְׁתָּן|נָחֵת|נַחְתּוֹמָר|נַחֶתֶת|נְטַאי|נֶטוֹ|נָטוּרוֹפַּתְיָה|נָטוּשׁ|נְטִי|נְטִיָּה|נְטִילַת|נָטִיף|נֶטִיקָה|נְטִישָׁה|נֵטֶל|נֶטַע|נִטְעַן|נֶטֶף|נִטְרְפָה|נִטְרֶפֶת|נִיב|נִיגֶרִי|נִיד|נַיָּדוּת|נַיֶּדֶת|נִיהִילִיזְם|נְיוֹבְּיוּם|נְיוּטוֹן|נְיוֹקִי|נִיַּח|נִיחוֹחַ|נַיָּחוּת|נֵיטְרוֹן|נֵיטְרָלִי|נַיְלוֹן|נִים|נִימְבּוּס|נִימָה|נִימּוּס|נִימוּסֵי|נִימִיּוּת|נִימְפֵאָה|נִימְפָה|נִין|נִינְגָ'ה|נִינְיוֹ|נִיסָל|נִיסָן|נִיעוּת|נִיפוֹל|נִיצוֹל|נִיצוֹץ|נִיק|נִיקוֹטִין|נִיקֶל|נִיקָרָגוּאָה|נִיר|נִירְוָנָה|נַיֶּרֶת|נִישָׁה|נִכְאֶה|נְכֹאת|נֶכֶד|נֶכְדָּן|נָכֶה|נָכוֹן|נְכוֹנוּת|נִכּוּר|נָכוּּת|נִכְּיוֹן|נִכְנַס|נֶכֶס|נֵכָר|נָכְרִי|נָכְרִית|נָלוֹז|נִלְחַם|נִלְעָג|נְמִבְזֶה|נָמוּךְ|נְמוּכָה|נִמּוּק|נְמוּשָׁה|נְמִיָּה|נָמָל|נַמְלוּל|נְמָלִים|נִמְלַךְ|נִמְלָץ|נִמְצָא|נֶמֶק|נָמֵר|נִמְרָץ|נִמְרָשׁ|נָנָה|נָנוֹטוֹקְסִיקוֹלוֹגְיָה|",
"נָנוֹטֶכְנוֹלוֹגְיָה|נָנוֹפוֹטוֹנִיקָה|נַנָּס|נַנָּסִי|נֵס|נָסוֹג|נִסּוּי|נִסְחָב|נַסְיוּב|נִסָּיוֹן|נָסִיךְ|נְסִיכָה|נְסִיעָה|נְסִיעוֹת|נֶסֶךְ|נֶסַע|נִסְפָּר|נָסֵק|נְסֹרֶת|נָע|נֶעְדָּר|נָעוּ|נַעֲוֵה|נִעוּמִים|נְעוּרִים|נְעִילָה|נָעִים|נְעִימָה|נְעִיצָה|נְעִירָה|נַעַל|נַעֲלֵי|נֹעַם|נַעֲמִית|נֹעַר|נַעֲרָה|נַעֲשֶׂה|נֵף|נֶפָּאל|נָפָה|נִפּוּט|נֶפּוֹטִיזְם|נִפּוּץ|נֶפַח|נֵפְט|נֶפְּטוּן|נֶפְּטוּנְיוּם|נַפְטָלִין|נְפִיחָה|נָפִיל|נְפִילָה|נְפִיצוּת|נֹפֶךְ|נָפַל|נִפְלָא|נִפְעַל|נֶפֶץ|נִפְקָד|נִפְקָדוּת|נַפְקוּת|נַפְקָנִית|נִפָּרֵד|נֶפְרוֹלוֹג|נֶפְרוֹלוֹגִי|נֶפְרוֹלוֹגְיָה|נֶפְרוֹן|נִפְרָץ|נֹפֶשׁ|נַפְשׁוֹ|נַפְשִׁית|נׂפֶת|נִפְתַּחַת|נַפְתָּלִי|נֵץ|נֵץ'|נִצָּב|נִצָּה|נִצּוֹל|נֶצַח|נִצָּחוֹן|נָצִיג|נְצִילוּת|נַצְלָן|נִצְמַד|נִצָּן|נֵצֶר|נִצְרָה|נָצְרַת|נֶקֶב|נְקֵבָה|נְקֵבִי|נְקָבִים|נְקֻדָּה|נְקֻדִּית|נַקְדָּן|נְקֻדַּת|נִקּוּד|נִקּוּז|נִקּוּי|נֶקְטָר|נֶקְטָרִינָה|נָקִי|נְקִיָּה|נִקָּיוֹן|נְקִיטָה|נְקִיפָה|נָקִיק|נָקֵל|נְקָמָה|נַקְנִיק|נַקְנִיקִיָּה|נִקְרָה|נֶקְרוֹפִילְיָה|נֵר|נִרְאוּת|נַרְגִּיל|נַרְגִּילָה|נֵרְגַל|נִרְגָּן|נֵרְדְּ|נִרְדֶּפֶת|נֵרוֹ|נָרָטוֹלוֹגְיָה|נָרָטִיב|נַרְקוֹלֶפְּסְיָה|נַרְקוֹמָן|נַרְקִיס|נַרְקִיסִיזְם|נַרְקִיסִיסְט|נַרְקִיסִיסְטִי|נֶשֶׂא|נִשָּׂאָה|נַשְׁדּוּר|נָשׂוּא|נִשּׂוּאִים|נִשּׂוּאִין|נָשׂוּי|נִשְׁטָף|נָשִׁי|נְשִׂיאוּתִית|נְשִׁיָּה|נָשִׁיּוּת|נְשִׁימָה|נְשִׁיפָה|נְשִׁיקָה|נֶשֶׁךְ|נֶשֶׁם|נְשָׁמָה|נְשָׁמוֹת|נִשְׁמַע|נָשַׁף|נֶשֶׁק|נֶשֶׁר|נַתָּב|נִתְבָּע|נִתּוּב|נִתּוּחַ|נְתוֹנִים|נִתּוּק|נֶתֶז|נְתָזִים|נֵתַח|נָתִיב|נְתִיבוֹת|נָתִין|נְתִינוּת|נִתְכַּרְכְּמוּ|נָתַן|נְתַנְיָה|נִתְעָב|נֶתֶק|נֶתֶר|נַתְרָן|סְאָה|סְאוֹן|סָאוּנָה|סַאחִי|סָאקֶה|סָב|סֹבֶא|סֶבֶב|סַבָּבָּה|סִבָּה|סִבּוּב|סִבּוּבִי|סַבּוֹטָז'|סִבּוּכִיּוּת|סַבּוֹן|סָבוֹרָאִי|סַבְּטֶקְסְט|סָבִיב|סְבִיבָה|סְבִיבוֹל|סְבִיבָתָנוּת|סַבְיוֹן|סַבִּיח|סְבִילוּת|סֶבִיצֶ'ה|סִבִּית|סְבַךְ|סִבְכִי|סֵבֶל|סַבְלָנוּת|",
"סָבַּן|סִבְסוּב|סֶבֶר|סְבָרָה|סָבְרֵי|סַבְּרֶס|סָבְתָא|סָגָה|סֶגּוֹל|סָגוּף|סְגוּרָה|סַגִּי|סְגִיר|סָגֹל|סְגַלְגַּל|סְגֻלָּה|סְגֻלִּי|סְגָן|סִגְנוֹן|סַגְסֹגֶת|סַגְפָן|סַגְפָנוּת|סֶגֶר|סַגְרִיר|סַד|סְדוֹם|סִדּוּר|סְדוּרָה|סָדִיזְם|סָדִין|סָדִיסְט|סַדָּן|סַדְנָה|סֶדֶק|סִדְקִית|סֵדֶר|סִדְרָה|סַהַר|סַהֲרוּרִי|סַהֲרוּרִיּוּת|סוֹאֵן|סוֹבֵב|סוּבְּיֶקְטִיבִי|סוּבְּיֶקְטִיבִיּוּת|סוּבְּיֶקְטִיבִיזְם|סוּבְּלִימַצְיָה|סוֹבְלָנוּת|סוּבְּסְטַנְצְיָה|סוּבְּסְטְרָט|סוּבְּסִידְיָה|סוּג|סוּגָה|סוּגְיָה|סוּגָנוּת|סוּגֶסְטְיָה|סוֹד|סוֹדָה|סוֹדְיוּם|סוּדָן|סוֹדֵר|סוֹהֵר|סִוּוּג|סוּזֶט|סוּזָפוֹן|סוֹחֶבֶת|סוֹחֵר|סוֹכֵךְ|סוֹכֵן|סוֹכְנוּת|סוֹל|סוֹלוֹ|סוֹלִיסְט|סוֹלְלָה|סוֹלְסִיזְם|סוּלְפָט|סוֹלֶר|סוֹלָרִי|סוּמָא|סוֹמְבְּרֶרוֹ|סוֹמְכָה|סוֹמָלִיָּה|סָוָנָה|סוֹנָטָה|סוֹנָר|סוּס|סוּסוֹן|סוּסָנִית|סוֹף|סוֹפָ\"שׁ|סוּפָה|סוֹפִית|סוּפְלֶה|סוֹפָנִית|סוֹפְסוֹף|סוֹפֵר|סוּפֶּראוֹקְסִיד|סוֹפְרוּת|סוּפֶּרְלָטִיב|סוּפֶּרְמֶן|סוּפֶּרְמַרְקֶט|סוּפֶּרְנוֹבָה|סוּפֶּרְפּוֹזִיצְיָה|סוֹצְיָאלִי|סוצִיאלִיזם|סוֹצְיָאלִית|סוֹצְיוֹבִּיוֹלוֹגְיָה|סוֹצְיוֹלוֹגְיָה|סוּקוּלֶנְט|סוֹקֶל|סוּקְצֶסְיָה|סוּר|סוּרֵאָלִיזְם|סוֹרִי|סוּרְיָה|סוּרִית|סוֹרֵק|סוֹרֵר|סוּשִׁי|סוּת|סוּתִית|סוֹתֵם|סַחַב|סְחָבָה|סַחְְבָּק|סַחְבָּקִיוּת|סְחוּג|סְחוּס|סְחוֹר|סְחוֹרָה|סְחִיפָה|סַחְלָב|סַחַף|סַחַר|סְחַרְחֶרֶת|סַחְרִיר|סְטַגְנַצְיָה|סְטוֹאִי|סְטוּדְיוֹ|סְטוּדֶנְט|סְטוּץ|סְטָטוּטוֹרִי|סְטָטוּס|סְטָטִיסְטִיקָה|סְטָטִיקָה|סֵטִי|סְטִיבָדוֹר|סְטִיגְמָה|סְטִיָּה|סְטָיו|סְטִיק|סְטִיקֶר|סָטִירָה|סְטִיַּת|סַטְלָן|סְטֶן|סְטֶנְד|סְטֶנְדְאַפִּיסְט|סְטֶנְדֶּר|סְטַנְדַּרְט|סְטֶנוֹגְרַפְיָה|סְטֶנוֹטוֹפִּי|סְטֶנְט|סְטֶנְסִיל|סְטֵפָה|סְטָקָטוֹ|סְטֶרֵאוֹ|סְטֶרֵאוֹטִיפּ|סְטֶרֵאוֹכִימְיָה|סְטֶרֵאוֹמֶטְרִיָּה|סְטֵרֵאוֹסְקוֹפְּיָה|סְטְרוֹנְצְיוּם|סְטְרוֹפָה|סְטְרוּקְטוּרָה|סְטְרוּקְטוּרָלִיזְם|סְטְרָטִיגְרַפְיָה|סְטְרִיכְנִין|סְטְרִיפְּטִיז|סְטְרֶפְּטוֹקוֹקוּס|",
"סַטְרַפִּיָּה|סְטֶתוֹסְקוֹפּ|סִי|סִיב|סִיבוּב|סִיבוּבִית|סִיבִית|סַיְבֵּר|סִיג|סִיגְד|סִיגָל|סִיגָר|סִיגַרְיָה|סַיִד|סִידָן|סִידְנִי|סַיְדֶּר|סִיּוּט|סִיוָן|סִיּוּר|סִיזָל|סְיָח|סִיטוּ|סִיטְקוֹם|סִיכָה|סִילַבּוּס|סִילְבֶסְטֶר|סִילוֹן|סִילוּר|סִילִיקָה|סִילִיקָט|סִילָן|סִימְבּוֹלִית|סִימְבְּיוֹזָה|סִימָה|סִימוֹנְיָה|סִימֶטְרִיָּה|סִימָן|סִימָנוֹר|סִימָנֵי|סִימָנִיָּה|סִימָנִים|סִימְפּוֹזְיוֹן|סִימְפוֹנְיָה|סִימְפְּטוֹם|סִימְפָּתֶטִית|סִימְפַּתְיָה|סִין|סִינְגּוּלָרִית|סִינְגֵל|סִינְגַּפּוּר|סִינְדִּיקָלִיזְם|סִינְדִּיקַצְיָה|סִינְדָקְטִילְיָה|סִינוֹלוֹגְיָה|סִינוֹנִים|סִינוּס|סִינוֹפְּטִית|סִינוֹפְּסִיס|סַיִנְטוֹלוֹגְיָה|סִינְטַקְסִיס|סִינִי|סִינְיוֹר|סִינִית|סִינְכְרוֹלִיפְט|סִינֶמָה|סִינֶמָטֶק|סִינֶקְדוֹכָה|סִינְקֶר|סִינְקְרֶטִיזְם|סִינָר|סִינֶרְגְּיָה|סִינְתֶּזָה|סִינְתֶטִי|סִינְתֶּטִית|סִינְתִּיסַיְזֶר|סִיס|סִיסְטֶמָטִיקָה|סַיָּע|סַיִף|סִיפוֹן|סִיצִילְיָה|סִיקוּס|סִיקְסַק|סִיקָרִים|סִיר|סִירָאוּת|סִירַאי|סִירָה|סִירוֹפּ|סִירוֹת|סִירֶנָה|סִּירֹנֶת|סִירַת|סָךְ|סִכָּה|סַכּוּ\"ם|סָכוּי|סְכוֹלַסְטִיקָה|סִכּוּם|סָכוּר|סִכּוֹת|סַכִּין|סְכָךְ|סְכָכָה|סָכָל|סִכְלוּת|סְכֵמָה|סַכָּנָה|סִכְסוּךְ|סֶכֶר|סֻכָּרוֹז|סֻכְּרָזִית|סֻכָּרִיָּה|סֻכָּרְיַת|סֻכֶּרֶת|סִכַּת|סַל|סֶלֶבּ|סַלְבָדוֹר|סֶלֶבְּרִיטִי|סֶלָה|סְלוֹבֶנְיָה|סְלוֹבַקְיָה|סְלוֹגֶן|סֶלוֹטֵיְפּ|סֶלוּלָרִי|סָלוֹן|סְלוּפּ|סַלָּח|סָלָט|סֻלְטָאן|סַלְטָה|סַלְטִימְבּוֹקָה|סְלִידָה|סֻלְיָה|סְלִיחָה|סְלִיל|סְלִילִי|סְלִיק|סֻלָּם|סַלְמוֹן|סֻלָּמוֹת|סָלָמִי|סָלָמַנְדְּרָה|סְלֶנְג|סֶלֶנְיוּם|סַלְסָה|סִלְסוּל|סַלְסִלִּית|סֶלַע|סְלֶפְּסְטִיק|סֶלֶק|סֶלֶרִי|סַם|סַמָּאֵל|סַמְבּוּסָק|סְמָדַר|סָמוֹבָר|סָמוּי|סָמוֹךְ|סִמּוּן|סַמּוּר|סַמּוּרִיִּים|סִמְטָה|סָמָטוֹחָה|סָמִיךְ|סְמִיכָה|סְמִיכוּת|סְמַיְלִי|סָמֶךְ|סַמְכוּת|סַמְכוּתִיּוּת|סֶמֶל|סַמְלִיל|סַמְמָן|סַמָּן|סֶמַנְטִיקָה|סֶמֶסְטֶר|סֶמָפוֹר|סֹמֶק|סְמַרְטוּטָר|סָמַרְיוּם|סְנָאִי|סַנְגֵ'ר|",
"סָנֵגוֹר|סָנֵגוֹרְיָה|סֶנְדְּוִיץ'|סַנְדָּל|סַנְדָּק|סְנֶה|סַנְהֶדְרִין|סְנוּנִית|סְנוּקֶר|סַנְוֵרִים|סֶנָטוֹר|סֶנְטִימֵנְט|סַנְטֵר|סָנִיטָר|סָנִיטָרִיִּים|סְנִיף|סְנִיפוֹמָט|סַנָּן|סַנְסַן|סְנַפִּיר|סְנַפִּירִית|סַנְקְצְיָה|סָס|סַסְגּוֹנִי|סִסְמָה|סְעוֹנִית|סַעַר|סֹעֲרָה|סַף|סְפָּא|סְפָּאם|סְפָּגֶטִי|סֻפְגָּנִיָּה|סַפָּה|סָפוּג|סְפוֹגִים|סְפוֹגִית|סְפּוֹיְלֶר|סָפוּן|סִפּוּנַאי|סְפּוֹנְגָ'ה|סְפּוֹנְטָנִיּוּת|סְפּוֹנְטָנִית|סִפּוּנִי|סִפּוּנִים|סָפוּר|סְפּוֹרָדִי|סְפּוֹרְט|סְפּוֹרְטַאי|סִפּוּרֵי|סֶפְּטִימָה|סֶפְּטֶמְבֶּר|סַפְּיוֹסֶקְסוּאָל|סְפִיחָה|סַפִּיחֶס|סְפִינְג'|סְפִינָה|סְפִינוֹת|סְפִּינִינְג|סְפִינְקְס|סְפִּינֵקֶר|סְפִינַת|סָפִיר|סְפִירָה|סְפִּירוֹמֶטֶר|סְפִּירְט|סְפִירַת|סֵפֶל|סַפְלוּל|סַפָּן|סַפְנָה|סַפָּנוּת|סְפֶּנְסֶר|סַפְסַל|סְפֶּצִיפִי|סָפֵק|סְפֶּקְטְרוּם|סְפֶּקְטְרוֹמֶטֶר|סְפֶּקְטְרוֹסְקוֹפּ|סְפֶּקְטְרוֹפוֹטוֹמֶטֶר|סַפֶּקֶת|סֵפֶר|סְפָרַד|סְפָרַדִּי|סְפָרַדִּית|סְפֶרָה|סְפֵרוֹאִיד|סִפְרוֹן|סַפְּרוֹפָג|סַפָּרוּת|סִפְרוּתִי|סִפְרוּתִית|סִפְרִיָּה|סְפְּרַיִּיט|סְפָרִים|סִפְרִיַּת|סַפְרָן|סַפְרָנוּת|סִפֹּרֶת|סִפְרָתִי|סְפֶשִׁיסִיזם|סְצֵנָה|סְקְווֹשׁ|סֶקוּנְדָּה|סְקוּנֶר|סְקוּפְיָה|סְקֶטְבּוֹרְד|סְקִילָה|סְקִיפֶּר|סְקִיצָה|סְקָלָר|סְקְלֵרוֹדֶרְמַה|סְקָלָרִית|סְקַנְדְּיוּם|סְקַנְדָל|סֶקַנְס|סֶקְסוֹלוֹג|סֶקְסוֹלוֹגְיָה|סַקְסוֹפוֹן|סֶקְסְטָה|סֶקְסְטַנְט|סֶקְסִיזְם|סְקֶפְּטִי|סֶקְצִיָה|סֶקֶר|סְקַרְיָה|סְקַרְיַת|סַקְרָלִי|סַקְרָן|סַקְרָנוּת|סַר|סְרָאוּנְד|סֶרְבְּיָה|סַרְבָּל|סַרְבָן|סַרְבָנוּת|סַרְגֵל|סֵרוּב|סֵרוּגִין|סָרוּחַ|סֵרוֹלוֹגְיָה|סֶרוּם|סֶרַח|סֵרָחוֹן|סֶרֶט|סִרְטוּט|סִרְטוֹן|סַרְטָן|סָרִי|סָרִיג|סְרִיגָה|סָרִיס|סֶרֶךְ|סִרְכָה|סַרְכֶּזֶת|סֶרֶן|סֵרֵנָדָה|סַרְסוּר|סִרְפַּד|סָרָפָן|סְרָק|סַרְקוֹפָג|סַרְקַזֶם|סְתָו|סְתָוִי|סָתוּם|סִתְוָנִית|סִתּוּת|סְתִימָה|סְתִירָה|סְתַּלְבֵּט|סְתָם|סְתָמִי|סְתָרִים|סְתַרְשָׁף|סַתָּת|עֶבֶד|עֲבֻדָּה|עַבְדוּת|עֲבָדִים|עַבְדְּקָן|",
"עֲבוֹדָה|עֲבוֹדוֹת|עֲבוֹדַת|עֲבוּר|עֲבוֹת|עָבִיד|עֲבִידוּת|עָבִיט|עָבִיר|עֲבֵרָה|עִבְרוּת|עִבְרִי|עֲבַרְיָן|עִבְרִית|עֲבֵרַת|עָבֵשׁ|עֲגָבָה|עֲגָבִים|עַגְבָנִיָּה|עַגְבָנִיַּת|עַגֶּבֶת|עָגָה|עִגּוּל|עִגּוּלִי|עָגוּם|עֲגוּנָה|עָגוּר|עֲגוּרָן|עֲגוּרָנַאי|עֲגִינָה|עֲגִינוּת|עֵגֶל|עֲגָלָה|עֹגֶן|עַד|עֵדוּת|עָדַי|עֲדַיִן|עִדִּית|עַדְלָיָדַע|עֵדֶן|עׂדֶף|עֵדֶר|עֲדָשָׁה|עֲדָשִׁים|עַדְשַׁת|עוֹבֵד|עוֹגֵב|עוּגָה|עוּגוֹנִית|עוּגִיַּת|עוּגַת|עוֹד|עוֹדֵף|עִוָּה|עוֹזֵר|עֲוִית|עוּל|עוֹלָה|עוֹלָם|עוֹלָמוֹ|עוֹלָמִים|עוֹלָמְקוֹמִיוּת|עוֹמֵד|עוֹמֶדֶת|עָוֹן|עוֹנָה|עוֹנַת|עוֹף|עוֹפֶרֶת|עוֹקְדָן|עוּקָה|עוֹר|עוֹרְבָא|עִוְרוֹן|עוֹרֵק|עוֹרְקִי|עוֹרְקִיק|עוֹרְרוּת|עוֹרְרִין|עַוֶּרֶת|עַז|עָזַב|עִזָּבוֹן|עֲזוּבָה|עִזְקָה|עִזְקְתָא|עֵזֶר|עֶזְרָא|עֶזְרָה|עַזְרָן|עֵט|עִטּוּי|עִטּוּשׁ|עֲטִין|עָטִיף|עִטְרָן|עִיּוּנִי|עֵיטָם|עִילַי|עַיִן|עֵינָה|עֵינָיו|עֵינַיִם|עֵינָן|עֲיֵפוּת|עִיר|עֲיָרָה|עִירוֹנִיוּת|עִירִיָּה|עַיִשׁ|עַכָּבָה|עַכָּבִישׁ|עַכְבַּר|עַכְבֶּרֶת|עַכּוֹ|עַכּוּז|עִכּוּל|עֲכִירוּת|עָכָן|עַכְסָן|עַכְשׁוּב|עַכְשָׁיו|עַל|עִלַּאי|עֶלְבּוֹן|עֶלְבּוֹנוֹ|עָלָה|עָלוּב|עַלְוָה|עִלּוּי|עָלוּל|עָלוּם|עָלוֹן|עֲלוּקָה|עֲלָטָה|עָלִי|עֲלִיָּה|עָלָיו|עֶלְיוֹן|עֶלְיוֹנָה|עַלִּיז|עֲלֵיכֶם|עֲלִילָה|עֲלִילוֹן|עָלִים|עָלֵינוּ|עִלִּית|עַלְעִלִּי|עִלְרוּד|עִם|עַמַּאי|עַמְבָּה|עָמַד|עֶמְדָה|עֶמְדוֹת|עֶמְדַּת|עִמּוֹ|עַמּוּד|עָמוּם|עָמוֹס|עֲמִידַת|עַמָּיו|עָמִיל|עֲמִילָן|עֲמִימוּת|עָמִית|עָמָל|עַמְלָנוּת|עֲמָמִיּוּת|עׂמֶס|עַמְעַם|עָמֹק|עֲמֻקָּה|עֹמֶר|עֻמָּת|עֵנָב|עִנְבָּל|עֹנֶג|עֶנֶד|עֲנָדִים|עָנָהוּ|עָנָו|עִנוּגִים|עָנִי|עֲנִיבָה|עָנִיד|עֲנִיּוּת|עִנְיָנִים|עֲנִישָׁה|עָנָן|עָנָף|עֲנָק|עֹנֶשׁ|עִסָּה|עָסִיס|עֲסִיסִי|עֵסֶק|עָסְקִינַן|עִסְקִית|עַסְקָן|עִסְקַת|עִסַּת|עֹפִי|עֲפִיפָה|עֲפִיפוֹן|עֹפֶל|עֹפֶר|עִפָּרוֹן|עֶפְרוֹנִי|עֲפַרוֹת|עֵץ|עָצָב|עֻצְבָּה|עֲצַבִּים|עִצּוּב|עָצוּם|עֲצוּמָה|עִצּוּר|עִצּוּרִי|עִצּוּרִים|עֵצִים|",
"עָצִיץ|עֲצִירָה|עֲצִירוּת|עַצְלָן|עֶצֶם|עָצְמָה|עַצְמוֹת|עַצְמוֹתַיִם|עַצְמִי|עַצְמִית|עֹצֶר|עֲצֶרֶת|עָקֵב|עִקְבָה|עֵקֶד|עֲקֵדָה|עִקּוּל|עֲקוּמָה|עָקוּר|עָקִיף|עָקָל|עֲקַלָּתוֹן|עָקֹם|עֲקֻמָּה|עֲקֻמָּת|עֲקָרָה|עִקֵּשׁ|עַקְשָׁן|עָר|עֶרֶב|עֲרָבָה|עַרְבּוֹל|עֵרָבוֹן|עֲרָבוֹת|עֲרָבִי|עֲרָבִית|עֶרְגָה|עִרְגּוּל|עַרְגָּלִיוֹת|עַרְדָּל|עָרוֹב|עֲרוּגָה|עָרוֹד|עֵרוּי|עַרְטִילָאִי|עֲרָיוֹת|עֲרִיכַת|עָרִיס|עֲרִיסָה|עֲרִיפָה|עֲרִיפַת|עָרִיץ|עָרִיק|עֲרִיקָה|עֲרִירִי|עֶרֶך|עַרְכָּאָה|עֶרְכָּה|עֶרְכִּיּוּת|עֶרְכִּית|עֶרְכַּת|עָרֵל|עָרֹם|עֲרֵמָה|עַרְמוֹן|עַרְמוֹנִי|עַרְס|עַרְסָל|עַרְסָלָה|עֹרֶף|עַרְפָּד|עַרְפִּיחַ|עֲרָפֶל|עַרְפִלִּית|עִרָק|עִרַקִי|עֶרֶשׂ|עָשׁ|עֵשֶׂב|עָשָׂה|עָשׂוּי|עִשּׁוּן|עָשִׁיר|עֲשִׂירִית|עָשָׁן|עִשְׁנוּן|עָשְׁקָה|עָשָׂר|עֶשְׂרֶה|עֶשְׂרוֹנִי|עֶשְׂרִים|עֶשְׂרִימוֹן|עֲשֶׂרֶת|עֲשָׁשִׁית|עַשֶּׁשֶׁת|עֲתוּדָה|עִתּוּי|עִתּוֹנָאוּת|עִתּוֹנָאִי|עִתּוֹנָאִים|עִתּוּק|עַתִּיק|עַתִּיר|עָתָק|פָּאבּ|פַּאג'וֹן|פַאדִי|פֵּאָה|פֵאוֹדָלִיזְם|פֵּאוֹן|פָאטָה|פָּאטוּץ'|פַּאי|פָּאסֶה|פָאק|פְּאֵר|פָּארוֹטִיד|פָּארָן|פָארְשׁ|פָּבִילְיוֹן|פֶבְּרוּאָר|פָּג|פִּגּוּל|פָּגוּם|פִּגּוּעַ|פִּגּוּר|פָּגוֹשׁ|פָּגָז|פִּגְיוֹן|פְּגִיעָתוֹ|פְּגִישָׁה|פִּגָּם|פָּגָנִיּוּת|פֶּגַע|פֵּדָגוֹג|פֶּדָגוֹגְיָה|פֶּדוֹלוֹגְיָה|פָדוֹם|פֶּדוֹפִיל|פֶּדוֹפִילְיָה|פַּדַּחַת|פִּדְיוֹן|פָדִיחָה|פֶּדִיקוּר|פֶּדָל|פֶּדָלִים|פָּדֶלֶפוֹן|פֶדֶרָלִיזְם|פֶּדֶרַסְט|פֶדֶרַצְיָה|פֹּה|פִּהוּק|פוּ|פּוּאָה|פּוֹאֵמָה|פּוּאֶנְטָה|פוֹבְּיָה|פּוֹגְרוֹם|פּוֹדִיאַטְרְיָה|פּוּדִינְג|פּוּדֶל|פּוּדְרָה|פּוֹחֵז|פּוֹחֵחַ|פוֹטוֹגֶנִיּוּת|פוֹטוֹדְּיוֹדָה|פוֹטוֹכִימְיָה|פוֹטוֹלִיזָה|פוֹטוֹמוֹנְטָז'|פוֹטוֹן|פוֹטוֹנִיקָה|פוֹטוֹסִינְתֶּזָה|פוֹטוֹסְפֵירָה|פוֹטוֹפוֹן|פוֹטוֹרְזִיסְטוֹר|פוֹטוֹתֶרַפְּיָה|פּוֹטֶנְצְיָאל|פּוֹטֶנְצְיָאלִית|פּוֹטָשׁ|פּוֹיקֶה|פּוֹל|פּוֹלוֹ|פּוֹלוֹנְיוּם|פּוֹלֵחַ|פּוֹלִיאַנְדְרִיָּה|פּוֹלִיאַרְכְיָה|פּוֹלִיגוֹן|פּוֹלִיגִינְיָה|",
"פּוֹלִיגְלוֹט|פּוֹלִיגַמְיָה|פּוֹלִיגְרָף|פּוֹלְיוֹ|פּוֹלִיטִי|פּוֹלִיטִיקַאי|פּוֹלִיטִיקָה|פּוֹלִיטִיקָלִי|פּוֹלִיטִית|פּוֹלִימֶר|פּוֹלִימֶרִית|פּוֹלִינוֹם|פּוֹלִיס|פּוֹלִיסָה|פּוֹלִיסֶמִי|פּוֹלִיפּ|פּוּלְמוּס|פּוֹלָנִית|פּוּלְסָא|פּוּלְסָר|פוֹלְקְלוֹר|פּוֹלָרִיּוּת|פּוֹלָרִיזַצְיָה|פּוֹלָרִיס|פּוֹלֶשֶׁת|פּוּם|פּוּמִית|פּוֹמֶלָה|פּוֹמֶלִית|פּוֹמְפָּה|פּוֹנְג|פוֹנְדּוּ|פּוּנְדְיוֹן|פוֹנְדָּן|פּוּנְדְקָאִית|פוֹנוֹגְרָף|פוֹנוֹטַקְטִיקָה|פוֹנוֹלוֹגְיָה|פּוֹנְטוּן|פּוֹנְטוּנִים|פוֹנֶטִי|פוֹנֶטִיקָה|פּוּנְטִית|פּוֹנִי|פּוֹנְפּוֹן|פוּנְקְצְיָה|פוּנְקְצְיוֹנָלִיזְם|פוּנְקְצִיַּת|פּוֹסְט|פּוֹסְטוּלָט|פּוּסְטֵמָה|פּוֹסְטמוֹדֶרְנִיזְם|פוֹסְפוֹר|פוֹסְפָט|פּוֹעֵל|פּוֹפּ|פּוֹפּוּלָרִי|פּוֹפְּקוֹרְן|פּוּצִי|פּוֹקוּס|פוּקְסְיָה|פוֹקָצָ'ה|פּוֹקֵר|פּוּר|פּוֹרֶה|פוֹרוּם|פוּרוּנְקֶל|פּוֹרֵחַ|פּוֹרְטוּגַלית|פּוֹרְטְפוֹלְיוֹ|פּוֹרִיּוּת|פּוּרִים|פוֹרְמַיְקָה|פוֹרְמָלִי|פוֹרְמָלִין|פוֹרְמָלִית|פּוֹרְנוֹגְרַפְיָה|פוֹרֶנְזִי|פוּרְנִיר|פּוּרְפּוּרָה|פּוֹרֵק|פּוֹרֶקֶת|פּוּרְתָּא|פּוֹשֵׁט|פּוֹשֵׁעַ|פּוֹשֵׁר|פּוֹתְחָן|פָּז|פָזָה|פִּזּוּר|פָּזִיז|פַּזֶל|פִּזְמוֹן|פִּזְמוֹנָאוּת|פִּזְמוֹנַאי|פֻּזְמָק|פַּח|פַּחַד|פַּחְדָן|פֶּחָה|פַּחֲוָה|פְּחוּס|פָּחוֹת|פַּחַז|פַּחֲזוּת|פַּחְזָנִית|פַּחָח|פֻּחְלָץ|פֶּחָם|פַּחְמָה|פֶּחָמִים|פַּחְמֵימָן|פַּחְמָן|פַּחְמָתִי|פַּחְמָתִית|פִּטְדָה|פָּטֶה|פְּטוֹטֶרֶת|פִּטּוּר|פַּטְיוֹ|פֶּטִיפוּר|פְּטִירָה|פַּטִּישׁ|פֶטִישִׁיזְם|פַּטִּישִׁים|פֶּטֶל|פָטָלִי|פָטָלִיזְם|פָּטֵנְט|פָּטֶנְטִי|פִּטְפּוּט|פָּטֶפוֹן|פַּטְפְּטָן|פֶּטֶר|פֶּטְרוֹגְלִיף|פֶּטְרוֹזִילְיָה|פֶּטְרוֹלוֹגְיָה|פַּטְרוֹן|פֶּטְרוּשְׁקֶה|פַּטְרִיאַרְכְיָה|פַּטְרִיאַרְכָלִי|פִּטְרִיָּה|פַּטְרִיוֹט|פַּטְרִיוֹטִי|פַּטְרִיוֹטִיּוּת|פֶּטְרִיכּוֹר|פִּי|פִיאַסְקוֹ|פִיבֶּרְגְּלָס|פִּיגָ'מָה|פִּיגָ'מוֹת|פֶיְגָלֶה|פִּיגְמֶנְט|פִידְבֶּק|פִּיָּה|פִיהְרֶר|פִּיו|פִּיּוּט|פִּיּוּם|פִּיּוֹן|פִּיּוֹנִית|פְיוֹרְד|פִיזְיוֹלוֹג|",
"פִיזְיוֹלוֹגִי|פִיזְיוֹלוֹגְיָה|פִיזִיקַאי|פִיזִיקָה|פִיזִיקָלִי|פִיזִיקָלִית|פִּיטָאיָה|פִּיטַנְגּוֹ|פָיְיטֶר|פִּיל|פִּילֶגֶשׁ|פִילוֹגֶנֶטִיקָה|פַּיְלוֹט|פִילוֹלוֹגְיָה|פִילוֹסוֹפִי|פִּילָטִיס|פִילָטֶלְיָה|פִילְטֶר|פִילְיָה|פִּילִינְג|פִילִיפְּס|פִילַנְתְּרוֹפּ|פִּים|פִּין|פִּינְג|פִינְגָ'אן|פִּינְגְּוִין|פֵּינְטְבּוֹל|פִינִית|פַיְנֶל|פַיְנָלִיסְט|פִינַנְסִית|פִּינְצֶטָה|פַּיִס|פִיסְטוּק|פִּיפּ|פִּיפֶּטָה|פִּיפִּי|פִּיפִיּוֹת|פִּיפִית|פִּיצָה|פִּיצוּץ|פִּיצוּצִיָּה|פִּיצֵרִיָּה|פִּיק|פִּיקָה|פִּיקוֹלוֹ|פִיקוֹלוֹגְיָה|פִּיקַנְטִי|פִּיקַנְטִיּוּת|פִּיקַנְטֶרְיָה|פִּיקְסֶל|פִּיר|פִּירֶה|פִּירוּאֶט|פִּירוֹטֶכְנִיקָה|פִּירוֹמַנְיָה|פִּירוּס|פִּירוֹקְסִילִין|פִּירָט|פִּירָטִי|פִּירָטִיוּת|פִּירָמִידָה|פִישׁ|פִּיתָה|פִּיתוֹם|פַּךְ|פִּכֵּחַ|פַּכִּים|פַּכְסַם|פֶּלֶא|פָּלֵאוֹגֵן|פָּלֵאוֹגְרַפְיָה|פָּלֵאוֹזוֹאִיקוֹן|פָּלֵאוֹנְטוֹלוֹגְיָה|פָלֵאוֹקֵן|פְּלָאוֹת|פִּלְאֵי|פֶּלֶאפוֹן|פָלַאפֶל|פְּלֶבִּיסְצִיט|פֶּלֶג|פְּלֻגָּה|פְּלַגְיָאט|פְלֶגְמָט|פְלֶגְמָטִי|פְּלֻגְתָּא|פֶלֶד|פְּלָדָה|פְלוּאוֹר|פְלוּאוֹרִיד|פְלוּאוֹרֶסְצֶנְטִית|פְלוֹגִיסְטוֹן|פְּלוּטוֹנְיוּם|פְלוֹטִילָה|פְּלוֹמְבָּה|פְּלוּמָה|פְּלוֹנְטֵר|פְּלוֹנִי|פְלוֹרָה|פְּלוּרָלִיזְם|פְּלַזְמָה|פֶּלַח|פַלְחָה|פֻּלְחָן|פֶּלֶט|פְּלֵטָה|פְּלָטִינָה|פְּלַטְפוּס|פְּלַטְפוֹרְמָה|פַּלְטֵר|פַּלְטֵרִין|פַּלְיָאטִיבִי|פָּלֵיאַרְקְטִי|פְּלִיוֹקֵן|פְּלִיז|פָּלִיט|פְּלִיטָה|פְּלִילִית|פָּלִינְדְּרוֹם|פְּלֵיסְטוֹקֵן|פֶּלֶךְ|פַּלְמָ\"ח|פְלַמְבֶּה|פַּלְמוּדָה|פִּלְמוּר|פְלֶמִי|פְלָמִינְגּוֹ|פְּלַנֶטָה|פְּלָנֶטַרְיוּם|פְּלַנְקְטוֹן|פָלַנְקְס|פֶּלֶס|פְּלַסְטִי|פְּלַסְטִיק|פְּלַסְטֶלִינָה|פְלַסְמוֹלִיזה|פְּלַסְתֵּר|פִּלְפּוּל|פִּלְפֵּל|פְּלָצֶבּוֹ|פַּלְצוּר|פַלְצָן|פְּלְקֶטְרַנְתוּס|פְלֶקְסָגוֹן|פְּלֶשֶׁת|פְּלִשְׁתִּים|פָּלֶשְׂתִּינָה|פָּמוֹט|פֶמִינִיזְם|פָּמַלְיָה|פֻּמְפִּיָּה|פַּמְפְלֵט|פַּמְפֶּמֶת|פֶּן|פְּנֵאוּמָטִי|פְּנֵאוּמָטִיקָה|פְּנֵאוּמָטִית|",
"פְּנַאי|פָנָאן|פַּנַּג|פַּנְדָּה|פַּנְדּוֹרָה|פַנְדֵירוּ|פֶּנְדֶּל|פֻּנְדָק|פֻּנְדְּקַאי|פֶנְדֶר|פִּנָּה|פֶנוֹטִיפּ|פִּנּוּק|פָּנוֹרָמָה|פִּנּוֹת|פִּנְחָס|פֶּנְטַגְרָם|פֶּנְטְהָאוּז|פַּנְטוֹמִימָה|פַנְטַזְיָה|פֶּנְטֶקוֹנְטֶר|פֶּנְטֶרָה|פְּנֵי|פָּנָיו|פָּנִים|פְּנִימִי|פְּנִימִיָּה|פְּנִימִיִּים|פְּנִימִית|פְּנִינָה|פְּנִינִים|פֶּנִיצִילִין|פִּנְכָּה|פַּנֶּל|פַּנָּס|פֶּנְסְיָה|פֶּנְסִילְבֶנִי|פַּנְסְפֶּרְמִיה|פָּנְצֶ'ר|פַּנְצֶ'רִיָּה|פֶנֶק|פָּנָקוֹטָה|פַּנְקֵיְק|פִּנְקָס|פֶּנֶת|פַּנְתֶאִיזְם|פַּנְתֵּר|פַּס|פָּס'|פִּסְגָּה|פִּסָּה|פָסוֹן|פָּסוּק|פְּסוּקִית|פְּסוֹרְיָאזִיס|פֶּסַח|פַּסְטָה|פֶּסְטוֹ|פִּסְטוּר|פֶסְטִיבָל|פַּסְטֶל|פַּסְטְרָמָה|פָּסִיבִי|פְּסִיגִי|פַּסְיוֹן|פְּסִיכוֹאָנָלִיטִיקַאי|פְּסִיכוֹבַּלְשָׁנוּת|פְּסִיכוֹגֶרִיאַטֶר|פְּסִיכוֹדְרָמָה|פְּסִיכוֹזָה|פְּסִיכוֹלוֹג|פְּסִיכוֹלוֹגְיָה|פְּסִיכוֹלוֹגִית|פְּסִיכוֹמֶטְרִי|פְּסִיכוֹסוֹמָטִי|פְּסִיכוֹפִיזִיקָה|פְּסִיכוֹפָּתוֹלוֹגְיָה|פְּסִיכוֹפַּתְיָה|פְּסִיכוֹתֶרַפְּיָה|פְּסִיכְרוֹמֶטֶר|פְּסִיס|פְּסִיעָה|פְּסִיעַת|פָּסִיפְלוֹרָה|פְּסִיקָה|פֶּסֶל|פְּסֹלֶת|פְּסָמוֹפִיט|פְּסַנְתֵּר|פְסָנְתְּרָן|פַסְפוּס|פִסְפַסְתָּ|פְּסַק|פִּסְקָה|פַּסְקְוִיל|פַּסְקוֹל|פַּסְקָל|פְּסֹקֶת|פִּסַּת|פָּעוּט|פָּעוּר|פָּעִיל|פְּעִימָה|פְּעִימוֹת|פִּעֵל|פְּעֻלָּה|פְּעַלְתָּן|פַּעַם|פַּעֲמוֹן|פַּעֲמוֹנָה|פַּעֲמוֹנָר|פַּעֲמִי|פָּפָּיָה|פַּפִּיּוֹן|פָּפִּירוּס|פֶּפֶּרוֹנִי|פַּפְּרִיקָה|פָּצָה|פִּצּוּחַ|פִּצּוּי|פִּצוּל|פְּצוּעַ|פְּצִיעָה|פָצִיפִיזְם|פָּצִיפִיסְט|פְּצִירָה|פֶּצַע|פָּצָץ|פְּצָצָה|פְּצָצוֹת|פְּצָצַת|פְּקֻדָּה|פִּקָּדוֹן|פְּקֻדּוֹת|פִּקּוּד|פִּקּוּחַ|פָקוּלְטָה|פַּקָּח|פַקְטוֹ|פֶּקְטִין|פָּקִיד|פְּקִידָה|פְּקִימָה|פֶּקֶם|פֶּקָן|פַקְס|פְּקָעִית|פְּקַעַת|פָקָצָה|פְּקָק|פַּקֶּקֶת|פַּר|פֶּרֶא|פְּרָאוּ|פָּרָג|פָּרַגְוַאי|פַּרְגּוֹד|פַּרְגּוֹל|פִרְגּוּן|פַּרְגִּית|פְּרַגְמָטִיזְם|פְּרַגְמָטִיקָה|פֶּרֶד|פְּרֵדָה|פָּרָדוֹקְס|פָּרָדִיגְמָה|",
"פַּרְדֵּס|פַּרְדְּסָן|פַּרְדְּסָנוּת|פָּרָה|פַּרְהֶסְיָה|פֵּרוּ|פֶּרוּאָנִי|פְּרוֹבִּיּוֹטִיקָה|פְּרוֹבִיזוֹרִי|פְּרוֹגֶסְטֶרוֹן|פְּרוֹגְרֶסִיבִי|פָּרוֹדְיָה|פַּרְוֶה|פְּרוֹזְבּוּל|פְּרוֹזְדוֹר|פְּרוֹזָה|פְּרוֹטָגוֹנִיסְט|פְּרוּטָה|פְּרוֹטוֹזוֹאוֹלוֹגְיָה|פְּרוֹטוֹמָה|פְּרוֹטוֹן|פְּרוֹטוֹקוֹל|פְּרוֹטֶקְצְיָה|פְּרוֹיֶקְטוֹר|פְּרוֹלוֹג|פְּרוֹלֶטַרְיוֹן|פְּרוֹמֶתְיוּם|פַּרְוָן|פְּרוּנוּס|פְּרוֹסְפֶּקְט|פְּרוֹסְתֵטִית|פָּרוּף|פְּרוֹפָּגַנְדָּה|פְּרוֹפִיל|פְּרוֹפֶּלוֹר|פְּרוֹפְּרִיוֹסֵפְּצְיָה|פְּרוֹצֶדוּרָה|פְּרוֹצֶדוּרָלִי|פֵּרוּק|פְּרוֹקְלִיטִי|פֵּרוּרֵי|פָּרוּשׁ|פְּרוֹשׁוּטוֹ|פֵּרוֹת|פְּרוֹתֶזָה|פֵּרוֹתִי|פֵּרוֹתָנוּת|פְּרָזוֹן|פְּרָזוֹת|פָּרָזִיט|פָּרָזִיטוֹלוֹגְיָה|פְּרֵזֶנְטוֹר|פָּרַח|פְרֵחָה|פִּרְחוֹן|פִּרְחָח|פָּרְחֵי|פְּרָחִים|פְּרָט|פְּרָטִי|פְּרָטִיּוּת|פַּרְטִיזָן|פַּרְטִיטוּרָה|פְּרָטִית|פְּרִי|פְּרִיבָטִיר|פְּרִיבִילֶגְיָה|פְרִיגָטָה|פְרִיגִי|פֶּרִיהֶליוֹן|פְּרִיט|פְּרִיטָה|פְריטָּטָה|פָּרִיךְ|פְּרַיְם|פְּרִימָדוֹנָה|פְּרִימוּס|פְּרִימִיטִיבִי|פְּרִינְצִיפּ|פֶּרִיסְקוֹפּ|פְּרִיפָה|פֶּרִיפֶרְיָה|פָּרִיץ|פָּרִיק|פְרָיֶר|פִּרְכּוּס|פְּרָלִין|פַּרְלָמֶנְט|פֶּרְם|פָּרָמֶדִיק|פֶרְמְיוּם|פַרְמָקוֹלוֹגְיָה|פָרֶנְהַיְט|פָּרָנוֹאִיד|פָּרָנוֹיָה|פַּרְנָס|פַּרְנָסָה|פְרַנְצְיוּם|פְרַנְק|פָּרָס|פַּרְסָה|פֶּרְסוֹנִיפִיקַצְיָה|פֶּרְסוֹנָלִיזַצְיָה|פֶּרְסוֹנָלִית|פָּרְסִי|פַּרְסִית|פִּרְסֹמֶת|פֶּרְסְפֶּקְטִיבָה|פֶּרְפוּזְיָה|פָּרָפִין|פֶּרְפֶקְצְיוֹנִיזְם|פַּרְפַּר|פָּרַפְרָזָה|פַּרְפֶּרֶת|פֶּרֶץ|פַּרְצוּף|פַּרְצוּפוֹן|פַּרְצוּפִי|פַּרְצוּפִיּוּת|פַּרְצָן|פֶּרֶק|פֶּרְקוֹלָטוֹר|פְּרַקְטִי|פְרַקְטָל|פְּרַקְלִיט|פְּרַקְלִיטוּת|פְּרֵקַמְבְּרִיּוֹן|פֻּרְקָן|פֶּרֶשׁ|פָּרָשָׁה|פָּרָשִׁים|פַּרְשָׁנוּת|פָּרָשַׁת|פַּרְתָּם|פָּשׁוּט|פְּשׁוּטָה|פָּשׁוֹשׁ|פֶּשַׁח|פָּשַׁט|פַּשְׁטוּת|פַּשְׁטִידָה|פַּשְׁטָנוּת|פַשִׁיזְם|פְּשִׁיטָה|פְּשִׁיטַת|פְּשִׂיקָה|פַשְׁלָה|פֶּשַׁע|פִּשְׁפֵּשׁ|פֵּשֶׁר|",
"פַּשְׁרָן|פִּשְׁתָּה|פִּשְׁתִּים|פִּשְׁתָּן|פִּשְׁתָנִי|פַּת|פִּתְאֹם|פַּתְבַּג|פִּתְגָם|פִּתָּה|פָּתוּחַ|פְּתוּחָה|פְּתוּחִים|פִּתּוּל|פָּתוֹלוֹגִי|פָּתוֹלוֹגְיָה|פָּתּוֹס|פָּתוּר|פְּתוֹת|פֶּתַח|פִּתְחָה|פָּתֵטִי|פֶּתִי|פִּתִּיָּה|פִּתָּיוֹן|פְּתִיחָה|פְּתִיל|פְּתִילִיָּה|פְּתִיתוֹן|פְּתֵכָה|פֶּתַע|פִּתְפּוּתֵי|פֶּתֶק|פִּתְקָה|פִּתְרוֹן|פַּתְשֶׁגֶן|צַ'אוּ|צַ'בַּאטה|צֵ'ט|צִ'י|צִ'יזְבָּט|צִ'יט|צִ'ילֶה|צִ'ילִי|צִ'ינְצִ'ילָה|צִ'יפּ|צִ'יפְּס|צִ'יפְרֶחָה|צֶ'כְיָה|צֶ'כִית|צֶ'לוֹ|צֶ'מְבָּלוֹ|צֵ'ק|צַ'רְטֶר|צֵאָה|צֹאן|צֶאֱצָא|צָאר|צָב|צָבָא|צְבָאִי|צְבָאִית|צִבּוּר|צִבּוּרִי|צִבּוּרִית|צְבִי|צְבִיעָה|צְבִירָה|צֶבַע|צִבְעוֹנִי|צֹבֶר|צֶבֶת|צָג|צַד|צְדָדִית|צִדּוֹן|צַדִּיק|צֶדַע|צֶדֶף|צֶדֶק|צְדָקָה|צַדְקָן|צַדְקָנוּת|צַדֶּקֶת|צַדְרָה|צַהַ\"ל|צָהֹב|צְהַבְהַב|צָהֲבוּ|צְהֻבּוֹן|צְהֻבִּים|צַהֶבֶת|צַהֲלוּלִים|צֹהַר|צַהֲרוֹן|צָהֳרַיִם|צַו|צוֹאֶה|צַוַּאר|צַוָּארוֹ|צַוָּארוֹן|צוֹבֶּל|צִוּוּי|צוֹלֵב|צוֹלֶבֶת|צוֹלֵל|צוֹלְלוֹת|צוֹלְלָן|צוֹלֶלֶת|צוֹלֵעַ|צוֹם|צוֹמֵחַ|צוּמִי|צוּנָמִי|צוּף|צוֹפֶה|צוֹפִי|צוּפים|צוּפִית|צוֹפָר|צוֹק|צוֹר|צוֹרֵב|צוּרָה|צוּרוֹן|צוּרָן|צוּרָנִית|צוֹרֵף|צוֹרְרוּת|צוּרַת|צֶוֶת|צַוְתָא|צַוְתָּאוּת|צַח|צְחוֹק|צָחִיחַ|צַחֲנָה|צַחְצָחוֹת|צָחֹר|צִטּוּט|צִי|צִיאָנִידִי|צַיִד|צֵידָה|צַיֶּדֶת|צִיָּה|צִיּוּד|צִיוִילִיזַצְיָה|צִיּוֹן|צִיּוֹנוּת|צִיּוֹנִי|צִיּוּר|צִיּוּת|צִיטוֹלוֹגְיָה|צִיטוֹפְּלַזְמָה|צִיִּי|צִיִּים|צִיִּית|צִילִינְדֵּר|צַיְמָן|צִימֶר|צִינְגָּלֶה|צִינוֹק|צִינִי|צִינִיקָן|צִיסְטוֹסְקוֹפּ|צִיץ|צִיצִּיוֹתָיו|צִיצִית|צִיקְלוֹמֶטֶר|צִיקְלוֹן|צַיְקָן|צִיר|צֵירֶה|צִירוּת|צִיתָר|צֵל|צְלָב|צְלָבִי|צַלְבָן|צָלְבָנִית|צִלָּה|צָלוּב|צְלוֹחִית|צָלוּל|צֶלוּלִיט|צֶלוּלִיטִיס|צִלּוּם|צְלוֹפָח|צֶלוֹפָן|צַלַּחַת|צָלִי|צֶלְיָאק|צְלִיָּה|צְלִיחָה|צְלִיל|צְלִילָה|צַלְיָן|צְלִיפָה|צְלִיפַת|צְלָלִיּוֹת|צְלָלִים|צֶלֶם|צַלְמָוֶת|צַלְמִית|צַלְעִית|צָלָף|צַלָּפִים|צִלְצוּלִים|צִלְצָל|",
"צְלָצָלָן|צַלֶּקֶת|צָמָא|צִמָּאוֹן|צֶמֶד|צִמְדָּה|צַמָּה|צָמוּק|צֶמַח|צִמְחוֹנִי|צְמִיגוּת|צָמִיד|צֶמֶנְט|צִמְצוּם|צֶמֶר|צַמְרוֹן|צַמְרִירִי|צְמַרְמֹרֶת|צַמֶּרֶת|צֶמֶת|צֹנֶה|צְנוֹבָּר|צָנוּם|צְנוֹן|צְנוֹנִית|צִנוֹר|צִנּוֹרָה|צִנוֹרוֹת|צֶנְזוּרָה|צֶנְטְרִיפוּגָה|צְנִיחָה|צְנִים|צְנִיעוּת|צָנִיף|צְנִיר|צֶנַע|צִנְעָה|צַנְעַנִי|צְנָפָה|צִנְצֶנֶת|צִנְרוּר|צַנְרָן|צַנֶּרֶת|צִנְתּוּר|צַנְתָּר|צָעִיר|צְעִירָה|צַעֲצוּעַ|צַעַר|צָף|צַפֶּדֶת|צָפָה|צִפּוּי|צָפוֹן|צָפוּף|צִפּוֹר|צַפַּחַת|צִפִּיָּה|צַפִּיחִית|צְפִיפוּת|צָפִיר|צְפִירָה|צְפִירוֹר|צָפִית|צֶפֶּלִין|צֹפֶן|צָפְנַת|צַפְצָפָה|צְפַרְדֵּעַ|צַפָּרוּת|צַפְרִיר|צִפֹּרֶן|צִפָּרְנֵי|צִפֹּרֶת|צֶפֶת|צִקְלוֹן|צֹר|צֶרֶבֶּלוּם|צְרֵדָה|צֵרָה|צָרוּד|צְרוּכָה|צֵרוּפִים|צָרוּר|צָרוּת|צֳרִי|צְרִיבָה|צֶרְיוּם|צְרִיחַ|צְרִיחָה|צָרִיךְ|צְרִיף|צְרִיר|צׂרֶךְ|צָרְכֵי|צְרָכִים|צַרְכָן|צַרְכָנִיָּה|צֹרָן|צָרַעַת|צָרְפוֹקַאִי|צָרְפַת|צָרְפָתִי|צָרְפָתִית|צְרָצַר|קָאצְ'קֶע|קָאקָאפּוֹ|קָאָת|קַב|קֵבָה|קִבּוּל|קָבוּעַ|קְבוּעָה|קִבּוּץ|קְבוּצָה|קִבּוּצִי|קִבּוּצִית|קְבוּצַת|קְבוּצָתִי|קְבוּרָה|קֻבִּיָּה|קֻבִּיזְם|קַבִּינָה|קֻבִּיַּת|קֹבֶל|קַבָּלָה|קַבְּלָן|קֻבְלָנָה|קַבְּלָנוּת|קַבָּנוֹס|קֶבֶס|קִבֹּסֶת|קִבָּעוֹן|קֻבַּעַת|קֶבֶר|קְבָרוֹת|קַבְּרִיוֹלֶה|קַבְרָן|קִבֹּרֶת|קַבַּת|קִדָּה|קִדּוּחַ|קָדוּם|קְדוּמָה|קְדוֹרַנִּית|קָדוֹשׁ|קֶדַח|קַדַּחַת|קַדַּחְתָּנִי|קָדִים|קָדִימָה|קְדִימוֹן|קַדִּישׁ|קְדַל|קֶדֶם|קַדְמָה|קַדְמוֹן|קִדְמִי|קַדְמְיוּם|קִדְמִית|קִדֹּמֶת|קָדֶנְצְיָה|קָדְקוֹד|קְדֵרָה|קַדָּרוּת|קָדֵשׁ|קְדֻשָּׁה|קֵהֶה|קִהָיוֹן|קָהָל|קֹהֶלֶת|קַו|קוֹאוֹפֶּרָטִיב|קוֹאָלָה|קוֹאָלִיצְיָה|קוֹאֶנְזִים|קוּבָּה|קוֹבַּלְט|קוֹבְלָנָה|קוֹבֵץ|קוֹבְּרָה|קוֹג|קוּגֶל|קוֹגְנִיטִיבִי|קוֹגְנִיטִיבִית|קוֹד|קוֹדְמָן|קוֹדָן|קוֹדֶקְס|קְוַדְרִילְיוֹן|קְוַדְרִירֶמָה|קוֹהֶרֶנְטִי|קוֹהֶרֶנְטִיּוּת|קְווֹ|קוֹוָלֶנְטִי|קְוָזָר|קוּטֶר|קַוֵּי|קַוְיָאר|קְוִיטְל|קְוִינְטִילְיוֹן|קוֹישִׁיקְלָךְ|",
"קַוִּית|קוֹל|קוֹלָב|קוֹלֵגָה|קוֹלָה|קוֹלוֹן|קוֹלוֹנָה|קוֹלוֹנְיָה|קוֹלוֹפוֹן|קוֹלוֹרָטוּרָה|קוֹלְחוֹז|קוֹלְטָן|קוֹלִי|קוֹלִיטִיס|קוֹלִימָטוֹר|קוּלִינָרְיָה|קוֹלִיפוֹרְם|קוּלִית|קוֹלָן|קוֹלְנוֹעַ|קוֹלָנִי|קוֹלֶקְטִיב|קוֹלֶקְטִיבִי|קוֹלֶקְטִיבִיזְם|קוֹלַר|קוֹלְרָבִּי|קוֹמְבִּינָה|קוֹמְבִּינָטוֹר|קוֹמְבִּינָטוֹרִיקָה|קוֹמֶדְיָה|קוֹמָה|קוֹמוֹדוֹר|קוֹמוּנָה|קוֹמוּנִיקַצְיָה|קוֹמוּנָר|קוֹמוֹרְבִּידיוּת|קוּמְזִיץ|קוֹמִי|קוֹמִיסָר|קוֹמִיקַאי|קוֹמִיקְס|קוֹמִית|קוֹמְמִיּוּת|קוֹמַנְדֶר|קוֹמֶנְסָלִיזְם|קוֹמְפּוֹזִיצְיָה|קוֹמְפּוֹט|קוֹמְפּוֹסְט|קוֹמְפַּקְטִי|קוֹמָתִי|קַוָּן|קוֹנְבֶנְצְיָה|קוֹנְבֶנְצְיוֹנָלִי|קוּנְג|קוֹנְגְּלוֹמֶרָט|קוֹנְדּוֹם|קוֹנְדִיטוֹן|קוֹנְדִיטוֹר|קוֹנְדִילוֹמָה|קוֹנֶה|קַוְנוֹעַ|קְוַנְט|קוֹנְטֶינֶר|קְוַנְטִית|קוֹנְטֶמִינֶצְיָה|קוֹנְטְרָבָּס|קוֹנְטְרֵס|קוֹנְסוּל|קוֹנְסוֹלִידַצְיָה|קוֹנְסוּלְיָה|קוֹנְסוֹנַנְס|קוֹנְסִיסְטוֹרְיָה|קוֹנְסְפִּירַצְיָה|קוֹנְסֶפְּצְיָה|קוֹנְפֶדֶרַצְיָה|קוּנֵפָה|קוֹנְפוֹרְמִיּוּת|קוֹנְפוֹרְמִיסְט|קוֹנְפֶטִי|קוֹנְפְלִיקְט|קוּנְץ|קוֹנְצֶ'רְטוֹ|קוֹנְצֶנְזוּס|קוֹנְצֶרְן|קוֹנְקוֹרְדַּנְצְיָה|קוֹסוֹבוֹ|קוֹסִינוּס|קוֹסֵם|קוֹסְמוֹגוֹנְיָה|קוֹסְמוֹגְרַפְיָה|קוֹסְמוֹלוֹגְיָה|קוֹסמוֹס|קוֹסְמוֹפּוֹלִיטִיּוּת|קוֹסְמִית|קוּסְקוּס|קוֹסֶקַנְס|קוֹף|קוּפּוֹן|קוֹפִּי|קוּפִּידוֹן|קוֹפִיף|קוּפְסַת|קוֹץ|קְוֻצָּה|קוֹצוֹ|קוֹקָאִין|קוּקוּ|קוֹקוֹס|קוֹקָטִיל|קוּקִיָּה|קוֹקְסִינֶל|קוֹקְפִּיט|קְוָקֶר|קוֹר|קוֹרֵא|קוּרַאךְ|קוֹרְבֶטָה|קוֹרְבִּיטָה|קוֹרָה|קוֹרוֹזְיָה|קוֹרוֹת|קוּרֵי|קוּרְיוֹז|קוֹרְנְפְלוֹר|קוֹרְנְפְלֶקְס|קוּרְס|קוֹרְסָר|קוֹרֵעַ|קוֹרְפּוּס|קְוַרְץ|קְוַרְק|קוֹרֶקְט|קוֹרְקִינֵט|קוֹרָקְל|קוֹרַת|קוֹשֵׁר|קָזוֹאָר|קָזוּאָרִינָה|קָזוּס|קָזִינוֹ|קָזָנוֹבָה|קַח|קָט|קֹטֶב|קָטָבּוֹלִיזְם|קָטְבִּי|קָטְבִּיּוּת|קָטֵגוֹר|קָטֵגוֹרְיָה|קִטּוּב|קָטוּם|קֶטוֹן|קְטָטָה|קַטְיוֹן|קַטְיוּשָׁה|קָטִין|קְטִינָה|קָטִיף|קְטִיפָה|קֶטֶל|קָטָלִיזָטוֹר|קָטָלִיטִי|קָטָלָנִית|קָטָמָרָן|",
"קָטָן|קְטַנָּה|קְטָנִים|קִטְנִית|קַטַסְטְרוֹפָה|קַטַסְטְרוֹפִיזְם|קֶטַע|קְטָף|קַטַר|קַטְרֶגֶל|קְטֹרֶת|קֵטְשׁ|קֶטְשׁוֹפְּ|קֵי|קִיא|קָיָאק|קָיָאקִים|קִיבִּינִימָט|קִיבֶּרְנֶטִיקָה|קִיּוּט|קִיוִי|קִיּוֹסְק|קַיִט|קִיטְבֶּג|קִיטוֹן|קִיטוֹר|קַיְטָנָה|קִיטְשׁ|קִיטְשִׁי|קִיכְלִי|קִילוֹ|קִילוֹגְרָם|קִילוֹהֶרְץ|קִילוֹמֶטֶר|קִילוֹן|קִילוּסִין|קִילוֹקָלוֹרְיָה|קַיָּם|קִימוֹנוֹ|קַיָּן|קִינָה|קִינוֹף|קִינֶטִיקָה|קִינֶטִית|קִינֵמָטִיקָה|קֵיסָם|קֵיסָרִי|קַיִץ|קֵיצִי|קַיַק|קִיקָיוֹן|קִיקְלוֹפּ|קִיר|קִירוֹת|קִישׁ|קִישׁוֹטִיּוּת|קִיתוֹן|קַל|קְלָאוִיקוֹרְד|קְלָאסִית|קְלָאץ'|קָלָבּוּשׁ|קַלַּבָּסָה|קַלְגַּס|קַלְדָן|קַלָּה|קָלוּב|קְלוּבְקָרִין|קְלוּטָה|קָלוֹן|קָלוּעַ|קִלּוּף|קָלוֹרְיָה|קָלוֹרִימֶטְרִיָּה|קָלוּשׁ|קֶלַח|קַלַּחַת|קֶלֶט|קַלֶּטֶת|קָלִיבֵּר|קָלִיגְרָף|קָלִיגְרָפִי|קָלִיגְרַפְיָה|קְלִיד|קָלֵידוֹסְקוֹפּ|קְלִיָּה|קְלִיטִי|קַלִּים|קְלִימָטוֹלוֹגְיָה|קְלִינִי|קְלִינִיקָה|קְלִינִית|קָלִיעַ|קְלִיעָה|קְלִיעַת|קְלִיפָה|קָלִיפוֹרְנְיוּם|קְלִיפֶּר|קְלִיק|קְלִישָׁאָה|קְלָלָה|קַלְמִית|קְלֵמֶנְטִינָה|קַלְמָר|קָלֶנְדָּא|קַלְנוֹעִית|קֶלֶס|קַלָּסָה|קְלָסִית|קְלָסֶר|קְלַסְתֵּרוֹן|קֶלַע|קְלָף|קְלִפָּה|קְלַפְטֶה|קְלָפִים|קַלְפָן|קְלִפָּתוֹ|קַלְצִיט|קִלְקַל|קַלְקָלָה|קִלְשׁוֹן|קֶלֶת|קָם|קַמָּא|קֶמָארִי|קַמְבְּרִיּוֹן|קָמָה|קֶמַח|קַמְטָר|קָמִין|קְמִיצָה|קִמְעָה|קִמְעוֹנִי|קַמְפּוּס|קֶמְפִּינְג|קִמְפְּלוּקְס|קָמָץ|קַמְצוּץ|קַמְצָן|קַמְצָנוּת|קֻמְקוּם|קִמְרָה|קִמְרוֹן|קֵן|קַנָּא|קִנְאָה|קַנַּאי|קָנַבּוֹס|קֶנְגּוּרוּ|קָנָדָה|קֻנְדָּס|קָנֶה|קָנוּ|קְנוֹזוֹאִיקוֹן|קִנּוּחַ|קָנוּי|קָנוֹלָה|קָנוֹלִי|קְנוּנִיָה|קְנוֹקֶנֶת|קֶנְטָאוּר|קַנְטִינָה|קָנִיבָּל|קָנִיבָּלִיזְם|קְנֵידָלֶה|קַנְיוֹן|קָנִים|קִנָּמוֹן|קְנָס|קַנַפָּט|קַנְקַן|קַנְקַנּוֹ|קִנְרָס|קַסְבָּה|קַסְדָּה|קַסְוָה|קָסוּם|קִסּוֹס|קָסוֹקֶר|קָסֶטָה|קַסְיָה|קְסִילוֹפוֹן|קֶסֶם|קְסֶנוֹן|קְסֶנוֹפוֹבְּיָה|קְסֵסָה|קַסְקֶט|קְסַרְקָט|קְסַרְקְטִין|קֶסֶת|קְעוּרָה|",
"קַעֲרִית|קִפָּאוֹן|קֻפַּאי|קָפֶאִין|קֻפָּד|קְפָדָה|קָפֶה|קִפּוֹד|קִפּוּחַ|קָפּוּט|קָפּוֹטָה|קִפּוּל|קַפּוּצ'וֹן|קָפּוֹצִ'ינּוֹ|קֻפּוֹת|קִפֵּחַ|קֶפְּטֵן|קָפֵטֶרְיָה|קַפִּיבָּרָה|קַפִּיטָלִיזְם|קָפִּיטָלִיסְט|קַפִּיטָן|קְפִיץ|קְפִיצָה|קַפְלֵט|קָפָּנְדָּרִיָה|קֻפְסָה|קַפְּסוּלָה|קֻפְסַת|קָפַץ|קַפֶּצֶת|קַפְּרִיזָה|קַפְרִיסִין|קַפְּרִיצ'וֹ|קֶפֶשׁ|קֻפַּת|קֵץ|קֶצֶב|קָצֶה|קָצוּץ|קֶצַח|קָצִין|קְצִינִים|קְצִיף|קְצִיץ|קְצִיצָה|קָצִיר|קְצֻנָּה|קֶצֶף|קִצְפּוֹ|קַצֶּפֶת|קֶצֶץ|קָצָר|קְצַרְדָּשׁ|קְצָרָה|קְצַרְמָר|קַצְרָנוּת|קְצָת|קָקָאוֹ|קָקָדוּ|קַקְטוּס|קָקִי|קִקְיוֹנִי|קַר|קָרָא|קֻרְאָן|קֵרֵב|קִרבה|קִרְבּוֹ|קַרְבּוֹן|קַרְבּוֹנָט|קַרְבּוֹקְסִיל|קַרְבּוֹקְסִילִית|קַרְבּוּרָטוֹר|קְרָבִי|קָרְבָּן|קְרֶבְּס|קַרְדִּיגָן|קַרְדְּיוֹגְרָף|קַרְדְּיוֹלוֹגְיָה|קְרֶדִיט|קַרְדִּינָלִי|קַרְדִּית|קַרְדֹּם|קָרָה|קָרוֹב|קֵרוּד|קְרוּז|קָרוֹטֶנוֹאִיד|קָרוּי|קָרַוֶּל|קָרַוֶּלָה|קְרוּם|קָרוֹן|קְרוֹנוֹעַ|קְרוֹקוֹדִיל|קְרוֹקֶמְבּוּשׁ|קֵרוּר|קְרוּשָׁה|קֵרֵחַ|קַרְחוֹן|קַרְחוֹנִי|קָרָחָנָה|קָרַחַת|קָרָט|קֻרְטוֹב|קַרְטוֹגְרַפְיָה|קַרְטוֹן|קַרְטִיב|קְרֵטִיקוֹן|קַרְטֶל|קַרְטֶר|קֶרִי|קְרִיאָה|קְרִיאַת|קִרְיָה|קְרִיוֹבִּיּוֹלוֹגְיָה|קְרִיוֹנִיקָה|קְרִיּוֹפִיל|קַרְיוֹקִי|קְרִיזָה|קְרִיטִית|קַרְיָן|קְרִינָה|קְרִינַת|קְרִיסְטָל|קְרִיסְטָלוֹגְרַפְיָה|קְרִיפְּטוֹגְרַפְיָה|קְרִיפְּטוֹזוֹאוֹלוֹגְיָה|קְרִיפְּטוֹן|קְרִיצָה|קְרִישׁ|קִרְיַת|קְרֵם|קְרֶמְבּוֹ|קְרַמְבּוֹלָה|קֶרָמִיקָה|קֶרָמִית|קָרָמֶל|קֶרֶן|קַרְנְבָל|קַרְנוֹ|קַרְנוּן|קַרְנִיז|קַרְנִיזְם|קַרְנִיסְט|קַרְנִית|קַרְנָן|קַרְנַף|קֶרֶס|קַרְסֹל|קְרֶעפְּלַךְ|קְרֶפּ|קַרְפָּד|קַרְפִּיּוֹן|קַרְפָּצְ'יוֹ|קֶרֶץ|קֻרְצָה|קַרְצִיָּה|קֻרְקְבָן|קִרְקוּף|קִרְקוּר|קַרָקָל|קִרְקָס|קַרְקַע|קַרְקָעִית|קָרְקָר|קַרְקָשׁ|קֶרֶשׁ|קְרֵשֶׁנְדּוֹ|קֶרֶת|קַרְתָּנוּת|קַשׁ|קֶשֶׁב|קָשֶׁה|קִשּׁוּא|קַשְׂוָה|קָשׁוּט|קִשּׁוּי|קָשׁוּר|קָשׁוֹת|קָשְׁחָה|קֹשֶׁט|קֹשִׁי|קֻשְׁיָה|קַשְׁיוּת|קָשִׁיחַ|קְשִׁיחָה|",
"קָשִׁים|קַשְׁיָן|קְשִׁירָה|קָשִׁישׁ|קַשִּׁית|קָשְמִיר|קַשְׁקְשָׁן|קַשְׂקֶשֶׂת|קֶשֶׁר|קֶשֶׁת|קַשְׁתִּית|קַת|קַתֶּדְרָה|קַתֶּדְרָלָה|קָתוֹדָה|קָתוֹלִי|קָתֶקְסִיס|קָתַרְזִיס|רַאגוּ|רֵאָה|רְאוּבֵן|רַאֲוָה|רַאוּטֶר|רָאוּי|רֵאוֹת|רׂאִי|רְאָיָה|רֵאָיוֹן|רְאֵם|רַאס|רָאפּ|רֹאשׁ|רִאשׁוֹן|רִאשׁוֹנָה|רִאשׁוֹנִי|רִאשׁוֹנִים|רָאשֵׁי|רָאשִׁים|רֵאשִׁית|רׂאשָׁן|רֵאַת|רֹב|רַבָּא|רְבָבָה|רַבָּה|רִבּוֹא|רִבּוּד|רִבּוּי|רָבוּךְ|רֶבּוּס|רָבוּעַ|רִבּוּעִית|רִבּוּץ|רַבִּי|רְבִיָּה|רַבְיוֹלִי|רַבִּים|רְבִיעוֹן|רְבִיעִי|רִבִּית|רַבָּן|רַבֵּנוּ|רַבָּנִי|רֶבַע|רִבְעוֹן|רִבְקָה|רֶבֶרְס|רִבַּת|רַבְּתָא|רַבָּתִי|רָגָ'אל|רָגָ'ה|רֶגֶב|רִגוּל|רָגוּעַ|רֶגָטָה|רָגִיל|רְגִישׁוּת|רֶגֶל|רְגֵלָה|רַגְלִי|רַגְלָיו|רַגְלַיִם|רֶגֶם|רֶגֶן|רֶגַע|רֶגֶשׁ|רִגְשֶׁה|רַגֶּשֶׁת|רָדָאר|רְדֵדָה|רָדוּלָה|רָדוּם|רָדוֹן|רֶדוּקְצְיוֹנִיזְם|רַדְיָאלִי|רְדִיד|רַדְיוֹ|רַדְיוֹאַקְטִיבִי|רַדְיוֹאַקְטִיבִיּוּת|רַדְיוֹאַקְטִיבִית|רַדְיוֹבִּיוֹלוֹגְיָה|רַדְיוֹלוֹגְיָה|רַדְיוּם|רַדְיוּס|רַדְיוֹתֶרַפְּיָה|רַדְיָן|רָדִיקָל|רִדֵּף|רַהַב|רָהוּט|רַהַט|רִהֲטָא|רָהִיט|רוֹאֵה|רוֹבַאי|רוֹבֵה|רוֹבּוֹט|רוֹבּוֹטִי|רוּבָּל|רוֹגַטְקָה|רוֹדָן|רוֹדָנוּת|רוֹדֵף|רָוֶה|רוֹהֲטָה|רוֹזֶטָה|רֶוַח|רְוָחָה|רוּחוֹ|רוּחוֹת|רוּחָנִיּוּת|רוּחְנִיק|רוֹטוֹר|רוֹטוֹרִי|רְוָיָה|רוֹכֵל|רוֹכֵס|רוֹכְסָן|רוֹלֶטָה|רוֹלֶרְבְּלֶיְדְס|רוּם|רוֹמָא|רוֹמֵאוֹ|רוֹמָאִי|רוֹמְבּוֹהֶדְרוֹן|רוֹמִי|רוֹמָן|רוֹמַנְטִיקָה|רוֹמַנְטִית|רוֹמַנְיָה|רוֹמָנִית|רוֹסְטְבִּיף|רוּסִי|רוּסְיָה|רוּסִית|רוֹעֶה|רוֹפֵא|רוֹפֵס|רוֹצֵחַ|רַוָּק|רוֹקֶדֶת|רוֹקֵחַ|רוֹקְחוּת|רַוָּקִיָּה|רַוָּקִים|רוֹקֶנְרוֹל|רוֹשֵׁף|רוּת|רָז|רָזֶה|רֵזוֹלוּצְיָה|רָזוֹן|רֶזוֹנַנְס|רַחַב|רְחָבָה|רָחְבִִּי|רָחְבִּית|רְחוֹב|רִחוּף|רְחוֹפֶת|רָחוֹק|רֵחַיִם|רְחִימוּ|רָחֵל|רָחָם|רַחְמִי|רַחֲמִים|רַחְמָן|רַחֲמָנָא|רַחַף|רַחֶפֶת|רַחְצָה|רִחֵק|רַחַשׁ|רַחַת|רֹטֶב|רַטְבּוּבִי|רָטוּב|רְטוּבָה|רֶטוֹרִי|רֶטוֹרִיקָה|רֶטוֹרִית|רֶטֶט|רָטָטוּי|",
"רְטִיָּה|רֶטְרוֹאַקְטִיבִי|רֶטְרוֹגְרָדִית|רֶטְרוֹסְפֶּקְטִיבָה|רֶטְרִיבֶר|רִיבָה|רִיבּוֹזוֹם|רִיזוֹטוֹ|רֵיחַ|רֵיחָן|רֵיחָנִי|רִיטוּאָלִיזְם|רֵיְטִינְג|רִיכְטֶר|רִילוֹקֵישֶׁן|רִינְגְטוֹן|רִיס|רִיפוֹת|רִיצָה|רִיצִין|רִיק|רֵיקָה|רִיקוֹשֶׁט|רֵיקִים|רֵיקָם|רֵיקָן|רֵיקָנָא|רִיקְשָׁה|רִיר|רִיתְמִיקָה|רֹךְ|רֶכֶב|רַכָּבוֹת|רַכֶּבֶל|רַכֶּבֶת|רִכּוּז|רְכוּלָה|רְכוּשׁ|רֶכֶּז|רְכִיב|רַכִּיכָה|רָכִיל|רְכִילוּת|רָכִין|רְכִיסָה|רְכִישָׁה|רֶכֶס|רִכְסָה|רִכְסַת|רִכְפָּה|רַכְרוּכִי|רֶכֶשׁ|רֵלֵוַנְטִי|רָם|רָמָ\"ח|רַמְבּוּטָן|רָמָה|רִמּוֹן|רַמְזוֹר|רֹמַח|רֵמִיסְיָה|רֶמִיקְס|רַמָּךְ|רַמָּכִּי|רַמְפָּה|רֶמֶץ|רַמְקוֹל|רְמַשׁ|רַן|רִנָּה|רֶנְטְגֶּן|רֶנְיוּם|רֶנֶסַנְס|רַסַּה|רִסּוּן|רֶסִיבֶר|רְסִיס|רֶסֶן|רֶסֶק|רָע|רָעֵב|רְעַבְתָּנוּת|רָעָה|רָעוּל|רָעוּעַ|רֵעוּת|רְעִי|רְעִידַת|רַעַל|רְעָלָה|רַעֲלָן|רַעֲנָן|רַעֲנָנָה|רַעַשׁ|רַף|רְפָאִים|רָפֶה|רְפוּאָה|רְפוּאִי|רְפוּאִית|רְפוּאַת|רֶפּוּבְּלִיקָה|רֶפּוּבְּלִיקַת|רִפּוּד|רִפּוּי|רֶפוֹרְמָה|רַפְטִינְג|רְפִידָה|רִפְיוֹן|רֶפְּלִיקָה|רֶפְּלִיקַצְיָה|רֶפְלֶקְס|רֶפְלֶקְסוֹלוֹג|רֶפְלֶקְסוֹלוֹגְיָה|רַפְסְדָן|רַפְסֹדֶת|רַפְסוֹדָאי|רַפְסוֹדַת|רֶפֶּרְטוּאָר|רַפְרָף|רַפְרֶפֶת|רֶפֶת|רַפְתָּן|רָצֶ'ט|רָצוּי|רָצוֹן|רְצוּעַת|רָצוּף|רָצוּץ|רֶצַח|רֶצִידִיוִיזְם|רַצְיוֹנָלִי|רַצְיוֹנָלִיזְם|רְצִינוּת|רְצִינִי|רָצִיף|רְצִיפָה|רֶצֶף|רִצְפָּה|רׂק|רָקָב|רַקְבּוּבִית|רִקָּבוֹן|רַקְדָן|רַקָּה|רִקּוּד|רֶקְוִיאֶם|רִקּוּן|רִקּוּעַ|רֶקוּרְסִיבִי|רֵקוּרְסִיָּה|רָקֶטָה|רֶקְטוֹר|רָקֶטוֹת|רָקִיק|רִקְמָה|רִקְמַת|רֶקַע|רַקֶּפֶת|רְקָק|רֵשׁ|רִשּׁוּי|רָשׁוּם|רְשׁוּמָה|רָשׁוּת|רִשְׁיוֹן|רְשִׁימַת|רַשְׁלָנוּת|רֹשֶׁם|רִשְׁמִי|רִשְׁמִית|רְשַׁמְקוֹל|רֶשַׁע|רֶשֶׁף|רֶשֶׁת|רִשְׁתִּית|רְתוּקוֹת|רְתִיקָה|רַתָּךְ|רָתַם|רֶתֶק|שְׁאָבָק|שָׁאוּל|שְׁאוּלָה|שָׁאוֹן|שְׂאוֹר|שְׁאָט|שְׁאִיבָה|שְׁאִילָה|שְׁאִילַת|שְׁאֵלָה|שְׁאֵלוֹן|שְׁאֵלַת|שַׁאֲנָן|שַׁאֲנַנּוּת|שַׁאְפָה|שָׁאפּוֹ|שְׁאַפְתָּן|שְׁאֵר|שְׁאֵרִים|",
"שְׂאֵת|שָׁב|שְׁבָב|שְׁבָבִית|שַׁבַּבְּנִיק|שָׁבוּ\"ז|שִׁבּוּט|שְׁבוּיִים|שָׁבוּעַ|שְׁבוּעָה|שָׁבוּעוֹת|שְׁבוּעַת|שָׁבוּר|שְׁבוּת|שֶׁבַח|שֵׁבֶט|שֶׁבִי|שְׁבִיזוּת|שָׁבִיט|שְׁבִיל|שָׁבִיס|שְׁבִיעִיסְט|שְׁבִיעִית|שָׁבִיר|שְׁבִירַת|שְׁבִיתָה|שְׁבִיתַת|שְׂבָכָה|שֶׁבַּכֶּתֶר|שֹׁבֶל|שַׁבְּלוּל|שַׁבְּלוֹנָה|שִׁבֹּלֶת|שֶׁבַע|שִׁבְעִים|שִׁבְעַת|שָׁבָץ|שָׁבַר|שַׁבְרִירִי|שַׁבְשַׁבִּים|שַׁבְשֶׁבֶת|שֶׁבִּשְׁתִיקָה|שֶׁבֶת|שַׁבְּתַאי|שָׁגוּר|שַׂגִּיא|שְׁגִיאָה|שְׁגִיאוֹת|שְׁגִיאַת|שִׁגָּיוֹן|שֵׁגָל|שֶׁגֶם|שֶׁגֶר|שִׁגְרָה|שַׁגְרִיר|שַׁגְרִירוּת|שַׁד|שָׂדָאוּת|שָׂדֶה|שֶדוֹגְרַפְיָה|שִׁדּוּד|שִׁדּוּךְ|שָׁדוּף|שִׁדּוּר|שַׁדְכָן|שַׁדְכָנוּת|שְׁדֻלָּה|שְׁדֵמָה|שִׁדָּפוֹן|שֶׁדֶר|שְׂדֵרָה|שִׁדְרוֹן|שִׁדְרִית|שִׁדְרָן|שֶׂה|שִׁהוּק|שֶׁהִי|שָׁהִיד|שְׁהִיָּה|שֹׁהַם|שׂוֹא|שׁוֹאֵב|שׁוֹאֶבֶת|שׁוֹאָה|שׁוּאַרְמָה|שׁוּב|שׁוֹבָב|שׁוֹבֶה|שׁוֹבִינִיזְם|שׁוֹבִינִיסְט|שׁוֹבָךְ|שׁוֹבָר|שׁוֹבֶרֶת|שׁוֹדֵד|שׁוֹדְדֵי|שְׁוֶדִי|שְׁוֶדִית|שָׁוָה|שׁוואַרְצֵע|שִׁוּוּי|שְׁווּנְג|שׁווֹנְץ|שִׁוּוּק|שׁוּחָה|שֹוֹחֵק|שׁוֹחֵר|שׁוֹט|שׁוֹטֶה|שׁוֹטוֹן|שׁוֹטֵטָה|שׁוֹטֶטֶת|שׁוֹטֵף|שׁוֹטֵר|שְׁוִיץ|שְׁוִיצֶר|שׁוּל|שׁוֹלֵה|שׁוּלִי|שׁוּלְיָה|שׁוּלַיִם|שׁוּלְיַת|שׁוֹלָל|שׁוֹלַת|שׁוּם|שׁוּמָה|שׁוֹמְטָן|שׁוֹמֶטֶת|שׁוֹמֵר|שׁוֹמְרוֹנִי|שׁוֹמְרָן|שׁוֹנֶה|שׁוֹנוֹת|שׁוּנְרָא|שׁוּעַ|שׁוֹפֵט|שׁוֹפִין|שׁוֹפִּינְג|שׁוֹפָר|שׁוֹק|שׁוֹקוֹ|שׁוֹקוֹלָד|שׁוֹקוֹלָטַה|שׁוֹקֵט|שׁוֹקַיִם|שׁוֹקֶר|שׁוֹר|שׁוּרָה|שׁוּרוּק|שׁוּשׁ|שׁוּשְׁבִין|שׁוֹשֶׁלֶת|שׁוֹשָׁן|שׁוֹשַׁנָּה|שׁוֹשַׁנַּת|שְׁוַת|שׁוֹתֶקֶת|שִׁזּוּף|שָׁזוּר|שְׁזִיף|שְׁזִירָה|שְׁזִירוּת|שֹׁזֶף|שַׁח|שֹׁחַד|שָׁחוּז|שָׁחוּם|שָׁחוּן|שִׂחוּק|שְׁחוֹר|שְׁחוֹרְדִּינִית|שֶׁחִי|שְׂחִיָּה|שָׁחִיל|שְׁחִין|שְׁחִיקָה|שְׁחִיתוּת|שַׁחַל|שַׁחֲלָה|שְׁחֵלֶת|שַׁחְמָט|שַׁחְמְטַאי|שַׁחַף|שַׁחַץ|שַׁחְצָן|שַׁחַק|שַׂחְקָן|שַׁחַר|שְׁחֹרָה|שַׁחְרוּר|שַׁחֲרוּת|שְׁחַרְחַר|שַׁחֲרִית|שַׁחַת|שָׁט|שִׁטָּה|שָׁטוּחַ|שְׁטוּחָה|שְׁטוּחַת|",
"שִׁטּוּר|שְׁטוּת|שֶׁטַח|שְׁטֶטְל|שְׁטִיבְּל|שִׁטָּיוֹן|שְׁטִיחָה|שְׁטִיחוֹן|שְׁטִיל|שְׁטִיפַת|שְׁטִיק|שָׂטָן|שִׂטְנָה|שַׁטֶנִי|שֶׁטֶף|שִׁטָּפוֹן|שְׁטָר|שְׁטְרוּדֶל|שְׁטָרוֹת|שְׁטְרַיְמְל|שַׁי|שִׁי\"ן|שִׂיא|שֵׁיב|שֵׂיבָה|שִׁיבֶּר|שֶׁיְּבֻשָּׂם|שִֹיג|שֵׁיגֶץ|שִׂידּוּד|שִׁיוּט|שִׂיחַ|שִׂיחָה|שִׂיחוּחַ|שַׁיִט|שִׁיטָה|שַׁיֶּטֶת|שִׁיטָתִי|שֵׁיךְ|שִׁימְפַּנְזֶה|שִינְקֵן|שִׁיפָה|שִׁיפוֹן|שֶׁיֵּצֵא|שִׁיק|שִׁיר|שִׁירָה|שַׁיִשׁ|שִׂישׂוּ|שַׁיִת|שֵׂךְ|שֶׁכֶב|שִׁכְבָה|שִׁכְבַת|שִׂכּוּל|שָׁכוּן|שְׁכוּנָה|שִׁכּוֹר|שִׁכְחָה|שְׁכִיב|שְׁכִיבַת|שְׂכִיָּה|שָׁכִיחַ|שָׂכִיר|שְׂכִירוּת|שֶׁכֻּלָּהּ|שִׁכְלוּל|שִֹכְלִי|שִׂכְלִית|שֶׁכֶם|שִׁכְמָה|שִׁכְמִיָּה|שָׁכֵן|שֵׁכָר|שְׂכָרוֹ|שֶׁל|שֶׁלֹּא|שַׁלְאֲנַן|שַׁלְבֶּקֶת|שֶׁלֶג|שִׁלְגּוֹן|שֶׁלֶד|שַׁלְדָּג|שִׁלְהוּב|שְׂלָו|שָׁלוּג|שְׁלוּגִית|שַׁלְוָה|שְׁלוּחָה|שְׁלוֹךְ|שְׁלוּלִית|שָׁלוֹם|שְׁלוֹמוּת|שְׁלוּמִיאֵל|שָׁלוּק|שְׁלוּקָה|שָׁלוֹשׁ|שְׁלוֹשַׁעַר|שֶׁלָח|שְׁלָחִים|שֻׁלְחָן|שֻׁלְחָנִי|שֶׁלֶט|שִׁלְטוֹן|שִׁלְטוֹנִית|שׁלִיבָה|שִׁלְיָה|שָׁלִיחַ|שְׁלִיכְט|שְׁלִילָה|שְׁלִילִי|שְׁלִילִיּוּת|שְׁלִימַזְל|שְׁלִיף|שְׁלִיקָה|שָׁלִישׁ|שְלִישוֹן|שְׁלִישִׁי|שְׁלִישִׁיָּה|שָׁלָךְ|שַׁלֶּכֶת|שָׁלָל|שָׁלֵם|שְׁלֹמֹה|שַׁלְמוֹנִים|שְׁלָמִים|שַׁלְפּוּחִית|שֶׁלֶק|שִׁלֵּשׁ|שְׁלֹשָׁה|שִׁלְשׁוּל|שִׁלְשׁוֹם|שַׁלְשְׁלָאוֹת|שֵׁם|שֶׁמָּא|שַׁמַּאי|שְׂמֹאל|שְׂמָאלִי|שְׂמֹאלָן|שְׁמָאלְץ|שְׁמָד|שָׁמָּה|שְּׁמוֹ|שְׁמוּם|שְׁמוֹנָה|שִׁמּוּעַ|שְׁמוֹק|שָׁמוּר|שְׁמוּרָה|שִׁמּוּרִים|שִׁמּוּשׁ|שִׁמּוּשִׁית|שְׁמוֹת|שָׂמֵחַ|שִׂמְחָה|שִׂמְחָתֵנוּ|שְׁמִטָּה|שְׂמִיכָה|שָׁמַיִם|שְׁמֵימִי|שְׁמִינִי|שְׁמִינִיָּה|שְׁמִינִיּוֹת|שְׁמִינִיסְט|שְׁמִינִית|שְׁמִיעָה|שָׁמִיר|שְׁמִירָה|שִׂמְלָה|שִׂמְלַת|שָׁמֵם|שְׁמָמָה|שִׁמָּמוֹן|שְׂמָמִית|שָׁמֵן|שְׁמֶנְדְרִיק|שַׁמֶּנֶת|שֵׁמַע|שִׁמְעוֹן|שַׁמְפּוּ|שַׁמְפַּנְיָה|שֶׁמֶץ|שִׁמְצָה|שָׁמַר|שְׁמַרְחֹם|שְׁמִרְטוּף|שְׁמַרְטַף|שְׁמָרָיו|שְׁמָרִים|שֶׁמֶשׁ|שִׁמְשָׁה|",
"שִׁמְשׁוֹן|שִׁמְשִׁיָּה|שֻׁמְשְׁמִין|שֵׁן|שִׂנְאָה|שִׁנְאָן|שִׂנְאַת|שָׁנָה|שֶׁנְהָב|שָׁנוּי|שָׁנוּן|שְׁנוֹרְקֶל|שְׁנוֹרֶר|שֹׁנִי|שְׁנִיָּה|שְׁנִיט|שָׁנִים|שְׁנִיצֶל|שָׁנִית|שִׁנֵּס|שַׁנְסוֹן|שֶׁנֶף|שֶׁנֶק|שְׁנֶקֶל|שֻׁנָּר|שְׁנַת|שְׁנָתִית|שָׁסוּעַ|שְׁסוּעָה|שַׁסַּעַת|שֶׁסֶק|שַׁסְתוֹם|שָׁעָה|שִׁעוּל|שָׁעוֹן|שַׁעֲוָנִית|שִׂעוּר|שִׁעַטְנוּז|שַׁעַטְנֵז|שֵׂעִיר|שַׁעַל|שַׁעַם|שֵׂעָר|שַׁעֲשׁוּעוֹן|שַׁעֲשׁוּעִים|שְׁעַת|שֵׁף|שְׁפָּגָט|שָׂפָה|שָׁפוּט|שָׁפוּי|שִׁפּוּלַיִם|שְׁפוּעַת|שְׁפוֹפֶרֶת|שִׁפּוּצְנִיק|שִׁפְחָה|שֶׁפִי|שָׁפִיט|שְׁפִיךְ|שְׁפִיכָה|שְפִיפוֹן|שְׁפִּיץ|שָׁפִיר|שַׁפִּירִים|שַׁפִּירִית|שְׁפִיתָה|שֶׁפֶךְ|שָׁפְכָה|שְׁפִּכְטוּל|שְׁפַּכְטֶל|שְׁפַל|שִׁפְלוּת|שָׂפָם|שְׂפַמְנוּן|שָׁפָן|שְׁפַנְפַּן|שֹׁפַע|שִׁפְעוּל|שַׁפַּעַת|שִׁפְצוּר|שֶׂפֶק|שִׁפְרָה|שְׁפְּרִיץ|שַׁפְרִיר|שָׁפַת|שְׂפָתוֹן|שְׂפָתָיו|שְׂפָתַיִם|שַׂק|שָׁקֵד|שְׁקֵדִיָּה|שִׁקּוּי|שָׁקוּל|שְׁקוּעַת|שָׁקוּף|שְׁקוּפִית|שֶׁקֶט|שְׁקִיטָן|שְׁקִיעָה|שְׁקִיעַת|שַׂקִּית|שָׁקֶל|שִׁקְמָה|שַׂקְנַאי|שֹׁקַע|שְׁקַעֲרוּרִי|שֶׁקֶף|שְׁקָפִים|שֶׁקֶץ|שֶׁקֶר|שַׁקְשׁוּקָה|שֹׁקֶת|שַׂר|שָׁרָב|שִׁרְבּוט|שַׁרְבִיט|שְׁרַבְרַב|שְׁרַבְרָבוּת|שִׁרְגּוּן|שְׂרָד|שָׂרָה|שַׁרְווּל|שָׂרוּךְ|שָׁרוֹן|שֵׁרוּת|שֵׁרוּתִים|שִׂרְטוֹן|שֶׁרִי|שָֹרִיג|שָׂרִיד|שְׂרָיָה|שִׁרְיוֹן|שְׂרִיטָה|שְׁרִיקָה|שָׁרִיר|שְׁרִירוּת|שָׁרָךְ|שַׁרְלָטָן|שַׁרְלִילָה|שַׁרְמוּטָה|שַׂרְעָף|שָׂרָף|שְׂרֵפָה|שְׁרַפְּנֶל|שְׁרַפְרַף|שֶׁרֶץ|שְׁרָצִים|שְֹרָק|שֹׁרֶר|שֹׁרֶשׁ|שַׁרְשָׁה|שִׁרְשׁוּר|שַׁרְשֶׁרֶת|שָׁרֵת|שֵׁשׁ|שֶׁשָּׁבַר|שָׂשׂוֹן|שִׁשִּׁי|שִׁשִּׁים|שִׁשִּׁיסְט|שִׁשִּׁית|שָׁשַׁר|שִׁת|שִׁתּוּךְ|שָׁתוּל|שִׁתּוּפִי|שָׁתוּק|שְׁתִי|שְׁתִיָּה|שְׁתִיל|שִׁתִּין|שְׁתִיקָה|שֶׁתֶל|שֶׁתֶן|שֻׁתָּף|שֶׁתֶק|שַׁתֶּקֶת|תָּא|תֵּאָבוֹן|תַּאֲגִיד|תְּאוֹ|תֵּאוּם|תְּאוֹמִים|תְּאוּנָה|תְּאוּנַת|תֵּאוֹפוֹרִי|תְּאוּצָה|תֵּאוֹצֶנְטְרִיזְם|תֶּאוֹצֶנְטְרִיצִיזְם|תֵּאוֹקְרַטְיָה|תֵּאוּר|תְּאוּרָה|תֵּאוֹרֵטִי|",
"תֵּאוֹרֶטִית|תֵּאוּרִי|תַּאֲוָתוֹ|תֵּאַטְרוֹן|תֵּאִיזְם|תָּאִים|תָּאִית|תֹּאַם|תְּאֵנָה|תְּאֵנַת|תֹּאַר|תַּאֲרִיךְ|תֵּבָה|תַּבְהֵלָה|תְּבוּאָה|תִּבּוּל|תְּבוּנָה|תְּבוּסָה|תֵּבוֹת|תְּבִיעָה|תֶּבֶל|תְּבַלּוּל|תַּבְלִיט|תַּבְלִין|תֶּבֶן|תַּבְנִית|תָּבַע|תַּבְעֵרָה|תַּבְרוּאָה|תַּבְרוּאָן|תַּבְשִׁיל|תֵּבַת|תָּג|תִּגְבֹּרֶת|תְּגוּבָה|תְּגוּבִית|תְּגוּבַת|תִּגְלַחַת|תַּגְמוּל|תִּגָּר|תִּגְרָה|תַּגְרָן|תַּדְהֵמָה|תְּדִירוּת|תִּדְלוּק|תַּדְמִית|תֶּה|תָּהָה|תֹּהוּ|תְּהוֹם|תָּהָלָה|תַּהֲלוּכָה|תַּהֲלִיךְ|תְּהִלִּים|תָּו|תּוֹאֲנָה|תּוֹבָלָה|תּוֹבָנָה|תּוּגָה|תּוֹדָה|תִּוּוּך|תּוֹחֶלֶת|תּוֹךְ|תּוֹכוֹ|תַּוְכָן|תּוּלְיוּם|תוֹלָל|תּוֹלַעַת|תּוֹם|תּוֹמֵךְ|תּוֹסָף|תּוֹסֶפֶת|תּוֹסֶפְתָּא|תּוֹסֶפְתָּן|תּוֹעֵבָה|תּוֹעֶלֶת|תּוֹעַלְתָּנוּת|תּוּפִין|תּוֹפֶסֶת|תּוֹפָעָה|תּוֹפָעַת|תּוֹפֵר|תּוֹפֵשׂ|תּוֹצָא|תּוֹצִיאוּ|תּוֹצֶרֶת|תּוֹר|תּוֹרָה|תּוֹרְיוּם|תּוֹרָן|תּוֹרָנִי|תּוּרַק|תּוֹרָשָׁה|תּוֹרַשְׁתִּי|תּוֹרַת|תּוֹרַתוֹ|תּוֹשָׁב|תּוֹשֶׁבֶת|תּוּשִׁיָּה|תּוּת|תּוֹתָב|תּוֹתָחִ|תּוֹתָחִים|תּוֹתְחָן|תּוֹתְחָנִית|תֵזָאוּרוּס|תֶּזָה|תְּזוּנָתִי|תִּזְמֹרֶת|תִּזְעַק|תַּחְבּוּלָה|תַּחְבּוּרָה|תַּחְבִּיב|תַּחְבִּיר|תַּחְדִּישׁ|תִּחוּל|תָּחוּם|תְּחוּקָה|תְּחוּשָׁה|תַּחְזוּקָה|תַּחְזוּקָתִיוּת|תֶּחֱזַקְנָה|תְּחִיַּת|תִּחְכּוּם|תְּחִלָּה|תַּחְלוּאָה|תַּחֲלוּפָה|תַּחְלִיף|תַּחְמָן|תַּחְמָס|תַּחֲמֹצֶת|תַּחֲמֹשֶׁת|תַּחֲנָה|תַּחֲנוּן|תַּחֲנַת|תַּחְפִּיף|תַּחְפֹּשֶׂת|תַּחֲרָה|תַּחֲרוּת|תַּחֲרוּתִי|תַּחַשׁ|תַּחַת|תַּחְתוֹן|תַּחְתוֹנָה|תַּחְתּוֹנִיּוֹת|תַּחְתּוֹנִים|תַּחְתִי|תַּחְתִית|תְּטוּלָה|תִּיכוֹן|תִּימָרָה|תִּינוֹק|תִּינוֹקוֹת|תִּינֹקֶת|תִּיק|תֵּיקוּ|תִּיקָן|תִּירוֹשׁ|תַּיָּרוּת|תִּירָס|תַּיִשׁ|תַּיְשָׁנִי|תִּיתוֹרָה|תְּכוּנָה|תֻּכִּי|תְּכָכִים|תָּכֹל|תַּכְלִיל|תַּכְלִית|תַּכְלֶס|תְּכֵלֶת|תֹּכֶן|תָּכְנָה|תִּכְנוּת|תָּכְנִית|תַּכְסִיס|תַּכְסִית|תַּכְרִיךְ|תַּכְשִׁיט|תַּכְשִׁיטָן|תֵּל|תְּלָאָה|תִּלְבֹּשֶׁת|",
"תָּלָה|תָּלוּי|תְלוּיָה|תָּלוּל|תְּלוּשׁ|תְּלוּת|תֶּלִי|תָּלִידוֹמִיד|תְּלִיָּה|תַּלְיוּם|תִּלְיוֹן|תֶּלֶם|תַּלְמוּד|תַּלְמַי|תַּלְמִיד|תְּלָת|תַּלְתַּל|תִּלְתָּן|תֹּם|תָּמָ\"ג|תֶּמֶד|תַּמָּה|תַּמְהִיל|תַּמּוּז|תְּמוּנָה|תּמוּנַת|תְּמוּרָה|תְּמוּתָה|תַּמְחוּי|תָּמִיד|תְּמִידִית|תְּמִיכָה|תָּמִים|תְּמִימוּת|תָּמִיר|תַּמְלוּג|תִּמְלַחַת|תַּמְלִיא|תַּמְלִיל|תַּמְלִילָן|תְּמָנוּן|תְּמָנִיּוֹן|תֶמֶס|תְּמִסָּה|תִּמְסָח|תִּמְסֹרֶת|תַּמְצִית|תֹּמֶר|תִּמְרוּן|תַּמְרוּק|תַּמְרוּר|תַּמְרוּרִים|תַּן|תָּנָ\"ךְ|תַּנָּא|תְּנַאי|תְּנוּאָה|תְּנוּבָה|תְּנוּדוֹת|תְּנוּךְ|תְּנוּעָה|תְּנוּעַת|תְּנוּעָתִי|תְּנוּפָה|תַּנּוּר|תַּנִּין|תִּנְיָנִי|תִּנְשֶׁמֶת|תַּסְבִּיךְ|תְּסִיסָה|תְּסִיסָנִית|תִּסְכּוּל|תַּסְמִין|תִּסְמֹנֶת|תִּסְפֹּרֶת|תַּסְרִיטַאי|תִּסְרֹקֶת|תַּעֲבוּרָה|תִּעוּד|תְּעוּדָה|תְּעוּדַת|תְּעוּפָה|תְּעוּקַת|תְּעָלָה|תַּעֲלוּמָה|תְּעָלוֹת|תְּעָלַת|תַּעֲמוּלָה|תַּעֲנוּגוּת|תַּעֲנִית|תַּעֲצוּמוֹת|תַּעַר|תַּעֲרֹבֶת|תַּעֲרִיף|תַּעֲשִׂיָּה|תַּעֲשִׂיָּתִי|תַּעְתִּיק|תֹּף|תַּפְאוּרָה|תִּפְאֶרֶת|תְּפוּגָה|תַּפּוּז|תַּפּוּחַ|תְּפוּסָה|תִּפּוּף|תְּפוּצָה|תִּפְזֹרֶת|תַּפְטִיר|תֻּפִּי|תֻּפִּים|תְּפִירָה|תָּפֵל|תְּפִלָּה|תַּפְלִיט|תְּפִלִּין|תְּפִלַּת|תַּפְנוּק|תָּפַס|תַּפְקִיד|תֶּפֶר|תִּפְרַחַת|תַּפְרִיט|תַפְרָן|תִּפְרֹשֶׂת|תֹּפֶת|תַּצְבִּית|תַּצְהִיר|תְּצוּרָה|תַּצְלִיל|תַּצְרֵף|תַּקְבִּילִית|תִּקְבֹּלֶת|תַּקְדִּים|תִּקְוָה|תְּקוּמָה|תִּקּוּן|תִּקוּנִים|תְּקוּפָה|תְּקוּפַת|תְּקוּרָה|תִּקְוָתוֹ|תַּקִּין|תְּקִינוּת|תְּקִיעַ|תַּקִּיף|תְּקִיפָה|תַּקְלֵדָה|תַּקָּלָה|תַּקְלִיט|תַּקְלִיטוֹן|תַּקְלִיטוֹנִים|תַּקְלִיטוֹר|תַּקְלִיטוֹרִים|תַּקְלִיטָן|תֶּקֶן|תַּקָּנָה|תָּקַע|תֹּקֶף|תַּקְצִיב|תֶּקֶר|תַּקְרִיב|תַּקְרִישׁ|תַּקְרִית|תִּקְשֹׁרֶת|תִִּקְתָּק|תַּרְבּוּת|תַּרְבִּית|תַּרְגּוּם|תַּרְגִּיל|תַּרְגִימָה|תֻּרְגְּמָן|תֶּרֶד|תַּרְדֵּמָה|תַּרְדֵּמַת|תַּרְוָד|תְּרוּמָה|תְּרוּמִיָּה|תְּרוּמַת|תְּרוּעָה|",
"תְּרוּפָה|תֶּרוֹפִיט|תְּרוּפַת|תֵּרוּץ|תִּרְזָה|תַּרְטִיט|תְּרֵי|תְּרִיס|תְּרֵיסָר|תְּרֵיסָרוֹן|תְּרֵיסַרְיוֹן|תִּרְכֹּבֶת|תַּרְכִּיז|תֶּרְמוֹגְרָוִימֶטְרִית|תֶּרְמוֹגְרָף|תֶּרְמוֹגְרַפְיָה|תֶּרְמוֹדִינָמִיקָה|תֶּרְמוֹמֶטֶר|תֶּרְמוֹס|תֶּרְמוֹסְטָט|תֶּרְמוֹסְקוֹפּ|תֶּרְמוֹפִיל|תֶּרְמוֹתֶּרַפְּיָה|תֶּרְמִי|תֶּרְמִידוֹר|תַּרְמִיל|תַּרְמִילָאוּת|תַּרְמִילַאי|תֶּרְמִיקָה|תֹּרֶן|תַּרְנְגוֹל|תַּרְנְגֹלֶת|תְּרֻנָּה|תָּרְנִי|תַּרְעֵלָה|תֹּרֶף|תֶּרָפּוֹיְטִי|תָּרָפָּפּ\"וּ|תִּרצוּ|תַּרְשִׁים|תַּרְשִׁישׁ|תַּרְתֵּי|תַּרְתָּן|תִּשְׁאוּל|תַּשְׁבֵּץ|תִּשְׁבֹּרֶת|תַּשְׁדִּיר|תְּשׂוּאָה|תְּשׁוּבָה|תְּשֹוּמָה|תְּשׁוּקָה|תְּשׁוּרָה|תָּשׁוּשׁ|תִּשְׁחֹרֶת|תְּשִׁיעוֹן|תַּשְׁלוּם|תַּשְׁלִיכֵנִי|תַּשְׁמִישׁ|תַּשְׁמִישֵׁי|תִּשְׁעָה|תִּשְׁקֹרֶת|תֶּשֶׁר|תַּת|תִּתְמֹכֶת|תִּתֵּן|תַּתְרָן"
].join("");

/* Fälle, in denen die volle Schreibung von der punktierten abweicht
   (אידיאל gegenüber אִידֵאָל); Format Schlüssel=punktierte Form. */
HT.DIC.exc = [
"אבריו=אֵיבָרָיו|אווירני=אֲוִירָנִי|אוקינוגרפיה=אוֹקְיָאנוֹגְרַפְיָה|אידיאל=אִידֵאָל|אידיות=אֵדִיּוּת|אינדיאנה=אִינְדִּיַּנָה|איקרה=אִקְרָה|אירוסין=אֵרוּסִין|אפל=הָאֹפֶל|ביורוקרטיה=בִּירוֹקְרַטִיָּה|ביטחון=בִּטָּחוֹן|ביניים=בֵּינַיִם|בעירה=בְּעֵרָה|גלבוע=גִּלְבֹּעַ|האצטרובל=הַאִצְטְרֻבָּל|הבהב=הִבְהוּב|ההודי=הַהׂדִּי|הטפש=טִפֵּשׁ|הילכך=הִלְכָּךְ|היפוך=הִפּוּךְ|ואיטלולה=וְאִטְלוּלָא|ואסאבי=וַסַבִּי|וחיים=וּמָוֶת|ועוזב=וְעֹזֵב|חפשן=חַפְּ\"שָׁן|טייקון=טַיְקוּן|טלוויזיה=טֶלֶוִיזְיָה|יעבר=יַעֲבור|יצרו=יִצְרוֹ'''''|ישימון=יְשִׁימֹן|כחות=כּוֹחוֹת|להרוג=לַהֲרֹג|ליבו=לִבּוֹ|לשיזבן=לְשֵׁזְבָן|מאויש=מְאֻיָּשׁ|מונחת=מֻנַּחַת|מזודונת=מִזְוָדֹנֶת|מזוינים=מְזֻיָּנִים|מיטה=מִטָּה|מיליארד=מִלְיַרְדּ|מיליארדר=מִלְיַרְדֶּר|מלומדה=מְלֻמָּדָה|מסוכן=מְסֻכָּן|מעורער=מְעֻרְעָר|מעזיבה=מַעֲזֵבָה|משושה=מְשֻׁשֶּׁה|נקודה=נְקֻדָּה|נקודת=נְקֻדַּת|נרדשיר=נַדְרְשִׁיר|סבובית=סִיבוּבִית|סחי=סַאחִי|עיניים=עֵינַיִם|פיסת=פִּסַּת|פקודה=פְּקֻדָּה|צינור=צִנּוֹר|קבוסת=קִבֹּסֶת|קוגנטיבית=קוֹגְנִיטִיבִית|קוטב=קֹטֶב|קומקום=קֻמְקוּם|קופה=קֻפָּה|קופת=קֻפַּת|קיקיוני=קִקְיוֹנִי|קליפתו=קְלִפָּתוֹ|קרוקומבוש=קְרוֹקֶמְבּוּשׁ|קרעפלאך=קְרֶעפְּלַךְ|קרפצ'ו=קַרְפָּצְ'יוֹ|רוקנ'רול=רוֹקֶנְרוֹל|ריגול=רִגּוּל|רילוקיישן=רִילוֹקֵישֶׁן|רנסאנס=רֶנֶסַנְס|ש'=שִׁי\"ן|שיכור=שִׁכּוֹר|שיפוצניק=שִׁפּוּצְנִיק|שעורי=שִׁעוּר|תואר=תֹּאַר|תיבול=תִּבּוּל|תמרה=תִּימָרָה|תפילת=תְּפִלַּת|תקשורת=תִּקְשֹׁרֶת"
].join("");

function dicLoad() {
    if (HT.DIC.map) return HT.DIC.count;
    var map = {}, i, list, key, pair, pos, amb = 0;
    list = HT.DIC.raw.split("|");
    for (i = 0; i < list.length; i++) {
        if (list[i] === "") continue;
        key = stripNikkud(list[i]);
        if (map.hasOwnProperty(key)) { amb++; continue; }
        map[key] = list[i];
    }
    list = HT.DIC.exc.split("|");
    for (i = 0; i < list.length; i++) {
        pair = list[i];
        pos = pair.indexOf("=");
        if (pos < 1) continue;
        key = pair.substring(0, pos);
        if (!map.hasOwnProperty(key)) map[key] = pair.substring(pos + 1);
    }
    HT.DIC.map = map;
    HT.DIC.ambiguous = amb;
    HT.DIC.count = 0;
    for (key in map) { if (map.hasOwnProperty(key)) HT.DIC.count++; }
    return HT.DIC.count;
}

/* Vorsilben mit ihrer üblichen Punktation. Sie werden nur abgetrennt,
   wenn der Rest im Wörterbuch steht – sonst richtet das mehr Schaden an
   als Nutzen (מים ist nicht מ + ים). */
HT.DIC.prefix = {
    "\u05D5": "\u05D5\u05B0",              // ו  we-
    "\u05D1": "\u05D1\u05BC\u05B0",       // ב  be-
    "\u05DB": "\u05DB\u05BC\u05B0",       // כ  ke-
    "\u05DC": "\u05DC\u05B0",              // ל  le-
    "\u05D4": "\u05D4\u05B7",              // ה  ha-
    "\u05E9": "\u05E9\u05C1\u05B6",       // ש  sche-
    "\u05DE": "\u05DE\u05B4"               // מ  mi-
};

function dicDirect(w) {
    var m = HT.DIC.map;
    return (m && m.hasOwnProperty(w)) ? m[w] : null;
}

/* Bis zu zwei Vorsilben abtrennen und den Rest nachschlagen. */
function dicWithPrefix(w) {
    var i, j, p1, p2, rest, hit;
    for (i = 1; i <= 2 && i < w.length - 1; i++) {
        p1 = w.substring(0, i);
        rest = w.substring(i);
        if (rest.length < 2) continue;
        var okay = true, built = "";
        for (j = 0; j < p1.length; j++) {
            if (!HT.DIC.prefix.hasOwnProperty(p1.charAt(j))) { okay = false; break; }
            built += HT.DIC.prefix[p1.charAt(j)];
        }
        if (!okay) continue;
        hit = dicDirect(rest);
        if (hit) return built + hit;
    }
    return null;
}

/* Letzte Rettung: Punktation nach den Regeln der vollen Schreibung raten.
   ו zwischen Konsonanten wird zu o, י nach Konsonant zu i, sonst steht ein
   a. Das ist nur eine Lesehilfe und trifft nicht immer zu. */
function guessNikkud(w) {
    var out = "", i, c, nxt, prevOpen = false, n = w.length;
    var PATACH = "\u05B7", HOLAM = "\u05B9", HIRIQ = "\u05B4", SHVA = "\u05B0";
    var DAGESH = "\u05BC";
    var QUIET = "\u05D0\u05E2";                    // א ע bleiben stumm
    var BEGED = "\u05D1\u05DB\u05E4";             // ב כ פ brauchen im Anlaut Dagesch
    for (i = 0; i < n; i++) {
        c = w.charAt(i);
        nxt = (i + 1 < n) ? w.charAt(i + 1) : "";

        if (c === "\u05D5" && prevOpen && nxt !== "\u05D5") {      // ו als Lesemutter
            out += c + HOLAM; prevOpen = false; continue;
        }
        if (c === "\u05D9" && prevOpen) {                          // י als Lesemutter
            out += HIRIQ + c; prevOpen = false; continue;
        }
        if (c === "\u05D5" && i === 0) {                            // ו als Vorsilbe
            out += c + SHVA; prevOpen = false; continue;
        }
        out += c;
        if (i === 0 && BEGED.indexOf(c) >= 0) out += DAGESH;         // בּ כּ פּ statt v kh f
        if (i === n - 1) { prevOpen = false; continue; }             // Wortende ohne Vokal
        if (QUIET.indexOf(c) >= 0 && i > 0) { prevOpen = false; continue; }
        if (nxt === "\u05D5" || nxt === "\u05D9") { prevOpen = true; continue; }
        out += PATACH;
        prevOpen = false;
    }
    return out;
}

/* Ein Wort punktieren. Liefert { nik, kind } mit kind = dict | prefix | guess */
function dicVocalizeWord(w) {
    var hit = dicDirect(w);
    if (hit) return { "nik": hit, "kind": "dict" };
    hit = dicWithPrefix(w);
    if (hit) return { "nik": hit, "kind": "prefix" };

    // Steht der Rest nicht im Wörterbuch, wenigstens die Vorsilbe richtig
    // setzen und nur den Stamm raten: בביתו wird so bevito statt vavito.
    if (w.length > 3 && "\u05D5\u05D4".indexOf(w.charAt(0)) >= 0) {
        return { "nik": HT.DIC.prefix[w.charAt(0)] + guessNikkud(w.substring(1)),
                 "kind": "guess" };
    }
    return { "nik": guessNikkud(w), "kind": "guess" };
}

/* Ganzen Text offline punktieren. stats zählt die Herkunft der Wörter. */
function vocalizeOffline(text, force, stats) {
    dicLoad();
    var parts = String(text).split(/([\u0590-\u05FF]+)/), out = "", i, tok, res;
    for (i = 0; i < parts.length; i++) {
        tok = parts[i];
        if (!/[\u0590-\u05FF]/.test(tok)) { out += tok; continue; }
        if (hasNikkud(tok)) {
            if (!force) { out += tok; if (stats) stats.kept++; continue; }
            tok = stripNikkud(tok);
        }
        res = dicVocalizeWord(tok);
        out += res.nik;
        if (stats) {
            stats.total++;
            if (res.kind === "dict") stats.dict++;
            else if (res.kind === "prefix") stats.prefix++;
            else { stats.guess++; if (stats.guessList.length < 12) stats.guessList.push(tok); }
        }
    }
    return out;
}

function newStats() {
    return { "total": 0, "dict": 0, "prefix": 0, "guess": 0, "kept": 0, "guessList": [] };
}

function statsText(st) {
    if (st.total === 0) return "keine unpunktierten Wörter";
    var s = st.total + " Wörter: " + st.dict + " aus dem Wörterbuch";
    if (st.prefix > 0) s += ", " + st.prefix + " über Vorsilben";
    if (st.guess > 0) s += ", " + st.guess + " geraten";
    return s;
}

// ---- Gemeinsame Weiche für alle Quellen ------------------------------------

HT.vocalOptions = [
    ["aus – Text unverändert übernehmen", "off"],
    ["Wörterbuch im Skript (ohne Internet)", "dict"],
    ["Dicta Nakdan (Internet)", "nakdan"],
    ["Nakdan, bei Ausfall das Wörterbuch", "nakdan_dict"]
];

/* Liefert { text, used, source, stats, failed }. */
function vocalizePrepare(cfg, text, log) {
    var mode = cfg.vocalMode || "dict";
    var res = { "text": text, "used": false, "source": "", "stats": null, "failed": false };
    if (mode === "off" || !hasHebrew(text)) return res;
    if (hasNikkud(text) && !cfg.nakdanForce) {
        // Der Text bringt schon Punktation mit.
        if (mode === "dict") {
            // Trotzdem die Lücken füllen: einzelne unpunktierte Wörter darin.
            var st0 = newStats();
            var v0 = vocalizeOffline(text, false, st0);
            if (st0.total > 0) {
                res.text = v0; res.used = true; res.source = "dict"; res.stats = st0;
            }
            return res;
        }
        return res;
    }

    var st, v;
    if (mode === "dict") {
        st = newStats();
        v = vocalizeOffline(text, cfg.nakdanForce, st);
        res.text = v; res.used = true; res.source = "dict"; res.stats = st;
        return res;
    }

    v = nakdanVocalize(text, cfg, log);
    if (v !== null) {
        res.text = v; res.used = true; res.source = "nakdan";
        return res;
    }
    if (mode === "nakdan_dict") {
        log("Nakdan lieferte kein brauchbares Ergebnis – es wird das Wörterbuch benutzt.");
        st = newStats();
        v = vocalizeOffline(text, cfg.nakdanForce, st);
        res.text = v; res.used = true; res.source = "dict"; res.stats = st;
        return res;
    }
    res.failed = true;
    return res;
}

function transliterationSource() {
    var sels = selectionTexts(), s;
    if (sels.length === 0) return null;
    try { s = sels[0].contents; } catch (e) { return null; }
    if (typeof s !== "string" || s.length === 0) return null;
    return { "obj": sels[0], "text": s };
}

function insertTransliteration(cfg, log, preText) {
    var src = transliterationSource();
    if (!src) { log("Bitte zuerst hebräischen Text markieren."); return false; }

    // preText ist der bereits vokalisierte Text aus Nakdan; der Netzzugriff
    // läuft absichtlich vor dem Widerrufsschritt, nicht darin.
    var basis = (typeof preText === "string" && preText !== "") ? preText : src.text;
    var translit = transliterate(basis, cfg);
    if (cfg.trPlacement === "preview") { return translit; }

    var insText = String(cfg.trTemplate).replace("%s", translit);
    var story, startIdx, range, fnt;

    try {
        story = src.obj.parentStory;
        if (cfg.trPlacement === "replace") {
            startIdx = src.obj.insertionPoints[0].index;
            src.obj.contents = translit;
            insText = translit;
        } else if (cfg.trPlacement === "before") {
            startIdx = src.obj.insertionPoints[0].index;
            src.obj.insertionPoints[0].contents = insText;
        } else {
            startIdx = src.obj.insertionPoints[-1].index;
            src.obj.insertionPoints[-1].contents = insText;
        }
        if (insText.length > 0) {
            range = story.characters.itemByRange(startIdx, startIdx + insText.length - 1);
            fnt = resolveFont(cfg.trFamily, cfg.trStyle);
            if (fnt) { range.appliedFont = fnt; }
            else { log("Umschrift-Schrift nicht installiert: " + cfg.trFamily + " " + cfg.trStyle); }
            range.pointSize = cfg.trSize;
        }
    } catch (e) {
        log("Einfügen fehlgeschlagen: " + e);
        return false;
    }
    return translit;
}

// ============================================================================
// 4 · MODUL 3 – Stapelverarbeitung über Buchdokumente
// ============================================================================

function bookNames() {
    var out = [], i;
    for (i = 0; i < app.books.length; i++) { out.push(app.books[i].name); }
    return out;
}

function openDocFor(file) {
    var i, d;
    for (i = 0; i < app.documents.length; i++) {
        d = app.documents[i];
        try { if (d.fullName.fsName === file.fsName) return d; } catch (e) {}
    }
    return null;
}

function runBatch(cfg, log) {
    var books = [], b, i, scriptFile = null, suffix;
    var ok = 0, err = 0, oldLevel;

    if (app.books.length === 0) { log("Kein Buch geöffnet."); return; }

    if (cfg.batchAllBooks) {
        for (i = 0; i < app.books.length; i++) books.push(app.books[i]);
    } else {
        b = app.books.itemByName(cfg.batchBook);
        if (!b.isValid) { log("Buch nicht gefunden: " + cfg.batchBook); return; }
        books.push(b);
    }

    if (cfg.batchAction === "external") {
        if (!cfg.batchScript) { log("Bitte eine Skriptdatei wählen."); return; }
        scriptFile = File(cfg.batchScript);
        if (!scriptFile.exists) { log("Skriptdatei nicht gefunden: " + cfg.batchScript); return; }
        suffix = String(scriptFile.name).split(".").pop().toLowerCase();
        if (suffix !== "js" && suffix !== "jsx" && suffix !== "jsxbin") {
            log("Nur .js, .jsx oder .jsxbin sind erlaubt."); return;
        }
    }

    oldLevel = app.scriptPreferences.userInteractionLevel;
    if (cfg.batchSilent) {
        app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    }

    try {
        for (var bi = 0; bi < books.length; bi++) {
            var book = books[bi];
            var contents = book.bookContents;
            log("Buch: " + book.name + "  (" + contents.length + " Dokumente)");
            if (contents.length === 0) { log("  Buch ohne Inhalt – übersprungen."); continue; }

            for (var di = 0; di < contents.length; di++) {
                var bc = contents[di];
                var file = File(bc.fullName);
                var wasOpen = openDocFor(file);
                var doc = null;
                try {
                    doc = wasOpen ? wasOpen : app.open(file);
                    if (cfg.batchAction === "external") {
                        app.doScript(scriptFile, ScriptLanguage.JAVASCRIPT);
                    } else {
                        var res = applyTypography(cfg, storiesOfDoc(doc), log);
                        log("  " + bc.name + ": " + res.texts + " Textketten, " +
                            res.paragraphs + " Absätze");
                    }
                    if (cfg.batchSaveClose) {
                        doc.save();
                        if (!wasOpen) doc.close(SaveOptions.NO);
                    }
                    ok++;
                    log("  OK: " + bc.name);
                } catch (e) {
                    err++;
                    log("  FEHLER bei " + bc.name + ": " + e);
                    try { if (doc && !wasOpen && cfg.batchSaveClose) doc.close(SaveOptions.NO); } catch (e2) {}
                }
            }
        }
    } finally {
        app.scriptPreferences.userInteractionLevel = oldLevel;
    }
    log("Fertig. Erfolgreich: " + ok + " · Fehler: " + err);
}

// ============================================================================
// 5 · MODUL 4 – Dokument- und Layout-Generator
//     Ersetzt die früheren Einzelskripte A5-Midrasch*, A5-Midrash-layout-*.
//     Alle Maße in Millimetern, alle Rahmen aus Seitengröße und Rändern
//     berechnet – dadurch für jedes Seitenformat gültig.
// ============================================================================

HT.pagePresets = {
    "A4 (210 × 297)":        [210, 297],
    "A5 (148 × 210)":        [148, 210],
    "A6 (105 × 148)":        [105, 148],
    "B5 (176 × 250)":        [176, 250],
    "Letter (215,9 × 279,4)": [215.9, 279.4],
    "frei":                  null
};
HT.presetNames = ["A4 (210 × 297)", "A5 (148 × 210)", "A6 (105 × 148)",
                  "B5 (176 × 250)", "Letter (215,9 × 279,4)", "frei"];

/* Hebräischer Zahlwert (Gematria) für 1 … 9999.
   Korrekt gegenüber der alten Fassung:
     · Hunderter über 400 werden zusammengesetzt (500 = תק, 900 = תתק)
     · 15 und 16 werden zu טו und טז, auch innerhalb größerer Zahlen (115 = קטו)
     · Geresch ׳ bei einem Buchstaben, Gerschajim ״ vor dem letzten Buchstaben */
function hebrewNumeral(n, useMarks) {
    n = Math.floor(n);
    if (isNaN(n) || n < 1 || n > 9999) return String(n);
    var units    = ["", "\u05D0", "\u05D1", "\u05D2", "\u05D3",
                    "\u05D4", "\u05D5", "\u05D6", "\u05D7", "\u05D8"];
    var tens     = ["", "\u05D9", "\u05DB", "\u05DC", "\u05DE",
                    "\u05E0", "\u05E1", "\u05E2", "\u05E4", "\u05E6"];
    var hundreds = ["", "\u05E7", "\u05E8", "\u05E9", "\u05EA"];
    var s = "", prefix = "", rest = n, h, t, u;

    if (rest >= 1000) {                       // Tausender vorangestellt, z. B. ה׳
        prefix = units[Math.floor(rest / 1000)] + "\u05F3";
        rest = rest % 1000;
    }
    h = Math.floor(rest / 100);
    rest = rest % 100;
    while (h > 4) { s += hundreds[4]; h -= 4; }   // 500 = תק, 900 = תתק
    s += hundreds[h];

    t = Math.floor(rest / 10);
    u = rest % 10;
    if (t === 1 && (u === 5 || u === 6)) {        // 15 → טו, 16 → טז
        s += units[9] + units[u + 1];
    } else {
        s += tens[t] + units[u];
    }

    if (s.length === 0) return prefix;                     // glatte Tausender
    if (!useMarks) return prefix + s;
    if (s.length === 1) return prefix + s + (prefix ? "" : "\u05F3");
    return prefix + s.substring(0, s.length - 1) + "\u05F4" + s.substring(s.length - 1);
}

/* Setzt Eigenschaften einzeln und still – eine nicht unterstützte Eigenschaft
   soll den ganzen Lauf nicht abbrechen. */
function setProps(obj, props, log, label) {
    for (var k in props) {
        if (!props.hasOwnProperty(k)) continue;
        if (props[k] === undefined || props[k] === null) continue;   // z. B. fehlende Schrift
        try { obj[k] = props[k]; }
        catch (e) { if (log) log("  Hinweis: " + label + "." + k + " nicht gesetzt (" + e + ")"); }
    }
}

/* Absatzformat anlegen oder vorhandenes weiterverwenden. */
function ensureParagraphStyle(doc, name, props, log) {
    var st;
    try {
        st = doc.paragraphStyles.itemByName(name);
        if (!st.isValid) st = doc.paragraphStyles.add({ "name": name });
    } catch (e) { return null; }
    setProps(st, props, log, name);
    return st;
}

function justForBinding(rtl) {
    return rtl ? Justification.RIGHT_ALIGN : Justification.LEFT_ALIGN;
}

/* Seitenränder physisch je Buchseite setzen: der Bundsteg (innen) liegt auf
   rechten Seiten links, auf linken Seiten rechts. */
function applyPageMargins(page, cfg, log) {
    var inside = cfg.docMarginInside, outside = cfg.docMarginOutside;
    var isLeft = false;
    try { isLeft = (page.side === PageSideOptions.LEFT_HAND); } catch (e) {}
    var l = (cfg.docFacing && isLeft) ? outside : inside;
    var r = (cfg.docFacing && isLeft) ? inside : outside;
    setProps(page.marginPreferences, {
        "top": cfg.docMarginTop + "mm",
        "bottom": cfg.docMarginBottom + "mm",
        "left": l + "mm",
        "right": r + "mm",
        "columnCount": cfg.docColumns,
        "columnGutter": cfg.docGutter + "mm"
    }, log, "Ränder");
}

/* Satzspiegel einer Seite in Ruler-Koordinaten: [oben, links, unten, rechts] */
function contentBounds(page, cfg) {
    var b = page.bounds;                 // [y1, x1, y2, x2]
    var isLeft = false;
    try { isLeft = (page.side === PageSideOptions.LEFT_HAND); } catch (e) {}
    var l = (cfg.docFacing && isLeft) ? cfg.docMarginOutside : cfg.docMarginInside;
    var r = (cfg.docFacing && isLeft) ? cfg.docMarginInside : cfg.docMarginOutside;
    return [b[0] + cfg.docMarginTop, b[1] + l, b[2] - cfg.docMarginBottom, b[3] - r];
}

/* Rahmen für die Seitenzahl, Position abhängig von der Buchseite. */
function pageNumberBounds(page, cfg) {
    var b = page.bounds;
    var wBox = 40, hBox = 8;
    var top = b[2] - cfg.docNumDistance - hBox;
    var bottom = b[2] - cfg.docNumDistance;
    var isLeft = false;
    try { isLeft = (page.side === PageSideOptions.LEFT_HAND); } catch (e) {}
    var left, right;
    if (cfg.docNumPos === "center" || !cfg.docFacing) {
        var mid = (b[1] + b[3]) / 2;
        left = mid - wBox / 2;
        right = mid + wBox / 2;
    } else {
        var outerIsLeftEdge = (cfg.docNumPos === "outside") ? isLeft : !isLeft;
        if (outerIsLeftEdge) {
            left = b[1] + cfg.docMarginOutside;
            right = left + wBox;
        } else {
            right = b[3] - cfg.docMarginOutside;
            left = right - wBox;
        }
    }
    return [top, left, bottom, right];
}

function numberJustification(page, cfg) {
    if (cfg.docNumPos === "center" || !cfg.docFacing) return Justification.CENTER_ALIGN;
    var isLeft = false;
    try { isLeft = (page.side === PageSideOptions.LEFT_HAND); } catch (e) {}
    var outerIsLeftEdge = (cfg.docNumPos === "outside") ? isLeft : !isLeft;
    return outerIsLeftEdge ? Justification.LEFT_ALIGN : Justification.RIGHT_ALIGN;
}

/* Beispieltexte – die hebräische Fassung ist vokalisiert, damit sich Modul 1
   und Modul 2 direkt daran ausprobieren lassen. */
HT.sampleText = {
    "he": {
        "title": "\u05DE\u05B4\u05D3\u05B0\u05E8\u05B8\u05E9\u05C1",
        "sub": "\u05DB\u05B0\u05EA\u05B8\u05D1 \u05D5\u05B0\u05E7\u05D5\u05B9\u05DC",
        "body": "\u05D4\u05B7\u05E7\u05BC\u05D5\u05B9\u05DC \u05D0\u05B2\u05E9\u05C1\u05B6\u05E8 \u05D0\u05B5\u05D9\u05E0\u05B6\u05E0\u05BC\u05D5\u05BC \u05E7\u05D5\u05B9\u05DC.\r" +
                  "\u05DE\u05D5\u05B9\u05E9\u05C1\u05B6\u05D4 \u05D3\u05B4\u05D1\u05BC\u05B6\u05E8 \u05E4\u05BC\u05B8\u05E0\u05B4\u05D9\u05DD \u05D0\u05B6\u05DC \u05E4\u05BC\u05B8\u05E0\u05B4\u05D9\u05DD.\r" +
                  "\u05D5\u05B0\u05D2\u05B7\u05DD \u05D1\u05BC\u05B7\u05E9\u05BC\u05C1\u05B0\u05EA\u05B4\u05D9\u05E7\u05B8\u05D4 \u05D9\u05B5\u05E9\u05C1 \u05DE\u05B8\u05E7\u05D5\u05B9\u05DD \u05DC\u05B7\u05E9\u05BC\u05C1\u05B0\u05DB\u05B4\u05D9\u05E0\u05B8\u05D4.",
        "comment": "Kommentarspalte – hier stehen Anmerkungen zum Haupttext."
    },
    "de": {
        "title": "Midrasch Mosche",
        "sub": "Sayi: Die Stimme, die keine ist",
        "body": "Mosche sprach von Angesicht zu Angesicht – doch er wusste auch, wann er sich niederwerfen musste.\r" +
                  "Seine Stimme hallte vom Sinai – doch seine größte Kraft lag im Schweigen.\r" +
                  "Als die Tafeln zerbrachen, schwieg Mosche. Er rief nicht in Zorn, sondern sammelte die Scherben und flüsterte den Sayi.\r" +
                  "Mosches Sayi war keine Schwäche – sondern Raum für die Schechina.",
        "comment": "Kommentarspalte – hier stehen Anmerkungen zum Haupttext."
    },
    "en": {
        "title": "Midrash Moshe",
        "sub": "Sayi: The Voice That Is No Voice",
        "body": "Moses spoke face to face – yet he also knew when to fall on his face.\r" +
                  "His voice was heard from Sinai – yet his greatest strength lay in silence.\r" +
                  "When the tablets shattered, Moses said nothing. He gathered the fragments and whispered the Sayi.\r" +
                  "The Sayi of Moses was not weakness – but room for the Shekhinah.",
        "comment": "Comment column – notes on the main text."
    }
};

/* Hauptfunktion des Moduls. Liefert ein Ergebnisobjekt für die Statuszeile. */
function buildLayoutDocument(cfg, log) {
    var rtl = (cfg.docBinding === "rtl");
    var isNew = (cfg.docTarget === "new");
    var doc, i, p;
    var result = { "pages": 0, "styles": 0, "numbers": 0, "frames": 0, "doc": null };

    if (isNew) {
        doc = app.documents.add();
    } else {
        if (app.documents.length === 0) { log("Kein Dokument geöffnet."); return null; }
        doc = app.activeDocument;
    }
    result.doc = doc;

    // Maßeinheiten und Nullpunkt festlegen – alle Rechnungen laufen in Millimeter
    setProps(doc.viewPreferences, {
        "horizontalMeasurementUnits": MeasurementUnits.MILLIMETERS,
        "verticalMeasurementUnits": MeasurementUnits.MILLIMETERS,
        "rulerOrigin": RulerOrigin.PAGE_ORIGIN
    }, log, "Ansicht");

    // ---- Seitenformat, Bindung, Seitenzahl ---------------------------------
    if (isNew) {
        var w = cfg.docWidth, h = cfg.docHeight;
        if (cfg.docLandscape) { var tmp = w; w = h; h = tmp; }
        setProps(doc.documentPreferences, {
            "pageWidth": w + "mm",
            "pageHeight": h + "mm",
            "facingPages": cfg.docFacing
        }, log, "Dokument");
        try {
            doc.documentPreferences.pageBinding =
                rtl ? PageBindingOptions.RIGHT_TO_LEFT : PageBindingOptions.LEFT_TO_RIGHT;
        } catch (e) {
            log("Hinweis: Bindungsrichtung nicht verfügbar – World-Ready-Funktionen prüfen.");
        }
        // Seitenzahl angleichen (pagesPerDocument wirkt nur beim Anlegen)
        while (doc.pages.length < cfg.docPages) doc.pages.add(LocationOptions.AT_END);
        while (doc.pages.length > cfg.docPages && doc.pages.length > 1) {
            doc.pages[-1].remove();
        }
    } else {
        log("Aktives Dokument: Seitengröße, Seitenzahl und Bindung bleiben unverändert.");
    }
    result.pages = doc.pages.length;

    // ---- Ränder ------------------------------------------------------------
    setProps(doc.marginPreferences, {
        "top": cfg.docMarginTop + "mm",
        "bottom": cfg.docMarginBottom + "mm",
        "left": cfg.docMarginInside + "mm",
        "right": cfg.docMarginOutside + "mm",
        "columnCount": cfg.docColumns,
        "columnGutter": cfg.docGutter + "mm"
    }, log, "Ränder");

    var masterPages = [];
    try {
        var ms = doc.masterSpreads.item(0);
        masterPages = ms.pages.everyItem().getElements();
    } catch (e) { log("Hinweis: Musterseite nicht gefunden."); }

    for (i = 0; i < masterPages.length; i++) applyPageMargins(masterPages[i], cfg, log);
    for (i = 0; i < doc.pages.length; i++) applyPageMargins(doc.pages[i], cfg, log);

    // ---- Absatzformate -----------------------------------------------------
    var pre = cfg.docStylePrefix;
    var stTitle = null, stBody = null, stComment = null, stNumber = null;
    if (cfg.docStyles) {
        var hebFont = resolveFont(cfg.hebFamily, cfg.hebStyle);
        var latFont = resolveFont(cfg.latFamily, cfg.latStyle);
        var mainFont = rtl ? (hebFont || latFont) : (latFont || hebFont);
        if (rtl && !hebFont) log("Hinweis: Hebräische Schrift „" + cfg.hebFamily + "“ fehlt.");
        if (!rtl && !latFont) log("Hinweis: Lateinische Schrift „" + cfg.latFamily + "“ fehlt.");

        var common = {};
        if (mainFont) common.appliedFont = mainFont;

        stTitle = ensureParagraphStyle(doc, pre + "Titel", {
            "appliedFont": common.appliedFont,
            "pointSize": cfg.docTitleSize,
            "leading": Math.round(cfg.docTitleSize * 1.25),
            "justification": Justification.CENTER_ALIGN,
            "spaceAfter": (cfg.docTitleSize / 2) + "pt"
        }, log);
        stBody = ensureParagraphStyle(doc, pre + "Grundtext", {
            "appliedFont": common.appliedFont,
            "pointSize": cfg.docBodySize,
            "leading": Math.round(cfg.docBodySize * 1.45),
            "justification": justForBinding(rtl),
            "hyphenation": false
        }, log);
        stComment = ensureParagraphStyle(doc, pre + "Kommentar", {
            "appliedFont": common.appliedFont,
            "pointSize": cfg.docCommentSize,
            "leading": Math.round(cfg.docCommentSize * 1.35),
            "justification": justForBinding(rtl)
        }, log);
        stNumber = ensureParagraphStyle(doc, pre + "Seitenzahl", {
            "appliedFont": (cfg.docNumHebFont ? (hebFont || mainFont) : (latFont || mainFont)),
            "pointSize": cfg.docNumSize,
            "leading": Math.round(cfg.docNumSize * 1.2),
            "justification": Justification.CENTER_ALIGN
        }, log);

        // World-Ready-Setzer und Absatzrichtung für hebräischen Satz
        var styleList = [stTitle, stBody, stComment, stNumber];
        for (i = 0; i < styleList.length; i++) {
            if (!styleList[i]) continue;
            result.styles++;
            if (!rtl) continue;
            findComposerName(styleList[i], "wr_para");
            try {
                styleList[i].paragraphDirection =
                    ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION;
            } catch (e) {}
        }
    }

    // ---- Grundtextrahmen auf der Musterseite -------------------------------
    if (cfg.docMasterFrame) {
        for (i = 0; i < masterPages.length; i++) {
            try {
                var cb = contentBounds(masterPages[i], cfg);
                var tf = masterPages[i].textFrames.add();
                tf.geometricBounds = cb;
                tf.label = "HT-Grundtextrahmen";
                setProps(tf.textFramePreferences, {
                    "textColumnCount": cfg.docColumns,
                    "textColumnGutter": cfg.docGutter + "mm"
                }, log, "Textrahmen");
                if (stBody) { try { tf.texts[0].appliedParagraphStyle = stBody; } catch (e) {} }
                if (rtl) {
                    try {
                        tf.parentStory.storyPreferences.storyDirection =
                            StoryDirectionOptions.RIGHT_TO_LEFT_DIRECTION;
                    } catch (e) {}
                }
                result.frames++;
            } catch (e) { log("Hinweis: Grundtextrahmen nicht angelegt (" + e + ")"); }
        }
    }

    // ---- Seitenzahlen ------------------------------------------------------
    if (cfg.docPageNumbers) {
        var isStatic = (cfg.docNumStyle === "staticHeb" ||
                        cfg.docNumStyle === "staticHebDesc" ||
                        cfg.docNumStyle === "staticDesc");

        if (!isStatic) {
            // Automatische Seitenzahl auf der Musterseite – die saubere Lösung:
            // Nummern bleiben beim Einfügen oder Löschen von Seiten richtig.
            for (i = 0; i < masterPages.length; i++) {
                try {
                    var nf = masterPages[i].textFrames.add();
                    nf.geometricBounds = pageNumberBounds(masterPages[i], cfg);
                    nf.label = "HT-Seitenzahl";
                    nf.textFramePreferences.verticalJustification =
                        VerticalJustification.CENTER_ALIGN;
                    if (stNumber) { try { nf.texts[0].appliedParagraphStyle = stNumber; } catch (e) {} }
                    nf.contents = SpecialCharacters.AUTO_PAGE_NUMBER;
                    try {
                        nf.paragraphs[0].justification = numberJustification(masterPages[i], cfg);
                    } catch (e) {}
                    result.numbers++;
                } catch (e) { log("Hinweis: Seitenzahlrahmen nicht angelegt (" + e + ")"); }
            }
            if (cfg.docNumStyle === "hebrew" || cfg.docNumStyle === "hebrewNS") {
                var ok = false;
                try {
                    doc.sections[0].pageNumberStyle =
                        (cfg.docNumStyle === "hebrew") ? PageNumberStyle.HEBREW_BIBLICAL
                                                       : PageNumberStyle.HEBREW_NON_STANDARD;
                    ok = true;
                } catch (e) {}
                if (!ok) {
                    log("Hinweis: Hebräische Nummerierung wird von dieser InDesign-Version " +
                        "nicht als Abschnittsformat angeboten. Bitte „feste hebräische " +
                        "Zahlen“ wählen.");
                }
            }
        } else {
            // Feste Zahlen je Einzelseite – nötig für rückwärts laufende Zählung
            var total = doc.pages.length;
            var desc = (cfg.docNumStyle === "staticHebDesc" || cfg.docNumStyle === "staticDesc");
            var heb = (cfg.docNumStyle === "staticHeb" || cfg.docNumStyle === "staticHebDesc");
            for (i = 0; i < total; i++) {
                p = doc.pages[i];
                var val = desc ? (total - i) : (i + 1);
                try {
                    var sf = p.textFrames.add();
                    sf.geometricBounds = pageNumberBounds(p, cfg);
                    sf.label = "HT-Seitenzahl";
                    sf.textFramePreferences.verticalJustification =
                        VerticalJustification.CENTER_ALIGN;
                    if (stNumber) { try { sf.texts[0].appliedParagraphStyle = stNumber; } catch (e) {} }
                    sf.contents = heb ? hebrewNumeral(val, true) : String(val);
                    try { sf.paragraphs[0].justification = numberJustification(p, cfg); } catch (e) {}
                    if (heb) {
                        try {
                            sf.texts[0].characterDirection =
                                CharacterDirectionOptions.RIGHT_TO_LEFT_DIRECTION;
                        } catch (e) {}
                    }
                    result.numbers++;
                } catch (e) { log("Hinweis: Seitenzahl auf Seite " + (i + 1) + " fehlt (" + e + ")"); }
            }
        }
    }

    // ---- Beispielinhalt ----------------------------------------------------
    if (cfg.docSample && doc.pages.length > 0) {
        var smp = HT.sampleText[cfg.docSampleLang] || HT.sampleText.de;
        var titleText = (cfg.docTitleText && cfg.docTitleText !== "")
                        ? cfg.docTitleText : smp.title;
        try {
            var p1 = doc.pages[0];
            var b1 = contentBounds(p1, cfg);
            var t1f = p1.textFrames.add();
            t1f.geometricBounds = [b1[0] + (b1[2] - b1[0]) * 0.25, b1[1], b1[2], b1[3]];
            t1f.contents = titleText + "\r" + smp.sub;
            if (stTitle) { try { t1f.paragraphs[0].appliedParagraphStyle = stTitle; } catch (e) {} }
            if (stBody && t1f.paragraphs.length > 1) {
                try { t1f.paragraphs[1].appliedParagraphStyle = stBody; } catch (e) {}
                try { t1f.paragraphs[1].justification = Justification.CENTER_ALIGN; } catch (e) {}
            }
            if (rtl) {
                try {
                    t1f.parentStory.storyPreferences.storyDirection =
                        StoryDirectionOptions.RIGHT_TO_LEFT_DIRECTION;
                } catch (e) {}
            }
            result.frames++;
        } catch (e) { log("Hinweis: Titelseite nicht angelegt (" + e + ")"); }

        if (doc.pages.length > 1) {
            try {
                var p2 = doc.pages[1];
                var b2 = contentBounds(p2, cfg);
                var split = b2[1] + (b2[3] - b2[1]) * 0.68;
                var gap = 5;
                var mainL = rtl ? (b2[1] + (b2[3] - b2[1]) * 0.32 + gap) : b2[1];
                var mainR = rtl ? b2[3] : split;
                var comL  = rtl ? b2[1] : split + gap;
                var comR  = rtl ? (b2[1] + (b2[3] - b2[1]) * 0.32) : b2[3];

                var bodyF = p2.textFrames.add();
                bodyF.geometricBounds = [b2[0], mainL, b2[2], mainR];
                bodyF.contents = smp.body;
                if (stBody) {
                    try { bodyF.parentStory.paragraphs.everyItem().appliedParagraphStyle = stBody; }
                    catch (e) {}
                }
                if (rtl) {
                    try {
                        bodyF.parentStory.storyPreferences.storyDirection =
                            StoryDirectionOptions.RIGHT_TO_LEFT_DIRECTION;
                    } catch (e) {}
                }

                var comF = p2.textFrames.add();
                comF.geometricBounds = [b2[0], comL, b2[2], comR];
                comF.contents = smp.comment;
                if (stComment) {
                    try { comF.parentStory.paragraphs.everyItem().appliedParagraphStyle = stComment; }
                    catch (e) {}
                }
                result.frames += 2;
            } catch (e) { log("Hinweis: Beispielseite nicht angelegt (" + e + ")"); }
        }
    }

    return result;
}

/* Kurzfassung der Einstellungen für die Statuszeile. */
function layoutSummary(cfg) {
    var w = cfg.docWidth, h = cfg.docHeight;
    if (cfg.docLandscape) { var t = w; w = h; h = t; }
    return w + " × " + h + " mm · " + cfg.docPages + " Seiten · " +
           (cfg.docFacing ? "Doppelseiten" : "Einzelseiten") + " · Bindung " +
           (cfg.docBinding === "rtl" ? "rechts nach links" : "links nach rechts") +
           " · Satzspiegel " + (w - cfg.docMarginInside - cfg.docMarginOutside) +
           " × " + (h - cfg.docMarginTop - cfg.docMarginBottom) + " mm";
}

// ============================================================================
// 6 · Auswahllisten für die Oberfläche
// ============================================================================

HT.justOptions = [
    ["Linksbündig", "LEFT_ALIGN"],
    ["Zentriert", "CENTER_ALIGN"],
    ["Rechtsbündig", "RIGHT_ALIGN"],
    ["Blocksatz, letzte Zeile links", "LEFT_JUSTIFIED"],
    ["Blocksatz, letzte Zeile zentriert", "CENTER_JUSTIFIED"],
    ["Blocksatz, letzte Zeile rechts", "RIGHT_JUSTIFIED"],
    ["Blocksatz, alle Zeilen", "FULLY_JUSTIFIED"]
];

HT.composerOptions = [
    ["World-Ready-Absatzsetzer (für Hebräisch)", "wr_para"],
    ["World-Ready-Einzeilensetzer", "wr_single"],
    ["Adobe Absatzsetzer", "para"],
    ["Adobe Einzeilensetzer", "single"]
];

HT.neutralOptions = [
    ["wie vorheriges Zeichen", "inherit"],
    ["wie Lateinisch", "latin"],
    ["unverändert lassen", "keep"]
];

HT.trModeOptions = [
    ["wissenschaftlich (ʾ ḥ ṭ ṣ š ā ē ī ō ū)", "scientific"],
    ["vereinfacht (sh, ch, ts)", "simple"],
    ["vereinfachtes modernes Ivrit (sh, ch, tz, kh)", "ivrit"]
];

HT.shvaOptions = [
    ["automatisch: still oder ə", "auto"],
    ["immer ə", "schwa"],
    ["immer e", "e"],
    ["immer weglassen", "none"]
];

HT.placementOptions = [
    ["hinter der Auswahl einfügen", "after"],
    ["vor der Auswahl einfügen", "before"],
    ["Auswahl ersetzen", "replace"],
    ["nur anzeigen, nichts einfügen", "preview"]
];

HT.numStyleOptions = [
    ["arabisch 1, 2, 3 (automatisch)", "arabic"],
    ["hebräisch א, ב, ג (automatisch, mit Gerschajim)", "hebrew"],
    ["hebräisch ohne Gerschajim (automatisch)", "hebrewNS"],
    ["feste hebräische Zahlen, vorwärts", "staticHeb"],
    ["feste hebräische Zahlen, rückwärts (letzte Seite = א)", "staticHebDesc"],
    ["feste arabische Zahlen, rückwärts (letzte Seite = 1)", "staticDesc"]
];

HT.numPosOptions = [
    ["unten Mitte", "center"],
    ["unten außen (Vorderkante)", "outside"],
    ["unten innen (Bundsteg)", "inside"]
];

HT.sampleLangOptions = [
    ["hebräisch (vokalisiert)", "he"],
    ["deutsch", "de"],
    ["englisch", "en"]
];

HT.bindingOptions = [
    ["links nach rechts (deutsch, englisch)", "ltr"],
    ["rechts nach links (hebräisch)", "rtl"]
];

function optionLabels(pairs) {
    var out = [], i;
    for (i = 0; i < pairs.length; i++) out.push(pairs[i][0]);
    return out;
}
function optionIndex(pairs, value) {
    var i;
    for (i = 0; i < pairs.length; i++) { if (pairs[i][1] === value) return i; }
    return 0;
}

// ============================================================================
// 7 · Hilfetext
// ============================================================================

HT.helpText = [
"HEBRÄISCH-TOOLBOX  ·  Version " + HT.VERSION,
"",
"Die Palette bleibt offen, während Sie in InDesign weiterarbeiten. Jede",
"Aktion ist ein einzelner Widerrufsschritt (Strg/Cmd+Z).",
"",
"────────────────────────────────────────────────────────────",
"1 · SCHRIFTEN & ABSATZ",
"────────────────────────────────────────────────────────────",
"Bereich",
"  Auswahl        Nur der markierte Text.",
"  Textkette      Die ganze Story, in der die Auswahl liegt.",
"  Dokument       Alle Textketten des aktiven Dokuments.",
"  Tabellen & Fußnoten: Zelltexte und Fußnoten werden mitbehandelt.",
"",
"Schriften",
"  Hebräisch trifft alle Zeichen der Unicode-Blöcke Hebräisch",
"  (U+0590–U+05FF) und der Präsentationsformen (U+FB1D–U+FB4F).",
"  Lateinisch trifft lateinische Buchstaben samt Zusatzzeichen.",
"  Neutrale Zeichen sind Ziffern, Satzzeichen und Leerraum:",
"    · wie vorheriges Zeichen – Leerzeichen in hebräischen Passagen",
"      behalten die hebräische Schrift. Empfohlen für gemischten Satz.",
"    · wie Lateinisch – Verhalten des alten Skripts.",
"    · unverändert lassen – Formatierung dieser Zeichen bleibt stehen.",
"  Der Text wird abschnittsweise formatiert statt Zeichen für Zeichen.",
"  Das ist bei langen Texten um ein Vielfaches schneller.",
"",
"Zeichenformat",
"  Schriftgrad gilt für den ganzen Bereich. Mit eigener Größe für",
"  Hebräisch können Sie den optisch kleineren hebräischen Satz",
"  ausgleichen (z. B. Latein 9 pt, Hebräisch 10 pt).",
"",
"Absatzformat",
"  Ausrichtung: „Blocksatz, letzte Zeile links“ entspricht dem, was",
"  InDesign in der Palette als Blocksatz mit linker Schlusszeile zeigt.",
"  Setzer: Der World-Ready-Absatzsetzer ist für Hebräisch nötig, sonst",
"  werden Vokalzeichen und Laufrichtung falsch gesetzt. Der interne",
"  Name unterscheidet sich je nach Programmsprache; das Skript probiert",
"  mehrere Schreibweisen durch und meldet, wenn keine greift.",
"  Absatzrichtung: rechts-nach-links nur einschalten, wenn der Absatz",
"  überwiegend hebräisch ist. Setzt World-Ready-Funktionen voraus.",
"",
"Analysieren zeigt vorab, wie viele hebräische und lateinische Zeichen",
"im gewählten Bereich stecken – gut zum Prüfen vor dem Anwenden.",
"",
"────────────────────────────────────────────────────────────",
"2 · TRANSLITERATION",
"────────────────────────────────────────────────────────────",
"Drei Verfahren stehen zur Wahl.",
"",
"Wissenschaftlich folgt der in der Hebraistik üblichen Umschrift:",
"  ʾ b/ḇ g/ḡ d/ḏ h w z ḥ ṭ y k/ḵ l m n s ʿ p/p̄ ṣ q r ś/š t/ṯ",
"  Vokale mit Längenzeichen: ā ē ī ō ū, Chatef-Vokale ă ĕ ŏ, Schwa ə.",
"Vereinfacht liefert dieselbe buchstabengetreue Zuordnung ohne",
"Sonderzeichen (sh, ch, ts …).",
"",
"Vereinfachtes modernes Ivrit gibt wieder, wie das Wort heute in Israel",
"gesprochen wird, nicht wie es geschrieben ist. Es eignet sich für",
"Lesehilfen, Namen und Zitate im Fließtext, nicht für den kritischen",
"Apparat. Die Regeln stammen aus dem Umschrift-Modul der Datei",
"index.html und wurden unverändert übernommen:",
"  · Fünf Vokale a e i o u; Längen werden nicht unterschieden.",
"  · ב כ פ folgen dem Dagesch: b/v, k/kh, p/f. צ wird tz, ח wird ch,",
"    ק wird k, ת immer t, ש je nach Punkt sh oder s.",
"  · Alef und Ajin ohne Vokal bleiben stumm, sie erscheinen gar nicht.",
"  · Waw mit Dagesch wird u, Waw mit Cholem wird o.",
"  · Jod nach i oder e verschwindet als Lesemutter, ebenso stummes He",
"    am Wortende nach e.",
"  · Patach furtivum steht vor dem Kehllaut: רוּחַ wird ruach.",
"  · Schwa am Wortanfang wird e, sonst entfällt es.",
"  · Geresch bildet die Lehnlaute: ג׳ = j, ז׳ = zh, צ׳ = tch, ח׳ = kh.",
"  · Maqqef wird zum Bindestrich, Kantillationszeichen entfallen.",
"Beispiele: שָׁלוֹם → shalom, יְרוּשָׁלַיִם → yerushalayim,",
"מִדְרָשׁ → midrash, בְּרֵאשִׁית → bereshit.",
"Schwa-Einstellung, Lesemütter und Gemination sind bei diesem Verfahren",
"abgeschaltet, weil es eigene Regeln dafür mitbringt.",
"",
"Begadkefat: Der Unterschied b/ḇ, k/ḵ usw. hängt am Dagesch. Enthält",
"der markierte Text gar keine Punktation, verwendet das Skript",
"durchgehend die harte Form, damit unvokalisierter Text lesbar bleibt.",
"",
"Lesemütter: Jod nach Chiriq wird zu ī, Waw mit Dagesch zu ū, Waw mit",
"Cholem zu ō, stummes He am Wortende entfällt.",
"",
"Schwa: In der Einstellung „automatisch“ entscheidet das Skript nach den",
"üblichen Regeln, ob ein Schwa gesprochen (ə) oder still ist: gesprochen",
"am Wortanfang, nach langem Vokal, nach einem weiteren Schwa und unter",
"einem Konsonanten mit Dagesch forte – still am Wortende und nach kurzem",
"Vokal. Beispiel: עִבְרִית wird ʿiḇrīṯ, nicht ʿiḇərīṯ.",
"",
"Grenze: Unvokalisierter Text lässt sich nicht sicher umschreiben. שלום",
"ergibt dann šlwm, weil ohne Punktation nicht erkennbar ist, ob das Waw",
"ein Konsonant oder ein o/u ist. Für saubere Ergebnisse vokalisierten",
"Text markieren.",
"Dagesch forte verdoppeln: schreibt den Konsonanten doppelt, wenn ein",
"Dagesch im Wortinneren nach einem Vokal steht. Gutturale bleiben aus.",
"",
"VOKALISIERUNG UNPUNKTIERTER TEXTE",
"Ohne Punktation ist keine verlässliche Umschrift möglich: שלום kann shalom,",
"shilem oder shulam heißen; unbehandelt käme shlvm heraus. Die Auswahlliste",
"„Quelle“ bestimmt, woher die Punktation kommt. Das Feld über der Vorschau",
"zeigt die punktierte Fassung, auf der die Umschrift beruht.",
"",
"  aus            – der Text geht unverändert in die Umschrift.",
"  Wörterbuch     – arbeitet offline, ohne jede Verbindung. Voreinstellung.",
"  Dicta Nakdan   – fragt den Nakdan im Netz, meist treffsicherer.",
"  Nakdan, bei Ausfall das Wörterbuch – erst das Netz, sonst offline.",
"",
"DAS WÖRTERBUCH IM SKRIPT",
"Rund 12000 punktierte Wortformen aus dem hebräischen Wiktionary, übernommen",
"aus dem Datensatz von TaatikNet (github.com/morrisalp/taatiknet, CC BY-SA",
"3.0). Es steckt vollständig in dieser Datei, es ist nichts nachzuladen.",
"Der Aufbau geschieht beim ersten Gebrauch und dauert einen Wimpernschlag.",
"",
"  In drei Stufen wird gearbeitet, die Statusleiste nennt die Bilanz:",
"    1. Nachschlagen der Form selbst – מדרש wird מִדְרָשׁ.",
"    2. Vorsilben abtrennen, wenn der Rest im Wörterbuch steht:",
"       והמלך wird zu וְ + הַ + מֶלֶךְ. Abgetrennt wird nur, wenn der Rest",
"       wirklich gefunden wird, sonst würde aus מים ein מ + ים.",
"    3. Raten nach den Regeln der vollen Schreibung: ו zwischen Konsonanten",
"       gilt als o, י nach Konsonant als i, sonst steht ein a; ב כ פ im",
"       Anlaut bekommen Dagesch. Geratene Wörter stehen im Protokoll.",
"  Bei mehrdeutigen Schreibungen nimmt das Skript die Form mit der",
"  sparsamsten Punktation, also שָׁלוֹם statt שְׁלוֹם oder שִׁלּוּם. Das trifft",
"  die häufigere Lesart, aber nicht immer die im Zusammenhang richtige:",
"  ספר wird zu סֵפֶר, nie zu סַפָּר oder סָפַר.",
"  Gebeugte Formen und Suffixe stehen selten im Wörterbuch; dort hilft",
"  Nakdan deutlich weiter.",
"",
"NAKDAN VON DICTA",
"Schickt den markierten Text an nakdan.dicta.org.il und holt die punktierte",
"Fassung zurück. Der Nakdan entscheidet nach dem Zusammenhang und trifft",
"deshalb auch bei gebeugten Formen meist richtig.",
"",
"  Mit „vorhandenes Nikkud ersetzen“ wird bestehende Punktation verworfen",
"  und neu gesetzt – sinnvoll bei zweifelhafter oder lückenhafter Punktation.",
"  Stil: modern für heutiges Ivrit, rabbinisch für Mischna, Talmud und",
"  Halacha, poetisch für Pijjut und Dichtung. Die Wahl verändert das",
"  Ergebnis deutlich, etwa bei שנה oder בית.",
"  Nikkud in den Text setzen: schreibt die punktierte Fassung an die Stelle",
"  der Markierung ins Dokument – ein eigener Widerrufsschritt.",
"  Verbindung prüfen: schickt שלום עולם und zeigt Antwort und Laufzeit.",
"  Abstände und Satzzeichen stammen immer aus Ihrem Originaltext, nicht aus",
"  der Antwort des Servers. Weicht die Wortzahl ab, bricht das Skript ab und",
"  meldet es, statt lückenhaften Text einzusetzen.",
"  Wörterbuch prüfen: zeigt die Zahl der Stichwörter und eine Probe.",
"",
"  Voraussetzungen: Internetzugang. Windows bringt curl.exe seit Windows 10",
"  mit; fehlt es, weicht das Skript auf MSXML2.ServerXMLHTTP aus. Unter macOS",
"  wird /usr/bin/curl verwendet. Beim ersten Lauf fragt macOS unter Umständen",
"  nach der Erlaubnis, AppleScript auszuführen.",
"  Längere Texte werden in Abschnitte von etwa 1200 Zeichen zerlegt und",
"  nacheinander gesendet; gleiche Texte kommen innerhalb einer Sitzung aus",
"  dem Zwischenspeicher.",
"  Datenschutz: Bei Nakdan verlässt der markierte Text Ihren Rechner und",
"  wird an die Server von Dicta übertragen. Für unveröffentlichte oder",
"  vertrauliche Texte bitte das Wörterbuch wählen – es rechnet im Skript.",
"  Die Serveradresse ist änderbar, falls Dicta den Endpunkt umstellt.",
"  Bewährt haben sich:",
"    https://nakdan-u1-0.loadbalancer.dicta.org.il/api",
"    https://nakdan-5-1.loadbalancer.dicta.org.il/api",
"  Der Nakdan rät bei Mehrdeutigkeit nach Kontext und liegt nicht immer",
"  richtig, besonders bei Eigennamen und Abkürzungen. Ergebnis gegenlesen.",
"",
"Einfügen: Die Vorlage steuert, was um die Umschrift herum steht.",
"%s ist der Platzhalter, Standard ist ein Klammerausdruck.",
"Die eingefügte Umschrift bekommt eine eigene Schrift und Größe –",
"wählen Sie eine Schrift mit vollständigen Zusatzzeichen, etwa",
"Noto Sans, Charis SIL, Doulos SIL oder Brill.",
"",
"Automatische Umschrift ersetzt keine fachliche Prüfung: Qamez qatan,",
"Schwa quiescens und Gemination lassen sich nicht sicher erkennen.",
"Bitte das Ergebnis immer durchsehen.",
"",
"────────────────────────────────────────────────────────────",
"3 · STAPEL (BUCH)",
"────────────────────────────────────────────────────────────",
"Führt eine Aktion nacheinander über alle Dokumente eines Buches aus.",
"",
"Externes Skript: beliebige .js/.jsx-Datei. Sie läuft je Dokument einmal",
"und arbeitet üblicherweise mit app.activeDocument.",
"Eingebaute Typografie: wendet die Einstellungen aus Reiter 1 auf alle",
"Textketten jedes Dokuments an – ohne Zwischenschritt über eine Datei.",
"",
"Speichern und schließen: Nur Dokumente, die das Skript selbst geöffnet",
"hat, werden wieder geschlossen. Bereits offene Dokumente bleiben offen",
"und werden nur gesichert. Das ältere Skript schloss alles – dadurch",
"konnten fremde Dokumente ungewollt verschwinden.",
"Benutzerinteraktion unterdrücken: unterdrückt Rückfragen von InDesign",
"(fehlende Verknüpfungen, Schriften). Die Einstellung wird danach immer",
"zurückgesetzt, auch wenn ein Fehler auftritt.",
"",
"Fehler brechen den Lauf nicht mehr ab: Jedes Dokument wird protokolliert,",
"am Ende steht eine Bilanz im Protokollfeld.",
"",
"────────────────────────────────────────────────────────────",
"4 · DOKUMENT & LAYOUT   (neu in Version 1.1)",
"────────────────────────────────────────────────────────────",
"Legt das Grundgerüst eines Buches an: Seitenformat, Ränder, Bindung,",
"Musterseite mit Grundtextrahmen, Seitenzahlen, Absatzformate und auf",
"Wunsch einen Beispielinhalt. Der Reiter ersetzt die früheren",
"Einzelskripte A5-Midrasch, A5-MidraschHE, A5-Midrasch-mit-Seitenzahlen",
"und A5-Midrash-layout-Band-II.",
"",
"Ziel",
"  Neues Dokument   legt ein Dokument mit allen Einstellungen an.",
"  Aktives Dokument bearbeitet das offene Dokument: Ränder, Musterseite,",
"  Seitenzahlen und Formate. Seitengröße, Seitenzahl und Bindung bleiben",
"  dabei unangetastet, damit vorhandener Satz nicht verrutscht.",
"",
"Seitenformat",
"  Vorlagen A4 bis Letter, oder „frei“ mit eigenen Millimeterwerten.",
"  Querformat vertauscht Breite und Höhe.",
"  Doppelseiten schaltet den Buchmodus ein; nur dann gibt es Innen- und",
"  Außensteg und nur dann wirkt „unten außen“ bei den Seitenzahlen.",
"  Bindung rechts nach links dreht die Blätterrichtung für hebräische",
"  Bücher um: Seite 1 liegt dann rechts. Eine rückwärts laufende",
"  Nummerierung ist dafür nicht nötig – InDesign zählt trotzdem richtig.",
"",
"Ränder",
"  Innen ist der Bundsteg, außen die Vorderkante. Auf linken Buchseiten",
"  werden beide automatisch gespiegelt. Spalten und Steg gelten für die",
"  Randhilfslinien und für den Grundtextrahmen.",
"  Die Statuszeile nennt nach „Übersicht“ den fertigen Satzspiegel.",
"",
"Musterseite",
"  Grundtextrahmen legt auf der Musterseite A einen Rahmen im Satzspiegel",
"  an, mit der eingestellten Spaltenzahl. Auf den Dokumentseiten wird er",
"  mit Strg/Cmd+Umschalt+Klick gelöst und dann gefüllt.",
"  Seitenzahl: Die drei automatischen Varianten setzen ein echtes",
"  Seitenzahlfeld auf die Musterseite. Nummern bleiben dadurch richtig,",
"  wenn Seiten eingefügt oder gelöscht werden.",
"  Hebräisch א, ב, ג nutzt das Abschnittsformat von InDesign. Bietet Ihre",
"  Version es nicht an, meldet das Skript das und Sie wählen stattdessen",
"  feste hebräische Zahlen.",
"  Feste Zahlen werden als Text auf jede einzelne Seite gesetzt. Nur so",
"  ist eine rückwärts laufende Zählung möglich (letzte Seite = א bzw. 1),",
"  wie sie in manchen zweisprachigen Bänden gewünscht ist. Nachteil:",
"  Beim Einfügen neuer Seiten müssen die Zahlen neu erzeugt werden.",
"  Die Gematria zählt korrekt bis 9999, setzt 15 und 16 als טו und טז",
"  und die Trennzeichen Geresch ׳ und Gerschajim ״ regelgerecht.",
"  Abstand ist der Weg von der Seitenunterkante bis zur Zeile.",
"",
"Absatzformate",
"  Angelegt werden vier Formate mit dem eingestellten Namenszusatz:",
"  Titel, Grundtext, Kommentar, Seitenzahl. Sie verwenden die Schriften",
"  aus Reiter 1 – bei rechts-nach-links die hebräische, sonst die",
"  lateinische. Bei rechts-nach-links bekommen sie zusätzlich den",
"  World-Ready-Absatzsetzer und die Absatzrichtung rechts nach links.",
"  Gleichnamige, schon vorhandene Formate werden aktualisiert statt",
"  verdoppelt.",
"",
"Beispielinhalt",
"  Legt eine Titelseite und eine Musterseite mit Haupttext und",
"  Kommentarspalte an – gedacht zum Prüfen von Schrift, Satzspiegel und",
"  Laufrichtung. Der hebräische Beispieltext ist vokalisiert und eignet",
"  sich damit direkt zum Ausprobieren der Transliteration in Reiter 2.",
"  Für ein leeres Buchgerüst diesen Punkt einfach ausschalten.",
"",
"────────────────────────────────────────────────────────────",
"HINWEISE",
"────────────────────────────────────────────────────────────",
"· Einstellungen speichern legt eine Datei im Benutzerordner an, die",
"  beim nächsten Start wieder geladen wird.",
"· Fehlt eine Schrift, meldet das Skript den Namen und lässt die Stelle",
"  unverändert, statt abzubrechen.",
"· Externe Skripte laufen in derselben Skript-Umgebung wie diese Palette.",
"  Alle Variablen hier liegen im Objekt HT bzw. in Funktionen, daher sind",
"  Namenskonflikte unwahrscheinlich.",
"· Zum automatischen Start beim Programmstart: Datei in den Ordner",
"  Scripts/startup scripts legen.",
"· Reiter 4 stellt die Maßeinheit des bearbeiteten Dokuments auf Millimeter",
"  und den Nullpunkt auf die Seitenecke, damit alle Rahmen berechenbar sind.",
"· Alle vom Skript angelegten Rahmen tragen die Objektbezeichnung",
"  HT-Grundtextrahmen bzw. HT-Seitenzahl. Damit lassen sie sich später über",
"  Skripte oder die Objektsuche wiederfinden.",
"· Sinnvolle Reihenfolge beim Neuaufbau eines Bandes:",
"  Reiter 4 Dokument aufbauen  →  Text platzieren  →  Reiter 1 Schriften",
"  zuweisen  →  Reiter 2 Umschrift ergänzen  →  Reiter 3 über das ganze Buch."
].join("\n");

// ============================================================================
// 8 · Oberfläche
// ============================================================================

function buildUI() {
    var cfg = loadSettings();
    HT.fonts = buildFontIndex();

    var w = new Window("palette", "Hebräisch-Toolbox  ·  " + HT.VERSION, undefined,
                       { "resizeable": true });
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.margins = 12;
    w.spacing = 8;

    var tabs = w.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.preferredSize.width = 520;

    // ---------------------------------------------------------------- Reiter 1
    var t1 = tabs.add("tab", undefined, "Schriften & Absatz");
    t1.orientation = "column";
    t1.alignChildren = ["fill", "top"];
    t1.margins = 12;
    t1.spacing = 8;

    var pScope = t1.add("panel", undefined, "Bereich");
    pScope.orientation = "column";
    pScope.alignChildren = ["left", "top"];
    pScope.margins = [12, 16, 12, 10];
    var rowScope = pScope.add("group");
    var rbSel = rowScope.add("radiobutton", undefined, "Auswahl");
    var rbSto = rowScope.add("radiobutton", undefined, "Textkette");
    var rbDoc = rowScope.add("radiobutton", undefined, "Dokument");
    var cbNested = pScope.add("checkbox", undefined, "Tabellen und Fußnoten einbeziehen");

    var pFonts = t1.add("panel", undefined, "Schriften");
    pFonts.orientation = "column";
    pFonts.alignChildren = ["fill", "top"];
    pFonts.margins = [12, 16, 12, 10];
    var cbFonts = pFonts.add("checkbox", undefined, "Schriften zuweisen");

    var gHeb = pFonts.add("group");
    gHeb.add("statictext", undefined, "Hebräisch:").preferredSize.width = 75;
    var ddHebFam = gHeb.add("dropdownlist", undefined, HT.fonts.families);
    ddHebFam.preferredSize.width = 230;
    var ddHebSty = gHeb.add("dropdownlist", undefined, []);
    ddHebSty.preferredSize.width = 130;

    var gLat = pFonts.add("group");
    gLat.add("statictext", undefined, "Lateinisch:").preferredSize.width = 75;
    var ddLatFam = gLat.add("dropdownlist", undefined, HT.fonts.families);
    ddLatFam.preferredSize.width = 230;
    var ddLatSty = gLat.add("dropdownlist", undefined, []);
    ddLatSty.preferredSize.width = 130;

    var gNeu = pFonts.add("group");
    gNeu.add("statictext", undefined, "Ziffern, Satzzeichen, Leerraum:");
    var ddNeutral = gNeu.add("dropdownlist", undefined, optionLabels(HT.neutralOptions));
    ddNeutral.preferredSize.width = 190;

    var pChar = t1.add("panel", undefined, "Zeichenformat");
    pChar.orientation = "column";
    pChar.alignChildren = ["left", "top"];
    pChar.margins = [12, 16, 12, 10];
    var gSize = pChar.add("group");
    var cbSize = gSize.add("checkbox", undefined, "Schriftgrad");
    var etSize = gSize.add("edittext", undefined, "9");
    etSize.characters = 5;
    gSize.add("statictext", undefined, "pt");
    var cbHebSize = gSize.add("checkbox", undefined, "eigener Grad für Hebräisch");
    var etHebSize = gSize.add("edittext", undefined, "10");
    etHebSize.characters = 5;
    gSize.add("statictext", undefined, "pt");

    var gLead = pChar.add("group");
    var cbLead = gLead.add("checkbox", undefined, "Zeilenabstand");
    var etLead = gLead.add("edittext", undefined, "11");
    etLead.characters = 5;
    gLead.add("statictext", undefined, "pt");

    var pPara = t1.add("panel", undefined, "Absatzformat");
    pPara.orientation = "column";
    pPara.alignChildren = ["left", "top"];
    pPara.margins = [12, 16, 12, 10];
    var gJust = pPara.add("group");
    var cbJust = gJust.add("checkbox", undefined, "Ausrichtung");
    cbJust.preferredSize.width = 110;
    var ddJust = gJust.add("dropdownlist", undefined, optionLabels(HT.justOptions));
    ddJust.preferredSize.width = 260;
    var gComp = pPara.add("group");
    var cbComp = gComp.add("checkbox", undefined, "Setzer");
    cbComp.preferredSize.width = 110;
    var ddComp = gComp.add("dropdownlist", undefined, optionLabels(HT.composerOptions));
    ddComp.preferredSize.width = 260;
    var gDir = pPara.add("group");
    var cbDir = gDir.add("checkbox", undefined, "Absatzrichtung");
    cbDir.preferredSize.width = 110;
    var ddDir = gDir.add("dropdownlist", undefined,
                         ["links nach rechts", "rechts nach links"]);
    ddDir.preferredSize.width = 260;

    var gBtn1 = t1.add("group");
    gBtn1.alignment = ["right", "top"];
    var btnAnalyze = gBtn1.add("button", undefined, "Analysieren");
    var btnApply = gBtn1.add("button", undefined, "Anwenden");

    // ---------------------------------------------------------------- Reiter 2
    var t2 = tabs.add("tab", undefined, "Transliteration");
    t2.orientation = "column";
    t2.alignChildren = ["fill", "top"];
    t2.margins = 12;
    t2.spacing = 8;

    var pMode = t2.add("panel", undefined, "Umschrift");
    pMode.orientation = "column";
    pMode.alignChildren = ["left", "top"];
    pMode.margins = [12, 16, 12, 10];
    var gMode = pMode.add("group");
    gMode.add("statictext", undefined, "Verfahren:").preferredSize.width = 60;
    var ddTrMode = gMode.add("dropdownlist", undefined, optionLabels(HT.trModeOptions));
    ddTrMode.preferredSize.width = 300;
    var gShva = pMode.add("group");
    gShva.add("statictext", undefined, "Schwa:").preferredSize.width = 60;
    var ddShva = gShva.add("dropdownlist", undefined, optionLabels(HT.shvaOptions));
    ddShva.preferredSize.width = 180;
    var cbMatres = pMode.add("checkbox", undefined, "Lesemütter berücksichtigen (ī, ō, ū, stummes He)");
    var cbDouble = pMode.add("checkbox", undefined, "Dagesch forte verdoppeln");

    var pNak = t2.add("panel", undefined, "Vokalisierung unpunktierter Texte");
    pNak.orientation = "column";
    pNak.alignChildren = ["left", "top"];
    pNak.margins = [12, 16, 12, 10];
    var gVoc = pNak.add("group");
    gVoc.add("statictext", undefined, "Quelle:").preferredSize.width = 60;
    var ddVocal = gVoc.add("dropdownlist", undefined, optionLabels(HT.vocalOptions));
    ddVocal.preferredSize.width = 260;
    var cbNakForce = gVoc.add("checkbox", undefined, "vorhandenes Nikkud ersetzen");
    var gNak1 = pNak.add("group");
    gNak1.add("statictext", undefined, "Stil:").preferredSize.width = 60;
    var ddGenre = gNak1.add("dropdownlist", undefined, optionLabels(HT.genreOptions));
    ddGenre.preferredSize.width = 260;
    gNak1.add("statictext", undefined, "(nur Nakdan)");
    var gNak2 = pNak.add("group");
    gNak2.add("statictext", undefined, "Server:").preferredSize.width = 60;
    var etNakUrl = gNak2.add("edittext", undefined, "");
    etNakUrl.characters = 46;
    var gNak3 = pNak.add("group");
    var btnDicInfo = gNak3.add("button", undefined, "Wörterbuch prüfen");
    var btnNakTest = gNak3.add("button", undefined, "Verbindung prüfen");
    var btnNakApply = gNak3.add("button", undefined, "Nikkud in den Text setzen");
    var stNakHint = pNak.add("statictext", undefined,
        "Wörterbuch arbeitet offline. Nakdan überträgt den markierten Text an Dicta.");

    var pIns = t2.add("panel", undefined, "Einfügen");
    pIns.orientation = "column";
    pIns.alignChildren = ["left", "top"];
    pIns.margins = [12, 16, 12, 10];
    var gPlace = pIns.add("group");
    gPlace.add("statictext", undefined, "Position:").preferredSize.width = 60;
    var ddPlace = gPlace.add("dropdownlist", undefined, optionLabels(HT.placementOptions));
    ddPlace.preferredSize.width = 250;
    var gTpl = pIns.add("group");
    gTpl.add("statictext", undefined, "Vorlage:").preferredSize.width = 60;
    var etTpl = gTpl.add("edittext", undefined, " [%s]");
    etTpl.characters = 18;
    gTpl.add("statictext", undefined, "%s = Umschrift");

    var gTrFont = pIns.add("group");
    gTrFont.add("statictext", undefined, "Schrift:").preferredSize.width = 60;
    var ddTrFam = gTrFont.add("dropdownlist", undefined, HT.fonts.families);
    ddTrFam.preferredSize.width = 190;
    var ddTrSty = gTrFont.add("dropdownlist", undefined, []);
    ddTrSty.preferredSize.width = 110;
    var etTrSize = gTrFont.add("edittext", undefined, "6");
    etTrSize.characters = 4;
    gTrFont.add("statictext", undefined, "pt");

    var pPrev = t2.add("panel", undefined, "Vorschau");
    pPrev.orientation = "column";
    pPrev.alignChildren = ["fill", "top"];
    pPrev.margins = [12, 16, 12, 10];
    var etNikkud = pPrev.add("edittext", undefined, "", { "readonly": true });
    etNikkud.helpTip = "Vokalisierte Fassung, die der Umschrift zugrunde liegt";
    var etPrev = pPrev.add("edittext", undefined, "",
                           { "multiline": true, "readonly": true });
    etPrev.preferredSize.height = 60;

    var gBtn2 = t2.add("group");
    gBtn2.alignment = ["right", "top"];
    var btnPreview = gBtn2.add("button", undefined, "Vorschau");
    var btnInsert = gBtn2.add("button", undefined, "Einfügen");

    // ---------------------------------------------------------------- Reiter 3
    var t3 = tabs.add("tab", undefined, "Stapel (Buch)");
    t3.orientation = "column";
    t3.alignChildren = ["fill", "top"];
    t3.margins = 12;
    t3.spacing = 8;

    var pBook = t3.add("panel", undefined, "Buch");
    pBook.orientation = "column";
    pBook.alignChildren = ["left", "top"];
    pBook.margins = [12, 16, 12, 10];
    var gBook = pBook.add("group");
    gBook.add("statictext", undefined, "Buch:").preferredSize.width = 45;
    var ddBook = gBook.add("dropdownlist", undefined, bookNames());
    ddBook.preferredSize.width = 280;
    var btnRefresh = gBook.add("button", undefined, "Aktualisieren");
    var cbAllBooks = pBook.add("checkbox", undefined, "Alle geöffneten Bücher verarbeiten");

    var pAction = t3.add("panel", undefined, "Aktion je Dokument");
    pAction.orientation = "column";
    pAction.alignChildren = ["left", "top"];
    pAction.margins = [12, 16, 12, 10];
    var rbExt = pAction.add("radiobutton", undefined, "Externes Skript ausführen");
    var gScript = pAction.add("group");
    var etScript = gScript.add("edittext", undefined, "");
    etScript.characters = 42;
    var btnBrowse = gScript.add("button", undefined, "Wählen …");
    var rbTypo = pAction.add("radiobutton", undefined,
                             "Einstellungen aus Reiter 1 auf alle Textketten anwenden");

    var pOpts = t3.add("panel", undefined, "Optionen");
    pOpts.orientation = "column";
    pOpts.alignChildren = ["left", "top"];
    pOpts.margins = [12, 16, 12, 10];
    var cbSaveClose = pOpts.add("checkbox", undefined,
                                "Dokumente speichern und wieder schließen");
    var cbSilent = pOpts.add("checkbox", undefined,
                             "Benutzerinteraktion unterdrücken (keine Rückfragen)");

    var pLog = t3.add("panel", undefined, "Protokoll");
    pLog.orientation = "column";
    pLog.alignChildren = ["fill", "top"];
    pLog.margins = [12, 16, 12, 10];
    var etLog = pLog.add("edittext", undefined, "",
                         { "multiline": true, "readonly": true, "scrolling": true });
    etLog.preferredSize.height = 120;

    var gBtn3 = t3.add("group");
    gBtn3.alignment = ["right", "top"];
    var btnClearLog = gBtn3.add("button", undefined, "Protokoll leeren");
    var btnRun = gBtn3.add("button", undefined, "Stapel starten");

    // ---------------------------------------------------------------- Reiter 4
    var t4 = tabs.add("tab", undefined, "Dokument & Layout");
    t4.orientation = "column";
    t4.alignChildren = ["fill", "top"];
    t4.margins = 12;
    t4.spacing = 6;

    var pTarget = t4.add("panel", undefined, "Ziel");
    pTarget.orientation = "row";
    pTarget.alignChildren = ["left", "center"];
    pTarget.margins = [12, 16, 12, 10];
    var rbDocNew = pTarget.add("radiobutton", undefined, "Neues Dokument anlegen");
    var rbDocAct = pTarget.add("radiobutton", undefined,
                               "Aktives Dokument bearbeiten (ohne Seitengröße)");

    var pPage = t4.add("panel", undefined, "Seitenformat");
    pPage.orientation = "column";
    pPage.alignChildren = ["left", "top"];
    pPage.margins = [12, 16, 12, 10];
    var gPreset = pPage.add("group");
    gPreset.add("statictext", undefined, "Format:").preferredSize.width = 60;
    var ddPreset = gPreset.add("dropdownlist", undefined, HT.presetNames);
    ddPreset.preferredSize.width = 175;
    gPreset.add("statictext", undefined, "Breite");
    var etDocW = gPreset.add("edittext", undefined, "148");
    etDocW.characters = 6;
    gPreset.add("statictext", undefined, "Höhe");
    var etDocH = gPreset.add("edittext", undefined, "210");
    etDocH.characters = 6;
    gPreset.add("statictext", undefined, "mm");

    var gPage2 = pPage.add("group");
    gPage2.add("statictext", undefined, "Seiten:").preferredSize.width = 60;
    var etDocPages = gPage2.add("edittext", undefined, "50");
    etDocPages.characters = 6;
    var cbLandscape = gPage2.add("checkbox", undefined, "Querformat");
    var cbFacing = gPage2.add("checkbox", undefined, "Doppelseiten");

    var gBind = pPage.add("group");
    gBind.add("statictext", undefined, "Bindung:").preferredSize.width = 60;
    var ddBinding = gBind.add("dropdownlist", undefined, optionLabels(HT.bindingOptions));
    ddBinding.preferredSize.width = 280;

    var pMargins = t4.add("panel", undefined, "Ränder und Spalten (mm)");
    pMargins.orientation = "column";
    pMargins.alignChildren = ["left", "top"];
    pMargins.margins = [12, 16, 12, 10];
    var gM1 = pMargins.add("group");
    gM1.add("statictext", undefined, "oben");
    var etMT = gM1.add("edittext", undefined, "18"); etMT.characters = 5;
    gM1.add("statictext", undefined, "unten");
    var etMB = gM1.add("edittext", undefined, "20"); etMB.characters = 5;
    gM1.add("statictext", undefined, "innen");
    var etMI = gM1.add("edittext", undefined, "20"); etMI.characters = 5;
    gM1.add("statictext", undefined, "außen");
    var etMO = gM1.add("edittext", undefined, "15"); etMO.characters = 5;
    var gM2 = pMargins.add("group");
    gM2.add("statictext", undefined, "Spalten");
    var etCols = gM2.add("edittext", undefined, "1"); etCols.characters = 5;
    gM2.add("statictext", undefined, "Spaltensteg");
    var etGutter = gM2.add("edittext", undefined, "5"); etGutter.characters = 5;
    var cbMasterFrame = gM2.add("checkbox", undefined,
                                "Grundtextrahmen auf Musterseite");

    var pNum = t4.add("panel", undefined, "Seitenzahlen");
    pNum.orientation = "column";
    pNum.alignChildren = ["left", "top"];
    pNum.margins = [12, 16, 12, 10];
    var cbNumbers = pNum.add("checkbox", undefined, "Seitenzahlen anlegen");
    var gN1 = pNum.add("group");
    gN1.add("statictext", undefined, "Art:").preferredSize.width = 55;
    var ddNumStyle = gN1.add("dropdownlist", undefined, optionLabels(HT.numStyleOptions));
    ddNumStyle.preferredSize.width = 300;
    var gN2 = pNum.add("group");
    gN2.add("statictext", undefined, "Position:").preferredSize.width = 55;
    var ddNumPos = gN2.add("dropdownlist", undefined, optionLabels(HT.numPosOptions));
    ddNumPos.preferredSize.width = 160;
    gN2.add("statictext", undefined, "Abstand");
    var etNumDist = gN2.add("edittext", undefined, "10"); etNumDist.characters = 4;
    gN2.add("statictext", undefined, "mm");
    gN2.add("statictext", undefined, "Grad");
    var etNumSize = gN2.add("edittext", undefined, "9"); etNumSize.characters = 4;
    gN2.add("statictext", undefined, "pt");
    var cbNumHeb = pNum.add("checkbox", undefined,
                            "Seitenzahl in hebräischer Schrift aus Reiter 1 setzen");

    var pDocStyles = t4.add("panel", undefined, "Absatzformate und Beispielinhalt");
    pDocStyles.orientation = "column";
    pDocStyles.alignChildren = ["left", "top"];
    pDocStyles.margins = [12, 16, 12, 10];
    var gS1 = pDocStyles.add("group");
    var cbDocStyles = gS1.add("checkbox", undefined, "Formate anlegen, Namenszusatz");
    var etPrefix = gS1.add("edittext", undefined, "HT "); etPrefix.characters = 6;
    gS1.add("statictext", undefined, "Titel");
    var etTitleSize = gS1.add("edittext", undefined, "20"); etTitleSize.characters = 4;
    gS1.add("statictext", undefined, "Text");
    var etBodySize = gS1.add("edittext", undefined, "12"); etBodySize.characters = 4;
    gS1.add("statictext", undefined, "Komm.");
    var etCommentSize = gS1.add("edittext", undefined, "9"); etCommentSize.characters = 4;
    gS1.add("statictext", undefined, "pt");
    var gS2 = pDocStyles.add("group");
    var cbSample = gS2.add("checkbox", undefined, "Beispielinhalt, Sprache");
    var ddSampleLang = gS2.add("dropdownlist", undefined, optionLabels(HT.sampleLangOptions));
    ddSampleLang.preferredSize.width = 150;
    gS2.add("statictext", undefined, "Titel:");
    var etDocTitle = gS2.add("edittext", undefined, ""); etDocTitle.characters = 18;

    var gBtn4 = t4.add("group");
    gBtn4.alignment = ["right", "top"];
    var btnDocInfo = gBtn4.add("button", undefined, "Übersicht");
    var btnDocBuild = gBtn4.add("button", undefined, "Dokument aufbauen");

    // ---------------------------------------------------------------- Reiter 5
    var t5 = tabs.add("tab", undefined, "Hilfe");
    t5.orientation = "column";
    t5.alignChildren = ["fill", "fill"];
    t5.margins = 12;
    var etHelp = t5.add("edittext", undefined, HT.helpText,
                        { "multiline": true, "readonly": true, "scrolling": true });
    etHelp.preferredSize.height = 420;

    // ---------------------------------------------------------------- Fußzeile
    var footer = w.add("group");
    footer.alignChildren = ["left", "center"];
    var stStatus = footer.add("statictext", undefined, "Bereit.",
                              { "truncate": "end" });
    stStatus.preferredSize.width = 260;
    var spacer = footer.add("group");
    spacer.alignment = ["fill", "center"];
    var btnSave = footer.add("button", undefined, "Einstellungen speichern");
    var btnReset = footer.add("button", undefined, "Zurücksetzen");
    var btnClose = footer.add("button", undefined, "Schließen");

    // ------------------------------------------------------------ Hilfsroutinen
    function status(msg) {
        stStatus.text = msg;
        try { w.update(); } catch (e) {}
    }
    function logLine(msg) {
        etLog.text = etLog.text + msg + "\n";
        try { w.update(); } catch (e) {}
    }

    function fillStyles(ddFam, ddSty, family, style) {
        var styles = HT.fonts.map.hasOwnProperty(family) ? HT.fonts.map[family] : [style];
        var i;
        ddSty.removeAll();
        for (i = 0; i < styles.length; i++) ddSty.add("item", styles[i]);
        var idx = inArray(styles, style);
        ddSty.selection = (idx >= 0) ? idx : 0;
    }

    function selectFamily(dd, family) {
        var i;
        for (i = 0; i < dd.items.length; i++) {
            if (dd.items[i].text === family) { dd.selection = i; return true; }
        }
        // Nicht installierte Schrift trotzdem anbieten
        dd.add("item", family + "  (nicht installiert)");
        dd.selection = dd.items.length - 1;
        return false;
    }

    function familyOf(dd) {
        if (!dd.selection) return "";
        return String(dd.selection.text).replace("  (nicht installiert)", "");
    }

    // ------------------------------------------------------------ UI befüllen
    function writeUI(c) {
        rbSel.value = (c.scope === "selection");
        rbSto.value = (c.scope === "story");
        rbDoc.value = (c.scope === "document");
        cbNested.value = c.includeTables;

        cbFonts.value = c.applyFonts;
        selectFamily(ddHebFam, c.hebFamily);
        fillStyles(ddHebFam, ddHebSty, c.hebFamily, c.hebStyle);
        selectFamily(ddLatFam, c.latFamily);
        fillStyles(ddLatFam, ddLatSty, c.latFamily, c.latStyle);
        ddNeutral.selection = optionIndex(HT.neutralOptions, c.neutralMode);

        cbSize.value = c.applySize;
        etSize.text = String(c.size);
        cbHebSize.value = c.sepHebSize;
        etHebSize.text = String(c.hebSize);
        cbLead.value = c.applyLeading;
        etLead.text = String(c.leading);

        cbJust.value = c.applyJust;
        ddJust.selection = optionIndex(HT.justOptions, c.just);
        cbComp.value = c.applyComposer;
        ddComp.selection = optionIndex(HT.composerOptions, c.composer);
        cbDir.value = c.applyDirection;
        ddDir.selection = (c.direction === "rtl") ? 1 : 0;

        ddTrMode.selection = optionIndex(HT.trModeOptions, c.trMode);
        ddShva.selection = optionIndex(HT.shvaOptions, c.trShva);
        cbMatres.value = c.trMatres;
        cbDouble.value = c.trDouble;
        ddPlace.selection = optionIndex(HT.placementOptions, c.trPlacement);
        etTpl.text = c.trTemplate;
        selectFamily(ddTrFam, c.trFamily);
        fillStyles(ddTrFam, ddTrSty, c.trFamily, c.trStyle);
        etTrSize.text = String(c.trSize);

        ddVocal.selection = optionIndex(HT.vocalOptions, c.vocalMode);
        ddGenre.selection = optionIndex(HT.genreOptions, c.nakdanGenre);
        cbNakForce.value = c.nakdanForce;
        etNakUrl.text = c.nakdanUrl;

        cbAllBooks.value = c.batchAllBooks;
        if (c.batchBook !== "") {
            for (var i = 0; i < ddBook.items.length; i++) {
                if (ddBook.items[i].text === c.batchBook) { ddBook.selection = i; break; }
            }
        }
        if (!ddBook.selection && ddBook.items.length > 0) ddBook.selection = 0;
        rbExt.value = (c.batchAction === "external");
        rbTypo.value = (c.batchAction === "typography");
        etScript.text = c.batchScript;
        cbSaveClose.value = c.batchSaveClose;
        cbSilent.value = c.batchSilent;

        rbDocNew.value = (c.docTarget !== "active");
        rbDocAct.value = (c.docTarget === "active");
        var pi = inArray(HT.presetNames, c.docPreset);
        ddPreset.selection = (pi >= 0) ? pi : HT.presetNames.length - 1;
        etDocW.text = String(c.docWidth);
        etDocH.text = String(c.docHeight);
        cbLandscape.value = c.docLandscape;
        etDocPages.text = String(c.docPages);
        cbFacing.value = c.docFacing;
        ddBinding.selection = optionIndex(HT.bindingOptions, c.docBinding);
        etMT.text = String(c.docMarginTop);
        etMB.text = String(c.docMarginBottom);
        etMI.text = String(c.docMarginInside);
        etMO.text = String(c.docMarginOutside);
        etCols.text = String(c.docColumns);
        etGutter.text = String(c.docGutter);
        cbMasterFrame.value = c.docMasterFrame;
        cbNumbers.value = c.docPageNumbers;
        ddNumStyle.selection = optionIndex(HT.numStyleOptions, c.docNumStyle);
        ddNumPos.selection = optionIndex(HT.numPosOptions, c.docNumPos);
        etNumDist.text = String(c.docNumDistance);
        etNumSize.text = String(c.docNumSize);
        cbNumHeb.value = c.docNumHebFont;
        cbDocStyles.value = c.docStyles;
        etPrefix.text = c.docStylePrefix;
        etTitleSize.text = String(c.docTitleSize);
        etBodySize.text = String(c.docBodySize);
        etCommentSize.text = String(c.docCommentSize);
        cbSample.value = c.docSample;
        ddSampleLang.selection = optionIndex(HT.sampleLangOptions, c.docSampleLang);
        etDocTitle.text = c.docTitleText;

        syncEnabled();
    }

    function readUI() {
        var c = {};
        c.scope = rbDoc.value ? "document" : (rbSto.value ? "story" : "selection");
        c.includeTables = cbNested.value;

        c.applyFonts = cbFonts.value;
        c.hebFamily = familyOf(ddHebFam);
        c.hebStyle = ddHebSty.selection ? String(ddHebSty.selection.text) : "Regular";
        c.latFamily = familyOf(ddLatFam);
        c.latStyle = ddLatSty.selection ? String(ddLatSty.selection.text) : "Regular";
        c.neutralMode = HT.neutralOptions[ddNeutral.selection.index][1];

        c.applySize = cbSize.value;
        c.size = toNum(etSize.text, 9);
        c.sepHebSize = cbHebSize.value;
        c.hebSize = toNum(etHebSize.text, c.size);
        c.applyLeading = cbLead.value;
        c.leading = toNum(etLead.text, 11);

        c.applyJust = cbJust.value;
        c.just = HT.justOptions[ddJust.selection.index][1];
        c.applyComposer = cbComp.value;
        c.composer = HT.composerOptions[ddComp.selection.index][1];
        c.applyDirection = cbDir.value;
        c.direction = (ddDir.selection.index === 1) ? "rtl" : "ltr";

        c.trMode = HT.trModeOptions[ddTrMode.selection.index][1];
        c.trShva = HT.shvaOptions[ddShva.selection.index][1];
        c.trMatres = cbMatres.value;
        c.trDouble = cbDouble.value;
        c.trPlacement = HT.placementOptions[ddPlace.selection.index][1];
        c.trTemplate = etTpl.text;
        c.trFamily = familyOf(ddTrFam);
        c.trStyle = ddTrSty.selection ? String(ddTrSty.selection.text) : "Regular";
        c.trSize = toNum(etTrSize.text, 6);

        c.vocalMode = HT.vocalOptions[ddVocal.selection.index][1];
        c.nakdanGenre = HT.genreOptions[ddGenre.selection.index][1];
        c.nakdanForce = cbNakForce.value;
        c.nakdanUrl = etNakUrl.text;

        c.batchAllBooks = cbAllBooks.value;
        c.batchBook = ddBook.selection ? String(ddBook.selection.text) : "";
        c.batchAction = rbTypo.value ? "typography" : "external";
        c.batchScript = etScript.text;
        c.batchSaveClose = cbSaveClose.value;
        c.batchSilent = cbSilent.value;

        c.docTarget = rbDocAct.value ? "active" : "new";
        c.docPreset = ddPreset.selection ? String(ddPreset.selection.text) : "frei";
        c.docWidth = toNum(etDocW.text, 148);
        c.docHeight = toNum(etDocH.text, 210);
        c.docLandscape = cbLandscape.value;
        c.docPages = Math.max(1, Math.round(toNum(etDocPages.text, 50)));
        c.docFacing = cbFacing.value;
        c.docBinding = HT.bindingOptions[ddBinding.selection.index][1];
        c.docMarginTop = toNum(etMT.text, 18);
        c.docMarginBottom = toNum(etMB.text, 20);
        c.docMarginInside = toNum(etMI.text, 20);
        c.docMarginOutside = toNum(etMO.text, 15);
        c.docColumns = Math.max(1, Math.round(toNum(etCols.text, 1)));
        c.docGutter = toNum(etGutter.text, 5);
        c.docMasterFrame = cbMasterFrame.value;
        c.docPageNumbers = cbNumbers.value;
        c.docNumStyle = HT.numStyleOptions[ddNumStyle.selection.index][1];
        c.docNumPos = HT.numPosOptions[ddNumPos.selection.index][1];
        c.docNumDistance = toNum(etNumDist.text, 10);
        c.docNumSize = toNum(etNumSize.text, 9);
        c.docNumHebFont = cbNumHeb.value;
        c.docStyles = cbDocStyles.value;
        c.docStylePrefix = etPrefix.text;
        c.docTitleSize = toNum(etTitleSize.text, 20);
        c.docBodySize = toNum(etBodySize.text, 12);
        c.docCommentSize = toNum(etCommentSize.text, 9);
        c.docSample = cbSample.value;
        c.docSampleLang = HT.sampleLangOptions[ddSampleLang.selection.index][1];
        c.docTitleText = etDocTitle.text;
        return c;
    }

    function syncEnabled() {
        ddHebFam.enabled = ddHebSty.enabled = ddLatFam.enabled =
            ddLatSty.enabled = ddNeutral.enabled = cbFonts.value;
        etSize.enabled = cbSize.value;
        cbHebSize.enabled = cbSize.value;
        etHebSize.enabled = cbSize.value && cbHebSize.value;
        etLead.enabled = cbLead.value;
        ddJust.enabled = cbJust.value;
        ddComp.enabled = cbComp.value;
        ddDir.enabled = cbDir.value;
        ddBook.enabled = !cbAllBooks.value;
        etScript.enabled = btnBrowse.enabled = rbExt.value;
        etTpl.enabled = (ddPlace.selection && ddPlace.selection.index !== 3);

        // Schwa-Regel, Lesemütter und Gemination gelten nur für die beiden
        // buchstabengetreuen Verfahren; Ivrit bringt eigene Regeln mit.
        var ivrit = (ddTrMode.selection &&
                     HT.trModeOptions[ddTrMode.selection.index][1] === "ivrit");
        ddShva.enabled = cbMatres.enabled = cbDouble.enabled = !ivrit;

        var vm = ddVocal.selection ? HT.vocalOptions[ddVocal.selection.index][1] : "dict";
        var netz = (vm === "nakdan" || vm === "nakdan_dict");
        ddGenre.enabled = etNakUrl.enabled = btnNakTest.enabled = netz;
        cbNakForce.enabled = (vm !== "off");

        var freeSize = (ddPreset.selection &&
                        HT.pagePresets[String(ddPreset.selection.text)] === null);
        var newDoc = rbDocNew.value;
        etDocW.enabled = etDocH.enabled = newDoc && freeSize;
        ddPreset.enabled = etDocPages.enabled = cbLandscape.enabled =
            cbFacing.enabled = ddBinding.enabled = newDoc;
        ddNumStyle.enabled = ddNumPos.enabled = etNumDist.enabled =
            etNumSize.enabled = cbNumHeb.enabled = cbNumbers.value;
        ddNumPos.enabled = cbNumbers.value && cbFacing.value;
        etPrefix.enabled = etTitleSize.enabled = etBodySize.enabled =
            etCommentSize.enabled = cbDocStyles.value;
        ddSampleLang.enabled = etDocTitle.enabled = cbSample.value;
    }

    // ------------------------------------------------------------ Ereignisse
    ddHebFam.onChange = function () {
        fillStyles(ddHebFam, ddHebSty, familyOf(ddHebFam), "Regular");
    };
    ddLatFam.onChange = function () {
        fillStyles(ddLatFam, ddLatSty, familyOf(ddLatFam), "Regular");
    };
    ddTrFam.onChange = function () {
        fillStyles(ddTrFam, ddTrSty, familyOf(ddTrFam), "Regular");
    };
    cbFonts.onClick = cbSize.onClick = cbHebSize.onClick = cbLead.onClick =
        cbJust.onClick = cbComp.onClick = cbDir.onClick = cbAllBooks.onClick =
        rbExt.onClick = rbTypo.onClick = syncEnabled;
    ddPlace.onChange = syncEnabled;
    ddVocal.onChange = syncEnabled;
    /* Stil und Server bestimmen das Ergebnis – bei Wechsel den
       Zwischenspeicher verwerfen, damit keine alte Fassung hängen bleibt. */
    ddGenre.onChange = function () { HT.NK.cache = {}; };
    etNakUrl.onChange = function () { HT.NK.cache = {}; };
    ddTrMode.onChange = function () {
        syncEnabled();
        var m = HT.trModeOptions[ddTrMode.selection.index][1];
        if (m === "ivrit") {
            status("Modernes Ivrit: Aussprache von heute, nicht buchstabengetreu.");
        }
    };

    cbNumbers.onClick = cbDocStyles.onClick = cbSample.onClick =
        cbFacing.onClick = rbDocNew.onClick = rbDocAct.onClick = syncEnabled;

    ddPreset.onChange = function () {
        var key = String(ddPreset.selection.text);
        var size = HT.pagePresets[key];
        if (size) { etDocW.text = String(size[0]); etDocH.text = String(size[1]); }
        syncEnabled();
    };

    ddBinding.onChange = function () {
        // Hebräische Bücher laufen fast immer rechts nach links – dann ist die
        // hebräische Schrift für Seitenzahlen die naheliegende Wahl.
        if (ddBinding.selection.index === 1 && !cbNumHeb.value) {
            cbNumHeb.value = true;
            status("Bindung rechts nach links: Seitenzahl auf hebräische Schrift gestellt.");
        }
    };

    btnAnalyze.onClick = function () {
        if (app.documents.length === 0) { status("Kein Dokument geöffnet."); return; }
        var c = readUI();
        var a = analyzeSelection(c);
        if (a.targets === 0) { status("Nichts gefunden – bitte Text markieren."); return; }
        status(a.chars + " Zeichen · hebräisch " + a.heb + " · lateinisch " + a.lat +
               " · sonstige " + a.neu + " · " + a.paras + " Absätze");
    };

    btnApply.onClick = function () {
        if (app.documents.length === 0) { status("Kein Dokument geöffnet."); return; }
        var c = readUI();
        var targets = collectTargets(c);
        if (targets.length === 0) {
            status(c.scope === "document" ? "Dokument enthält keinen Text."
                                          : "Bitte zuerst Text markieren.");
            return;
        }
        var messages = [];
        function collect(m) { messages.push(m); }
        var res = null;
        try {
            app.doScript(function () { res = applyTypography(c, targets, collect); },
                         ScriptLanguage.JAVASCRIPT, undefined,
                         UndoModes.ENTIRE_SCRIPT, "Schriften & Absatz zuweisen");
        } catch (e) { status("Fehler: " + e); return; }
        var msg = "Fertig: " + res.texts + " Textbereiche, " + res.paragraphs + " Absätze.";
        if (messages.length > 0) msg += "  Hinweis: " + messages[0];
        status(msg);
    };

    /* Holt den markierten Text und schickt ihn bei Bedarf durch Nakdan.
       Gibt { text, used, failed } zurück oder null, wenn nichts markiert ist. */
    function preparedSource(c) {
        var src = transliterationSource();
        if (!src) return null;
        if ((c.vocalMode === "nakdan" || c.vocalMode === "nakdan_dict") &&
            hasHebrew(src.text) && (c.nakdanForce || !hasNikkud(src.text))) {
            status("Nakdan wird angefragt …");
        }
        var prep = vocalizePrepare(c, src.text, logLine);
        prep.obj = src.obj;
        etNikkud.text = prep.used ? prep.text : "";
        return prep;
    }

    /* Kurzmeldung zur Herkunft der Punktation. */
    function vocalNote(prep) {
        if (prep.failed) return "Vokalisierung fehlgeschlagen – Protokoll in Reiter 3.";
        if (!prep.used) return "";
        if (prep.source === "nakdan") return "über Nakdan vokalisiert";
        return "über das Wörterbuch vokalisiert · " + statsText(prep.stats);
    }

    btnPreview.onClick = function () {
        if (app.documents.length === 0) { status("Kein Dokument geöffnet."); return; }
        var c = readUI();
        var prep = preparedSource(c);
        if (!prep) { status("Bitte hebräischen Text markieren."); return; }
        etPrev.text = transliterate(prep.text, c);
        var note = vocalNote(prep);
        status(note ? ("Vorschau: " + note) : "Vorschau erzeugt.");
        if (prep.stats && prep.stats.guess > 0) {
            logLine("Geratene Wörter: " + prep.stats.guessList.join(", ") +
                    (prep.stats.guess > prep.stats.guessList.length ? " …" : ""));
        }
    };

    btnInsert.onClick = function () {
        if (app.documents.length === 0) { status("Kein Dokument geöffnet."); return; }
        var c = readUI();
        var out = null, note = "";
        function collect(m) { note = m; }

        // Netzzugriff bewusst vor dem Widerrufsschritt
        var prep = preparedSource(c);
        if (!prep) { status("Bitte hebräischen Text markieren."); return; }

        if (c.trPlacement === "preview") {
            etPrev.text = transliterate(prep.text, c);
            status("Nur Vorschau – nichts eingefügt.");
            return;
        }
        try {
            app.doScript(function () { out = insertTransliteration(c, collect, prep.text); },
                         ScriptLanguage.JAVASCRIPT, undefined,
                         UndoModes.ENTIRE_SCRIPT, "Transliteration einfügen");
        } catch (e) { status("Fehler: " + e); return; }
        if (out === false || out === null) { status(note || "Nichts eingefügt."); return; }
        etPrev.text = out;
        var vn = vocalNote(prep);
        if (note) status(note);
        else status(vn ? ("Umschrift eingefügt, " + vn) : "Umschrift eingefügt.");
    };

    btnDicInfo.onClick = function () {
        status("Wörterbuch wird aufgebaut …");
        var t0 = new Date().getTime();
        var n = dicLoad();
        var ms = new Date().getTime() - t0;
        var probe = "\u05de\u05d3\u05e8\u05e9 \u05d5\u05d4\u05de\u05dc\u05da";   // מדרש והמלך
        var st = newStats();
        var v = vocalizeOffline(probe, false, st);
        etNikkud.text = v;
        status(n + " Stichwörter geladen (" + ms + " ms) · Probe: " + probe + " \u2192 " + v +
               " · " + statsText(st));
    };

    btnNakTest.onClick = function () {
        var c = readUI();
        var probe = "\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd";   // שלום עולם
        status("Prüfe Verbindung zu " + (c.nakdanUrl || HT.NK.url) + " …");
        var t0 = new Date().getTime();
        var res = nakdanVocalize(probe, c, logLine, true);
        var ms = new Date().getTime() - t0;
        if (res === null) {
            status("Keine Verbindung – Einzelheiten im Protokoll (Reiter 3).");
            logLine("Nakdan-Test fehlgeschlagen. Prüfen Sie Internetzugang, Firewall und Serveradresse.");
            return;
        }
        etNikkud.text = res;
        status("Nakdan antwortet (" + ms + " ms): " + probe + "  \u2192  " + res);
    };

    btnNakApply.onClick = function () {
        if (app.documents.length === 0) { status("Kein Dokument geöffnet."); return; }
        var c = readUI();
        var src = transliterationSource();
        if (!src) { status("Bitte hebräischen Text markieren."); return; }
        if (!hasHebrew(src.text)) { status("Die Markierung enthält keinen hebräischen Text."); return; }
        if (c.vocalMode === "off") { status("Bitte oben eine Quelle für die Vokalisierung wählen."); return; }
        status("Vokalisierung läuft …");
        var prepN = vocalizePrepare(c, src.text, logLine);
        if (prepN.failed || !prepN.used) { status("Vokalisierung fehlgeschlagen – siehe Protokoll in Reiter 3."); return; }
        var voc = prepN.text;
        try {
            app.doScript(function () { src.obj.contents = voc; },
                         ScriptLanguage.JAVASCRIPT, undefined,
                         UndoModes.ENTIRE_SCRIPT, "Nikkud einsetzen");
        } catch (e) { status("Einsetzen fehlgeschlagen: " + e); return; }
        etNikkud.text = voc;
        status("Nikkud eingesetzt (" + vocalNote(prepN) + "). Bitte gegenlesen.");
    };

    btnRefresh.onClick = function () {
        var names = bookNames(), i;
        ddBook.removeAll();
        for (i = 0; i < names.length; i++) ddBook.add("item", names[i]);
        if (names.length > 0) ddBook.selection = 0;
        status(names.length + " Buch/Bücher gefunden.");
    };

    btnBrowse.onClick = function () {
        var f = File.openDialog("Skriptdatei wählen (.js oder .jsx)");
        if (f) { etScript.text = f.fsName; status("Skript gewählt: " + f.name); }
    };

    btnClearLog.onClick = function () { etLog.text = ""; };

    btnRun.onClick = function () {
        var c = readUI();
        if (app.books.length === 0) { logLine("Kein Buch geöffnet."); return; }
        btnRun.enabled = false;
        status("Stapel läuft …");
        try { runBatch(c, logLine); }
        catch (e) { logLine("Abbruch: " + e); }
        btnRun.enabled = true;
        status("Stapel beendet.");
    };

    btnDocInfo.onClick = function () {
        var c = readUI();
        if (c.docTarget === "active") {
            status(app.documents.length === 0
                   ? "Kein Dokument geöffnet."
                   : "Aktives Dokument: " + app.activeDocument.pages.length +
                     " Seiten – es werden Ränder, Musterseite, Seitenzahlen und Formate gesetzt.");
            return;
        }
        var warn = "";
        if (c.docMarginInside + c.docMarginOutside >= c.docWidth) {
            warn = "  ACHTUNG: Ränder breiter als die Seite.";
        }
        status(layoutSummary(c) + warn);
    };

    btnDocBuild.onClick = function () {
        var c = readUI();
        if (c.docTarget === "active" && app.documents.length === 0) {
            status("Kein Dokument geöffnet."); return;
        }
        if (c.docMarginInside + c.docMarginOutside >= c.docWidth ||
            c.docMarginTop + c.docMarginBottom >= c.docHeight) {
            status("Ränder passen nicht in das Seitenformat – bitte korrigieren.");
            return;
        }
        var messages = [];
        function collect(m) { messages.push(m); }
        var res = null;
        try {
            app.doScript(function () { res = buildLayoutDocument(c, collect); },
                         ScriptLanguage.JAVASCRIPT, undefined,
                         UndoModes.ENTIRE_SCRIPT, "Dokument und Layout aufbauen");
        } catch (e) { status("Fehler: " + e); return; }
        if (!res) { status(messages.length ? messages[0] : "Nichts aufgebaut."); return; }
        var msg = "Fertig: " + res.pages + " Seiten, " + res.frames + " Rahmen, " +
                  res.numbers + " Seitenzahlen, " + res.styles + " Absatzformate.";
        if (messages.length > 0) msg += "  " + messages[0];
        status(msg);
        for (var i = 0; i < messages.length; i++) logLine(messages[i]);
    };

    btnSave.onClick = function () {
        status(saveSettings(readUI()) ? "Einstellungen gespeichert."
                                      : "Einstellungen konnten nicht gespeichert werden.");
    };

    btnReset.onClick = function () {
        writeUI(cloneObj(HT.defaults));
        status("Voreinstellungen wiederhergestellt.");
    };

    btnClose.onClick = function () { w.close(); };

    w.onClose = function () { $.global.HT_WIN = null; return true; };

    writeUI(cfg);
    w.layout.layout(true);
    w.layout.resize();
    w.onResizing = w.onResize = function () { this.layout.resize(); };
    return w;
}

// ============================================================================
// 9 · Start
// ============================================================================

(function () {
    if (parseFloat(app.version) < 6) {
        alert("Dieses Skript benötigt eine neuere InDesign-Version.");
        return;
    }
    try {
        if ($.global.HT_WIN) { $.global.HT_WIN.close(); }
    } catch (e) {}
    $.global.HT_WIN = buildUI();
    $.global.HT_WIN.show();
})();
