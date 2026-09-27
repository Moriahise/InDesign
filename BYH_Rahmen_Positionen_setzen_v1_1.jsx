#target indesign

/*
    BYH – Rahmen-Positionen setzen   (v1.1, 2026-09-26)

    Setzt auf einem frei wählbaren Seitenbereich die Position der Rahmen auf die
    im Dialog eingegebenen Koordinaten (mm). Pro Seite wird automatisch erkannt:

    A) SATZBLOCK-SEITE (hat BYH-Rahmen):
         BYH_RUNNING_HEADER, Linie unter der Kopfzeile, BYH_HE_FRAME,
         BYH_EN_FRAME, BYH_PAGE_NUMBER
    B) EINZELRAHMEN-SEITE (z. B. Index, keine BYH-Rahmen):
         genau EIN Haupt-Textrahmen (Skriptetikett BYH_BODY_FRAME oder
         der einzige/größte unbeschriftete Textrahmen der Seite)

    Waagrecht: "Abstand außen" + "Breite" → linke/rechte Seiten automatisch gespiegelt.
    Senkrecht: "Oben"/"Unten" in mm ab Seitenoberkante.
    Leeres Feld = diesen Wert auf der Seite unverändert lassen.

    v1.1: Einzelrahmen-Seiten (Index) + Vorlage-Einlesen leitet Einzelrahmen aus HE/EN ab
          + Übersatzprüfung pro Textabschnitt.
    Rückgängig: ein einziges Strg+Z / Cmd+Z.
*/

