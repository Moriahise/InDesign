#targetengine "session"
/* ============================================================================
 *  Ersetzungsliste  –  Version 1.0.0
 *  Adobe InDesign 18.1 / ExtendScript (ScriptUI Palette, hochformatig)
 *
 *  Zweck
 *  -----
 *  Waehrend der Arbeit am Dokument Woerter sammeln, die spaeter ersetzt werden
 *  sollen, und den ganzen Stapel am Ende mit einem Klick anwenden.
 *
 *  Eigenschaften
 *  -------------
 *  - Palette bleibt geoeffnet, das Dokument ist waehrenddessen voll bedienbar.
 *  - Suchbegriff per Knopfdruck oder automatisch aus der Textauswahl uebernehmen.
 *  - Liste immer alphabetisch sortiert (deutsche Umlaute korrekt einsortiert).
 *  - Doppelte Eintraege werden bereits beim Tippen erkannt.
 *  - Konfliktpruefung: Teilwort-Ueberschneidungen und Kettenreaktionen.
 *  - Zweistufige Ersetzung ueber Platzhalter verhindert Kaskaden.
 *  - Vorschau zaehlt alle Treffer, bevor irgendetwas veraendert wird.
 *  - Ersetzung laeuft in genau einem Undo-Schritt.
 *  - Liste wird nach jeder Aenderung automatisch gesichert.
 * ========================================================================== */

(function () {

var TITLE   = "Ersetzungsliste";
var VERSION = "1.0.0";
var STORE   = File(Folder.userData + "/InDesign_ReplaceList.txt");
var DOCLABEL = "REPLACELIST_V1";
var PUA     = 0xE000;          /* Basis fuer die Platzhalter der 2. Stufe */

/* ------------------------------------------------------------------ Hilfen */

function trim(s) { return String(s).replace(/^[\s\u00A0]+/, "").replace(/[\s\u00A0]+$/, ""); }

function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
}
function unesc(s) {
    return String(s).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
}

function snippet(t, n) {
    var s = String(t).replace(/[\r\n\u2028\u2029\t]/g, " ").replace(/\s+/g, " ");
    s = trim(s);
    return s.length > n ? s.substr(0, n) + "\u2026" : s;
}

/*  Sortierschluessel: Umlaute und Eszett wie im deutschen Woerterbuch,
    Gross-/Kleinschreibung fuer die Sortierung ohne Bedeutung.            */
function sortKey(s) {
    return String(s).toLowerCase()
        .replace(/\u00e4/g, "a").replace(/\u00f6/g, "o").replace(/\u00fc/g, "u")
        .replace(/\u00df/g, "ss")
        .replace(/\u00e1|\u00e0|\u00e2/g, "a")
        .replace(/\u00e9|\u00e8|\u00ea/g, "e");
}

/* ------------------------------------------------------------------ Datenmodell */

/*  Eintrag: { act, s, r, cs, ww, grep, hits }
 *  act  aktiv          s  Suchbegriff      r  Ersatz
 *  cs   Gross/Klein    ww Ganzes Wort      grep  GREP statt Text
 *  hits letzte Trefferzahl (-1 = unbekannt)                              */

var LIST = [];

function sortList() {
    LIST.sort(function (a, b) {
        var ka = sortKey(a.s), kb = sortKey(b.s);
        return (ka < kb) ? -1 : (ka > kb) ? 1 : 0;
    });
}

/* Index eines gleichlautenden Eintrags, -1 wenn keiner. skip = eigener Index */
function indexOfTerm(term, skip) {
    var t = sortKey(trim(term));
    if (t === "") return -1;
    for (var i = 0; i < LIST.length; i++) {
        if (i === skip) continue;
        if (sortKey(LIST[i].s) === t) return i;
    }
    return -1;
}

function activeCount() {
    var n = 0;
    for (var i = 0; i < LIST.length; i++) { if (LIST[i].act) n++; }
    return n;
}

/*  Konfliktpruefung
 *  1) Teilwort: ein Suchbegriff steckt in einem anderen -> Reihenfolge zaehlt
 *  2) Kettenreaktion: ein Ersatz enthaelt einen anderen Suchbegriff
 *  3) Leerlauf: Suchbegriff gleich Ersatz                                 */
function checkConflicts() {
    var out = [], i, j;
    for (i = 0; i < LIST.length; i++) {
        if (!LIST[i].act) continue;
        if (LIST[i].grep) continue;
        if (LIST[i].s === LIST[i].r) {
            out.push("Leerlauf: \u00bb" + LIST[i].s + "\u00ab wird durch sich selbst ersetzt.");
        }
        for (j = 0; j < LIST.length; j++) {
            if (i === j || !LIST[j].act || LIST[j].grep) continue;
            var a = sortKey(LIST[i].s), b = sortKey(LIST[j].s);
            if (a !== b && b.indexOf(a) >= 0) {
                out.push("Teilwort: \u00bb" + LIST[i].s + "\u00ab steckt in \u00bb" + LIST[j].s + "\u00ab.");
            }
            if (sortKey(LIST[i].r).indexOf(b) >= 0 && LIST[i].r !== "") {
                out.push("Kette: der Ersatz \u00bb" + LIST[i].r + "\u00ab enth\u00e4lt den Suchbegriff \u00bb" + LIST[j].s + "\u00ab.");
            }
        }
    }
    /* Doppelte melden */
    for (i = 0; i < LIST.length; i++) {
        for (j = i + 1; j < LIST.length; j++) {
            if (sortKey(LIST[i].s) === sortKey(LIST[j].s)) {
                out.push("Doppelt: \u00bb" + LIST[i].s + "\u00ab kommt mehrfach vor.");
            }
        }
    }
    return out;
}

/* ------------------------------------------------------------------ Speichern */

function serialize() {
    var out = ["# " + TITLE + " " + VERSION];
    for (var i = 0; i < LIST.length; i++) {
        var e = LIST[i];
        out.push([(e.act ? "1" : "0"), esc(e.s), esc(e.r),
                  (e.cs ? "1" : "0"), (e.ww ? "1" : "0"), (e.grep ? "1" : "0")].join("\t"));
    }
    return out.join("\n");
}

function deserialize(txt, append) {
    if (!append) LIST = [];
    var lines = String(txt).split(/\r\n|\r|\n/), n = 0;
    for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (trim(ln) === "" || ln.charAt(0) === "#") continue;
        var p = ln.split("\t");
        if (p.length < 2) continue;
        var e;
        if (p.length >= 6) {
            e = { act: p[0] === "1", s: unesc(p[1]), r: unesc(p[2]),
                  cs: p[3] === "1", ww: p[4] === "1", grep: p[5] === "1", hits: -1 };
        } else {
            /* schlanke Fremdliste: Suchbegriff <Tab> Ersatz */
            e = { act: true, s: unesc(p[0]), r: unesc(p[1]),
                  cs: false, ww: true, grep: false, hits: -1 };
        }
        if (trim(e.s) === "") continue;
        if (indexOfTerm(e.s, -1) >= 0) continue;
        LIST.push(e); n++;
    }
    sortList();
    return n;
}

