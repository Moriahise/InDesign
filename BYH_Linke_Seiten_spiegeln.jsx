#target indesign

/*
    BYH – Linke Seiten spiegeln   (v1.0, 2026-09-26)

    Verschiebt auf allen LINKEN Seiten den kompletten Satzblock horizontal:
      - BYH_RUNNING_HEADER  (Kopfzeile)
      - BYH_HE_FRAME        (hebräischer Text)
      - BYH_EN_FRAME        (englischer Text)
      - BYH_PAGE_NUMBER     (Seitenzahl)
      - unbeschriftete Linien im Satzblock (z. B. Linie unter der Kopfzeile)
    sodass der Außenrand der linken Seiten dem Außenrand der rechten Seiten entspricht.

    Alle Objekte einer Seite werden um exakt denselben Betrag verschoben –
    die relative Anordnung bleibt unverändert. Nur horizontal, nie vertikal.
    Rückgängig machen: ein einziges Strg+Z / Cmd+Z.
*/

(function () {

    if (app.documents.length === 0) { alert("Kein Dokument geöffnet."); return; }
    var doc = app.activeDocument;

    var LABELS_BLOCK = ["BYH_HE_FRAME", "BYH_EN_FRAME", "BYH_RUNNING_HEADER"];
    var LABELS_ALL   = ["BYH_HE_FRAME", "BYH_EN_FRAME", "BYH_RUNNING_HEADER", "BYH_PAGE_NUMBER"];
    var EPS = 0.01;   // mm – kleinere Abweichungen gelten als "bereits korrekt"
    var TOL = 1.0;    // mm – Toleranz, ob eine Linie innerhalb des Satzblocks liegt

    function inArr(a, v) { for (var i = 0; i < a.length; i++) { if (a[i] === v) { return true; } } return false; }
    function fmt(n) { var s = (Math.round(n * 100) / 100).toFixed(2).replace(".", ","); return (n > 0 ? "+" : "") + s; }

    // ------------------------------------------------------------------ Dialog
    var pc = doc.pages.length;
    var w = new Window("dialog", "BYH – Linke Seiten spiegeln");
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];

    var pRange = w.add("panel", undefined, "Seitenbereich (physische Seiten)");
    pRange.orientation = "row";
    pRange.margins = [12, 16, 12, 10];
    pRange.add("statictext", undefined, "Von:");
    var etFrom = pRange.add("edittext", undefined, "1"); etFrom.characters = 5;
    pRange.add("statictext", undefined, "Bis:");
    var etTo = pRange.add("edittext", undefined, String(pc)); etTo.characters = 5;
    pRange.add("statictext", undefined, "(Dokument: " + pc + " Seiten)");

    var pMode = w.add("panel", undefined, "Zielposition der linken Seiten");
    pMode.alignChildren = "left";
    pMode.margins = [12, 16, 12, 10];
    var rb1 = pMode.add("radiobutton", undefined, "An rechter Seite desselben Druckbogens ausrichten (empfohlen, mehrfach ausführbar)");
    var rb2 = pMode.add("radiobutton", undefined, "Innen- und Außenrand der linken Seite tauschen (nur EINMAL ausführen!)");
    var g3 = pMode.add("group");
    var rb3 = g3.add("radiobutton", undefined, "Fester Versatz nach links:");
    var etOff = g3.add("edittext", undefined, "5,0"); etOff.characters = 6;
    g3.add("statictext", undefined, "mm");
    function setMode(n) { rb1.value = (n === 1); rb2.value = (n === 2); rb3.value = (n === 3); etOff.enabled = (n === 3); }
    rb1.onClick = function () { setMode(1); };
    rb2.onClick = function () { setMode(2); };
    rb3.onClick = function () { setMode(3); };
    setMode(1);

    var pObj = w.add("panel", undefined, "Mitzuverschiebende Objekte");
    pObj.alignChildren = "left";
    pObj.margins = [12, 16, 12, 10];
    var cbLab = pObj.add("checkbox", undefined, "BYH-Rahmen: Kopfzeile, HE-Text, EN-Text, Seitenzahl");
    cbLab.value = true; cbLab.enabled = false;
    var cbLines = pObj.add("checkbox", undefined, "Unbeschriftete Linien im Satzblock (z. B. Linie unter der Kopfzeile)");
    cbLines.value = true;
    var cbOther = pObj.add("checkbox", undefined, "Alle weiteren unbeschrifteten Objekte innerhalb des Satzblocks");
    cbOther.value = false;
    var cbUnlock = pObj.add("checkbox", undefined, "Gesperrte Objekte / Ebenen vorübergehend entsperren");
    cbUnlock.value = true;

    var pRun = w.add("panel", undefined, "Ausführung");
    pRun.alignChildren = "left";
    pRun.margins = [12, 16, 12, 10];
    var cbDry = pRun.add("checkbox", undefined, "Nur prüfen – nichts verschieben (Bericht anzeigen)");
    cbDry.value = false;

    var gBtn = w.add("group");
    gBtn.alignment = "right";
    gBtn.add("button", undefined, "Abbrechen", { name: "cancel" });
    gBtn.add("button", undefined, "OK", { name: "ok" });

    if (w.show() !== 1) { return; }

    var from = parseInt(etFrom.text, 10);
    var to   = parseInt(etTo.text, 10);
    if (isNaN(from) || isNaN(to) || from < 1 || to > pc || from > to) { alert("Ungültiger Seitenbereich."); return; }
    var mode  = rb1.value ? 1 : (rb2.value ? 2 : 3);
    var fixed = parseFloat(etOff.text.replace(",", "."));
    if (mode === 3 && isNaN(fixed)) { alert("Ungültiger Versatz."); return; }

    var opt = { lines: cbLines.value, others: cbOther.value, unlock: cbUnlock.value, dry: cbDry.value };

    // ------------------------------------------------------------------ Analyse
    function analyse(page, withExtras) {
        if (page.pageItems.length === 0) { return null; }
        var its = page.pageItems.everyItem().getElements();
        var b = { labeled: [], extra: [], L: null, R: null, found: {} };
        var i, it, lb, g;

        for (i = 0; i < its.length; i++) {
            it = its[i]; lb = it.label;
            if (inArr(LABELS_ALL, lb)) {
                b.labeled.push(it);
                b.found[lb] = (b.found[lb] || 0) + 1;
            }
            if (inArr(LABELS_BLOCK, lb)) {
                g = it.geometricBounds;
                if (b.L === null || g[1] < b.L) { b.L = g[1]; }
                if (b.R === null || g[3] > b.R) { b.R = g[3]; }
            }
        }
        if (b.L === null) { return null; }

        if (withExtras) {
            for (i = 0; i < its.length; i++) {
                it = its[i];
                if (it.label !== "") { continue; }
                g = it.geometricBounds;
                if (g[1] < b.L - TOL || g[3] > b.R + TOL) { continue; }
                var isLine = (it.constructor.name === "GraphicLine");
                if ((isLine && opt.lines) || (!isLine && opt.others)) { b.extra.push(it); }
            }
        }
        return b;
    }

    var globalRef = null, globalRefDone = false;
    function getGlobalRef() {
        if (globalRefDone) { return globalRef; }
        globalRefDone = true;
        var counts = {}, bestN = 0;
        for (var i = 0; i < doc.pages.length; i++) {
            var p = doc.pages[i];
            if (p.side !== PageSideOptions.RIGHT_HAND) { continue; }
            var b = analyse(p, false);
            if (!b) { continue; }
            var v = Math.round((p.bounds[3] - b.R) * 100) / 100;
            var k = String(v);
            counts[k] = (counts[k] || 0) + 1;
            if (counts[k] > bestN) { bestN = counts[k]; globalRef = v; }
        }
        return globalRef;
    }

    function partnerRef(page) {
        var sp = page.parent;
        for (var i = 0; i < sp.pages.length; i++) {
            var p = sp.pages[i];
            if (p.side === PageSideOptions.RIGHT_HAND) {
                var b = analyse(p, false);
                if (b) { return { val: p.bounds[3] - b.R, src: "S. " + p.name }; }
            }
        }
        var g = getGlobalRef();
        if (g === null) { return null; }
        return { val: g, src: "Standardwert rechter Seiten" };
    }

    function moveItem(it, dx) {
        var lay = it.itemLayer;
        var layLocked = lay.locked, itLocked = it.locked;
        if ((layLocked || itLocked) && !opt.unlock) { return false; }
        if (layLocked) { lay.locked = false; }
        if (itLocked)  { it.locked = false; }
        it.move(undefined, [dx, 0]);
        if (itLocked)  { it.locked = true; }
        if (layLocked) { lay.locked = true; }
        return true;
    }

    // ------------------------------------------------------------------ Lauf
    var log = [], nLeft = 0, nMoved = 0, noBlock = [], unchanged = [], warnings = [];

    function run() {
        var vp = doc.viewPreferences;
        var old = {
            h: vp.horizontalMeasurementUnits, v: vp.verticalMeasurementUnits,
            ro: vp.rulerOrigin, su: app.scriptPreferences.measurementUnit
        };
        try {
            vp.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
            vp.verticalMeasurementUnits   = MeasurementUnits.MILLIMETERS;
            vp.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
            app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;

            for (var i = from - 1; i <= to - 1; i++) {
                var pg = doc.pages[i];
                if (pg.side !== PageSideOptions.LEFT_HAND) { continue; }
                nLeft++;

                var b = analyse(pg, true);
                if (!b) { noBlock.push(pg.name); continue; }

                var pb = pg.bounds, dx, src;
                if (mode === 1) {
                    var ref = partnerRef(pg);
                    if (!ref) { warnings.push("S. " + pg.name + ": keine rechte Referenzseite gefunden – übersprungen"); continue; }
                    dx = (pb[1] + ref.val) - b.L; src = "Ref. " + ref.src;
                } else if (mode === 2) {
                    dx = (pb[1] + (pb[3] - b.R)) - b.L; src = "Tausch";
                } else {
                    dx = -fixed; src = "fest";
                }

                if (Math.abs(dx) < EPS) { unchanged.push(pg.name); continue; }

                var miss = [], dup = [];
                for (var k = 0; k < LABELS_ALL.length; k++) {
                    var c = b.found[LABELS_ALL[k]] || 0;
                    if (c === 0) { miss.push(LABELS_ALL[k].replace("BYH_", "")); }
                    if (c > 1)   { dup.push(LABELS_ALL[k].replace("BYH_", "") + " ×" + c); }
                }
                try {
                    var mi = pg.masterPageItems;
                    for (var m = 0; m < mi.length; m++) {
                        if (inArr(LABELS_ALL, mi[m].label)) {
                            warnings.push("S. " + pg.name + ": " + mi[m].label + " liegt auf der Musterseite (nicht übergangen) – wird NICHT verschoben");
                        }
                    }
                } catch (eM) {}

                var items = b.labeled.concat(b.extra);
                var moved = 0, locked = 0;
                if (!opt.dry) {
                    for (var j = 0; j < items.length; j++) {
                        if (moveItem(items[j], dx)) { moved++; } else { locked++; }
                    }
                    nMoved++;
                }

                log.push("S. " + pg.name + ":  " + fmt(dx) + " mm  (" + src + ")  – " +
                    (opt.dry ? items.length + " Objekte würden verschoben" : moved + " Objekte verschoben") +
                    (b.extra.length ? " [davon " + b.extra.length + " unbeschriftet]" : "") +
                    (locked ? ", " + locked + " gesperrt übersprungen" : "") +
                    (miss.length ? "  | fehlt: " + miss.join(", ") : "") +
                    (dup.length ? "  | doppelt: " + dup.join(", ") : ""));
            }
        } finally {
            vp.horizontalMeasurementUnits = old.h;
            vp.verticalMeasurementUnits   = old.v;
            vp.rulerOrigin = old.ro;
            app.scriptPreferences.measurementUnit = old.su;
        }
    }

    var fatal = null;
    try {
        if (opt.dry) { run(); }
        else { app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "BYH: Linke Seiten spiegeln"); }
    } catch (e) {
        fatal = "FEHLER: " + e + (e.line ? " (Zeile " + e.line + ")" : "");
    }

    // ------------------------------------------------------------------ Bericht
    var modeTxt = ["", "An rechter Partnerseite ausrichten", "Innen/Außen tauschen", "Fester Versatz " + fixed + " mm nach links"][mode];
    var head = [];
    head.push(opt.dry ? "PRÜFLAUF – es wurde nichts verändert." : "Fertig. Rückgängig: einmal Strg+Z / Cmd+Z.");
    head.push("Methode: " + modeTxt);
    head.push("Bereich: Seite " + from + "–" + to + "   |   linke Seiten: " + nLeft +
              "   |   " + (opt.dry ? "zu verschieben: " + log.length : "verschoben: " + nMoved) +
              "   |   bereits korrekt: " + unchanged.length + "   |   ohne BYH-Rahmen: " + noBlock.length);
    if (fatal) { head.push(""); head.push(fatal); }
    if (warnings.length) { head.push(""); head.push("WARNUNGEN:"); head = head.concat(warnings); }
    if (noBlock.length) { head.push(""); head.push("Ohne BYH-Rahmen (unverändert): " + noBlock.join(", ")); }
    if (unchanged.length) { head.push(""); head.push("Bereits korrekt: " + unchanged.join(", ")); }
    head.push(""); head.push("DETAILS:");
    var txt = head.concat(log).join("\n");

    var r = new Window("dialog", "BYH – Bericht");
    r.alignChildren = ["fill", "top"];
    var ed = r.add("edittext", undefined, txt, { multiline: true, scrolling: true, readonly: true });
    ed.preferredSize = [720, 420];
    var gr = r.add("group"); gr.alignment = "right";
    var bSave = gr.add("button", undefined, "Bericht speichern …");
    gr.add("button", undefined, "OK", { name: "ok" });
    bSave.onClick = function () {
        var f = File.saveDialog("Bericht speichern", "*.txt");
        if (f) { f.encoding = "UTF-8"; f.open("w"); f.write(txt); f.close(); }
    };
    r.show();

})();