(function () {

    if (app.documents.length === 0) { alert("Kein Dokument geöffnet."); return; }
    var doc = app.activeDocument;
    var EPS = 0.005;

    // ------------------------------------------------------------ Definition
    var ELEMS = [
        { key: "HEAD", grp: "A", name: "Kopfzeile",        def: { o: 19, w: 134.7, t: 8,    b: 15   } },
        { key: "LINE", grp: "A", name: "Linie",            def: { o: 19, w: 134.7, t: 20,   b: 20   } },
        { key: "HE",   grp: "A", name: "Hebräischer Text", def: { o: 19, w: 134.7, t: 21,   b: null } },
        { key: "EN",   grp: "A", name: "Englischer Text",  def: { o: 19, w: 134.7, t: null, b: 229  } },
        { key: "PN",   grp: "A", name: "Seitenzahl",       def: { o: 19, w: 12,    t: 237,  b: 245  } },
        { key: "BODY", grp: "B", name: "Einzel-Textrahmen", def: { o: 19, w: 134.7, t: 21,   b: 229  } }
    ];
    function elemByKey(k) { for (var i = 0; i < ELEMS.length; i++) { if (ELEMS[i].key === k) { return ELEMS[i]; } } return null; }

    // ------------------------------------------------------------ Helfer
    function num(t) {
        t = String(t).replace(/^\s+|\s+$/g, "").replace(",", ".");
        if (t === "") { return null; }
        var v = parseFloat(t);
        return isNaN(v) ? NaN : v;
    }
    function f2(v) {
        if (v === null || v === undefined) { return ""; }
        return String(Math.round(v * 100) / 100).replace(".", ",");
    }
    function fmtD(v) {
        var r = Math.round(v * 100) / 100;
        return (r > 0 ? "+" : "") + String(r).replace(".", ",");
    }
    function area(g) { return Math.abs((g[2] - g[0]) * (g[3] - g[1])); }

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

    // Objekte einer Seite finden (innerhalb withMM aufrufen)
    function findItems(page) {
        var res = { HEAD: [], LINE: [], HE: [], EN: [], PN: [], BODY: [], bodyNote: "", isA: false };
        if (page.pageItems.length === 0) { return res; }
        var its = page.pageItems.everyItem().getElements();
        var lines = [], tfs = [];
        var i, it, lb, g;
        for (i = 0; i < its.length; i++) {
            it = its[i]; lb = it.label;
            if (lb === "BYH_RUNNING_HEADER") { res.HEAD.push(it); }
            else if (lb === "BYH_HE_FRAME") { res.HE.push(it); }
            else if (lb === "BYH_EN_FRAME") { res.EN.push(it); }
            else if (lb === "BYH_PAGE_NUMBER") { res.PN.push(it); }
            else if (lb === "BYH_HEADER_RULE") { res.LINE.push(it); }
            else if (lb === "BYH_BODY_FRAME") { res.BODY.push(it); }
            else if (lb === "") {
                var cn = it.constructor.name;
                if (cn === "GraphicLine") {
                    g = it.geometricBounds;
                    if (Math.abs(g[2] - g[0]) < 0.5) { lines.push(it); }
                } else if (cn === "TextFrame") {
                    tfs.push(it);
                }
            }
        }
        res.isA = (res.HE.length + res.EN.length + res.HEAD.length) > 0;

        if (res.isA && res.LINE.length === 0 && lines.length) {
            var limit = (res.HE.length === 1) ? res.HE[0].geometricBounds[0] + 1 : 60;
            var best = null;
            for (i = 0; i < lines.length; i++) {
                var t = lines[i].geometricBounds[0];
                if (t <= limit && (best === null || t < best.geometricBounds[0])) { best = lines[i]; }
            }
            if (best) { res.LINE.push(best); }
        }

        if (!res.isA && res.BODY.length === 0 && tfs.length) {
            if (tfs.length === 1) {
                res.BODY.push(tfs[0]);
            } else {
                tfs.sort(function (a, b) { return area(b.geometricBounds) - area(a.geometricBounds); });
                var a0 = area(tfs[0].geometricBounds), a1 = area(tfs[1].geometricBounds);
                if (a0 >= 2 * a1) {
                    res.BODY.push(tfs[0]);
                    res.bodyNote = tfs.length + " Textrahmen – größter genommen";
                } else {
                    res.bodyNote = tfs.length + " ähnlich große Textrahmen – nicht eindeutig (Etikett BYH_BODY_FRAME vergeben)";
                }
            }
        }
        return res;
    }

    function measure(page) {
        return withMM(function () {
            var pb = page.bounds, isRight = (page.side === PageSideOptions.RIGHT_HAND);
            var items = findItems(page), out = { isA: items.isA };
            function m(it) {
                var g = it.geometricBounds;
                return { o: isRight ? (pb[3] - g[3]) : (g[1] - pb[1]), w: g[3] - g[1], t: g[0] - pb[0], b: g[2] - pb[0] };
            }
            for (var e = 0; e < ELEMS.length; e++) {
                var k = ELEMS[e].key;
                out[k] = (items[k].length === 1) ? m(items[k][0]) : null;
            }
            // Einzelrahmen aus Satzblock ableiten: HE oben … EN unten
            if (!out.BODY && out.HE && out.EN) {
                out.BODY = { o: out.HE.o, w: out.HE.w, t: out.HE.t, b: out.EN.b, derived: true };
            }
            return out;
        });
    }

    function pageByInput(txt, byName) {
        txt = String(txt).replace(/^\s+|\s+$/g, "");
        if (byName) {
            var p = doc.pages.itemByName(txt);
            return p.isValid ? p : null;
        }
        var n = parseInt(txt, 10);
        if (isNaN(n) || n < 1 || n > doc.pages.length) { return null; }
        return doc.pages[n - 1];
    }

    // ------------------------------------------------------------ Dialog
    var w = new Window("dialog", "BYH – Rahmen-Positionen setzen  v1.1");
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];

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
    var stRange = gR.add("statictext", undefined, ""); stRange.characters = 44;

    function updRange() {
        var a = pageByInput(etFrom.text, rbName.value), b = pageByInput(etTo.text, rbName.value);
        if (!a || !b) { stRange.text = "⚠ Seite nicht gefunden"; return; }
        var ia = a.documentOffset + 1, ib = b.documentOffset + 1;
        if (ia > ib) { stRange.text = "⚠ von > bis"; return; }
        stRange.text = "→ physisch " + ia + "–" + ib + "  (" + (ib - ia + 1) + " Seiten, Dokument: " + doc.pages.length + ")";
    }
    etFrom.onChanging = updRange; etTo.onChanging = updRange;
    rbName.onClick = updRange; rbPhys.onClick = updRange;

    var pC = w.add("panel", undefined, "Koordinaten in mm  (leeres Feld = Wert auf der Seite unverändert lassen)");
    pC.alignChildren = "left";
    pC.margins = [12, 16, 12, 10];
    pC.spacing = 4;

    var COLW = 70, NAMEW = 170;
    function headerRow(parent) {
        var h = parent.add("group");
        h.add("statictext", undefined, "").preferredSize.width = NAMEW;
        var hdr = ["Abstand außen", "Breite", "Oben", "Unten"];
        for (var i = 0; i < hdr.length; i++) { h.add("statictext", undefined, hdr[i]).preferredSize.width = COLW; }
        h.add("statictext", undefined, "→ innen").preferredSize.width = 60;
    }

    var UI = {};
    function addRow(parent, el) {
        var row = parent.add("group");
        var cb = row.add("checkbox", undefined, el.name); cb.value = true; cb.preferredSize.width = NAMEW;
        var eo = row.add("edittext", undefined, f2(el.def.o)); eo.preferredSize.width = COLW;
        var ew = row.add("edittext", undefined, f2(el.def.w)); ew.preferredSize.width = COLW;
        var et = row.add("edittext", undefined, f2(el.def.t)); et.preferredSize.width = COLW;
        var eb = row.add("edittext", undefined, f2(el.def.b)); eb.preferredSize.width = COLW;
        var inn = row.add("statictext", undefined, ""); inn.preferredSize.width = 60;
        UI[el.key] = { cb: cb, o: eo, w: ew, t: et, b: eb, inner: inn };
    }

    pC.add("statictext", undefined, "A) Satzblock-Seiten (mit BYH-Rahmen):");
    headerRow(pC);
    for (var e = 0; e < ELEMS.length; e++) { if (ELEMS[e].grp === "A") { addRow(pC, ELEMS[e]); } }
    pC.add("panel").preferredSize = [600, 1];
    pC.add("statictext", undefined, "B) Einzelrahmen-Seiten (ohne BYH-Rahmen, z. B. Index):");
    headerRow(pC);
    addRow(pC, elemByKey("BODY"));

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
        "Der Seitentyp wird pro Seite automatisch erkannt. Waagrecht wird gespiegelt (links/rechts).\n" +
        "Einzelrahmen: Vorgabe = Textbereich der Satzblock-Seiten (HE oben 21 mm … EN unten 229 mm).",
        { multiline: true });
    note.preferredSize = [600, 34];

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
        var m = measure(p), got = [], miss = [];
        for (var e2 = 0; e2 < ELEMS.length; e2++) {
            var kk = ELEMS[e2].key, v = m[kk];
            if (!v) { if (m.isA ? ELEMS[e2].grp === "A" : ELEMS[e2].grp === "B") { miss.push(ELEMS[e2].name); } continue; }
            UI[kk].o.text = f2(v.o); UI[kk].w.text = f2(v.w);
            UI[kk].t.text = f2(v.t); UI[kk].b.text = f2(v.b);
            got.push(ELEMS[e2].name + (v.derived ? " (aus HE/EN abgeleitet)" : ""));
        }
        if (m.HE && !cbVar.value) { UI.HE.b.text = ""; }
        if (m.EN && !cbVar.value) { UI.EN.t.text = ""; }
        updInner();
        alert("Seite " + p.name + " (" + (m.isA ? "Satzblock-Seite" : "Einzelrahmen-Seite") + ")\n\nÜbernommen:\n  " +
              (got.length ? got.join("\n  ") : "nichts") +
              (miss.length ? "\n\nNicht eindeutig gefunden:\n  " + miss.join("\n  ") : ""));
    };

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
    var log = [], warn = [], nPages = 0, nChanged = 0, nOk = 0, nSkip = [], nA = 0, nB = 0;
    var stories = [], storyIds = {};

    function applyBounds(it, nb, isLine) {
        var lay = it.itemLayer, ll = lay.locked, il = it.locked;
        if ((ll || il) && !unlock) { return false; }
        if (ll) { lay.locked = false; }
        if (il) { it.locked = false; }
        if (isLine) { it.paths[0].entirePath = [[nb[1], nb[0]], [nb[3], nb[0]]]; }
        else { it.geometricBounds = nb; }
        if (il) { it.locked = true; }
        if (ll) { lay.locked = true; }
        return true;
    }

    function rememberStory(it) {
        try {
            if (it.constructor.name !== "TextFrame") { return; }
            var s = it.parentStory, id = String(s.id);
            if (!storyIds[id]) { storyIds[id] = true; stories.push(s); }
        } catch (eS) {}
    }

    function run() {
        withMM(function () {
            for (var i = iFrom; i <= iTo; i++) {
                var pg = doc.pages[i];
                nPages++;
                var items = findItems(pg);
                var keys;
                if (items.isA) { keys = ["HEAD", "LINE", "HE", "EN", "PN"]; nA++; }
                else if (items.BODY.length === 1) { keys = ["BODY"]; nB++; }
                else {
                    nSkip.push(pg.name + (items.bodyNote ? " (" + items.bodyNote + ")" : ""));
                    continue;
                }
                if (items.bodyNote && keys[0] === "BODY") { warn.push("S. " + pg.name + ": " + items.bodyNote); }

                var pb = pg.bounds, isRight = (pg.side === PageSideOptions.RIGHT_HAND);
                var parts = [], pageChanged = false;

                for (var kk = 0; kk < keys.length; kk++) {
                    var key = keys[kk], T = TGT[key], nm = elemByKey(key).name;
                    if (!T) { continue; }
                    var arr = items[key];
                    if (arr.length === 0) { warn.push("S. " + pg.name + ": " + nm + " fehlt"); continue; }
                    if (arr.length > 1)   { warn.push("S. " + pg.name + ": " + nm + " mehrfach (" + arr.length + "×) – übersprungen"); continue; }
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
                        warn.push("S. " + pg.name + ": " + nm + " – Unten läge über Oben, übersprungen"); continue;
                    }

                    var d = [nb[0] - g[0], nb[1] - g[1], nb[2] - g[2], nb[3] - g[3]];
                    if (Math.abs(d[0]) < EPS && Math.abs(d[1]) < EPS && Math.abs(d[2]) < EPS && Math.abs(d[3]) < EPS) { continue; }

                    var sub = [];
                    if (Math.abs(d[1]) >= EPS || Math.abs(d[3]) >= EPS) {
                        sub.push("x " + fmtD(d[1]) + (Math.abs(d[3] - d[1]) >= EPS ? " / Breite " + fmtD(d[3] - d[1]) : ""));
                    }
                    if (Math.abs(d[0]) >= EPS) { sub.push("oben " + fmtD(d[0])); }
                    if (Math.abs(d[2]) >= EPS && key !== "LINE") { sub.push("unten " + fmtD(d[2])); }

                    if (!dry) {
                        if (!applyBounds(it, nb, key === "LINE")) { warn.push("S. " + pg.name + ": " + nm + " gesperrt – übersprungen"); continue; }
                        rememberStory(it);
                    }
                    parts.push(nm + " [" + sub.join(", ") + "]");
                    pageChanged = true;
                }

                if (pageChanged) {
                    nChanged++;
                    log.push("S. " + pg.name + (isRight ? " (R" : " (L") + (items.isA ? ", Satzblock)" : ", Einzelrahmen)") + ": " + parts.join("; "));
                } else { nOk++; }
            }
        });
    }

    var fatal = null;
    try {
        if (dry) { run(); }
        else { app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "BYH: Rahmen-Positionen setzen"); }
    } catch (ex) { fatal = "FEHLER: " + ex + (ex.line ? " (Zeile " + ex.line + ")" : ""); }

    // Übersatz pro Textabschnitt (letzter Rahmen der Verkettung)
    var overset = [];
    if (!dry) {
        for (var s = 0; s < stories.length; s++) {
            try {
                if (stories[s].overflows) {
                    var tc = stories[s].textContainers, last = tc[tc.length - 1], pn = "?";
                    try { pn = last.parentPage ? last.parentPage.name : "Montagefläche"; } catch (eP) {}
                    overset.push("Textabschnitt endet auf S. " + pn + " mit Übersatz – ggf. Seite(n) hinzufügen");
                }
            } catch (eOv) {}
        }
    }

    // ------------------------------------------------------------ Bericht
    var L = [];
    L.push(dry ? "PRÜFLAUF – es wurde nichts verändert." : "Fertig. Rückgängig: einmal Strg+Z / Cmd+Z.");
    L.push("Bereich: S. " + doc.pages[iFrom].name + " – " + doc.pages[iTo].name + "   |   Seiten: " + nPages +
           "   |   Satzblock: " + nA + "   |   Einzelrahmen: " + nB);
    L.push((dry ? "abweichend: " : "geändert: ") + nChanged + "   |   bereits korrekt: " + nOk + "   |   übersprungen: " + nSkip.length);
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
    if (overset.length) { L.push(""); L.push("ÜBERSATZ:"); L = L.concat(overset); }
    if (warn.length) { L.push(""); L.push("WARNUNGEN:"); L = L.concat(warn); }
    if (nSkip.length) { L.push(""); L.push("Übersprungen (kein erkennbarer Rahmen): " + nSkip.join(", ")); }
    L.push(""); L.push(dry ? "ABWEICHUNGEN (würden korrigiert):" : "ÄNDERUNGEN:");
    if (!log.length) { L.push("  keine"); }
    var txt = L.concat(log).join("\n");

    var r = new Window("dialog", "BYH – Bericht");
    r.alignChildren = ["fill", "top"];
    var ed = r.add("edittext", undefined, txt, { multiline: true, scrolling: true, readonly: true });
    ed.preferredSize = [780, 440];
    var gr = r.add("group"); gr.alignment = "right";
    var bs = gr.add("button", undefined, "Bericht speichern …");
    gr.add("button", undefined, "OK", { name: "ok" });
    bs.onClick = function () {
        var f = File.saveDialog("Bericht speichern", "*.txt");
        if (f) { f.encoding = "UTF-8"; f.open("w"); f.write(txt); f.close(); }
    };
    r.show();

})();