function storeSave() { 
    try {
        STORE.encoding = "UTF-8"; STORE.lineFeed = "Unix";
        STORE.open("w"); STORE.write(serialize()); STORE.close();
        return true;
    } catch (e) { return false; }
}

function storeLoad() {
    try {
        if (!STORE.exists) return 0;
        STORE.encoding = "UTF-8";
        STORE.open("r");
        var t = STORE.read();
        STORE.close();
        return deserialize(t, false);
    } catch (e) { return 0; }
}

/* ------------------------------------------------------------------ Suchbereich */

function parseRange(doc, spec) {
    var out = [], parts = String(spec).split(","), i, j, names = [];
    for (i = 0; i < doc.pages.length; i++) names.push(String(doc.pages[i].name));
    function byName(nm) {
        for (var k = 0; k < names.length; k++) { if (names[k] === String(nm)) return k; }
        var n = parseInt(nm, 10);
        return (!isNaN(n) && n >= 1 && n <= doc.pages.length) ? n - 1 : -1;
    }
    for (i = 0; i < parts.length; i++) {
        var p = trim(parts[i]);
        if (p === "") continue;
        var m = p.match(/^(.+?)\s*-\s*(.*)$/);
        if (m) {
            var a = byName(trim(m[1]));
            var b = (trim(m[2]) === "") ? doc.pages.length - 1 : byName(trim(m[2]));
            if (a < 0) continue;
            if (b < 0) b = doc.pages.length - 1;
            if (b < a) { var t = a; a = b; b = t; }
            for (j = a; j <= b; j++) out.push(doc.pages[j]);
        } else {
            var k = byName(p);
            if (k >= 0) out.push(doc.pages[k]);
        }
    }
    return out;
}

/*  Liefert die Objekte, auf denen gesucht wird. Dokumente, Stories und Texte
    beherrschen alle findText/changeText.                                    */
