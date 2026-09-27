#target indesign

/*
    BYH – Rahmen-Positionen setzen   (v1.0, 2026-09-26)

    Setzt auf einem frei wählbaren Seitenbereich die Position von
      - BYH_RUNNING_HEADER  (Kopfzeile)
      - Linie unter der Kopfzeile (unbeschriftete waagrechte Linie)
      - BYH_HE_FRAME        (hebräischer Text)
      - BYH_EN_FRAME        (englischer Text)
      - BYH_PAGE_NUMBER     (Seitenzahl)
    auf die im Dialog eingegebenen Koordinaten (mm).

    Waagrecht wird mit "Abstand außen" + "Breite" gearbeitet:
      linke Seite  → Rahmen beginnt "außen" mm vom linken Seitenrand
      rechte Seite → Rahmen endet   "außen" mm vor dem rechten Seitenrand
    Damit sind linke und rechte Seiten automatisch gespiegelt.

    Senkrecht: "Oben" / "Unten" in mm ab Seitenoberkante.
    Ein LEERES Feld bedeutet: diesen Wert auf der Seite unverändert lassen.

    Vorbelegung = Seite 10 von Band 1 (bzw. per Knopf aus beliebiger Seite einlesen).
    Rückgängig: ein einziges Strg+Z / Cmd+Z.
*/