function scopeTargets(mode, rangeSpec) {
    var t = [], i, k;
    if (app.documents.length === 0) return t;

    switch (mode) {
    case "alldocs":
        for (i = 0; i < app.documents.length; i++) t.push(app.documents[i]);
        break;

    case "selection":
        for (i = 0; i < app.selection.length; i++) {
            var s = app.selection[i];
            try {
                if (s.hasOwnProperty("baseline") || s instanceof Text ||
                    s instanceof Word || s instanceof Paragraph || s instanceof TextStyleRange) t.push(s);
                else if (s instanceof TextFrame) t.push(s.texts[0]);
                else if (s instanceof InsertionPoint) t.push(s.parentStory);
            } catch (e) {}
        }
        break;

    case "story":
        try {
            var sel = app.selection[0];
            if (sel instanceof TextFrame) t.push(sel.parentStory);
            else if (sel && sel.parentStory) t.push(sel.parentStory);
        } catch (e) {}
        break;

    case "pages":
        var pages = parseRange(app.activeDocument, rangeSpec);
        for (i = 0; i < pages.length; i++) {
            var items = pages[i].allPageItems;
            for (k = 0; k < items.length; k++) {
                if (items[k] instanceof TextFrame) {
                    try { if (items[k].texts[0].characters.length) t.push(items[k].texts[0]); } catch (e) {}
                }
            }
        }
        break;

    default:
        t.push(app.activeDocument);
    }
    return t;
}

/* ------------------------------------------------------------------ Suchen/Ersetzen */

function resetPrefs() {
    app.findTextPreferences   = NothingEnum.NOTHING;
    app.changeTextPreferences = NothingEnum.NOTHING;
    app.findGrepPreferences   = NothingEnum.NOTHING;
    app.changeGrepPreferences = NothingEnum.NOTHING;
}

function applyOptions(opt, entry) {
    var o = app.findChangeTextOptions;
    o.caseSensitive        = entry ? !!entry.cs : true;
    o.wholeWord            = entry ? !!entry.ww : false;
    o.includeFootnotes     = opt.footnotes;
    o.includeHiddenLayers  = opt.hidden;
    o.includeMasterPages   = opt.masters;
    o.includeLockedLayersForFind  = opt.lockedLayers;
    o.includeLockedStoriesForFind = opt.lockedStories;

    var g = app.findChangeGrepOptions;
    g.includeFootnotes     = opt.footnotes;
    g.includeHiddenLayers  = opt.hidden;
    g.includeMasterPages   = opt.masters;
    g.includeLockedLayersForFind  = opt.lockedLayers;
    g.includeLockedStoriesForFind = opt.lockedStories;
}

/* Zaehlt Treffer, ohne etwas zu veraendern */
function countHits(entry, targets, opt) {
    var n = 0;
    resetPrefs();
    applyOptions(opt, entry);
    try {
        if (entry.grep) app.findGrepPreferences.findWhat = entry.s;
        else            app.findTextPreferences.findWhat = entry.s;
        for (var i = 0; i < targets.length; i++) {
            var f = entry.grep ? targets[i].findGrep() : targets[i].findText();
            n += f.length;
        }
    } catch (e) { n = -1; }
    resetPrefs();
    return n;
}

function changeAll(findWhat, changeTo, grep, targets, opt, entry) {
    var n = 0;
    resetPrefs();
    applyOptions(opt, entry);
    try {
        if (grep) {
            app.findGrepPreferences.findWhat = findWhat;
            app.changeGrepPreferences.changeTo = changeTo;
        } else {
            app.findTextPreferences.findWhat = findWhat;
            app.changeTextPreferences.changeTo = changeTo;
        }
        for (var i = 0; i < targets.length; i++) {
            var c = grep ? targets[i].changeGrep() : targets[i].changeText();
            n += c.length;
        }
    } catch (e) { n = -1; }
    resetPrefs();
    return n;
}

/*  Fuehrt die gesamte Liste aus.
 *  twoStage: Klartext-Eintraege werden zuerst durch eindeutige Platzhalter
 *  ersetzt und erst danach aufgeloest. Dadurch kann keine Regel das Ergebnis
 *  einer anderen erneut treffen.                                            */
function runAll(targets, opt, twoStage, report) {
    var plain = [], greps = [], i, e, n, total = 0;

    for (i = 0; i < LIST.length; i++) {
        e = LIST[i];
        if (!e.act || trim(e.s) === "") continue;
        if (e.grep) greps.push(e); else plain.push(e);
    }

    /* Laengste Begriffe zuerst – wichtig auch im einstufigen Betrieb */
    plain.sort(function (a, b) { return b.s.length - a.s.length; });

    if (!twoStage) {
        for (i = 0; i < plain.length; i++) {
            n = changeAll(plain[i].s, plain[i].r, false, targets, opt, plain[i]);
            plain[i].hits = n;
            if (n > 0) total += n;
            report.push((n < 0 ? "FEHLER" : n + "\u00d7") + "  " + plain[i].s + " \u2192 " + plain[i].r);
        }
    } else {
        /* Stufe 1: Klartext -> Platzhalter */
        for (i = 0; i < plain.length; i++) {
            var tok = String.fromCharCode(PUA + i);
            n = changeAll(plain[i].s, tok, false, targets, opt, plain[i]);
            plain[i].hits = n;
            plain[i]._tok = tok;
            if (n > 0) total += n;
        }
    }

    /* GREP-Eintraege laufen immer direkt, damit Rueckverweise ($1 …) wirken */
    for (i = 0; i < greps.length; i++) {
        n = changeAll(greps[i].s, greps[i].r, true, targets, opt, greps[i]);
        greps[i].hits = n;
        if (n > 0) total += n;
        report.push((n < 0 ? "FEHLER" : n + "\u00d7") + "  [GREP] " + greps[i].s + " \u2192 " + greps[i].r);
    }

    if (twoStage) {
        /* Stufe 2: Platzhalter -> endgueltiger Ersatz */
        var rest = 0;
        for (i = 0; i < plain.length; i++) {
            if (plain[i].hits <= 0) {
                report.push("0\u00d7  " + plain[i].s + " \u2192 " + plain[i].r);
                continue;
            }
            var m = changeAll(plain[i]._tok, plain[i].r, false, targets, opt,
                              { cs: true, ww: false });
            if (m !== plain[i].hits) rest += (plain[i].hits - (m < 0 ? 0 : m));
            report.push(plain[i].hits + "\u00d7  " + plain[i].s + " \u2192 " + plain[i].r);
        }
        if (rest !== 0) {
            report.push("");
            report.push("ACHTUNG: " + rest + " Platzhalter konnten nicht aufgel\u00f6st werden. " +
                        "Bitte den Vorgang r\u00fcckg\u00e4ngig machen.");
        }
    }
    return total;
}

/* ------------------------------------------------------------------ Oberflaeche */

var win = null, liveTask = null, lastSelSig = "", viewMap = [], editIdx = -1;