(function () {

    if (app.documents.length === 0) { alert("Kein Dokument geöffnet."); return; }
    var doc = app.activeDocument;
    var EPS = 0.005;

    // ------------------------------------------------------------ Definition
    // key, Anzeigename, Label (null = Linie), Vorbelegung {o: außen, w: Breite, t: oben, b: unten}
    var ELEMS = [
        { key: "HEAD", name: "Kopfzeile",         label: "BYH_RUNNING_HEADER", def: { o: 19, w: 134.7, t: 8,   b: 15  } },
        { key: "LINE", name: "Linie",             label: null,                 def: { o: 19, w: 134.7, t: 20,  b: 20  } },
        { key: "HE",   name: "Hebräischer Text",  label: "BYH_HE_FRAME",       def: { o: 19, w: 134.7, t: 21,  b: null } },
        { key: "EN",   name: "Englischer Text",   label: "BYH_EN_FRAME",       def: { o: 19, w: 134.7, t: null, b: 229 } },
        { key: "PN",   name: "Seitenzahl",        label: "BYH_PAGE_NUMBER",    def: { o: 19, w: 12,    t: 237, b: 245 } }
    ];

    // ------------------------------------------------------------ Helfer
    function num(t) {
        t = String(t).replace(/^\s+|\s+$/g, "").replace(",", ".");
        if (t === "") { return null; }
        var v = parseFloat(t);
        return isNaN(v) ? NaN : v;
    }
    function f2(v) {
        if (v === null || v === undefined) { return ""; }
        var r = Math.round(v * 100) / 100;
        return String(r).replace(".", ",");
    }
    function fmtD(v) {
        var r = Math.round(v * 100) / 100;
        return (r > 0 ? "+" : "") + String(r).replace(".", ",");
    }

    function withMM(fn) {
        var vp = doc.viewPreferences;
        var old = { h: vp.horizontalMeasurementUnits, v: vp.verticalMeasurementUnits,
                    ro: vp.rulerOrigin, su: app.scriptPreferences.measurementUnit };
        try {
            vp.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
            vp.verticalMeasurementUnits   = MeasurementUnits.MILLIMETERS;
            vp.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
            app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
            return fn();
        } finally {
            vp.horizontalMeasurementUnits = old.h;
            vp.verticalMeasurementUnits   = old.v;
            vp.rulerOrigin = old.ro;
            app.scriptPreferences.measurementUnit = old.su;
        }
    }

    // Objekte einer Seite finden
    function findItems(page) {
        var res = { HEAD: [], LINE: [], HE: [], EN: [], PN: [] };
        if (page.pageItems.length === 0) { return res; }
        var its = page.pageItems.everyItem().getElements();
        var lines = [];
        var i, it, lb;
        for (i = 0; i < its.length; i++) {
            it = its[i]; lb = it.label;
            if (lb === "BYH_RUNNING_HEADER") { res.HEAD.push(it); }
            else if (lb === "BYH_HE_FRAME") { res.HE.push(it); }
            else if (lb === "BYH_EN_FRAME") { res.EN.push(it); }
            else if (lb === "BYH_PAGE_NUMBER") { res.PN.push(it); }
            else if (lb === "BYH_HEADER_RULE") { res.LINE.push(it); }
            else if (lb === "" && it.constructor.name === "GraphicLine") {
                var g = it.geometricBounds;
                if (Math.abs(g[2] - g[0]) < 0.5) { lines.push(it); }   // waagrecht
            }
        }
        if (res.LINE.length === 0 && lines.length) {
            // oberste waagrechte Linie im Kopfbereich (über dem HE-Rahmen bzw. oberhalb 60 mm)
            var limit = 60;
            if (res.HE.length === 1) { limit = res.HE[0].geometricBounds[0] + 1; }
            var best = null;
            for (i = 0; i < lines.length; i++) {
                var t = lines[i].geometricBounds[0];
                if (t <= limit && (best === null || t < best.geometricBounds[0])) { best = lines[i]; }
            }
            if (best) { res.LINE.push(best); }
        }
        return res;
    }

    // Werte (außen/Breite/oben/unten) einer Seite messen
    function measure(page) {
        return withMM(function () {
            var pb = page.bounds;
            var isRight = (page.side === PageSideOptions.RIGHT_HAND);
            var items = findItems(page), out = {};
            for (var e = 0; e < ELEMS.length; e++) {
                var k = ELEMS[e].key, arr = items[k];
                if (arr.length !== 1) { out[k] = null; continue; }
                var g = arr[0].geometricBounds;
                out[k] = {
                    o: isRight ? (pb[3] - g[3]) : (g[1] - pb[1]),
                    w: g[3] - g[1],
                    t: g[0] - pb[0],
                    b: g[2] - pb[0]
                };
            }
            return out;
        });
    }

    function pageByInput(txt, byName) {
        txt = String(txt).replace(/^\s+|\s+$/g, "");
        if (byName) {
            var p = doc.pages.itemByName(txt);
            if (p.isValid) { return p; }
            return null;
        }
        var n = parseInt(txt, 10);
        if (isNaN(n) || n < 1 || n > doc.pages.length) { return null; }
        return doc.pages[n - 1];
    }

    // ------------------------------------------------------------ Dialog
    var w = new Window("dialog", "BYH – Rahmen-Positionen setzen");
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];

    // Seitenbereich
    var pR = w.add("panel", undefined, "Seitenbereich");
    pR.alignChildren = "left";
    pR.margins = [12, 16, 12, 10];
    var gMode = pR.add("group");
    var rbName = gMode.add("radiobutton", undefined, "Seitenzahl (wie im Seitenbedienfeld)");
    var rbPhys = gMode.add("radiobutton", undefined, "Physische Position im Dokument");
    rbName.value = true;
    var gR = pR.add("group");
    gR.add("statictext", undefined, "von:");
    var etFrom = gR.add("edittext", undefined, "10"); etFrom.characters = 7;
    gR.add("statictext", undefined, "bis:");
    var etTo = gR.add("edittext", undefined, "10"); etTo.characters = 7;
    var stRange = gR.add("statictext", undefined, ""); stRange.characters = 40;

    function updRange() {
        var a = pageByInput(etFrom.text, rbName.value), b = pageByInput(etTo.text, rbName.value);
        if (!a || !b) { stRange.text = "⚠ Seite nicht gefunden"; return; }
        var ia = a.documentOffset + 1, ib = b.documentOffset + 1;
        if (ia > ib) { stRange.text = "⚠ von > bis"; return; }
        stRange.text = "→ physisch " + ia + "–" + ib + "  (" + (ib - ia + 1) + " Seiten, Dokument: " + doc.pages.length + ")";
    }
    etFrom.onChanging = updRange; etTo.onChanging = updRange;
    rbName.onClick = updRange; rbPhys.onClick = updRange;

    // Koordinaten
    var pC = w.add("panel", undefined, "Koordinaten in mm  (leeres Feld = Wert auf der Seite unverändert lassen)");
    pC.alignChildren = "left";
    pC.margins = [12, 16, 12, 10];
    pC.spacing = 4;

    var COLW = 70;
    var head = pC.add("group");
    head.add("statictext", undefined, "").preferredSize.width = 150;
    var hdr = ["Abstand außen", "Breite", "Oben", "Unten"];
    for (var h = 0; h < hdr.length; h++) { head.add("statictext", undefined, hdr[h]).preferredSize.width = COLW; }
    head.add("statictext", undefined, "→ innen").preferredSize.width = 60;

    var UI = {};
    for (var e = 0; e < ELEMS.length; e++) {
        var el = ELEMS[e];
        var row = pC.add("group");
        var cb = row.add("checkbox", undefined, el.name); cb.value = true; cb.preferredSize.width = 150;
        var eo = row.add("edittext", undefined, f2(el.def.o)); eo.preferredSize.width = COLW;
        var ew = row.add("edittext", undefined, f2(el.def.w)); ew.preferredSize.width = COLW;
        var et = row.add("edittext", undefined, f2(el.def.t)); et.preferredSize.width = COLW;
        var eb = row.add("edittext", undefined, f2(el.def.b)); eb.preferredSize.width = COLW;
        var inn = row.add("statictext", undefined, ""); inn.preferredSize.width = 60;
        UI[el.key] = { cb: cb, o: eo, w: ew, t: et, b: eb, inner: inn };
        if (el.key === "LINE") { eb.enabled = false; }   // Linie: unten = oben
    }

    var pageW = withMM(function () { var b = doc.pages[0].bounds; return b[3] - b[1]; });
    function updInner() {
        for (var k in UI) {
            var o = num(UI[k].o.text), ww = num(UI[k].w.text);
            if (k === "LINE") { UI[k].b.text = UI[k].t.text; }
            UI[k].inner.text = (o === null || ww === null || isNaN(o) || isNaN(ww)) ? "" : f2(pageW - o - ww);
            UI[k].o.enabled = UI[k].w.enabled = UI[k].t.enabled = UI[k].cb.value;
            UI[k].b.enabled = UI[k].cb.value && k !== "LINE";
        }
    }
    for (var k0 in UI) {
        UI[k0].o.onChanging = UI[k0].w.onChanging = UI[k0].t.onChanging = UI[k0].b.onChanging = updInner;
        UI[k0].cb.onClick = updInner;
    }

    var note = pC.add("statictext", undefined,
        "Waagrecht wird automatisch gespiegelt: links = Abstand zum linken Rand, rechts = Abstand zum rechten Rand.\n" +
        "HE unten und EN oben sind leer, weil sie je nach Umbruch variieren – so bleibt die Aufteilung der Seite erhalten.",
        { multiline: true });
    note.preferredSize = [560, 34];

    // Vorlage einlesen
    var pT = w.add("panel", undefined, "Werte aus einer Vorlageseite einlesen");
    pT.orientation = "row";
    pT.margins = [12, 16, 12, 10];
    pT.add("statictext", undefined, "Seite:");
    var etTpl = pT.add("edittext", undefined, "10"); etTpl.characters = 6;
    var cbVar = pT.add("checkbox", undefined, "auch HE unten / EN oben übernehmen");
    cbVar.value = false;
    var btTpl = pT.add("button", undefined, "Einlesen");
    btTpl.onClick = function () {
        var p = pageByInput(etTpl.text, rbName.value);
        if (!p) { alert("Vorlageseite nicht gefunden."); return; }
        var m = measure(p), miss = [];
        for (var e2 = 0; e2 < ELEMS.length; e2++) {
            var kk = ELEMS[e2].key, v = m[kk];
            if (!v) { miss.push(ELEMS[e2].name); continue; }
            UI[kk].o.text = f2(v.o); UI[kk].w.text = f2(v.w);
            UI[kk].t.text = f2(v.t); UI[kk].b.text = f2(v.b);
        }
        if (!cbVar.value) { UI.HE.b.text = ""; UI.EN.t.text = ""; }
        updInner();
        if (miss.length) { alert("Auf Seite " + p.name + " nicht eindeutig gefunden:\n" + miss.join(", ")); }
    };

    // Ausführung
    var pX = w.add("panel", undefined, "Ausführung");
    pX.alignChildren = "left";
    pX.margins = [12, 16, 12, 10];
    var cbDry = pX.add("checkbox", undefined, "Nur prüfen – nichts verändern (Bericht mit Abweichungen)");
    cbDry.value = true;
    var cbUnlock = pX.add("checkbox", undefined, "Gesperrte Objekte / Ebenen vorübergehend entsperren");
    cbUnlock.value = true;

    var gB = w.add("group"); gB.alignment = "right";
    gB.add("button", undefined, "Abbrechen", { name: "cancel" });
    gB.add("button", undefined, "OK", { name: "ok" });

    updRange(); updInner();
    if (w.show() !== 1) { return; }

    // ------------------------------------------------------------ Eingaben prüfen
    var pA = pageByInput(etFrom.text, rbName.value), pB = pageByInput(etTo.text, rbName.value);
    if (!pA || !pB) { alert("Seitenbereich ungültig: Seite nicht gefunden."); return; }
    var iFrom = pA.documentOffset, iTo = pB.documentOffset;
    if (iFrom > iTo) { alert("Seitenbereich ungültig: von > bis."); return; }

    var TGT = {}, errs = [];
    for (var e3 = 0; e3 < ELEMS.length; e3++) {
        var key = ELEMS[e3].key, u = UI[key];
        if (!u.cb.value) { continue; }
        var o = num(u.o.text), ww = num(u.w.text), t = num(u.t.text), b = num(u.b.text);
        if (key === "LINE") { b = t; }
        if (isNaN(o) || isNaN(ww) || isNaN(t) || isNaN(b)) { errs.push(ELEMS[e3].name + ": ungültige Zahl"); continue; }
        if ((o === null) !== (ww === null)) { errs.push(ELEMS[e3].name + ": Abstand außen und Breite nur gemeinsam angeben oder beide leer lassen"); continue; }
        if (ww !== null && ww <= 0) { errs.push(ELEMS[e3].name + ": Breite muss > 0 sein"); continue; }
        if (t !== null && b !== null && key !== "LINE" && b <= t) { errs.push(ELEMS[e3].name + ": Unten muss größer als Oben sein"); continue; }
        TGT[key] = { o: o, w: ww, t: t, b: b };
    }
    if (errs.length) { alert("Eingabefehler:\n" + errs.join("\n")); return; }

    var dry = cbDry.value, unlock = cbUnlock.value;

    // ------------------------------------------------------------ Lauf
    var log = [], warn = [], nPages = 0, nChanged = 0, nOk = 0, nSkip = [], overset = [];

    function applyBounds(it, nb, isLine) {
        var lay = it.itemLayer, ll = lay.locked, il = it.locked;
        if ((ll || il) && !unlock) { return false; }
        if (ll) { lay.locked = false; }
        if (il) { it.locked = false; }
        if (isLine) {
            it.paths[0].entirePath = [[nb[1], nb[0]], [nb[3], nb[0]]];
        } else {
            it.geometricBounds = nb;
        }
        if (il) { it.locked = true; }
        if (ll) { lay.locked = true; }
        return true;
    }

    function run() {
        withMM(function () {
            for (var i = iFrom; i <= iTo; i++) {
                var pg = doc.pages[i];
                nPages++;
                var items = findItems(pg);
                if (items.HE.length === 0 && items.EN.length === 0 && items.HEAD.length === 0) { nSkip.push(pg.name); continue; }

                var pb = pg.bounds, isRight = (pg.side === PageSideOptions.RIGHT_HAND);
                var parts = [], pageChanged = false;

                for (var e = 0; e < ELEMS.length; e++) {
                    var key = ELEMS[e].key, T = TGT[key];
                    if (!T) { continue; }
                    var arr = items[key];
                    if (arr.length === 0) { warn.push("S. " + pg.name + ": " + ELEMS[e].name + " fehlt"); continue; }
                    if (arr.length > 1)   { warn.push("S. " + pg.name + ": " + ELEMS[e].name + " mehrfach (" + arr.length + "×) – übersprungen"); continue; }
                    var it = arr[0], g = it.geometricBounds;
                    var nb = [g[0], g[1], g[2], g[3]];

                    if (T.o !== null) {
                        if (isRight) { nb[3] = pb[3] - T.o; nb[1] = nb[3] - T.w; }
                        else         { nb[1] = pb[1] + T.o; nb[3] = nb[1] + T.w; }
                    }
                    if (T.t !== null) { nb[0] = pb[0] + T.t; }
                    if (T.b !== null) { nb[2] = pb[0] + T.b; }
                    if (key === "LINE") { nb[2] = nb[0]; }
                    if (nb[2] < nb[0] + (key === "LINE" ? 0 : 1)) {
                        warn.push("S. " + pg.name + ": " + ELEMS[e].name + " – Unten läge über Oben, übersprungen"); continue;
                    }

                    var d = [nb[0] - g[0], nb[1] - g[1], nb[2] - g[2], nb[3] - g[3]];
                    if (Math.abs(d[0]) < EPS && Math.abs(d[1]) < EPS && Math.abs(d[2]) < EPS && Math.abs(d[3]) < EPS) { continue; }

                    var desc = ELEMS[e].name + " [";
                    var sub = [];
                    if (Math.abs(d[1]) >= EPS || Math.abs(d[3]) >= EPS) {
                        sub.push("x " + fmtD(d[1]) + (Math.abs(d[3] - d[1]) >= EPS ? " / Breite " + fmtD(d[3] - d[1]) : ""));
                    }
                    if (Math.abs(d[0]) >= EPS) { sub.push("oben " + fmtD(d[0])); }
                    if (Math.abs(d[2]) >= EPS && key !== "LINE") { sub.push("unten " + fmtD(d[2])); }
                    desc += sub.join(", ") + "]";

                    if (!dry) {
                        if (!applyBounds(it, nb, key === "LINE")) { warn.push("S. " + pg.name + ": " + ELEMS[e].name + " gesperrt – übersprungen"); continue; }
                        try { if (it.constructor.name === "TextFrame" && it.overflows) { overset.push(pg.name + " " + ELEMS[e].name); } } catch (eO) {}
                    }
                    parts.push(desc);
                    pageChanged = true;
                }

                if (pageChanged) {
                    nChanged++;
                    log.push("S. " + pg.name + (isRight ? " (R)" : " (L)") + ": " + parts.join("; "));
                } else { nOk++; }
            }
        });
    }

    var fatal = null;
    try {
        if (dry) { run(); }
        else { app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "BYH: Rahmen-Positionen setzen"); }
    } catch (ex) { fatal = "FEHLER: " + ex + (ex.line ? " (Zeile " + ex.line + ")" : ""); }

    // ------------------------------------------------------------ Bericht
    var L = [];
    L.push(dry ? "PRÜFLAUF – es wurde nichts verändert." : "Fertig. Rückgängig: einmal Strg+Z / Cmd+Z.");
    L.push("Bereich: S. " + doc.pages[iFrom].name + " – " + doc.pages[iTo].name + "   |   Seiten: " + nPages +
           "   |   " + (dry ? "abweichend: " : "geändert: ") + nChanged + "   |   bereits korrekt: " + nOk +
           "   |   ohne BYH-Rahmen: " + nSkip.length);
    L.push("");
    L.push("Zielwerte (mm):");
    for (var e4 = 0; e4 < ELEMS.length; e4++) {
        var T4 = TGT[ELEMS[e4].key];
        if (!T4) { L.push("  " + ELEMS[e4].name + ": nicht angefasst"); continue; }
        L.push("  " + ELEMS[e4].name + ": außen " + (T4.o === null ? "–" : f2(T4.o)) +
               ", Breite " + (T4.w === null ? "–" : f2(T4.w)) +
               ", oben " + (T4.t === null ? "–" : f2(T4.t)) +
               ", unten " + (T4.b === null ? "–" : f2(T4.b)));
    }
    if (fatal) { L.push(""); L.push(fatal); }
    if (overset.length) { L.push(""); L.push("ÜBERSATZ nach Änderung:"); L = L.concat(overset); }
    if (warn.length) { L.push(""); L.push("WARNUNGEN:"); L = L.concat(warn); }
    if (nSkip.length) { L.push(""); L.push("Ohne BYH-Rahmen (unverändert): " + nSkip.join(", ")); }
    L.push(""); L.push(dry ? "ABWEICHUNGEN (würden korrigiert):" : "ÄNDERUNGEN:");
    if (!log.length) { L.push("  keine"); }
    var txt = L.concat(log).join("\n");

    var r = new Window("dialog", "BYH – Bericht");
    r.alignChildren = ["fill", "top"];
    var ed = r.add("edittext", undefined, txt, { multiline: true, scrolling: true, readonly: true });
    ed.preferredSize = [760, 440];
    var gr = r.add("group"); gr.alignment = "right";
    var bs = gr.add("button", undefined, "Bericht speichern …");
    gr.add("button", undefined, "OK", { name: "ok" });
    bs.onClick = function () {
        var f = File.saveDialog("Bericht speichern", "*.txt");
        if (f) { f.encoding = "UTF-8"; f.open("w"); f.write(txt); f.close(); }
    };
    r.show();

})();