function buildUI() {
    var w = new Window("palette", TITLE + "  " + VERSION, undefined, { resizeable: false });
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.spacing = 7; w.margins = 11;

    var W = 400;   /* Arbeitsbreite – die Palette ist bewusst hochformatig */

    /* ---------------------------------------------------- Kopf */
    var docTxt = w.add("statictext", undefined, "Dokument: \u2013");
    docTxt.preferredSize.width = W;

    /* ---------------------------------------------------- Eintrag */
    var pE = w.add("panel", undefined, "Eintrag");
    pE.orientation = "column"; pE.alignChildren = "fill"; pE.margins = 11; pE.spacing = 6;

    var gS = pE.add("group");
    gS.add("statictext", undefined, "Suchen:").preferredSize.width = 58;
    var etS = gS.add("edittext", undefined, ""); etS.preferredSize.width = 218;
    var bGrab = gS.add("button", undefined, "\u2190 Auswahl"); bGrab.preferredSize.width = 88;

    var gR = pE.add("group");
    gR.add("statictext", undefined, "Ersetzen:").preferredSize.width = 58;
    var etR = gR.add("edittext", undefined, ""); etR.preferredSize.width = 218;
    var bClr = gR.add("button", undefined, "Leeren"); bClr.preferredSize.width = 88;

    var gO = pE.add("group");
    gO.add("statictext", undefined, "").preferredSize.width = 54;
    var cbCS = gO.add("checkbox", undefined, "Gro\u00df/klein");
    var cbWW = gO.add("checkbox", undefined, "Ganzes Wort");
    var cbGR = gO.add("checkbox", undefined, "GREP");
    cbWW.value = true;

    var lblDup = pE.add("statictext", undefined, "");
    lblDup.preferredSize = [W - 24, 16];

    var gB = pE.add("group"); gB.alignment = "fill";
    var bAdd = gB.add("button", undefined, "Hinzuf\u00fcgen"); bAdd.preferredSize.width = 130;
    var bUpd = gB.add("button", undefined, "\u00c4ndern");     bUpd.preferredSize.width = 96;
    var bAuto = gB.add("checkbox", undefined, "Auswahl automatisch \u00fcbernehmen");

    /* ---------------------------------------------------- Liste */
    var gF = w.add("group");
    gF.add("statictext", undefined, "Filter:").preferredSize.width = 40;
    var etF = gF.add("edittext", undefined, ""); etF.preferredSize.width = 220;
    var lblCnt = gF.add("statictext", undefined, ""); lblCnt.preferredSize.width = 118;

    var lb = w.add("listbox", undefined, [], {
        numberOfColumns: 5, showHeaders: true,
        columnTitles: ["", "Suchen", "Ersetzen", "Opt.", "Tr."],
        columnWidths: [20, 138, 138, 44, 38]
    });
    lb.preferredSize = [W, 250];

    var gL = w.add("group"); gL.alignment = "fill";
    var bTog = gL.add("button", undefined, "Aktiv/Aus"); bTog.preferredSize.width = 84;
    var bDel = gL.add("button", undefined, "L\u00f6schen");  bDel.preferredSize.width = 74;
    var bFind = gL.add("button", undefined, "Im Dokument suchen"); bFind.preferredSize.width = 140;
    gL.add("statictext", undefined, "").alignment = "fill";

    /* ---------------------------------------------------- Untertabs */
    var tp = w.add("tabbedpanel");
    tp.alignChildren = "fill";
    tp.preferredSize = [W, 176];

    /* Bereich */
    var tA = tp.add("tab", undefined, "Bereich");
    tA.orientation = "column"; tA.alignChildren = "left"; tA.margins = 10; tA.spacing = 5;
    var rDoc = tA.add("radiobutton", undefined, "Aktives Dokument");
    var rAll = tA.add("radiobutton", undefined, "Alle ge\u00f6ffneten Dokumente");
    var rSel = tA.add("radiobutton", undefined, "Aktuelle Auswahl");
    var rSty = tA.add("radiobutton", undefined, "Textabschnitt des Cursors");
    var gPg = tA.add("group");
    var rPgs = gPg.add("radiobutton", undefined, "Seiten:");
    var etPgs = gPg.add("edittext", undefined, ""); etPgs.preferredSize.width = 190;
    rDoc.value = true;

    /* Optionen */
    var tB = tp.add("tab", undefined, "Optionen");
    tB.orientation = "column"; tB.alignChildren = "left"; tB.margins = 10; tB.spacing = 4;
    var cbFn = tB.add("checkbox", undefined, "Fu\u00dfnoten einschlie\u00dfen");
    var cbMp = tB.add("checkbox", undefined, "Musterseiten einschlie\u00dfen");
    var cbHl = tB.add("checkbox", undefined, "ausgeblendete Ebenen einschlie\u00dfen");
    var cbLl = tB.add("checkbox", undefined, "gesperrte Ebenen durchsuchen");
    var cbLs = tB.add("checkbox", undefined, "gesperrte Textabschnitte durchsuchen");
    var cb2S = tB.add("checkbox", undefined, "zweistufig ersetzen (verhindert Kaskaden)");
    cbFn.value = true; cbMp.value = true; cb2S.value = true;

    /* Protokoll */
    var tC = tp.add("tab", undefined, "Protokoll");
    tC.orientation = "column"; tC.alignChildren = "fill"; tC.margins = 8; tC.spacing = 5;
    var logBox = tC.add("edittext", undefined, "", { multiline: true, scrolling: true, readonly: true });
    logBox.preferredSize = [W - 20, 108];
    var gLg = tC.add("group");
    var bChk = gLg.add("button", undefined, "Konflikte pr\u00fcfen"); bChk.preferredSize.width = 130;
    var bLgC = gLg.add("button", undefined, "Leeren"); bLgC.preferredSize.width = 70;

    /* ---------------------------------------------------- Ausfuehren */
    var gX = w.add("group"); gX.alignment = "fill";
    var bPrev = gX.add("button", undefined, "Vorschau z\u00e4hlen"); bPrev.preferredSize.width = 132;
    var bRun  = gX.add("button", undefined, "Alles ersetzen");     bRun.preferredSize.width = 132;
    gX.add("statictext", undefined, "").alignment = "fill";

    var lblStat = w.add("statictext", undefined, "");
    lblStat.preferredSize = [W, 16];

    /* ---------------------------------------------------- Fuss */
    var gFt = w.add("group"); gFt.alignment = "fill";
    var bImp = gFt.add("button", undefined, "Import"); bImp.preferredSize.width = 66;
    var bExp = gFt.add("button", undefined, "Export"); bExp.preferredSize.width = 66;
    var bDoc = gFt.add("button", undefined, "\u2193 Dokument"); bDoc.preferredSize.width = 88;
    var bDocL = gFt.add("button", undefined, "\u2191 Dokument"); bDocL.preferredSize.width = 88;
    gFt.add("statictext", undefined, "").alignment = "fill";
    var bCls = gFt.add("button", undefined, "Schlie\u00dfen"); bCls.preferredSize.width = 78;

    /* ================================================== Anzeige */

    function optTag(e) {
        var t = "";
        t += e.grep ? "G" : "\u00b7";
        t += e.cs ? "A" : "\u00b7";
        t += e.ww ? "W" : "\u00b7";
        return t;
    }

    function refresh(keepSel) {
        var sel = (keepSel && lb.selection) ? viewMap[lb.selection.index] : -1;
        var flt = sortKey(trim(etF.text));
        lb.removeAll(); viewMap = [];

        for (var i = 0; i < LIST.length; i++) {
            var e = LIST[i];
            if (flt !== "" && sortKey(e.s).indexOf(flt) < 0 && sortKey(e.r).indexOf(flt) < 0) continue;
            var it = lb.add("item", e.act ? "\u2713" : "\u2013");
            it.subItems[0].text = e.s;
            it.subItems[1].text = e.r;
            it.subItems[2].text = optTag(e);
            it.subItems[3].text = (e.hits < 0) ? "" : String(e.hits);
            viewMap.push(i);
            if (i === sel) lb.selection = lb.items.length - 1;
        }
        lblCnt.text = LIST.length + " Eintr\u00e4ge, " + activeCount() + " aktiv";
    }

    function logSet(lines) {
        logBox.text = (lines instanceof Array) ? lines.join("\n") : String(lines);
        w.update();
    }
    function logAdd(line) {
        logBox.text = (logBox.text === "" ? "" : logBox.text + "\n") + line;
        w.update();
    }

    function checkDup() {
        var t = trim(etS.text);
        if (t === "") { lblDup.text = ""; bAdd.enabled = false; return; }
        bAdd.enabled = true;
        var k = indexOfTerm(t, editIdx);
        if (k >= 0) {
            lblDup.text = "Bereits vorhanden \u2192 \u00bb" + snippet(LIST[k].r, 30) + "\u00ab";
            bAdd.text = "\u00dcbernehmen";
        } else {
            lblDup.text = "";
            bAdd.text = "Hinzuf\u00fcgen";
        }
    }

    function clearForm() {
        etS.text = ""; etR.text = "";
        cbCS.value = false; cbWW.value = true; cbGR.value = false;
        editIdx = -1; lblDup.text = ""; bAdd.text = "Hinzuf\u00fcgen"; bAdd.enabled = false;
    }

    function currentOpt() {
        return { footnotes: cbFn.value, masters: cbMp.value, hidden: cbHl.value,
                 lockedLayers: cbLl.value, lockedStories: cbLs.value };
    }

    function currentScope() {
        return rAll.value ? "alldocs" : rSel.value ? "selection" :
               rSty.value ? "story" : rPgs.value ? "pages" : "doc";
    }

    function targets() {
        var t = scopeTargets(currentScope(), etPgs.text);
        if (t.length === 0) {
            alert("Der gew\u00e4hlte Bereich liefert keinen Text.\n" +
                  "Bei \u201eAuswahl\u201c oder \u201eTextabschnitt\u201c mu\u00df im Dokument etwas markiert sein.");
            return null;
        }
        return t;
    }

    /* ================================================== Eintragspflege */

    function addOrUpdate() {
        var s = trim(etS.text), r = etR.text;
        if (s === "") return;
        if (cbGR.value) {
            try { new RegExp(s); } catch (e) {
                alert("Der GREP-Ausdruck ist nicht lesbar:\n" + e);
                return;
            }
        }
        var k = indexOfTerm(s, editIdx);
        var e;
        if (k >= 0) {
            e = LIST[k];
            e.s = s; e.r = r; e.cs = cbCS.value; e.ww = cbWW.value; e.grep = cbGR.value; e.hits = -1;
        } else if (editIdx >= 0) {
            e = LIST[editIdx];
            e.s = s; e.r = r; e.cs = cbCS.value; e.ww = cbWW.value; e.grep = cbGR.value; e.hits = -1;
        } else {
            LIST.push({ act: true, s: s, r: r, cs: cbCS.value, ww: cbWW.value,
                        grep: cbGR.value, hits: -1 });
        }
        sortList(); storeSave(); clearForm(); refresh(false);
        lblStat.text = "Gesichert \u2013 " + LIST.length + " Eintr\u00e4ge.";
    }

    function loadToForm(i) {
        var e = LIST[i];
        etS.text = e.s; etR.text = e.r;
        cbCS.value = e.cs; cbWW.value = e.ww; cbGR.value = e.grep;
        editIdx = i;
        checkDup();
    }

    /* ================================================== Auswahl uebernehmen */

    function selectionText() {
        try {
            var s = app.selection[0];
            if (!s) return "";
            var t = "";
            if (s instanceof TextFrame) return "";
            if (s.hasOwnProperty("contents")) t = s.contents;
            if (t instanceof Array) t = t.join(" ");
            t = trim(String(t).replace(/[\r\n\u2028\u2029\t]/g, " "));
            return (t.length > 0 && t.length <= 80) ? t : "";
        } catch (e) { return ""; }
    }

    function grabSelection(silent) {
        var t = selectionText();
        if (t === "") { if (!silent) lblStat.text = "Keine verwertbare Textauswahl."; return; }
        etS.text = t;
        editIdx = -1;
        checkDup();
        if (!silent) { etR.active = true; }
    }

    /* ================================================== Idle-Task */

    function stopLive() {
        try { if (liveTask && liveTask.isValid) liveTask.remove(); } catch (e) {}
        liveTask = null;
    }
    function onIdle() {
        try {
            if (!win || !win.visible) { stopLive(); return; }
            if (app.documents.length === 0) return;
            var t = selectionText();
            if (t === "" || t === lastSelSig) return;
            lastSelSig = t;
            if (bAuto.value) { etS.text = t; editIdx = -1; checkDup(); }
        } catch (e) {}
    }
    function startLive() {
        stopLive();
        try {
            liveTask = app.idleTasks.add({ name: "ReplaceList_Watch", sleep: 500 });
            liveTask.addEventListener(IdleEvent.ON_IDLE, onIdle, false);
        } catch (e) {}
    }

    /* ================================================== Handler */

    etS.onChanging = checkDup;
    etS.addEventListener("keydown", function (ev) {
        if (ev.keyName === "Enter") { etR.active = true; }
    });
    etR.addEventListener("keydown", function (ev) {
        if (ev.keyName === "Enter") { addOrUpdate(); etS.active = true; }
    });

    bAdd.onClick = addOrUpdate;
    bUpd.onClick = function () {
        if (!lb.selection) { alert("Bitte einen Listeneintrag w\u00e4hlen."); return; }
        loadToForm(viewMap[lb.selection.index]);
    };
    bClr.onClick = clearForm;
    bGrab.onClick = function () { grabSelection(false); };
    bAuto.onClick = function () { if (bAuto.value) { lastSelSig = ""; startLive(); } };

    etF.onChanging = function () { refresh(false); };

    lb.onDoubleClick = function () {
        if (lb.selection) loadToForm(viewMap[lb.selection.index]);
    };

    bTog.onClick = function () {
        if (!lb.selection) return;
        var i = viewMap[lb.selection.index];
        LIST[i].act = !LIST[i].act;
        storeSave(); refresh(true);
    };

    bDel.onClick = function () {
        if (!lb.selection) return;
        var i = viewMap[lb.selection.index];
        if (!confirm("Eintrag \u00bb" + LIST[i].s + "\u00ab l\u00f6schen?")) return;
        LIST.splice(i, 1);
        if (editIdx === i) clearForm(); else if (editIdx > i) editIdx--;
        storeSave(); refresh(false);
    };

    bFind.onClick = function () {
        if (!lb.selection) return;
        var e = LIST[viewMap[lb.selection.index]];
        var t = targets();
        if (!t) return;
        resetPrefs(); applyOptions(currentOpt(), e);
        var found = [];
        try {
            if (e.grep) { app.findGrepPreferences.findWhat = e.s; }
            else        { app.findTextPreferences.findWhat = e.s; }
            for (var i = 0; i < t.length && found.length === 0; i++) {
                found = e.grep ? t[i].findGrep() : t[i].findText();
            }
        } catch (er) {}
        resetPrefs();
        if (found.length === 0) { lblStat.text = "Kein Treffer f\u00fcr \u00bb" + e.s + "\u00ab."; return; }
        try {
            app.select(found[0]);
            app.activeWindow.zoom(ZoomOptions.FIT_SPREAD);
            lblStat.text = found.length + " Treffer \u2013 erster ist markiert.";
        } catch (er2) { lblStat.text = found.length + " Treffer."; }
    };

    bChk.onClick = function () {
        var c = checkConflicts();
        tp.selection = 2;
        if (c.length === 0) { logSet("Keine Konflikte gefunden. " + LIST.length + " Eintr\u00e4ge gepr\u00fcft."); return; }
        logSet(["Gefundene Auff\u00e4lligkeiten (" + c.length + "):", ""].concat(c).concat(
            ["", "Teilwort- und Kettenf\u00e4lle sind bei zweistufiger Ersetzung unkritisch."]));
    };
    bLgC.onClick = function () { logBox.text = ""; };

    bPrev.onClick = function () {
        var t = targets();
        if (!t) return;
        var opt = currentOpt(), lines = [], total = 0, n = 0;
        lblStat.text = "z\u00e4hle \u2026"; w.update();
        for (var i = 0; i < LIST.length; i++) {
            if (!LIST[i].act) { LIST[i].hits = -1; continue; }
            LIST[i].hits = countHits(LIST[i], t, opt);
            if (LIST[i].hits > 0) { total += LIST[i].hits; n++; }
            lines.push((LIST[i].hits < 0 ? "FEHLER" : LIST[i].hits + "\u00d7") + "  " +
                       LIST[i].s + " \u2192 " + LIST[i].r);
        }
        refresh(true);
        tp.selection = 2;
        logSet(["Vorschau \u2013 nichts wurde ver\u00e4ndert.", ""].concat(lines));
        lblStat.text = total + " Treffer in " + n + " von " + activeCount() + " aktiven Eintr\u00e4gen.";
    };

    bRun.onClick = function () {
        var t = targets();
        if (!t) return;
        if (activeCount() === 0) { alert("Kein aktiver Eintrag in der Liste."); return; }

        var c = checkConflicts();
        var warn = "";
        if (c.length && !cb2S.value) {
            warn = "\n\nEs bestehen " + c.length + " Konflikte und die zweistufige " +
                   "Ersetzung ist abgeschaltet. Regeln k\u00f6nnen einander \u00fcberschreiben.";
        }
        if (!confirm(activeCount() + " Eintr\u00e4ge werden jetzt im gew\u00e4hlten Bereich ersetzt." +
                     warn + "\n\nFortfahren?")) return;

        var report = [], total = 0;
        lblStat.text = "ersetze \u2026"; w.update();

        app.doScript(function () {
            total = runAll(t, currentOpt(), cb2S.value, report);
        }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, TITLE);

        refresh(true);
        tp.selection = 2;
        logSet(["Ersetzung abgeschlossen \u2013 " + total + " \u00c4nderungen.",
                "R\u00fcckg\u00e4ngig mit einem einzigen Undo-Schritt.", ""].concat(report));
        lblStat.text = total + " Ersetzungen durchgef\u00fchrt.";
    };

    bImp.onClick = function () {
        var f = File.openDialog("Liste importieren (Tabulator- oder Textdatei)");
        if (!f) return;
        f.encoding = "UTF-8"; f.open("r");
        var txt = f.read(); f.close();
        var n = deserialize(txt, confirm("An die bestehende Liste anh\u00e4ngen?\n" +
                                         "(Abbrechen ersetzt die Liste vollst\u00e4ndig.)"));
        storeSave(); refresh(false);
        lblStat.text = n + " Eintr\u00e4ge importiert.";
    };

    bExp.onClick = function () {
        var f = File.saveDialog("Liste exportieren", "Text:*.txt");
        if (!f) return;
        f.encoding = "UTF-8"; f.lineFeed = "Unix";
        f.open("w"); f.write("\uFEFF" + serialize()); f.close();
        lblStat.text = "Liste exportiert.";
    };

    bDoc.onClick = function () {
        if (app.documents.length === 0) { alert("Kein Dokument ge\u00f6ffnet."); return; }
        app.activeDocument.insertLabel(DOCLABEL, serialize());
        lblStat.text = "Liste im Dokument abgelegt (wird mitgespeichert).";
    };

    bDocL.onClick = function () {
        if (app.documents.length === 0) { alert("Kein Dokument ge\u00f6ffnet."); return; }
        var t = app.activeDocument.extractLabel(DOCLABEL);
        if (!t || trim(t) === "") { alert("Dieses Dokument enth\u00e4lt keine Liste."); return; }
        var n = deserialize(t, confirm("An die bestehende Liste anh\u00e4ngen?\n" +
                                       "(Abbrechen ersetzt die Liste vollst\u00e4ndig.)"));
        storeSave(); refresh(false);
        lblStat.text = n + " Eintr\u00e4ge aus dem Dokument geladen.";
    };

    bCls.onClick = function () { storeSave(); stopLive(); win.close(); };
    w.onClose = function () { storeSave(); stopLive(); };

    /* ================================================== Start */

    var loaded = storeLoad();
    clearForm();
    refresh(false);
    startLive();
    if (app.documents.length > 0) docTxt.text = "Dokument: " + app.activeDocument.name;
    lblStat.text = loaded > 0 ? (loaded + " Eintr\u00e4ge geladen.") : "Liste ist leer \u2013 ersten Eintrag anlegen.";

    return w;
}

/* ------------------------------------------------------------------ Start */

if (typeof $.global.__REPLLIST_WIN !== "undefined" && $.global.__REPLLIST_WIN !== null) {
    try { $.global.__REPLLIST_WIN.close(); } catch (e) {}
}
win = buildUI();
$.global.__REPLLIST_WIN = win;
win.show();

})();
